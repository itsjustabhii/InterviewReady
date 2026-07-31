const mongoose = require('mongoose');

/**
 * AvailabilitySlot — a concrete, date-specific time slot offered by an interviewer.
 *
 * Relationship to Interviewer.availability:
 *   - Interviewer.availability stores a *recurring weekly template* (which days + time windows).
 *   - AvailabilitySlot stores *individual, bookable instances* materialised from that template
 *     (e.g. "Monday 9:00–10:00" → a slot on 2024-06-10 09:00 UTC).
 *   - A booking service job generates slots from the template N days in advance.
 *   - When a Booking is created it references the chosen AvailabilitySlot and marks it booked.
 */
const availabilitySlotSchema = new mongoose.Schema(
  {
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interviewer',
      required: [true, 'Interviewer reference is required'],
    },
    // Denormalise the user ID for auth-layer queries without extra join
    interviewerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Interviewer user reference is required'],
    },
    // Absolute UTC start & end datetimes for the slot
    startDateTime: {
      type: Date,
      required: [true, 'Start date-time is required'],
    },
    endDateTime: {
      type: Date,
      required: [true, 'End date-time is required'],
    },
    // Duration in minutes — redundant but avoids re-calculation on every query
    duration: {
      type: Number,
      required: true,
      default: 60,
      min: [15, 'Minimum slot duration is 15 minutes'],
      max: [240, 'Maximum slot duration is 240 minutes'],
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'blocked', 'expired'],
      default: 'available',
    },
    // Set when a booking claims this slot (1-to-1 relationship)
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    // Interview types the interviewer is willing to do in this slot
    interviewTypes: {
      type: [String],
      enum: ['technical', 'behavioral', 'system-design', 'coding', 'mock-interview', 'resume-review'],
      default: ['technical'],
    },
    // Pricing may differ per slot (e.g. off-hours premium)
    priceOverride: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    // Timezone in which the slot was created (for display purposes)
    timezone: {
      type: String,
      default: 'UTC',
    },
    // Reason when the interviewer manually blocks a slot
    blockReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Whether this slot was auto-generated from the weekly template or manually created
    isRecurring: {
      type: Boolean,
      default: true,
    },
    // Source template reference (Interviewer.availability day + startTime)
    sourceTemplate: {
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
      startTime: { type: String }, // HH:MM
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Validation ───────────────────────────────────────────────────────────────
availabilitySlotSchema.pre('validate', function (next) {
  if (this.endDateTime <= this.startDateTime) {
    next(new Error('endDateTime must be after startDateTime'));
  } else {
    next();
  }
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Primary query: find available slots for an interviewer in a date range
availabilitySlotSchema.index({ interviewer: 1, startDateTime: 1, status: 1 });
// Browse all available slots in a date range (used for search / discovery)
availabilitySlotSchema.index({ status: 1, startDateTime: 1 });
// User looking at their booked slot
availabilitySlotSchema.index({ booking: 1 }, { sparse: true });
// Cron job to expire past available slots
availabilitySlotSchema.index({ status: 1, endDateTime: 1 });
// Lookup by interviewerUser for auth checks
availabilitySlotSchema.index({ interviewerUser: 1, startDateTime: 1 });
// TTL: automatically expire slots (MongoDB marks status in-app; this is a safety net)
availabilitySlotSchema.index({ endDateTime: 1 }, { name: 'slot_expiry_ttl' });
// Prevent duplicate slots for the same interviewer at the same start time
availabilitySlotSchema.index(
  { interviewer: 1, startDateTime: 1 },
  {
    unique: true,
    name: 'unique_interviewer_slot_start',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
availabilitySlotSchema.virtual('isPast').get(function () {
  return new Date() > this.endDateTime;
});

availabilitySlotSchema.virtual('isAvailable').get(function () {
  return this.status === 'available' && !this.isPast;
});

availabilitySlotSchema.virtual('effectivePrice').get(function () {
  return this.priceOverride != null ? this.priceOverride : undefined; // caller falls back to Interviewer.hourlyRate
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
availabilitySlotSchema.methods.book = function (bookingId) {
  if (this.status !== 'available') {
    throw new Error(`Slot is not available (current status: ${this.status})`);
  }
  this.status = 'booked';
  this.booking = bookingId;
  return this.save();
};

availabilitySlotSchema.methods.release = function () {
  if (this.status !== 'booked') {
    throw new Error('Only booked slots can be released');
  }
  this.status = 'available';
  this.booking = null;
  return this.save();
};

availabilitySlotSchema.methods.block = function (reason = '') {
  this.status = 'blocked';
  this.blockReason = reason;
  return this.save();
};

availabilitySlotSchema.methods.expire = function () {
  this.status = 'expired';
  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────
/**
 * Find all available slots for an interviewer between two dates.
 */
availabilitySlotSchema.statics.findAvailable = function (interviewerId, from, to) {
  return this.find({
    interviewer: interviewerId,
    status: 'available',
    startDateTime: { $gte: from, $lt: to },
  }).sort({ startDateTime: 1 });
};

/**
 * Expire all slots whose endDateTime is in the past and are still 'available'.
 */
availabilitySlotSchema.statics.expirePastSlots = function () {
  return this.updateMany(
    { status: 'available', endDateTime: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
availabilitySlotSchema.methods.toJSON = function () {
  const slot = this.toObject();
  delete slot.__v;
  return slot;
};

const AvailabilitySlot = mongoose.model('AvailabilitySlot', availabilitySlotSchema);

module.exports = AvailabilitySlot;

// Made with Bob
