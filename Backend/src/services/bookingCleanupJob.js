/**
 * bookingCleanupJob
 * ─────────────────────────────────────────────────────────────────────────────
 * Cron job that runs every 5 minutes to:
 *
 *   1. Find AvailabilitySlots whose endDateTime is past and are still
 *      'available' → mark them 'expired'.
 *
 *   2. Find Booking documents in 'pending' status whose creation time
 *      is older than the HOLD_TTL (10 minutes) → cancel them and restore
 *      the associated AvailabilitySlot to 'available'.
 *      This is the safety net for holds whose Redis key already expired
 *      but the Booking was never explicitly released.
 *
 *   3. Emit a count metric via the logger so ops can monitor stale bookings.
 *
 * The job is idempotent — running it twice for the same data is safe.
 */

const { CronJob } = require('cron');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const lockService = require('./redisLockService');
const logger = require('../utils/logger');

// Maximum age of a pending booking before it is considered stale
const HOLD_TTL_MS = 10 * 60 * 1000; // 10 minutes (matches HOLD_TTL_SECONDS in bookingService)

/**
 * Expire past AvailabilitySlots.
 * @returns {number} count of expired slots
 */
async function expirePastSlots() {
  const result = await AvailabilitySlot.expirePastSlots();
  const count = result.modifiedCount || 0;
  if (count > 0) {
    logger.info(`[Cleanup] Expired ${count} past availability slots`);
  }
  return count;
}

/**
 * Cancel stale pending bookings and restore their slots.
 * @returns {number} count of bookings cleaned up
 */
async function cleanStalePendingBookings() {
  const cutoff = new Date(Date.now() - HOLD_TTL_MS);

  // Find all pending bookings older than the hold TTL
  const staleBookings = await Booking.find({
    status: 'pending',
    createdAt: { $lt: cutoff },
  }).select('_id availabilitySlot interviewer createdAt').lean();

  if (staleBookings.length === 0) return 0;

  logger.info(`[Cleanup] Found ${staleBookings.length} stale pending bookings to cancel`);

  let cleaned = 0;

  for (const booking of staleBookings) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Cancel the booking
        await Booking.findByIdAndUpdate(
          booking._id,
          {
            status: 'cancelled',
            cancellationReason: 'Payment not completed within the hold window',
            cancelledAt: new Date(),
          },
          { session }
        );

        // Restore the slot to 'available' (only if it's still in 'available' status —
        // it might have already been released by the user or the lock TTL)
        if (booking.availabilitySlot) {
          await AvailabilitySlot.findOneAndUpdate(
            {
              _id: booking.availabilitySlot,
              // Guard: only reset if the slot is still in a state that implies it was held
              status: { $in: ['available', 'booked'] },
              booking: booking._id,
            },
            { status: 'available', booking: null },
            { session }
          );
        }
      });

      // Clean up any residual Redis hold (belt-and-suspenders)
      if (booking.availabilitySlot) {
        const slotId = booking.availabilitySlot.toString();
        const hold = await lockService.getHold(slotId);
        if (hold && hold.bookingId === booking._id.toString()) {
          await lockService.clearHold(slotId);
          // The lock has a TTL so it expires on its own; no need to explicitly release
          logger.debug(`[Cleanup] Cleared stale hold for slot ${slotId}`);
        }
      }

      cleaned++;
    } catch (err) {
      logger.error(`[Cleanup] Error cleaning stale booking ${booking._id}:`, err);
    } finally {
      session.endSession();
    }
  }

  logger.info(`[Cleanup] Cleaned ${cleaned}/${staleBookings.length} stale bookings`);
  return cleaned;
}

/**
 * Main cleanup function — runs both tasks sequentially.
 */
async function runCleanup() {
  logger.debug('[Cleanup] Starting booking cleanup job');
  try {
    const expiredSlots  = await expirePastSlots();
    const cancelledHolds = await cleanStalePendingBookings();
    logger.info(`[Cleanup] Done — expired ${expiredSlots} slots, cancelled ${cancelledHolds} stale holds`);
  } catch (err) {
    logger.error('[Cleanup] Unhandled error in cleanup job:', err);
  }
}

/**
 * Create and start the cron job.
 * Call start() from server.js after DB and Redis are connected.
 *
 * Schedule: every 5 minutes  (`0,5,10,15,...` past every hour)
 */
const cleanupJob = new CronJob(
  '*/5 * * * *',   // every 5 minutes
  runCleanup,
  null,            // onComplete
  false,           // don't auto-start — caller calls .start()
  'UTC'
);

module.exports = {
  cleanupJob,
  runCleanup,       // exported for manual trigger / testing
  expirePastSlots,
  cleanStalePendingBookings,
};

// Made with Bob
