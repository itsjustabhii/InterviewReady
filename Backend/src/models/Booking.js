const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: [1000, 'Feedback comment cannot exceed 1000 characters'] },
    strengths: [{ type: String, trim: true }],
    improvements: [{ type: String, trim: true }],
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewerFeedbackSchema = new mongoose.Schema(
  {
    technicalSkills: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    problemSolving: { type: Number, min: 1, max: 5 },
    overallPerformance: { type: Number, min: 1, max: 5 },
    detailedFeedback: {
      type: String,
      trim: true,
      maxlength: [2000, 'Detailed feedback cannot exceed 2000 characters'],
    },
    recommendations: [{ type: String, trim: true }],
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
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
    // Reference to the specific AvailabilitySlot that was booked
    availabilitySlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AvailabilitySlot',
    },
    // Reference to the live InterviewSession created when booking starts
    interviewSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be in HH:MM format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be in HH:MM format'],
    },
    duration: {
      type: Number,
      required: true,
      default: 60, // minutes
      min: [15, 'Minimum session duration is 15 minutes'],
      max: [240, 'Maximum session duration is 240 minutes'],
    },
    interviewType: {
      type: String,
      enum: ['technical', 'behavioral', 'system-design', 'coding', 'mock-interview', 'resume-review'],
      required: [true, 'Interview type is required'],
    },
    expertise: {
      type: String,
      required: [true, 'Expertise area is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'pending',
    },
    meetingLink: { type: String, trim: true },
    meetingId: { type: String, trim: true },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    userNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'User notes cannot exceed 500 characters'],
    },
    feedback: feedbackSchema,
    interviewerFeedback: interviewerFeedbackSchema,
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    // Reminder tracking: prevent duplicate reminders
    reminderSent: {
      oneDay: { type: Boolean, default: false },
      oneHour: { type: Boolean, default: false },
    },
    completedAt: Date,
    // Reschedule history for audit trail
    rescheduleHistory: [
      {
        previousDate: { type: Date, required: true },
        previousStartTime: { type: String, required: true },
        rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rescheduledAt: { type: Date, default: Date.now },
        reason: { type: String, trim: true },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
bookingSchema.index({ user: 1, scheduledDate: -1 });                    // user booking history
bookingSchema.index({ interviewer: 1, scheduledDate: -1 });             // interviewer schedule
bookingSchema.index({ status: 1, scheduledDate: 1 });                   // status + time queries
bookingSchema.index({ scheduledDate: 1 });                              // upcoming bookings
bookingSchema.index({ createdAt: -1 });                                 // recent first
bookingSchema.index({ payment: 1 }, { sparse: true });                  // payment lookups
bookingSchema.index({ availabilitySlot: 1 }, { sparse: true });
bookingSchema.index({ interviewSession: 1 }, { sparse: true });
// Prevent double-booking the same interviewer slot (partial index on active statuses)
bookingSchema.index(
  { interviewer: 1, scheduledDate: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'confirmed', 'in-progress'] } },
    name: 'unique_active_interviewer_slot',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
bookingSchema.virtual('isPast').get(function () {
  return new Date() > this.scheduledDate;
});

bookingSchema.virtual('isUpcoming').get(function () {
  const now = new Date();
  const bookingDate = new Date(this.scheduledDate);
  return bookingDate > now && bookingDate - now < 24 * 60 * 60 * 1000;
});

bookingSchema.virtual('canCancel').get(function () {
  if (!['pending', 'confirmed'].includes(this.status)) return false;
  const hoursDifference = (new Date(this.scheduledDate) - new Date()) / (1000 * 60 * 60);
  return hoursDifference >= 24;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
bookingSchema.methods.canReschedule = function () {
  if (!['pending', 'confirmed'].includes(this.status)) return false;
  const hoursDifference = (new Date(this.scheduledDate) - new Date()) / (1000 * 60 * 60);
  return hoursDifference >= 24;
};

bookingSchema.methods.markCompleted = function () {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

bookingSchema.methods.cancel = function (userId, reason) {
  if (!this.canCancel) throw new Error('Booking cannot be cancelled at this time');
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  return this.save();
};

bookingSchema.methods.reschedule = function (userId, reason, previousDate, previousStartTime) {
  this.rescheduleHistory.push({ previousDate, previousStartTime, rescheduledBy: userId, reason });
  return this.save();
};

bookingSchema.methods.addFeedback = function (rating, comment, strengths, improvements) {
  this.feedback = { rating, comment, strengths, improvements, submittedAt: new Date() };
  return this.save();
};

bookingSchema.methods.addInterviewerFeedback = function (feedbackData) {
  this.interviewerFeedback = { ...feedbackData, submittedAt: new Date() };
  return this.save();
};

bookingSchema.methods.markReminderSent = function (type = 'oneDay') {
  if (this.reminderSent[type] !== undefined) {
    this.reminderSent[type] = true;
  }
  return this.save();
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

// Made with Bob
