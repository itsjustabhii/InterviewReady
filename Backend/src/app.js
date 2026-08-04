const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const { bookingRouter, availabilityRouter } = require('./routes/bookingRoutes');

// Create Express app
const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors(config.cors));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// HTTP request logger
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// API rate limiting
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// API routes
app.use(`/api/${config.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.apiVersion}/bookings`, bookingRouter);
app.use(`/api/${config.apiVersion}/availability`, availabilityRouter);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to InterviewReady API',
    version: config.apiVersion,
    documentation: '/api/docs',
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;

// Made with Bob
