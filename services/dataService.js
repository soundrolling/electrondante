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
  getSetting
} from '@/utils/indexedDB';

const toast = useToast();

function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Strip local-only fields before sending to Supabase
function stripLocalFields(data) {
  const { _isTemp, _queuedKey, ...clean } = data;
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
      console.log('[registerBackgroundSync] registered');
    } catch (err) {
      console.warn('[registerBackgroundSync] failed:', err);
    }
  }
}

export async function fetchTableData(tableName, options = {}) {
  try {
    if (navigator.onLine) {
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
      if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        toast.error(error.message);
        return await getData(tableName);
      }
      
      // Merge fetched data with existing local data to preserve offline notes
      const existingData = await getData(tableName);
      const offlineNotes = existingData.filter(item => item._isTemp);
      
      // Combine online data with offline notes
      const mergedData = [...data, ...offlineNotes];
      await saveData(tableName, mergedData);
      
      console.log(`[fetchTableData] Fetched ${data.length} online items, merged with ${offlineNotes.length} offline items`);
      return mergedData;
    } else {
      toast.info('Offline mode: using local data');
      let local = await getData(tableName);
      if (options.eq) {
        Object.entries(options.eq).forEach(([c, v]) => {
          local = local.filter(i => i[c] === v);
        });
      }
      return local;
    }
  } catch (e) {
    console.error(`fetchTableData error for ${tableName}:`, e);
    toast.error('Fetch error');
    return await getData(tableName);
  }
}

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
          const tempRow = { ...item, id: tempId, _isTemp: true };
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
          const updated = existing && existing._isTemp
            ? { ...existing, ...data, _isTemp: true }
            : { ...existing, ...data };
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
          await deleteData(tableName, data.id);
          await addOfflineChange({ table: tableName, operation, data: { id: data.id } });
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
    console.error(`mutateTableData error for ${tableName}:`, e);
    toast.error(e.message);
    throw e;
  }
}

let isSyncing = false;

export async function syncOfflineChanges() {
  if (!navigator.onLine) return;
  if (isSyncing) {
    console.log('[syncOfflineChanges] Sync already in progress, skipping');
    return;
  }
  
  isSyncing = true;
  toast.info('Syncing offline changes…');

  const jwt = await getSetting('supabase-token', null);
  if (!jwt) {
    console.warn('[syncOfflineChanges] No Supabase token in IndexedDB');
    return;
  }

  const changesWithKeys = await getAllOfflineChangesWithKeys();
  if (!changesWithKeys.length) {
    console.log('[syncOfflineChanges] No queued changes to sync');
    return;
  }

  let success = 0;
  let fail = 0;

  for (const entry of changesWithKeys) {
    const { key, value: change } = entry;
    const { table, operation, data } = change;
    console.log(`[syncOfflineChanges] Processing change:`, { table, operation, key });
    console.log(`[syncOfflineChanges] Original data:`, data);
    try {
      if (operation === 'insert') {
        // Strip all local-only fields before sending to Supabase
        const clean = stripLocalFields(data);
        console.log(`[syncOfflineChanges] Inserting to ${table}:`, clean);
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
        console.log(`[syncOfflineChanges] Updating ${table}:`, updFields);
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
        console.warn('[syncOfflineChanges] Unknown change type:', operation);
      }
      await deleteOfflineChangeByKey(key);
      success++;
    } catch (err) {
      console.error(`[syncOfflineChanges] Failed to sync change (key=${key}):`, err);
      console.error(`[syncOfflineChanges] Change data:`, change);
      console.error(`[syncOfflineChanges] Table: ${table}, Operation: ${operation}`);
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

export async function clearLocalData() {
  await clearOfflineChanges();
  toast.success('Cleared all local data');
}