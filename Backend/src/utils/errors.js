const { StatusCodes } = require('http-status-codes');

/**
 * Base API Error class
 */
class ApiError extends Error {
  constructor(message, statusCode, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Bad Request Error (400)
 */
class BadRequestError extends ApiError {
  constructor(message = 'Bad Request') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

/**
 * Unauthorized Error (401)
 */
class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Forbidden Error (403)
 */
class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, StatusCodes.FORBIDDEN);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, StatusCodes.NOT_FOUND);
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends ApiError {
  constructor(message = 'Conflict') {
    super(message, StatusCodes.CONFLICT);
  }
}

/**
 * Unprocessable Entity Error (422)
 */
class UnprocessableEntityError extends ApiError {
  constructor(message = 'Unprocessable Entity') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY);
  }
}

/**
 * Too Many Requests Error (429)
 */
class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests') {
    super(message, StatusCodes.TOO_MANY_REQUESTS);
  }
}

/**
 * Internal Server Error (500)
 */
class InternalServerError extends ApiError {
  constructor(message = 'Internal Server Error') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, false);
  }
}

/**
 * Service Unavailable Error (503)
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service Unavailable') {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, false);
  }
}

/**
 * Validation Error
 */
class ValidationError extends ApiError {
  constructor(errors) {
    const message = Array.isArray(errors)
      ? errors.map((err) => err.message || err).join(', ')
      : errors;
    super(message, StatusCodes.BAD_REQUEST);
    this.errors = errors;
  }
}

/**
 * Database Error
 */
class DatabaseError extends ApiError {
  constructor(message = 'Database operation failed') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, false);
  }
}

/**
 * Authentication Error
 */
class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Token Error
 */
class TokenError extends ApiError {
  constructor(message = 'Invalid or expired token') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Payment Error
 */
class PaymentError extends ApiError {
  constructor(message = 'Payment processing failed') {
    super(message, StatusCodes.PAYMENT_REQUIRED);
  }
}

/**
 * File Upload Error
 */
class FileUploadError extends ApiError {
  constructor(message = 'File upload failed') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

/**
 * External Service Error
 */
class ExternalServiceError extends ApiError {
  constructor(message = 'External service error', service = 'Unknown') {
    super(message, StatusCodes.BAD_GATEWAY, false);
    this.service = service;
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  TokenError,
  PaymentError,
  FileUploadError,
  ExternalServiceError,
};

// Made with Bob
