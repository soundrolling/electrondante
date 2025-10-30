<template>
<div v-if="isTransformerToRecorder" class="modal-overlay" @mousedown.self="$emit('cancel')">
  <div class="modal-content">
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
  <div class="modal-content">
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
        <div v-if="isSource && isTransformerTo" class="form-group">
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
            <option v-for="opt in trackOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              {{ opt.label }}
            </option>
          </select>
          
        </div>
        <div v-else-if="needsPortMapping" class="form-group">
          <label>Map Ports: <b>{{ fromNode.label }}</b> → <b>{{ toNode.label }}</b></label>
          <div class="port-mapping-container">
            <div v-if="portMappings.length > 0" class="port-mappings-list">
            <div v-for="(mapping, idx) in portMappings" :key="idx" class="port-mapping-row">
              <span>{{ isTransformerFrom ? getFromPortDisplay(mapping.from_port) : `Output ${mapping.from_port}` }}</span>
              <span class="arrow">→</span>
              <span>{{ isRecorderTo ? `Track ${mapping.to_port}` : `Input ${mapping.to_port}` }}</span>
                <button type="button" class="btn-remove" @click="removePortMapping(idx)">×</button>
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
import { ref, watch, computed, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { addConnection, updateConnection } from '@/services/signalMapperService'

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

// Use port mapping when neither side is a source, and at least one side is a transformer
// (also supports recorder→recorder)
const needsPortMapping = computed(() =>
  (!isSource.value && (isTransformerFrom.value || isTransformerTo.value)) ||
  (isRecorderFrom.value && isRecorderTo.value)
)

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

// Get available ports for mapping
const availableFromPorts = computed(() => {
  const used = new Set(portMappings.value.map(m => m.from_port).filter(Boolean))
  const opts = []
  for (let n = 1; n <= numOutputs.value; n++) {
    if (used.has(n)) continue
    let label = `Output ${n}`
    // If mapping from a transformer, try to label output N by the source feeding its input N
    if (isTransformerFrom.value) {
      const incoming = (props.existingConnections || []).find(c =>
        (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === n
      )
      if (incoming) {
        const srcLabel = getNodeLabelById(incoming.from_node_id || incoming.from)
        if (srcLabel) label = `${label} – ${srcLabel}`
      }
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
        if (!taken) opts.push({ value: n, label: `Track ${n}` })
      }
    }
  } else {
    for (let n = 1; n <= numInputs.value; n++) {
      if (!used.has(n)) {
        const taken = (props.existingConnections || []).find(c =>
          (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === n
        )
        if (!taken) opts.push({ value: n, label: `Input ${n}` })
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
}

// Disallow duplicate connection from the same source to the same target
const sourceHasConnectionToTarget = computed(() => {
  return (props.existingConnections || []).some(c =>
    (c.from_node_id === props.fromNode.id || c.from === props.fromNode.id) &&
    (c.to_node_id === props.toNode.id || c.to === props.toNode.id)
  )
})

// Watch for prop changes
watch(() => props.defaultInput, v => { inputNumber.value = v })
watch(() => props.defaultOutput, v => { outputNumber.value = v })
watch(() => props.defaultTrack, v => { trackNumber.value = v })

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

function getFromPortDisplay(portNum) {
  // Prefer upstream source name for transformer outputs
  if (isTransformerFrom.value) {
    const incoming = (props.existingConnections || []).find(c =>
      (c.to_node_id === props.fromNode.id || c.to === props.fromNode.id) && c.input_number === portNum
    )
    if (incoming) {
      const srcLabel = getNodeLabelById(incoming.from_node_id || incoming.from)
      if (srcLabel) return srcLabel
    }
  }
  return `Output ${portNum}`
}

const inputOptions = computed(() => {
const arr = []
for (let n = 1; n <= numInputs.value; n++) {
  const takenConn = props.existingConnections.find(c => 
    (c.to_node_id === props.toNode.id || c.to === props.toNode.id) && c.input_number === n
  )
  let label = `Input ${n}`
  let disabled = false
  if (takenConn) {
    let nodeLabel = 'Taken'
    if (takenConn.from_node_id || takenConn.from) {
      nodeLabel = getNodeLabelById(takenConn.from_node_id || takenConn.from)
    }
    label = `Input ${n} (Assigned to ${nodeLabel})`
    disabled = true
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
    
    emit('confirm', { id: parentConnId, port_mappings: portMappings.value })
    return
  }
  
  // Block if a connection from this source to this target already exists
  if (sourceHasConnectionToTarget.value) {
    errorMsg.value = 'This source is already connected to this device.'
    loading.value = false
    return
  }

  // Refresh latest assignments for target to avoid stale duplicate selection
  try {
    const { data: latest, error } = await supabase
      .from('connections')
      .select('to_node_id,input_number,from_node_id')
      .eq('project_id', props.projectId)
      .eq('to_node_id', props.toNode.id)
    if (!error && Array.isArray(latest)) {
      const used = new Set(latest.map(c => c.input_number).filter(Boolean))
      if (used.has(inputNumber.value)) {
        const firstAvail = (inputOptions.value || []).find(o => !o.disabled && !used.has(o.value))?.value
        if (typeof firstAvail !== 'undefined') {
          inputNumber.value = firstAvail
        } else {
          errorMsg.value = 'All inputs are occupied.'
          loading.value = false
          return
        }
      }
    }
  } catch {}
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
    await addConnection(connection)
  emit('confirm', connection)
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
display: flex;
align-items: center;
justify-content: center;
z-index: 1000;
}

.modal-content {
background: white;
border-radius: 12px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
max-width: 500px;
width: 90%;
max-height: 80vh;
overflow: hidden;
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
margin-left: auto;
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