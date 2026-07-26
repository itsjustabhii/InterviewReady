const Razorpay = require('razorpay');
const crypto = require('crypto');
const config = require('../config');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Subscription = require('../models/Subscription');
const { PaymentError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }

  /**
   * Create Razorpay order for booking
   */
  async createBookingOrder(userId, bookingId, amount, currency = 'INR') {
    try {
      // Verify booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      // Create Razorpay order
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: `booking_${bookingId}`,
        notes: {
          bookingId: bookingId.toString(),
          userId: userId.toString(),
        },
      });

      // Create payment record
      const payment = await Payment.create({
        user: userId,
        booking: bookingId,
        amount,
        currency,
        paymentMethod: 'razorpay',
        razorpayOrderId: order.id,
        status: 'pending',
      });

      logger.logPayment('order_created', {
        orderId: order.id,
        bookingId,
        amount,
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
      };
    } catch (error) {
      logger.error('Error creating booking order:', error);
      throw new PaymentError('Failed to create payment order');
    }
  }

  /**
   * Create Razorpay order for subscription
   */
  async createSubscriptionOrder(userId, plan, amount, currency = 'INR') {
    try {
      // Create Razorpay order
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt: `subscription_${plan}_${Date.now()}`,
        notes: {
          plan,
          userId: userId.toString(),
        },
      });

      // Create payment record
      const payment = await Payment.create({
        user: userId,
        amount,
        currency,
        paymentMethod: 'razorpay',
        razorpayOrderId: order.id,
        status: 'pending',
        metadata: { plan },
      });

      logger.logPayment('subscription_order_created', {
        orderId: order.id,
        plan,
        amount,
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment._id,
      };
    } catch (error) {
      logger.error('Error creating subscription order:', error);
      throw new PaymentError('Failed to create subscription order');
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(text)
      .digest('hex');

    return generated_signature === signature;
  }

  /**
   * Verify and complete payment
   */
  async verifyAndCompletePayment(paymentId, razorpayPaymentId, razorpaySignature) {
    try {
      // Find payment
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      // Verify signature
      const isValid = this.verifyPaymentSignature(
        payment.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        payment.status = 'failed';
        payment.failureReason = 'Invalid payment signature';
        await payment.save();
        throw new PaymentError('Payment verification failed');
      }

      // Fetch payment details from Razorpay
      const razorpayPayment = await this.razorpay.payments.fetch(razorpayPaymentId);

      // Update payment
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'completed';
      payment.paidAt = new Date();
      payment.paymentGatewayResponse = razorpayPayment;
      payment.transactionId = razorpayPayment.id;
      await payment.save();

      // Update booking if exists
      if (payment.booking) {
        const booking = await Booking.findById(payment.booking);
        if (booking) {
          booking.status = 'confirmed';
          booking.payment = payment._id;
          await booking.save();
        }
      }

      logger.logPayment('payment_completed', {
        paymentId: payment._id,
        razorpayPaymentId,
        amount: payment.amount,
      });

      return payment;
    } catch (error) {
      logger.error('Error verifying payment:', error);
      throw error;
    }
  }

  /**
   * Process refund
   */
  async processRefund(paymentId, amount, reason) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (!payment.isRefundable) {
        throw new PaymentError('Payment is not refundable');
      }

      // Create refund in Razorpay
      const refund = await this.razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round((amount || payment.amount) * 100),
        notes: {
          reason,
        },
      });

      // Update payment
      payment.processRefund(amount || payment.amount, reason);
      payment.updateRefundStatus(refund.id, 'processing');
      await payment.save();

      logger.logPayment('refund_initiated', {
        paymentId: payment._id,
        refundId: refund.id,
        amount: amount || payment.amount,
      });

      return payment;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw new PaymentError('Failed to process refund');
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate('user', 'firstName lastName email')
        .populate('booking')
        .populate('subscription');

      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      return payment;
    } catch (error) {
      logger.error('Error fetching payment details:', error);
      throw error;
    }
  }

  /**
   * Get user payment history
   */
  async getUserPayments(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const payments = await Payment.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('booking')
        .populate('subscription');

      const total = await Payment.countDocuments({ user: userId });

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
        },
      };
    } catch (error) {
      logger.error('Error fetching user payments:', error);
      throw error;
    }
  }

  /**
   * Handle webhook
   */
  async handleWebhook(signature, payload) {
    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new PaymentError('Invalid webhook signature');
      }

      const event = payload.event;
      const paymentEntity = payload.payload.payment.entity;

      logger.info('Webhook received:', { event, paymentId: paymentEntity.id });

      // Handle different events
      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(paymentEntity);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(paymentEntity);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(payload.payload.refund.entity);
          break;
        default:
          logger.info('Unhandled webhook event:', event);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle payment captured event
   */
  async handlePaymentCaptured(paymentEntity) {
    const payment = await Payment.findOne({
      razorpayOrderId: paymentEntity.order_id,
    });

    if (payment && payment.status === 'pending') {
      payment.status = 'completed';
      payment.razorpayPaymentId = paymentEntity.id;
      payment.paidAt = new Date(paymentEntity.created_at * 1000);
      await payment.save();

      logger.logPayment('payment_captured', {
        paymentId: payment._id,
        razorpayPaymentId: paymentEntity.id,
      });
    }
  }

  /**
   * Handle payment failed event
   */
  async handlePaymentFailed(paymentEntity) {
    const payment = await Payment.findOne({
      razorpayOrderId: paymentEntity.order_id,
    });

    if (payment) {
      payment.status = 'failed';
      payment.failureReason = paymentEntity.error_description;
      await payment.save();

      logger.logPayment('payment_failed', {
        paymentId: payment._id,
        reason: paymentEntity.error_description,
      });
    }
  }

  /**
   * Handle refund processed event
   */
  async handleRefundProcessed(refundEntity) {
    const payment = await Payment.findOne({
      razorpayPaymentId: refundEntity.payment_id,
    });

    if (payment && payment.refund) {
      payment.updateRefundStatus(refundEntity.id, 'completed');
      await payment.save();

      logger.logPayment('refund_processed', {
        paymentId: payment._id,
        refundId: refundEntity.id,
      });
    }
  }
}

module.exports = new PaymentService();

// Made with Bob
