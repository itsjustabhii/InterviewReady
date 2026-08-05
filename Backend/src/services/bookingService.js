/**
 * BookingService
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the full booking lifecycle:
 *
 *   1. getAvailability     – read AvailabilitySlots from MongoDB (cached in Redis)
 *   2. holdSlot            – acquire Redis lock + create pending Booking + set hold record
 *   3. confirmBooking      – called after payment; confirm booking + mark slot booked
 *   4. releaseHold         – called on payment failure/timeout; undo the hold
 *   5. cancelBooking       – cancel an active booking; trigger refund if paid
 *   6. rescheduleBooking   – move to a new slot atomically
 *   7. getUserBookings     – paginated booking history
 *   8. getInterviewerSchedule – upcoming schedule for an interviewer
 *
 * Concurrency safety:
 *   • Redis distributed lock (RedisLockService) prevents two simultaneous
 *     requests from claiming the same slot.
 *   • MongoDB unique partial index on (interviewer, scheduledDate, startTime)
 *     with {status: {$in: ['pending','confirmed','in-progress']}} acts as a
 *     second safety net — the DB write will fail with E11000 even if the lock
 *     is somehow bypassed.
 *   • The hold TTL (default 10 minutes) ensures stale holds are automatically
 *     cleaned up if the user abandons payment.
 */

const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Booking = require('../models/Booking');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Interviewer = require('../models/Interviewer');
const Payment = require('../models/Payment');
const redisClient = require('../config/redis');
const lockService = require('./redisLockService');
const paymentService = require('./paymentService');
const logger = require('../utils/logger');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} = require('../utils/errors');

// ─── Cache helpers ────────────────────────────────────────────────────────────
const AVAILABILITY_CACHE_TTL = 60;  // 1 minute — short TTL so slots show up quickly
const BOOKING_CACHE_TTL      = 300; // 5 minutes for booking detail cache

const availabilityCacheKey = (interviewerId, from, to) =>
  `availability:${interviewerId}:${from}:${to}`;

const bookingCacheKey = (bookingId) => `booking:${bookingId}`;

// ─── Hold TTL ─────────────────────────────────────────────────────────────────
const HOLD_TTL_SECONDS = 600; // 10 minutes to complete payment

class BookingService {
  // ──────────────────────────────────────────────────────────────────────────
  // 1.  AVAILABILITY
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Return available slots for an interviewer within [from, to].
   * Results are cached in Redis for 60 s to reduce DB reads during browsing.
   *
   * @param {string} interviewerId
   * @param {Date}   from
   * @param {Date}   to
   * @returns {AvailabilitySlot[]}
   */
  async getAvailability(interviewerId, from, to) {
    const cacheKey = availabilityCacheKey(interviewerId, from.toISOString(), to.toISOString());

    // Try cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.debug(`[Booking] Cache hit for availability ${cacheKey}`);
      return cached;
    }

    const slots = await AvailabilitySlot.findAvailable(interviewerId, from, to)
      .populate('interviewer', 'user company position hourlyRate currency')
      .lean();

    // Enrich each slot with the live hold status from Redis (shows "held" to
    // other users browsing while someone is in the payment flow)
    const enriched = await Promise.all(
      slots.map(async (slot) => {
        const hold = await lockService.getHold(slot._id.toString());
        const holdTtl = hold ? await lockService.getHoldTtl(slot._id.toString()) : 0;
        return {
          ...slot,
          isHeld: !!hold,
          holdExpiresInSeconds: holdTtl,
        };
      })
    );

    await redisClient.set(cacheKey, enriched, AVAILABILITY_CACHE_TTL);
    return enriched;
  }

  /**
   * Invalidate availability cache for an interviewer (called after any slot mutation).
   * Uses wildcard delete via SCAN — safe on non-clustered Redis.
   */
  async invalidateAvailabilityCache(interviewerId) {
    // The keyPrefix from config is already prepended by ioredis, so we match
    // the raw key as stored (without the prefix in our scan pattern because
    // the client's keyPrefix is invisible to us in key names returned by SCAN).
    await redisClient.delPattern(`availability:${interviewerId}:*`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2.  HOLD SLOT  (start of booking flow)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Temporarily hold a slot for a user during the payment window.
   *
   * Steps:
   *   a. Verify slot exists and is available in MongoDB.
   *   b. Acquire Redis distributed lock on this slot.
   *   c. Re-check slot status inside the lock (double-check pattern).
   *   d. Create a Booking document in "pending" status.
   *   e. Write hold metadata to Redis with TTL.
   *   f. Create the Razorpay payment order so the client can proceed.
   *   g. Invalidate availability cache.
   *
   * @param {string} userId
   * @param {string} slotId
   * @param {string} interviewType
   * @param {string} expertise
   * @param {string} notes  (optional)
   * @returns {{ booking, paymentOrder }}
   */
  async holdSlot(userId, slotId, interviewType, expertise, notes = '') {
    // ── (a) Pre-lock check ─────────────────────────────────────────────────
    const slot = await AvailabilitySlot.findById(slotId).populate('interviewer');
    if (!slot) throw new NotFoundError('Availability slot not found');
    if (slot.status !== 'available') {
      throw new ConflictError('This slot is no longer available');
    }

    // Ensure the user isn't trying to book their own slot
    if (slot.interviewerUser.toString() === userId.toString()) {
      throw new ForbiddenError('Interviewers cannot book their own slots');
    }

    // Check if user already has a pending/confirmed booking at the same time
    const clash = await Booking.findOne({
      user: userId,
      scheduledDate: slot.startDateTime,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    });
    if (clash) {
      throw new ConflictError('You already have a booking at this time');
    }

    // ── (b) Acquire lock ───────────────────────────────────────────────────
    const lock = await lockService.acquireLock(slotId, userId.toString(), HOLD_TTL_SECONDS);
    if (!lock) {
      throw new ConflictError(
        'This slot is currently being reserved by another user. Please try again shortly.'
      );
    }

    try {
      // ── (c) Double-check inside lock ────────────────────────────────────
      const freshSlot = await AvailabilitySlot.findById(slotId);
      if (!freshSlot || freshSlot.status !== 'available') {
        throw new ConflictError('This slot was just taken. Please choose another time.');
      }

      // Verify no hold in Redis either (race between two servers)
      const existingHold = await lockService.getHold(slotId);
      if (existingHold) {
        throw new ConflictError('This slot is currently being held by another user.');
      }

      // ── (d) Create pending Booking ─────────────────────────────────────
      const interviewer = slot.interviewer;
      const amount = slot.priceOverride ?? interviewer.hourlyRate;
      const currency = slot.currency ?? interviewer.currency;

      const startHour = slot.startDateTime.toISOString().substr(11, 5); // HH:MM
      const endHour   = slot.endDateTime.toISOString().substr(11, 5);

      const booking = await Booking.create({
        user: userId,
        interviewer: interviewer._id,
        availabilitySlot: slotId,
        scheduledDate: slot.startDateTime,
        startTime: startHour,
        endTime: endHour,
        duration: slot.duration,
        interviewType,
        expertise,
        notes,
        status: 'pending',
        amount,
        currency,
      });

      // ── (e) Persist hold in Redis ──────────────────────────────────────
      await lockService.setHold(slotId, {
        userId: userId.toString(),
        bookingId: booking._id.toString(),
        amount,
        currency,
        lockToken: lock.token,
        heldAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + HOLD_TTL_SECONDS * 1000).toISOString(),
      }, HOLD_TTL_SECONDS);

      // ── (f) Create Razorpay payment order ──────────────────────────────
      const paymentOrder = await paymentService.createBookingOrder(
        userId,
        booking._id,
        amount,
        currency
      );

      // ── (g) Invalidate availability cache ──────────────────────────────
      await this.invalidateAvailabilityCache(interviewer._id.toString());

      logger.info(`[Booking] Slot ${slotId} held by user ${userId}, booking ${booking._id}`);

      return {
        booking,
        paymentOrder,
        holdExpiresAt: new Date(Date.now() + HOLD_TTL_SECONDS * 1000).toISOString(),
        holdTtlSeconds: HOLD_TTL_SECONDS,
      };
    } catch (error) {
      // Always release the lock if anything goes wrong after acquiring it
      await lockService.releaseLock(lock);
      throw error;
    }
    // NOTE: We deliberately do NOT release the lock here on success.
    // The lock TTL acts as the hold duration.  releaseLock is called by
    // confirmBooking / releaseHold once the payment outcome is known.
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3.  CONFIRM BOOKING  (called after successful payment)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Confirm the booking after payment is verified.
   *
   * Steps:
   *   a. Retrieve hold record — proves the caller has a legitimate hold.
   *   b. Verify Razorpay payment signature.
   *   c. Inside a Mongoose session (transaction):
   *        i.  Mark the AvailabilitySlot as "booked".
   *        ii. Mark the Booking as "confirmed" and attach payment.
   *       iii. Update Interviewer earnings.
   *   d. Release Redis lock and clear hold.
   *   e. Invalidate caches.
   *
   * @param {string} userId
   * @param {string} slotId
   * @param {string} bookingId
   * @param {string} razorpayPaymentId
   * @param {string} razorpayOrderId
   * @param {string} razorpaySignature
   * @returns {Booking}
   */
  async confirmBooking(userId, slotId, bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature) {
    // ── (a) Validate hold ──────────────────────────────────────────────────
    const hold = await lockService.getHold(slotId);
    if (!hold) {
      throw new BadRequestError(
        'Your slot reservation has expired. Please start the booking process again.'
      );
    }
    if (hold.userId !== userId.toString()) {
      throw new ForbiddenError('This reservation belongs to a different user.');
    }
    if (hold.bookingId !== bookingId.toString()) {
      throw new BadRequestError('Booking ID does not match the active reservation.');
    }

    // ── (b) Verify payment signature ──────────────────────────────────────
    const isValidSig = paymentService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!isValidSig) {
      // Mark the payment record as failed for audit
      const failedPayment = await Payment.findOne({ razorpayOrderId });
      if (failedPayment) await failedPayment.markFailed('Invalid payment signature');
      throw new BadRequestError('Payment signature verification failed.');
    }

    // ── (c) Atomic DB transaction ──────────────────────────────────────────
    const session = await mongoose.startSession();
    let confirmedBooking;

    try {
      await session.withTransaction(async () => {
        // i. Mark slot as booked
        const slot = await AvailabilitySlot.findById(slotId).session(session);
        if (!slot) throw new NotFoundError('Availability slot not found');
        if (slot.status !== 'available') {
          throw new ConflictError(
            'Slot status changed unexpectedly. Payment will be refunded.'
          );
        }
        slot.status = 'booked';
        slot.booking = bookingId;
        await slot.save({ session });

        // ii. Confirm booking
        const booking = await Booking.findOne({
          _id: bookingId,
          user: userId,
          status: 'pending',
        }).session(session);
        if (!booking) throw new NotFoundError('Pending booking not found');

        // Fetch payment record by order ID
        const payment = await Payment.findOne({ razorpayOrderId }).session(session);
        if (!payment) throw new NotFoundError('Payment record not found');

        payment.razorpayPaymentId = razorpayPaymentId;
        payment.razorpaySignature = razorpaySignature;
        payment.status = 'completed';
        payment.paidAt = new Date();
        payment.transactionId = razorpayPaymentId;
        await payment.save({ session });

        booking.status = 'confirmed';
        booking.payment = payment._id;
        await booking.save({ session });

        confirmedBooking = booking;

        // iii. Increment interviewer stats + earnings
        await Interviewer.findByIdAndUpdate(
          booking.interviewer,
          {
            $inc: {
              totalInterviews: 1,
              'earnings.total': booking.amount,
              'earnings.pending': booking.amount,
            },
          },
          { session }
        );
      });
    } finally {
      session.endSession();
    }

    // ── (d) Release lock and clear hold ───────────────────────────────────
    const lockObj = { lockKey: `slot:lock:${slotId}`, token: hold.lockToken };
    await lockService.releaseLock(lockObj);
    await lockService.clearHold(slotId);

    // ── (e) Invalidate caches ─────────────────────────────────────────────
    const booking = await Booking.findById(bookingId).populate('interviewer', '_id');
    await this.invalidateAvailabilityCache(booking.interviewer._id.toString());
    await redisClient.del(bookingCacheKey(bookingId));

    logger.info(`[Booking] Confirmed booking ${bookingId} for slot ${slotId}`);
    return confirmedBooking;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4.  RELEASE HOLD  (payment failed / user cancelled before paying)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Release an active hold and revert the pending booking to "cancelled".
   *
   * This is called:
   *   • By the payment failure webhook handler.
   *   • Explicitly by the user clicking "cancel" during checkout.
   *   • By the cleanup cron job for expired holds.
   *
   * @param {string} userId
   * @param {string} slotId
   * @param {string} reason  - Human-readable reason for release
   */
  async releaseHold(userId, slotId, reason = 'Payment not completed') {
    const hold = await lockService.getHold(slotId);

    // If the hold has already expired or been cleared, nothing to do
    if (!hold) {
      logger.debug(`[Booking] releaseHold: no hold found for slot ${slotId}`);
      return;
    }

    if (hold.userId !== userId.toString()) {
      throw new ForbiddenError('Cannot release a hold that belongs to a different user.');
    }

    // Cancel the pending booking
    await Booking.findByIdAndUpdate(hold.bookingId, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledBy: userId,
      cancelledAt: new Date(),
    });

    // Release lock
    const lockObj = { lockKey: `slot:lock:${slotId}`, token: hold.lockToken };
    await lockService.releaseLock(lockObj);
    await lockService.clearHold(slotId);

    // Invalidate availability cache
    const booking = await Booking.findById(hold.bookingId).populate('interviewer', '_id');
    if (booking?.interviewer) {
      await this.invalidateAvailabilityCache(booking.interviewer._id.toString());
    }

    logger.info(`[Booking] Hold released for slot ${slotId} (reason: ${reason})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5.  CANCEL BOOKING  (post-confirmation cancellation)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Cancel a confirmed booking.
   * Automatically initiates a refund if cancellation is within the refund window.
   *
   * @param {string} userId
   * @param {string} bookingId
   * @param {string} reason
   * @param {boolean} isAdmin  - Admins bypass the 24-hour cancellation window
   * @returns {{ booking, refundInitiated: boolean }}
   */
  async cancelBooking(userId, bookingId, reason, isAdmin = false) {
    const booking = await Booking.findById(bookingId).populate('payment');
    if (!booking) throw new NotFoundError('Booking not found');

    // Ownership check (admins can cancel any booking)
    if (!isAdmin && booking.user.toString() !== userId.toString()) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new BadRequestError(`Cannot cancel a booking with status "${booking.status}"`);
    }

    if (!isAdmin && !booking.canCancel) {
      throw new BadRequestError(
        'Bookings can only be cancelled at least 24 hours before the scheduled time'
      );
    }

    // Perform cancellation in a session for atomicity
    const session = await mongoose.startSession();
    let refundInitiated = false;

    try {
      await session.withTransaction(async () => {
        booking.status = 'cancelled';
        booking.cancelledBy = userId;
        booking.cancellationReason = reason;
        booking.cancelledAt = new Date();
        await booking.save({ session });

        // Release the AvailabilitySlot back to 'available'
        if (booking.availabilitySlot) {
          await AvailabilitySlot.findByIdAndUpdate(
            booking.availabilitySlot,
            { status: 'available', booking: null },
            { session }
          );
        }

        // Rollback interviewer pending earnings
        if (booking.status === 'confirmed') {
          await Interviewer.findByIdAndUpdate(
            booking.interviewer,
            { $inc: { 'earnings.pending': -booking.amount } },
            { session }
          );
        }
      });
    } finally {
      session.endSession();
    }

    // Initiate refund if payment exists and is refundable
    if (booking.payment && booking.payment.status === 'completed') {
      try {
        await paymentService.processRefund(
          booking.payment._id,
          booking.payment.amount,
          `Booking cancelled: ${reason}`
        );
        refundInitiated = true;
      } catch (refundError) {
        // Log but don't fail the cancellation — refund can be retried
        logger.error(`[Booking] Refund initiation failed for booking ${bookingId}:`, refundError);
      }
    }

    // Invalidate caches
    await this.invalidateAvailabilityCache(booking.interviewer.toString());
    await redisClient.del(bookingCacheKey(bookingId));

    logger.info(`[Booking] Booking ${bookingId} cancelled by user ${userId}`);
    return { booking, refundInitiated };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6.  RESCHEDULE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Move an existing confirmed booking to a new slot atomically.
   *
   * @param {string} userId
   * @param {string} bookingId
   * @param {string} newSlotId
   * @param {string} reason
   * @returns {Booking}
   */
  async rescheduleBooking(userId, bookingId, newSlotId, reason) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.user.toString() !== userId.toString()) {
      throw new ForbiddenError('You can only reschedule your own bookings');
    }
    if (!booking.canReschedule()) {
      throw new BadRequestError(
        'Rescheduling is only allowed at least 24 hours before the session'
      );
    }

    const newSlot = await AvailabilitySlot.findById(newSlotId);
    if (!newSlot) throw new NotFoundError('New availability slot not found');
    if (newSlot.status !== 'available') {
      throw new ConflictError('The requested slot is not available');
    }

    // Acquire lock on the new slot
    const lock = await lockService.acquireLock(newSlotId, userId.toString(), HOLD_TTL_SECONDS);
    if (!lock) {
      throw new ConflictError('The requested slot is currently being reserved by another user');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Re-check new slot inside session
        const freshNewSlot = await AvailabilitySlot.findById(newSlotId).session(session);
        if (!freshNewSlot || freshNewSlot.status !== 'available') {
          throw new ConflictError('The requested slot was just taken');
        }

        // Release old slot
        if (booking.availabilitySlot) {
          await AvailabilitySlot.findByIdAndUpdate(
            booking.availabilitySlot,
            { status: 'available', booking: null },
            { session }
          );
        }

        // Claim new slot
        freshNewSlot.status = 'booked';
        freshNewSlot.booking = bookingId;
        await freshNewSlot.save({ session });

        // Update booking
        const previousDate = booking.scheduledDate;
        const previousStartTime = booking.startTime;
        booking.availabilitySlot = newSlotId;
        booking.scheduledDate = newSlot.startDateTime;
        booking.startTime = newSlot.startDateTime.toISOString().substr(11, 5);
        booking.endTime = newSlot.endDateTime.toISOString().substr(11, 5);
        booking.rescheduleHistory.push({
          previousDate,
          previousStartTime,
          rescheduledBy: userId,
          reason,
        });
        await booking.save({ session });
      });

      await lockService.releaseLock(lock);
      await this.invalidateAvailabilityCache(booking.interviewer.toString());
      await redisClient.del(bookingCacheKey(bookingId));

      logger.info(`[Booking] Booking ${bookingId} rescheduled to slot ${newSlotId}`);
      return booking;
    } catch (err) {
      await lockService.releaseLock(lock);
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7.  QUERIES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get a single booking by ID with full population.
   */
  async getBookingById(bookingId, userId, isAdmin = false) {
    const cached = await redisClient.get(bookingCacheKey(bookingId));
    if (cached) return cached;

    const booking = await Booking.findById(bookingId)
      .populate('user', 'firstName lastName email avatar')
      .populate({
        path: 'interviewer',
        select: 'user company position hourlyRate currency',
        populate: { path: 'user', select: 'firstName lastName avatar' },
      })
      .populate('availabilitySlot', 'startDateTime endDateTime duration')
      .populate('payment', 'status amount currency paidAt razorpayPaymentId')
      .lean();

    if (!booking) throw new NotFoundError('Booking not found');

    if (!isAdmin && booking.user._id.toString() !== userId.toString()) {
      throw new ForbiddenError('Access denied');
    }

    await redisClient.set(bookingCacheKey(bookingId), booking, BOOKING_CACHE_TTL);
    return booking;
  }

  /**
   * Paginated booking history for a user.
   */
  async getUserBookings(userId, { page = 1, limit = 10, status, from, to } = {}) {
    const filter = { user: userId };
    if (status) filter.status = status;
    if (from || to) {
      filter.scheduledDate = {};
      if (from) filter.scheduledDate.$gte = new Date(from);
      if (to)   filter.scheduledDate.$lte = new Date(to);
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ scheduledDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'interviewer',
          select: 'company position',
          populate: { path: 'user', select: 'firstName lastName avatar' },
        })
        .populate('availabilitySlot', 'startDateTime endDateTime')
        .populate('payment', 'status paidAt')
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return { bookings, pagination: { page, limit, total } };
  }

  /**
   * Upcoming confirmed bookings for an interviewer.
   */
  async getInterviewerSchedule(interviewerId, { page = 1, limit = 20, from, to } = {}) {
    const now = from ? new Date(from) : new Date();
    const filter = {
      interviewer: interviewerId,
      status: { $in: ['confirmed', 'in-progress'] },
      scheduledDate: { $gte: now },
    };
    if (to) filter.scheduledDate.$lte = new Date(to);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ scheduledDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'firstName lastName email avatar')
        .populate('availabilitySlot', 'startDateTime endDateTime')
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return { bookings, pagination: { page, limit, total } };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8.  GENERATE SLOTS FROM TEMPLATE  (called by cron / admin trigger)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Materialise AvailabilitySlot documents from an Interviewer's weekly
   * template for the next `daysAhead` days.
   *
   * Idempotent — duplicate slot inserts are silently ignored (unique index).
   *
   * @param {string} interviewerId
   * @param {number} daysAhead  - How many days forward to generate (default 14)
   * @returns {{ created: number, skipped: number }}
   */
  async generateSlotsFromTemplate(interviewerId, daysAhead = 14) {
    const interviewer = await Interviewer.findById(interviewerId);
    if (!interviewer) throw new NotFoundError('Interviewer not found');
    if (!interviewer.isApproved || interviewer.status !== 'active') {
      throw new BadRequestError('Interviewer is not active');
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const slots = [];

    for (let d = 0; d < daysAhead; d++) {
      const date = new Date(now);
      date.setUTCDate(now.getUTCDate() + d);
      date.setUTCHours(0, 0, 0, 0);

      const dayName = dayNames[date.getUTCDay()];
      const tpl = interviewer.availability.find((a) => a.day === dayName);
      if (!tpl) continue;

      // Skip blackout dates
      const isBlackedOut = interviewer.blackoutDates.some(
        (bd) => bd.toISOString().slice(0, 10) === date.toISOString().slice(0, 10)
      );
      if (isBlackedOut) continue;

      for (const timeSlot of tpl.slots) {
        if (!timeSlot.isAvailable) continue;

        const [sh, sm] = timeSlot.startTime.split(':').map(Number);
        const [eh, em] = timeSlot.endTime.split(':').map(Number);

        const startDateTime = new Date(date);
        startDateTime.setUTCHours(sh, sm, 0, 0);

        const endDateTime = new Date(date);
        endDateTime.setUTCHours(eh, em, 0, 0);

        // Don't generate slots in the past
        if (startDateTime < now) continue;

        const durationMin = (endDateTime - startDateTime) / 60000;
        if (durationMin < 15) continue;

        slots.push({
          interviewer: interviewerId,
          interviewerUser: interviewer.user,
          startDateTime,
          endDateTime,
          duration: durationMin,
          interviewTypes: interviewer.interviewTypes,
          isRecurring: true,
          sourceTemplate: { day: dayName, startTime: timeSlot.startTime },
          status: 'available',
        });
      }
    }

    if (slots.length === 0) return { created: 0, skipped: 0 };

    // Ordered: false so that duplicates don't abort the whole batch
    let created = 0;
    let skipped = 0;

    try {
      const result = await AvailabilitySlot.insertMany(slots, {
        ordered: false,
        rawResult: true,
      });
      created = result.insertedCount ?? 0;
    } catch (err) {
      // E11000 bulk write errors — count the successes
      if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
        created = err.result?.nInserted ?? 0;
        skipped = slots.length - created;
      } else {
        throw new InternalServerError('Failed to generate slots');
      }
    }

    await this.invalidateAvailabilityCache(interviewerId);
    logger.info(`[Booking] Generated ${created} slots for interviewer ${interviewerId} (${skipped} duplicates skipped)`);
    return { created, skipped };
  }
}

module.exports = new BookingService();

// Made with Bob
