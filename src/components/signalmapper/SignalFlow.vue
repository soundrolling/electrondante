<template>
<div class="signal-flow-container">
  <div class="flow-header">
    <h3>Signal Flow</h3>
    <p>Connect sources, transformers, and recorders to build your signal chain</p>
  </div>

  <!-- Toolbar -->
  <div class="flow-toolbar">
    <button class="tool-btn select-btn" :class="{ active: tool === 'select' }" @click="tool = 'select'">
      👆 Select
    </button>
    <button class="tool-btn link-btn" :class="{ active: tool === 'link' }" @click="tool = 'link'">
      🔗 Connect
    </button>
    <button @click="openGearModal" class="btn-add">
      ➕ Add Gear
    </button>
    <button @click="openSourceModal" class="btn-add">
      ➕ Add Source
    </button>
    <button @click="deleteSelected" :disabled="!selectedNode" class="btn-danger">
      🗑️ Delete
    </button>
    <div class="toolbar-divider"></div>
    <span class="node-count">
      Sources: {{ sourceCount }} | Transformers: {{ transformerCount }} | Recorders: {{ recorderCount }}
    </span>
    <button class="tool-btn" @click="exportFlowPng" title="Export canvas as PNG">
      📤 Export
    </button>
    <button class="tool-btn" @click="printFlow" title="Print signal flow">
      🖨️ Print
    </button>
    <div class="toolbar-divider"></div>
    <div class="zoom-controls">
      <button class="tool-btn zoom-btn" @click="zoomOut" title="Zoom out" :disabled="zoomLevel <= 0.25">
        ➖
      </button>
      <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
      <button class="tool-btn zoom-btn" @click="zoomIn" title="Zoom in" :disabled="zoomLevel >= 4">
       ➕
      </button>
      <button class="tool-btn zoom-btn" @click="resetZoom" title="Reset zoom">
        🔄
      </button>
    </div>
  </div>

  <!-- Canvas -->
  <div class="canvas-wrapper" ref="canvasWrapper">
    <canvas 
      ref="canvas" 
      :width="canvasWidth * dpr" 
      :height="canvasHeight * dpr"
      :style="canvasStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
    <div v-if="tool === 'link'" class="tool-indicator">
      <template v-if="linkSource">
        Connecting from: {{ linkSource.track_name || linkSource.label }} (click target node)
      </template>
      <template v-else>
        Select your first connection node
      </template>
    </div>
    <div v-if="selectedConnectionId" class="connection-details" :style="detailsStyle">
      <h4>Connection Details</h4>
      <div class="detail-row">
        <span class="label">From:</span>
        <span class="value">{{ getNodeLabelById(selectedConn?.from_node_id) }}</span>
      </div>
      <div class="detail-row">
        <span class="label">To:</span>
        <span class="value">{{ getNodeLabelById(selectedConn?.to_node_id) }}</span>
      </div>
      <template v-if="needsPortMappingForSelected">
        <div class="detail-row port-mapping-section">
          <span class="label">Port Mappings:</span>
          <div class="port-mappings-list-edit">
            <div v-for="mapping in displayedEditPortMappings" :key="mapping._idx" class="port-mapping-row-edit">
              <span>{{ getFromPortDisplayForEdit(mapping.from_port) }}</span>
              <span class="arrow">→</span>
              <span>{{ toNodeOfSelected?.label }} {{ toNodeType === 'recorder' ? 'Track' : 'Input' }} {{ mapping.to_port }}</span>
              <button type="button" class="btn-remove-small" @click="removeEditPortMapping(mapping._idx)">×</button>
            </div>
            <div class="port-mapping-add-edit">
              <select v-model.number="newMappingFromPort" class="inline-select" :disabled="availableFromPortsForEdit.length === 0">
                <option :value="null">From Port</option>
                <option v-for="opt in availableFromPortsForEdit" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <span class="arrow">→</span>
              <select v-model.number="newMappingToPort" class="inline-select" :disabled="availableToPortsForEdit.length === 0">
                <option :value="null">To Port</option>
                <option v-for="opt in availableToPortsForEdit" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <button type="button" class="btn-add-small" @click="addEditPortMapping" :disabled="!newMappingFromPort || !newMappingToPort">Add</button>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="toNodeType !== 'recorder'">
        <div class="detail-row">
          <span class="label">Input:</span>
          <select v-model.number="editInput" class="inline-select">
            <option v-for="n in inputOptionsForSelected" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </template>
      <template v-else>
        <div class="detail-row">
          <span class="label">Input:</span>
          <input type="number" min="1" v-model.number="editInput" class="inline-select" />
        </div>
      </template>
      <div class="detail-row">
        <span class="label">Pad (dB):</span>
        <input type="number" min="-60" step="1" v-model.number="editPad" class="inline-select" />
      </div>
      <div class="detail-row">
        <span class="label">Phantom Power:</span>
        <input type="checkbox" v-model="editPhantom" />
      </div>
      <div class="detail-row">
        <span class="label">Type:</span>
        <select v-model="editType" class="inline-select">
          <option>Mic</option>
          <option>Line</option>
          <option>Dante</option>
          <option>Midi</option>
          <option>Madi</option>
        </select>
      </div>
      <div class="detail-actions">
        <button class="btn-save" :class="{ success: saveTick }" @click="saveSelectedConnection">
          <span v-if="saveTick">✓ Saved</span>
          <span v-else>Save</span>
        </button>
        <button class="btn-delete" @click="deleteSelectedConnection">Delete</button>
      </div>
    </div>
  </div>

  <!-- Gear Selection Modal -->
  <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Add Gear</h3>
        <button @click="closeGearModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="gear-categories">
          <button 
            v-for="cat in ['Transformers', 'Recorders']" 
            :key="cat"
            @click="gearFilter = cat"
            :class="{ active: gearFilter === cat }"
          >
            {{ cat }}
          </button>
        </div>
        <div class="gear-list">
          <div 
            v-for="gear in availableGear" 
            :key="gear.id"
            @click="addGearNode(gear)"
            class="gear-item"
          >
            <div class="gear-icon">{{ getGearIcon(gear.gear_type) }}</div>
            <div class="gear-info">
              <div class="gear-name">{{ gear.gear_name }}</div>
              <div class="gear-details">
                {{ gear.num_inputs || 0 }} in, {{ gear.num_outputs || 0 }} out
                <span v-if="gear.num_tracks">, {{ gear.num_tracks }} tracks</span>
              </div>
            </div>
          </div>
          <div v-if="availableGear.length === 0" class="no-gear">
            <p>No {{ gearFilter.toLowerCase() }} available for this location.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Source Selection Modal -->
  <div v-if="showSourceModal" class="modal-overlay" @click="closeSourceModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Add Source</h3>
        <button @click="closeSourceModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="gear-categories">
          <button 
            v-for="cat in ['Stereo', 'Mono']" 
            :key="cat"
            @click="sourceFilter = cat"
            :class="{ active: sourceFilter === cat }"
          >
            {{ cat }} Sources
          </button>
        </div>
        <div class="gear-list">
          <div 
            v-for="src in filteredSourcePresets" 
            :key="src.key"
            @click="addSourceNode(src)"
            class="gear-item"
          >
            <div class="gear-icon">🎚️</div>
            <div class="gear-info">
              <div class="gear-name">{{ src.name }}</div>
              <div class="gear-details">
                {{ src.outputs }} {{ src.outputs === 2 ? 'channels (L/R)' : 'channel' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Connection Details Modal -->
  <ConnectionDetailsModal
    v-if="showConnectionModal"
    :fromNode="pendingConnection?.from"
    :toNode="pendingConnection?.to"
    :existingConnections="connections"
    :elements="allNodesForModal"
    :projectId="projectId"
    @confirm="confirmConnection"
    @cancel="closeConnectionModal"
  />
</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { addNode, updateNode, deleteNode, addConnection as addConnectionToDB, updateConnection, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'
import ConnectionDetailsModal from './ConnectionDetailsModal.vue'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  connections: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'node-updated', 'node-added', 'node-deleted',
  'connection-added', 'connection-updated', 'connection-deleted'
])

const toast = useToast()
const canvas = ref(null)
const canvasWrapper = ref(null)
const dpr = window.devicePixelRatio || 1
const canvasWidth = ref(1000)
const canvasHeight = ref(700)
const canvasStyle = computed(() => 
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; transform-origin: top left;`
)

// Tool state
const tool = ref('select')
const linkSource = ref(null)
const selectedNode = ref(null)
const selectedConnectionId = ref(null)
// Edit models for selected connection
const editPad = ref(0)
const editPhantom = ref(false)
const editType = ref('Mic')
const editInput = ref(null)
const editTrack = ref(null)
const saveTick = ref(false)

// Port mapping state for transformer→transformer connections
const editPortMappings = ref([])
const displayedEditPortMappings = computed(() => editPortMappings.value
  .map((m, i) => ({ ...m, _idx: i }))
  .sort((a, b) => (Number(a.to_port) || 0) - (Number(b.to_port) || 0))
)
const newMappingFromPort = ref(null)
const newMappingToPort = ref(null)
// Upstream source labels for selected connection's FROM transformer
const upstreamLabelsForFromNode = ref({})
const draggingNode = ref(null)
let dragStart = null

// Zoom state
const zoomLevel = ref(1.0)
const minZoom = 0.25
const maxZoom = 4.0
const zoomStep = 0.25

// Modal state
const showGearModal = ref(false)
const showSourceModal = ref(false)
const showConnectionModal = ref(false)
const pendingConnection = ref(null)
const gearFilter = ref('Transformers')
const sourceFilter = ref('Stereo')
const submittingConnection = ref(false)

// Node counts
const sourceCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'source').length
)
const transformerCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'transformer').length
)
const recorderCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'recorder').length
)

// Available gear for modal
const availableGear = computed(() => {
  const filterType = gearFilter.value === 'Transformers' ? 'transformer' : 'recorder'
  return props.gearList.filter(g => 
    g.gear_type === filterType && g.assignments?.[props.locationId] > 0
  )
})

// Source presets for ad-hoc sources not tied to gear
const sourcePresets = [
  { key: 'dj_lr', name: 'DJ LR', outputs: 2, category: 'Stereo' },
  { key: 'foh_lr', name: 'FOH Feed LR', outputs: 2, category: 'Stereo' },
  { key: 'stereo_stem', name: 'Stereo Stem', outputs: 2, category: 'Stereo' },
  { key: 'handheld_mic', name: 'HandHeld Mic', outputs: 1, category: 'Mono' },
  { key: 'handheld_group', name: 'HandHeld Mic Group', outputs: 1, category: 'Mono' },
  { key: 'mono_stem', name: 'Mono Stem', outputs: 1, category: 'Mono' }
]
const filteredSourcePresets = computed(() => sourcePresets.filter(s => s.category === sourceFilter.value))

// Combined nodes for modal
const allNodesForModal = computed(() => props.nodes)

const selectedConn = computed(() => props.connections.find(c => c.id === selectedConnectionId.value) || null)
const fromNodeOfSelected = computed(() => {
  const c = selectedConn.value
  if (!c) return null
  return props.nodes.find(n => n.id === c.from_node_id) || null
})
const toNodeOfSelected = computed(() => {
  const c = selectedConn.value
  if (!c) return null
  return props.nodes.find(n => n.id === c.to_node_id) || null
})
const fromNodeType = computed(() => (fromNodeOfSelected.value?.gear_type || fromNodeOfSelected.value?.node_type || '').toLowerCase())
const toNodeType = computed(() => (toNodeOfSelected.value?.gear_type || toNodeOfSelected.value?.node_type || '').toLowerCase())

// Check if this connection needs port mapping UI
const needsPortMappingForSelected = computed(() => {
  const fromType = fromNodeType.value
  const toType = toNodeType.value
  // Allow mapping when:
  // - transformer → transformer/recorder
  // - recorder → recorder
  // - multi-output source (e.g., stereo) → transformer/recorder
  const fromNode = fromNodeOfSelected.value
  const isMultiOutputSource = (fromType === 'source') && ((fromNode?.num_outputs || fromNode?.outputs || 0) > 1)
  return (fromType === 'transformer' && (toType === 'transformer' || toType === 'recorder')) ||
         (fromType === 'recorder' && toType === 'recorder') ||
         (isMultiOutputSource && (toType === 'transformer' || toType === 'recorder'))
})

function getFromPortDisplayForEdit(portNum) {
  const from = fromNodeOfSelected.value
  if (!from) return `Output ${portNum}`
  if (upstreamLabelsForFromNode.value[portNum]) return upstreamLabelsForFromNode.value[portNum]
  const fromType = (from.gear_type || from.node_type || '').toLowerCase()
  // Label stereo source ports as L/R
  if (fromType === 'source') {
    const outCount = from?.num_outputs || from?.outputs || 0
    if (outCount === 2) {
      const label = from.label || ''
      const trackName = from.track_name || ''
      const m = label.match(/^(.*) \((\d+)\)$/)
      const num = m ? m[2] : ''
      // Get clean base: prefer track_name (cleaned), fall back to label base
      let baseNoNum
      if (trackName) {
        baseNoNum = trackName.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
      } else if (m) {
        baseNoNum = m[1].replace(/\s*LR$/i,'').trim()
      } else {
        baseNoNum = label.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
      }
      const numSuffix = num ? ` (${num})` : ''
      return portNum === 1 ? `${baseNoNum} L${numSuffix}` : (portNum === 2 ? `${baseNoNum} R${numSuffix}` : `Output ${portNum}${numSuffix}`)
    }
  }
  if (fromType === 'transformer') {
    // Try direct connection first
    let incoming = props.connections.find(c => (c.to_node_id === from.id || c.to === from.id) && c.input_number === portNum)
    if (!incoming) {
      // Fall back to port map from previous transformer
      // Find parent connection feeding this transformer
      // Note: We avoid network calls here; modal handles labels precisely. For the panel,
      // we approximate by checking if there is a connection whose to_node_id === from.id
      // and then use the from_port mapping number equal to portNum when available in memory later.
    }
    if (incoming) {
      const upNode = props.nodes.find(nd => nd.id === (incoming.from_node_id || incoming.from))
      const srcLabel = upNode?.track_name || upNode?.label
      if (srcLabel) return srcLabel
    }
  }
  return `Output ${portNum}`
}
const inputOptionsForSelected = computed(() => {
  const to = toNodeOfSelected.value
  const count = to?.num_inputs || to?.numinputs || to?.inputs || 0
  return Array.from({ length: count }, (_, i) => i + 1)
})
const trackOptionsForSelected = computed(() => {
  const to = toNodeOfSelected.value
  const count = to?.num_tracks || to?.tracks || to?.num_records || to?.numrecord || 0
  return Array.from({ length: count }, (_, i) => i + 1)
})

const availableFromPortsForEdit = computed(() => {
  const used = new Set(editPortMappings.value.map(m => m.from_port).filter(Boolean))
  const from = fromNodeOfSelected.value
  const count = from?.num_outputs || from?.numoutputs || from?.outputs || 0
  const opts = []
  const fromType = (from?.gear_type || from?.node_type || '').toLowerCase()
  for (let n = 1; n <= count; n++) {
    if (used.has(n)) continue
    let label = upstreamLabelsForFromNode.value[n] || `Output ${n}`
    if (fromType === 'transformer') {
      const incoming = props.connections.find(c =>
        (c.to_node_id === from?.id || c.to === from?.id) && c.input_number === n
      )
      const upNode = incoming ? props.nodes.find(nd => nd.id === (incoming.from_node_id || incoming.from)) : null
      const srcLabel = upNode?.track_name || upNode?.label
      if (!upstreamLabelsForFromNode.value[n] && srcLabel) label = srcLabel
    }
    opts.push({ value: n, label })
  }
  return opts
})

async function buildUpstreamLabelsForEdit() {
  upstreamLabelsForFromNode.value = {}
  const from = fromNodeOfSelected.value
  if (!from) return
  const fromType = (from.gear_type || from.node_type || '').toLowerCase()
  if (fromType !== 'transformer') return
  try {
    // Find parent connection feeding this transformer
    const parentCandidates = props.connections.filter(c => c.to_node_id === from.id)
    if (!parentCandidates.length) return
    const parent = parentCandidates.find(c => {
      const n = props.nodes.find(nd => nd.id === c.from_node_id)
      return (n?.gear_type || n?.node_type) === 'transformer'
    }) || parentCandidates[0]
    const { data: maps } = await supabase
      .from('connection_port_map')
      .select('from_port, to_port')
      .eq('connection_id', parent.id)
    if (!maps || !maps.length) return
    maps.forEach(m => {
      const incoming = props.connections.find(c => (c.to_node_id === parent.from_node_id) && c.input_number === m.from_port)
      if (incoming) {
        const node = props.nodes.find(nd => nd.id === incoming.from_node_id)
        const name = node?.track_name || node?.label
        if (name) upstreamLabelsForFromNode.value[m.to_port] = name
      }
    })
  } catch {}
}

const availableToPortsForEdit = computed(() => {
  const used = new Set(editPortMappings.value.map(m => m.to_port).filter(Boolean))
  const to = toNodeOfSelected.value
  const opts = []
  if (toNodeType.value === 'recorder') {
    // Prefer recorder tracks; fall back to input count when tracks are not defined
    const trackCount = to?.num_tracks || to?.tracks || to?.num_records || to?.numrecord || 0
    const count = trackCount && trackCount > 0 ? trackCount : (to?.num_inputs || to?.numinputs || to?.inputs || 0)
    for (let n = 1; n <= count; n++) {
      if (used.has(n)) continue
      // Avoid listing ports already taken by raw connections on the target
      const taken = props.connections.find(c =>
        c.id !== selectedConnectionId.value &&
        (c.to_node_id === to?.id || c.to === to?.id) &&
        (c.track_number === n || c.input_number === n)
      )
      if (!taken) opts.push({ value: n, label: `Track ${n}` })
    }
  } else {
    const count = to?.num_inputs || to?.numinputs || to?.inputs || 0
    for (let n = 1; n <= count; n++) {
      if (!used.has(n)) {
        // Check if this input is already used by other connections
        const taken = props.connections.find(c =>
          c.id !== selectedConnectionId.value &&
          (c.to_node_id === to?.id || c.to === to?.id) &&
          c.input_number === n
        )
        if (!taken) {
          opts.push({ value: n, label: `Input ${n}` })
        }
      }
    }
  }
  return opts
})

function addEditPortMapping() {
  if (!newMappingFromPort.value || !newMappingToPort.value) return
  editPortMappings.value.push({
    from_port: newMappingFromPort.value,
    to_port: newMappingToPort.value
  })
  newMappingFromPort.value = null
  newMappingToPort.value = null
}

function removeEditPortMapping(index) {
  editPortMappings.value.splice(index, 1)
}

async function loadPortMappingsForConnection(connId) {
  if (!connId) {
    editPortMappings.value = []
    return
  }
  try {
    const { data, error } = await supabase
      .from('connection_port_map')
      .select('from_port, to_port')
      .eq('connection_id', connId)
      .order('from_port')
    if (!error && data) {
      editPortMappings.value = data.map(m => ({ from_port: m.from_port, to_port: m.to_port }))
    } else {
      editPortMappings.value = []
    }
  } catch (err) {
    console.error('Error loading port mappings:', err)
    editPortMappings.value = []
  }
}

watch(selectedConn, async (c) => {
  if (!c) {
    editPortMappings.value = []
    upstreamLabelsForFromNode.value = {}
    return
  }
  editPad.value = Number(c.pad || 0)
  editPhantom.value = !!c.phantom_power
  editType.value = c.connection_type || 'Mic'
  editInput.value = c.input_number || null
  editTrack.value = c.track_number || null
  
  // Load port mappings if this is a port-mapped connection
  if (needsPortMappingForSelected.value) {
    await loadPortMappingsForConnection(c.id)
    await buildUpstreamLabelsForEdit()
  } else {
    editPortMappings.value = []
    upstreamLabelsForFromNode.value = {}
  }
})

async function saveSelectedConnection() {
  const c = selectedConn.value
  if (!c) return
  try {
    // Handle port mapping connections
    if (needsPortMappingForSelected.value) {
      if (editPortMappings.value.length === 0) {
        toast.error('Please add at least one port mapping.')
        return
      }
      
      // Update parent connection properties
      const payload = {
        id: c.id,
        pad: -Math.abs(Number(editPad.value) || 0),
        phantom_power: editPhantom.value,
        connection_type: editType.value
      }
      await updateConnection(payload)
      
      // Delete existing port mappings
      await supabase
        .from('connection_port_map')
        .delete()
        .eq('connection_id', c.id)
      
      // Insert new port mappings
      const portMapInserts = editPortMappings.value.map(m => ({
        project_id: props.projectId,
        connection_id: c.id,
        from_port: m.from_port,
        to_port: m.to_port
      }))
      
      if (portMapInserts.length > 0) {
        const { error } = await supabase
          .from('connection_port_map')
          .insert(portMapInserts)
        if (error) throw error
      }
      
      emit('connection-updated', { ...c, ...payload })
      saveTick.value = true
      setTimeout(() => { saveTick.value = false }, 1000)
      return
    }
    
    // Handle regular source→transformer/recorder connections
    const payload = { id: c.id, pad: -Math.abs(Number(editPad.value) || 0), phantom_power: editPhantom.value, connection_type: editType.value }
    if (toNodeType.value === 'recorder') {
      payload.input_number = editInput.value || null
      payload.track_number = null
    } else {
      payload.input_number = editInput.value || null
      // keep existing track_number if any
    }
    const updated = await updateConnection(payload)
    emit('connection-updated', updated)
    saveTick.value = true
    setTimeout(() => { saveTick.value = false }, 1000)
  } catch (err) {
    console.error('Failed to update connection:', err)
    toast.error('Failed to update connection')
  }
}

async function deleteSelectedConnection() {
  const c = selectedConn.value
  if (!c) return
  if (!confirm('Delete this connection?')) return
  try {
    // Check if this is a source→transformer connection
    const fromNode = props.nodes.find(n => n.id === c.from_node_id)
    const toNode = props.nodes.find(n => n.id === c.to_node_id)
    const isSourceConn = (fromNode?.gear_type || fromNode?.node_type) === 'source'
    
    if (isSourceConn && c.input_number && toNode) {
      // Cascade cleanup: remove downstream port mappings that depend on this input
      await cascadeCleanupDownstream(toNode.id, c.input_number)
    }
    
    await deleteConnectionFromDB(c.id)
    emit('connection-deleted', c.id)
    selectedConnectionId.value = null
    toast.success('Connection deleted')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Failed to delete connection:', err)
    toast.error('Failed to delete connection')
  }
}

async function cascadeCleanupDownstream(transformerId, inputNum) {
  try {
    // Find all connections FROM this transformer
    const downstreamConns = props.connections.filter(c => c.from_node_id === transformerId)
    
    for (const conn of downstreamConns) {
      // Check if this connection has port mappings
      const { data: maps } = await supabase
        .from('connection_port_map')
        .select('id, from_port, to_port')
        .eq('connection_id', conn.id)
      
      if (maps && maps.length) {
        // Find mappings that use the deleted input as the from_port (output from transformer)
        const affectedMaps = maps.filter(m => Number(m.from_port) === Number(inputNum))
        
        if (affectedMaps.length) {
          // Delete these port mappings
          const mapIds = affectedMaps.map(m => m.id)
          await supabase
            .from('connection_port_map')
            .delete()
            .in('id', mapIds)
          
          // If this was the last mapping, optionally delete the parent connection
          const remainingMaps = maps.filter(m => !mapIds.includes(m.id))
          if (remainingMaps.length === 0) {
            await deleteConnectionFromDB(conn.id)
            emit('connection-deleted', conn.id)
          } else {
            // Recursively clean up further downstream for each affected to_port
            const targetNode = props.nodes.find(n => n.id === conn.to_node_id)
            if (targetNode) {
              for (const map of affectedMaps) {
                await cascadeCleanupDownstream(conn.to_node_id, map.to_port)
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Cascade cleanup error:', err)
  }
}

function getGearIcon(type) {
  const icons = {
    source: '🎤',
    transformer: '⚡',
    recorder: '📼'
  }
  return icons[type] || '🎵'
}

// Zoom functions - ONLY controlled via buttons, never via scroll/wheel events
function zoomIn() {
  if (zoomLevel.value < maxZoom) {
    zoomLevel.value = Math.min(maxZoom, zoomLevel.value + zoomStep)
    nextTick(drawCanvas)
  }
}

function zoomOut() {
  if (zoomLevel.value > minZoom) {
    zoomLevel.value = Math.max(minZoom, zoomLevel.value - zoomStep)
    nextTick(drawCanvas)
  }
}

function resetZoom() {
  zoomLevel.value = 1.0
  nextTick(drawCanvas)
}

// Drawing
function drawCanvas() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
  ctx.scale(dpr, dpr)
  
  // Apply zoom transformation
  ctx.save()
  ctx.scale(zoomLevel.value, zoomLevel.value)

  // Background (scaled)
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Draw connections (will be scaled by zoom)
  props.connections.forEach(conn => {
    drawConnection(ctx, conn, conn.id === selectedConnectionId.value)
  })

  // Draw nodes (will be scaled by zoom)
  props.nodes.forEach(node => {
    drawNode(ctx, node)
  })
  
  ctx.restore()
}

function drawNode(ctx, node) {
  const isSource = (node.gear_type || node.node_type) === 'source'
  const isAdHocSource = isSource && ((node.type === 'source') || !node.gear_id)
  const isSelected = node === selectedNode.value
  const pos = getCanvasPos(node)
  
  ctx.save()
  
  // Node circle
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 35, 0, 2 * Math.PI)
  
  // Color based on type
  const colors = {
    source: '#28a745',
    transformer: '#007bff',
    recorder: '#dc3545'
  }
  // Ad-hoc sources use purple for extra clarity
  const color = isAdHocSource ? '#6d28d9' : (colors[node.gear_type || node.node_type] || '#6c757d')
  
  ctx.fillStyle = isSelected ? color : '#fff'
  ctx.strokeStyle = color
  ctx.lineWidth = isSelected ? 4 : 2
  ctx.fill()
  ctx.stroke()

  // Selection indicator
  if (isSelected) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 45, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Label
  ctx.fillStyle = '#222'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  
  // For sources, show track name if available
  const label = isSource && node.track_name ? node.track_name : node.label
  ctx.fillText(label, pos.x, pos.y + 40)

  // Draw an icon inside for ad-hoc sources
  if (isAdHocSource) {
    ctx.fillStyle = '#6d28d9'
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎚️', pos.x, pos.y)
  }

  ctx.restore()
}

function drawConnection(ctx, conn, isSelected = false) {
  const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
  const toNode = props.nodes.find(n => n.id === conn.to_node_id)
  
  if (!fromNode || !toNode) return

  const fromPos = getCanvasPos(fromNode)
  const toPos = getCanvasPos(toNode)

  ctx.save()
  ctx.strokeStyle = isSelected ? '#ff7a00' : '#007bff'
  ctx.lineWidth = isSelected ? 4 : 3
  ctx.setLineDash(isSelected ? [4, 4] : [8, 4])

  ctx.beginPath()
  ctx.moveTo(fromPos.x, fromPos.y)
  ctx.lineTo(toPos.x, toPos.y)
  ctx.stroke()

  ctx.setLineDash([])

  // Arrow at midpoint
  const mx = (fromPos.x + toPos.x) / 2
  const my = (fromPos.y + toPos.y) / 2
  const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)

  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - 12 * Math.cos(angle - Math.PI / 6), my - 12 * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - 12 * Math.cos(angle + Math.PI / 6), my - 12 * Math.sin(angle + Math.PI / 6))
  ctx.strokeStyle = isSelected ? '#ff7a00' : '#007bff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

// Pointer events
function onPointerDown(e) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  const clickedNode = getNodeAt(x, y)
  if (!clickedNode) {
    const conn = getConnectionAt(x, y)
    selectedConnectionId.value = conn?.id || null
    selectedNode.value = null
    drawCanvas()
    return
  }

  if (tool.value === 'select') {
    if (clickedNode) {
      selectedNode.value = clickedNode
      draggingNode.value = clickedNode
      dragStart = { x, y }
    } else {
      selectedNode.value = null
    }
  } else if (tool.value === 'link') {
    if (clickedNode) {
      if (!linkSource.value) {
        linkSource.value = clickedNode
        toast.info(`Selected ${clickedNode.track_name || clickedNode.label}. Click target node.`)
      } else if (clickedNode !== linkSource.value) {
        // Validate connection
        if (!canConnect(linkSource.value, clickedNode)) {
          toast.error('Invalid connection')
          linkSource.value = null
          return
        }
        
        // Open connection modal
        pendingConnection.value = { from: linkSource.value, to: clickedNode }
        showConnectionModal.value = true
        linkSource.value = null
      } else {
        linkSource.value = null
      }
    }
  }

  drawCanvas()
}

function onPointerMove(e) {
  e.preventDefault()
  if (!draggingNode.value || !dragStart) return

  const { x, y } = getCanvasCoords(e)
  // Update normalized flow position (separate from Mic Placement)
  draggingNode.value.flow_x = x / canvasWidth.value
  draggingNode.value.flow_y = y / canvasHeight.value
  drawCanvas()
}

async function onPointerUp(e) {
  e.preventDefault()
  
  if (draggingNode.value) {
    // Save normalized position
    await saveNodePosition(draggingNode.value)
    draggingNode.value = null
  }
  
  dragStart = null
}

function getCanvasCoords(e) {
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / rect.width
  const scaleY = canvas.value.height / rect.height
  // Account for zoom level - pointer coordinates need to be divided by zoom
  return {
    x: (e.clientX - rect.left) * scaleX / dpr / zoomLevel.value,
    y: (e.clientY - rect.top) * scaleY / dpr / zoomLevel.value
  }
}

function getNodeAt(x, y) {
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const node = props.nodes[i]
    const pos = getCanvasPos(node)
    const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
    if (dist < 35) return node
  }
  return null
}

function getConnectionAt(x, y) {
  const threshold = 6
  for (let i = props.connections.length - 1; i >= 0; i--) {
    const conn = props.connections[i]
    const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
    const toNode = props.nodes.find(n => n.id === conn.to_node_id)
    if (!fromNode || !toNode) continue
    const fromPos = getCanvasPos(fromNode)
    const toPos = getCanvasPos(toNode)
    const dist = pointToSegmentDistance(x, y, fromPos.x, fromPos.y, toPos.x, toPos.y)
    if (dist <= threshold) return conn
  }
  return null
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq
  let xx, yy
  if (param < 0) { xx = x1; yy = y1 }
  else if (param > 1) { xx = x2; yy = y2 }
  else { xx = x1 + param * C; yy = y1 + param * D }
  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

// Helper: get node label by id (prefers track_name for sources)
function getNodeLabelById(id) {
  if (!id) return 'Unknown'
  const node = props.nodes.find(n => n.id === id)
  if (!node) return 'Unknown'
  return node.track_name || node.label || 'Unknown'
}

// Position details panel near the selected connection midpoint
const selectedConnMid = computed(() => {
  const c = selectedConn.value
  if (!c) return null
  const fromNode = props.nodes.find(n => n.id === c.from_node_id)
  const toNode = props.nodes.find(n => n.id === c.to_node_id)
  if (!fromNode || !toNode) return null
  const fromPos = getCanvasPos(fromNode)
  const toPos = getCanvasPos(toNode)
  return { x: (fromPos.x + toPos.x) / 2, y: (fromPos.y + toPos.y) / 2 }
})

const detailsStyle = computed(() => {
  const def = { left: '10px', top: '10px' }
  if (!selectedConnMid.value || !canvas.value || !canvasWrapper.value) return def
  const wrap = canvasWrapper.value.getBoundingClientRect()
  const rect = canvas.value.getBoundingClientRect()
  const offsetX = rect.left - wrap.left
  const offsetY = rect.top - wrap.top
  const left = offsetX + selectedConnMid.value.x + 12
  const top = offsetY + selectedConnMid.value.y - 10
  return { left: `${left}px`, top: `${top}px` }
})

function canConnect(from, to) {
  const fromType = from.gear_type || from.node_type
  const toType = to.gear_type || to.node_type

  // Valid connections:
  // source -> transformer
  // source -> recorder
  // transformer -> transformer
  // transformer -> recorder

  if (fromType === 'source' && (toType === 'transformer' || toType === 'recorder')) return true
  if (fromType === 'transformer' && (toType === 'transformer' || toType === 'recorder')) return true
  
  return false
}

// Modal handlers
function openGearModal() {
  showGearModal.value = true
}

function closeGearModal() {
  showGearModal.value = false
}

function openSourceModal() {
  showSourceModal.value = true
}

function closeSourceModal() {
  showSourceModal.value = false
}

async function addGearNode(gear) {
  try {
    const label = prompt('Enter label for this node:', gear.gear_name)
    if (!label) return

    const newNode = await addNode({
      project_id: props.projectId,
      type: 'gear',
      gear_id: gear.id,
      label,
      x: 0.5,
      y: 0.5,
      flow_x: 0.5,
      flow_y: 0.5,
      gear_type: gear.gear_type,
      num_inputs: gear.num_inputs || 0,
      num_outputs: gear.num_outputs || 0,
      num_tracks: gear.num_tracks || 0
    })

    emit('node-added', newNode)
    closeGearModal()
    toast.success(`Added ${label}`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error adding gear:', err)
    toast.error('Failed to add gear')
  }
}

function nextNumberedLabel(baseName) {
  // Find existing nodes with the same base prefix
  const regex = new RegExp(`^${baseName} \\((\\d+)\\)$`)
  let max = 0
  props.nodes.forEach(n => {
    const m = (n.label || '').match(regex)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return `${baseName} (${max + 1})`
}

async function addSourceNode(preset) {
  try {
    let base = preset.name
    if (preset.key === 'mono_stem' || preset.key === 'stereo_stem') {
      const userName = prompt('Enter stem name (e.g., Violin, Drums, Keys):', '')
      if (userName === null) return
      const trimmed = (userName || '').trim()
      if (!trimmed) return
      base = `Stem - ${trimmed}`
    }
    const label = nextNumberedLabel(base)
    const outCount = preset.outputs
    const newNode = await addNode({
      project_id: props.projectId,
      type: 'source',
      label,
      // For stems, keep a clean base name as track_name; others can omit
      track_name: (preset.key === 'mono_stem' || preset.key === 'stereo_stem') ? base : null,
      x: 0.5,
      y: 0.5,
      flow_x: 0.5,
      flow_y: 0.5,
      gear_type: 'source',
      num_inputs: 0,
      num_outputs: outCount,
      num_tracks: 0
    })
    emit('node-added', newNode)
    closeSourceModal()
    toast.success(`Added ${label}`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error adding source:', err)
    toast.error('Failed to add source')
  }
}

async function saveNodePosition(node) {
  try {
    await updateNode({
      id: node.id,
      flow_x: node.flow_x,
      flow_y: node.flow_y
    })
    emit('node-updated', node)
  } catch (err) {
    console.error('Error updating node:', err)
    toast.error('Failed to update node position')
  }
}

// Coordinate helpers: nodes store normalized coords (0..1). Convert for canvas drawing.
// Note: zoom is applied at the canvas level, so positions are in unzoomed coordinates
function getCanvasPos(node) {
  const nx = (node.flow_x ?? node.x ?? 0)
  const ny = (node.flow_y ?? node.y ?? 0)
  // If values look already in pixels (legacy), use as-is
  const isPixel = nx > 1.5 || ny > 1.5
  return isPixel
    ? { x: nx, y: ny }
    : { x: nx * canvasWidth.value, y: ny * canvasHeight.value }
}

async function deleteSelected() {
  if (!selectedNode.value) return

  const isSource = (selectedNode.value.gear_type || selectedNode.value.node_type) === 'source'
  if (isSource) {
    const isAdHoc = (selectedNode.value.type === 'source') || !selectedNode.value.gear_id
    if (!isAdHoc) {
      toast.error('Cannot delete mic-placement sources here. Delete from Mic Placement tab.')
      return
    }
  }

  if (!confirm(`Delete ${selectedNode.value.label}?`)) return

  try {
    await deleteNode(selectedNode.value.id)
    emit('node-deleted', selectedNode.value.id)
    selectedNode.value = null
    toast.success('Node deleted')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error deleting node:', err)
    toast.error('Failed to delete node')
  }
}

function closeConnectionModal() {
  showConnectionModal.value = false
  pendingConnection.value = null
  submittingConnection.value = false
}

async function confirmConnection(connectionData) {
  // Prevent double submission
  if (submittingConnection.value) return
  submittingConnection.value = true
  
  try {
    let newConn
    // If the modal already created the parent connection (port-mapped flow),
    // it will pass back an object with an id. In that case, do not insert again.
    if (connectionData && connectionData.id) {
      newConn = connectionData
      emit('connection-added', connectionData)
    } else {
      newConn = await addConnectionToDB(connectionData)
      emit('connection-added', newConn)
    }
    closeConnectionModal()
    toast.success('Connection created')
    
    // Optimistically add the connection to trigger immediate redraw
    // The watcher will handle the final redraw when props update
    const optimisticConnections = [...props.connections, newConn]
    
    // Force immediate redraw with optimistic connection
    nextTick(() => {
      // Temporarily use optimistic connections for drawing
      const ctx = canvas.value?.getContext('2d')
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
      ctx.scale(dpr, dpr)
      
      // Apply zoom transformation
      ctx.save()
      ctx.scale(zoomLevel.value, zoomLevel.value)

      // Background (scaled)
      ctx.fillStyle = '#f8f9fa'
      ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

      // Draw connections (including the new one)
      optimisticConnections.forEach(conn => {
        drawConnection(ctx, conn, conn.id === selectedConnectionId.value)
      })

      // Draw nodes
      props.nodes.forEach(node => {
        drawNode(ctx, node)
      })
      
      ctx.restore()
      
      // Redraw again after props are updated (watcher will handle this, but ensure it happens)
      setTimeout(() => drawCanvas(), 50)
    })
  } catch (err) {
    console.error('Error creating connection:', err)
    if (err?.code === '23505') {
      // Duplicate connection - the input is already connected (race condition or double-click)
      // Since UI blocks occupied inputs, just close modal and show info message
      closeConnectionModal()
      toast.info('This input is already connected')
    } else {
      toast.error('Failed to create connection')
    }
  } finally {
    submittingConnection.value = false
  }
}

// Watchers
watch([() => props.nodes, () => props.connections, zoomLevel], () => {
  nextTick(() => {
    drawCanvas()
  })
}, { deep: true, immediate: false })

// Lifecycle
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
  }
  nextTick(drawCanvas)
  // Note: All scroll/wheel blocking has been removed to allow normal page scrolling.
  // Zoom is ONLY controlled via the +/- buttons with preset intervals (25% steps).
  // Scrolling will NOT trigger zoom changes.
})
// Prompt when entering Link mode
watch(tool, (v, prev) => {
  if (v === 'link' && !linkSource.value) {
    toast.info('Select your first connection node')
  }
})

// Expose a method to retrieve the current flow canvas as a data URL for parent exports
function getCanvasDataURL() {
  if (!canvas.value) return null
  drawCanvas()
  try {
    return canvas.value.toDataURL('image/png')
  } catch (e) {
    return null
  }
}

defineExpose({ getCanvasDataURL })

// Download the current canvas as a PNG file
function exportFlowPng() {
  if (!canvas.value) return
  drawCanvas()
  try {
    canvas.value.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `signal-flow-${props.projectId}-${props.locationId}-${new Date().toISOString().slice(0,10)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  } catch {}
}

// Print the current signal flow canvas
function printFlow() {
  if (!canvas.value) return
  drawCanvas()
  try {
    // Convert canvas to data URL
    const dataURL = canvas.value.toDataURL('image/png')
    
    // Create a print window with just the canvas image
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to print')
      return
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Signal Flow</title>
          <style>
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              img {
                width: 100%;
                height: auto;
                page-break-inside: avoid;
              }
            }
            @page {
              margin: 0;
              size: auto;
            }
          </style>
        </head>
        <body>
          <img src="${dataURL}" alt="Signal Flow" />
        </body>
      </html>
    `)
    printWindow.document.close()
    
    // Wait for image to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    }
  } catch (e) {
    console.error('Error printing canvas:', e)
    toast.error('Failed to print signal flow')
  }
}
</script>

<style scoped>
.signal-flow-container {
  padding: 20px;
}

.flow-header {
  margin-bottom: 20px;
  text-align: center;
}

.flow-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #212529;
}

.flow-header p {
  margin: 0;
  color: #6c757d;
}

.flow-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.flow-toolbar button, .flow-toolbar .tool-btn {
  padding: 10px 16px;
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.flow-toolbar button:hover {
  border-color: #007bff;
}

.flow-toolbar .select-btn.active {
  background: #d1f4e0; /* light green */
  color: #0f7b3e;
  border-color: #0f7b3e;
  font-weight: 600;
}

.flow-toolbar .connect-btn.active {
  background: #d1f4e0; /* light green */
  color: #0f7b3e;
  border-color: #0f7b3e;
  font-weight: 600;
}

.flow-toolbar .link-btn.active {
  background: #d1f4e0; /* light green */
  color: #0f7b3e;
  border-color: #0f7b3e;
}

.btn-add {
  background: #007bff !important;
  color: white !important;
  border-color: #007bff !important;
}

.btn-add:hover {
  background: #0056b3 !important;
}

.btn-danger {
  background: #dc3545 !important;
  color: white !important;
  border-color: #dc3545 !important;
}

.btn-danger:hover {
  background: #c82333 !important;
}

.btn-danger:disabled {
  background: #e9ecef !important;
  color: #adb5bd !important;
  border-color: #dee2e6 !important;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  height: 30px;
  background: #dee2e6;
  margin: 0 10px;
}

.node-count {
  color: #6c757d;
  font-size: 14px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.zoom-controls .zoom-btn {
  padding: 8px 12px;
  min-width: 36px;
}

.zoom-level {
  color: #495057;
  font-size: 14px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.canvas-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  overflow: auto;
  max-height: calc(100vh - 300px);
}

.canvas-wrapper canvas {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  cursor: crosshair;
  flex-shrink: 0;
}

.tool-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff !important;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.connection-details {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px 14px;
  width: 420px;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.connection-details h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 700;
  color: #212529;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 0;
  font-size: 13px;
}
.detail-row .label { color: #6c757d; }
.detail-row .value { color: #212529; font-weight: 600; }
.inline-select { padding: 4px 8px; border: 1px solid #dee2e6; border-radius: 6px; }
.port-mapping-section { flex-direction: column; align-items: flex-start; }
.port-mappings-list-edit { width: 100%; }
.port-mapping-row-edit {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}
.port-mapping-row-edit .arrow { color: #007bff; font-weight: bold; }
.port-mapping-add-edit {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.port-mapping-add-edit .inline-select { flex: 1; min-width: 100px; }
.port-mapping-add-edit .arrow { color: #007bff; font-weight: bold; }
.btn-remove-small {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  margin-left: auto;
}
.btn-remove-small:hover { background: #c82333; }
.btn-add-small {
  padding: 4px 10px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.btn-add-small:hover:not(:disabled) { background: #218838; }
.btn-add-small:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.detail-actions { margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px; }
.btn-save { background: #16a34a; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.btn-save:hover { background: #15803d; }
.btn-save.success { background: #22c55e; }
.btn-delete { background: #dc2626; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.btn-delete:hover { background: #b91c1c; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #212529;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f8f9fa;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.gear-categories {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.gear-categories button {
  flex: 1;
  padding: 10px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.gear-categories button:hover {
  background: #e9ecef;
}

.gear-categories button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.gear-list {
  display: grid;
  gap: 12px;
}

.gear-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.gear-item:hover {
  background: #f8f9fa;
  border-color: #007bff;
}

.gear-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
}

.gear-info {
  flex: 1;
}

.gear-name {
  font-weight: 600;
  color: #212529;
  margin-bottom: 4px;
}

.gear-details {
  font-size: 12px;
  color: #6c757d;
}

.no-gear {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}
</style>

