<template>
<footer v-if="!isHiddenRoute" class="footer">
  <div class="container">
    <div class="footer-columns">
      <!-- Top row: Combined Timecode and Time Source Selector -->
      <div class="footer-card timecode-timesource-card">
        <div class="timecode-timesource-flex">
          <div class="timecode-section">
            <h3>Timecode</h3>
            <div class="timecode-display">
              <p class="timecode">{{ liveTimecode }}</p>
              <p class="time-source">{{ currentTimeSourceLabel }}</p>
            </div>
          </div>
          <div class="timesource-section">
            <h3>Select Time Source:</h3>
            <TimeSourceSelector />
          </div>
        </div>
      </div>
      <!-- Bottom row: Session | Storage/App -->
      <div class="footer-card session-card">
        <h3>Session</h3>
        <div class="compact-user-info">
          <span v-if="userEmail">
            {{ userEmail }} <span v-if="isAdmin" class="admin-badge">A</span>
          </span>
          <span v-else>Guest</span>
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
        <h3>Storage</h3>
        <div class="storage-display">
          <div class="usage-details">
            <span>{{ localStorageUsage.used }} / {{ localStorageUsage.max }} KB</span>
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
        <h3>App</h3>
        <div v-if="isPWAInstalled" class="app-status">
          <p>App is installed on your device.</p>
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
    <p>&copy; {{ currentYear }} Soundrolling Notes</p>
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
/* Footer Container */
.footer {
background-color: #f8f9fa;
color: #374151;
border-top: 1px solid #e5e7eb;
padding: 16px 0 0 0;
font-size: 0.875rem;
}

/* Wrapper */
.container {
max-width: 1400px;
margin: 0 auto;
padding: 0 24px;
}

/* Grid for Cards */
.footer-columns {
display: grid;
grid-template-columns: 1fr 1fr;
grid-template-rows: auto 1fr;
gap: 16px;
margin-bottom: 16px;
}

/* Card Layout - Shared */
.footer-card {
background-color: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 8px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
padding: 16px;
transition: all 0.2s ease;
display: flex;
flex-direction: column;
flex: 1;
min-width: 200px;
max-width: 100%;
}

.footer-card.user-storage-card {
padding-bottom: 16px;
}

.footer-card:hover {
background-color: #f9fafb;
}

/* Card Heading */
.footer-card h3 {
margin: 0 0 12px;
color: #1f2937;
font-size: 0.875rem;
font-weight: 600;
border-bottom: 1px solid #e5e7eb;
padding-bottom: 8px;
}

/* Button Shared Styling */
.btn {
display: inline-flex;
align-items: center;
justify-content: center;
padding: 6px 12px;
margin-top: 8px;
border: none;
border-radius: 6px;
font-size: 0.8rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.btn:hover {
transform: translateY(-1px);
}

.secondary-btn {
background-color: #6b7280;
color: #ffffff;
}

.secondary-btn:hover {
background-color: #4b5563;
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
.timecode-card .timecode-display {
background-color: #f3f4f6;
padding: 12px;
border-radius: 6px;
margin-bottom: 12px;
border: 1px solid #e5e7eb;
}

.timecode {
font-family: 'Courier New', Courier, monospace;
font-size: 1.25rem;
font-weight: 600;
margin: 0 0 4px 0;
text-align: center;
color: #1f2937;
}

.time-source {
font-size: 0.75rem;
text-align: center;
margin: 0;
color: #6b7280;
}

/* Session Card Specific */
.compact-user-info {
background-color: #f9fafb;
padding: 8px 12px;
border-radius: 6px;
margin-bottom: 8px;
font-size: 0.8rem;
border: 1px solid #e5e7eb;
}

.admin-badge {
background-color: #f59e0b;
color: #ffffff;
padding: 2px 6px;
border-radius: 4px;
font-size: 0.7rem;
margin-left: 4px;
font-weight: 600;
}

/* Section Divider */
.section-divider {
height: 1px;
background-color: #e5e7eb;
margin: 12px 0;
width: 100%;
}

/* Storage Section */
.usage-details {
display: flex;
justify-content: space-between;
font-size: 0.75rem;
margin-bottom: 6px;
color: #6b7280;
}

.storage-actions {
display: flex;
gap: 8px;
margin-top: 8px;
}

.usage-indicator {
background-color: #f3f4f6;
padding: 2px 6px;
border-radius: 4px;
font-size: 0.7rem;
color: #10b981;
font-weight: 500;
}

.usage-indicator.high-usage {
color: #f59e0b;
}

/* Usage Bar */
.usage-bar {
height: 6px;
background-color: #e5e7eb;
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
.app-status p {
font-size: 0.8rem;
margin: 0;
color: #10b981;
}

.install-unavailable {
font-size: 0.8rem;
color: #6b7280;
}

/* Footer Bottom */
.footer-bottom {
background-color: #f1f5f9;
padding: 12px 0;
text-align: center;
font-size: 0.75rem;
margin-top: 8px;
color: #6b7280;
border-top: 1px solid #e5e7eb;
}

/* Responsive design */
@media (max-width: 900px) {
.footer-columns {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
}
.timecode-timesource-flex {
  flex-direction: column;
  gap: 16px;
}
}

@media (max-width: 768px) {
.container {
  padding: 0 16px;
}

.footer-columns {
  gap: 12px;
}

.footer-card {
  padding: 12px;
  min-width: 150px;
}

.timecode {
  font-size: 1.1rem;
}
}

@media (max-width: 480px) {
.container {
  padding: 0 12px;
}

.footer-card {
  padding: 10px;
  min-width: 120px;
}

.timecode {
  font-size: 1rem;
}
}
</style>