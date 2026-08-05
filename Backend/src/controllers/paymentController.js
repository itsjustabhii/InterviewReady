const paymentService = require('../services/paymentService');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../utils/errors');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');

/**
 * POST /payments/orders/booking
 * Auth — create Razorpay order for a booking
 */
const createBookingOrder = asyncHandler(async (req, res) => {
  const { bookingId, amount, currency = 'INR' } = req.body;
  if (!bookingId || !amount) throw new BadRequestError('bookingId and amount are required');

  const order = await paymentService.createBookingOrder(
    req.user._id,
    bookingId,
    amount,
    currency
  );

  return ApiResponse.created(res, order, 'Order created');
});

/**
 * POST /payments/orders/subscription
 * Auth — create Razorpay order for a subscription plan
 */
const createSubscriptionOrder = asyncHandler(async (req, res) => {
  const { plan, amount, currency = 'INR' } = req.body;
  if (!plan || !amount) throw new BadRequestError('plan and amount are required');

  const order = await paymentService.createSubscriptionOrder(
    req.user._id,
    plan,
    amount,
    currency
  );

  return ApiResponse.created(res, order, 'Order created');
});

/**
 * POST /payments/verify
 * Auth — verify Razorpay signature and mark payment complete
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!paymentId || !razorpayPaymentId || !razorpaySignature) {
    throw new BadRequestError('paymentId, razorpayPaymentId, and razorpaySignature are required');
  }

  const payment = await paymentService.verifyAndCompletePayment(
    paymentId,
    razorpayPaymentId,
    razorpaySignature
  );

  return ApiResponse.success(res, payment, 'Payment verified');
});

/**
 * GET /payments/history
 * Auth — get current user's payment history
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await paymentService.getUserPayments(
    req.user._id,
    parseInt(page, 10),
    parseInt(limit, 10)
  );

  return ApiResponse.paginated(res, result.payments, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total: result.pagination.total,
  });
});

/**
 * GET /payments/:id
 * Auth — get single payment (must own it or be admin)
 */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentDetails(req.params.id);

  if (
    payment.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    throw new ForbiddenError('Access denied');
  }

  return ApiResponse.success(res, payment);
});

/**
 * POST /payments/:id/refund
 * Auth — request refund (within 7-day window)
 */
const requestRefund = asyncHandler(async (req, res) => {
  const { reason, amount } = req.body;

  const check = await Payment.findById(req.params.id);
  if (!check) throw new NotFoundError('Payment not found');
  if (check.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ForbiddenError('Access denied');
  }

  const payment = await paymentService.processRefund(req.params.id, amount, reason);

  return ApiResponse.success(res, payment, 'Refund initiated');
});

/**
 * POST /payments/webhook
 * Public (Razorpay) — webhook handler
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) throw new BadRequestError('Missing webhook signature');

  await paymentService.handleWebhook(signature, req.body);

  return ApiResponse.success(res, null, 'Webhook processed');
});

/**
 * GET /payments/admin/all
 * Admin — list all payments with filters
 */
const adminListPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, userId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.user = userId;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email')
      .populate('booking')
      .populate('subscription'),
    Payment.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, payments, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

module.exports = {
  createBookingOrder,
  createSubscriptionOrder,
  verifyPayment,
  getPaymentHistory,
  getPayment,
  requestRefund,
  handleWebhook,
  adminListPayments,
};

// Made with Bob
