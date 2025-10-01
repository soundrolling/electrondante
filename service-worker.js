/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'

// Build-time injected constants
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const CACHE_NAME = 'proapp-cache-v7'
const STATIC_CACHE = 'proapp-static-v7'
const DYNAMIC_CACHE = 'proapp-dynamic-v7'

const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/login',
  '/favcon.ico',
  '/manifest.json',
  '/img/icon-192x192.png',
  '/img/icon-512x512.png'
]

// Precache the workbox manifest plus our static URLs
precacheAndRoute(self.__WB_MANIFEST.concat(
  urlsToCache.map(u => ({ url: u, revision: null }))
))

// INSTALL
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Caching static assets')
      return cache.addAll(urlsToCache)
    }).then(() => {
      console.log('[SW] Static assets cached')
      return self.skipWaiting()
    })
  )
})

// ACTIVATE
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log('[SW] Service worker activated')
      return self.clients.claim()
    })
  )
})

// FETCH
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // HTML navigations → network first, fallback to offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // Return offline page for navigation requests
          return caches.match('/offline.html')
        })
    )
    return
  }

  // API requests → network first, no cache
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return a custom offline response for API calls
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          }
        )
      })
    )
    return
  }

  // Static assets → cache first, then network
  if (
    request.url.startsWith(self.location.origin) &&
    ['script', 'style', 'image', 'font', 'document'].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached
        }

        return fetch(request).then(response => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone)
            })
          }
          return response
        }).catch(() => {
          // Return a fallback for failed requests
          if (request.destination === 'image') {
            return new Response(
              '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image unavailable</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            )
          }
          throw new Error('Network request failed')
        })
      })
    )
    return
  }

  // Everything else → network first
  event.respondWith(fetch(request))
})

// MESSAGE HANDLER
self.addEventListener('message', event => {
  const { type, payload } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true })
      })
      break
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0]?.postMessage({ size })
      })
      break
    default:
      console.log('[SW] Unknown message type:', type)
  }
})

// CACHE MANAGEMENT
async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  )
  console.log('[SW] All caches cleared')
}

async function getCacheSize() {
  let totalSize = 0
  const cacheNames = await caches.keys()
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }
  
  return totalSize
}

// BACKGROUND SYNC
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-changes') {
    event.waitUntil(syncOfflineChanges())
  }
})

async function syncOfflineChanges() {
  console.log('[SW] Syncing offline notes…')
  try {
    const db    = await openIndexedDB()
    const tx    = db.transaction('offlineChanges','readwrite')
    const store = tx.objectStore('offlineChanges')
    const all   = await store.getAll()
    const keys  = await store.getAllKeys()

    const settingsDB  = await openSettingsStore()
    const settingTx   = settingsDB.transaction('settings','readonly')
    const settingStore= settingTx.objectStore('settings')
    const projectSetting = await settingStore.get('current-project-id')

    for (let i = 0; i < all.length; i++) {
      const change = all[i]
      const key    = keys[i]

      if (!change.data.project_id && projectSetting?.value) {
        change.data.project_id = projectSetting.value
      }

      const url = `${SUPABASE_URL}/rest/v1/${change.table}`
      await fetch(url, {
        method: change.operation === 'delete' ? 'DELETE' : 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (await getToken())
        },
        body: change.operation === 'delete' ? undefined : JSON.stringify(change.data)
      })

      store.delete(key)
      console.log('[SW] Synced', change)
    }

    await tx.done
  } catch (err) {
    console.error('[SW] syncOfflineChanges failed:', err)
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ProjectManagementDB', 6)
    req.onsuccess  = () => resolve(req.result)
    req.onerror    = () => reject(req.error)
  })
}

function openSettingsStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ProjectManagementDB', 6)
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('settings')) {
        db.close()
        return reject(new Error('No settings store'))
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

async function getToken() {
  const db    = await openIndexedDB()
  const tx    = db.transaction('settings','readonly')
  const store = tx.objectStore('settings')
  const entry = await store.get('supabase-token')
  return entry?.value || ''
}