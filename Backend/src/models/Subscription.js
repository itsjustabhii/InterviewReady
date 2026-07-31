const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    plan: {
      type: String,
      enum: ['basic', 'pro', 'premium'],
      required: [true, 'Plan is required'],
    },
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    duration: {
      type: Number,
      required: true,
      default: 30, // days
      min: [1, 'Duration must be at least 1 day'],
    },
    features: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended', 'pending'],
      default: 'pending',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    // Renewal history for audit trail
    renewalHistory: [
      {
        renewedAt: { type: Date, default: Date.now },
        payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
        previousEndDate: Date,
        _id: false,
      },
    ],
    usage: {
      interviewsUsed: { type: Number, default: 0, min: 0 },
      interviewsLimit: { type: Number, required: true, min: 0 },
    },
    cancellationReason: { type: String, trim: true },
    cancelledAt: Date,
    renewedAt: Date,
    lastReminderSent: Date,
    // Track which admin action triggered status changes
    statusHistory: [
      {
        from: String,
        to: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
subscriptionSchema.index({ user: 1, status: 1 });                    // user's active subscription
subscriptionSchema.index({ user: 1, createdAt: -1 });                // subscription history
subscriptionSchema.index({ endDate: 1 });                            // expiry cron jobs
subscriptionSchema.index({ status: 1, endDate: 1 });                 // renewal reminders
subscriptionSchema.index({ plan: 1, status: 1 });                    // analytics per plan
subscriptionSchema.index({ autoRenew: 1, status: 1, endDate: 1 });  // auto-renewal job
// At most one active subscription per user (partial unique)
subscriptionSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'unique_active_subscription_per_user',
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && new Date() < this.endDate;
});

subscriptionSchema.virtual('isExpired').get(function () {
  return new Date() >= this.endDate;
});

subscriptionSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  if (now >= this.endDate) return 0;
  return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

subscriptionSchema.virtual('usagePercentage').get(function () {
  if (this.usage.interviewsLimit === 0) return 100;
  return +((this.usage.interviewsUsed / this.usage.interviewsLimit) * 100).toFixed(2);
});

subscriptionSchema.virtual('remainingInterviews').get(function () {
  return Math.max(0, this.usage.interviewsLimit - this.usage.interviewsUsed);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
subscriptionSchema.methods.checkExpiry = function () {
  if (this.isExpired && this.status === 'active') {
    this.statusHistory.push({ from: 'active', to: 'expired' });
    this.status = 'expired';
    return this.save();
  }
  return Promise.resolve(this);
};

subscriptionSchema.methods.useInterview = function () {
  if (this.usage.interviewsUsed >= this.usage.interviewsLimit) {
    throw new Error('Interview limit reached for this subscription');
  }
  if (!this.isActive) throw new Error('Subscription is not active');
  this.usage.interviewsUsed += 1;
  return this.save();
};

subscriptionSchema.methods.cancel = function (reason, changedBy = null) {
  this.statusHistory.push({ from: this.status, to: 'cancelled', changedBy, reason });
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.autoRenew = false;
  return this.save();
};

subscriptionSchema.methods.renew = function (payment) {
  const previousEndDate = this.endDate;
  this.renewalHistory.push({ payment: payment._id || payment, previousEndDate });
  this.startDate = new Date();
  this.endDate = new Date(Date.now() + this.duration * 24 * 60 * 60 * 1000);
  this.statusHistory.push({ from: this.status, to: 'active' });
  this.status = 'active';
  this.payment = payment._id || payment;
  this.renewedAt = new Date();
  this.usage.interviewsUsed = 0;
  return this.save();
};

subscriptionSchema.methods.suspend = function (reason = null, changedBy = null) {
  this.statusHistory.push({ from: this.status, to: 'suspended', changedBy, reason });
  this.status = 'suspended';
  return this.save();
};

subscriptionSchema.methods.reactivate = function (changedBy = null) {
  if (this.isExpired) throw new Error('Cannot reactivate expired subscription');
  this.statusHistory.push({ from: this.status, to: 'active', changedBy });
  this.status = 'active';
  return this.save();
};

subscriptionSchema.methods.markReminderSent = function () {
  this.lastReminderSent = new Date();
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;

// Made with Bob
