// Composable for stage hours logic
import { ref, unref } from 'vue'
import { fetchTableData } from '@/services/dataService'
import { getSetting } from '@/utils/indexedDB'
import { toDateTime } from '@/utils/scheduleHelpers'

export function useStageHours(locationId) {
  const stageHours = ref([])

  async function loadStageHours() {
    const projectId = await getSetting('current-project-id')
    const locId = unref(locationId)
    const all = await fetchTableData('stage_hours', {
      eq: { project_id: projectId, stage_id: locId },
      order: { column: 'start_datetime', ascending: true }
    })
    // Signal mapper / mic placement track recording days only.
    stageHours.value = (all || []).filter(s => (s.category || 'recording') === 'recording')
  }

  function formatStageHourFallback(sh) {
    const start = new Date(sh.start_datetime)
    const dayNum = sh.order_index || ''
    const nice = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    return `Day ${dayNum} (${nice})`
  }

  function findStageHourIdFor(dateStr, timeStr) {
    const dt = toDateTime(dateStr, timeStr)
    if (!dt) return null
    for (const sh of stageHours.value) {
      const s = new Date(sh.start_datetime)
      const e = new Date(sh.end_datetime)
      if (dt >= s && dt <= e) return sh.id
    }
    return null
  }

  function getRecordingDayDisplay(item) {
    if (!item || !item.stage_hour_id) return '-'
    const sh = stageHours.value.find(s => s.id === item.stage_hour_id)
    return sh ? (sh.notes || formatStageHourFallback(sh)) : '-'
  }

  return {
    stageHours,
    loadStageHours,
    formatStageHourFallback,
    findStageHourIdFor,
    getRecordingDayDisplay
  }
}

