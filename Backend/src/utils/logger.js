const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports array
const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format: config.env === 'development' ? consoleFormat : logFormat,
    level: config.logging.level,
  })
);

// File transports (only in production or if explicitly enabled)
if (config.env === 'production' || config.logging.file.enabled) {
  // All logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(config.logging.file.dirname, config.logging.file.filename),
      datePattern: config.logging.file.datePattern,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      format: logFormat,
      level: config.logging.level,
    })
  );

  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: path.join(config.logging.file.dirname, 'error-%DATE%.log'),
      datePattern: config.logging.file.datePattern,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
      format: logFormat,
      level: 'error',
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Helper methods for structured logging
logger.logRequest = (req, message = 'Incoming request') => {
  logger.info(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });
};

logger.logResponse = (req, res, responseTime) => {
  logger.info('Outgoing response', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id,
  });
};

logger.logError = (error, req = null) => {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    name: error.name,
  };

  if (req) {
    errorLog.method = req.method;
    errorLog.url = req.originalUrl;
    errorLog.ip = req.ip;
    errorLog.userId = req.user?.id;
  }

  logger.error('Application error', errorLog);
};

logger.logDatabase = (operation, collection, details = {}) => {
  logger.debug('Database operation', {
    operation,
    collection,
    ...details,
  });
};

logger.logAuth = (action, userId, details = {}) => {
  logger.info('Authentication event', {
    action,
    userId,
    ...details,
  });
};

logger.logPayment = (action, details = {}) => {
  logger.info('Payment event', {
    action,
    ...details,
  });
};

logger.logSocket = (event, socketId, details = {}) => {
  logger.debug('Socket.IO event', {
    event,
    socketId,
    ...details,
  });
};

// Handle uncaught exceptions and unhandled rejections
if (config.env === 'production') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: path.join(config.logging.file.dirname, 'exceptions-%DATE%.log'),
      datePattern: config.logging.file.datePattern,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: path.join(config.logging.file.dirname, 'rejections-%DATE%.log'),
      datePattern: config.logging.file.datePattern,
      maxSize: config.logging.file.maxSize,
      maxFiles: config.logging.file.maxFiles,
    })
  );
}

module.exports = logger;

// Made with Bob
