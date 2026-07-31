const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_cancelled',
        'booking_reminder',
        'booking_completed',
        'booking_rescheduled',
        'payment_success',
        'payment_failed',
        'payment_refunded',
        'subscription_expiring',
        'subscription_expired',
        'subscription_renewed',
        'review_received',
        'review_responded',
        'interviewer_approved',
        'interviewer_rejected',
        'withdrawal_processed',
        'system_announcement',
        'general',
      ],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    // Arbitrary payload attached to the notification (e.g. bookingId, paymentId)
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    // Deep-link for the front-end
    actionUrl: { type: String, trim: true },
    actionText: { type: String, trim: true, maxlength: 60 },
    // Delivery channel tracking
    channels: {
      inApp: {
        sent: { type: Boolean, default: true },
        sentAt: { type: Date, default: Date.now },
      },
      email: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        messageId: { type: String, select: false }, // SMTP message ID
      },
      push: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
      sms: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
      },
    },
    // TTL: notifications expire automatically (MongoDB TTL index on this field)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days default
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
notificationSchema.index({ user: 1, createdAt: -1 });            // notification feed
notificationSchema.index({ user: 1, isRead: 1 });                // unread count badge
notificationSchema.index({ user: 1, type: 1, isRead: 1 });       // filter by type
notificationSchema.index({ user: 1, priority: 1, isRead: 1 });   // priority inbox
notificationSchema.index({ type: 1 });                           // admin broadcasts
// TTL index: MongoDB automatically deletes expired documents
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'notification_ttl' });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
notificationSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
notificationSchema.methods.markAsRead = function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

notificationSchema.methods.markAsUnread = function () {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────
notificationSchema.statics.createNotification = async function (data) {
  return this.create(data);
};

notificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Manual cleanup (TTL index handles most cases automatically)
notificationSchema.statics.deleteOldNotifications = async function (days = 90) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.deleteMany({ createdAt: { $lt: cutoffDate }, isRead: true });
};

// ─── Output Sanitisation ──────────────────────────────────────────────────────
notificationSchema.methods.toJSON = function () {
  const notification = this.toObject();
  delete notification.__v;
  return notification;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

// Made with Bob
