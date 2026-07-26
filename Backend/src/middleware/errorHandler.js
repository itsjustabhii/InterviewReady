const { StatusCodes } = require('http-status-codes');
const config = require('../config');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

/**
 * Convert error to ApiError
 */
const convertToApiError = (err) => {
  let error = err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(errors.join(', '), StatusCodes.BAD_REQUEST);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const message = `${field} already exists`;
    error = new ApiError(message, StatusCodes.CONFLICT);
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new ApiError(message, StatusCodes.BAD_REQUEST);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Invalid token', StatusCodes.UNAUTHORIZED);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token expired', StatusCodes.UNAUTHORIZED);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new ApiError('File too large', StatusCodes.BAD_REQUEST);
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      error = new ApiError('Too many files', StatusCodes.BAD_REQUEST);
    } else {
      error = new ApiError(err.message, StatusCodes.BAD_REQUEST);
    }
  }

  // If not an ApiError, convert to InternalServerError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(message, statusCode, false, err.stack);
  }

  return error;
};

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = convertToApiError(err);

  // Log error
  logger.logError(error, req);

  // Prepare error response
  const response = {
    status: error.status,
    message: error.message,
    ...(config.env === 'development' && {
      stack: error.stack,
      error: err,
    }),
  };

  // Add validation errors if present
  if (error.errors) {
    response.errors = error.errors;
  }

  // Send response
  res.status(error.statusCode).json(response);
};

/**
 * Handle 404 errors
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    `Route ${req.originalUrl} not found`,
    StatusCodes.NOT_FOUND
  );
  next(error);
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};

// Made with Bob
