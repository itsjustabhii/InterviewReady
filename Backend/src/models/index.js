/**
 * Central model exports — import from here to avoid circular-dependency risks
 * and to ensure all schemas are registered before Mongoose resolves references.
 *
 * Usage:
 *   const { User, Booking, InterviewSession } = require('./models');
 */
const User             = require('./User');
const Interviewer      = require('./Interviewer');
const Booking          = require('./Booking');
const Review           = require('./Review');
const Payment          = require('./Payment');
const Subscription     = require('./Subscription');
const Notification     = require('./Notification');
const AvailabilitySlot = require('./AvailabilitySlot');
const InterviewSession = require('./InterviewSession');

module.exports = {
  User,
  Interviewer,
  Booking,
  Review,
  Payment,
  Subscription,
  Notification,
  AvailabilitySlot,
  InterviewSession,
};

// Made with Bob
