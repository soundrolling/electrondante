// src/services/syncService.js
import { getAllOfflineChangesWithKeys, deleteOfflineChangeByKey } from '@/utils/indexedDB';
import { mutateTableData } from './dataService';
import { useToast } from 'vue-toastification';

export async function syncOfflineChanges(verbose = false) {
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

        // If project_id is missing (e.g. from offline), try to load it from setting
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
    return { successCount, failCount };
  } catch (err) {
    console.error('[syncOfflineChanges] Failed to sync queue:', err);
    if (toast) toast.error('Failed to sync offline changes');
    throw err;
  }
}