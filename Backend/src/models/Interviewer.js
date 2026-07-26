const mongoose = require('mongoose');

const interviewerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    expertise: [
      {
        type: String,
        required: true,
      },
    ],
    experience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Experience cannot be negative'],
    },
    company: {
      type: String,
      required: [true, 'Current company is required'],
      trim: true,
    },
    position: {
      type: String,
      required: [true, 'Current position is required'],
      trim: true,
    },
    linkedIn: {
      type: String,
      trim: true,
    },
    github: {
      type: String,
      trim: true,
    },
    portfolio: {
      type: String,
      trim: true,
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    availability: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        slots: [
          {
            startTime: { type: String, required: true }, // Format: "HH:MM"
            endTime: { type: String, required: true },
            isAvailable: { type: Boolean, default: true },
          },
        ],
      },
    ],
    languages: [
      {
        type: String,
        default: ['English'],
      },
    ],
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    totalInterviews: {
      type: Number,
      default: 0,
    },
    completedInterviews: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: ['id_proof', 'experience_letter', 'certificate'],
        },
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    bankDetails: {
      accountNumber: { type: String, select: false },
      ifscCode: { type: String, select: false },
      accountHolderName: String,
      bankName: String,
    },
    earnings: {
      total: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      withdrawn: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    achievements: [
      {
        title: String,
        description: String,
        date: Date,
      },
    ],
    certifications: [
      {
        name: String,
        issuer: String,
        issueDate: Date,
        expiryDate: Date,
        credentialId: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
interviewerSchema.index({ user: 1 });
interviewerSchema.index({ expertise: 1 });
interviewerSchema.index({ 'rating.average': -1 });
interviewerSchema.index({ hourlyRate: 1 });
interviewerSchema.index({ isApproved: 1, status: 1 });

// Virtual for completion rate
interviewerSchema.virtual('completionRate').get(function () {
  if (this.totalInterviews === 0) return 0;
  return ((this.completedInterviews / this.totalInterviews) * 100).toFixed(2);
});

// Update rating
interviewerSchema.methods.updateRating = function (newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

// Update earnings
interviewerSchema.methods.addEarnings = function (amount) {
  this.earnings.total += amount;
  this.earnings.pending += amount;
  return this.save();
};

// Process withdrawal
interviewerSchema.methods.processWithdrawal = function (amount) {
  if (this.earnings.pending < amount) {
    throw new Error('Insufficient pending earnings');
  }
  this.earnings.pending -= amount;
  this.earnings.withdrawn += amount;
  return this.save();
};

// Increment interview count
interviewerSchema.methods.incrementInterviewCount = function (completed = false) {
  this.totalInterviews += 1;
  if (completed) {
    this.completedInterviews += 1;
  }
  return this.save();
};

// Check availability for a specific time slot
interviewerSchema.methods.isAvailableAt = function (day, startTime, endTime) {
  const dayAvailability = this.availability.find((a) => a.day === day);
  if (!dayAvailability) return false;

  return dayAvailability.slots.some((slot) => {
    return (
      slot.isAvailable &&
      slot.startTime <= startTime &&
      slot.endTime >= endTime
    );
  });
};

// Transform output
interviewerSchema.methods.toJSON = function () {
  const interviewer = this.toObject();
  delete interviewer.bankDetails;
  delete interviewer.__v;
  return interviewer;
};

const Interviewer = mongoose.model('Interviewer', interviewerSchema);

module.exports = Interviewer;

// Made with Bob
