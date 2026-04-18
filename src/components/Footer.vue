<template>
<footer v-if="!isHiddenRoute" class="footer">
  <div class="footer-inner">
    <!-- Timecode block -->
    <div class="footer-block timecode-block">
      <div class="block-icon">
        <Clock :size="16" :stroke-width="2" />
      </div>
      <div class="block-body">
        <div class="timecode">{{ liveTimecode }}</div>
        <div class="timecode-source">
          <TimeSourceSelector />
        </div>
      </div>
    </div>

    <!-- Storage block -->
    <div class="footer-block storage-block">
      <div class="block-icon">
        <HardDrive :size="16" :stroke-width="2" />
      </div>
      <div class="block-body">
        <div class="storage-row">
          <span class="block-label">Storage</span>
          <span
            class="storage-pct"
            :class="{ warning: usagePercentage > 80 }"
          >{{ Math.round(usagePercentage) }}%</span>
        </div>
        <div class="storage-bar">
          <div
            class="storage-fill"
            :class="{ warning: usagePercentage > 80 }"
            :style="usageFillStyle"
          ></div>
        </div>
        <div class="storage-meta">
          <span class="storage-usage">{{ localStorageUsage.used }} / {{ localStorageUsage.max }} KB</span>
          <button
            class="storage-clear-btn"
            @click="confirmAndClearCache"
            title="Clear cache"
            aria-label="Clear cache"
          >
            <Trash2 :size="13" :stroke-width="2" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>

    <!-- App status block -->
    <div class="footer-block app-block">
      <div class="block-icon">
        <template v-if="hasUpdateAvailable">
          <Download :size="16" :stroke-width="2" />
        </template>
        <template v-else-if="isPWAInstalled">
          <CheckCircle2 :size="16" :stroke-width="2" />
        </template>
        <template v-else-if="canInstallPWA">
          <DownloadCloud :size="16" :stroke-width="2" />
        </template>
        <template v-else>
          <Smartphone :size="16" :stroke-width="2" />
        </template>
      </div>
      <div class="block-body">
        <div class="block-label">App</div>
        <div v-if="hasUpdateAvailable">
          <button class="app-action-btn update" @click="updatePWA">
            <span>Update available</span>
          </button>
        </div>
        <div v-else-if="isPWAInstalled" class="app-status installed">
          <span>Installed</span>
        </div>
        <div v-else-if="canInstallPWA">
          <button class="app-action-btn install" @click="installPWA">
            <span>Install app</span>
          </button>
        </div>
        <div v-else class="app-status">
          <span class="app-install-hint">Use browser menu to install</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer-bottom">
    <span class="copyright-text">&copy; {{ currentYear }} Soundrolling Notes</span>
  </div>
</footer>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import TimeSourceSelector from './TimeSourceSelector.vue';
import pwaService from '@/services/pwaService';
import {
  Clock,
  HardDrive,
  Trash2,
  Smartphone,
  DownloadCloud,
  Download,
  CheckCircle2,
} from 'lucide-vue-next';

const props = defineProps({
  liveTimecode: { type: String, required: true },
  currentTimeSourceLabel: { type: String, required: true },
  localStorageUsage: { type: Object, required: true },
  userEmail: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
});

const emit = defineEmits(['clearCache', 'signOut']);

const route = useRoute();
const HIDDEN_ROUTES = ['/', '/login', '/auth/reset-password', '/auth/set-password'];
const isHiddenRoute = computed(() => HIDDEN_ROUTES.includes(route.path));

const usagePercentage = computed(() => {
  const { used, max } = props.localStorageUsage;
  return max > 0 ? (used / max) * 100 : 0;
});
const usageFillStyle = computed(() => ({ width: `${usagePercentage.value}%` }));

const currentYear = new Date().getFullYear();

const isPWAInstalled = ref(false);
const canInstallPWA = ref(false);
const hasUpdateAvailable = ref(false);
const isOnline = ref(navigator.onLine);

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

const checkPWAStatus = async () => {
  try {
    isPWAInstalled.value = pwaService.isInstalled;
    canInstallPWA.value = await pwaService.canInstall();
    hasUpdateAvailable.value = pwaService.hasUpdate();
    isOnline.value = pwaService.getOnlineStatus();
  } catch (error) {
    console.error('Error checking PWA status:', error);
    isPWAInstalled.value = false;
    canInstallPWA.value = false;
    hasUpdateAvailable.value = false;
    isOnline.value = navigator.onLine;
  }
};

const confirmAndClearCache = () => {
  if (window.confirm('Are you sure you want to clear the cache?')) {
    emit('clearCache');
  }
};

pwaService.notifyInstallAvailable = async () => {
  canInstallPWA.value = await pwaService.canInstall();
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

onMounted(() => {
  checkPWAStatus();
  const statusInterval = setInterval(() => checkPWAStatus(), 5000);
  onUnmounted(() => clearInterval(statusInterval));
});
</script>

<style scoped>
/* ─── Footer shell ─────────────────────────────────────── */
.footer {
  background: var(--surface-app-bar);
  color: var(--text-primary);
  border-top: 1px solid var(--surface-border);
  font-size: var(--text-sm);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

/* ─── Block layout ─────────────────────────────────────── */
.footer-block {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  min-width: 0;
}
.block-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.block-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.block-label {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  line-height: 1;
}

/* ─── Timecode ─────────────────────────────────────────── */
.timecode-block .block-body { gap: 6px; }
.timecode {
  font-family: var(--font-family-mono);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  letter-spacing: 0.02em;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.timecode-source { width: 100%; min-width: 0; }
.timecode-source :deep(select),
.timecode-source :deep(.form-select) {
  font-size: var(--text-xs);
  padding: 4px 24px 4px 8px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface-card-muted);
  color: var(--text-secondary);
  min-height: 0;
}

/* ─── Storage ──────────────────────────────────────────── */
.storage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.storage-pct {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-success-600);
  font-variant-numeric: tabular-nums;
}
.storage-pct.warning { color: var(--color-warning-600); }
.storage-bar {
  height: 4px;
  background: var(--chip-bg);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.storage-fill {
  height: 100%;
  background: var(--color-success-500);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}
.storage-fill.warning { background: var(--color-warning-500); }
.storage-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.storage-usage {
  font-variant-numeric: tabular-nums;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.storage-clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: border-color var(--transition-normal), color var(--transition-normal), background var(--transition-normal);
  flex-shrink: 0;
}
.storage-clear-btn:hover {
  border-color: var(--color-error-300);
  color: var(--color-error-600);
  background: var(--color-error-50);
}
.storage-clear-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ─── App status ───────────────────────────────────────── */
.app-block .block-body { gap: 4px; }
.app-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary-200);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal);
}
.app-action-btn:hover {
  background: var(--color-primary-100);
  border-color: var(--color-primary-300);
}
.app-action-btn.update {
  border-color: var(--color-warning-300);
  background: var(--color-warning-50);
  color: var(--color-warning-800);
}
.app-action-btn.update:hover {
  background: var(--color-warning-100);
}
.app-status {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.app-status.installed { color: var(--color-success-700); font-weight: var(--font-medium); }
.app-install-hint { color: var(--text-tertiary); font-style: normal; }

/* ─── Bottom strip ─────────────────────────────────────── */
.footer-bottom {
  border-top: 1px solid var(--surface-border);
  padding: 8px var(--space-4);
  text-align: center;
  max-width: 1400px;
  margin: 0 auto;
}
.copyright-text {
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.01em;
}

/* ─── Tablet ───────────────────────────────────────────── */
@media (min-width: 601px) {
  .footer-inner {
    grid-template-columns: 1.1fr 1.3fr 1fr;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-6);
    align-items: stretch;
  }
  .timecode { font-size: var(--text-2xl); }
  .footer-block { padding: var(--space-3) var(--space-4); }
  .footer-bottom { padding: 8px var(--space-6); }
}

/* ─── Desktop ──────────────────────────────────────────── */
@media (min-width: 1025px) {
  .footer-inner {
    padding: var(--space-3) var(--space-8);
  }
  .timecode { font-size: var(--text-2xl); }
  .footer-bottom { padding: 8px var(--space-8); }
}

/* ─── Mobile tweaks ────────────────────────────────────── */
@media (max-width: 600px) {
  .footer-inner {
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
  }
  .footer-block {
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
  }
  .block-icon { width: 26px; height: 26px; }
  .timecode { font-size: var(--text-lg); }
  .app-block .block-body,
  .storage-block .block-body { gap: 3px; }
  .storage-meta { font-size: 10px; }
  .footer-bottom { padding: 6px var(--space-3); }
}

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .footer { border-top-width: 2px; }
  .footer-block,
  .storage-clear-btn,
  .app-action-btn { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .storage-fill,
  .storage-clear-btn,
  .app-action-btn { transition: none; }
}
</style>
