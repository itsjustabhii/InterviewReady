const Joi = require('joi');
const { ValidationError } = require('./errors');

/**
 * Validate request data against Joi schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    };

    const { error, value } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      validationOptions
    );

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return next(new ValidationError(errors));
    }

    // Replace request data with validated data
    req.body = value.body || req.body;
    req.query = value.query || req.query;
    req.params = value.params || req.params;

    return next();
  };
};

/**
 * Common validation schemas
 */
const commonSchemas = {
  // MongoDB ObjectId
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format'),

  // Email
  email: Joi.string().email().lowercase().trim(),

  // Password
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Phone number
  phone: Joi.string().pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/),

  // URL
  url: Joi.string().uri(),

  // Date
  date: Joi.date().iso(),

  // Pagination
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string(),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  },

  // Search
  search: Joi.string().trim().min(1).max(100),

  // Status
  status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled'),

  // Role
  role: Joi.string().valid('user', 'interviewer', 'admin'),

  // Rating
  rating: Joi.number().min(1).max(5),

  // Amount
  amount: Joi.number().positive(),

  // Boolean
  boolean: Joi.boolean(),

  // Array of ObjectIds
  objectIdArray: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
};

/**
 * Sanitize input to prevent XSS
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '')
      .trim();
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};

/**
 * Validate file upload
 */
const validateFileUpload = (allowedTypes, maxSize) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      // Check file type
      if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
        return next(
          new ValidationError(
            `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
          )
        );
      }

      // Check file size
      if (maxSize && file.size > maxSize) {
        return next(
          new ValidationError(
            `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`
          )
        );
      }
    }

    return next();
  };
};

module.exports = {
  validate,
  commonSchemas,
  sanitizeInput,
  validateFileUpload,
};

// Made with Bob
