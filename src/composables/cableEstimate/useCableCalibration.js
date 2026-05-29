import { ref, computed } from 'vue'
import { getCalibration, saveCalibration, clearCalibration } from '@/services/cableEstimateService'

/**
 * Owns the per-stage floor-plan calibration used to turn on-plan distances into
 * real cable lengths. Holds the saved calibration, drives the two-point
 * reference-line draw interaction, and persists via cableEstimateService.
 *
 * The canvas draw loop reads `draftP1`/`draftP2`/`isCalibrating` to render the
 * in-progress line; this composable doesn't touch the canvas itself.
 *
 * @param {object} args
 * @param {() => (string|number|null)} args.getLocationId
 * @param {() => (string|null)} args.getImageRef  current floor-plan storage path (staleness check)
 */
export function useCableCalibration({ getLocationId, getImageRef }) {
  const calibration = ref(null)     // saved { p1, p2, realLength, unit, imageRef }
  const loading = ref(false)
  const saving = ref(false)
  const isCalibrating = ref(false)  // reference-line draw mode active
  const draftP1 = ref(null)         // first point (normalized 0..1), while drawing
  const draftP2 = ref(null)         // second point
  const showModal = ref(false)      // prompt for the real length once 2 points exist

  const isCalibrated = computed(() =>
    !!(calibration.value?.p1 && calibration.value?.p2 && Number(calibration.value?.realLength) > 0),
  )

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
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
    isCalibrating.value = true
  }

  function cancelCalibration() {
    isCalibrating.value = false
    draftP1.value = null
    draftP2.value = null
    showModal.value = false
  }

  /** Record a clicked point (normalized 0..1). Two points open the length modal. */
  function addPoint(imgX, imgY) {
    if (!isCalibrating.value) return
    const pt = { x: imgX, y: imgY }
    if (!draftP1.value) {
      draftP1.value = pt
    } else if (!draftP2.value) {
      draftP2.value = pt
      showModal.value = true
    }
  }

  /** Persist the drawn line + the real length the user typed. */
  async function confirm(realLength, unit) {
    const locId = getLocationId?.()
    if (!locId || !draftP1.value || !draftP2.value) return null
    const payload = {
      p1: draftP1.value,
      p2: draftP2.value,
      realLength: Number(realLength),
      unit: unit === 'ft' ? 'ft' : 'm',
      imageRef: getImageRef?.() || null,
    }
    saving.value = true
    try {
      await saveCalibration(locId, payload)
      calibration.value = payload
      isCalibrating.value = false
      showModal.value = false
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
    draftP1,
    draftP2,
    showModal,
    isCalibrated,
    isStale,
    load,
    startCalibration,
    cancelCalibration,
    addPoint,
    confirm,
    reset,
  }
}
