const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interviewer',
      required: [true, 'Interviewer reference is required'],
    },
    // One review per booking; enforced by unique index below
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      minlength: [10, 'Comment must be at least 10 characters'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    // Granular aspect ratings
    aspects: {
      expertise: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      punctuality: { type: Number, min: 1, max: 5 },
      helpfulness: { type: Number, min: 1, max: 5 },
    },
    pros: [{ type: String, trim: true, maxlength: 200 }],
    cons: [{ type: String, trim: true, maxlength: 200 }],
    wouldRecommend: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: true,   // true if linked to a completed booking
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    helpfulVotes: {
      // Store user IDs to prevent duplicate votes
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      select: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Interviewer's public reply to the review
    response: {
      comment: { type: String, trim: true, maxlength: 1000 },
      respondedAt: Date,
    },
    // Admin moderation
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'approved',
    },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
reviewSchema.index({ booking: 1 }, { unique: true });               // one review per booking
reviewSchema.index({ interviewer: 1, createdAt: -1 });              // interviewer profile reviews
reviewSchema.index({ interviewer: 1, isPublished: 1, rating: -1 }); // published reviews by rating
reviewSchema.index({ user: 1, createdAt: -1 });                     // user's reviews history
reviewSchema.index({ rating: -1 });                                 // sort by rating
reviewSchema.index({ isPublished: 1 });                             // public listings
reviewSchema.index({ moderationStatus: 1 });                        // admin queue
// Full-text search on review content
reviewSchema.index(
  { comment: 'text' },
  { name: 'review_text_search' }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
reviewSchema.virtual('aspectsAverage').get(function () {
  if (!this.aspects) return null;
  const ratings = Object.values(this.aspects.toObject ? this.aspects.toObject() : this.aspects)
    .filter((r) => typeof r === 'number' && !isNaN(r));
  if (ratings.length === 0) return null;
  return +(ratings.reduce((acc, val) => acc + val, 0) / ratings.length).toFixed(2);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
reviewSchema.methods.markHelpful = function (userId) {
  // Prevent duplicate votes (helpfulVotes stored but not returned by default)
  this.helpfulCount += 1;
  return this.save();
};

reviewSchema.methods.report = function () {
  this.reportCount += 1;
  // Auto-flag for moderation after 3 reports
  if (this.reportCount >= 3 && this.moderationStatus === 'approved') {
    this.moderationStatus = 'flagged';
  }
  return this.save();
};

reviewSchema.methods.addResponse = function (comment) {
  this.response = { comment, respondedAt: new Date() };
  return this.save();
};

reviewSchema.methods.publish = function () {
  this.isPublished = true;
  return this.save();
};

reviewSchema.methods.unpublish = function () {
  this.isPublished = false;
  return this.save();
};

reviewSchema.methods.moderate = function (adminId, status) {
  this.moderationStatus = status;
  this.moderatedBy = adminId;
  this.moderatedAt = new Date();
  if (status === 'rejected') this.isPublished = false;
  return this.save();
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
reviewSchema.methods.toJSON = function () {
  const review = this.toObject();
  delete review.helpfulVotes;
  delete review.__v;
  return review;
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

// Made with Bob
