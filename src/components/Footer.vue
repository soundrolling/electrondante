<template>
<footer v-if="!isHiddenRoute" class="footer">
  <div class="container">
    <div class="footer-columns">
      <!-- Top row: Combined Timecode and Time Source Selector -->
      <div class="footer-card timecode-timesource-card">
        <div class="timecode-timesource-flex">
          <div class="timecode-section">
            <h3 class="card-title">Timecode</h3>
            <div class="timecode-display">
              <p class="timecode">{{ liveTimecode }}</p>
              <p class="time-source">{{ currentTimeSourceLabel }}</p>
            </div>
          </div>
          <div class="timesource-section">
            <h3 class="card-title">Select Time Source:</h3>
            <TimeSourceSelector />
          </div>
        </div>
      </div>
      <!-- Bottom row: Session | Storage/App -->
      <div class="footer-card session-card">
        <h3 class="card-title">Session</h3>
        <div class="compact-user-info">
          <span v-if="userEmail" class="user-email">
            {{ userEmail }} <span v-if="isAdmin" class="admin-badge">A</span>
          </span>
          <span v-else class="guest-text">Guest</span>
        </div>
        <button
          v-if="userEmail"
          @click="emitSignOut"
          class="btn secondary-btn"
        >
          Sign Out
        </button>
      </div>
      <div class="footer-card storage-app-card">
        <h3 class="card-title">Storage</h3>
        <div class="storage-display">
          <div class="usage-details">
            <span class="usage-text">{{ localStorageUsage.used }} / {{ localStorageUsage.max }} KB</span>
            <span
              class="usage-indicator"
              :class="{ 'high-usage': usagePercentage > 80 }"
            >
              {{ Math.round(usagePercentage) }}%
            </span>
          </div>
          <div class="usage-bar">
            <div
              class="usage-fill"
              :style="usageFillStyle"
              :class="{ 'high-usage': usagePercentage > 80 }"
            ></div>
          </div>
          <div class="storage-actions">
            <button @click="confirmAndClearCache" class="btn warning-btn">
              Clear Cache
            </button>
          </div>
        </div>
        <div class="section-divider"></div>
        <h3 class="card-title">App</h3>
        <div v-if="isPWAInstalled" class="app-status">
          <p class="app-status-text">App is installed on your device.</p>
        </div>
        <div v-else class="app-install">
          <button
            v-if="deferredPrompt"
            @click="installPWA"
            class="btn install-btn"
          >
            Install App
          </button>
          <span v-else class="install-unavailable">
            Install prompt unavailable
          </span>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="copyright-text">&copy; {{ currentYear }} Soundrolling Notes</p>
  </div>
</footer>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import TimeSourceSelector from './TimeSourceSelector.vue';
import { useUserStore } from '@/stores/userStore';

// Define props
const props = defineProps({
liveTimecode: { type: String, required: true },
currentTimeSourceLabel: { type: String, required: true },
localStorageUsage: { type: Object, required: true },
userEmail: { type: String, default: null },
isAdmin: { type: Boolean, default: false },
});

// Define emits
const emit = defineEmits(['clearCache', 'signOut']);

// Hide the footer on specific routes
const route = useRoute();
const HIDDEN_ROUTES = ['/', '/auth/reset-password', '/auth/set-password'];
const isHiddenRoute = computed(() => HIDDEN_ROUTES.includes(route.path));

// Usage percentage for local storage
const usagePercentage = computed(() => {
const { used, max } = props.localStorageUsage;
return max > 0 ? (used / max) * 100 : 0;
});

// Style for usage bar fill
const usageFillStyle = computed(() => ({
width: `${usagePercentage.value}%`,
}));

// Current year
const currentYear = new Date().getFullYear();

// Handle PWA install prompt
const deferredPrompt = ref(null);
const isPWAInstalled = ref(false);

const installPWA = async () => {
if (deferredPrompt.value) {
  deferredPrompt.value.prompt();
  const { outcome } = await deferredPrompt.value.userChoice;
  console.log(
    outcome === 'accepted'
      ? 'User accepted the install prompt'
      : 'User dismissed the install prompt'
  );
  deferredPrompt.value = null;
}
};

// Detect if PWA is already installed
const checkPWAInstalled = () => {
// For most browsers
if (window.matchMedia('(display-mode: standalone)').matches) {
  isPWAInstalled.value = true;
}
// For iOS Safari
if (window.navigator.standalone === true) {
  isPWAInstalled.value = true;
}
};

const handleBeforeInstallPrompt = (e) => {
e.preventDefault();
deferredPrompt.value = e;
};

// Emit helpers
const confirmAndClearCache = () => {
if (window.confirm('Are you sure you want to clear the cache?')) {
  emit('clearCache');
}
};

const emitSignOut = () => emit('signOut');

// Lifecycle
onMounted(() => {
window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
window.addEventListener('appinstalled', () => {
  isPWAInstalled.value = true;
  deferredPrompt.value = null;
});
checkPWAInstalled();
});

onUnmounted(() => {
window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
window.removeEventListener('appinstalled', () => {
  isPWAInstalled.value = true;
});
});
</script>

<style scoped>
/* Base Styles - Mobile First */
.footer {
  background-color: #ffffff;
  color: #1a1a1a;
  border-top: 1px solid #e9ecef;
  padding: 8px 0 0 0;
  font-size: 14px;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* Wrapper */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 12px;
}

/* Grid for Cards */
.footer-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

/* Card Layout - Shared */
.footer-card {
  background-color: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  padding: 12px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.footer-card:hover {
  background-color: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Card Heading */
.card-title {
  margin: 0 0 8px;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 6px;
}

/* Button Shared Styling */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  margin-top: 8px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: scale(0.98);
}

.secondary-btn {
  background-color: #6c757d;
  color: #ffffff;
}

.secondary-btn:hover {
  background-color: #5a6268;
}

.warning-btn {
  background-color: #f59e0b;
  color: #ffffff;
}

.warning-btn:hover {
  background-color: #d97706;
}

.install-btn {
  background-color: #10b981;
  color: #ffffff;
}

.install-btn:hover {
  background-color: #059669;
}

/* Timecode Card Specific */
.timecode-timesource-flex {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timecode-section,
.timesource-section {
  flex: 1;
}

.timecode-display {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
}

.timecode {
  font-family: 'Courier New', Courier, monospace;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  text-align: center;
  color: #1a1a1a;
}

.time-source {
  font-size: 12px;
  text-align: center;
  margin: 0;
  color: #6c757d;
}

/* Session Card Specific */
.compact-user-info {
  background-color: #f8f9fa;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  border: 1px solid #e9ecef;
}

.user-email {
  color: #1a1a1a;
}

.guest-text {
  color: #6c757d;
}

.admin-badge {
  background-color: #f59e0b;
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  margin-left: 6px;
  font-weight: 600;
}

/* Section Divider */
.section-divider {
  height: 1px;
  background-color: #e9ecef;
  margin: 12px 0;
  width: 100%;
}

/* Storage Section */
.usage-details {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
  color: #6c757d;
}

.usage-text {
  color: #1a1a1a;
}

.storage-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.usage-indicator {
  background-color: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
}

.usage-indicator.high-usage {
  color: #f59e0b;
}

/* Usage Bar */
.usage-bar {
  height: 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.usage-fill {
  height: 100%;
  background-color: #10b981;
  transition: width 0.3s ease;
}

.usage-fill.high-usage {
  background-color: #f59e0b;
}

/* App Section */
.app-status-text {
  font-size: 14px;
  margin: 0;
  color: #10b981;
}

.install-unavailable {
  font-size: 14px;
  color: #6c757d;
}

/* Footer Bottom */
.footer-bottom {
  background-color: #f8f9fa;
  padding: 8px 0;
  text-align: center;
  font-size: 12px;
  margin-top: 4px;
  color: #6c757d;
  border-top: 1px solid #e9ecef;
}

.copyright-text {
  margin: 0;
  color: #6c757d;
}

/* Focus States for Accessibility */
.btn:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .container {
    padding: 0 16px;
  }

  .footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .footer-card {
    padding: 16px;
  }

  .timecode-timesource-flex {
    flex-direction: row;
    gap: 16px;
  }

  .timecode {
    font-size: 20px;
  }

  .card-title {
    font-size: 18px;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .container {
    padding: 0 20px;
  }

  .footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .footer-card {
    padding: 20px;
  }

  .timecode {
    font-size: 22px;
  }

  .card-title {
    font-size: 18px;
  }

  .btn {
    padding: 10px 18px;
    font-size: 14px;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .footer {
    border-top-width: 2px;
  }
  
  .footer-card,
  .btn {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
  
  .btn:hover {
    transform: none;
  }
  
  .btn:active {
    transform: none;
  }
  
  .usage-fill {
    transition: none;
  }
}
</style>