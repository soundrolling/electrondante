// Simple in-memory rate limiting middleware
// For production, consider using Redis-based rate limiting

const rateLimitStore = new Map();

/**
 * Create rate limit middleware
 * @param {Object} options - { windowMs, maxRequests, keyGenerator }
 */
function createRateLimit(options) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 5,
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit entry
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);

    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }

    // Check if limit exceeded
    if (requests.length >= maxRequests) {
      const retryAfter = Math.ceil((requests[0] + windowMs - now) / 1000);
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    // Add current request
    requests.push(now);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requests.length));
    res.setHeader('X-RateLimit-Reset', new Date(requests[0] + windowMs).toISOString());

    next();
  };
}

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [key, requests] of rateLimitStore.entries()) {
    // Remove entries older than maxAge
    const filtered = requests.filter((timestamp) => now - timestamp < maxAge);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = {
  createRateLimit,
};

