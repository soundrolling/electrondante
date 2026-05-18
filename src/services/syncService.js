// src/services/syncService.js
//
// Sync orchestrator for the offline write queue.
//
// ## Replay flow per queue entry
//
//   1. **Temp-ID rewrite** — using the persisted temp→real id map (see
//      `_cache_meta:tempIdMap` in `indexedDB.js`), rewrite `data.id` and any
//      foreign-key reference (any field whose name ends in `_id`) that still
//      points at a temp id. This handles the cross-table CREATE→UPDATE,
//      CREATE→DELETE, and CREATE→FK-INSERT chains.
//
//   2. **Idempotency check** — look up `_op_uuid` in the completed-ops log.
//      If present, the op was already applied on a prior run that died
//      before deleting the queue entry; skip the network call entirely.
//
//   3. **Conflict detection (updates only)** — if the queued op carries an
//      `_expected_updated_at`, re-read the server row first. If the server's
//      `updated_at` differs, surface a toast and fall back to last-write-wins
//      (we still apply the local update). This is documented behavior — the
//      caller can review conflicts via the future "Conflicts" panel.
//
//   4. **Retry with exponential backoff** — on retryable errors (network,
//      5xx, 429), wait 1s, 2s, 4s, 8s, capped at 30s, for up to 5 attempts.
//      Non-retryable errors (4xx other than 429) fail the op immediately —
//      it stays in the queue for the next sync run with `_attempts` and
//      `_last_error` updated so devs can inspect.
//
//   5. **Mark completed** — write to the op log (idempotency), record the
//      temp→real id mapping for inserts, then delete the queue entry.
//
// The public surface (`syncOfflineChanges`, `triggerManualSync`,
// `getPendingBreakdown`, `isSyncing`, `lastSyncedAt`) is unchanged.

import { ref } from 'vue';
import { supabase } from '../supabase';
import {
  getAllOfflineChangesWithKeys,
  deleteOfflineChangeByKey,
  getData,
  saveData,
  deleteData,
  getSetting,
  getCompletedOp,
  markOpCompleted,
  getTempIdMap,
  setTempIdMap,
  setCacheMeta,
  invalidateStaleCaches,
  CACHE_SCHEMA_VERSION,
} from '@/utils/indexedDB';
import { useToast } from 'vue-toastification';

export const isSyncing = ref(false);
export const lastSyncedAt = ref(null);

// ---------- helpers ----------

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

/** Sleep for `ms` ms. Returns a promise. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Classify an error as retryable (network blips, 5xx, 429) vs. permanent. */
function isRetryableError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  if (msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ERR_CONNECTION') ||
      msg.includes('ERR_INTERNET_DISCONNECTED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNRESET')) {
    return true;
  }
  const status = err.status ?? err.statusCode ?? err.code;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  // Supabase / PostgREST transient codes
  if (err.code === 'PGRST116' || err.code === '57P01' || err.code === '57014') return true;
  return false;
}

/**
 * Rewrite every value in `data` that still references a temp id to its real
 * server id. Walks `data.id` plus any field whose name ends with `_id`.
 * Returns a new object — does not mutate the input.
 */
function rewriteTempIds(data, tempIdMap) {
  if (!data || typeof data !== 'object') return data;
  if (!tempIdMap || Object.keys(tempIdMap).length === 0) return data;
  const out = { ...data };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== 'string') continue;
    if (k !== 'id' && !k.endsWith('_id')) continue;
    if (tempIdMap[v]) out[k] = tempIdMap[v];
  }
  return out;
}

/** Strip sync-layer metadata before a row hits Supabase. */
function cleanForSupabase(data) {
  if (!data || typeof data !== 'object') return data;
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
  if (clean.id && typeof clean.id === 'string' && clean.id.startsWith('temp_')) {
    delete clean.id;
  }
  return clean;
}

/**
 * Apply a single op to Supabase. Returns:
 *   - `{ inserted }` for inserts (the row Supabase returned)
 *   - `{ updated, conflict }` for updates (conflict = true if server clobbered)
 *   - `{ id }` for deletes
 */
async function applyOpOnce(table, operation, data) {
  if (operation === 'insert') {
    const clean = cleanForSupabase(data);
    const { data: inserted, error } = await supabase
      .from(table).insert(clean).select().single();
    if (error) throw error;
    return { inserted };
  }
  if (operation === 'update') {
    const expected = data._expected_updated_at;
    const clean = cleanForSupabase(data);
    const id = clean.id;
    let conflict = false;
    if (expected) {
      // Pre-flight read; if the server-side updated_at differs, flag a conflict.
      // We still apply the update (last-write-wins) but warn the caller.
      const { data: current, error: readErr } = await supabase
        .from(table).select('updated_at').eq('id', id).maybeSingle();
      if (!readErr && current && current.updated_at &&
          current.updated_at !== expected) {
        conflict = true;
      }
    }
    const { id: _omit, ...fields } = clean;
    const { data: updated, error } = await supabase
      .from(table).update(fields).eq('id', id).select();
    if (error) throw error;
    return { updated: updated?.[0], conflict };
  }
  if (operation === 'delete') {
    const id = data.id;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return { id };
  }
  throw new Error(`Unknown operation: ${operation}`);
}

/**
 * Apply an op with retry + exponential backoff. Throws on permanent failure
 * or when MAX_ATTEMPTS is exhausted. Mutates `entryValue._attempts` and
 * `entryValue._last_error` so the caller can persist them on failure.
 */
async function applyOpWithRetry(table, operation, data, entryValue, verbose) {
  let attempt = entryValue.data?._attempts ?? 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await applyOpOnce(table, operation, data);
    } catch (err) {
      attempt++;
      entryValue.data._attempts = attempt;
      entryValue.data._last_error = String(err?.message || err);
      if (!isRetryableError(err) || attempt >= MAX_ATTEMPTS) {
        throw err;
      }
      const wait = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CAP_MS);
      if (verbose) {
        console.warn(
          `[sync] retry ${attempt}/${MAX_ATTEMPTS} for ${operation} ${table} ` +
          `in ${wait}ms (${entryValue.data._last_error})`
        );
      }
      await sleep(wait);
    }
  }
}

/** Update local cache after a successful insert; preserves other temp rows. */
async function applyInsertLocally(table, tempId, inserted) {
  const existing = await getData(table);
  const filtered = existing.filter(r => r.id !== tempId);
  filtered.push(inserted);
  await saveData(table, filtered);
}

/** Update local cache after a successful update. */
async function applyUpdateLocally(table, id, updated) {
  if (!updated) return;
  const existing = await getData(table);
  const merged = existing.map(r => (r.id === id ? updated : r));
  await saveData(table, merged);
}

// ---------- public API ----------

/**
 * Drain the offline queue. Idempotent, retry-aware, and conflict-detecting.
 * Public signature unchanged — `verbose` toggles console logging.
 *
 * @param {boolean} [verbose=false]
 * @returns {Promise<{successCount:number, failCount:number, conflictCount:number, alreadySyncing?:boolean}>}
 */
export async function syncOfflineChanges(verbose = false) {
  if (isSyncing.value) {
    if (verbose) console.log('[syncOfflineChanges] Already syncing, skipping');
    return { successCount: 0, failCount: 0, conflictCount: 0, alreadySyncing: true };
  }
  isSyncing.value = true;
  const toast = typeof window !== 'undefined' ? useToast() : null;

  try {
    // Opportunistic cache version sweep — cheap when no version bump happened.
    await invalidateStaleCaches();

    const entries = await getAllOfflineChangesWithKeys();
    if (verbose) console.log(`[syncOfflineChanges] Found ${entries.length} items to sync`);

    let successCount = 0;
    let failCount = 0;
    let conflictCount = 0;
    let tempIdMap = await getTempIdMap();
    let tempIdMapDirty = false;

    for (const entry of entries) {
      const { key, value } = entry;
      const { table, operation } = value;
      let { data } = value;

      try {
        // Default project_id from settings if missing (offline-queued ops sometimes lose it).
        if (data && !data.project_id) {
          const projectId = await getSetting('current-project-id');
          if (projectId) data = { ...data, project_id: projectId };
        }

        // Step 1: rewrite stale temp ids using the persisted map.
        data = rewriteTempIds(data, tempIdMap);

        if (verbose) {
          console.log(
            `[syncOfflineChanges] ${operation.toUpperCase()} ${table} ` +
            `(op_uuid=${data?._op_uuid || 'none'})`, data
          );
        }

        // Step 2: idempotency short-circuit.
        const opUuid = data?._op_uuid;
        if (opUuid) {
          const prior = await getCompletedOp(opUuid);
          if (prior) {
            if (verbose) console.log(`[syncOfflineChanges] op ${opUuid} already applied, skipping`);
            // If a prior insert created the row, make sure the map is fresh.
            if (operation === 'insert' && prior.serverId && data._temp_id) {
              if (tempIdMap[data._temp_id] !== prior.serverId) {
                tempIdMap[data._temp_id] = prior.serverId;
                tempIdMapDirty = true;
              }
            }
            await deleteOfflineChangeByKey(key);
            successCount++;
            continue;
          }
        }

        // Step 3 + 4: apply with retry. May throw on permanent failure.
        const result = await applyOpWithRetry(table, operation, data, value, verbose);

        // Step 5: update local cache, record idempotency, learn temp→real id.
        if (operation === 'insert' && result.inserted) {
          const realId = result.inserted.id;
          const tempId = data._temp_id || data.id;
          if (tempId && realId && tempId !== realId) {
            tempIdMap[tempId] = realId;
            tempIdMapDirty = true;
          }
          await applyInsertLocally(table, tempId, result.inserted);
          await markOpCompleted(opUuid, { table, operation, serverId: realId });
        } else if (operation === 'update') {
          if (result.conflict) {
            conflictCount++;
            if (verbose) {
              console.warn(
                `[syncOfflineChanges] CONFLICT on ${table} id=${data.id}: ` +
                `server moved past _expected_updated_at — applied last-write-wins`
              );
            }
          }
          await applyUpdateLocally(table, data.id, result.updated);
          await markOpCompleted(opUuid, { table, operation, serverId: data.id });
        } else if (operation === 'delete') {
          await deleteData(table, result.id);
          await markOpCompleted(opUuid, { table, operation, serverId: result.id });
        }

        await deleteOfflineChangeByKey(key);
        successCount++;
      } catch (err) {
        console.error('[syncOfflineChanges] Failed to sync change:', err, value);
        failCount++;
        // Persist the attempt count + last error so a future sync starts from
        // here rather than at zero. The op remains in the queue for next time.
        try {
          await setCacheMeta({
            key: `failed_op:${value?.data?._op_uuid || key}`,
            attempts: value?.data?._attempts ?? 0,
            lastError: value?.data?._last_error || String(err?.message || err),
            failedAt: Date.now(),
            table,
            operation,
          });
        } catch (_) { /* best-effort */ }
      }
    }

    if (tempIdMapDirty) {
      await setTempIdMap(tempIdMap);
    }

    if (toast && successCount > 0) {
      const conflictSuffix = conflictCount > 0
        ? ` — ${conflictCount} conflict${conflictCount === 1 ? '' : 's'} (last-write-wins)`
        : '';
      const failSuffix = failCount ? ` (${failCount} failed)` : '';
      toast.success(`Synced ${successCount} changes${conflictSuffix}${failSuffix}`);
    } else if (toast && conflictCount > 0) {
      toast.warning(
        `${conflictCount} conflict${conflictCount === 1 ? '' : 's'} resolved with last-write-wins`
      );
    }
    lastSyncedAt.value = Date.now();
    return { successCount, failCount, conflictCount };
  } catch (err) {
    console.error('[syncOfflineChanges] Failed to sync queue:', err);
    if (typeof window !== 'undefined') useToast()?.error('Failed to sync offline changes');
    throw err;
  } finally {
    isSyncing.value = false;
  }
}

/**
 * Manual "sync now" trigger — used by the header chip and any UI button.
 * Returns a small status object so the caller can decide whether to surface
 * feedback. Public signature unchanged.
 */
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

/**
 * Breakdown of pending changes grouped by table name. Used for tooltips/popovers.
 * Public signature unchanged.
 */
export async function getPendingBreakdown() {
  const changes = await getAllOfflineChangesWithKeys();
  const byTable = {};
  for (const { value } of changes) {
    const t = value.table || 'unknown';
    byTable[t] = (byTable[t] || 0) + 1;
  }
  return byTable;
}

// Surface the active cache schema version so callers can correlate logs.
export const cacheSchemaVersion = CACHE_SCHEMA_VERSION;
