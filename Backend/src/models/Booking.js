const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
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
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
    },
    duration: {
      type: Number,
      required: true,
      default: 60, // minutes
    },
    interviewType: {
      type: String,
      enum: ['technical', 'behavioral', 'system-design', 'coding', 'mock-interview', 'resume-review'],
      required: true,
    },
    expertise: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'pending',
    },
    meetingLink: {
      type: String,
    },
    meetingId: {
      type: String,
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    userNotes: {
      type: String,
      maxlength: [500, 'User notes cannot exceed 500 characters'],
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        maxlength: [1000, 'Feedback comment cannot exceed 1000 characters'],
      },
      strengths: [String],
      improvements: [String],
      submittedAt: Date,
    },
    interviewerFeedback: {
      technicalSkills: {
        type: Number,
        min: 1,
        max: 5,
      },
      communication: {
        type: Number,
        min: 1,
        max: 5,
      },
      problemSolving: {
        type: Number,
        min: 1,
        max: 5,
      },
      overallPerformance: {
        type: Number,
        min: 1,
        max: 5,
      },
      detailedFeedback: {
        type: String,
        maxlength: [2000, 'Detailed feedback cannot exceed 2000 characters'],
      },
      recommendations: [String],
      submittedAt: Date,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    cancellationReason: {
      type: String,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    reminderSent: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
bookingSchema.index({ user: 1, scheduledDate: -1 });
bookingSchema.index({ interviewer: 1, scheduledDate: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for is past
bookingSchema.virtual('isPast').get(function () {
  return new Date() > this.scheduledDate;
});

// Virtual for is upcoming
bookingSchema.virtual('isUpcoming').get(function () {
  const now = new Date();
  const bookingDate = new Date(this.scheduledDate);
  return bookingDate > now && bookingDate - now < 24 * 60 * 60 * 1000; // Within 24 hours
});

// Virtual for can cancel
bookingSchema.virtual('canCancel').get(function () {
  if (this.status !== 'pending' && this.status !== 'confirmed') {
    return false;
  }
  const now = new Date();
  const bookingDate = new Date(this.scheduledDate);
  const hoursDifference = (bookingDate - now) / (1000 * 60 * 60);
  return hoursDifference >= 24; // Can cancel if more than 24 hours away
});

// Check if booking can be rescheduled
bookingSchema.methods.canReschedule = function () {
  if (this.status !== 'pending' && this.status !== 'confirmed') {
    return false;
  }
  const now = new Date();
  const bookingDate = new Date(this.scheduledDate);
  const hoursDifference = (bookingDate - now) / (1000 * 60 * 60);
  return hoursDifference >= 24;
};

// Mark as completed
bookingSchema.methods.markCompleted = function () {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Cancel booking
bookingSchema.methods.cancel = function (userId, reason) {
  if (!this.canCancel) {
    throw new Error('Booking cannot be cancelled at this time');
  }
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

// Add feedback
bookingSchema.methods.addFeedback = function (rating, comment, strengths, improvements) {
  this.feedback = {
    rating,
    comment,
    strengths,
    improvements,
    submittedAt: new Date(),
  };
  return this.save();
};

// Add interviewer feedback
bookingSchema.methods.addInterviewerFeedback = function (feedbackData) {
  this.interviewerFeedback = {
    ...feedbackData,
    submittedAt: new Date(),
  };
  return this.save();
};

// Send reminder
bookingSchema.methods.markReminderSent = function () {
  this.reminderSent = true;
  return this.save();
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

// Made with Bob
