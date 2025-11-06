// src/services/cacheService.js
// Simple in-memory cache with TTL and invalidation support

const cache = new Map();
const DEFAULT_TTL = 30000; // 30 seconds default TTL

/**
 * Generate a cache key from table name and project ID
 */
function getCacheKey(table, projectId, extra = '') {
  return `${table}:${projectId}${extra ? `:${extra}` : ''}`;
}

/**
 * Get cached data if valid
 */
export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cached data with optional TTL
 */
export function setCached(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });
}

/**
 * Invalidate cache for a specific key or pattern
 */
export function invalidateCache(keyOrPattern) {
  if (keyOrPattern.includes('*')) {
    // Pattern matching - remove all matching keys
    const pattern = keyOrPattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
      }
    }
  } else {
    // Exact match
    cache.delete(keyOrPattern);
  }
}

/**
 * Invalidate all cache entries for a project
 */
export function invalidateProjectCache(projectId) {
  for (const key of cache.keys()) {
    if (key.includes(`:${projectId}:`) || key.endsWith(`:${projectId}`)) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate cache for a specific table and project
 */
export function invalidateTableCache(table, projectId) {
  const pattern = getCacheKey(table, projectId, '*');
  invalidateCache(pattern);
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  const stats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    entries: []
  };
  
  for (const [key, entry] of cache.entries()) {
    stats.entries.push({
      key,
      expiresAt: new Date(entry.expiresAt).toISOString(),
      isExpired: Date.now() > entry.expiresAt
    });
  }
  
  return stats;
}

