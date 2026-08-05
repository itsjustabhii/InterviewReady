const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Interviewer = require('../models/Interviewer');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');
const { sendNotification } = require('./notificationController');

/**
 * POST /reviews
 * Auth — submit a review for a completed booking
 */
const createReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment, aspects, pros, cons, wouldRecommend } = req.body;

  if (!bookingId || !rating || !comment) {
    throw new BadRequestError('bookingId, rating, and comment are required');
  }

  // Verify booking belongs to user and is completed
  const booking = await Booking.findById(bookingId).populate('interviewer');
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('You can only review your own bookings');
  }
  if (booking.status !== 'completed') {
    throw new BadRequestError('You can only review completed bookings');
  }

  // One review per booking (enforced by index, but give a friendly message)
  const existing = await Review.findOne({ booking: bookingId });
  if (existing) throw new ConflictError('You have already reviewed this booking');

  const review = await Review.create({
    user: req.user._id,
    interviewer: booking.interviewer,
    booking: bookingId,
    rating,
    comment,
    aspects,
    pros,
    cons,
    wouldRecommend,
  });

  // Update interviewer's aggregate rating
  const interviewer = await Interviewer.findById(booking.interviewer);
  if (interviewer) {
    await interviewer.updateRating(rating);
  }

  // Notify the interviewer
  if (interviewer) {
    await sendNotification({
      userId: interviewer.user,
      type: 'review_received',
      title: 'New review received',
      message: `${req.user.firstName} left you a ${rating}-star review.`,
      data: { reviewId: review._id, bookingId },
      actionUrl: `/profile/reviews`,
    });
  }

  return ApiResponse.created(res, review, 'Review submitted');
});

/**
 * GET /reviews/interviewer/:interviewerId
 * Public — get paginated published reviews for an interviewer
 */
const getInterviewerReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'newest' } = req.query;

  const sort = sortBy === 'highest' ? { rating: -1 } : { createdAt: -1 };
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const filter = {
    interviewer: req.params.interviewerId,
    isPublished: true,
  };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('user', 'firstName lastName avatar'),
    Review.countDocuments(filter),
  ]);

  return ApiResponse.paginated(res, reviews, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
  });
});

/**
 * GET /reviews/my
 * Auth — reviews written by current user
 */
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('interviewer');

  return ApiResponse.success(res, reviews);
});

/**
 * POST /reviews/:id/response
 * Auth (interviewer) — reply to a review
 */
const respondToReview = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  if (!comment) throw new BadRequestError('Response comment is required');

  const review = await Review.findById(req.params.id).populate('interviewer');
  if (!review) throw new NotFoundError('Review not found');

  // Verify requester owns the interviewer profile being reviewed
  if (
    !review.interviewer ||
    review.interviewer.user.toString() !== req.user._id.toString()
  ) {
    throw new ForbiddenError('Only the reviewed interviewer can respond');
  }

  await review.addResponse(comment);

  // Notify the reviewer
  await sendNotification({
    userId: review.user,
    type: 'review_responded',
    title: 'Your review received a response',
    message: 'The interviewer responded to your review.',
    data: { reviewId: review._id },
    actionUrl: `/interviewers/${review.interviewer._id}`,
  });

  return ApiResponse.success(res, review, 'Response added');
});

/**
 * POST /reviews/:id/helpful
 * Auth — vote a review as helpful
 */
const markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new NotFoundError('Review not found');

  await review.markHelpful(req.user._id);

  return ApiResponse.success(res, { helpfulCount: review.helpfulCount });
});

/**
 * POST /reviews/:id/report
 * Auth — report a review for moderation
 */
const reportReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new NotFoundError('Review not found');

  await review.report();

  return ApiResponse.success(res, null, 'Review reported');
});

/**
 * PATCH /reviews/:id/moderate
 * Admin — approve / reject / flag a review
 */
const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'flagged'];
  if (!allowed.includes(status)) {
    throw new BadRequestError(`Status must be one of: ${allowed.join(', ')}`);
  }

  const review = await Review.findById(req.params.id);
  if (!review) throw new NotFoundError('Review not found');

  await review.moderate(req.user._id, status);

  return ApiResponse.success(res, review, 'Review moderated');
});

module.exports = {
  createReview,
  getInterviewerReviews,
  getMyReviews,
  respondToReview,
  markHelpful,
  reportReview,
  moderateReview,
};

// Made with Bob
