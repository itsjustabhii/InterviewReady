/**
 * Booking & Availability Routes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Booking lifecycle:
 *   POST   /api/v1/bookings/hold                   → holdSlot
 *   POST   /api/v1/bookings/confirm                → confirmBooking
 *   DELETE /api/v1/bookings/hold/:slotId           → releaseHold
 *   POST   /api/v1/bookings/:bookingId/cancel      → cancelBooking
 *   POST   /api/v1/bookings/:bookingId/reschedule  → rescheduleBooking
 *   GET    /api/v1/bookings/:bookingId             → getBooking
 *   GET    /api/v1/bookings                        → getUserBookings
 *   GET    /api/v1/bookings/schedule/:interviewerId → getInterviewerSchedule
 *
 * Availability:
 *   GET    /api/v1/availability/:interviewerId     → getAvailability
 *   POST   /api/v1/availability/:interviewerId/generate → generateSlots (admin)
 *
 * Payment webhook (internal):
 *   POST   /api/v1/bookings/webhook/payment-failed → handlePaymentFailedWebhook
 */

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, authorize, requireInterviewer } = require('../middleware/auth');
const {
  validateGetAvailability,
  validateHoldSlot,
  validateConfirmBooking,
  validateReleaseHold,
  validateCancelBooking,
  validateRescheduleBooking,
  validateGetUserBookings,
  validateGetSchedule,
  validateGenerateSlots,
} = require('../utils/bookingValidation');

// ─── Availability (public) ────────────────────────────────────────────────────
const availabilityRouter = express.Router();

availabilityRouter.get(
  '/:interviewerId',
  validateGetAvailability,
  bookingController.getAvailability
);

availabilityRouter.post(
  '/:interviewerId/generate',
  authenticate,
  authorize('admin'),
  validateGenerateSlots,
  bookingController.generateSlots
);

// ─── Bookings (all authenticated) ────────────────────────────────────────────

// Payment webhook — no auth (signature verified inside handler)
// NOTE: must be registered before /:bookingId to avoid route collision
router.post(
  '/webhook/payment-failed',
  bookingController.handlePaymentFailedWebhook
);

// Hold a slot & create payment order
router.post(
  '/hold',
  authenticate,
  validateHoldSlot,
  bookingController.holdSlot
);

// Confirm booking after payment
router.post(
  '/confirm',
  authenticate,
  validateConfirmBooking,
  bookingController.confirmBooking
);

// Release a hold (user abandons payment)
router.delete(
  '/hold/:slotId',
  authenticate,
  validateReleaseHold,
  bookingController.releaseHold
);

// User booking history
router.get(
  '/',
  authenticate,
  validateGetUserBookings,
  bookingController.getUserBookings
);

// Interviewer / admin schedule view
router.get(
  '/schedule/:interviewerId',
  authenticate,
  requireInterviewer,
  validateGetSchedule,
  bookingController.getInterviewerSchedule
);

// Single booking detail
router.get(
  '/:bookingId',
  authenticate,
  bookingController.getBooking
);

// Cancel
router.post(
  '/:bookingId/cancel',
  authenticate,
  validateCancelBooking,
  bookingController.cancelBooking
);

// Reschedule
router.post(
  '/:bookingId/reschedule',
  authenticate,
  validateRescheduleBooking,
  bookingController.rescheduleBooking
);

module.exports = { bookingRouter: router, availabilityRouter };

// Made with Bob
