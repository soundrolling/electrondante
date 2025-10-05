// This file is copied at build, but on Vercel we need a public root copy too.
// Delegate to the generated/injected service worker in /service-worker.js if present.

try {
  importScripts('/service-worker.js');
} catch (e) {
  // If import fails, provide a minimal no-op worker to satisfy registration
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
}


