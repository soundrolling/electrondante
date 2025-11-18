// JWT token generation and validation utilities
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-use-strong-random-secret';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const ROOM_TOKEN_EXPIRY = '24h'; // 24 hours

/**
 * Generate access token (short-lived, 15 minutes)
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate refresh token (long-lived, 7 days)
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      ...payload,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Generate room access token (bound to specific roomId)
 */
function generateRoomToken(roomId, userId = null) {
  return jwt.sign(
    {
      roomId,
      userId,
      type: 'room',
    },
    JWT_SECRET,
    { expiresIn: ROOM_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateRoomToken,
  verifyToken,
  extractTokenFromHeader,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  ROOM_TOKEN_EXPIRY,
};

