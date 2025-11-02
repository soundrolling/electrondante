<template>
<div v-if="isTransformerToRecorder" class="modal-overlay" @mousedown.self="$emit('cancel')">
  <div 
    ref="modalRef"
    class="modal-content draggable-modal"
    :style="modalStyle"
  >
    <div class="modal-header" @mousedown="startDrag">
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
  >
    <div class="modal-header" @mousedown="startDrag">
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
                <span>{{ isRecorderTo ? (toRecorderTrackNames[mapping.to_port] || traceRecorderTrackInputForModal(props.toNode.id, mapping.to_port) || `Track ${mapping.to_port}`) : `Input ${mapping.to_port}` }}</span>
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
  // Don't start drag on interactive elements (buttons, inputs, etc.)
  if (e.target.closest('button')) return
  if (e.target.closest('input')) return
  if (e.target.closest('select')) return
  if (e.target.closest('textarea')) return
  if (e.target.closest('a')) return
  
  // Allow dragging from the header area
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
// Store recorder track names (track number -> source label) for the FROM recorder
const recorderTrackNames = ref({})
// Store recorder track names (track number -> source label) for the TO recorder
const toRecorderTrackNames = ref({})

async function buildUpstreamSourceLabels() {
  try {
    upstreamSourceLabels.value = {}
    if (!isTransformerFrom.value) return
    
    // First, get all connections TO this transformer from the database (including those with port maps)
    const { data: parentConns } = await supabase
      .from('connections')
      .select('id, from_node_id, to_node_id, input_number')
      .eq('project_id', props.projectId)
      .eq('to_node_id', props.fromNode.id)
    
    if (!parentConns || parentConns.length === 0) return
    
    // Process each connection to this transformer
    for (const parentConn of parentConns) {
      // Check if this connection has port maps
      const { data: maps } = await supabase
        .from('connection_port_map')
        .select('from_port, to_port')
        .eq('connection_id', parentConn.id)
      
      const parentFromNode = props.elements.find(e => e.id === parentConn.from_node_id)
      if (!parentFromNode) continue
      
      const fromNodeType = (parentFromNode.gear_type || parentFromNode.node_type || '').toLowerCase()
      
      if (maps && maps.length > 0) {
        // Connection has port maps - process each mapping
        for (const m of maps) {
          let label = ''
          // m.from_port is the OUTPUT port on the parent (source/transformer output)
          // m.to_port is the INPUT port on this transformer
          const parentOutputPort = m.from_port
          const thisTransformerInput = m.to_port
          
          if (fromNodeType === 'source') {
            // Direct source connection - get source label with L/R based on output port
            const incoming = { 
              from_node_id: parentConn.from_node_id, 
              input_number: parentOutputPort 
            }
            label = getLRAwareSourceLabel(incoming)
          } else if (fromNodeType === 'transformer') {
            // Parent is a transformer - trace what's on its OUTPUT port back to source
            const tracedLabel = await traceTransformerOutput(parentConn.from_node_id, parentOutputPort)
            if (tracedLabel) {
              label = tracedLabel
            } else {
              // Fallback: try to trace through direct connection
              const anyParentInput = (props.existingConnections || []).find(c =>
                (c.to_node_id === parentConn.from_node_id || c.to === parentConn.from_node_id) && 
                c.input_number === parentOutputPort
              )
              if (anyParentInput) {
                label = getLRAwareSourceLabel(anyParentInput)
              }
            }
          } else {
            // Other node type - fallback
            label = parentFromNode.track_name || parentFromNode.label || ''
          }
          if (label) upstreamSourceLabels.value[m.to_port] = label
        }
      } else {
        // Connection has no port maps - direct connection
        // Use input_number from connection, or default to 1 if not specified
        const inputNum = parentConn.input_number || 1
        const incoming = { 
          from_node_id: parentConn.from_node_id,
          input_number: inputNum
        }
        const label = getLRAwareSourceLabel(incoming)
        if (label) {
          // For transformers, output N = input N, so map accordingly
          upstreamSourceLabels.value[inputNum] = label
        }
      }
    }
    
    // Also check props.existingConnections for any we might have missed
    const directIncomings = (props.existingConnections || []).filter(c =>
      (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && 
      typeof c.input_number === 'number' &&
      !upstreamSourceLabels.value[c.input_number] // Only if not already set
    )
    
    // Build labels from direct incoming connections - recursively trace to source
    directIncomings.forEach(inc => {
      const label = getLRAwareSourceLabel(inc)
      if (label && !upstreamSourceLabels.value[inc.input_number]) {
        upstreamSourceLabels.value[inc.input_number] = label
      }
    })
  } catch {}
}

function getSourceLabelParts(node){
  // Prefer track_name for base if present, but numbering comes from label suffix
  const label = node?.label || ''
  const trackName = node?.track_name || ''
  // Extract identifier from label (e.g., "DJ L (A)" -> identifier is "A", "FOH Feed LR (2)" -> identifier is "2")
  // Supports both letters (A-Z) and numbers (0-9)
  const m = (label || '').match(/^(.*) \(([A-Z0-9]+)\)$/)
  const identifier = m ? m[2] : ''
  // Get base: prefer track_name (cleaned), fall back to label base (without identifier)
  let baseNoNum
  if (trackName) {
    // Clean track_name: remove identifier suffix and LR
    baseNoNum = trackName.replace(/ \([A-Z0-9]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  } else if (m) {
    // Use label base without identifier: already extracted in m[1]
    baseNoNum = m[1].replace(/\s*LR$/i,'').trim()
  } else {
    // No identifier in label, clean what we have
    baseNoNum = label.replace(/ \([A-Z0-9]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  }
  const numSuffix = identifier ? ` (${identifier})` : ''
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
  // Check for stored output port labels first (most reliable for stereo sources)
  if (node?.output_port_labels && typeof node.output_port_labels === 'object') {
    const storedLabel = node.output_port_labels[String(portNum)] || node.output_port_labels[portNum]
    if (storedLabel) return storedLabel
  }
  
  // Fallback to computed labels if not stored
  const label = node?.label || ''
  const trackName = node?.track_name || ''
  // Extract identifier (supports both letters A-Z and numbers 0-9)
  const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
  const identifier = m ? m[2] : ''
  let base
  if (trackName) {
    base = trackName.replace(/ \([A-Z0-9]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  } else if (m) {
    base = m[1].replace(/\s*LR$/i,'').trim()
  } else {
    base = label.replace(/ \([A-Z0-9]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
  }
  const numSuffix = identifier ? ` (${identifier})` : ''
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

// Load recorder track names asynchronously for FROM recorder
async function loadRecorderTrackNames() {
  if (!isRecorderFrom.value) {
    recorderTrackNames.value = {}
    return
  }
  
  const trackNames = {}
  const count = numOutputs.value || 0
  
  // Load all track names in parallel
  const promises = []
  for (let n = 1; n <= count; n++) {
    promises.push(
      traceRecorderTrackNameForModalAsync(props.fromNode.id, n)
        .then(label => {
          if (label) trackNames[n] = label
        })
        .catch(() => {})
    )
  }
  
  await Promise.all(promises)
  recorderTrackNames.value = trackNames
}

// Load recorder track names asynchronously for TO recorder
async function loadToRecorderTrackNames() {
  if (!isRecorderTo.value) {
    toRecorderTrackNames.value = {}
    return
  }
  
  const trackNames = {}
  const count = (numTracks.value && numTracks.value > 0) ? numTracks.value : (numInputs.value || 0)
  
  // Load all track names in parallel
  const promises = []
  for (let n = 1; n <= count; n++) {
    promises.push(
      traceRecorderTrackNameForModalAsync(props.toNode.id, n)
        .then(label => {
          if (label) trackNames[n] = label
        })
        .catch(() => {})
    )
  }
  
  await Promise.all(promises)
  toRecorderTrackNames.value = trackNames
}

// Get available ports for mapping
const availableFromPorts = computed(() => {
  const used = new Set(portMappings.value.map(m => m.from_port).filter(Boolean))
  const opts = []
  for (let n = 1; n <= numOutputs.value; n++) {
    if (used.has(n)) continue
    if (takenFromPorts.value.has(n)) continue
    let label
    if (isRecorderFrom.value) {
      // For recorders, output port corresponds to track number - use track name
      // First try the preloaded async names, then fallback to sync version
      label = recorderTrackNames.value[n] || traceRecorderTrackNameForModal(props.fromNode.id, n)
      if (!label) label = `Track ${n}`
    } else if (isTransformerFrom.value) {
      // For transformers, assume 1:1 mapping: output N corresponds to input N
      // Check upstreamSourceLabels which is keyed by input number
      label = upstreamSourceLabels.value[n]
      
      // If not found in upstreamSourceLabels, try direct connection tracing
      if (!label) {
        const incoming = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === n
        )
        if (incoming) {
          label = getLRAwareSourceLabel(incoming)
          // Cache it in upstreamSourceLabels for future use
          if (label) upstreamSourceLabels.value[n] = label
        }
      }
      
      // If still no label, try to trace through any connection to this transformer
      if (!label) {
        const anyIncoming = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id)
        )
        if (anyIncoming) {
          label = getLRAwareSourceLabel(anyIncoming)
          if (label) upstreamSourceLabels.value[n] = label
        }
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

// Trace what input is assigned to a recorder track (for showing in "To Port" dropdown)
function traceRecorderTrackInputForModal(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // Find connection TO this recorder that uses this track number
  const trackConn = (props.existingConnections || []).find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  if (!trackConn) return null
  
  // Trace back to get the source label (same logic as traceRecorderTrackNameForModal but for "To" side)
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Check if the source node is another recorder (similar logic to traceRecorderTrackNameForModal)
  const isSourceRecorder = (props.existingConnections || []).some(c =>
    (c.to_node_id === sourceNodeId || c.to === sourceNodeId) && c.track_number
  )
  
  // Also check if it's the fromNode or toNode in this modal
  const isFromNodeRecorder = props.fromNode && (props.fromNode.id === sourceNodeId) && 
                              (getType(props.fromNode) === 'recorder' || hasTracks(props.fromNode))
  const isToNodeRecorder = props.toNode && (props.toNode.id === sourceNodeId) && 
                            (getType(props.toNode) === 'recorder' || hasTracks(props.toNode))
  
  if (isSourceRecorder || isFromNodeRecorder || isToNodeRecorder) {
    // Source is another recorder - recursively trace from that recorder's output
    const sourceOutputPort = trackConn.output_number || trackConn.input_number || trackNumber
    return traceRecorderTrackInputForModal(sourceNodeId, sourceOutputPort, visitedNodes)
  }
  
  // For sources and transformers, use getLRAwareSourceLabel
  return getLRAwareSourceLabel(trackConn, visitedNodes)
}

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
        if (!taken && !takenToPorts.value.has(n)) {
          // Use cached track name first, then fallback to synchronous trace
          const label = toRecorderTrackNames.value[n] || traceRecorderTrackInputForModal(props.toNode.id, n) || `Track ${n}`
          opts.push({ value: n, label })
        }
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
watch(() => props.existingConnections, async () => {
  await buildUpstreamSourceLabels()
  await loadRecorderTrackNames()
  await loadToRecorderTrackNames()
  await loadTakenPorts()
})
watch(() => props.fromNode?.id, async () => {
  await buildUpstreamSourceLabels()
  await loadRecorderTrackNames()
  await loadToRecorderTrackNames()
  await loadTakenPorts()
})
watch(() => props.toNode?.id, async () => {
  await loadToRecorderTrackNames()
  await loadTakenPorts()
})

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

// Helper to trace what's on a transformer's output port, handling port mappings
async function traceTransformerOutput(transformerId, outputPort) {
  // For transformers, assume 1:1 mapping: output N corresponds to input N
  // So if we want to know what's on output N, we trace what's feeding input N
  
  try {
    // First, query database for all connections TO this transformer
    const { data: dbConns } = await supabase
      .from('connections')
      .select('id, from_node_id, to_node_id, input_number')
      .eq('project_id', props.projectId)
      .eq('to_node_id', transformerId)
    
    if (!dbConns || dbConns.length === 0) {
      // Fallback to props.existingConnections
      const directInput = (props.existingConnections || []).find(c =>
        (c.to_node_id === transformerId || c.to === transformerId) && c.input_number === outputPort
      )
      if (directInput) {
        return getLRAwareSourceLabel(directInput)
      }
      return null
    }
    
    // Check each connection for port mappings
    for (const conn of dbConns) {
      try {
        const { data: portMaps } = await supabase
          .from('connection_port_map')
          .select('from_port, to_port')
          .eq('connection_id', conn.id)
        
        if (portMaps && portMaps.length > 0) {
          // Find mapping where to_port (transformer input) equals outputPort
          // This tells us which upstream output feeds transformer input outputPort
          const relevantMap = portMaps.find(m => Number(m.to_port) === Number(outputPort))
          if (relevantMap) {
            // Upstream output relevantMap.from_port feeds transformer input outputPort
            // For 1:1 transformer, output outputPort = input outputPort
            // So trace what's on upstream output relevantMap.from_port
            const upstreamNodeId = conn.from_node_id
            const upstreamNode = props.elements.find(e => e.id === upstreamNodeId)
            if (upstreamNode) {
              const upstreamType = (upstreamNode.gear_type || upstreamNode.node_type || '').toLowerCase()
              if (upstreamType === 'source') {
                // Direct source - get source label
                const incoming = { from_node_id: upstreamNodeId, input_number: relevantMap.from_port }
                return getLRAwareSourceLabel(incoming)
              } else if (upstreamType === 'transformer') {
                // Recursively trace upstream transformer's output
                const traced = await traceTransformerOutput(upstreamNodeId, relevantMap.from_port)
                if (traced) return traced
              }
            }
          }
        } else {
          // No port map - check if this connection's input_number matches outputPort
          const inputNum = conn.input_number || 1
          if (Number(inputNum) === Number(outputPort)) {
            // Direct connection - trace what's feeding this input
            const upstreamNodeId = conn.from_node_id
            const upstreamNode = props.elements.find(e => e.id === upstreamNodeId)
            if (upstreamNode) {
              const upstreamType = (upstreamNode.gear_type || upstreamNode.node_type || '').toLowerCase()
              if (upstreamType === 'source') {
                const incoming = { from_node_id: upstreamNodeId, input_number: inputNum }
                return getLRAwareSourceLabel(incoming)
              } else if (upstreamType === 'transformer') {
                // Recursively trace upstream transformer's corresponding output
                const traced = await traceTransformerOutput(upstreamNodeId, inputNum)
                if (traced) return traced
              }
            }
          }
        }
      } catch {}
    }
    
    // Fallback: check props.existingConnections
    const directInput = (props.existingConnections || []).find(c =>
      (c.to_node_id === transformerId || c.to === transformerId) && c.input_number === outputPort
    )
    if (directInput) {
      return getLRAwareSourceLabel(directInput)
    }
  } catch {}
  
  return null
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

// Trace track name from recorder output (track number)
// This function needs to check both direct connections and port-mapped connections
async function traceRecorderTrackNameForModalAsync(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // First, check direct connections TO this recorder
  let trackConn = (props.existingConnections || []).find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  // If no direct connection found, check port mappings
  if (!trackConn) {
    // Find all connections TO this recorder
    const recorderConns = (props.existingConnections || []).filter(c => 
      (c.to_node_id === recorderId || c.to === recorderId)
    )
    
    if (recorderConns.length > 0) {
      // Query port mappings for these connections
      const connIds = recorderConns.map(c => c.id)
      try {
        const { data: portMaps } = await supabase
          .from('connection_port_map')
          .select('connection_id, from_port, to_port')
          .in('connection_id', connIds)
          .eq('to_port', trackNumber)
        
        if (portMaps && portMaps.length > 0) {
          // Found a port mapping - get the parent connection
          const portMap = portMaps[0]
          trackConn = recorderConns.find(c => c.id === portMap.connection_id)
          if (trackConn) {
            // Add the from_port info to trackConn for tracing
            trackConn._mappedFromPort = portMap.from_port
          }
        }
      } catch (err) {
        console.error('Error querying port maps:', err)
      }
    }
  }
  
  if (!trackConn) return null
  
  // Trace back from the source of this connection
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Determine which port on the source to trace from
  let sourcePort = trackConn.output_number || trackConn.input_number || 1
  if (trackConn._mappedFromPort !== undefined) {
    sourcePort = trackConn._mappedFromPort
  }
  
  // Check if the source node is another recorder by looking for connections TO it with track_number
  // This indicates it's a recorder
  const isSourceRecorder = (props.existingConnections || []).some(c =>
    (c.to_node_id === sourceNodeId || c.to === sourceNodeId) && c.track_number
  )
  
  // Also check if it's the fromNode or toNode in this modal (which we have direct access to)
  const isFromNodeRecorder = props.fromNode && (props.fromNode.id === sourceNodeId) && 
                              (getType(props.fromNode) === 'recorder' || hasTracks(props.fromNode))
  const isToNodeRecorder = props.toNode && (props.toNode.id === sourceNodeId) && 
                            (getType(props.toNode) === 'recorder' || hasTracks(props.toNode))
  
  if (isSourceRecorder || isFromNodeRecorder || isToNodeRecorder) {
    // Source is another recorder - recursively trace from that recorder's output
    return traceRecorderTrackNameForModalAsync(sourceNodeId, sourcePort, visitedNodes)
  }
  
  // For sources and transformers, use the existing trace function
  // Create a connection-like object for tracing
  const traceConn = {
    from_node_id: sourceNodeId,
    input_number: sourcePort
  }
  const sourceLabel = getLRAwareSourceLabel(traceConn, visitedNodes)
  return sourceLabel
}

// Synchronous version for use in computed properties (will return null if port maps need to be checked)
function traceRecorderTrackNameForModal(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // Find connection TO this recorder that uses this track number
  // For recorders, output port number corresponds to track number
  const trackConn = (props.existingConnections || []).find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  if (!trackConn) {
    // Can't check port maps synchronously - return null and let async version handle it
    return null
  }
  
  // Trace back from the source of this connection
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Check if the source node is another recorder by looking for connections TO it with track_number
  // This indicates it's a recorder
  const isSourceRecorder = (props.existingConnections || []).some(c =>
    (c.to_node_id === sourceNodeId || c.to === sourceNodeId) && c.track_number
  )
  
  // Also check if it's the fromNode or toNode in this modal (which we have direct access to)
  const isFromNodeRecorder = props.fromNode && (props.fromNode.id === sourceNodeId) && 
                              (getType(props.fromNode) === 'recorder' || hasTracks(props.fromNode))
  const isToNodeRecorder = props.toNode && (props.toNode.id === sourceNodeId) && 
                            (getType(props.toNode) === 'recorder' || hasTracks(props.toNode))
  
  if (isSourceRecorder || isFromNodeRecorder || isToNodeRecorder) {
    // Source is another recorder - recursively trace from that recorder's output
    // The output port number corresponds to the track number on the source recorder
    const sourceOutputPort = trackConn.output_number || trackConn.input_number || trackNumber
    return traceRecorderTrackNameForModal(sourceNodeId, sourceOutputPort, visitedNodes)
  }
  
  // For sources and transformers, use the existing trace function
  const sourceLabel = getLRAwareSourceLabel(trackConn, visitedNodes)
  return sourceLabel
}

// Fallback port name for 'from' ports
function getFromPortName(portNum) {
  if (isRecorderFrom.value) {
    // For recorders, output port corresponds to track number - use track name
    const trackName = traceRecorderTrackNameForModal(props.fromNode.id, portNum)
    if (trackName) return trackName
    return `Track ${portNum}`
  }
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
  // For recorders, output port corresponds to track number - use track name
  if (isRecorderFrom.value) {
    // First try the preloaded async names, then fallback to sync version
    let trackName = recorderTrackNames.value[portNum] || traceRecorderTrackNameForModal(props.fromNode.id, portNum)
    if (trackName) return trackName
    return `Track ${portNum}`
  }
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

// Helper to check if source is a stereo DJ feed
function isStereoDJSource(node) {
  if (!node) return false
  const outCount = node.num_outputs || node.outputs || 0
  if (outCount !== 2) return false
  
  // Check if it's a DJ source by name or gear type
  const label = (node.label || '').toLowerCase()
  const trackName = (node.track_name || '').toLowerCase()
  const gearType = (node.gear_type || node.node_type || '').toLowerCase()
  
  return gearType === 'dj_lr' || 
         label.includes('dj') || 
         trackName.includes('dj') ||
         label.includes('dj lr') ||
         trackName.includes('dj lr')
}

// Auto-add L and R port mappings for stereo DJ sources
async function autoAddStereoDJPortMappings() {
  if (!needsPortMapping.value) return
  if (!isSource.value) return
  if (!isStereoDJSource(props.fromNode)) return
  if (portMappings.value.length > 0) return // Already has mappings
  
  // Wait for taken ports to be loaded
  await loadTakenPorts()
  
  // Find available L and R ports (ports 1 and 2 for stereo sources)
  const lPort = 1
  const rPort = 2
  
  // Check if L and R ports are available
  if (takenFromPorts.value.has(lPort) || takenFromPorts.value.has(rPort)) return
  
  // Find available target ports
  const availableTargets = availableToPorts.value
  if (availableTargets.length < 2) return // Need at least 2 target ports
  
  // Auto-add L mapping (port 1)
  if (availableTargets[0]) {
    portMappings.value.push({
      from_port: lPort,
      to_port: availableTargets[0].value
    })
  }
  
  // Auto-add R mapping (port 2) if available
  if (availableTargets[1]) {
    portMappings.value.push({
      from_port: rPort,
      to_port: availableTargets[1].value
    })
  }
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
loadTakenPorts().then(() => {
  // Auto-add stereo DJ port mappings after ports are loaded
  autoAddStereoDJPortMappings()
})
// Load recorder track names if FROM node is a recorder
loadRecorderTrackNames()
// Load recorder track names if TO node is a recorder
loadToRecorderTrackNames()

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
  background: var(--bg-primary) !important;
  color: var(--text-primary);
border-radius: 12px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
max-width: 500px;
width: 90%;
max-height: 80vh;
overflow: hidden;
position: fixed;
z-index: 1001;
}

.dark .modal-content {
  background: var(--bg-primary) !important;
  color: var(--text-primary) !important;
}

.draggable-modal {
  user-select: none;
  cursor: move;
}

.draggable-modal .modal-header {
  user-select: none;
}

.draggable-modal button,
.draggable-modal input,
.draggable-modal select,
.draggable-modal textarea,
.draggable-modal a {
  cursor: default;
  user-select: auto;
}

.draggable-modal button {
  cursor: pointer;
}

.help { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.help-title { font-weight: 600; margin-right: 6px; }
.pill { background: var(--bg-secondary); color: var(--text-secondary); padding: 2px 8px; border-radius: 999px; }
.error-msg { color: var(--color-error-700); font-size: 12px; margin-bottom: 8px; }

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 20px;
border-bottom: 1px solid var(--border-light);
cursor: move;
background: var(--bg-secondary);
}

.modal-title {
margin: 0;
font-size: 18px;
font-weight: 600;
color: var(--text-primary);
}

.close-btn {
background: var(--bg-tertiary);
border: 1px solid var(--border-medium);
font-size: 24px;
cursor: pointer;
color: var(--text-primary);
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
background: var(--bg-secondary);
color: var(--text-primary);
border-color: var(--color-primary-500);
}

.modal-body {
padding: 20px;
overflow-y: auto;
max-height: 70vh;
background: var(--bg-primary);
color: var(--text-primary);
}

.connection-info {
margin-bottom: 25px;
background: var(--bg-primary);
color: var(--text-primary);
}

.connection-pair {
display: flex;
align-items: center;
gap: 15px;
padding: 20px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid var(--border-light);
}

.node-info {
flex: 1;
text-align: center;
}

.node-label {
font-size: 12px;
color: var(--text-secondary);
margin-bottom: 5px;
font-weight: 500;
}

.node-name {
font-size: 16px;
font-weight: 600;
color: var(--text-primary);
margin-bottom: 5px;
}

.node-details {
font-size: 12px;
color: var(--text-secondary);
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
color: var(--color-primary-500);
font-weight: bold;
}

.connection-form {
display: flex;
flex-direction: column;
gap: 20px;
background: var(--bg-primary);
color: var(--text-primary);
}

.form-group {
display: flex;
flex-direction: column;
gap: 8px;
background: transparent;
color: var(--text-primary);
}

.form-group label {
color: var(--text-primary);
}

.form-label {
font-size: 14px;
font-weight: 500;
color: var(--text-primary);
}

.form-group label {
color: var(--text-primary);
font-weight: 500;
}

.form-select {
padding: 10px 12px;
border: 1px solid var(--border-medium);
border-radius: 6px;
font-size: 14px;
background: var(--bg-primary);
color: var(--text-primary);
transition: border-color 0.2s;
}

.form-select:focus {
outline: none;
border-color: var(--color-primary-500);
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
}

.form-actions {
display: flex;
gap: 10px;
margin-top: 10px;
}

.btn-confirm {
flex: 1;
padding: 12px 20px;
background: var(--color-primary-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-confirm:hover {
background: var(--color-primary-600);
}

.btn-cancel {
flex: 1;
padding: 12px 20px;
background: var(--color-secondary-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-cancel:hover {
background: var(--color-secondary-600);
}

.output-matrix {
margin: 18px 0 24px 0;
}
.matrix-title {
font-weight: 600;
margin-bottom: 8px;
color: var(--text-primary);
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
background: var(--bg-secondary);
border: 1.5px solid var(--border-light);
cursor: pointer;
display: flex;
flex-direction: column;
align-items: flex-start;
transition: background 0.15s, border 0.15s;
color: var(--text-primary);
}
.matrix-cell.selected {
border: 2px solid var(--color-primary-500);
background: rgba(59, 130, 246, 0.15);
}
.matrix-cell.assigned {
background: var(--bg-tertiary);
color: var(--text-tertiary);
border: 1.5px solid var(--border-medium);
cursor: not-allowed;
}
.cell-label {
font-weight: 500;
margin-bottom: 2px;
}
.cell-assigned {
font-size: 0.95em;
color: var(--text-tertiary);
}
.cell-available {
font-size: 0.95em;
color: var(--color-success-500);
}

.connection-properties {
display: flex;
flex-direction: column;
gap: 10px;
padding: 10px;
background: var(--bg-secondary);
border-radius: 6px;
border: 1px solid var(--border-light);
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
accent-color: var(--color-primary-500);
}

.checkbox-label span {
font-weight: 500;
color: var(--text-primary);
}

.select-label {
display: flex;
flex-direction: column;
gap: 6px;
}

.select-label select {
padding: 8px 10px;
border: 1px solid var(--border-medium);
border-radius: 6px;
background: var(--bg-primary);
color: var(--text-primary);
}

.select-label span {
color: var(--text-primary);
font-weight: 500;
}

.select-label input[type="number"] {
padding: 8px 10px;
border: 1px solid var(--border-medium);
border-radius: 6px;
background: var(--bg-primary);
color: var(--text-primary);
}

.port-mapping-container {
display: flex;
flex-direction: column;
gap: 12px;
background: transparent;
color: var(--text-primary);
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
background: var(--bg-secondary);
border-radius: 6px;
border: 1px solid var(--border-light);
color: var(--text-primary);
}

.port-mapping-row > span:last-of-type {
margin-right: auto;
}

.port-mapping-row .arrow {
color: var(--color-primary-500);
font-weight: bold;
}

.btn-remove {
background: var(--color-error-500);
  color: var(--text-inverse);
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
background: var(--color-error-600);
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
color: var(--color-primary-500);
font-weight: bold;
}

.btn-add {
padding: 8px 16px;
background: var(--color-success-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: background-color 0.2s;
}

.btn-add:hover:not(:disabled) {
background: var(--color-success-600);
}

.btn-add:disabled {
background: var(--color-secondary-500);
cursor: not-allowed;
}

.btn-edit {
background: var(--color-primary-500);
  color: var(--text-inverse);
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
background: var(--color-primary-600);
}

.btn-save-small {
background: var(--color-success-500);
  color: var(--text-inverse);
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
background: var(--color-success-600);
}

.btn-cancel-small {
background: var(--color-secondary-500);
  color: var(--text-inverse);
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
background: var(--color-secondary-600);
}

.form-select-small {
flex: 1;
min-width: 100px;
padding: 4px 8px;
border: 1px solid var(--border-medium);
border-radius: 4px;
font-size: 14px;
background: var(--bg-primary);
color: var(--text-primary);
}

.form-select option,
.form-select-small option,
.select-label select option {
background: var(--bg-primary);
color: var(--text-primary);
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