const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interviewer',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
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
    aspects: {
      expertise: {
        type: Number,
        min: 1,
        max: 5,
      },
      communication: {
        type: Number,
        min: 1,
        max: 5,
      },
      punctuality: {
        type: Number,
        min: 1,
        max: 5,
      },
      helpfulness: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    pros: [
      {
        type: String,
        trim: true,
      },
    ],
    cons: [
      {
        type: String,
        trim: true,
      },
    ],
    wouldRecommend: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    response: {
      comment: String,
      respondedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
reviewSchema.index({ interviewer: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ booking: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ isPublished: 1 });

// Ensure one review per booking
reviewSchema.index({ booking: 1 }, { unique: true });

// Virtual for average aspect rating
reviewSchema.virtual('aspectsAverage').get(function () {
  if (!this.aspects) return null;
  
  const ratings = Object.values(this.aspects).filter((r) => r !== undefined);
  if (ratings.length === 0) return null;
  
  const sum = ratings.reduce((acc, val) => acc + val, 0);
  return (sum / ratings.length).toFixed(2);
});

// Mark as helpful
reviewSchema.methods.markHelpful = function () {
  this.helpfulCount += 1;
  return this.save();
};

// Report review
reviewSchema.methods.report = function () {
  this.reportCount += 1;
  return this.save();
};

// Add response from interviewer
reviewSchema.methods.addResponse = function (comment) {
  this.response = {
    comment,
    respondedAt: new Date(),
  };
  return this.save();
};

// Publish review
reviewSchema.methods.publish = function () {
  this.isPublished = true;
  return this.save();
};

// Unpublish review
reviewSchema.methods.unpublish = function () {
  this.isPublished = false;
  return this.save();
};

// Transform output
reviewSchema.methods.toJSON = function () {
  const review = this.toObject();
  delete review.__v;
  return review;
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

// Made with Bob
