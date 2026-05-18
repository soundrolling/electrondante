// src/services/dataService.js
import { supabase } from '../supabase';
import { useToast } from 'vue-toastification';
import {
  getData,
  saveData,
  deleteData,
  addOfflineChange,
  getAllOfflineChangesWithKeys,
  deleteOfflineChangeByKey,
  clearOfflineChanges,
  getSetting,
} from '@/utils/indexedDB';
import { createLogger } from '@/utils/log'

const log = createLogger('dataService')

const toast = useToast();

// Track error logs to prevent spam
const errorLogCache = new Map();
const ERROR_LOG_THROTTLE = 5000; // Only log same error once per 5 seconds

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a stable client-side UUID for a single queued op. This UUID is
 * the idempotency key — sync replay records it in the `_cache_meta` op log
 * once the server confirms the write, so a second replay of the same queue
 * entry can short-circuit instead of duplicating.
 *
 * Uses `crypto.randomUUID()` where available (modern browsers + Node 19+);
 * falls back to a timestamp+random combo otherwise.
 */
function generateOpUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

// Helper to check if error should be logged (throttle repeated errors)
function shouldLogError(tableName, errorType, errorMessage) {
  const key = `${tableName}:${errorType}:${errorMessage}`;
  const now = Date.now();
  const lastLog = errorLogCache.get(key);
  
  if (!lastLog || (now - lastLog) > ERROR_LOG_THROTTLE) {
    errorLogCache.set(key, now);
    return true;
  }
  return false;
}

// Check if error is a network/server error that should fallback to offline
function isNetworkError(error) {
  if (!error) return false;
  // Check for network errors
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError') ||
      error.message?.includes('ERR_CONNECTION_CLOSED') ||
      error.message?.includes('ERR_INTERNET_DISCONNECTED')) {
    return true;
  }
  // Check for 5xx server errors
  if (error.status === 503 || error.status === 502 || error.status === 504 || 
      error.status === 500 || error.code === 'PGRST116') {
    return true;
  }
  return false;
}

// Strip local-only fields before sending to Supabase
// (sync-layer metadata + the synthetic `temp_` id used while offline)
function stripLocalFields(data) {
  const {
    _isTemp,
    _queuedKey,
    _op_uuid,
    _temp_id,
    _expected_updated_at,
    _attempts,
    _last_error,
    ...clean
  } = data;
  // Also remove temp IDs that start with 'temp_'
  if (clean.id && typeof clean.id === 'string' && clean.id.startsWith('temp_')) {
    delete clean.id;
  }
  return clean;
}

async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-notes');
      log.info('[registerBackgroundSync] registered');
    } catch (err) {
      log.warn('[registerBackgroundSync] failed:', err);
    }
  }
}

export async function fetchTableData(tableName, options = {}) {
  try {
    // Check online status - if offline, use local data immediately
    if (!navigator.onLine) {
      let local = await getData(tableName);
      if (options.eq) {
        Object.entries(options.eq).forEach(([c, v]) => {
          local = local.filter(i => i[c] === v);
        });
      }
      return local;
    }

    // Try to fetch from Supabase
    let q = supabase.from(tableName).select('*');
    if (options.eq) {
      Object.entries(options.eq).forEach(([c, v]) => q = q.eq(c, v));
    }
    if (options.in) {
      Object.entries(options.in).forEach(([c, vs]) => q = q.in(c, vs));
    }
    if (options.order) {
      const orders = Array.isArray(options.order) ? options.order : [options.order];
      orders.forEach(o => q = q.order(o.column, { ascending: o.ascending }));
    }
    if (options.limit) q = q.limit(options.limit);

    const { data, error } = await q;
    
    // Handle errors
    if (error) {
      const errorMessage = error.message || 'Unknown error';
      const isNetworkErr = isNetworkError(error);
      
      // Only log if not throttled
      if (shouldLogError(tableName, 'fetch', errorMessage)) {
        if (isNetworkErr) {
          log.warn(`[fetchTableData] Network error for ${tableName}, using cached data:`, errorMessage);
        } else {
          log.error(`[fetchTableData] Error fetching ${tableName}:`, error);
        }
      }
      
      // Only show toast for non-network errors (network errors are expected during outages)
      if (!isNetworkErr && shouldLogError(tableName, 'toast', errorMessage)) {
        toast.error(`Error fetching ${tableName}: ${errorMessage}`);
      }
      
      // Fallback to local data
      let local = await getData(tableName);
      if (options.eq) {
        Object.entries(options.eq).forEach(([c, v]) => {
          local = local.filter(i => i[c] === v);
        });
      }
      return local;
    }
    
    // Success - merge fetched data with existing local data to preserve offline notes
    const existingData = await getData(tableName);
    const offlineNotes = existingData.filter(item => item._isTemp);
    
    // Combine online data with offline notes
    const mergedData = [...data, ...offlineNotes];
    await saveData(tableName, mergedData);
    
    log.info(`[fetchTableData] Fetched ${data.length} online items, merged with ${offlineNotes.length} offline items`);
    return mergedData;
  } catch (e) {
    // Handle network exceptions (Failed to fetch, etc.)
    const errorMessage = e.message || 'Unknown error';
    const isNetworkErr = isNetworkError(e);
    
    if (shouldLogError(tableName, 'exception', errorMessage)) {
      if (isNetworkErr) {
        log.warn(`[fetchTableData] Network exception for ${tableName}, using cached data:`, errorMessage);
      } else {
        log.error(`[fetchTableData] Exception for ${tableName}:`, e);
      }
    }
    
    // Only show toast for unexpected errors
    if (!isNetworkErr && shouldLogError(tableName, 'toast', errorMessage)) {
      toast.error(`Fetch error for ${tableName}`);
    }
    
    // Always fallback to local data
    let local = await getData(tableName);
    if (options.eq) {
      Object.entries(options.eq).forEach(([c, v]) => {
        local = local.filter(i => i[c] === v);
      });
    }
    return local;
  }
}

/**
 * Mutate a single row in `tableName`. Online: writes go directly to Supabase
 * and the local cache is updated to match. Offline: a queue entry is appended
 * to the `offlineChanges` store and replayed by `syncOfflineChanges` once
 * the network returns.
 *
 * ## Offline queue entry schema (the contract)
 *
 * Each queued op has the shape:
 *   {
 *     table:     string,                  // Supabase table name
 *     operation: 'insert' | 'update' | 'delete',
 *     data: {
 *       ...row fields,
 *       id?:                  string,     // present for update/delete; temp id for inserts
 *       _op_uuid:             string,     // stable client UUID — idempotency key
 *       _temp_id?:            string,     // present on inserts; same as data.id
 *       _expected_updated_at?: string,    // present on updates if the local row had one
 *       _attempts:            number,     // retry counter (starts at 0)
 *       _last_error?:         string,     // last sync error message (debugging)
 *       _isTemp?:             boolean,    // present in the cached row, stripped before send
 *     },
 *     timestamp: number,                  // enqueued-at, set by addOfflineChange
 *   }
 *
 * Replay (in `syncService.js`) reads each entry, rewrites any temp-id
 * references using the temp→real map, consults the `_cache_meta` op log
 * to skip already-applied ops, and retries with exponential backoff on
 * retryable errors (network / 5xx / 429).
 *
 * Public signature is unchanged from prior versions.
 *
 * @param {string} tableName
 * @param {'insert'|'update'|'delete'} operation
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function mutateTableData(tableName, operation, data) {
  try {
    if (navigator.onLine) {
      let result;
      switch (operation) {
        case 'insert': {
          const payload = Array.isArray(data) ? data : [data];
          const { data: inserted, error } = await supabase.from(tableName).insert(payload).select();
          if (error) throw error;
          
          // Merge with existing local data to preserve offline notes
          const existingData = await getData(tableName);
          const offlineNotes = existingData.filter(item => item._isTemp);
          const mergedData = [...inserted, ...offlineNotes];
          await saveData(tableName, mergedData);
          
          result = Array.isArray(data) ? inserted : inserted[0];
          break;
        }
        case 'update': {
          const { id, ...fields } = data;
          const { data: updated, error } = await supabase.from(tableName).update(fields).eq('id', id).select();
          if (error) throw error;
          
          // Update specific item in local storage while preserving offline notes
          const existingData = await getData(tableName);
          const offlineNotes = existingData.filter(item => item._isTemp);
          const onlineData = existingData.filter(item => !item._isTemp);
          const updatedOnlineData = onlineData.map(item => 
            item.id === id ? updated[0] : item
          );
          const mergedData = [...updatedOnlineData, ...offlineNotes];
          await saveData(tableName, mergedData);
          
          result = updated[0];
          break;
        }
        case 'delete': {
          const { id } = data;
          const { error } = await supabase.from(tableName).delete().eq('id', id);
          if (error) throw error;
          await deleteData(tableName, id);
          result = { success: true, id };
          break;
        }
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      return result;
    } else {
      let localResult;
      switch (operation) {
        case 'insert': {
          const item = Array.isArray(data) ? data[0] : data;
          const tempId = generateTempId();
          const opUuid = generateOpUuid();
          // _op_uuid / _temp_id / _attempts are sync-layer metadata; stripped
          // before the row hits Supabase. _isTemp marks the cached row so the
          // UI can render it with a "queued" affordance.
          const tempRow = {
            ...item,
            id: tempId,
            _isTemp: true,
            _op_uuid: opUuid,
            _temp_id: tempId,
            _attempts: 0,
          };
          const existing = await getData(tableName);
          await saveData(tableName, [...existing, tempRow]);
          await addOfflineChange({ table: tableName, operation, data: tempRow });
          toast.info('Offline insert queued');
          localResult = tempRow;
          break;
        }
        case 'update': {
          const existingData = await getData(tableName);
          const existing = existingData.find(i => i.id === data.id);
          const opUuid = generateOpUuid();
          // Capture the row's `updated_at` at enqueue time so the sync layer
          // can detect server-side conflicts (someone else wrote in between).
          // Falls back to undefined for tables without an `updated_at` column.
          const expectedUpdatedAt = existing?.updated_at || data.updated_at;
          const baseUpdate = existing && existing._isTemp
            ? { ...existing, ...data, _isTemp: true }
            : { ...existing, ...data };
          const updated = {
            ...baseUpdate,
            _op_uuid: opUuid,
            _expected_updated_at: expectedUpdatedAt,
            _attempts: 0,
          };
          const updatedData = existingData.map(item =>
            item.id === data.id ? updated : item
          );
          await saveData(tableName, updatedData);
          await addOfflineChange({ table: tableName, operation, data: updated });
          toast.info('Offline update queued');
          localResult = updated;
          break;
        }
        case 'delete': {
          const opUuid = generateOpUuid();
          await deleteData(tableName, data.id);
          await addOfflineChange({
            table: tableName,
            operation,
            data: { id: data.id, _op_uuid: opUuid, _attempts: 0 },
          });
          toast.info('Offline delete queued');
          localResult = { success: true, id: data.id };
          break;
        }
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      await registerBackgroundSync();
      return localResult;
    }
  } catch (e) {
    const errorMessage = e.message || 'Unknown error';
    const isNetworkErr = isNetworkError(e);
    
    if (shouldLogError(tableName, 'mutate', errorMessage)) {
      if (isNetworkErr) {
        log.warn(`[mutateTableData] Network error for ${tableName}:`, errorMessage);
      } else {
        log.error(`[mutateTableData] Error for ${tableName}:`, e);
      }
    }
    
    // Only show toast for non-network errors
    if (!isNetworkErr && shouldLogError(tableName, 'toast', errorMessage)) {
      toast.error(errorMessage);
    }
    
    throw e;
  }
}

let isSyncing = false;

export async function syncOfflineChanges() {
  if (!navigator.onLine) return;
  if (isSyncing) {
    log.info('[syncOfflineChanges] Sync already in progress, skipping');
    return;
  }
  
  isSyncing = true;
  toast.info('Syncing offline changes…');

  const jwt = await getSetting('supabase-token', null);
  if (!jwt) {
    log.warn('[syncOfflineChanges] No Supabase token in IndexedDB');
    return;
  }

  const changesWithKeys = await getAllOfflineChangesWithKeys();
  if (!changesWithKeys.length) {
    log.info('[syncOfflineChanges] No queued changes to sync');
    return;
  }

  let success = 0;
  let fail = 0;

  for (const entry of changesWithKeys) {
    const { key, value: change } = entry;
    const { table, operation, data } = change;
    log.info(`[syncOfflineChanges] Processing change:`, { table, operation, key });
    log.info(`[syncOfflineChanges] Original data:`, data);
    try {
      if (operation === 'insert') {
        // Strip all local-only fields before sending to Supabase
        const clean = stripLocalFields(data);
        log.info(`[syncOfflineChanges] Inserting to ${table}:`, clean);
        const { data: inserted, error } = await supabase.from(table).insert(clean).select().single();
        if (error) throw error;
        // Remove the temp note and add the real one
        const existingData = await getData(table);
        // Remove any note with the temp id or with the same content as the uploaded note
        const updatedData = existingData.filter(item => 
          !(item.id === data.id && data._isTemp) && // Remove by temp id
          !(item._isTemp && item.note === inserted.note && item.timestamp === inserted.timestamp && item.recording_date === inserted.recording_date)
        );
        // Add the real note from Supabase
        updatedData.push(inserted);
        await saveData(table, updatedData);
      } else if (operation === 'update') {
        // Strip all local-only fields before sending to Supabase
        const updFields = stripLocalFields(data);
        log.info(`[syncOfflineChanges] Updating ${table}:`, updFields);
        const { data: updated, error } = await supabase.from(table).update(updFields).eq('id', updFields.id).select();
        if (error) throw error;
        // Update the specific item in local storage
        const existingData = await getData(table);
        const updatedData = existingData.map(item => 
          item.id === updFields.id ? updated[0] : item
        );
        await saveData(table, updatedData);
      } else if (operation === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        if (error) throw error;
        await deleteData(table, data.id);
      } else {
        log.warn('[syncOfflineChanges] Unknown change type:', operation);
      }
      await deleteOfflineChangeByKey(key);
      success++;
    } catch (err) {
      log.error(`[syncOfflineChanges] Failed to sync change (key=${key}):`, err);
      log.error(`[syncOfflineChanges] Change data:`, change);
      log.error(`[syncOfflineChanges] Table: ${table}, Operation: ${operation}`);
      fail++;
    }
  }

  if (fail === 0) {
    toast.success(`Synced ${success} changes`);
  } else {
    toast.warning(`Synced ${success} changes, ${fail} failed`);
  }
  
  isSyncing = false;
}

export async function hasPendingChanges() {
  const changes = await getAllOfflineChangesWithKeys();
  return changes.length > 0;
}

export async function getPendingChangesCount() {
  const changes = await getAllOfflineChangesWithKeys();
  return changes.length;
}

export async function clearLocalData() {
  await clearOfflineChanges();
  toast.success('Cleared all local data');
}