// PWA Service - Handles installation, updates, and offline functionality
class PWAService {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.updateAvailable = false;
    this.swRegistration = null;
    
    this.init();
  }

  async init() {
    // Check if already installed
    this.checkInstallationStatus();
    
    // Register service worker
    await this.registerServiceWorker();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check for updates
    this.checkForUpdates();
  }

  checkInstallationStatus() {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
    }
    
    // Check for iOS standalone mode
    if (window.navigator.standalone === true) {
      this.isInstalled = true;
    }
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        
        console.log('Service Worker registered successfully:', this.swRegistration);
        
        // Listen for updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.updateAvailable = true;
              this.notifyUpdateAvailable();
            }
          });
        });
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  setupEventListeners() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.notifyInstallAvailable();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notifyInstalled();
    });

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyOnlineStatus(false);
    });

    // Listen for service worker messages
    navigator.serviceWorker?.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event.data);
    });
  }

  async installPWA() {
    if (!this.deferredPrompt) {
      throw new Error('Install prompt not available');
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log(`User ${outcome} the install prompt`);
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error installing PWA:', error);
      throw error;
    }
  }

  async updatePWA() {
    if (!this.swRegistration || !this.updateAvailable) {
      throw new Error('No update available');
    }

    try {
      // Skip waiting and reload
      if (this.swRegistration.waiting) {
        this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error('Error updating PWA:', error);
      throw error;
    }
  }

  checkForUpdates() {
    if (this.swRegistration) {
      this.swRegistration.update();
    }
  }

  // Notification methods (to be implemented by components)
  notifyInstallAvailable() {
    // This will be overridden by components that need to show install UI
    console.log('PWA install available');
  }

  notifyInstalled() {
    // This will be overridden by components that need to show installed UI
    console.log('PWA installed successfully');
  }

  notifyUpdateAvailable() {
    // This will be overridden by components that need to show update UI
    console.log('PWA update available');
  }

  notifyOnlineStatus(isOnline) {
    // This will be overridden by components that need to show online status
    console.log('PWA online status:', isOnline);
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'CACHE_UPDATED':
        console.log('Cache updated:', data.payload);
        break;
      case 'SYNC_COMPLETE':
        console.log('Background sync complete:', data.payload);
        break;
      case 'OFFLINE_ACTION_QUEUED':
        console.log('Offline action queued:', data.payload);
        break;
      default:
        console.log('Unknown service worker message:', data);
    }
  }

  // Utility methods
  canInstall() {
    try {
      return !this.isInstalled && this.deferredPrompt !== null;
    } catch (error) {
      console.error('Error checking canInstall:', error);
      return false;
    }
  }

  hasUpdate() {
    try {
      return this.updateAvailable;
    } catch (error) {
      console.error('Error checking hasUpdate:', error);
      return false;
    }
  }

  isOnline() {
    try {
      return this.isOnline;
    } catch (error) {
      console.error('Error checking isOnline:', error);
      return navigator.onLine;
    }
  }

  // Cache management
  async clearCache() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    }
  }

  async getCacheSize() {
    if (!('caches' in window)) return 0;
    
    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return totalSize;
  }

  // Background sync
  async registerBackgroundSync(tag, data) {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      
      // Store data for background sync
      if (data) {
        await this.storeOfflineData(tag, data);
      }
    }
  }

  async storeOfflineData(tag, data) {
    // Store in IndexedDB for background sync
    const db = await this.openIndexedDB();
    const transaction = db.transaction(['offlineActions'], 'readwrite');
    const store = transaction.objectStore('offlineActions');
    
    await store.add({
      tag,
      data,
      timestamp: Date.now()
    });
  }

  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PWACache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('offlineActions')) {
          db.createObjectStore('offlineActions', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }
}

// Create singleton instance
const pwaService = new PWAService();

export default pwaService;
