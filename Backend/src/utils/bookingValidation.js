/**
 * Booking & Availability Validation Schemas (Joi)
 */

const Joi = require('joi');
const { validate, commonSchemas } = require('../utils/validation');

// ─── Shared ───────────────────────────────────────────────────────────────────
const objectId = commonSchemas.objectId.required();

const interviewType = Joi.string()
  .valid('technical', 'behavioral', 'system-design', 'coding', 'mock-interview', 'resume-review')
  .required()
  .messages({ 'any.only': 'Interview type must be one of the allowed values' });

// ─── Availability ──────────────────────────────────────────────────────────────
const getAvailabilitySchema = Joi.object({
  params: Joi.object({
    interviewerId: objectId,
  }),
  query: Joi.object({
    from: Joi.date().iso().min('now').default(() => new Date()),
    to: Joi.date().iso().min(Joi.ref('from')).default(() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d;
    }),
  }),
  body: Joi.object(),
});

// ─── Hold Slot ─────────────────────────────────────────────────────────────────
const holdSlotSchema = Joi.object({
  body: Joi.object({
    slotId: objectId,
    interviewType,
    expertise: Joi.string().trim().min(2).max(100).required(),
    notes: Joi.string().trim().max(500).optional().allow(''),
  }),
  params: Joi.object(),
  query: Joi.object(),
});

// ─── Confirm Booking ───────────────────────────────────────────────────────────
const confirmBookingSchema = Joi.object({
  body: Joi.object({
    slotId: objectId,
    bookingId: objectId,
    razorpayPaymentId: Joi.string().trim().required(),
    razorpayOrderId: Joi.string().trim().required(),
    razorpaySignature: Joi.string().trim().required(),
  }),
  params: Joi.object(),
  query: Joi.object(),
});

// ─── Release Hold ──────────────────────────────────────────────────────────────
const releaseHoldSchema = Joi.object({
  params: Joi.object({
    slotId: objectId,
  }),
  body: Joi.object({
    reason: Joi.string().trim().max(200).optional().allow(''),
  }),
  query: Joi.object(),
});

// ─── Cancel Booking ────────────────────────────────────────────────────────────
const cancelBookingSchema = Joi.object({
  params: Joi.object({
    bookingId: objectId,
  }),
  body: Joi.object({
    reason: Joi.string().trim().max(500).optional().allow(''),
  }),
  query: Joi.object(),
});

// ─── Reschedule ────────────────────────────────────────────────────────────────
const rescheduleBookingSchema = Joi.object({
  params: Joi.object({
    bookingId: objectId,
  }),
  body: Joi.object({
    newSlotId: objectId,
    reason: Joi.string().trim().max(200).optional().allow(''),
  }),
  query: Joi.object(),
});

// ─── User Bookings List ────────────────────────────────────────────────────────
const getUserBookingsSchema = Joi.object({
  params: Joi.object(),
  body: Joi.object(),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string()
      .valid('pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')
      .optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
  }),
});

// ─── Interviewer Schedule ──────────────────────────────────────────────────────
const getScheduleSchema = Joi.object({
  params: Joi.object({
    interviewerId: objectId,
  }),
  body: Joi.object(),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
  }),
});

// ─── Generate Slots ────────────────────────────────────────────────────────────
const generateSlotsSchema = Joi.object({
  params: Joi.object({
    interviewerId: objectId,
  }),
  body: Joi.object({
    daysAhead: Joi.number().integer().min(1).max(60).default(14),
  }),
  query: Joi.object(),
});

// ─── Export middleware ─────────────────────────────────────────────────────────
module.exports = {
  validateGetAvailability: validate(getAvailabilitySchema),
  validateHoldSlot: validate(holdSlotSchema),
  validateConfirmBooking: validate(confirmBookingSchema),
  validateReleaseHold: validate(releaseHoldSchema),
  validateCancelBooking: validate(cancelBookingSchema),
  validateRescheduleBooking: validate(rescheduleBookingSchema),
  validateGetUserBookings: validate(getUserBookingsSchema),
  validateGetSchedule: validate(getScheduleSchema),
  validateGenerateSlots: validate(generateSlotsSchema),
};

// Made with Bob
