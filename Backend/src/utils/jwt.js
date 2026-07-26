const jwt = require('jsonwebtoken');
const config = require('../config');
const { TokenError } = require('./errors');

/**
 * Generate access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTokenExpire,
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTokenExpire,
  });
};

/**
 * Generate both tokens
 */
const generateTokens = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new TokenError('Access token expired');
    }
    throw new TokenError('Invalid access token');
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new TokenError('Refresh token expired');
    }
    throw new TokenError('Invalid refresh token');
  }
};

/**
 * Decode token without verification
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Generate email verification token
 */
const generateEmailVerificationToken = (email) => {
  return jwt.sign({ email, type: 'email_verification' }, config.jwt.secret, {
    expiresIn: '24h',
  });
};

/**
 * Generate password reset token
 */
const generatePasswordResetToken = (userId) => {
  return jwt.sign({ userId, type: 'password_reset' }, config.jwt.secret, {
    expiresIn: '1h',
  });
};

/**
 * Verify email verification token
 */
const verifyEmailVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'email_verification') {
      throw new TokenError('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new TokenError('Invalid or expired verification token');
  }
};

/**
 * Verify password reset token
 */
const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'password_reset') {
      throw new TokenError('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new TokenError('Invalid or expired reset token');
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
};

// Made with Bob
