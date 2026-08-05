const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiResponse = require('../utils/response');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * GET /users/me
 * Auth — return current user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new NotFoundError('User not found');
  return ApiResponse.success(res, user);
});

/**
 * PATCH /users/me
 * Auth — update profile fields (name, bio, location, timezone, phone)
 */
const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['firstName', 'lastName', 'bio', 'location', 'timezone', 'phone', 'avatar'];
  const updates = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new NotFoundError('User not found');

  return ApiResponse.success(res, user, 'Profile updated');
});

/**
 * PATCH /users/me/password
 * Auth — change password (requires current password)
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new BadRequestError('currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    throw new BadRequestError('New password must be at least 8 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new NotFoundError('User not found');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new UnauthorizedError('Current password is incorrect');

  user.password = newPassword;
  await user.save();

  // Invalidate all existing refresh tokens after password change
  user.refreshTokens = [];
  await user.save();

  logger.logAuth('password_changed', user._id);

  return ApiResponse.success(res, null, 'Password changed successfully');
});

/**
 * PATCH /users/me/preferences
 * Auth — update notification and theme preferences
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const { notifications, language, theme } = req.body;
  const updates = {};

  if (notifications) {
    if (notifications.email !== undefined) updates['preferences.notifications.email'] = notifications.email;
    if (notifications.push !== undefined) updates['preferences.notifications.push'] = notifications.push;
    if (notifications.sms !== undefined) updates['preferences.notifications.sms'] = notifications.sms;
  }
  if (language) updates['preferences.language'] = language;
  if (theme) updates['preferences.theme'] = theme;

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });
  if (!user) throw new NotFoundError('User not found');

  return ApiResponse.success(res, user.preferences, 'Preferences updated');
});

/**
 * DELETE /users/me
 * Auth — soft-delete own account
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) throw new BadRequestError('Password is required to delete account');

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new UnauthorizedError('Incorrect password');

  await user.softDelete();

  // Blacklist current token
  if (req.token) {
    await redisClient.set(`blacklist:${req.token}`, '1', 'EX', 60 * 60 * 24);
  }

  logger.logAuth('account_deleted', user._id);

  return ApiResponse.noContent(res);
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  updatePreferences,
  deleteAccount,
};

// Made with Bob
