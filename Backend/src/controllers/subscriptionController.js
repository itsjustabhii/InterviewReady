const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const paymentService = require('../services/paymentService');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

// Plan definitions (source of truth for prices/features/limits)
const PLANS = {
  basic: {
    name: 'Basic',
    price: 999,
    currency: 'INR',
    duration: 30,
    interviewsLimit: 2,
    features: ['2 mock interviews/month', '30-min sessions', 'Feedback report', 'Email support'],
  },
  pro: {
    name: 'Pro',
    price: 2499,
    currency: 'INR',
    duration: 30,
    interviewsLimit: 6,
    features: [
      '6 mock interviews/month',
      '60-min sessions',
      'Detailed feedback report',
      'Code editor',
      'Priority support',
      'Recording download',
    ],
  },
  premium: {
    name: 'Premium',
    price: 4999,
    currency: 'INR',
    duration: 30,
    interviewsLimit: 15,
    features: [
      'Unlimited interviews',
      '90-min sessions',
      'Expert feedback',
      'System design rounds',
      'Resume review',
      'Dedicated account manager',
      'Priority booking',
    ],
  },
};

/**
 * GET /subscriptions/plans
 * Public — return available plan definitions
 */
const getPlans = asyncHandler(async (_req, res) => {
  return ApiResponse.success(res, PLANS);
});

/**
 * GET /subscriptions/my
 * Auth — get current user's active subscription
 */
const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    user: req.user._id,
    status: { $in: ['active', 'pending'] },
  }).populate('payment');

  // Check expiry and update status
  if (subscription) {
    await subscription.checkExpiry();
  }

  return ApiResponse.success(res, subscription);
});

/**
 * POST /subscriptions
 * Auth — create subscription (after payment)
 * Body: { plan, paymentId }
 */
const createSubscription = asyncHandler(async (req, res) => {
  const { plan, paymentId } = req.body;
  if (!plan || !PLANS[plan]) throw new BadRequestError('Invalid plan');

  // Check for existing active subscription
  const existing = await Subscription.findOne({
    user: req.user._id,
    status: 'active',
  });
  if (existing) throw new ConflictError('You already have an active subscription');

  const planDef = PLANS[plan];
  const endDate = new Date(Date.now() + planDef.duration * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    user: req.user._id,
    plan,
    planName: planDef.name,
    price: planDef.price,
    currency: planDef.currency,
    duration: planDef.duration,
    features: planDef.features,
    status: 'active',
    startDate: new Date(),
    endDate,
    payment: paymentId || null,
    usage: {
      interviewsUsed: 0,
      interviewsLimit: planDef.interviewsLimit,
    },
  });

  // Link payment to subscription
  if (paymentId) {
    await Payment.findByIdAndUpdate(paymentId, { subscription: subscription._id });
  }

  logger.info('Subscription created', { userId: req.user._id, plan, subscriptionId: subscription._id });

  return ApiResponse.created(res, subscription, 'Subscription activated');
});

/**
 * POST /subscriptions/my/cancel
 * Auth — cancel subscription
 */
const cancelSubscription = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const subscription = await Subscription.findOne({ user: req.user._id, status: 'active' });
  if (!subscription) throw new NotFoundError('No active subscription found');

  await subscription.cancel(reason || 'User requested cancellation', req.user._id);

  return ApiResponse.success(res, subscription, 'Subscription cancelled');
});

/**
 * POST /subscriptions/my/renew
 * Auth — renew subscription (creates new Razorpay order)
 */
const renewSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    user: req.user._id,
    status: { $in: ['active', 'expired'] },
  });
  if (!subscription) throw new NotFoundError('No subscription to renew');

  const planDef = PLANS[subscription.plan];
  if (!planDef) throw new BadRequestError('Invalid plan in subscription');

  const order = await paymentService.createSubscriptionOrder(
    req.user._id,
    subscription.plan,
    planDef.price,
    planDef.currency
  );

  return ApiResponse.success(res, order, 'Renewal order created');
});

/**
 * GET /subscriptions/admin/all
 * Admin — list all subscriptions
 */
const adminListSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, plan } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [subs, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email'),
    Subscription.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, subs, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

/**
 * PATCH /subscriptions/:id/status
 * Admin — manually change subscription status (suspend / reactivate)
 */
const adminUpdateSubscriptionStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) throw new NotFoundError('Subscription not found');

  if (status === 'suspended') await subscription.suspend(reason, req.user._id);
  else if (status === 'active') await subscription.reactivate(req.user._id);
  else throw new BadRequestError('Only "active" or "suspended" transitions are allowed here');

  return ApiResponse.success(res, subscription, 'Status updated');
});

module.exports = {
  getPlans,
  getMySubscription,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  adminListSubscriptions,
  adminUpdateSubscriptionStatus,
  PLANS,
};

// Made with Bob
