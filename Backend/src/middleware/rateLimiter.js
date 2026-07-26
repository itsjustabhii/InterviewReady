const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');
const config = require('../config');
const { TooManyRequestsError } = require('../utils/errors');

/**
 * Create rate limiter with Redis store
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new TooManyRequestsError(
        'Too many requests from this IP, please try again later'
      );
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user && req.user.role === 'admin';
    },
  };

  // Use Redis store if Redis is connected
  if (redisClient.isConnected()) {
    defaultOptions.store = new RedisStore({
      client: redisClient.getClient(),
      prefix: 'rate_limit:',
    });
  }

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * General API rate limiter
 */
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

/**
 * Strict rate limiter for sensitive operations
 */
const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again after 15 minutes',
});

/**
 * Auth rate limiter
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again after 15 minutes',
});

/**
 * Registration rate limiter
 */
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Too many registration attempts, please try again after an hour',
});

/**
 * Password reset rate limiter
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  message: 'Too many password reset requests, please try again after an hour',
});

/**
 * Email verification rate limiter
 */
const emailVerificationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 verification emails per hour
  message: 'Too many verification requests, please try again after an hour',
});

/**
 * Payment rate limiter
 */
const paymentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 payment attempts per window
  message: 'Too many payment attempts, please try again after 15 minutes',
});

/**
 * Booking rate limiter
 */
const bookingLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 booking requests per hour
  message: 'Too many booking requests, please try again after an hour',
});

/**
 * Review rate limiter
 */
const reviewLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reviews per hour
  message: 'Too many review submissions, please try again after an hour',
});

/**
 * File upload rate limiter
 */
const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Too many file uploads, please try again after 15 minutes',
});

/**
 * Search rate limiter
 */
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests, please slow down',
});

/**
 * Admin operations rate limiter
 */
const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window for admin
  message: 'Too many admin requests, please try again after 15 minutes',
});

/**
 * Webhook rate limiter
 */
const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  message: 'Too many webhook requests',
  skip: () => false, // Don't skip for any user
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  strictLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  paymentLimiter,
  bookingLimiter,
  reviewLimiter,
  uploadLimiter,
  searchLimiter,
  adminLimiter,
  webhookLimiter,
};

// Made with Bob
