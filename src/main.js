// src/main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import '@fortawesome/fontawesome-free/css/all.css';

// VueFlow imports
import { VueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import './index.css';

import Toast, { POSITION } from 'vue-toastification';
import 'vue-toastification/dist/index.css';

import { useUserStore } from './stores/userStore';
import { useThemeStore } from './stores/themeStore';
import { saveSetting } from './utils/indexedDB';
import { syncOfflineChanges } from './services/syncService'; // ✅ Centralized sync

import { restoreSessionFromUrl } from './supabase';

// Capture console errors for bug reports
window.consoleErrors = []
const originalError = console.error
console.error = function(...args) {
  window.consoleErrors.push({
    message: args.join(' '),
    timestamp: new Date().toISOString(),
    stack: new Error().stack
  })
  originalError.apply(console, args)
}

async function bootstrap() {
  if (typeof window !== 'undefined') {
    await restoreSessionFromUrl();
  }

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);

  // Initialize theme store early to prevent FOUC
  const themeStore = useThemeStore(pinia);
  themeStore.initialize();

  // ← register the named export here
  app.use(VueFlow);

  app.use(Toast, {
    position: POSITION.TOP_RIGHT,
    timeout: 5000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    draggablePercent: 0.6,
    showCloseButtonOnHover: false,
    hideProgressBar: false,
    closeButton: 'button',
    icon: true,
    rtl: false
  });

  const userStore = useUserStore(pinia);
  await userStore.initializeStore();

  const currentProjectId = userStore.getCurrentProject?.id;
  if (currentProjectId) {
    await saveSetting('current-project-id', currentProjectId);
  }

  app.mount('#app');

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered successfully:', registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    });
  }

  window.addEventListener('online', async () => {
    console.log('App is online; syncing offline changes...');
    await syncOfflineChanges(true);
  });

  window.addEventListener('offline', () => {
    console.log('App is offline');
  });
}

bootstrap();