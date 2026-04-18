// src/services/queryCache.js
// Stale-while-revalidate read cache backed by IndexedDB.
// Serves cached data immediately on navigation, refreshes in the background,
// and calls onUpdate(freshData) when the network response arrives.
//
// Bump CACHE_VERSION to invalidate all cached entries across users.

import { openDB, waitForTransaction } from '@/utils/indexedDB'

const STORE = 'query_cache'
const CACHE_VERSION = 'v1'
export const DEFAULT_TTL = 5 * 60 * 1000  // 5 minutes

function vk(key) {
  return `${CACHE_VERSION}:${key}`
}

async function idbGet(key) {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(STORE)) return null
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(vk(key))
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function idbSet(key, data, ttl) {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(STORE)) return
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ key: vk(key), data, cachedAt: Date.now(), ttl })
    // fire-and-forget — don't await so we never block the caller
    waitForTransaction(tx).catch(() => {})
  } catch {
    // cache writes are best-effort
  }
}

async function _revalidate(key, queryFn, ttl, onUpdate) {
  try {
    const data = await queryFn()
    if (data != null) {
      idbSet(key, data, ttl)  // fire-and-forget
      onUpdate?.(data)
    }
  } catch (e) {
    console.warn('[queryCache] background revalidate failed:', key, e?.message)
  }
}

/**
 * Stale-while-revalidate cached fetch.
 *
 * On cache hit (fresh or stale): returns cached data immediately AND
 * fires queryFn in the background. Calls onUpdate(freshData) when the
 * fresh response arrives so the UI can update reactively.
 *
 * On cache miss (no entry): awaits queryFn directly (blocking), writes
 * result to cache, returns it.
 *
 * @param {string} key           Unique cache key (scoped per user by convention)
 * @param {() => Promise<any>}   queryFn  Async function returning fresh data
 * @param {object} [options]
 * @param {number} [options.ttl=300000]  TTL in ms before data is considered stale
 * @param {boolean} [options.force=false]  Skip cache, always await fresh data
 * @param {(data: any) => void} [options.onUpdate]  Called with fresh data after bg fetch
 * @returns {Promise<{ data: any, fromCache: boolean }>}
 */
export async function cachedFetch(key, queryFn, { ttl = DEFAULT_TTL, force = false, onUpdate } = {}) {
  if (!force) {
    const entry = await idbGet(key)
    if (entry) {
      const age = Date.now() - entry.cachedAt
      const isStale = age > (entry.ttl ?? ttl)
      // Return immediately (stale or fresh), always revalidate in background
      _revalidate(key, queryFn, ttl, onUpdate)
      return { data: entry.data, fromCache: true, stale: isStale }
    }
  }

  // No cache or force: block on network
  const data = await queryFn()
  if (data != null) idbSet(key, data, ttl)
  return { data, fromCache: false, stale: false }
}

/**
 * Write data directly into the cache (e.g. after an optimistic UI mutation).
 * Keeps the cache consistent so the next navigation shows updated data instantly.
 */
export async function setCachedQuery(key, data, ttl = DEFAULT_TTL) {
  return idbSet(key, data, ttl)
}

/**
 * Delete a single cache entry. Call this after mutations to ensure
 * the next navigation gets fresh data.
 */
export async function invalidateCachedQuery(key) {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(STORE)) return
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(vk(key))
    await waitForTransaction(tx)
  } catch {
    // best-effort
  }
}

/**
 * Delete all query_cache entries (e.g. on sign-out).
 */
export async function clearQueryCache() {
  try {
    const db = await openDB()
    if (!db.objectStoreNames.contains(STORE)) return
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    await waitForTransaction(tx)
  } catch {
    // best-effort
  }
}
