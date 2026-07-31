const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be in HH:MM format'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be in HH:MM format'],
    },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    issuer: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: Date,
    credentialId: { type: String, trim: true },
    url: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'URL must start with http:// or https://'],
    },
  },
  { _id: true }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const interviewerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    expertise: {
      type: [String],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one expertise area is required',
      },
    },
    experience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Experience cannot be negative'],
      max: [50, 'Experience value seems unrealistic'],
    },
    company: {
      type: String,
      required: [true, 'Current company is required'],
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    position: {
      type: String,
      required: [true, 'Current position is required'],
      trim: true,
      maxlength: [100, 'Position cannot exceed 100 characters'],
    },
    linkedIn: {
      type: String,
      trim: true,
      match: [/^https?:\/\/(www\.)?linkedin\.com\/.+/, 'Please provide a valid LinkedIn URL'],
    },
    github: {
      type: String,
      trim: true,
      match: [/^https?:\/\/(www\.)?github\.com\/.+/, 'Please provide a valid GitHub URL'],
    },
    portfolio: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Portfolio URL must start with http:// or https://'],
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative'],
      max: [100000, 'Hourly rate seems unrealistic'],
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    // Weekly recurring availability template
    availability: [
      {
        day: {
          type: String,
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          required: true,
        },
        slots: [timeSlotSchema],
        _id: false,
      },
    ],
    languages: {
      type: [String],
      default: ['English'],
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be less than 0'],
        max: [5, 'Rating cannot exceed 5'],
        set: (v) => Math.round(v * 100) / 100, // store to 2 decimal places
      },
      count: { type: Number, default: 0, min: 0 },
    },
    totalInterviews: { type: Number, default: 0, min: 0 },
    completedInterviews: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: ['id_proof', 'experience_letter', 'certificate'],
          required: true,
        },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        verifiedAt: Date,
      },
    ],
    bankDetails: {
      accountNumber: { type: String, select: false },
      ifscCode: { type: String, select: false },
      accountHolderName: { type: String, select: false },
      bankName: { type: String, select: false },
    },
    earnings: {
      total: { type: Number, default: 0, min: 0 },
      pending: { type: Number, default: 0, min: 0 },
      withdrawn: { type: Number, default: 0, min: 0 },
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive', 'suspended', 'rejected'],
      default: 'pending',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    },
    achievements: [
      {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        date: Date,
      },
    ],
    certifications: [certificationSchema],
    // Interviewer-set blackout dates (specific holidays etc.)
    blackoutDates: [{ type: Date }],
    interviewTypes: {
      type: [String],
      enum: ['technical', 'behavioral', 'system-design', 'coding', 'mock-interview', 'resume-review'],
      default: ['technical'],
    },
    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: user already gets a unique index from unique:true on the field definition
interviewerSchema.index({ expertise: 1 });                                    // search by skill
interviewerSchema.index({ 'rating.average': -1 });                            // sort by rating
interviewerSchema.index({ hourlyRate: 1 });                                   // price filter
interviewerSchema.index({ isApproved: 1, status: 1 });                        // active listings
interviewerSchema.index({ isApproved: 1, status: 1, 'rating.average': -1 }); // listing sort
interviewerSchema.index({ expertise: 1, 'rating.average': -1 });              // skill + rating
interviewerSchema.index({ experience: 1 });                                   // experience filter
interviewerSchema.index({ currency: 1, hourlyRate: 1 });                      // price range
// Full-text search
interviewerSchema.index(
  { bio: 'text', expertise: 'text', company: 'text', position: 'text' },
  { name: 'interviewer_text_search', weights: { expertise: 5, position: 3, company: 2, bio: 1 } }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
interviewerSchema.virtual('completionRate').get(function () {
  if (this.totalInterviews === 0) return 0;
  return +((this.completedInterviews / this.totalInterviews) * 100).toFixed(2);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
interviewerSchema.methods.updateRating = function (newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

interviewerSchema.methods.addEarnings = function (amount) {
  this.earnings.total += amount;
  this.earnings.pending += amount;
  return this.save();
};

interviewerSchema.methods.processWithdrawal = function (amount) {
  if (this.earnings.pending < amount) {
    throw new Error('Insufficient pending earnings');
  }
  this.earnings.pending -= amount;
  this.earnings.withdrawn += amount;
  return this.save();
};

interviewerSchema.methods.incrementInterviewCount = function (completed = false) {
  this.totalInterviews += 1;
  if (completed) this.completedInterviews += 1;
  return this.save();
};

interviewerSchema.methods.isAvailableAt = function (day, startTime, endTime) {
  const dayAvailability = this.availability.find((a) => a.day === day);
  if (!dayAvailability) return false;
  return dayAvailability.slots.some(
    (slot) => slot.isAvailable && slot.startTime <= startTime && slot.endTime >= endTime
  );
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
interviewerSchema.methods.toJSON = function () {
  const interviewer = this.toObject();
  delete interviewer.bankDetails;
  delete interviewer.__v;
  return interviewer;
};

const Interviewer = mongoose.model('Interviewer', interviewerSchema);

module.exports = Interviewer;

// Made with Bob
