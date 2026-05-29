// JWT token generation and validation utilities
const jwt = require('jsonwebtoken');

// Every access / refresh / room token is signed with this secret. If it is
// missing — or still set to the old hardcoded default that lived in this repo —
// anyone can forge a `type:'room'` token and bypass room-password auth. So we
// refuse to boot rather than run with a known/empty signing key.
const INSECURE_DEFAULTS = new Set([
  'change-me-in-production-use-strong-random-secret',
]);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || INSECURE_DEFAULTS.has(JWT_SECRET) || JWT_SECRET.length < 32) {
  console.error(
    '[FATAL] JWT_SECRET is missing, too short, or still using the insecure default.\n' +
    '        Set a strong JWT_SECRET (>= 32 chars of high-entropy randomness) in the\n' +
    '        environment before starting the bridge-server. Generate one with:\n' +
    '          node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"'
  );
  process.exit(1);
}
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

