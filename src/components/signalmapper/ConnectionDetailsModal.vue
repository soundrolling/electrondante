<template>
<div v-if="isTransformerToRecorder" class="modal-overlay" @mousedown.self="$emit('cancel')">
  <div 
    ref="modalRef"
    class="modal-content draggable-modal"
    :style="modalStyle"
    @mousedown="startDrag"
  >
    <div class="modal-header">
      <h2 class="modal-title">Confirm Connection</h2>
      <button @click="$emit('cancel')" class="close-btn">×</button>
    </div>
    <div class="modal-body">
      <p>Connect <b>{{ fromNode.label }}</b> to <b>{{ toNode.label }}</b>?</p>
      <div class="form-actions">
        <button class="btn-confirm" @click="confirmTransformerToRecorder" :disabled="loading">Confirm</button>
        <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</div>
<div v-else class="modal-overlay" @mousedown.self="$emit('cancel')">
  <div 
    ref="modalRef"
    class="modal-content draggable-modal"
    :style="modalStyle"
    @mousedown="startDrag"
  >
    <div class="modal-header">
      <h2 class="modal-title">Create Connection</h2>
      <button @click="$emit('cancel')" class="close-btn">×</button>
    </div>
    <div class="modal-body">
      <div class="connection-info">
        <div class="connection-pair">
          <div class="node-info from-node">
            <div class="node-label">From:</div>
            <div class="node-name">{{ fromNode.track_name || fromNode.label }}</div>
          </div>
          <div class="connection-arrow">
            <span class="arrow-icon">→</span>
          </div>
          <div class="node-info to-node">
            <div class="node-label">To:</div>
            <div class="node-name">{{ toNode.label }}</div>
          </div>
        </div>
      </div>
      <form @submit.prevent="submit" class="connection-form">
        <div v-if="needsPortMapping" class="form-group">
          <label>Map Ports: <b>{{ fromNode.label }}</b> → <b>{{ toNode.label }}</b></label>
          <div class="port-mapping-container">
            <div v-if="displayedPortMappings.length > 0" class="port-mappings-list">
            <div v-for="mapping in displayedPortMappings" :key="mapping._idx" class="port-mapping-row">
              <template v-if="editingIdx === mapping._idx">
                <!-- Edit mode -->
                <select class="form-select-small" v-model.number="editFromPort">
                  <option v-for="opt in availableFromPorts" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  <option :value="mapping.from_port" v-if="!availableFromPorts.find(o => o.value === mapping.from_port)">
                    {{ upstreamSourceLabels[mapping.from_port] || getFromPortDisplay(mapping.from_port) }}
                  </option>
                </select>
                <span class="arrow">→</span>
                <select class="form-select-small" v-model.number="editToPort">
                  <option v-for="opt in availableToPorts" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  <option :value="mapping.to_port" v-if="!availableToPorts.find(o => o.value === mapping.to_port)">
                    {{ isRecorderTo ? `Track ${mapping.to_port}` : `Input ${mapping.to_port}` }}
                  </option>
                </select>
                <button type="button" class="btn-save-small" @click="saveEditMapping">✓</button>
                <button type="button" class="btn-cancel-small" @click="cancelEditMapping">✕</button>
              </template>
              <template v-else>
                <!-- Display mode -->
                <span>{{ upstreamSourceLabels[mapping.from_port] || getFromPortDisplay(mapping.from_port) }}</span>
                <span class="arrow">→</span>
                <span>{{ isRecorderTo ? `Track ${mapping.to_port}` : `Input ${mapping.to_port}` }}</span>
                <button type="button" class="btn-edit" @click="startEditMapping(mapping._idx)">✎</button>
                <button type="button" class="btn-remove" @click="removePortMapping(mapping._idx)">×</button>
              </template>
              </div>
            </div>
            <div class="port-mapping-add">
              <select class="form-select" v-model.number="newMappingFromPort" :disabled="availableFromPorts.length === 0">
                <option :value="null">{{ isTransformerFrom ? 'From Source' : 'From Port' }}</option>
                <option v-for="opt in availableFromPorts" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <span class="arrow">→</span>
              <select class="form-select" v-model.number="newMappingToPort" :disabled="availableToPorts.length === 0">
                <option :value="null">Select To Port</option>
                <option v-for="opt in availableToPorts" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <button type="button" class="btn-add" @click="addPortMapping" :disabled="!newMappingFromPort || !newMappingToPort">Add</button>
            </div>
          </div>
        </div>
        <div v-else-if="isSource && isTransformerTo" class="form-group">
          <label>Assign <b>{{ fromNode.track_name || fromNode.label }}</b> to Transformer Input</label>
          <select class="form-select" v-model.number="inputNumber">
            <option v-for="opt in inputOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              {{ opt.label }}
            </option>
          </select>
          
        </div>
        <div v-else-if="isSource && isRecorderTo" class="form-group">
          <label>Assign <b>{{ fromNode.track_name || fromNode.label }}</b> to Recorder Track</label>
          <select class="form-select" v-model.number="inputNumber">
            <option v-for="opt in recorderAssignmentOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              {{ opt.label }}
            </option>
          </select>
          
        </div>
        <div v-else class="form-group">
          <!-- Fallback for other types, show input/track assignment if needed -->
          <label>Assign to Input/Track</label>
          <select class="form-select" v-model.number="inputNumber">
            <option v-for="opt in inputOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              {{ opt.label }}
            </option>
          </select>
          
        </div>
        
        <!-- Connection Properties -->
        <div class="form-group connection-properties">
          <label class="select-label">
            <span>Pad (dB)</span>
            <input type="number" min="-60" step="1" v-model.number="padValue" />
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="phantomPowerEnabled" />
            <span>Phantom Power (+48V)</span>
          </label>
          <label class="select-label">
            <span>Connection Type</span>
            <select v-model="connectionType">
              <option>Mic</option>
              <option>Line</option>
              <option>Dante</option>
              <option>Midi</option>
              <option>Madi</option>
            </select>
          </label>
        </div>
        
        <div class="form-actions">
          <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
          <button type="submit" class="btn-confirm" :disabled="loading">
            Confirm Connection
          </button>
          <button type="button" class="btn-cancel" @click="$emit('cancel')">
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { supabase } from '@/supabase'
import { addConnection, updateConnection } from '@/services/signalMapperService'
import { useToast } from 'vue-toastification'

const props = defineProps({
fromNode: { 
  type: Object, 
  required: true 
},
toNode: { 
  type: Object, 
  required: true 
},
defaultInput: { 
  type: Number, 
  default: 1 
},
defaultOutput: { 
  type: Number, 
  default: 1 
},
defaultTrack: { 
  type: Number, 
  default: null 
},
existingConnections: {
  type: Array,
  default: () => []
},
elements: {
  type: Array,
  default: () => []
},
projectId: {
  type: [String, Number],
  required: true
}
})

console.log('[CONNECTION MODAL] Props received:', props)

const emit = defineEmits(['confirm', 'cancel'])
const toast = useToast()

// Dragging state
const modalPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const modalRef = ref(null)

const modalStyle = computed(() => ({
  left: modalPosition.value.x + 'px',
  top: modalPosition.value.y + 'px',
  transform: 'none',
  margin: '0',
  position: 'fixed'
}))

function startDrag(e) {
  // Only start drag on header
  if (!e.target.closest('.modal-header')) return
  
  // Don't start drag on buttons
  if (e.target.closest('button')) return
  
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - modalPosition.value.x,
    y: e.clientY - modalPosition.value.y
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e) {
  if (!isDragging.value) return
  
  const newX = e.clientX - dragStart.value.x
  const newY = e.clientY - dragStart.value.y
  
  // Constrain to viewport
  const rect = modalRef.value?.getBoundingClientRect()
  if (rect) {
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height
    
    modalPosition.value.x = Math.max(0, Math.min(newX, maxX))
    modalPosition.value.y = Math.max(0, Math.min(newY, maxY))
  } else {
    modalPosition.value.x = newX
    modalPosition.value.y = newY
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function ensureModalInViewport() {
  nextTick(() => {
    if (!modalRef.value) return
    
    const rect = modalRef.value.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height
    
    // Adjust position if out of bounds
    if (modalPosition.value.x < 0) modalPosition.value.x = 0
    if (modalPosition.value.x > maxX) modalPosition.value.x = maxX
    if (modalPosition.value.y < 0) modalPosition.value.y = 0
    if (modalPosition.value.y > maxY) modalPosition.value.y = maxY
  })
}

function centerModal() {
  nextTick(() => {
    if (!modalRef.value) return
    const rect = modalRef.value.getBoundingClientRect()
    modalPosition.value = {
      x: (window.innerWidth - rect.width) / 2,
      y: (window.innerHeight - rect.height) / 2
    }
    ensureModalInViewport()
  })
}

function getType(node){
  return (node?.gearType || node?.gear_type || node?.node_type || '').toLowerCase()
}
const isSource = computed(() => getType(props.fromNode) === 'source')
const isRecorder = computed(() => getType(props.toNode) === 'recorder')
const isTransformer = computed(() => getType(props.fromNode) === 'transformer' || getType(props.toNode) === 'transformer')
// Recorder detection also falls back to presence of track fields
function hasTracks(node){
  return !!(node?.num_tracks || node?.tracks || node?.num_records || node?.numrecord)
}
const isRecorderFrom = computed(() => getType(props.fromNode) === 'recorder' || hasTracks(props.fromNode))
const isRecorderTo   = computed(() => getType(props.toNode)   === 'recorder' || hasTracks(props.toNode))
const isTransformerTo = computed(() => getType(props.toNode) === 'transformer')
const isTransformerFrom = computed(() => getType(props.fromNode) === 'transformer')

// Use port mapping when neither side is a source and a transformer is involved,
// or recorder→recorder, or when the from side is a multi-output source going to
// a transformer/recorder (e.g., stereo source mapping L/R).
const needsPortMapping = computed(() => {
  const multiOutputSource = isSource.value && ((numOutputs.value || 0) > 1) && (isTransformerTo.value || isRecorderTo.value)
  return (!isSource.value && (isTransformerFrom.value || isTransformerTo.value)) ||
         (isRecorderFrom.value && isRecorderTo.value) ||
         multiOutputSource
})

const numInputs = computed(() => props.toNode.num_inputs || props.toNode.numinputs || props.toNode.inputs || 0)
const numOutputs = computed(() => props.fromNode.num_outputs || props.fromNode.numoutputs || props.fromNode.outputs || 0)
const numTracks = computed(() => props.toNode.num_tracks || props.toNode.tracks || props.toNode.num_records || props.toNode.numrecord || 0)

const inputNumber = ref(props.defaultInput)
const outputNumber = ref(props.defaultOutput)
const trackNumber = ref(props.defaultTrack)
const padValue = ref(0)
const phantomPowerEnabled = ref(false)
const connectionType = ref('Mic')

const loading = ref(false)
const errorMsg = ref('')

// Port mapping state for non-source to non-source connections
const portMappings = ref([])
const newMappingFromPort = ref(null)
const newMappingToPort = ref(null)
const editingIdx = ref(null)
const editFromPort = ref(null)
const editToPort = ref(null)

// Always show mappings sorted by destination (to_port)
const displayedPortMappings = computed(() => portMappings.value
  .map((m, i) => ({ ...m, _idx: i }))
  .sort((a, b) => (Number(a.to_port) || 0) - (Number(b.to_port) || 0))
)

// Upstream labels for transformer's outputs keyed by to_port (input index on this transformer)
const upstreamSourceLabels = ref({})
// Track ports already used elsewhere so we don't allow duplicates across connections
const takenFromPorts = ref(new Set())
const takenToPorts = ref(new Set())
// Store source labels for port-mapped inputs (input number -> source label)
const portMappedInputLabels = ref({})

async function buildUpstreamSourceLabels() {
  try {
    upstreamSourceLabels.value = {}
    if (!isTransformerFrom.value) return
    
    // First check all incoming connections to this transformer for direct source connections
    const directIncomings = (props.existingConnections || []).filter(c =>
      (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && typeof c.input_number === 'number'
    )
    
    // Build labels from direct incoming connections - recursively trace to source
    directIncomings.forEach(inc => {
      const label = getLRAwareSourceLabel(inc)
      if (label) upstreamSourceLabels.value[inc.input_number] = label
    })
    
    // Also check for parent connections with port maps (transformer → transformer)
    const { data: parentConns } = await supabase
      .from('connections')
      .select('id, from_node_id, to_node_id')
      .eq('project_id', props.projectId)
      .eq('to_node_id', props.fromNode.id)
    
    if (!parentConns || parentConns.length === 0) return
    
    // Check each parent for port maps and resolve labels
    for (const parentConn of parentConns) {
      const { data: maps } = await supabase
        .from('connection_port_map')
        .select('from_port, to_port')
        .eq('connection_id', parentConn.id)
      
      if (!maps || maps.length === 0) continue
      
      // Resolve upstream labels per mapping - recursively trace to source
      const parentFromNode = props.elements.find(e => e.id === parentConn.from_node_id)
      maps.forEach(m => {
        let label = ''
        const fromNodeType = (parentFromNode?.gear_type || parentFromNode?.node_type || '').toLowerCase()
        if (fromNodeType === 'source') {
          // Direct source connection - get source label with L/R
          const incoming = { 
            from_node_id: parentConn.from_node_id, 
            input_number: m.from_port 
          }
          label = getLRAwareSourceLabel(incoming)
        } else {
          // Upstream is transformer/other: recursively trace back to source
          const incoming = (props.existingConnections || []).find(c =>
            (c.to_node_id === parentConn.from_node_id || c.to === parentConn.from_node_id) && c.input_number === m.from_port
          )
          if (incoming) {
            label = getLRAwareSourceLabel(incoming)
          }
        }
        if (label) upstreamSourceLabels.value[m.to_port] = label
      })
    }
  } catch {}
}

function getSourceLabelParts(node){
  // Prefer track_name for base if present, but numbering comes from label suffix
  const label = node?.label || ''
  const trackName = node?.track_name || ''
  // Extract number from label (e.g., "FOH Feed LR (2)" -> number is "2")
  const m = (label || '').match(/^(.*) \((\d+)\)$/)
  const num = m ? m[2] : ''
  // Get base: prefer track_name (cleaned), fall back to label base (without number)
  let baseNoNum
  if (trackName) {
    // Clean track_name: remove number suffix and LR
    baseNoNum = trackName.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  } else if (m) {
    // Use label base without number: already extracted in m[1]
    baseNoNum = m[1].replace(/\s*LR$/i,'').trim()
  } else {
    // No number in label, clean what we have
    baseNoNum = label.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  }
  const numSuffix = num ? ` (${num})` : ''
  return { baseNoNum, numSuffix }
}

function getSourcePortLabel(portNum){
  const { baseNoNum, numSuffix } = getSourceLabelParts(props.fromNode)
  if (numOutputs.value === 2) {
    return portNum === 1 ? `${baseNoNum} L${numSuffix}` : (portNum === 2 ? `${baseNoNum} R${numSuffix}` : `Output ${portNum}${numSuffix}`)
  }
  return `${baseNoNum}${numSuffix}`
}

// Helper to get source port label for any node (not just props.fromNode)
function getSourcePortLabelForNode(node, portNum) {
  const label = node?.label || ''
  const trackName = node?.track_name || ''
  const m = label.match(/^(.*) \((\d+)\)$/)
  const num = m ? m[2] : ''
  let base
  if (trackName) {
    base = trackName.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  } else if (m) {
    base = m[1].replace(/\s*LR$/i,'').trim()
  } else {
    base = label.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  }
  const numSuffix = num ? ` (${num})` : ''
  const outCount = node?.num_outputs || node?.outputs || 0
  if (outCount === 2) {
    return portNum === 1 ? `${base} L${numSuffix}` : (portNum === 2 ? `${base} R${numSuffix}` : `Output ${portNum}${numSuffix}`)
  }
  return `${base}${numSuffix}`
}

async function loadTakenPorts() {
  try {
    // Reset
    takenFromPorts.value = new Set()
    takenToPorts.value = new Set()
    portMappedInputLabels.value = {}
    // Gather connection ids for this source as FROM
    const { data: fromConns } = await supabase
      .from('connections')
      .select('id')
      .eq('project_id', props.projectId)
      .eq('from_node_id', props.fromNode.id)
    const fromIds = (fromConns || []).map(c => c.id)
    if (fromIds.length) {
      const { data: mapsFrom } = await supabase
        .from('connection_port_map')
        .select('from_port')
        .in('connection_id', fromIds)
      ;(mapsFrom || []).forEach(r => takenFromPorts.value.add(Number(r.from_port)))
    }

    // Gather connection ids for this target as TO (with connection info to resolve sources)
    const { data: toConns } = await supabase
      .from('connections')
      .select('id, from_node_id')
      .eq('project_id', props.projectId)
      .eq('to_node_id', props.toNode.id)
    const toIds = (toConns || []).map(c => c.id)
    if (toIds.length) {
      const { data: mapsTo } = await supabase
        .from('connection_port_map')
        .select('connection_id, from_port, to_port')
        .in('connection_id', toIds)
      
      // Build map of connection_id -> from_node_id
      const connToFrom = Object.fromEntries(toConns.map(c => [c.id, c.from_node_id]))
      
      ;(mapsTo || []).forEach(r => {
        const inputNum = Number(r.to_port)
        takenToPorts.value.add(inputNum)
        
        // Resolve source label for this port-mapped input
        const connId = r.connection_id
        const fromNodeId = connToFrom[connId]
        if (fromNodeId) {
          const fromNode = props.elements.find(e => e.id === fromNodeId)
          if (fromNode) {
            const fromNodeType = (fromNode.gear_type || fromNode.node_type || '').toLowerCase()
            if (fromNodeType === 'source') {
              // Direct source connection via port map - use from_port to determine L/R
              const label = getSourcePortLabelForNode(fromNode, Number(r.from_port))
              if (label) portMappedInputLabels.value[inputNum] = label
            } else {
              // Transformer→Transformer: find incoming connection to this transformer
              const incoming = (props.existingConnections || []).find(c =>
                (c.to_node_id === fromNodeId || c.to === fromNodeId) && c.input_number === Number(r.from_port)
              )
              if (incoming) {
                const label = getLRAwareSourceLabel(incoming)
                if (label) portMappedInputLabels.value[inputNum] = label
              }
            }
          }
        }
      })
    }
  } catch {}
}

// Get available ports for mapping
const availableFromPorts = computed(() => {
  const used = new Set(portMappings.value.map(m => m.from_port).filter(Boolean))
  const opts = []
  for (let n = 1; n <= numOutputs.value; n++) {
    if (used.has(n)) continue
    if (takenFromPorts.value.has(n)) continue
    let label
    if (isTransformerFrom.value) {
      label = upstreamSourceLabels.value[n]
      if (!label) {
        const incoming = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === n
        )
        if (incoming) label = getLRAwareSourceLabel(incoming)
      }
      if (!label) label = `Output ${n}`
    } else if (isSource.value) {
      label = getSourcePortLabel(n)
    } else {
      label = getFromPortName(n)
    }
    opts.push({ value: n, label })
  }
  return opts
})

const availableToPorts = computed(() => {
  const used = new Set(portMappings.value.map(m => m.to_port).filter(Boolean))
  const opts = []
  // Prefer recorder tracks; if none defined, fall back to inputs but still label as Track
  if (isRecorderTo.value) {
    const count = (numTracks.value && numTracks.value > 0) ? numTracks.value : (numInputs.value || 0)
    for (let n = 1; n <= count; n++) {
      if (!used.has(n)) {
        // When falling back to inputs, we still want unique mapping per port. Also avoid listing inputs already assigned by raw connections.
        const taken = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && (c.track_number === n || c.input_number === n)
        )
        if (!taken && !takenToPorts.value.has(n)) opts.push({ value: n, label: `Track ${n}` })
      }
    }
  } else {
    for (let n = 1; n <= numInputs.value; n++) {
      if (!used.has(n)) {
        const taken = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === n
        )
        if (!taken && !takenToPorts.value.has(n)) opts.push({ value: n, label: `Input ${n}` })
      }
    }
  }
  return opts
})

function addPortMapping() {
  if (!newMappingFromPort.value || !newMappingToPort.value) return
  portMappings.value.push({
    from_port: newMappingFromPort.value,
    to_port: newMappingToPort.value
  })
  newMappingFromPort.value = null
  newMappingToPort.value = null
}

function removePortMapping(index) {
  portMappings.value.splice(index, 1)
  if (editingIdx.value === index) {
    editingIdx.value = null
  }
}

function startEditMapping(index) {
  editingIdx.value = index
  editFromPort.value = portMappings.value[index].from_port
  editToPort.value = portMappings.value[index].to_port
}

function saveEditMapping() {
  if (editingIdx.value !== null && editFromPort.value && editToPort.value) {
    portMappings.value[editingIdx.value] = {
      from_port: editFromPort.value,
      to_port: editToPort.value
    }
    editingIdx.value = null
    editFromPort.value = null
    editToPort.value = null
  }
}

function cancelEditMapping() {
  editingIdx.value = null
  editFromPort.value = null
  editToPort.value = null
}

// Skip duplicate pre-checks; UI already filters to available inputs

// Watch for prop changes
watch(() => props.defaultInput, v => { inputNumber.value = v })
watch(() => props.defaultOutput, v => { outputNumber.value = v })
watch(() => props.defaultTrack, v => { trackNumber.value = v })
watch(() => props.existingConnections, () => {
  buildUpstreamSourceLabels()
  loadTakenPorts()
})
watch(() => props.toNode?.id, () => loadTakenPorts())

// (moved below inputOptions definition)

// Helper to get label of node connected to a given input
function getConnectedNodeLabel(inputNum) {
const conn = props.existingConnections.find(c => 
  (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === inputNum
)
if (conn) {
  // Try to find the fromNode label
  if (conn.from_node_id || conn.from) {
    // Try to find the node in the modal's props (fromNode or toNode)
    if (props.fromNode && (props.fromNode.id === conn.from_node_id || props.fromNode.id === conn.from)) {
      return props.fromNode.label
    }
    // Otherwise just show 'Connected'
    return 'Connected'
  }
  return 'Connected'
}
return null
}

function getNodeLabelById(id) {
const node = props.elements.find(e => e.id === id)
return node?.track_name || node?.label || id
}

function getLRAwareSourceLabel(incoming, visitedNodes = new Set()) {
  const srcId = incoming.from_node_id || incoming.from
  const src = props.elements.find(e => e.id === srcId)
  if (!src) return 'Connected'
  
  const srcType = (src.gear_type || src.node_type || '').toLowerCase()
  
  // If this is a source, return the source label
  if (srcType === 'source') {
    // Clean base: extract number from label, strip LR suffix and number suffix
    const label = src.label || ''
    const trackName = src.track_name || ''
    const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
    const num = m ? m[2] : ''
    // Get clean base: prefer track_name (cleaned), fall back to label base
    let base
    if (trackName) {
      base = trackName.replace(/ \([\dA-Z]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
    } else if (m) {
      base = m[1].replace(/\s*LR$/i,'').trim()
    } else {
      base = label.replace(/ \([\dA-Z]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
    }
    const numSuffix = num ? ` (${num})` : ''
    const outCount = src.num_outputs || src.outputs || 0
    if (outCount === 2) {
      // Look for sibling connection from same source to this transformer to decide L/R
      const siblings = (props.existingConnections || []).filter(c =>
        (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) &&
        (c.from_node_id === srcId || c.from === srcId) &&
        typeof c.input_number === 'number'
      ).map(c => c.input_number).sort((a,b)=>a-b)
      if (siblings.length >= 2) {
        const first = siblings[0]
        return incoming.input_number === first ? `${base} L${numSuffix}` : `${base} R${numSuffix}`
      }
      // Fallback heuristic by parity
      return `${base} ${Number(incoming.input_number) % 2 === 1 ? 'L' : 'R'}${numSuffix}`
    }
    return `${base}${numSuffix}`
  }
  
  // If this is a transformer, recursively trace back to find the source
  if (srcType === 'transformer' && !visitedNodes.has(srcId)) {
    visitedNodes.add(srcId)
    
    const inputNum = incoming.input_number
    
    // Try to find incoming connection to this transformer at the specified input number
    let parentIncoming = (props.existingConnections || []).find(c =>
      (c.to_node_id === srcId || c.to === srcId) && c.input_number === inputNum
    )
    
    if (parentIncoming) {
      // Direct connection found - recursively trace from the parent
      return getLRAwareSourceLabel(parentIncoming, visitedNodes)
    }
    
    // If no direct connection, check for port-mapped connections
    // Find any connection to this transformer
    const transformerIncoming = (props.existingConnections || []).find(c =>
      (c.to_node_id === srcId || c.to === srcId)
    )
    
    if (transformerIncoming) {
      // For port-mapped connections, the mapping logic is handled in buildUpstreamSourceLabels
      // But here we can still try to trace: if transformer input X is mapped, 
      // we need to find what's on the parent's output that maps to input X
      // For now, try tracing from the first input
      parentIncoming = (props.existingConnections || []).find(c =>
        (c.to_node_id === srcId || c.to === srcId) && c.input_number === 1
      )
      
      if (parentIncoming) {
        return getLRAwareSourceLabel(parentIncoming, visitedNodes)
      }
    }
  }
  
  // Fallback: return node label
  return src.track_name || src.label || 'Connected'
}

// Fallback port name for 'from' ports
function getFromPortName(portNum) {
  if (isTransformerFrom.value) {
    const incoming = (props.existingConnections || []).find(c =>
      (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === portNum
    )
    if (incoming) {
      const srcLabel = getLRAwareSourceLabel(incoming)
      if (srcLabel) return srcLabel
    }
  }
  if (isSource.value) {
    return getSourcePortLabel(portNum)
  }
  return `Output ${portNum}`
}

function getFromPortDisplay(portNum) {
  // Prefer upstream source name for transformer outputs
  if (isTransformerFrom.value) {
    const incoming = (props.existingConnections || []).find(c =>
      (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === portNum
    )
    if (incoming) {
      const srcLabel = getLRAwareSourceLabel(incoming)
      if (srcLabel) return srcLabel
    }
  }
  if (isSource.value) {
    return getSourcePortLabel(portNum)
  }
  return `Output ${portNum}`
}

const inputOptions = computed(() => {
const arr = []
for (let n = 1; n <= numInputs.value; n++) {
  let label = `Input ${n}`
  let disabled = false
  
  // Check if taken by direct connection
  const takenConn = props.existingConnections.find(c => 
    (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === n
  )
  
  // Check if taken by port mapping
  const takenByPortMap = takenToPorts.value.has(n)
  const portMapLabel = portMappedInputLabels.value[n]
  
  if (takenConn || takenByPortMap) {
    disabled = true
    let nodeLabel = 'Taken'
    if (takenConn) {
      if (takenConn.from_node_id || takenConn.from) {
        nodeLabel = getNodeLabelById(takenConn.from_node_id || takenConn.from)
      }
    } else if (portMapLabel) {
      nodeLabel = portMapLabel
    }
    label = `Input ${n} (Assigned to ${nodeLabel})`
  }
  arr.push({ value: n, label, disabled })
}
return arr
})

const outputOptions = computed(() => {
const arr = []
for (let n = 1; n <= numOutputs.value; n++) {
  const takenConn = props.existingConnections.find(c => 
    (c.from_node_id === props.fromNode.id || c.from === props.fromNode.id) && c.output_number === n
  )
  let label = `Output ${n}`
  let disabled = false
  if (takenConn) {
    let nodeLabel = 'Taken'
    if (takenConn.to_node_id || takenConn.to) {
      nodeLabel = getNodeLabelById(takenConn.to_node_id || takenConn.to)
    }
    label = `Output ${n} (Assigned to ${nodeLabel})`
    disabled = true
  }
  arr.push({ value: n, label, disabled })
}
return arr
})

const trackOptions = computed(() => {
const arr = []
for (let n = 1; n <= numTracks.value; n++) {
  const takenConn = props.existingConnections.find(c => 
    (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.track_number === n
  )
  let label = `Track ${n}`
  let disabled = false
  if (takenConn) {
    let nodeLabel = 'Taken'
    if (takenConn.from_node_id || takenConn.from) {
      nodeLabel = getNodeLabelById(takenConn.from_node_id || takenConn.from)
    }
    label = `Track ${n} (Assigned to ${nodeLabel})`
    disabled = true
  }
  arr.push({ value: n, label, disabled })
}
return arr
})

// When recorder has no explicit track count, fall back to inputs but label them as Track
const recorderAssignmentOptions = computed(() => {
  if ((numTracks.value || 0) > 0) return trackOptions.value
  // Build from inputs
  const arr = []
  for (let n = 1; n <= numInputs.value; n++) {
    let label = `Track ${n}`
    let disabled = false
    
    // Check if taken by direct connection
    const takenConn = (props.existingConnections || []).find(c =>
      (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === n
    )
    
    // Check if taken by port mapping
    const takenByPortMap = takenToPorts.value.has(n)
    const portMapLabel = portMappedInputLabels.value[n]
    
    if (takenConn || takenByPortMap) {
      disabled = true
      let nodeLabel = 'Taken'
      if (takenConn) {
        if (takenConn.from_node_id || takenConn.from) {
          nodeLabel = getNodeLabelById(takenConn.from_node_id || takenConn.from)
        }
      } else if (portMapLabel) {
        nodeLabel = portMapLabel
      }
      label = `Track ${n} (Assigned to ${nodeLabel})`
    }
    arr.push({ value: n, label, disabled })
  }
  return arr
})

// No auto-selection; user can type any number. Uniqueness enforced by DB.

// Used inputs summary for this target
const usedInputsDetailed = computed(() => {
  return (props.existingConnections || [])
    .filter(c => (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number)
    .map(c => ({ num: c.input_number, label: getNodeLabelById(c.from_node_id || c.from) }))
    .sort((a,b) => a.num - b.num)
})

const outputMatrix = computed(() => {
// For each output, show if assigned and to whom
const arr = []
for (let n = 1; n <= numOutputs.value; n++) {
  const takenConn = props.existingConnections.find(c =>
    (c.from_node_id === props.fromNode.id || c.from === props.fromNode.id) && c.output_number === n
  )
  if (takenConn) {
    let nodeLabel = 'Assigned'
    if (takenConn.to_node_id || takenConn.to) {
      nodeLabel = getNodeLabelById(takenConn.to_node_id || takenConn.to)
    }
    arr.push({ assigned: true, assignedLabel: nodeLabel })
  } else {
    arr.push({ assigned: false })
  }
}
return arr
})

function selectOutputFromMatrix(n) {
outputNumber.value = n
}

watch(outputNumber, (val) => {
// Optionally, scroll matrix into view or highlight
})

async function submit() {
loading.value = true
errorMsg.value = ''
  try {
  // Handle port mapping for non-source to non-source connections
  if (needsPortMapping.value) {
    if (portMappings.value.length === 0) {
      errorMsg.value = 'Please add at least one port mapping.'
      loading.value = false
      return
    }
    
    // Check if parent connection already exists (one per pair)
    const { data: existingParent } = await supabase
      .from('connections')
      .select('id')
      .eq('project_id', props.projectId)
      .eq('from_node_id', props.fromNode.id)
      .eq('to_node_id', props.toNode.id)
      .maybeSingle()
    
    let parentConnId
    if (existingParent) {
      parentConnId = existingParent.id
      // Delete existing port mappings
      await supabase
        .from('connection_port_map')
        .delete()
        .eq('connection_id', parentConnId)
    } else {
      // Create parent connection (no input_number for port-mapped connections)
      const parentConn = {
        project_id: props.projectId,
        from_node_id: props.fromNode.id,
        to_node_id: props.toNode.id,
        pad: -Math.abs(Number(padValue.value) || 0),
        phantom_power: phantomPowerEnabled.value,
        connection_type: connectionType.value
      }
      const { data: savedParent, error: parentError } = await supabase
        .from('connections')
        .insert([parentConn])
        .select()
        .single()
      if (parentError) throw parentError
      parentConnId = savedParent.id
    }
    
    // Save all port mappings
    const portMapInserts = portMappings.value.map(m => ({
      project_id: props.projectId,
      connection_id: parentConnId,
      from_port: m.from_port,
      to_port: m.to_port
    }))
    
    const { error: mapError } = await supabase
      .from('connection_port_map')
      .insert(portMapInserts)
    if (mapError) throw mapError
    
    // Fetch the full connection object to include all fields needed for drawing
    const { data: fullConnection, error: fetchError } = await supabase
      .from('connections')
      .select('*')
      .eq('id', parentConnId)
      .single()
    
    if (fetchError) throw fetchError
    
    toast.success('Connection saved successfully')
    emit('confirm', { ...fullConnection, port_mappings: portMappings.value })
    return
  }
  
  // No duplicate pre-checks; rely on UI filtering and DB constraint
  const connection = {
    project_id: props.projectId,
    from_node_id: props.fromNode.id,
    to_node_id: props.toNode.id,
    input_number: inputNumber.value,
    output_number: undefined, // never set output_number
    track_number: undefined,
    pad: -Math.abs(Number(padValue.value) || 0),
    phantom_power: phantomPowerEnabled.value,
    connection_type: connectionType.value
  }
  const savedConnection = await addConnection(connection)
  toast.success('Connection saved successfully')
  emit('confirm', savedConnection)
} catch (e) {
  if (e?.code === '23505') {
    // Unique input constraint hit - refetch latest and retry once on first available
    try {
      const { data: latest } = await supabase
        .from('connections')
        .select('to_node_id,input_number')
        .eq('project_id', props.projectId)
        .eq('to_node_id', props.toNode.id)
      const used = new Set((latest || []).map(c => c.input_number).filter(Boolean))
      const opts = inputOptions.value || []
      const firstAvail = opts.find(o => !o.disabled && !used.has(o.value))?.value
      if (typeof firstAvail !== 'undefined') {
        inputNumber.value = firstAvail
        const retryConn = {
          project_id: props.projectId,
          from_node_id: props.fromNode.id,
          to_node_id: props.toNode.id,
          input_number: inputNumber.value,
          output_number: undefined,
          track_number: undefined,
          pad: -Math.abs(Number(padValue.value) || 0),
          phantom_power: phantomPowerEnabled.value,
          connection_type: connectionType.value
        }
        const saved = await addConnection(retryConn)
        emit('confirm', saved)
        return
      }
      errorMsg.value = 'All inputs are occupied.'
    } catch (err) {
      errorMsg.value = err?.message || 'Failed to save connection.'
    }
  } else {
    errorMsg.value = e.message || 'Failed to save connection.'
  }
} finally {
  loading.value = false
}
}

const isTransformerToRecorder = computed(() =>
((props.fromNode.gearType || props.fromNode.node_type) === 'transformer' && (props.toNode.gearType || props.toNode.node_type) === 'recorder')
)

function confirmTransformerToRecorder() {
loading.value = true
addConnection({
  project_id: props.projectId,
  from_node_id: props.fromNode.id,
  to_node_id: props.toNode.id
}).then(conn => {
  toast.success('Connection saved successfully')
  emit('confirm', conn)
}).catch(e => {
  errorMsg.value = e.message || 'Failed to save connection.'
}).finally(() => {
  loading.value = false
})
}

onMounted(() => {
const fromType = props.fromNode.gearType || props.fromNode.node_type
const toType = props.toNode.gearType || props.toNode.node_type
if (fromType === 'transformer' && toType === 'recorder') {
  // Immediately emit confirm and do not render modal
  emit('confirm', {
    project_id: props.projectId,
    from_node_id: props.fromNode.id,
    to_node_id: props.toNode.id
  })
}
// If default input is already taken in this session context, pick first free
try {
  const used = new Set((props.existingConnections || [])
    .filter(c => (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number)
    .map(c => c.input_number))
  if (used.has(inputNumber.value)) {
    for (let n = 1; n <= (numInputs.value || 64); n++) {
      if (!used.has(n)) { inputNumber.value = n; break }
    }
  }
} catch {}
// Build upstream labels for transformer outputs
buildUpstreamSourceLabels()
// Load already-taken mapped ports for source and target across existing connections
loadTakenPorts()

// Center modal on mount and ensure it's in viewport
centerModal()

// Ensure modal stays in viewport on window resize
window.addEventListener('resize', ensureModalInViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', ensureModalInViewport)
  stopDrag()
})
</script>

<style scoped>
.modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.5);
z-index: 1000;
pointer-events: all;
}

.modal-content {
background: white;
border-radius: 12px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
max-width: 500px;
width: 90%;
max-height: 80vh;
overflow: hidden;
position: fixed;
z-index: 1001;
}

.draggable-modal {
  user-select: none;
}

.draggable-modal .modal-header {
  user-select: none;
}

.help { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: #6b7280; }
.help-title { font-weight: 600; margin-right: 6px; }
.pill { background: #eef2f7; color: #374151; padding: 2px 8px; border-radius: 999px; }
.error-msg { color: #b91c1c; font-size: 12px; margin-bottom: 8px; }

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 20px;
border-bottom: 1px solid #e9ecef;
cursor: move;
}

.modal-title {
margin: 0;
font-size: 18px;
font-weight: 600;
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
transition: all 0.2s;
position: relative;
z-index: 10;
}

.close-btn:hover {
background: #f8f9fa;
color: #495057;
}

.modal-body {
padding: 20px;
overflow-y: auto;
max-height: 70vh;
}

.connection-info {
margin-bottom: 25px;
}

.connection-pair {
display: flex;
align-items: center;
gap: 15px;
padding: 20px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.node-info {
flex: 1;
text-align: center;
}

.node-label {
font-size: 12px;
color: #6c757d;
margin-bottom: 5px;
font-weight: 500;
}

.node-name {
font-size: 16px;
font-weight: 600;
color: #212529;
margin-bottom: 5px;
}

.node-details {
font-size: 12px;
color: #6c757d;
}

.connection-arrow {
display: flex;
align-items: center;
justify-content: center;
width: 40px;
height: 40px;
}

.arrow-icon {
font-size: 20px;
color: #007bff;
font-weight: bold;
}

.connection-form {
display: flex;
flex-direction: column;
gap: 20px;
}

.form-group {
display: flex;
flex-direction: column;
gap: 8px;
}

.form-label {
font-size: 14px;
font-weight: 500;
color: #495057;
}

.form-select {
padding: 10px 12px;
border: 1px solid #ced4da;
border-radius: 6px;
font-size: 14px;
background: white;
transition: border-color 0.2s;
}

.form-select:focus {
outline: none;
border-color: #007bff;
box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-actions {
display: flex;
gap: 10px;
margin-top: 10px;
}

.btn-confirm {
flex: 1;
padding: 12px 20px;
background: #007bff;
color: white;
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-confirm:hover {
background: #0056b3;
}

.btn-cancel {
flex: 1;
padding: 12px 20px;
background: #6c757d;
color: white;
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-cancel:hover {
background: #545b62;
}

.output-matrix {
margin: 18px 0 24px 0;
}
.matrix-title {
font-weight: 600;
margin-bottom: 8px;
color: #222;
}
.matrix-grid {
display: flex;
flex-wrap: wrap;
gap: 8px;
}
.matrix-cell {
min-width: 110px;
padding: 10px 12px;
border-radius: 8px;
background: #f8f9fa;
border: 1.5px solid #e9ecef;
cursor: pointer;
display: flex;
flex-direction: column;
align-items: flex-start;
transition: background 0.15s, border 0.15s;
}
.matrix-cell.selected {
border: 2px solid #007bff;
background: #e7f1ff;
}
.matrix-cell.assigned {
background: #f1f1f1;
color: #aaa;
border: 1.5px solid #e0e0e0;
cursor: not-allowed;
}
.cell-label {
font-weight: 500;
margin-bottom: 2px;
}
.cell-assigned {
font-size: 0.95em;
color: #888;
}
.cell-available {
font-size: 0.95em;
color: #28a745;
}

.connection-properties {
display: flex;
flex-direction: column;
gap: 10px;
padding: 10px;
background: #f8f9fa;
border-radius: 6px;
border: 1px solid #e9ecef;
}

.checkbox-label {
display: flex;
align-items: center;
gap: 8px;
font-size: 14px;
cursor: pointer;
user-select: none;
}

.checkbox-label input[type="checkbox"] {
width: 18px;
height: 18px;
cursor: pointer;
}

.checkbox-label span {
font-weight: 500;
color: #495057;
}

.select-label {
display: flex;
flex-direction: column;
gap: 6px;
}

.select-label select {
padding: 8px 10px;
border: 1px solid #ced4da;
border-radius: 6px;
}

.port-mapping-container {
display: flex;
flex-direction: column;
gap: 12px;
}

.port-mappings-list {
display: flex;
flex-direction: column;
gap: 8px;
margin-bottom: 12px;
}

.port-mapping-row {
display: flex;
align-items: center;
gap: 8px;
padding: 10px;
background: #f8f9fa;
border-radius: 6px;
border: 1px solid #e9ecef;
}

.port-mapping-row > span:last-of-type {
margin-right: auto;
}

.port-mapping-row .arrow {
color: #007bff;
font-weight: bold;
}

.btn-remove {
background: #dc3545;
color: white;
border: none;
border-radius: 4px;
width: 24px;
height: 24px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
font-size: 18px;
line-height: 1;
transition: background-color 0.2s;
}

.btn-remove:hover {
background: #c82333;
}

.port-mapping-add {
display: flex;
align-items: center;
gap: 8px;
flex-wrap: wrap;
}

.port-mapping-add .form-select {
flex: 1;
min-width: 120px;
}

.port-mapping-add .arrow {
color: #007bff;
font-weight: bold;
}

.btn-add {
padding: 8px 16px;
background: #28a745;
color: white;
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-add:hover:not(:disabled) {
background: #218838;
}

.btn-add:disabled {
background: #6c757d;
cursor: not-allowed;
}

.btn-edit {
background: #007bff;
color: white;
border: none;
border-radius: 4px;
width: 28px;
height: 24px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
font-size: 14px;
line-height: 1;
transition: background-color 0.2s;
}

.btn-edit:hover {
background: #0056b3;
}

.btn-save-small {
background: #28a745;
color: white;
border: none;
border-radius: 4px;
width: 28px;
height: 28px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
font-size: 16px;
line-height: 1;
transition: background-color 0.2s;
}

.btn-save-small:hover {
background: #218838;
}

.btn-cancel-small {
background: #6c757d;
color: white;
border: none;
border-radius: 4px;
width: 28px;
height: 28px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
font-size: 16px;
line-height: 1;
transition: background-color 0.2s;
}

.btn-cancel-small:hover {
background: #5a6268;
}

.form-select-small {
flex: 1;
min-width: 100px;
padding: 4px 8px;
border: 1px solid #ced4da;
border-radius: 4px;
font-size: 14px;
}

@media (max-width: 768px) {
.modal-content {
  width: 95%;
  margin: 20px;
}

.connection-pair {
  flex-direction: column;
  gap: 10px;
}

.connection-arrow {
  transform: rotate(90deg);
}

.form-actions {
  flex-direction: column;
}
}
</style> 