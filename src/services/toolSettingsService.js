// src/services/toolSettingsService.js
// Service for saving and loading tool settings using IndexedDB

import { openDB } from '@/utils/indexedDB'

const STORE_NAME = 'tool_settings'

// Ensure the store exists
async function ensureStore() {
  const db = await openDB()
  // The store should be created in the upgrade handler in indexedDB.js
  // If it doesn't exist, we'll fall back to localStorage
  return db
}

/**
 * Save tool settings to IndexedDB
 * @param {string} toolRoute - The route/identifier for the tool
 * @param {string} userId - The user ID
 * @param {object} settings - The settings object to save
 */
export async function saveToolSettings(toolRoute, userId, settings) {
  try {
    const db = await ensureStore()
    
    // Check if store exists, if not, we'll use a fallback
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      // Fallback to localStorage if store doesn't exist
      const key = `tool_settings_${toolRoute}_${userId}`
      localStorage.setItem(key, JSON.stringify({ settings, updatedAt: Date.now() }))
      return
    }
    
    const tx = db.transaction([STORE_NAME], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const key = `${toolRoute}_${userId}`
    
    await store.put({
      id: key,
      toolRoute,
      userId,
      settings,
      updatedAt: Date.now()
    })
    
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    console.warn('Error saving tool settings:', error)
    // Fallback to localStorage
    const key = `tool_settings_${toolRoute}_${userId}`
    localStorage.setItem(key, JSON.stringify({ settings, updatedAt: Date.now() }))
  }
}

/**
 * Get tool settings from IndexedDB
 * @param {string} toolRoute - The route/identifier for the tool
 * @param {string} userId - The user ID
 * @returns {Promise<object|null>} The saved settings or null
 */
export async function getToolSettings(toolRoute, userId) {
  try {
    const db = await ensureStore()
    const key = `${toolRoute}_${userId}`
    
    // Check if store exists
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      // Fallback to localStorage
      const storageKey = `tool_settings_${toolRoute}_${userId}`
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        return JSON.parse(stored)
      }
      return null
    }
    
    const tx = db.transaction([STORE_NAME], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => {
        resolve(req.result || null)
      }
      req.onerror = () => {
        // Fallback to localStorage
        const storageKey = `tool_settings_${toolRoute}_${userId}`
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          resolve(JSON.parse(stored))
        } else {
          resolve(null)
        }
      }
    })
  } catch (error) {
    console.warn('Error loading tool settings:', error)
    // Fallback to localStorage
    const storageKey = `tool_settings_${toolRoute}_${userId}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      return JSON.parse(stored)
    }
    return null
  }
}

