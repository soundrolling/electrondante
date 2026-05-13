// src/services/syncService.js
import { ref } from 'vue';
import { getAllOfflineChangesWithKeys, deleteOfflineChangeByKey } from '@/utils/indexedDB';
import { mutateTableData } from './dataService';
import { useToast } from 'vue-toastification';

export const isSyncing = ref(false);
export const lastSyncedAt = ref(null);

export async function syncOfflineChanges(verbose = false) {
  if (isSyncing.value) {
    if (verbose) console.log('[syncOfflineChanges] Already syncing, skipping');
    return { successCount: 0, failCount: 0, alreadySyncing: true };
  }
  isSyncing.value = true;
  const toast = typeof window !== 'undefined' ? useToast() : null;

  try {
    const entries = await getAllOfflineChangesWithKeys();
    if (verbose) console.log(`[syncOfflineChanges] Found ${entries.length} items to sync`);

    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      const { key, value } = entry;
      const { table, operation, data } = value;

      try {
        if (verbose) console.log(`[syncOfflineChanges] ${operation.toUpperCase()} ${table}`, data);

        // If project_id is missing (e.g. from offline), try to load it from settings
        if (!data.project_id) {
          const { getSetting } = await import('@/utils/indexedDB');
          const projectId = await getSetting('current-project-id');
          if (projectId) data.project_id = projectId;
        }

        await mutateTableData(table, operation, data);
        await deleteOfflineChangeByKey(key);
        successCount++;
      } catch (err) {
        console.error(`[syncOfflineChanges] Failed to sync change:`, err);
        failCount++;
      }
    }

    if (toast && successCount > 0) {
      toast.success(`Synced ${successCount} changes${failCount ? ` (${failCount} failed)` : ''}`);
    }
    lastSyncedAt.value = Date.now();
    return { successCount, failCount };
  } catch (err) {
    console.error('[syncOfflineChanges] Failed to sync queue:', err);
    if (toast) toast.error('Failed to sync offline changes');
    throw err;
  } finally {
    isSyncing.value = false;
  }
}

// Manual "sync now" trigger — used by the header chip and any UI button.
// Returns a small status object so the caller can decide whether to surface feedback.
export async function triggerManualSync() {
  const toast = typeof window !== 'undefined' ? useToast() : null;
  if (!navigator.onLine) {
    toast?.warning("Can't sync — you're offline");
    return { offline: true };
  }
  if (isSyncing.value) {
    toast?.info('Sync already in progress…');
    return { alreadySyncing: true };
  }
  const result = await syncOfflineChanges(true);
  if (!result.alreadySyncing && result.successCount === 0 && result.failCount === 0) {
    toast?.info('Nothing to sync — all caught up');
  }
  return result;
}

// Breakdown of pending changes grouped by table name. Used for tooltips/popovers.
export async function getPendingBreakdown() {
  const changes = await getAllOfflineChangesWithKeys();
  const byTable = {};
  for (const { value } of changes) {
    const t = value.table || 'unknown';
    byTable[t] = (byTable[t] || 0) + 1;
  }
  return byTable;
}
