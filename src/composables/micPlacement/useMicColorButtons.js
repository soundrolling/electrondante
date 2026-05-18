import { ref, computed } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import { mutateTableData } from '@/services/dataService'

/**
 * Color-button state + CRUD for MicPlacement.
 *
 * Owns:
 *   - `colorButtons` (raw rows from `mic_color_buttons` for project/location scope)
 *   - modal + form state for add/edit
 *   - dedup computed maps used by the legend + selector UI
 *
 * Caller passes:
 *   - getters for projectId, locationId, nodes
 *   - a `getSelectedMic()` accessor + a `saveMic` action so applying a colour
 *     to the active selection delegates back to the parent.
 */
export function useMicColorButtons({ getProjectId, getLocationId, getNodes, getSelectedMic, saveMic }) {
  const toast = useToast()

  const colorButtons = ref([])
  const editingColorButton = ref(null)
  const colorButtonForm = ref({ name: '', color: '', description: '' })
  const showColorButtonModal = ref(false)
  const colorButtonBusy = ref(false)
  const showLegendManagement = ref(false)

  // Map color_button_id -> sorted array of placed-mic track names.
  const nodeNamesByButtonId = computed(() => {
    const out = {}
    for (const n of getNodes() || []) {
      if (!n.color_button_id) continue
      const name = (n.track_name || n.label || '').trim()
      if (!name) continue
      if (!out[n.color_button_id]) out[n.color_button_id] = []
      out[n.color_button_id].push(name)
    }
    Object.keys(out).forEach(k => {
      out[k].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    })
    return out
  })

  function colorButtonKey(btn) {
    return `${String(btn?.color || '').toLowerCase()}|${String(btn?.name || '').trim().toLowerCase()}`
  }

  // One representative button per (colour, name) pair, preserving source order.
  const uniqueColorButtons = computed(() => {
    const seen = new Map()
    for (const btn of colorButtons.value || []) {
      const key = colorButtonKey(btn)
      if (!seen.has(key)) seen.set(key, btn)
    }
    return Array.from(seen.values())
  })

  // Map every color_button id -> its dedup key.
  const colorKeyByButtonId = computed(() => {
    const out = {}
    for (const btn of colorButtons.value || []) {
      out[btn.id] = colorButtonKey(btn)
    }
    return out
  })

  // Merged node-name list keyed by the dedup key, not by button id.
  const nodeNamesByColorKey = computed(() => {
    const out = {}
    for (const [btnId, names] of Object.entries(nodeNamesByButtonId.value)) {
      const key = colorKeyByButtonId.value[btnId]
      if (!key) continue
      if (!out[key]) out[key] = []
      out[key].push(...names)
    }
    for (const k of Object.keys(out)) {
      out[k] = Array.from(new Set(out[k])).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      )
    }
    return out
  })

  const uniqueLegendButtons = computed(() => {
    return uniqueColorButtons.value.filter(btn => {
      const key = colorButtonKey(btn)
      return (nodeNamesByColorKey.value[key] || []).length > 0
    })
  })

  // Legend entries grouped by gear type - one row per unique colour+name pair.
  const legendEntriesByMic = computed(() => {
    const groups = new Map()
    for (const n of getNodes() || []) {
      if (!n.color_button_id) continue
      const btn = (colorButtons.value || []).find(b => b.id === n.color_button_id)
      if (!btn) continue
      const key = colorButtonKey(btn)
      if (!groups.has(key)) {
        groups.set(key, { key, gearName: btn.name || '', color: btn.color || '#ccc', count: 0 })
      }
      groups.get(key).count++
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.gearName.localeCompare(b.gearName, undefined, { sensitivity: 'base' })
    )
  })

  function isDedupBtnActive(btn) {
    const cur = getSelectedMic()
    if (!cur?.color_button_id) return false
    const curKey = colorKeyByButtonId.value[cur.color_button_id]
    return !!curKey && curKey === colorButtonKey(btn)
  }

  function getColorButtonForMic(mic) {
    if (!mic?.color_button_id) return null
    return colorButtons.value.find(btn => btn.id === mic.color_button_id)
  }

  async function fetchColorButtons() {
    try {
      let query = supabase
        .from('mic_color_buttons')
        .select('*')
        .eq('project_id', getProjectId())

      const locId = getLocationId()
      if (locId) {
        query = query.or(`location_id.eq.${locId},location_id.is.null`)
      } else {
        query = query.is('location_id', null)
      }

      const { data, error } = await query.order('name')
      if (error) throw error
      colorButtons.value = data || []
    } catch (err) {
      console.error('Error fetching color buttons:', err)
      colorButtons.value = []
    }
  }

  function openColorButtonModal() {
    editingColorButton.value = null
    colorButtonForm.value = { name: '', color: '', description: '', error: null }
    showColorButtonModal.value = true
  }

  function updateColorPreview() {
    // Vue reactivity handles this automatically
  }

  function closeColorButtonModal() {
    showColorButtonModal.value = false
    editingColorButton.value = null
    colorButtonForm.value = { name: '', color: '', description: '', error: null }
  }

  function editColorButton(idx) {
    const btn = colorButtons.value[idx]
    editingColorButton.value = idx
    colorButtonForm.value = {
      name: btn.name,
      color: btn.color,
      description: btn.description || '',
      error: null
    }
    showColorButtonModal.value = true
  }

  async function saveColorButton() {
    if (!colorButtonForm.value.name || !colorButtonForm.value.color) {
      colorButtonForm.value.error = 'Name and color are required'
      return
    }

    colorButtonForm.value.error = null
    colorButtonBusy.value = true

    try {
      const payload = {
        name: colorButtonForm.value.name,
        color: colorButtonForm.value.color,
        description: colorButtonForm.value.description || null,
        project_id: getProjectId(),
        location_id: getLocationId() || null
      }

      if (editingColorButton.value !== null) {
        await mutateTableData(
          'mic_color_buttons',
          'update',
          { id: colorButtons.value[editingColorButton.value].id, ...payload }
        )
      } else {
        await mutateTableData('mic_color_buttons', 'insert', payload)
      }

      await fetchColorButtons()
      closeColorButtonModal()
      toast.success('Color button saved')
    } catch (err) {
      colorButtonForm.value.error = err.message || 'Failed to save color button'
      console.error('Error saving color button:', err)
    } finally {
      colorButtonBusy.value = false
    }
  }

  async function deleteColorButtonById(id, idx) {
    try {
      await mutateTableData('mic_color_buttons', 'delete', { id })
      colorButtons.value.splice(idx, 1)
      toast.success('Color button deleted')
    } catch (err) {
      console.error('Error deleting color button:', err)
      toast.error('Failed to delete color button')
    }
  }

  async function applyColorButtonToMic(buttonId) {
    const mic = getSelectedMic()
    if (!mic) return
    mic.color_button_id = buttonId
    await saveMic(mic)
  }

  async function findOrCreateColorButtonForGear(mic) {
    if (!mic?.default_color) return null
    let existing = colorButtons.value.find(
      btn => btn.color.toLowerCase() === mic.default_color.toLowerCase() &&
        (btn.location_id === getLocationId() || (!btn.location_id && !getLocationId()))
    )

    if (!existing) {
      try {
        const newButton = await mutateTableData('mic_color_buttons', 'insert', {
          name: mic.gear_name,
          color: mic.default_color,
          description: `Default color for ${mic.gear_name}`,
          project_id: getProjectId(),
          location_id: getLocationId() || null
        })
        await fetchColorButtons()
        existing = colorButtons.value.find(btn => btn.id === newButton.id)
      } catch (err) {
        console.warn('Failed to create color button for gear default color:', err)
      }
    }
    return existing ? existing.id : null
  }

  return {
    colorButtons,
    editingColorButton,
    colorButtonForm,
    showColorButtonModal,
    colorButtonBusy,
    showLegendManagement,

    nodeNamesByButtonId,
    uniqueColorButtons,
    colorKeyByButtonId,
    nodeNamesByColorKey,
    uniqueLegendButtons,
    legendEntriesByMic,

    isDedupBtnActive,
    getColorButtonForMic,
    fetchColorButtons,
    openColorButtonModal,
    updateColorPreview,
    closeColorButtonModal,
    editColorButton,
    saveColorButton,
    deleteColorButtonById,
    applyColorButtonToMic,
    findOrCreateColorButtonForGear,
    colorButtonKey
  }
}
