const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['basic', 'pro', 'premium'],
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    duration: {
      type: Number,
      required: true,
      default: 30, // days
    },
    features: [String],
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'suspended'],
      default: 'active',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    usage: {
      interviewsUsed: {
        type: Number,
        default: 0,
      },
      interviewsLimit: {
        type: Number,
        required: true,
      },
    },
    cancellationReason: {
      type: String,
    },
    cancelledAt: Date,
    renewedAt: Date,
    lastReminderSent: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Virtual for is active
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && new Date() < this.endDate;
});

// Virtual for is expired
subscriptionSchema.virtual('isExpired').get(function () {
  return new Date() >= this.endDate;
});

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  if (now >= this.endDate) return 0;
  const diff = this.endDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for usage percentage
subscriptionSchema.virtual('usagePercentage').get(function () {
  if (this.usage.interviewsLimit === 0) return 0;
  return ((this.usage.interviewsUsed / this.usage.interviewsLimit) * 100).toFixed(2);
});

// Virtual for remaining interviews
subscriptionSchema.virtual('remainingInterviews').get(function () {
  return Math.max(0, this.usage.interviewsLimit - this.usage.interviewsUsed);
});

// Check if subscription has expired
subscriptionSchema.methods.checkExpiry = function () {
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
    return this.save();
  }
  return Promise.resolve(this);
};

// Use an interview slot
subscriptionSchema.methods.useInterview = function () {
  if (this.usage.interviewsUsed >= this.usage.interviewsLimit) {
    throw new Error('Interview limit reached for this subscription');
  }
  if (!this.isActive) {
    throw new Error('Subscription is not active');
  }
  this.usage.interviewsUsed += 1;
  return this.save();
};

// Cancel subscription
subscriptionSchema.methods.cancel = function (reason) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.autoRenew = false;
  return this.save();
};

// Renew subscription
subscriptionSchema.methods.renew = function (payment) {
  this.startDate = new Date();
  this.endDate = new Date(Date.now() + this.duration * 24 * 60 * 60 * 1000);
  this.status = 'active';
  this.payment = payment;
  this.renewedAt = new Date();
  this.usage.interviewsUsed = 0;
  return this.save();
};

// Suspend subscription
subscriptionSchema.methods.suspend = function () {
  this.status = 'suspended';
  return this.save();
};

// Reactivate subscription
subscriptionSchema.methods.reactivate = function () {
  if (this.isExpired) {
    throw new Error('Cannot reactivate expired subscription');
  }
  this.status = 'active';
  return this.save();
};

// Send reminder
subscriptionSchema.methods.markReminderSent = function () {
  this.lastReminderSent = new Date();
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;

// Made with Bob
