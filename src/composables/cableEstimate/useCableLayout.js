import { ref } from 'vue'
import { getLayout, saveLayout } from '@/services/cableEstimateService'

/**
 * Owns the per-stage cabling layout: position overrides (drag a node in the
 * Cabling view without moving the mic on the floor plan) and cable waypoints
 * (turning points to route a run around obstacles). All of it is keyed by node
 * / connection id and stored separately from mic placement + signal flow.
 *
 * Mutations reassign the `positions` / `waypoints` sub-objects (new refs) so the
 * estimate computed re-runs, and persistence is debounced to avoid hammering
 * the DB during a drag.
 *
 * @param {object} args
 * @param {() => (string|number|null)} args.getLocationId
 */
export function useCableLayout({ getLocationId }) {
  const layout = ref(emptyLayout())
  const loading = ref(false)
  let saveTimer = null

  function emptyLayoutLocal() {
    return emptyLayout()
  }

  async function load() {
    const locId = getLocationId?.()
    if (!locId) {
      layout.value = emptyLayout()
      return
    }
    loading.value = true
    try {
      layout.value = normalize(await getLayout(locId))
    } finally {
      loading.value = false
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 500)
  }

  async function persist() {
    saveTimer = null
    const locId = getLocationId?.()
    if (!locId) return
    try {
      await saveLayout(locId, layout.value)
    } catch {
      // Non-fatal: layout is a convenience overlay; surfaced upstream if needed.
    }
  }

  /** Persist immediately (e.g. on unmount) if a save is pending. */
  function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    persist()
  }

  // ── Position overrides ───────────────────────────────────────
  function setNodePosition(nodeId, x, y) {
    layout.value.positions = { ...layout.value.positions, [nodeId]: { x, y } }
    scheduleSave()
  }
  function clearNodePosition(nodeId) {
    if (!(nodeId in layout.value.positions)) return
    const next = { ...layout.value.positions }
    delete next[nodeId]
    layout.value.positions = next
    scheduleSave()
  }

  // ── Cable waypoints ──────────────────────────────────────────
  function getWaypoints(connId) {
    return layout.value.waypoints[connId] || []
  }
  function addWaypoint(connId, point, index = null) {
    const arr = [...(layout.value.waypoints[connId] || [])]
    if (index == null || index >= arr.length) arr.push(point)
    else arr.splice(Math.max(0, index), 0, point)
    layout.value.waypoints = { ...layout.value.waypoints, [connId]: arr }
    scheduleSave()
    return index == null || index >= arr.length - 1 ? arr.length - 1 : index
  }
  function moveWaypoint(connId, index, point) {
    const arr = [...(layout.value.waypoints[connId] || [])]
    if (index < 0 || index >= arr.length) return
    arr[index] = point
    layout.value.waypoints = { ...layout.value.waypoints, [connId]: arr }
    scheduleSave()
  }
  function removeWaypoint(connId, index) {
    const arr = [...(layout.value.waypoints[connId] || [])]
    if (index < 0 || index >= arr.length) return
    arr.splice(index, 1)
    const next = { ...layout.value.waypoints }
    if (arr.length) next[connId] = arr
    else delete next[connId]
    layout.value.waypoints = next
    scheduleSave()
  }

  // ── Cable types (per connection) ─────────────────────────────
  function getCable(connId) {
    return layout.value.cables[connId] || null
  }
  function setCable(connId, type) {
    const next = { ...layout.value.cables }
    const t = (type || '').trim()
    if (t) next[connId] = { type: t }
    else delete next[connId]
    layout.value.cables = next
    scheduleSave()
  }

  /** Clear ALL overrides + waypoints for this stage. */
  function reset() {
    layout.value = emptyLayout()
    scheduleSave()
  }

  return {
    layout,
    loading,
    load,
    flush,
    setNodePosition,
    clearNodePosition,
    getWaypoints,
    addWaypoint,
    moveWaypoint,
    removeWaypoint,
    getCable,
    setCable,
    reset,
    emptyLayout: emptyLayoutLocal,
  }
}

function emptyLayout() {
  return { positions: {}, waypoints: {}, cables: {} }
}

function normalize(raw) {
  const l = emptyLayout()
  if (raw && typeof raw === 'object') {
    if (raw.positions && typeof raw.positions === 'object') l.positions = { ...raw.positions }
    if (raw.waypoints && typeof raw.waypoints === 'object') l.waypoints = { ...raw.waypoints }
    if (raw.cables && typeof raw.cables === 'object') l.cables = { ...raw.cables }
  }
  return l
}
