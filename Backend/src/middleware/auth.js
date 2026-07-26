const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const User = require('../models/User');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Authenticate user with JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    if (user.isLocked) {
      throw new UnauthorizedError('Account is locked due to multiple failed login attempts');
    }

    // Attach user to request
    req.user = user;
    req.token = token;

    logger.logAuth('authenticated', user._id);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next();
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user
    const user = await User.findById(decoded.userId);
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Authorize user based on roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.logAuth('authorization_failed', req.user._id, {
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return next(
        new ForbiddenError('You do not have permission to perform this action')
      );
    }

    logger.logAuth('authorized', req.user._id, { role: req.user.role });
    next();
  };
};

/**
 * Check if user owns the resource
 */
const checkOwnership = (resourceUserField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource user ID from request params, body, or resource object
    const resourceUserId = 
      req.params[resourceUserField] ||
      req.body[resourceUserField] ||
      (req.resource && req.resource[resourceUserField]);

    if (!resourceUserId) {
      return next(new ForbiddenError('Resource ownership cannot be verified'));
    }

    // Check if user owns the resource
    if (resourceUserId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError('You do not have access to this resource'));
    }

    next();
  };
};

/**
 * Verify email is verified
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isEmailVerified) {
    return next(new ForbiddenError('Email verification required'));
  }

  next();
};

/**
 * Check if user is interviewer
 */
const requireInterviewer = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role !== 'interviewer' && req.user.role !== 'admin') {
      return next(new ForbiddenError('Interviewer access required'));
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limit per user
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next();
      }

      const key = `rate_limit:user:${req.user._id}`;
      const requests = await redisClient.incr(key);

      if (requests === 1) {
        await redisClient.expire(key, Math.floor(windowMs / 1000));
      }

      if (requests > maxRequests) {
        return next(
          new ForbiddenError('Too many requests. Please try again later.')
        );
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests));

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  checkOwnership,
  requireEmailVerification,
  requireInterviewer,
  userRateLimit,
};

// Made with Bob
