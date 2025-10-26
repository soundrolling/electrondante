import { useToast } from 'vue-toastification';
const toast = useToast();

const DB_NAME = 'ProjectManagementDB';
const DB_VERSION = 11;

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
        'offlineChanges', 'stage_hours',
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

      if (!database.objectStoreNames.contains('document_files')) {
        database.createObjectStore('document_files', { keyPath: 'filePath' });
      }

      if (!database.objectStoreNames.contains('user_gear')) {
        database.createObjectStore('user_gear', { keyPath: 'id' });
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

export async function addOfflineChange(change) {
  try {
    const database = await openDB();
    const existing = await getAllOfflineChangesWithKeys();
    const alreadyQueued = existing.find(e =>
      e.value.table === change.table &&
      e.value.operation === change.operation &&
      e.value.data?.id === change.data?.id
    );
    if (alreadyQueued) return;
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