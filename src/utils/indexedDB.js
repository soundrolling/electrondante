import { useToast } from 'vue-toastification';
const toast = useToast();

const DB_NAME = 'ProjectManagementDB';
// Bump this when the IndexedDB *structure* (object stores / indexes) needs to change.
// On upgrade, new stores are created in `onupgradeneeded` below.
export const DB_VERSION = 17;
// Bump this when the cached *row shape* changes (e.g. a new column we want
// surfaced to the UI). On bump, `invalidateStaleCaches()` clears any cached
// table whose stored schemaVersion is older — forcing a re-fetch on next read.
export const CACHE_SCHEMA_VERSION = 1;

let db = null;

export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const existingStores = [
        'projects', 'locations', 'notes', 'schedules', 'quickfire_buttons',
        'gear_table', 'project_contacts', 'patch_bay', 'input_channels',
        'venues', 'pois', 'call_sheets', 'callsheet_schedules', 'callsheet_poi',
        'calendar_events', 'project_members', 'project_details',
        'patch_bay_layouts', 'patch_bay_nodes', 'patch_bay_connections',
        'offlineChanges', 'stage_hours', 'tool_settings', 'mic_color_buttons',
        'travel_trips', 'travel_flights', 'travel_rental_cars',
        'travel_local_transport', 'travel_parking',
        'stage_pictures', 'stage_docs',
      ];

      existingStores.forEach(storeName => {
        if (!database.objectStoreNames.contains(storeName)) {
          const opts = storeName === 'offlineChanges'
            ? { autoIncrement: true }
            : { keyPath: 'id' };
          database.createObjectStore(storeName, opts);
        }
      });

      if (!database.objectStoreNames.contains('gear_assignments')) {
        const store = database.createObjectStore('gear_assignments', {
          keyPath: ['gear_id', 'location_id']
        });
        store.createIndex('by_gear', 'gear_id');
        store.createIndex('by_location', 'location_id');
      }

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('query_cache')) {
        database.createObjectStore('query_cache', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('document_files')) {
        database.createObjectStore('document_files', { keyPath: 'filePath' });
      }

      if (!database.objectStoreNames.contains('user_gear')) {
        database.createObjectStore('user_gear', { keyPath: 'id' });
      }

      // Sync metadata: cache freshness, completed-op log (idempotency), temp→real id map.
      // Schema: { key: string, value: any, schemaVersion?: number, lastSyncedAt?: number }
      if (!database.objectStoreNames.contains('_cache_meta')) {
        database.createObjectStore('_cache_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      toast.error(`Database open failed: ${event.target.error}`);
      reject(event.target.error);
    };
  });
}

export function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      console.error('Transaction error:', tx.error);
      toast.error(`DB transaction error: ${tx.error}`);
      reject(tx.error);
    };
    tx.onabort = () => {
      console.error('Transaction aborted:', tx.error);
      toast.error(`DB transaction aborted: ${tx.error}`);
      reject(tx.error);
    };
  });
}

export async function saveData(storeName, data) {
  try {
    const database = await openDB();
    const tx = database.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);

    if (Array.isArray(data)) {
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }

    await waitForTransaction(tx);
  } catch (e) {
    console.error(`saveData(${storeName}) failed:`, e);
    toast.error(`Save to ${storeName} failed: ${e.message}`);
  }
}

export async function getData(storeName, key = null) {
  try {
    const database = await openDB();
    if (!database.objectStoreNames.contains(storeName)) {
      return key !== null ? null : [];
    }

    return await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = key !== null ? store.get(key) : store.getAll();

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.error(`getData(${storeName}) error:`, req.error);
        toast.error(`Read ${storeName} failed: ${req.error}`);
        reject(req.error);
      };
    });
  } catch (e) {
    console.error(`getData(${storeName}) exception:`, e);
    toast.error(`Read ${storeName} exception: ${e.message}`);
    return key !== null ? null : [];
  }
}

export async function deleteData(storeName, key) {
  try {
    const database = await openDB();
    const tx = database.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    await waitForTransaction(tx);
  } catch (e) {
    console.error(`deleteData(${storeName}, ${key}) failed:`, e);
    toast.error(`Delete from ${storeName} failed: ${e.message}`);
  }
}

let _addChangeLock = Promise.resolve();

export async function addOfflineChange(change) {
  return (_addChangeLock = _addChangeLock.then(() => _doAddOfflineChange(change)));
}

async function _doAddOfflineChange(change) {
  try {
    const database = await openDB();
    const existing = await getAllOfflineChangesWithKeys();

    if (change.operation === 'delete') {
      // Remove any queued insert or update for this id — the delete wins
      const prior = existing.filter(
        e => e.value.table === change.table && e.value.data?.id === change.data?.id
      );
      if (prior.length) {
        // If the only prior op was an insert (temp row), cancel both — net no-op
        const wasInsert = prior.every(e => e.value.operation === 'insert');
        const tx = database.transaction(['offlineChanges'], 'readwrite');
        const store = tx.objectStore('offlineChanges');
        for (const p of prior) store.delete(p.key);
        await waitForTransaction(tx);
        if (wasInsert) return; // temp insert + delete = nothing to sync
      }
    } else if (change.operation === 'update') {
      // Replace any existing update for the same table+id
      const prior = existing.find(
        e => e.value.table === change.table &&
             e.value.operation === 'update' &&
             e.value.data?.id === change.data?.id
      );
      if (prior) {
        const tx = database.transaction(['offlineChanges'], 'readwrite');
        tx.objectStore('offlineChanges').put(
          { ...change, timestamp: Date.now() },
          prior.key
        );
        await waitForTransaction(tx);
        return;
      }
    }
    // insert: always queue; update with no prior: queue fresh
    const tx = database.transaction(['offlineChanges'], 'readwrite');
    tx.objectStore('offlineChanges').add({ ...change, timestamp: Date.now() });
    await waitForTransaction(tx);
  } catch (e) {
    console.error('addOfflineChange failed:', e);
    toast.error(`Queue change failed: ${e.message}`);
  }
}

export async function getAllOfflineChangesWithKeys() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['offlineChanges'], 'readonly');
    const store = tx.objectStore('offlineChanges');
    const entries = [];
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        entries.push({ key: cursor.primaryKey, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function deleteOfflineChangeByKey(key) {
  try {
    const database = await openDB();
    const tx = database.transaction(['offlineChanges'], 'readwrite');
    tx.objectStore('offlineChanges').delete(key);
    await waitForTransaction(tx);
  } catch (e) {
    console.error(`deleteOfflineChangeByKey(${key}) failed:`, e);
    toast.error(`Delete offline change failed: ${e.message}`);
  }
}

export async function clearOfflineChanges() {
  try {
    const database = await openDB();
    const tx = database.transaction(['offlineChanges'], 'readwrite');
    tx.objectStore('offlineChanges').clear();
    await waitForTransaction(tx);
  } catch (e) {
    console.error('clearOfflineChanges failed:', e);
    toast.error(`Clear offline queue failed: ${e.message}`);
  }
}

export async function saveSetting(key, value) {
  try {
    const database = await openDB();
    const tx = database.transaction(['settings'], 'readwrite');
    tx.objectStore('settings').put({ key, value });
    await waitForTransaction(tx);
  } catch (e) {
    console.error(`saveSetting(${key}) failed:`, e);
    toast.error(`Save setting failed: ${e.message}`);
  }
}

export async function getSetting(key, defaultValue = null) {
  try {
    const database = await openDB();
    const tx = database.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : defaultValue);
      };
      req.onerror = () => {
        console.error(`getSetting(${key}) error:`, req.error);
        toast.error(`Read setting failed: ${req.error}`);
        reject(req.error);
      };
    });
  } catch (e) {
    console.error(`getSetting(${key}) exception:`, e);
    toast.error(`Read setting exception: ${e.message}`);
    return defaultValue;
  }
}

export async function clearAllData() {
  try {
    const database = await openDB();
    for (const name of database.objectStoreNames) {
      const tx = database.transaction([name], 'readwrite');
      tx.objectStore(name).clear();
      await waitForTransaction(tx);
    }
  } catch (e) {
    console.error('clearAllData failed:', e);
    toast.error(`Clear local data failed: ${e.message}`);
  }
}

// -------------------------
// Document file persistence
// -------------------------

/**
 * Store a document file blob in IndexedDB for offline access.
 * @param {string} filePath - The key under which to store the blob.
 * @param {Blob} fileBlob - The file blob to store.
 */
export async function storeDocumentFile(filePath, fileBlob) {
  try {
    const database = await openDB();
    const tx = database.transaction(['document_files'], 'readwrite');
    const store = tx.objectStore('document_files');
    store.put({ filePath, blob: fileBlob });
    await waitForTransaction(tx);
  } catch (e) {
    console.error(`storeDocumentFile(${filePath}) failed:`, e);
    toast.error(`Store document file failed: ${e.message}`);
  }
}

// -------------------------
// Cache meta (sync metadata)
// -------------------------
//
// `_cache_meta` is a small key/value store used by the sync layer for three things:
//
//   1. `cache:<tableName>` — `{ tableName, lastSyncedAt, schemaVersion }`.
//      When `CACHE_SCHEMA_VERSION` is bumped, `invalidateStaleCaches()` clears
//      any table whose stored `schemaVersion` is older than the current one.
//
//   2. `op:<op_uuid>` — `{ op_uuid, table, operation, completedAt, serverId? }`.
//      Idempotency log: written when a queued op successfully applies on the
//      server. Re-runs of the same queue entry can short-circuit by looking
//      this up — preventing duplicate inserts after partial sync failures.
//
//   3. `tempIdMap` — `{ key: 'tempIdMap', value: { [tempId]: realId } }`.
//      Survives across reloads so a CREATE in run #1 can be matched to a
//      DELETE/UPDATE in run #2 even if the queued op was written with the temp id.

/**
 * Read a single key from `_cache_meta`. Returns the stored record (with `key`)
 * or `null` if not present. Safe to call before the store exists (older DB
 * versions return `null`).
 */
export async function getCacheMeta(key) {
  try {
    const database = await openDB();
    if (!database.objectStoreNames.contains('_cache_meta')) return null;
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(['_cache_meta'], 'readonly');
      const req = tx.objectStore('_cache_meta').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error(`getCacheMeta(${key}) failed:`, e);
    return null;
  }
}

/**
 * Write a single record to `_cache_meta`. `record.key` is the primary key;
 * any other fields are persisted verbatim.
 */
export async function setCacheMeta(record) {
  try {
    if (!record || typeof record.key !== 'string') {
      throw new Error('setCacheMeta requires { key: string, ... }');
    }
    const database = await openDB();
    if (!database.objectStoreNames.contains('_cache_meta')) return;
    const tx = database.transaction(['_cache_meta'], 'readwrite');
    tx.objectStore('_cache_meta').put(record);
    await waitForTransaction(tx);
  } catch (e) {
    console.error(`setCacheMeta failed:`, e);
  }
}

/**
 * Walk every `cache:<table>` entry and clear the cached rows for any table
 * whose stored `schemaVersion` differs from `CACHE_SCHEMA_VERSION`. The next
 * `fetchTableData` call for that table will re-pull from Supabase.
 *
 * This is a no-op on a fresh DB (no cache meta exists yet) and is cheap to
 * call on every app boot.
 */
export async function invalidateStaleCaches() {
  try {
    const database = await openDB();
    if (!database.objectStoreNames.contains('_cache_meta')) return;
    const entries = await new Promise((resolve, reject) => {
      const tx = database.transaction(['_cache_meta'], 'readonly');
      const store = tx.objectStore('_cache_meta');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const meta of entries) {
      if (!meta.key || !meta.key.startsWith('cache:')) continue;
      const tableName = meta.key.slice('cache:'.length);
      if ((meta.schemaVersion ?? 0) !== CACHE_SCHEMA_VERSION) {
        if (database.objectStoreNames.contains(tableName)) {
          const tx = database.transaction([tableName], 'readwrite');
          tx.objectStore(tableName).clear();
          await waitForTransaction(tx);
        }
        await setCacheMeta({
          key: `cache:${tableName}`,
          tableName,
          lastSyncedAt: 0,
          schemaVersion: CACHE_SCHEMA_VERSION,
        });
        console.log(`[invalidateStaleCaches] cleared stale cache for ${tableName}`);
      }
    }
  } catch (e) {
    console.error('invalidateStaleCaches failed:', e);
  }
}

/**
 * Idempotency log: was the queue op with this UUID already applied on the
 * server? Used by the sync replay loop to avoid duplicate writes when a
 * previous sync run partially succeeded and the queue entry survived.
 *
 * Returns the stored record `{ op_uuid, completedAt, serverId? }` or `null`.
 */
export async function getCompletedOp(opUuid) {
  if (!opUuid) return null;
  return await getCacheMeta(`op:${opUuid}`);
}

/**
 * Mark a queue op as successfully applied to the server. `serverId` is
 * optional — populated for inserts so callers can recover the real id later.
 */
export async function markOpCompleted(opUuid, { table, operation, serverId } = {}) {
  if (!opUuid) return;
  await setCacheMeta({
    key: `op:${opUuid}`,
    op_uuid: opUuid,
    table,
    operation,
    serverId,
    completedAt: Date.now(),
  });
}

/**
 * Retrieve the persisted temp-id → real-id map, used by the sync layer when
 * an earlier CREATE op has already been applied and a later UPDATE/DELETE
 * references the now-stale temp id.
 */
export async function getTempIdMap() {
  const rec = await getCacheMeta('tempIdMap');
  return (rec && rec.value) ? { ...rec.value } : {};
}

/**
 * Persist the temp-id → real-id map. Pass the whole map (caller merges in
 * the new entry); we overwrite the stored record wholesale.
 */
export async function setTempIdMap(map) {
  await setCacheMeta({ key: 'tempIdMap', value: map || {} });
}

/**
 * Retrieve a document file blob from IndexedDB.
 * @param {string} filePath - The key of the blob to retrieve.
 * @returns {Promise<Blob|null>} The stored blob, or null if not found.
 */
export async function getDocumentFile(filePath) {
  try {
    const database = await openDB();
    const tx = database.transaction(['document_files'], 'readonly');
    const store = tx.objectStore('document_files');
    return await new Promise((resolve, reject) => {
      const req = store.get(filePath);
      req.onsuccess = () => {
        const result = req.result;
        resolve(result ? result.blob : null);
      };
      req.onerror = () => {
        console.error(`getDocumentFile(${filePath}) error:`, req.error);
        toast.error(`Retrieve document file failed: ${req.error}`);
        reject(req.error);
      };
    });
  } catch (e) {
    console.error(`getDocumentFile(${filePath}) exception:`, e);
    toast.error(`Retrieve document file exception: ${e.message}`);
    return null;
  }
}