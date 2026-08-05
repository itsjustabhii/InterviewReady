const User = require('../models/User');
const Interviewer = require('../models/Interviewer');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Testimonial = require('../models/Testimonial');
const EmailCampaign = require('../models/EmailCampaign');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');

// ─── Overview Stats ───────────────────────────────────────────────────────────

const getPlatformStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalUsers,
    newUsersThisMonth,
    totalInterviewers,
    pendingInterviewers,
    totalBookings,
    bookingsThisMonth,
    totalRevenue,
    revenueThisMonth,
    activeSubscriptions,
    pendingReviews,
    totalRefunds,
    pendingCampaigns,
  ] = await Promise.all([
    User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth }, role: 'user' }),
    Interviewer.countDocuments({ isApproved: true }),
    Interviewer.countDocuments({ status: 'pending' }),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Payment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { status: 'completed', paidAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Subscription.countDocuments({ status: 'active' }),
    Review.countDocuments({ moderationStatus: 'flagged' }),
    Payment.countDocuments({ status: 'refunded' }),
    EmailCampaign.countDocuments({ status: 'scheduled' }),
  ]);

  const monthlyRevenue = await Payment.aggregate([
    { $match: { status: 'completed', paidAt: { $gte: sixMonthsAgo } } },
    { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Subscription plan distribution
  const subsByPlan = await Subscription.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$plan', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
    { $sort: { count: -1 } },
  ]);

  // Daily signups last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dailySignups = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo }, role: 'user' } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return ApiResponse.success(res, {
    users: { total: totalUsers, newThisMonth: newUsersThisMonth },
    interviewers: { total: totalInterviewers, pending: pendingInterviewers },
    bookings: { total: totalBookings, thisMonth: bookingsThisMonth },
    revenue: { total: totalRevenue[0]?.total ?? 0, thisMonth: revenueThisMonth[0]?.total ?? 0 },
    activeSubscriptions,
    pendingReviews,
    totalRefunds,
    pendingCampaigns,
    monthlyRevenue,
    subsByPlan,
    dailySignups,
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, isActive } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).select('-password -refreshTokens'),
    User.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, users, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokens');
  if (!user) throw new NotFoundError('User not found');

  const [bookings, subscription, payments] = await Promise.all([
    Booking.find({ user: user._id }).sort({ createdAt: -1 }).limit(5),
    Subscription.findOne({ user: user._id, status: 'active' }),
    Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).select('-paymentGatewayResponse'),
  ]);

  return ApiResponse.success(res, { user, bookings, subscription, payments });
});

const updateUser = asyncHandler(async (req, res) => {
  const allowedFields = ['role', 'isActive', 'isEmailVerified'];
  const updates = {};
  allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password -refreshTokens');
  if (!user) throw new NotFoundError('User not found');

  logger.info('Admin updated user', { adminId: req.user._id, targetUser: req.params.id, updates });
  return ApiResponse.success(res, user, 'User updated');
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');
  await user.softDelete();
  logger.warn('Admin soft-deleted user', { adminId: req.user._id, targetUser: req.params.id });
  return ApiResponse.noContent(res);
});

// ─── User Analytics ───────────────────────────────────────────────────────────

const getUserAnalytics = asyncHandler(async (_req, res) => {
  const now = new Date();
  const periods = [7, 30, 90].map((d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000));

  const [new7d, new30d, new90d, byRole, authProviders, activeVsInactive] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: periods[0] } }),
    User.countDocuments({ createdAt: { $gte: periods[1] } }),
    User.countDocuments({ createdAt: { $gte: periods[2] } }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$authProvider', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
  ]);

  // Cohort: new users by month (last 12 months)
  const cohort = await User.aggregate([
    { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return ApiResponse.success(res, { new7d, new30d, new90d, byRole, authProviders, activeVsInactive, cohort });
});

// ─── Interviewers ─────────────────────────────────────────────────────────────

const listAllInterviewers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const userIds = await User.find({ $text: { $search: search } }).distinct('_id');
    filter.user = { $in: userIds };
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [interviewers, total] = await Promise.all([
    Interviewer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email avatar'),
    Interviewer.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, interviewers, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const approveInterviewer = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id).populate('user', 'firstName lastName email');
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  interviewer.isApproved = true;
  interviewer.isVerified = true;
  interviewer.status = 'active';
  interviewer.approvedAt = new Date();
  interviewer.approvedBy = req.user._id;
  await interviewer.save();

  // Create in-app notification for the interviewer
  await Notification.create({
    user: interviewer.user._id,
    type: 'interviewer_approved',
    title: 'Application Approved! 🎉',
    message: 'Congratulations! Your interviewer application has been approved. You can now receive bookings.',
    priority: 'high',
    actionUrl: '/profile',
  });

  // Push via socket
  socketService.emitToUser(interviewer.user._id.toString(), 'notification:new', {
    type: 'interviewer_approved',
    title: 'Application Approved!',
    message: 'You are now an active interviewer on InterviewReady.',
  });

  logger.info('Interviewer approved', { adminId: req.user._id, interviewerId: interviewer._id });
  return ApiResponse.success(res, interviewer, 'Interviewer approved');
});

const rejectInterviewer = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const interviewer = await Interviewer.findById(req.params.id).populate('user', '_id firstName');
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  interviewer.isApproved = false;
  interviewer.status = 'rejected';
  interviewer.rejectionReason = reason || 'Application did not meet requirements';
  await interviewer.save();

  await Notification.create({
    user: interviewer.user._id,
    type: 'interviewer_rejected',
    title: 'Application Update',
    message: reason || 'Your interviewer application was not approved at this time.',
    priority: 'high',
    actionUrl: '/profile',
  });

  logger.info('Interviewer rejected', { adminId: req.user._id, interviewerId: interviewer._id });
  return ApiResponse.success(res, interviewer, 'Interviewer rejected');
});

const suspendInterviewer = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  interviewer.status = 'suspended';
  await interviewer.save();

  logger.warn('Interviewer suspended', { adminId: req.user._id, interviewerId: interviewer._id, reason });
  return ApiResponse.success(res, interviewer, 'Interviewer suspended');
});

const reactivateInterviewer = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');
  if (!interviewer.isApproved) throw new BadRequestError('Interviewer was never approved');

  interviewer.status = 'active';
  await interviewer.save();

  return ApiResponse.success(res, interviewer, 'Interviewer reactivated');
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

const listAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, userId, interviewerId, dateFrom, dateTo } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.user = userId;
  if (interviewerId) filter.interviewer = interviewerId;
  if (dateFrom || dateTo) {
    filter.scheduledDate = {};
    if (dateFrom) filter.scheduledDate.$gte = new Date(dateFrom);
    if (dateTo) filter.scheduledDate.$lte = new Date(dateTo);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email')
      .populate({ path: 'interviewer', populate: { path: 'user', select: 'firstName lastName' } })
      .populate('payment', 'amount status razorpayPaymentId'),
    Booking.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, bookings, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const cancelBookingAdmin = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id).populate('user', '_id');
  if (!booking) throw new NotFoundError('Booking not found');
  if (['completed', 'cancelled'].includes(booking.status)) {
    throw new BadRequestError(`Cannot cancel a ${booking.status} booking`);
  }

  booking.status = 'cancelled';
  booking.cancellationReason = reason || 'Cancelled by admin';
  await booking.save();

  await Notification.create({
    user: booking.user._id,
    type: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: reason || 'Your booking has been cancelled by an administrator.',
    priority: 'high',
    data: { bookingId: booking._id },
    actionUrl: '/bookings',
  });

  logger.warn('Admin cancelled booking', { adminId: req.user._id, bookingId: booking._id, reason });
  return ApiResponse.success(res, booking, 'Booking cancelled');
});

// ─── Payments ─────────────────────────────────────────────────────────────────

const listAllPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, userId, dateFrom, dateTo, minAmount, maxAmount } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (userId) filter.user = userId;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = parseFloat(minAmount);
    if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email')
      .populate('booking', 'type scheduledDate')
      .populate('subscription', 'plan planName'),
    Payment.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, payments, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const getPaymentAnalytics = asyncHandler(async (_req, res) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [byStatus, byMethod, monthlyTrend, refundStats] = await Promise.all([
    Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }]),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', paidAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Payment.aggregate([
      { $match: { status: 'refunded' } },
      { $group: { _id: null, count: { $sum: 1 }, totalRefunded: { $sum: '$refund.amount' } } },
    ]),
  ]);

  return ApiResponse.success(res, { byStatus, byMethod, monthlyTrend, refundStats: refundStats[0] || { count: 0, totalRefunded: 0 } });
});

const adminInitiateRefund = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.status !== 'completed') throw new BadRequestError('Only completed payments can be refunded');

  const refundAmount = amount || payment.amount;
  payment.refund = {
    amount: refundAmount,
    reason: reason || 'Admin initiated refund',
    status: 'processing',
    initiatedAt: new Date(),
  };
  payment.status = 'refunded';
  await payment.save();

  // Notify user
  const booking = payment.booking ? await Booking.findById(payment.booking).populate('user', '_id') : null;
  const userId = booking?.user?._id || payment.user;
  if (userId) {
    await Notification.create({
      user: userId,
      type: 'payment_refunded',
      title: 'Refund Initiated',
      message: `A refund of ₹${refundAmount.toLocaleString()} has been initiated to your account.`,
      priority: 'high',
      data: { paymentId: payment._id, amount: refundAmount },
    });
  }

  logger.info('Admin initiated refund', { adminId: req.user._id, paymentId: payment._id, amount: refundAmount });
  return ApiResponse.success(res, payment, 'Refund initiated');
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

const listAllSubscriptions = asyncHandler(async (req, res) => {
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
      .populate('user', 'firstName lastName email')
      .populate('payment', 'amount paidAt'),
    Subscription.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, subs, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const getSubscriptionAnalytics = asyncHandler(async (_req, res) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [byPlan, byStatus, monthlyNew, churnData, mrr] = await Promise.all([
    Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
      { $sort: { revenue: -1 } },
    ]),
    Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Subscription.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$price' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Subscription.aggregate([
      { $match: { status: { $in: ['cancelled', 'expired'] }, updatedAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$updatedAt' }, month: { $month: '$updatedAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, mrr: { $sum: '$price' } } },
    ]),
  ]);

  return ApiResponse.success(res, { byPlan, byStatus, monthlyNew, churnData, mrr: mrr[0]?.mrr ?? 0 });
});

const adminUpdateSubscription = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw new NotFoundError('Subscription not found');

  if (status === 'suspended') await sub.suspend(reason, req.user._id);
  else if (status === 'active') await sub.reactivate(req.user._id);
  else if (status === 'cancelled') await sub.cancel(reason, req.user._id);
  else throw new BadRequestError('Invalid status transition');

  return ApiResponse.success(res, sub, 'Subscription updated');
});

// ─── Reviews / Testimonials ───────────────────────────────────────────────────

const listAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, moderationStatus, rating } = req.query;
  const filter = {};
  if (moderationStatus) filter.moderationStatus = moderationStatus;
  if (rating) filter.rating = parseInt(rating, 10);

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName avatar')
      .populate({ path: 'interviewer', populate: { path: 'user', select: 'firstName lastName' } }),
    Review.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, reviews, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'flagged'];
  if (!allowed.includes(status)) throw new BadRequestError(`Status must be one of: ${allowed.join(', ')}`);

  const review = await Review.findById(req.params.id);
  if (!review) throw new NotFoundError('Review not found');
  await review.moderate(req.user._id, status);

  return ApiResponse.success(res, review, 'Review moderated');
});

// ─── Testimonials ─────────────────────────────────────────────────────────────

const listTestimonials = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isPublished } = req.query;
  const filter = {};
  if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [testimonials, total] = await Promise.all([
    Testimonial.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).populate('user', 'firstName lastName avatar'),
    Testimonial.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, testimonials, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const createTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.create({ ...req.body, createdBy: req.user._id, source: 'admin_created' });
  return ApiResponse.created(res, testimonial, 'Testimonial created');
});

const updateTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  return ApiResponse.success(res, testimonial, 'Testimonial updated');
});

const deleteTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
  if (!testimonial) throw new NotFoundError('Testimonial not found');
  return ApiResponse.noContent(res);
});

const promoteReviewToTestimonial = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.reviewId).populate('user', 'firstName lastName avatar');
  if (!review) throw new NotFoundError('Review not found');

  const user = typeof review.user === 'object' ? review.user : null;
  const testimonial = await Testimonial.create({
    user: user?._id,
    displayName: user ? `${user.firstName} ${user.lastName}` : 'Anonymous',
    avatarUrl: user?.avatar,
    content: review.comment,
    rating: review.rating,
    review: review._id,
    source: 'organic',
    createdBy: req.user._id,
  });

  return ApiResponse.created(res, testimonial, 'Review promoted to testimonial');
});

// ─── Email Campaigns ──────────────────────────────────────────────────────────

const listCampaigns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [campaigns, total] = await Promise.all([
    EmailCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).populate('createdBy', 'firstName lastName'),
    EmailCampaign.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, campaigns, { page: parseInt(page, 10), limit: parseInt(limit, 10), total });
});

const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.findById(req.params.id).populate('createdBy', 'firstName lastName');
  if (!campaign) throw new NotFoundError('Campaign not found');
  return ApiResponse.success(res, campaign);
});

const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.create({ ...req.body, createdBy: req.user._id });
  logger.info('Email campaign created', { adminId: req.user._id, campaignId: campaign._id });
  return ApiResponse.created(res, campaign, 'Campaign created');
});

const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.findById(req.params.id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (['sent', 'sending'].includes(campaign.status)) throw new BadRequestError('Cannot edit a campaign that has been sent or is sending');

  Object.assign(campaign, req.body);
  await campaign.save();

  return ApiResponse.success(res, campaign, 'Campaign updated');
});

const scheduleCampaign = asyncHandler(async (req, res) => {
  const { scheduledAt } = req.body;
  if (!scheduledAt || new Date(scheduledAt) <= new Date()) throw new BadRequestError('scheduledAt must be a future date');

  const campaign = await EmailCampaign.findById(req.params.id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status !== 'draft') throw new BadRequestError('Only draft campaigns can be scheduled');

  // Calculate recipient count based on target audience
  const audienceCounts = {
    all: await User.countDocuments({ isActive: true }),
    users: await User.countDocuments({ role: 'user', isActive: true }),
    interviewers: await User.countDocuments({ role: 'interviewer', isActive: true }),
    pro_subscribers: await Subscription.countDocuments({ status: 'active', plan: { $in: ['pro', 'premium'] } }),
    inactive_users: await User.countDocuments({ role: 'user', isActive: false }),
  };

  campaign.status = 'scheduled';
  campaign.scheduledAt = new Date(scheduledAt);
  campaign.stats.recipientCount = audienceCounts[campaign.targetAudience] || 0;
  await campaign.save();

  logger.info('Email campaign scheduled', { adminId: req.user._id, campaignId: campaign._id, scheduledAt });
  return ApiResponse.success(res, campaign, 'Campaign scheduled');
});

const cancelCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.findById(req.params.id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (!['draft', 'scheduled'].includes(campaign.status)) throw new BadRequestError('Campaign cannot be cancelled');

  campaign.status = 'cancelled';
  await campaign.save();

  return ApiResponse.success(res, campaign, 'Campaign cancelled');
});

const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.findById(req.params.id);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status === 'sending') throw new BadRequestError('Cannot delete a campaign that is sending');

  await campaign.deleteOne();
  return ApiResponse.noContent(res);
});

// ─── Platform-wide Notifications ─────────────────────────────────────────────

const sendPlatformNotification = asyncHandler(async (req, res) => {
  const { title, message, type = 'system_announcement', priority = 'medium', targetAudience = 'all', actionUrl, actionText } = req.body;

  if (!title || !message) throw new BadRequestError('title and message are required');

  // Build user filter
  const audienceFilter = { isActive: true };
  if (targetAudience === 'users') audienceFilter.role = 'user';
  else if (targetAudience === 'interviewers') audienceFilter.role = 'interviewer';

  const users = await User.find(audienceFilter).select('_id').lean();

  // Bulk insert notifications
  const notifDocs = users.map((u) => ({
    user: u._id,
    type,
    title,
    message,
    priority,
    actionUrl,
    actionText,
    data: { isGlobal: true },
  }));

  await Notification.insertMany(notifDocs, { ordered: false });

  // Push to all connected sockets
  const socketPayload = { type, title, message, priority, actionUrl, actionText, createdAt: new Date() };
  if (targetAudience === 'all') {
    socketService.broadcast('notification:new', socketPayload);
  } else {
    users.forEach((u) => socketService.emitToUser(u._id.toString(), 'notification:new', socketPayload));
  }

  logger.info('Platform notification sent', { adminId: req.user._id, targetAudience, recipientCount: users.length });
  return ApiResponse.success(res, { recipientCount: users.length }, `Notification sent to ${users.length} users`);
});

const listPlatformNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const filter = { 'data.isGlobal': true };
  if (type) filter.type = type;

  // Return distinct notifications (one per title/message/createdAt)
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [notifications, total] = await Promise.all([
    Notification.aggregate([
      { $match: filter },
      { $group: { _id: { title: '$title', message: '$message' }, doc: { $first: '$$ROOT' }, recipients: { $sum: 1 }, readCount: { $sum: { $cond: ['$isRead', 1, 0] } } } },
      { $sort: { 'doc.createdAt': -1 } },
      { $skip: skip },
      { $limit: parseInt(limit, 10) },
    ]),
    Notification.aggregate([
      { $match: filter },
      { $group: { _id: { title: '$title', message: '$message' } } },
      { $count: 'total' },
    ]),
  ]);

  return ApiResponse.paginated(res, notifications, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total: total[0]?.total ?? 0,
  });
});

module.exports = {
  // Stats
  getPlatformStats,
  getUserAnalytics,
  // Users
  listUsers, getUser, updateUser, deleteUser,
  // Interviewers
  listAllInterviewers, approveInterviewer, rejectInterviewer, suspendInterviewer, reactivateInterviewer,
  // Bookings
  listAllBookings, cancelBookingAdmin,
  // Payments
  listAllPayments, getPaymentAnalytics, adminInitiateRefund,
  // Subscriptions
  listAllSubscriptions, getSubscriptionAnalytics, adminUpdateSubscription,
  // Reviews
  listAllReviews, moderateReview,
  // Testimonials
  listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, promoteReviewToTestimonial,
  // Campaigns
  listCampaigns, getCampaign, createCampaign, updateCampaign, scheduleCampaign, cancelCampaign, deleteCampaign,
  // Notifications
  sendPlatformNotification, listPlatformNotifications,
};

// Made with Bob
