const Interviewer = require('../models/Interviewer');
const User = require('../models/User');
const Review = require('../models/Review');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * GET /interviewers
 * Public — list approved/active interviewers with filtering, sorting, pagination
 */
const listInterviewers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    search,
    expertise,
    minRating,
    maxRate,
    minRate,
    experience,
    language,
    interviewType,
    sortBy = 'rating',
  } = req.query;

  const filter = { isApproved: true, status: 'active' };

  if (search) {
    filter.$text = { $search: search };
  }
  if (expertise) {
    filter.expertise = { $in: Array.isArray(expertise) ? expertise : [expertise] };
  }
  if (minRating) {
    filter['rating.average'] = { $gte: parseFloat(minRating) };
  }
  if (minRate || maxRate) {
    filter.hourlyRate = {};
    if (minRate) filter.hourlyRate.$gte = parseFloat(minRate);
    if (maxRate) filter.hourlyRate.$lte = parseFloat(maxRate);
  }
  if (experience) {
    filter.experience = { $gte: parseInt(experience, 10) };
  }
  if (language) {
    filter.languages = { $in: Array.isArray(language) ? language : [language] };
  }
  if (interviewType) {
    filter.interviewTypes = {
      $in: Array.isArray(interviewType) ? interviewType : [interviewType],
    };
  }

  const sortOptions = {
    rating: { 'rating.average': -1 },
    price_asc: { hourlyRate: 1 },
    price_desc: { hourlyRate: -1 },
    experience: { experience: -1 },
    sessions: { completedInterviews: -1 },
  };
  const sort = sortOptions[sortBy] || sortOptions.rating;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [interviewers, total] = await Promise.all([
    Interviewer.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName avatar bio location timezone'),
    Interviewer.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, interviewers, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

/**
 * GET /interviewers/:id
 * Public — full interviewer profile + recent reviews
 */
const getInterviewer = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id).populate(
    'user',
    'firstName lastName avatar bio location timezone'
  );

  if (!interviewer || interviewer.status === 'rejected') {
    throw new NotFoundError('Interviewer not found');
  }

  const reviews = await Review.find({
    interviewer: interviewer._id,
    isPublished: true,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'firstName lastName avatar');

  return ApiResponse.success(res, { interviewer, reviews });
});

/**
 * POST /interviewers
 * Auth (user) — apply to become an interviewer
 */
const applyAsInterviewer = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const existing = await Interviewer.findOne({ user: userId });
  if (existing) {
    throw new BadRequestError('You have already applied as an interviewer');
  }

  const interviewer = await Interviewer.create({ user: userId, ...req.body });

  await User.findByIdAndUpdate(userId, { role: 'interviewer' });

  logger.info('New interviewer application', { userId, interviewerId: interviewer._id });

  return ApiResponse.created(res, interviewer, 'Application submitted successfully');
});

/**
 * PATCH /interviewers/:id
 * Auth (owner interviewer or admin) — update profile
 */
const updateInterviewer = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  const isOwner = interviewer.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new ForbiddenError('You do not have permission to update this profile');
  }

  // Non-admins cannot update approval/status fields
  const protectedFields = ['isApproved', 'isVerified', 'status', 'approvedBy', 'approvedAt'];
  if (req.user.role !== 'admin') {
    protectedFields.forEach((f) => delete req.body[f]);
  }

  Object.assign(interviewer, req.body);
  await interviewer.save();

  return ApiResponse.success(res, interviewer, 'Profile updated successfully');
});

/**
 * GET /interviewers/me
 * Auth (interviewer) — get own interviewer profile
 */
const getMyInterviewerProfile = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findOne({ user: req.user._id }).populate(
    'user',
    'firstName lastName avatar bio location timezone email'
  );

  if (!interviewer) throw new NotFoundError('Interviewer profile not found');

  return ApiResponse.success(res, interviewer);
});

/**
 * POST /interviewers/:id/availability
 * Auth (owner interviewer) — set weekly availability template
 */
const setAvailability = asyncHandler(async (req, res) => {
  const interviewer = await Interviewer.findById(req.params.id);
  if (!interviewer) throw new NotFoundError('Interviewer not found');

  if (interviewer.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ForbiddenError('Not authorized');
  }

  interviewer.availability = req.body.availability;
  await interviewer.save();

  return ApiResponse.success(res, interviewer.availability, 'Availability updated');
});

/**
 * GET /interviewers/filters/meta
 * Public — return filter metadata (all expertise tags, languages, etc.)
 */
const getFilterMeta = asyncHandler(async (_req, res) => {
  const [expertiseTags, languages, interviewTypes] = await Promise.all([
    Interviewer.distinct('expertise', { isApproved: true, status: 'active' }),
    Interviewer.distinct('languages', { isApproved: true, status: 'active' }),
    Interviewer.distinct('interviewTypes', { isApproved: true, status: 'active' }),
  ]);

  return ApiResponse.success(res, { expertiseTags, languages, interviewTypes });
});

module.exports = {
  listInterviewers,
  getInterviewer,
  applyAsInterviewer,
  updateInterviewer,
  getMyInterviewerProfile,
  setAvailability,
  getFilterMeta,
};

// Made with Bob
