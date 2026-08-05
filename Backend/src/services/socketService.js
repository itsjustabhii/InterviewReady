const socketIO = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');
const config = require('../config');
const signalingService = require('./signalingService');

class SocketService {
  constructor() {
    this.io = null;
    this.users = new Map(); // Map of userId to socketId
  }

  /**
   * Initialize Socket.IO
   */
  initialize(server) {
    this.io = socketIO(server, {
      cors: config.socketIO.cors,
      pingTimeout: config.socketIO.pingTimeout,
      pingInterval: config.socketIO.pingInterval,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    // Mount WebRTC signaling namespace
    signalingService.mount(this.io);

    logger.info('Socket.IO initialized');
  }

  /**
   * Setup authentication middleware
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify token
        const decoded = verifyAccessToken(token);

        // Get user
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
          return next(new Error('Invalid user'));
        }

        // Attach user to socket
        socket.userId = user._id.toString();
        socket.userRole = user.role;

        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;

      // Store user connection
      this.users.set(userId, socket.id);

      logger.logSocket('user_connected', socket.id, { userId });

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Join role-based room
      socket.join(`role:${socket.userRole}`);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.users.delete(userId);
        logger.logSocket('user_disconnected', socket.id, { userId });
      });

      // Handle custom events
      this.setupCustomEvents(socket);
    });
  }

  /**
   * Setup custom events
   */
  setupCustomEvents(socket) {
    const userId = socket.userId;

    // Join booking room
    socket.on('join_booking', (bookingId) => {
      socket.join(`booking:${bookingId}`);
      logger.logSocket('joined_booking', socket.id, { userId, bookingId });
    });

    // Leave booking room
    socket.on('leave_booking', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
      logger.logSocket('left_booking', socket.id, { userId, bookingId });
    });

    // Typing indicator
    socket.on('typing', (data) => {
      socket.to(`booking:${data.bookingId}`).emit('user_typing', {
        userId,
        bookingId: data.bookingId,
      });
    });

    // Stop typing indicator
    socket.on('stop_typing', (data) => {
      socket.to(`booking:${data.bookingId}`).emit('user_stop_typing', {
        userId,
        bookingId: data.bookingId,
      });
    });

    // Mark notification as read
    socket.on('notification_read', (notificationId) => {
      logger.logSocket('notification_read', socket.id, { userId, notificationId });
    });

    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Emit arbitrary event to a specific user (alias used by notificationController)
   */
  emitToUser(userId, event, data) {
    try {
      if (!this.io) return;
      this.io.to(`user:${userId}`).emit(event, data);
    } catch (error) {
      logger.error('Error emitting to user:', error);
    }
  }

  /**
   * Emit arbitrary event to a room (used by signalingService / sessionController)
   */
  emitToRoom(roomId, event, data) {
    try {
      if (!this.io) return;
      this.io.to(`room:${roomId}`).emit(event, data);
    } catch (error) {
      logger.error('Error emitting to room:', error);
    }
  }

  /**
   * Send notification to user
   */
  sendNotificationToUser(userId, notification) {
    try {
      this.io.to(`user:${userId}`).emit('notification', notification);
      logger.logSocket('notification_sent', null, { userId, type: notification.type });
    } catch (error) {
      logger.error('Error sending notification:', error);
    }
  }

  /**
   * Send notification to multiple users
   */
  sendNotificationToUsers(userIds, notification) {
    try {
      userIds.forEach((userId) => {
        this.sendNotificationToUser(userId, notification);
      });
    } catch (error) {
      logger.error('Error sending notifications to users:', error);
    }
  }

  /**
   * Send notification to role
   */
  sendNotificationToRole(role, notification) {
    try {
      this.io.to(`role:${role}`).emit('notification', notification);
      logger.logSocket('notification_sent_to_role', null, { role, type: notification.type });
    } catch (error) {
      logger.error('Error sending notification to role:', error);
    }
  }

  /**
   * Broadcast to all users
   */
  broadcast(event, data) {
    try {
      this.io.emit(event, data);
      logger.logSocket('broadcast', null, { event });
    } catch (error) {
      logger.error('Error broadcasting:', error);
    }
  }

  /**
   * Send booking update
   */
  sendBookingUpdate(bookingId, update) {
    try {
      this.io.to(`booking:${bookingId}`).emit('booking_update', update);
      logger.logSocket('booking_update_sent', null, { bookingId, status: update.status });
    } catch (error) {
      logger.error('Error sending booking update:', error);
    }
  }

  /**
   * Send payment update
   */
  sendPaymentUpdate(userId, payment) {
    try {
      this.io.to(`user:${userId}`).emit('payment_update', payment);
      logger.logSocket('payment_update_sent', null, { userId, status: payment.status });
    } catch (error) {
      logger.error('Error sending payment update:', error);
    }
  }

  /**
   * Send interview reminder
   */
  sendInterviewReminder(userId, booking) {
    try {
      this.io.to(`user:${userId}`).emit('interview_reminder', {
        bookingId: booking._id,
        scheduledDate: booking.scheduledDate,
        startTime: booking.startTime,
        meetingLink: booking.meetingLink,
      });
      logger.logSocket('interview_reminder_sent', null, { userId, bookingId: booking._id });
    } catch (error) {
      logger.error('Error sending interview reminder:', error);
    }
  }

  /**
   * Send subscription expiry warning
   */
  sendSubscriptionExpiryWarning(userId, subscription) {
    try {
      this.io.to(`user:${userId}`).emit('subscription_expiry_warning', {
        subscriptionId: subscription._id,
        endDate: subscription.endDate,
        daysRemaining: subscription.daysRemaining,
      });
      logger.logSocket('subscription_expiry_warning_sent', null, { userId });
    } catch (error) {
      logger.error('Error sending subscription expiry warning:', error);
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.users.has(userId);
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return this.users.size;
  }

  /**
   * Get online users
   */
  getOnlineUsers() {
    return Array.from(this.users.keys());
  }

  /**
   * Disconnect user
   */
  disconnectUser(userId) {
    try {
      const socketId = this.users.get(userId);
      if (socketId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          logger.logSocket('user_force_disconnected', socketId, { userId });
        }
      }
    } catch (error) {
      logger.error('Error disconnecting user:', error);
    }
  }

  /**
   * Get Socket.IO instance
   */
  getIO() {
    if (!this.io) {
      throw new Error('Socket.IO not initialized');
    }
    return this.io;
  }
}

module.exports = new SocketService();

// Made with Bob
