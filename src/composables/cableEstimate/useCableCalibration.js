import { ref, computed } from 'vue'
import { getCalibration, saveCalibration, clearCalibration } from '@/services/cableEstimateService'

/**
 * Owns the per-stage floor-plan calibration used to turn on-plan distances into
 * real cable lengths. Supports MULTIPLE reference measurements: you draw several
 * known distances and the scale is averaged across them, so an imperfect floor
 * plan doesn't hinge on one line. Backward-compatible with the old single
 * { p1, p2, realLength, unit } shape on load.
 *
 * Saved shape: { refs: [{ p1, p2, realLength, unit }], unit, imageRef }.
 * The canvas draw loop reads draftRefs / draftP1 / draftP2 / isCalibrating.
 *
 * @param {object} args
 * @param {() => (string|number|null)} args.getLocationId
 * @param {() => (string|null)} args.getImageRef  current floor-plan path (staleness check)
 */
export function useCableCalibration({ getLocationId, getImageRef }) {
  const calibration = ref(null)     // saved { refs, unit, imageRef }
  const loading = ref(false)
  const saving = ref(false)
  const isCalibrating = ref(false)  // reference-line draw mode active
  const draftRefs = ref([])         // references added this session, pre-save
  const draftP1 = ref(null)         // first point of the line being drawn
  const draftP2 = ref(null)         // second point
  const showModal = ref(false)      // prompt for the real length of the drawn line

  const savedRefs = computed(() => refsOf(calibration.value))
  const isCalibrated = computed(() => savedRefs.value.some(r => r?.p1 && r?.p2 && Number(r.realLength) > 0))
  const referenceCount = computed(() => savedRefs.value.length)

  // Calibration is stale if the floor-plan image was swapped since it was set.
  const isStale = computed(() => {
    const current = getImageRef?.()
    const saved = calibration.value?.imageRef
    return !!(isCalibrated.value && current && saved && current !== saved)
  })

  async function load() {
    const locId = getLocationId?.()
    if (!locId) {
      calibration.value = null
      return
    }
    loading.value = true
    try {
      calibration.value = await getCalibration(locId)
    } finally {
      loading.value = false
    }
  }

  function startCalibration() {
    // Seed with the existing references so you can add to / prune them.
    draftRefs.value = savedRefs.value.map(r => ({ ...r }))
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
    isCalibrating.value = true
  }

  function cancelCalibration() {
    isCalibrating.value = false
    draftRefs.value = []
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
  }

  /** Record a clicked point (normalized 0..1). Two points open the length modal. */
  function addPoint(imgX, imgY) {
    if (!isCalibrating.value) return
    const pt = { x: imgX, y: imgY }
    if (!draftP1.value) draftP1.value = pt
    else if (!draftP2.value) {
      draftP2.value = pt
      showModal.value = true
    }
  }

  /** Add the just-drawn line as a reference; stays in calibrate mode for more. */
  function addReference(realLength, unit) {
    if (!draftP1.value || !draftP2.value) return
    draftRefs.value = [
      ...draftRefs.value,
      { p1: draftP1.value, p2: draftP2.value, realLength: Number(realLength), unit: unit === 'ft' ? 'ft' : 'm' },
    ]
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
  }

  /** Discard the in-progress line (modal cancel) without leaving calibrate mode. */
  function cancelPoint() {
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
  }

  function removeDraftRef(index) {
    if (index < 0 || index >= draftRefs.value.length) return
    const next = [...draftRefs.value]
    next.splice(index, 1)
    draftRefs.value = next
  }

  /** Persist all drafted references as the calibration. */
  async function finish() {
    const locId = getLocationId?.()
    if (!locId) return null
    const refs = draftRefs.value.filter(r => r?.p1 && r?.p2 && Number(r.realLength) > 0)
    if (!refs.length) {
      cancelCalibration()
      return null
    }
    const payload = { refs, unit: refs[0].unit || 'm', imageRef: getImageRef?.() || null }
    saving.value = true
    try {
      await saveCalibration(locId, payload)
      calibration.value = payload
      isCalibrating.value = false
      draftRefs.value = []
      draftP1.value = null
      draftP2.value = null
      return payload
    } finally {
      saving.value = false
    }
  }

  async function reset() {
    const locId = getLocationId?.()
    if (locId) await clearCalibration(locId)
    calibration.value = null
    cancelCalibration()
  }

  return {
    calibration,
    loading,
    saving,
    isCalibrating,
    draftRefs,
    draftP1,
    draftP2,
    showModal,
    savedRefs,
    isCalibrated,
    isStale,
    referenceCount,
    load,
    startCalibration,
    cancelCalibration,
    addPoint,
    addReference,
    cancelPoint,
    removeDraftRef,
    finish,
    reset,
  }
}

function refsOf(cal) {
  if (!cal) return []
  if (Array.isArray(cal.refs)) return cal.refs
  if (cal.p1 && cal.p2 && Number(cal.realLength) > 0) {
    return [{ p1: cal.p1, p2: cal.p2, realLength: cal.realLength, unit: cal.unit }]
  }
  return []
}
