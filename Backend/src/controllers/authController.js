const crypto = require('crypto');
const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const ApiResponse = require('../utils/response');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Register new user
 */
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new BadRequestError('Email already registered');
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
  });

  // Generate email verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // TODO: Send verification email
  logger.info(`Verification token for ${email}: ${verificationToken}`);

  // Generate tokens
  const tokens = generateTokens({ userId: user._id, role: user.role });

  // Save refresh token
  await user.addRefreshToken(tokens.refreshToken, 7 * 24 * 60 * 60 * 1000);

  logger.logAuth('register', user._id, { email });

  ApiResponse.created(res, {
    user,
    tokens,
  }, 'Registration successful. Please verify your email.');
});

/**
 * Login user
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if account is locked
  if (user.isLocked) {
    throw new UnauthorizedError(
      'Account is locked due to multiple failed login attempts. Please try again later.'
    );
  }

  // Check if account is active
  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incLoginAttempts();
    throw new UnauthorizedError('Invalid email or password');
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const tokens = generateTokens({ userId: user._id, role: user.role });

  // Save refresh token
  await user.addRefreshToken(tokens.refreshToken, 7 * 24 * 60 * 60 * 1000);

  // Remove password from response
  user.password = undefined;

  logger.logAuth('login', user._id, { email });

  ApiResponse.success(res, {
    user,
    tokens,
  }, 'Login successful');
});

/**
 * Logout user
 */
exports.logout = asyncHandler(async (req, res) => {
  const { token } = req;
  const user = req.user;

  // Add token to blacklist
  await redisClient.set(`blacklist:${token}`, '1', 60 * 15); // 15 minutes

  // Remove refresh token
  if (req.body.refreshToken) {
    await user.removeRefreshToken(req.body.refreshToken);
  }

  logger.logAuth('logout', user._id);

  ApiResponse.success(res, null, 'Logout successful');
});

/**
 * Refresh access token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError('Refresh token is required');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Find user
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Check if refresh token exists in user's tokens
  const tokenExists = user.refreshTokens.some(
    (rt) => rt.token === refreshToken && rt.expiresAt > Date.now()
  );

  if (!tokenExists) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Generate new tokens
  const tokens = generateTokens({ userId: user._id, role: user.role });

  // Remove old refresh token and add new one
  await user.removeRefreshToken(refreshToken);
  await user.addRefreshToken(tokens.refreshToken, 7 * 24 * 60 * 60 * 1000);

  logger.logAuth('token_refresh', user._id);

  ApiResponse.success(res, { tokens }, 'Token refreshed successfully');
});

/**
 * Get current user
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  ApiResponse.success(res, { user }, 'User retrieved successfully');
});

/**
 * Verify email
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Hash the token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired verification token');
  }

  // Update user
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  logger.logAuth('email_verified', user._id);

  ApiResponse.success(res, null, 'Email verified successfully');
});

/**
 * Resend verification email
 */
exports.resendVerificationEmail = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.isEmailVerified) {
    throw new BadRequestError('Email is already verified');
  }

  // Generate new verification token
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // TODO: Send verification email
  logger.info(`Verification token for ${user.email}: ${verificationToken}`);

  logger.logAuth('verification_email_resent', user._id);

  ApiResponse.success(res, null, 'Verification email sent successfully');
});

/**
 * Forgot password
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists
    ApiResponse.success(
      res,
      null,
      'If the email exists, a password reset link has been sent'
    );
    return;
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save();

  // TODO: Send password reset email
  logger.info(`Password reset token for ${email}: ${resetToken}`);

  logger.logAuth('password_reset_requested', user._id);

  ApiResponse.success(
    res,
    null,
    'If the email exists, a password reset link has been sent'
  );
});

/**
 * Reset password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash the token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new BadRequestError('Invalid or expired reset token');
  }

  // Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.logAuth('password_reset', user._id);

  ApiResponse.success(res, null, 'Password reset successful');
});

/**
 * Change password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.logAuth('password_changed', user._id);

  ApiResponse.success(res, null, 'Password changed successfully');
});

/**
 * Update profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = ['firstName', 'lastName', 'phone', 'bio', 'location', 'timezone', 'avatar'];
  const updates = {};

  Object.keys(req.body).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  logger.logAuth('profile_updated', user._id);

  ApiResponse.success(res, { user }, 'Profile updated successfully');
});

/**
 * Delete account
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const user = req.user;

  // Soft delete - deactivate account
  user.isActive = false;
  await user.save();

  logger.logAuth('account_deleted', user._id);

  ApiResponse.success(res, null, 'Account deleted successfully');
});

// Made with Bob
