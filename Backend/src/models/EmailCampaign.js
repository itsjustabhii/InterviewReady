const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: 150,
    },
    subject: {
      type: String,
      required: [true, 'Email subject is required'],
      trim: true,
      maxlength: 200,
    },
    previewText: { type: String, trim: true, maxlength: 200 },
    htmlBody: {
      type: String,
      required: [true, 'Email body is required'],
    },
    plainTextBody: { type: String },
    // Targeting
    targetAudience: {
      type: String,
      enum: ['all', 'users', 'interviewers', 'pro_subscribers', 'inactive_users', 'custom'],
      default: 'all',
    },
    // For 'custom' — explicit user IDs or filter query
    customFilter: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
      default: 'draft',
    },
    scheduledAt: Date,
    sentAt: Date,
    // Metrics
    stats: {
      recipientCount: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      deliveredCount: { type: Number, default: 0 },
      openCount: { type: Number, default: 0 },
      clickCount: { type: Number, default: 0 },
      bounceCount: { type: Number, default: 0 },
      unsubscribeCount: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

emailCampaignSchema.index({ status: 1, scheduledAt: 1 });
emailCampaignSchema.index({ createdBy: 1, createdAt: -1 });
emailCampaignSchema.index({ targetAudience: 1, status: 1 });

emailCampaignSchema.virtual('openRate').get(function () {
  if (!this.stats.deliveredCount) return 0;
  return +((this.stats.openCount / this.stats.deliveredCount) * 100).toFixed(1);
});

emailCampaignSchema.virtual('clickRate').get(function () {
  if (!this.stats.openCount) return 0;
  return +((this.stats.clickCount / this.stats.openCount) * 100).toFixed(1);
});

const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
module.exports = EmailCampaign;

// Made with Bob
