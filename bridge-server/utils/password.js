// Password hashing and validation utilities
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Hash a password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Returns { valid: boolean, error?: string }
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  // Basic entropy check - at least some variety
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  // Require at least 2 of: letter, number, special
  const varietyCount = [hasLetter, hasNumber, hasSpecial].filter(Boolean).length;
  if (varietyCount < 2) {
    return {
      valid: false,
      error: 'Password must contain at least letters and numbers, or special characters',
    };
  }

  return { valid: true };
}

/**
 * Generate a random room code (6 characters, alphanumeric)
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    // crypto.randomInt is uniform and unpredictable (Math.random is neither,
    // and these codes gate room access).
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateRoomCode,
  MIN_PASSWORD_LENGTH,
};

