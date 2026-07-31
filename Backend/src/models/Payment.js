const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    // Exactly one of booking or subscription must be set (validated in service layer)
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
    // Amount in the smallest currency unit (paise / cents) stored for gateway compatibility
    amountInSmallestUnit: {
      type: Number,
      required: [true, 'Amount in smallest unit is required'],
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
      required: [true, 'Payment method is required'],
    },
    // Razorpay-specific IDs
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
      select: false,
    },
    // Internal transaction ID (for non-Razorpay flows or internal tracking)
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Raw gateway response — never expose to client
    paymentGatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
    },
    refund: {
      amount: { type: Number, min: 0 },
      reason: { type: String, trim: true, maxlength: 500 },
      refundId: String,
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
      },
      initiatedAt: Date,
      processedAt: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    paidAt: Date,
    refundedAt: Date,
    // Gateway-specific fields for reconciliation
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Note: razorpayOrderId, razorpayPaymentId, transactionId, invoiceNumber already
//       get unique sparse indexes from their field definitions above.
paymentSchema.index({ user: 1, createdAt: -1 });            // user payment history
paymentSchema.index({ user: 1, status: 1 });                // filter by status
paymentSchema.index({ booking: 1 }, { sparse: true });       // booking payment lookup
paymentSchema.index({ subscription: 1 }, { sparse: true });  // subscription payment lookup
paymentSchema.index({ status: 1, createdAt: -1 });           // admin financial reports
paymentSchema.index({ paidAt: 1 }, { sparse: true });        // revenue reports by date
// Compound for financial reporting
paymentSchema.index({ currency: 1, status: 1, paidAt: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
paymentSchema.virtual('isSuccessful').get(function () {
  return this.status === 'completed';
});

paymentSchema.virtual('isRefundable').get(function () {
  if (this.status !== 'completed') return false;
  if (this.refund && this.refund.status === 'completed') return false;
  const daysSincePaid = (Date.now() - this.paidAt) / (1000 * 60 * 60 * 24);
  return daysSincePaid <= 7; // 7-day refund window
});

paymentSchema.virtual('netAmount').get(function () {
  return +(this.amount - (this.refund?.amount || 0)).toFixed(2);
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
paymentSchema.methods.markCompleted = function (paymentId, signature) {
  this.status = 'completed';
  this.razorpayPaymentId = paymentId;
  this.razorpaySignature = signature;
  this.paidAt = new Date();
  return this.save();
};

paymentSchema.methods.markFailed = function (reason) {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

paymentSchema.methods.processRefund = function (amount, reason) {
  if (!this.isRefundable) throw new Error('Payment is not refundable');
  this.refund = {
    amount: amount || this.amount,
    reason,
    status: 'pending',
    initiatedAt: new Date(),
  };
  this.status = 'refunded';
  return this.save();
};

paymentSchema.methods.updateRefundStatus = function (refundId, status) {
  if (!this.refund) throw new Error('No refund initiated for this payment');
  this.refund.refundId = refundId;
  this.refund.status = status;
  if (status === 'completed') {
    this.refund.processedAt = new Date();
    this.refundedAt = new Date();
  }
  return this.save();
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
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
