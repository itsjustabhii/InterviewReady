const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
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
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'card', 'upi', 'netbanking', 'wallet'],
      required: true,
    },
    razorpayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentGatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    refund: {
      amount: Number,
      reason: String,
      refundId: String,
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
      },
      processedAt: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
    },
    paidAt: Date,
    refundedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ booking: 1 });
paymentSchema.index({ subscription: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ transactionId: 1 });

// Virtual for is successful
paymentSchema.virtual('isSuccessful').get(function () {
  return this.status === 'completed';
});

// Virtual for is refundable
paymentSchema.virtual('isRefundable').get(function () {
  if (this.status !== 'completed') return false;
  if (this.refund && this.refund.status === 'completed') return false;
  
  // Can refund within 7 days
  const daysSincePaid = (Date.now() - this.paidAt) / (1000 * 60 * 60 * 24);
  return daysSincePaid <= 7;
});

// Mark as completed
paymentSchema.methods.markCompleted = function (paymentId, signature) {
  this.status = 'completed';
  this.razorpayPaymentId = paymentId;
  this.razorpaySignature = signature;
  this.paidAt = new Date();
  return this.save();
};

// Mark as failed
paymentSchema.methods.markFailed = function (reason) {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

// Process refund
paymentSchema.methods.processRefund = function (amount, reason) {
  if (!this.isRefundable) {
    throw new Error('Payment is not refundable');
  }

  this.refund = {
    amount: amount || this.amount,
    reason,
    status: 'pending',
  };
  this.status = 'refunded';
  return this.save();
};

// Update refund status
paymentSchema.methods.updateRefundStatus = function (refundId, status) {
  if (!this.refund) {
    throw new Error('No refund initiated for this payment');
  }

  this.refund.refundId = refundId;
  this.refund.status = status;
  
  if (status === 'completed') {
    this.refund.processedAt = new Date();
    this.refundedAt = new Date();
  }

  return this.save();
};

// Transform output
paymentSchema.methods.toJSON = function () {
  const payment = this.toObject();
  delete payment.razorpaySignature;
  delete payment.paymentGatewayResponse;
  delete payment.__v;
  return payment;
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

// Made with Bob
