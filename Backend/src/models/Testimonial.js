const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Admin can create manually with no linked user
    displayName: { type: String, required: true, trim: true },
    displayTitle: { type: String, trim: true }, // e.g. "SWE @ Google"
    avatarUrl: { type: String, trim: true },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: [20, 'Testimonial must be at least 20 characters'],
      maxlength: [600, 'Testimonial cannot exceed 600 characters'],
    },
    rating: {
      type: Number,
      default: 5,
      min: 1,
      max: 5,
    },
    outcome: {
      type: String,
      trim: true,
      maxlength: 150, // e.g. "Got offer at Meta"
    },
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    source: {
      type: String,
      enum: ['organic', 'imported', 'admin_created'],
      default: 'organic',
    },
    // Linked review (optional)
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
    publishedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who created/imported
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

testimonialSchema.index({ isPublished: 1, isFeatured: 1, displayOrder: 1 }); // homepage query
testimonialSchema.index({ user: 1 }, { sparse: true });
testimonialSchema.index({ source: 1, isPublished: 1 });

const Testimonial = mongoose.model('Testimonial', testimonialSchema);
module.exports = Testimonial;

// Made with Bob
