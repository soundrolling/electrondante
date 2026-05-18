import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { addNode, updateNode, deleteNode, getConnections, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'

/**
 * High-level mic actions: placement (orientation modal), save updates,
 * cascade-delete with connection cleanup, and the gear-picker state.
 *
 * Caller provides:
 *   - props (projectId, locationId, stageHourId, nodes, gearList)
 *   - the canvas-view transforms so a newly placed mic lands at canvas centre
 *   - the colour-button composable so default_color gear auto-creates buttons
 *   - the `emit` function for parent-facing events
 *   - the redraw + ctx-menu close hooks so post-action state is clean
 */
export function useMicPlacementActions({
  props,
  emit,
  canvasWidth,
  canvasHeight,
  canvasToImageCoords,
  findOrCreateColorButtonForGear,
  showDeleteConfirmation,
  closeContextMenu,
  drawCanvas
}) {
  const toast = useToast()

  const showGearModal = ref(false)
  const selectedMicForOrientation = ref(null)
  const selectedOrientation = ref(null)
  const trackNameInput = ref('')

  const availableMics = computed(() => {
    return props.gearList.filter(g =>
      (g.gear_type === 'source' || g.gear_type?.includes('source')) &&
      g.assignments?.[props.locationId] > 0
    )
  })

  function getAvailableCount(mic) {
    const assigned = mic.assignments?.[props.locationId] || 0
    const placed = props.nodes.filter(n => n.gear_id === mic.id).length
    return Math.max(0, assigned - placed)
  }

  function openGearModal() {
    showGearModal.value = true
  }

  function closeGearModal() {
    showGearModal.value = false
    selectedMicForOrientation.value = null
    selectedOrientation.value = null
    trackNameInput.value = ''
  }

  function cancelOrientation() {
    selectedMicForOrientation.value = null
    selectedOrientation.value = null
    trackNameInput.value = ''
  }

  function selectMicForOrientation(mic) {
    const available = getAvailableCount(mic)
    if (available <= 0) {
      toast.error('No more units of this microphone available')
      return
    }
    selectedMicForOrientation.value = mic
    selectedOrientation.value = 0
    trackNameInput.value = mic.gear_name
  }

  async function placeMic() {
    const mic = selectedMicForOrientation.value
    const rotation = selectedOrientation.value
    const trackName = trackNameInput.value.trim()

    if (!mic || rotation === null) return
    if (!trackName) {
      toast.error('Track name is required')
      return
    }

    try {
      const centerX = canvasWidth.value / 2
      const centerY = canvasHeight.value / 2
      const imgCoords = canvasToImageCoords(centerX, centerY)

      const colorButtonId = await findOrCreateColorButtonForGear(mic)

      const newNode = await addNode({
        project_id: props.projectId,
        location_id: props.locationId || null,
        stage_hour_id: props.stageHourId || null,
        type: 'gear',
        gear_id: mic.id,
        label: mic.gear_name,
        track_name: trackName,
        x: imgCoords.imgX,
        y: imgCoords.imgY,
        rotation: rotation,
        gear_type: 'source',
        num_inputs: mic.num_inputs || 0,
        num_outputs: mic.num_outputs || 1,
        num_tracks: 0,
        color_button_id: colorButtonId
      })

      emit('node-added', newNode)
      closeGearModal()
      toast.success(`Added ${trackName}`)
      drawCanvas && drawCanvas()
    } catch (err) {
      console.error('Error adding mic:', err)
      toast.error('Failed to add microphone')
    }
  }

  async function saveMicUpdate(mic) {
    try {
      await updateNode({
        id: mic.id,
        x: mic.x,
        y: mic.y,
        rotation: mic.rotation,
        track_name: mic.track_name,
        color_button_id: mic.color_button_id || null
      })
      emit('node-updated', mic)
    } catch (err) {
      console.error('Error updating mic:', err)
      toast.error('Failed to update microphone')
    }
  }

  async function cascadeDeleteNode(nodeId) {
    const allConnections = await getConnections(props.projectId)
    const outgoingConns = allConnections.filter(c => c.from_node_id === nodeId)
    const incomingConns = allConnections.filter(c => c.to_node_id === nodeId)

    const allConnIds = [...outgoingConns.map(c => c.id), ...incomingConns.map(c => c.id)]

    if (allConnIds.length > 0) {
      try {
        await supabase
          .from('connection_port_map')
          .delete()
          .in('connection_id', allConnIds)
      } catch (err) {
        console.error('Error deleting port mappings:', err)
      }
    }

    if (allConnIds.length > 0) {
      try {
        const { error: connError } = await supabase
          .from('connections')
          .delete()
          .in('id', allConnIds)

        if (connError) {
          console.error('Error batch deleting connections:', connError)
          throw connError
        }

        allConnIds.forEach(id => emit('connection-deleted', id))
      } catch (err) {
        console.error('Error deleting connections:', err)
        for (const conn of [...outgoingConns, ...incomingConns]) {
          try {
            await deleteConnectionFromDB(conn.id)
            emit('connection-deleted', conn.id)
          } catch (fallbackErr) {
            console.error('Error deleting connection:', fallbackErr)
          }
        }
      }
    }

    try {
      await deleteNode(nodeId)
      emit('node-deleted', nodeId)
    } catch (err) {
      console.error('Error deleting node:', err)
      throw err
    }
  }

  function deleteSelectedFactory(getSelectedMic, setSelectedMic) {
    return async function deleteSelected() {
      const selected = getSelectedMic()
      if (!selected) return

      const isGearSource = selected.gear_id && selected.gear_type === 'source'
      if (!isGearSource) {
        toast.error('Only gear source nodes can be deleted from Mic Placement view.')
        return
      }

      const micLabel = selected.track_name || selected.label
      const message = `Delete microphone "${micLabel}"?`
      const warning = 'This will permanently delete the microphone and all its connections. This action cannot be undone.'

      showDeleteConfirmation(message, warning, async () => {
        try {
          await cascadeDeleteNode(selected.id)
          setSelectedMic(null)
          closeContextMenu && closeContextMenu()
          toast.success(`${micLabel} and connections deleted`)
          drawCanvas && drawCanvas()
        } catch (err) {
          console.error('Error deleting mic:', err)
          toast.error('Failed to delete microphone')
        }
      })
    }
  }

  return {
    showGearModal,
    selectedMicForOrientation,
    selectedOrientation,
    trackNameInput,
    availableMics,
    getAvailableCount,
    openGearModal,
    closeGearModal,
    cancelOrientation,
    selectMicForOrientation,
    placeMic,
    saveMicUpdate,
    cascadeDeleteNode,
    deleteSelectedFactory
  }
}
