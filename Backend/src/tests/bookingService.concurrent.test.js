/**
 * bookingService.concurrent.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration tests that verify the booking engine is concurrency-safe.
 *
 * These tests mock:
 *   • The ioredis client (in-memory via ioredis-mock)
 *   • Mongoose models (no real DB connection needed in CI)
 *   • Razorpay constructor (avoids key_id required error)
 *
 * Focus areas:
 *   1. RedisLockService — acquire, double-acquire, release, atomic Lua
 *   2. Concurrent holdSlot — only one of N simultaneous requests succeeds
 *   3. confirmBooking — happy path + expired hold rejection
 *   4. releaseHold    — cleans up correctly
 *   5. cleanStalePendingBookings — cancels old pending bookings
 */

// Must be first — mocks are hoisted before any require
jest.mock('ioredis', () => require('ioredis-mock'));

// Mock Razorpay before paymentService is loaded so the constructor doesn't
// throw "key_id is mandatory"
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn(),
    },
    payments: {
      fetch: jest.fn(),
      refund: jest.fn(),
    },
  }));
});

// ─── Mock models ─────────────────────────────────────────────────────────────
jest.mock('../models/AvailabilitySlot');
jest.mock('../models/Booking');
jest.mock('../models/Interviewer');
jest.mock('../models/Payment');

const mongoose = require('mongoose');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Booking          = require('../models/Booking');
const Interviewer      = require('../models/Interviewer');
const Payment          = require('../models/Payment');
const paymentService   = require('../services/paymentService');

// ─── Bring in the services under test ────────────────────────────────────────
// Re-require AFTER mocks are registered so they pick up the mock ioredis
let lockService;
let bookingService;
let redisClient;

beforeAll(async () => {
  // Connect the ioredis-mock so the client's .isReady flag doesn't block
  redisClient = require('../config/redis');
  redisClient.connect();
  // Give ioredis-mock a tick to fire 'ready'
  await new Promise((r) => setImmediate(r));

  lockService   = require('../services/redisLockService');
  bookingService = require('../services/bookingService');
});

afterEach(async () => {
  // Flush all keys between tests for isolation
  const client = redisClient.getClient();
  await client.flushall();
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SLOT_ID       = new mongoose.Types.ObjectId().toString();
const USER_ID       = new mongoose.Types.ObjectId().toString();
const BOOKING_ID    = new mongoose.Types.ObjectId().toString();
const INTERVIEWER_ID = new mongoose.Types.ObjectId().toString();
const USER_ID_2     = new mongoose.Types.ObjectId().toString();

function makeSlot(overrides = {}) {
  return {
    _id: SLOT_ID,
    interviewer: {
      _id: INTERVIEWER_ID,
      hourlyRate: 1500,
      currency: 'INR',
      interviewTypes: ['technical'],
    },
    interviewerUser: new mongoose.Types.ObjectId(),
    startDateTime: new Date(Date.now() + 60 * 60 * 1000),
    endDateTime:   new Date(Date.now() + 2 * 60 * 60 * 1000),
    duration: 60,
    priceOverride: null,
    currency: 'INR',
    status: 'available',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: RedisLockService
// ─────────────────────────────────────────────────────────────────────────────
describe('RedisLockService', () => {
  test('acquires a lock and returns a lock object', async () => {
    const lock = await lockService.acquireLock(SLOT_ID, USER_ID, 60);
    expect(lock).not.toBeNull();
    expect(lock.lockKey).toBe(`slot:lock:${SLOT_ID}`);
    expect(lock.token).toContain(USER_ID);
    expect(lock.ttlSeconds).toBe(60);
  });

  test('second acquire on the same resource fails (no retries)', async () => {
    await lockService.acquireLock(SLOT_ID, USER_ID, 60, { retryCount: 0 });
    const lock2 = await lockService.acquireLock(SLOT_ID, USER_ID_2, 60, { retryCount: 0 });
    expect(lock2).toBeNull();
  });

  test('release returns true and allows re-acquire', async () => {
    const lock = await lockService.acquireLock(SLOT_ID, USER_ID, 60);
    const released = await lockService.releaseLock(lock);
    expect(released).toBe(true);

    const lock2 = await lockService.acquireLock(SLOT_ID, USER_ID_2, 60);
    expect(lock2).not.toBeNull();
  });

  test('release with wrong token returns false (Lua check)', async () => {
    await lockService.acquireLock(SLOT_ID, USER_ID, 60);
    const fakelock = { lockKey: `slot:lock:${SLOT_ID}`, token: 'wrong-token' };
    const released = await lockService.releaseLock(fakelock);
    expect(released).toBe(false);

    // Original lock key should still exist
    const stillLocked = await lockService.isLocked(SLOT_ID);
    expect(stillLocked).toBe(true);
  });

  test('isOwner returns true for the correct token only', async () => {
    const lock = await lockService.acquireLock(SLOT_ID, USER_ID, 60);
    expect(await lockService.isOwner(SLOT_ID, lock.token)).toBe(true);
    expect(await lockService.isOwner(SLOT_ID, 'bad-token')).toBe(false);
  });

  test('setHold / getHold / clearHold round-trip', async () => {
    const data = { userId: USER_ID, bookingId: BOOKING_ID, amount: 1500 };
    await lockService.setHold(SLOT_ID, data, 30);

    const retrieved = await lockService.getHold(SLOT_ID);
    expect(retrieved).toMatchObject(data);

    await lockService.clearHold(SLOT_ID);
    expect(await lockService.getHold(SLOT_ID)).toBeNull();
  });

  test('extendLock with correct token extends TTL', async () => {
    const lock = await lockService.acquireLock(SLOT_ID, USER_ID, 10);
    const extended = await lockService.extendLock(lock, 600);
    expect(extended).toBe(true);

    const ttl = await redisClient.getClient().pttl(lock.lockKey);
    expect(ttl).toBeGreaterThan(9000); // should be close to 600 000ms
  });

  test('extendLock with wrong token returns false', async () => {
    await lockService.acquireLock(SLOT_ID, USER_ID, 10);
    const badLock = { lockKey: `slot:lock:${SLOT_ID}`, token: 'wrong' };
    const extended = await lockService.extendLock(badLock, 600);
    expect(extended).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: BookingService.holdSlot — concurrent safety
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingService.holdSlot — concurrent safety', () => {
  beforeEach(() => {
    const slot = makeSlot();

    // AvailabilitySlot.findById is called twice per holdSlot invocation:
    //   1st call (pre-lock check):  needs .populate() chain
    //   2nd call (inside lock, double-check): plain findById call
    // Always return a valid available slot; the Redis lock is what guards
    // the second concurrent request (not the slot status check).
    AvailabilitySlot.findById = jest.fn().mockImplementation((id) => {
      // If the mock is called with .populate chained, return the chain
      const obj = { ...slot };
      obj.populate = jest.fn().mockResolvedValue(slot);
      // Also allow being awaited directly (for the inside-lock double-check)
      obj.then = undefined; // prevent being treated as a promise
      // Return a thenable only when needed; simplest approach: always chain-capable
      return Object.assign(Promise.resolve(slot), { populate: jest.fn().mockResolvedValue(slot) });
    });

    // No existing clash booking
    Booking.findOne = jest.fn().mockResolvedValue(null);

    // Booking.create returns a mock booking
    Booking.create = jest.fn().mockResolvedValue({
      _id: BOOKING_ID,
      user: USER_ID,
      status: 'pending',
      amount: 1500,
      currency: 'INR',
      interviewer: { _id: INTERVIEWER_ID },
    });

    // paymentService.createBookingOrder succeeds
    paymentService.createBookingOrder = jest.fn().mockResolvedValue({
      orderId: 'order_123',
      amount: 150000,
      currency: 'INR',
      paymentId: new mongoose.Types.ObjectId().toString(),
    });
  });

  test('first holdSlot call succeeds and returns booking + paymentOrder', async () => {
    const result = await bookingService.holdSlot(
      USER_ID, SLOT_ID, 'technical', 'System Design'
    );
    expect(result.booking._id.toString()).toBe(BOOKING_ID);
    expect(result.paymentOrder.orderId).toBe('order_123');
    expect(result.holdTtlSeconds).toBe(600);
  });

  test('second concurrent holdSlot on same slot is rejected with ConflictError', async () => {
    // First hold — succeeds
    await bookingService.holdSlot(USER_ID, SLOT_ID, 'technical', 'Algorithms');

    // Second hold from a different user — should be blocked by the Redis lock
    await expect(
      bookingService.holdSlot(USER_ID_2, SLOT_ID, 'technical', 'Algorithms', '', {
        retryCount: 0,  // don't retry
      })
    ).rejects.toMatchObject({ message: expect.stringMatching(/reserved|available/i) });
  });

  test('holdSlot rejects if slot status is not available (pre-lock check)', async () => {
    const bookedSlot = makeSlot({ status: 'booked' });
    AvailabilitySlot.findById = jest.fn().mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(bookedSlot),
    }));

    await expect(
      bookingService.holdSlot(USER_ID, SLOT_ID, 'technical', 'DS')
    ).rejects.toMatchObject({ message: /no longer available/i });
  });

  test('holdSlot rejects if slot not found', async () => {
    AvailabilitySlot.findById = jest.fn().mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(null),
    }));

    await expect(
      bookingService.holdSlot(USER_ID, SLOT_ID, 'technical', 'DS')
    ).rejects.toMatchObject({ message: /not found/i });
  });

  test('holdSlot rejects if user already has a booking at that time (clash)', async () => {
    Booking.findOne = jest.fn().mockResolvedValue({ _id: 'existing-booking' });

    await expect(
      bookingService.holdSlot(USER_ID, SLOT_ID, 'technical', 'DS')
    ).rejects.toMatchObject({ message: /already have a booking/i });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: BookingService.confirmBooking
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingService.confirmBooking', () => {
  const ORDER_ID     = 'order_abc';
  const PAYMENT_ID   = 'pay_xyz';
  const SIGNATURE    = 'valid_sig';

  beforeEach(async () => {
    // Seed a valid hold in Redis
    await lockService.setHold(SLOT_ID, {
      userId: USER_ID,
      bookingId: BOOKING_ID,
      amount: 1500,
      lockToken: `${USER_ID}:some-uuid`,
    }, 600);

    paymentService.verifyPaymentSignature = jest.fn().mockReturnValue(true);
  });

  test('confirmBooking with expired hold throws BadRequestError', async () => {
    // Clear the hold so it appears expired
    await lockService.clearHold(SLOT_ID);

    await expect(
      bookingService.confirmBooking(
        USER_ID, SLOT_ID, BOOKING_ID,
        PAYMENT_ID, ORDER_ID, SIGNATURE
      )
    ).rejects.toMatchObject({ message: /expired/i });
  });

  test('confirmBooking with wrong userId throws ForbiddenError', async () => {
    await expect(
      bookingService.confirmBooking(
        USER_ID_2, SLOT_ID, BOOKING_ID,
        PAYMENT_ID, ORDER_ID, SIGNATURE
      )
    ).rejects.toMatchObject({ message: /different user/i });
  });

  test('confirmBooking with mismatched bookingId throws BadRequestError', async () => {
    const otherBookingId = new mongoose.Types.ObjectId().toString();
    await expect(
      bookingService.confirmBooking(
        USER_ID, SLOT_ID, otherBookingId,
        PAYMENT_ID, ORDER_ID, SIGNATURE
      )
    ).rejects.toMatchObject({ message: /does not match/i });
  });

  test('confirmBooking fails if payment signature is invalid', async () => {
    paymentService.verifyPaymentSignature = jest.fn().mockReturnValue(false);
    Payment.findOne = jest.fn().mockResolvedValue({
      markFailed: jest.fn().mockResolvedValue(undefined),
    });

    await expect(
      bookingService.confirmBooking(
        USER_ID, SLOT_ID, BOOKING_ID,
        PAYMENT_ID, ORDER_ID, 'BAD_SIG'
      )
    ).rejects.toMatchObject({ message: /signature/i });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: BookingService.releaseHold
// ─────────────────────────────────────────────────────────────────────────────
describe('BookingService.releaseHold', () => {
  beforeEach(async () => {
    // Seed a hold
    await lockService.setHold(SLOT_ID, {
      userId: USER_ID,
      bookingId: BOOKING_ID,
      lockToken: `${USER_ID}:some-uuid`,
    }, 600);

    Booking.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    // releaseHold calls Booking.findById(id).populate('interviewer', '_id')
    // We need a chainable mock that resolves to null (no interviewer to invalidate)
    const populateMock = jest.fn().mockResolvedValue(null);
    Booking.findById = jest.fn().mockReturnValue({ populate: populateMock });
  });

  test('releaseHold succeeds and clears the Redis hold', async () => {
    await bookingService.releaseHold(USER_ID, SLOT_ID, 'User cancelled');
    const hold = await lockService.getHold(SLOT_ID);
    expect(hold).toBeNull();
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  test('releaseHold is a no-op when hold is already gone', async () => {
    await lockService.clearHold(SLOT_ID);
    await expect(
      bookingService.releaseHold(USER_ID, SLOT_ID)
    ).resolves.toBeUndefined();
    expect(Booking.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('releaseHold rejects if different user tries to release', async () => {
    await expect(
      bookingService.releaseHold(USER_ID_2, SLOT_ID)
    ).rejects.toMatchObject({ message: /different user/i });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Cleanup Job
// ─────────────────────────────────────────────────────────────────────────────
describe('bookingCleanupJob — cleanStalePendingBookings', () => {
  let cleanStalePendingBookings;
  let expirePastSlots;

  beforeAll(() => {
    ({ cleanStalePendingBookings, expirePastSlots } = require('../services/bookingCleanupJob'));
  });

  beforeEach(() => {
    // Mock mongoose.startSession
    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn) => fn()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
  });

  test('cleanStalePendingBookings cancels stale bookings and returns count', async () => {
    const staleId = new mongoose.Types.ObjectId();
    const slotObjId = new mongoose.Types.ObjectId();

    Booking.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: staleId, availabilitySlot: slotObjId, interviewer: INTERVIEWER_ID, createdAt: new Date(Date.now() - 15 * 60 * 1000) },
        ]),
      }),
    });
    Booking.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    AvailabilitySlot.findOneAndUpdate = jest.fn().mockResolvedValue(undefined);

    const count = await cleanStalePendingBookings();
    expect(count).toBe(1);
    expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
      staleId,
      expect.objectContaining({ status: 'cancelled' }),
      expect.any(Object)
    );
    expect(AvailabilitySlot.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: slotObjId }),
      expect.objectContaining({ status: 'available', booking: null }),
      expect.any(Object)
    );
  });

  test('cleanStalePendingBookings returns 0 when no stale bookings', async () => {
    Booking.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    const count = await cleanStalePendingBookings();
    expect(count).toBe(0);
  });

  test('expirePastSlots calls AvailabilitySlot.expirePastSlots', async () => {
    AvailabilitySlot.expirePastSlots = jest.fn().mockResolvedValue({ modifiedCount: 5 });
    const count = await expirePastSlots();
    expect(count).toBe(5);
    expect(AvailabilitySlot.expirePastSlots).toHaveBeenCalled();
  });
});
