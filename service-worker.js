/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'

// Build-time injected constants
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const CACHE_NAME = 'my-app-cache-v6'
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/login',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/app.js',
  '/js/chunk-vendors.js'
]

// Precache the workbox manifest plus our static URLs
precacheAndRoute(self.__WB_MANIFEST.concat(
  urlsToCache.map(u => ({ url: u, revision: null }))
))

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting()
})

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key =>
          key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()
        )
      )
    )
  )
  self.clients.claim()
})

// FETCH
self.addEventListener('fetch', event => {
  const { request } = event

  // HTML navigations → network first, fallback to offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Static assets → cache-then-network
  if (
    request.url.startsWith(self.location.origin) &&
    ['script','style','image','font','document'].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networked = fetch(request).then(response => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, response.clone())
          })
          return response
        })
        return cached || networked
      })
    )
    return
  }

  // Everything else → normal fetch
  event.respondWith(fetch(request))
})

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