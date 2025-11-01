<template>
<footer v-if="!isHiddenRoute" class="footer">
  <div class="container">
    <div class="footer-columns">
      <!-- Mobile: condensed header with menu button -->
      <div class="footer-mobile-bar">
        <button class="btn mobile-footer-menu btn-light" @click="showMobileFooter = true" aria-label="Open footer menu">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <span class="btn-text">Menu</span>
        </button>
        <div class="timecode-display compact">
          <p class="timecode">{{ liveTimecode }}</p>
          <p class="time-source">{{ currentTimeSourceLabel }}</p>
        </div>
      </div>
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
          class="btn btn-danger-light"
        >
          Sign Out
        </button>
      </div>
      <div class="footer-card storage-app-card">
        <h3 class="card-title">Theme</h3>
        <button
          @click="themeStore.toggleTheme()"
          class="btn btn-light theme-toggle-btn"
          :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          aria-label="Toggle theme"
        >
          <svg v-if="themeStore.isDark" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <!-- Sun icon for light mode -->
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <!-- Moon icon for dark mode -->
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <span class="btn-text">{{ themeStore.isDark ? 'Light Mode' : 'Dark Mode' }}</span>
        </button>
        <div class="section-divider"></div>
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
            <button @click="confirmAndClearCache" class="btn btn-danger-light">
              Clear Cache
            </button>
          </div>
        </div>
        <div class="section-divider"></div>
        <h3 class="card-title">App</h3>
        <div v-if="isPWAInstalled" class="app-status">
          <p class="app-status-text">App is installed on your device.</p>
          <button
            v-if="hasUpdateAvailable"
            @click="updatePWA"
            class="btn btn-positive update-btn"
          >
            Update Available
          </button>
        </div>
        <div v-else class="app-install">
          <button
            v-if="canInstallPWA"
            @click="installPWA"
            class="btn btn-primary install-btn"
          >
            Install App
          </button>
          <div v-else class="install-info">
            <span class="install-unavailable">
              Install prompt unavailable
            </span>
            <p class="install-hint">
              Use your browser's menu to install this app
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="copyright-text">&copy; {{ currentYear }} Soundrolling Notes</p>
  </div>
  <!-- Mobile Footer Sheet -->
  <div v-if="showMobileFooter" class="mobile-menu-backdrop" @click.self="showMobileFooter = false">
    <div class="mobile-menu-sheet" role="dialog" aria-modal="true">
      <div class="mobile-menu-header">
        <span class="menu-title">Footer</span>
        <button class="btn close-btn" @click="showMobileFooter = false" aria-label="Close menu">✕</button>
      </div>
      <div class="menu-section">
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
      </div>
      <div class="menu-section">
        <div class="footer-card session-card">
          <h3 class="card-title">Session</h3>
          <div class="compact-user-info">
            <span v-if="userEmail" class="user-email">
              {{ userEmail }} <span v-if="isAdmin" class="admin-badge">A</span>
            </span>
            <span v-else class="guest-text">Guest</span>
          </div>
          <button v-if="userEmail" @click="emitSignOut; showMobileFooter = false" class="btn btn-danger-light">Sign Out</button>
        </div>
      </div>
      <div class="menu-section">
        <div class="footer-card storage-app-card">
          <h3 class="card-title">Storage</h3>
          <div class="storage-display">
            <div class="usage-details">
              <span class="usage-text">{{ localStorageUsage.used }} / {{ localStorageUsage.max }} KB</span>
              <span class="usage-indicator" :class="{ 'high-usage': usagePercentage > 80 }">{{ Math.round(usagePercentage) }}%</span>
            </div>
            <div class="usage-bar">
              <div class="usage-fill" :style="usageFillStyle" :class="{ 'high-usage': usagePercentage > 80 }"></div>
            </div>
            <div class="storage-actions">
              <button @click="confirmAndClearCache; showMobileFooter = false" class="btn btn-danger-light">Clear Cache</button>
            </div>
          </div>
          <div class="section-divider"></div>
          <h3 class="card-title">Theme</h3>
          <button
            @click="themeStore.toggleTheme(); showMobileFooter = false"
            class="btn btn-light theme-toggle-btn"
            :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="themeStore.isDark" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg v-else class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <span class="btn-text">{{ themeStore.isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>
          <div class="section-divider"></div>
          <h3 class="card-title">App</h3>
          <div v-if="isPWAInstalled" class="app-status">
            <p class="app-status-text">App is installed on your device.</p>
            <button v-if="hasUpdateAvailable" @click="updatePWA" class="btn btn-positive update-btn">Update Available</button>
          </div>
          <div v-else class="app-install">
            <button v-if="canInstallPWA" @click="installPWA" class="btn btn-primary install-btn">Install App</button>
            <div v-else class="install-info">
              <span class="install-unavailable">Install prompt unavailable</span>
              <p class="install-hint">Use your browser's menu to install this app</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</footer>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import TimeSourceSelector from './TimeSourceSelector.vue';
import { useUserStore } from '@/stores/userStore';
import { useThemeStore } from '@/stores/themeStore';
import pwaService from '@/services/pwaService';

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
const themeStore = useThemeStore();
const HIDDEN_ROUTES = ['/', '/login', '/auth/reset-password', '/auth/set-password'];
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

// PWA state
const isPWAInstalled = ref(false);
const canInstallPWA = ref(false);
const hasUpdateAvailable = ref(false);
const isOnline = ref(navigator.onLine);

// Mobile footer state
const showMobileFooter = ref(false);

// PWA methods
const installPWA = async () => {
  try {
    const success = await pwaService.installPWA();
    if (success) {
      isPWAInstalled.value = true;
      canInstallPWA.value = false;
    }
  } catch (error) {
    console.error('Failed to install PWA:', error);
  }
};

const updatePWA = async () => {
  try {
    await pwaService.updatePWA();
  } catch (error) {
    console.error('Failed to update PWA:', error);
  }
};

// Check PWA status
const checkPWAStatus = () => {
  try {
    isPWAInstalled.value = pwaService.isInstalled;
    canInstallPWA.value = pwaService.canInstall();
    hasUpdateAvailable.value = pwaService.hasUpdate();
    isOnline.value = pwaService.getOnlineStatus();
  } catch (error) {
    console.error('Error checking PWA status:', error);
    // Fallback values
    isPWAInstalled.value = false;
    canInstallPWA.value = false;
    hasUpdateAvailable.value = false;
    isOnline.value = navigator.onLine;
  }
};

// Emit helpers
const confirmAndClearCache = () => {
if (window.confirm('Are you sure you want to clear the cache?')) {
  emit('clearCache');
}
};

const emitSignOut = () => emit('signOut');

// Override PWA service notifications
pwaService.notifyInstallAvailable = () => {
  canInstallPWA.value = true;
};

pwaService.notifyInstalled = () => {
  isPWAInstalled.value = true;
  canInstallPWA.value = false;
};

pwaService.notifyUpdateAvailable = () => {
  hasUpdateAvailable.value = true;
};

pwaService.notifyOnlineStatus = (online) => {
  isOnline.value = online;
};

// Lifecycle
onMounted(() => {
  checkPWAStatus();
  
  // Check status periodically
  const statusInterval = setInterval(checkPWAStatus, 5000);
  
  onUnmounted(() => {
    clearInterval(statusInterval);
  });
});
</script>

<style scoped>
/* Base Styles - Mobile First */
.footer {
  background-color: var(--bg-primary);
  color: #000000 !important;
  border-top: 1px solid var(--border-light);
  padding: var(--space-2) 0 0 0;
  font-size: var(--text-sm);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* Force text visibility */
.footer * {
  color: var(--text-primary) !important;
}

.footer .card-title,
.footer .timecode,
.footer .time-source,
.footer .user-email,
.footer .guest-text {
  color: var(--text-primary) !important;
}

/* Wrapper */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-3);
}

/* Grid for Cards */
.footer-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

/* Card Layout - Shared */
.footer-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3);
  transition: var(--transition-normal);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.footer-card:hover {
  background-color: var(--bg-secondary);
  box-shadow: var(--shadow-md);
}

/* Card Heading */
.card-title {
  margin: 0 0 var(--space-2);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: var(--space-1-5);
}

/* Button Shared Styling */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
  margin-top: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-normal);
  min-height: 36px;
}

/* Theme toggle button - styled as toggle switch */
.theme-toggle-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 48px;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-top: 0;
  border: 2px solid var(--border-medium);
  background: var(--bg-secondary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.theme-toggle-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-primary-500);
  transform: translateY(-1px);
}

.theme-toggle-btn .btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.theme-toggle-btn .btn-text {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

/* Dark mode styling for theme toggle */
.dark .theme-toggle-btn {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.dark .theme-toggle-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-primary-500);
}

/* Sign Out and Clear Cache buttons - dark red styling */
.footer .btn-danger-light {
  background-color: var(--color-error-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-error-700) !important;
  font-weight: var(--font-semibold);
}

.footer .btn-danger-light:hover {
  background-color: var(--color-error-700) !important;
  border-color: var(--color-error-800) !important;
  color: var(--text-inverse) !important;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn:active {
  transform: scale(0.98);
}

.secondary-btn {
  background-color: var(--color-secondary-600);
  color: var(--text-inverse);
}

.secondary-btn:hover {
  background-color: var(--color-secondary-700);
}

.warning-btn {
  background-color: var(--color-warning-500);
  color: var(--text-inverse);
}

.warning-btn:hover {
  background-color: var(--color-warning-600);
}

.install-btn {
  background-color: var(--color-success-500);
  color: var(--text-inverse);
}

.install-btn:hover {
  background-color: var(--color-success-600);
}

.update-btn {
  background-color: var(--color-primary-500);
  color: var(--text-inverse);
  margin-top: var(--space-2);
}

.update-btn:hover {
  background-color: var(--color-primary-600);
}

.install-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.install-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  font-style: italic;
}

/* Timecode Card Specific */
.timecode-timesource-flex {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.timecode-section,
.timesource-section {
  flex: 1;
}

.timecode-display {
  background-color: var(--bg-secondary);
  padding: var(--space-2-5);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  border: 1px solid var(--border-light);
}

.timecode {
  font-family: var(--font-family-mono);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-1) 0;
  text-align: center;
  color: var(--text-primary);
}

.time-source {
  font-size: var(--text-xs);
  text-align: center;
  margin: 0;
  color: var(--text-secondary);
}

/* Session Card Specific */
.compact-user-info {
  background-color: var(--bg-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  border: 1px solid var(--border-light);
}

.user-email {
  color: var(--text-primary);
}

.guest-text {
  color: var(--text-secondary);
}

.admin-badge {
  background-color: var(--color-warning-500);
  color: var(--text-inverse);
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  margin-left: var(--space-1-5);
  font-weight: var(--font-semibold);
}

/* Section Divider */
.section-divider {
  height: 1px;
  background-color: var(--border-light);
  margin: var(--space-3) 0;
  width: 100%;
}

/* Storage Section */
.usage-details {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  margin-bottom: var(--space-1-5);
  color: var(--text-secondary);
}

.usage-text {
  color: var(--text-primary);
}

.storage-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.usage-indicator {
  background-color: var(--bg-secondary);
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--color-success-500);
  font-weight: var(--font-medium);
}

.usage-indicator.high-usage {
  color: var(--color-warning-500);
}

/* Usage Bar */
.usage-bar {
  height: 6px;
  background-color: var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.usage-fill {
  height: 100%;
  background-color: var(--color-success-500);
  transition: var(--transition-slow);
}

.usage-fill.high-usage {
  background-color: var(--color-warning-500);
}

/* App Section */
.app-status-text {
  font-size: var(--text-sm);
  margin: 0;
  color: var(--color-success-500);
}

.install-unavailable {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Footer Bottom */
.footer-bottom {
  background-color: var(--bg-secondary);
  padding: var(--space-2) 0;
  text-align: center;
  font-size: var(--text-xs);
  margin-top: var(--space-1);
  color: var(--text-secondary);
  border-top: 1px solid var(--border-light);
}

.copyright-text {
  margin: 0;
  color: var(--text-secondary);
}

/* Focus States for Accessibility */
.btn:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .container {
    padding: 0 var(--space-4);
  }

  .footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .footer-card {
    padding: var(--space-4);
  }

  .timecode-timesource-flex {
    flex-direction: row;
    gap: var(--space-4);
  }

  .timecode {
    font-size: var(--text-xl);
  }

  .card-title {
    font-size: var(--text-lg);
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .container {
    padding: 0 var(--space-5);
  }

  .footer-columns {
    grid-template-columns: 1fr 1fr 1fr; /* three columns on wider screens */
    gap: var(--space-4);
  }

  .footer-card {
    padding: var(--space-5);
  }

  .timecode {
    font-size: var(--text-2xl);
  }

  .card-title {
    font-size: var(--text-lg);
  }

  .btn {
    padding: var(--space-2-5) var(--space-4-5);
    font-size: var(--text-sm);
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

/* Mobile layout: condense into bar and hide grid */
@media (max-width: 768px) {
  .footer-columns { display: none; }
  .footer-mobile-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: 0 var(--space-2) var(--space-2); }
  .mobile-footer-menu { display: inline-flex; }
  .timecode-display.compact { margin: 0; border: 1px solid var(--border-light); background: var(--bg-secondary); border-radius: var(--radius-md); padding: var(--space-1) var(--space-2); }
}

/* Shared mobile menu styles (match header) */
.mobile-menu-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: var(--z-modal);
  display: flex; justify-content: center; align-items: flex-end;
}
.mobile-menu-sheet {
  width: 100%; max-width: 640px; background: var(--bg-primary);
  border-top-left-radius: var(--radius-xl); border-top-right-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl); padding: var(--space-4);
}
.mobile-menu-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
.menu-title { font-weight: var(--font-semibold); }
.close-btn { background: var(--bg-secondary); }
.menu-section { margin-bottom: var(--space-3); }

/* Desktop default: hide the mobile bar */
.footer-mobile-bar { display: none; }
</style>