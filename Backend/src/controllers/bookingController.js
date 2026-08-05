/**
 * bookingController
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP handlers for the booking lifecycle.  All business logic lives in
 * BookingService; this layer only handles request parsing, response shaping,
 * and delegating to the service.
 */

const { StatusCodes } = require('http-status-codes');
const bookingService = require('../services/bookingService');
const ApiResponse = require('../utils/response');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ─── Availability ──────────────────────────────────────────────────────────────

/**
 * GET /availability/:interviewerId
 * Query params: from (ISO date), to (ISO date)
 * Public endpoint (optionally authenticated).
 */
const getAvailability = asyncHandler(async (req, res) => {
  const { interviewerId } = req.params;
  const { from, to } = req.query;

  const fromDate = from ? new Date(from) : new Date();
  const toDate   = to   ? new Date(to)   : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const slots = await bookingService.getAvailability(interviewerId, fromDate, toDate);
  return ApiResponse.success(res, { slots, count: slots.length });
});

// ─── Hold (initiate booking + create payment order) ───────────────────────────

/**
 * POST /bookings/hold
 * Body: { slotId, interviewType, expertise, notes? }
 * Authenticated users only.
 *
 * Returns the pending booking and the Razorpay order so the client can open
 * the payment modal immediately.
 */
const holdSlot = asyncHandler(async (req, res) => {
  const { slotId, interviewType, expertise, notes } = req.body;
  const userId = req.user._id;

  const result = await bookingService.holdSlot(
    userId,
    slotId,
    interviewType,
    expertise,
    notes
  );

  logger.logBooking('hold_initiated', {
    userId,
    slotId,
    bookingId: result.booking._id,
  });

  return ApiResponse.created(res, result, 'Slot held. Complete payment within 10 minutes.');
});

// ─── Confirm (after successful payment) ───────────────────────────────────────

/**
 * POST /bookings/confirm
 * Body: { slotId, bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature }
 * Authenticated users only.
 */
const confirmBooking = asyncHandler(async (req, res) => {
  const { slotId, bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
  const userId = req.user._id;

  const booking = await bookingService.confirmBooking(
    userId,
    slotId,
    bookingId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature
  );

  logger.logBooking('booking_confirmed', { userId, bookingId, slotId });

  return ApiResponse.success(res, { booking }, 'Booking confirmed successfully.');
});

// ─── Release Hold ──────────────────────────────────────────────────────────────

/**
 * DELETE /bookings/hold/:slotId
 * Called when the user explicitly abandons the payment flow.
 */
const releaseHold = asyncHandler(async (req, res) => {
  const { slotId } = req.params;
  const userId = req.user._id;
  const { reason } = req.body;

  await bookingService.releaseHold(userId, slotId, reason || 'User cancelled payment');

  logger.logBooking('hold_released', { userId, slotId });

  return ApiResponse.success(res, null, 'Reservation released.');
});

// ─── Cancel Booking ────────────────────────────────────────────────────────────

/**
 * POST /bookings/:bookingId/cancel
 * Body: { reason? }
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  const { reason = 'Cancelled by user' } = req.body;

  const { booking, refundInitiated } = await bookingService.cancelBooking(
    userId,
    bookingId,
    reason,
    isAdmin
  );

  logger.logBooking('booking_cancelled', { userId, bookingId, refundInitiated });

  return ApiResponse.success(
    res,
    { booking, refundInitiated },
    refundInitiated
      ? 'Booking cancelled. Refund has been initiated.'
      : 'Booking cancelled successfully.'
  );
});

// ─── Reschedule ────────────────────────────────────────────────────────────────

/**
 * POST /bookings/:bookingId/reschedule
 * Body: { newSlotId, reason? }
 */
const rescheduleBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { newSlotId, reason = 'Rescheduled by user' } = req.body;
  const userId = req.user._id;

  const booking = await bookingService.rescheduleBooking(
    userId,
    bookingId,
    newSlotId,
    reason
  );

  logger.logBooking('booking_rescheduled', { userId, bookingId, newSlotId });

  return ApiResponse.success(res, { booking }, 'Booking rescheduled successfully.');
});

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * GET /bookings/:bookingId
 */
const getBooking = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const isAdmin = req.user.role === 'admin';
  const booking = await bookingService.getBookingById(bookingId, req.user._id, isAdmin);
  return ApiResponse.success(res, { booking });
});

/**
 * GET /bookings
 * Query: page, limit, status, from, to
 */
const getUserBookings = asyncHandler(async (req, res) => {
  const { page, limit, status, from, to } = req.query;
  const result = await bookingService.getUserBookings(req.user._id, {
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    status,
    from,
    to,
  });
  return ApiResponse.paginated(res, result.bookings, result.pagination);
});

/**
 * GET /bookings/schedule/:interviewerId
 * Interviewer or admin only.
 * Query: page, limit, from, to
 */
const getInterviewerSchedule = asyncHandler(async (req, res) => {
  const { interviewerId } = req.params;
  const { page, limit, from, to } = req.query;

  const result = await bookingService.getInterviewerSchedule(interviewerId, {
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    from,
    to,
  });

  return ApiResponse.paginated(res, result.bookings, result.pagination);
});

// ─── Admin: generate slots ─────────────────────────────────────────────────────

/**
 * POST /availability/:interviewerId/generate
 * Admin only.
 * Body: { daysAhead? }
 */
const generateSlots = asyncHandler(async (req, res) => {
  const { interviewerId } = req.params;
  const { daysAhead = 14 } = req.body;
  const result = await bookingService.generateSlotsFromTemplate(interviewerId, Number(daysAhead));
  return ApiResponse.success(res, result, `Generated ${result.created} slots.`);
});

// ─── Payment webhook relay ─────────────────────────────────────────────────────

/**
 * POST /bookings/webhook/payment-failed
 * Called internally by the payment webhook handler to release holds when
 * Razorpay reports a payment failure (server-to-server, not user-facing).
 *
 * Body: { slotId, userId, reason }
 * This endpoint is not exposed publicly — the payment webhook calls it
 * after verifying the Razorpay signature.
 */
const handlePaymentFailedWebhook = asyncHandler(async (req, res) => {
  const { slotId, userId, reason } = req.body;
  await bookingService.releaseHold(userId, slotId, reason || 'Payment failed');
  return ApiResponse.success(res, null, 'Hold released after payment failure.');
});

module.exports = {
  getAvailability,
  holdSlot,
  confirmBooking,
  releaseHold,
  cancelBooking,
  rescheduleBooking,
  getBooking,
  getUserBookings,
  getInterviewerSchedule,
  generateSlots,
  handlePaymentFailedWebhook,
};

// Made with Bob
