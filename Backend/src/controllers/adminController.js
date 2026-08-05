const User = require('../models/User');
const Interviewer = require('../models/Interviewer');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Review = require('../models/Review');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * GET /admin/stats
 * Admin — platform KPIs
 */
const getPlatformStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
  ] = await Promise.all([
    User.countDocuments({ isActive: true, role: { $ne: 'admin' } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth }, role: 'user' }),
    Interviewer.countDocuments({ isApproved: true }),
    Interviewer.countDocuments({ status: 'pending' }),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'completed', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Subscription.countDocuments({ status: 'active' }),
    Review.countDocuments({ moderationStatus: 'flagged' }),
  ]);

  // Monthly revenue for bar chart (last 6 months)
  const monthlyRevenue = await Payment.aggregate([
    { $match: { status: 'completed', paidAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
    {
      $group: {
        _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return ApiResponse.success(res, {
    users: {
      total: totalUsers,
      newThisMonth: newUsersThisMonth,
    },
    interviewers: {
      total: totalInterviewers,
      pending: pendingInterviewers,
    },
    bookings: {
      total: totalBookings,
      thisMonth: bookingsThisMonth,
    },
    revenue: {
      total: totalRevenue[0]?.total ?? 0,
      thisMonth: revenueThisMonth[0]?.total ?? 0,
    },
    activeSubscriptions,
    pendingReviews,
    monthlyRevenue,
  });
});

/**
 * GET /admin/users
 * Admin — paginated user list with search
 */
const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, isActive } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('-password -refreshTokens'),
    User.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, users, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

/**
 * GET /admin/users/:id
 * Admin — full user details
 */
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokens');
  if (!user) throw new NotFoundError('User not found');

  const [bookings, subscription] = await Promise.all([
    Booking.find({ user: user._id }).sort({ createdAt: -1 }).limit(5),
    Subscription.findOne({ user: user._id, status: 'active' }),
  ]);

  return ApiResponse.success(res, { user, bookings, subscription });
});

/**
 * PATCH /admin/users/:id
 * Admin — update user (role, isActive, etc.)
 */
const updateUser = asyncHandler(async (req, res) => {
  const allowedFields = ['role', 'isActive', 'isEmailVerified'];
  const updates = {};
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select(
    '-password -refreshTokens'
  );
  if (!user) throw new NotFoundError('User not found');

  logger.info('Admin updated user', { adminId: req.user._id, targetUser: req.params.id, updates });

  return ApiResponse.success(res, user, 'User updated');
});

/**
 * DELETE /admin/users/:id
 * Admin — soft-delete a user
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  await user.softDelete();

  logger.warn('Admin soft-deleted user', { adminId: req.user._id, targetUser: req.params.id });

  return ApiResponse.noContent(res);
});

/**
 * GET /admin/interviewers
 * Admin — list all interviewers (including pending/rejected)
 */
const listAllInterviewers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [interviewers, total] = await Promise.all([
    Interviewer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email avatar'),
    Interviewer.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, interviewers, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

/**
 * PATCH /admin/interviewers/:id/approve
 * Admin — approve an interviewer application
 */
const approveInterviewer = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  interviewer.isApproved = true;
  interviewer.isVerified = true;
  interviewer.status = 'active';
  interviewer.approvedAt = new Date();
  interviewer.approvedBy = req.user._id;
  await interviewer.save();

  logger.info('Interviewer approved', { adminId: req.user._id, interviewerId: interviewer._id });

  return ApiResponse.success(res, interviewer, 'Interviewer approved');
});

/**
 * PATCH /admin/interviewers/:id/reject
 * Admin — reject an interviewer application
 */
const rejectInterviewer = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  interviewer.isApproved = false;
  interviewer.status = 'rejected';
  interviewer.rejectionReason = reason || 'Application did not meet requirements';
  await interviewer.save();

  logger.info('Interviewer rejected', { adminId: req.user._id, interviewerId: interviewer._id });

  return ApiResponse.success(res, interviewer, 'Interviewer rejected');
});

/**
 * GET /admin/bookings
 * Admin — list all bookings
 */
const listAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName email')
      .populate({ path: 'interviewer', populate: { path: 'user', select: 'firstName lastName' } }),
    Booking.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, bookings, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

module.exports = {
  getPlatformStats,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  listAllInterviewers,
  approveInterviewer,
  rejectInterviewer,
  listAllBookings,
};

// Made with Bob
