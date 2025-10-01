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
            <div class="node-name">{{ fromNode.label }}</div>
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
          <label>Assign <b>{{ fromNode.label }}</b> to Transformer Input</label>
          <select v-model.number="inputNumber">
            <option v-for="opt in inputOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              Input {{ opt.value }}
            </option>
          </select>
        </div>
        <div v-else-if="isSource && isRecorderTo" class="form-group">
          <label>Assign <b>{{ fromNode.label }}</b> to Recorder Track</label>
          <select v-model.number="trackNumber">
            <option v-for="opt in trackOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              Track {{ opt.value }}
            </option>
          </select>
        </div>
        <div v-else class="form-group">
          <!-- Fallback for other types, show input/track assignment if needed -->
          <label>Assign to Input/Track</label>
          <select v-model.number="inputNumber">
            <option v-for="opt in inputOptions" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
              Input {{ opt.value }}
            </option>
          </select>
        </div>
        <div class="form-actions">
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

const isSource = computed(() => (props.fromNode.gearType || props.fromNode.node_type) === 'source')
const isRecorder = computed(() => (props.toNode.gearType || props.toNode.node_type) === 'recorder')
const isTransformer = computed(() => (props.fromNode.gearType || props.fromNode.node_type) === 'transformer' || (props.toNode.gearType || props.toNode.node_type) === 'transformer')
const isRecorderFrom = computed(() => (props.fromNode.gearType || props.fromNode.node_type) === 'recorder')
const isRecorderTo = computed(() => (props.toNode.gearType || props.toNode.node_type) === 'recorder')
const isTransformerTo = computed(() => (props.toNode.gearType || props.toNode.node_type) === 'transformer')

const numInputs = computed(() => props.toNode.num_inputs || props.toNode.numinputs || props.toNode.inputs || 0)
const numOutputs = computed(() => props.fromNode.num_outputs || props.fromNode.numoutputs || props.fromNode.outputs || 0)
const numTracks = computed(() => props.toNode.num_tracks || props.toNode.tracks || props.toNode.num_records || props.toNode.numrecord || 0)

const inputNumber = ref(props.defaultInput)
const outputNumber = ref(props.defaultOutput)
const trackNumber = ref(props.defaultTrack)

const loading = ref(false)
const errorMsg = ref('')

// Watch for prop changes
watch(() => props.defaultInput, v => { inputNumber.value = v })
watch(() => props.defaultOutput, v => { outputNumber.value = v })
watch(() => props.defaultTrack, v => { trackNumber.value = v })

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
return node?.label || id
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
  const connection = {
    project_id: props.projectId,
    from_node_id: props.fromNode.id,
    to_node_id: props.toNode.id,
    input_number: (!isRecorder.value && (!isSource.value || isTransformer.value)) ? inputNumber.value : undefined,
    output_number: undefined, // never set output_number
    track_number: isRecorder.value ? trackNumber.value : undefined
  }
  await addConnection(connection)
  emit('confirm', connection)
} catch (e) {
  errorMsg.value = e.message || 'Failed to save connection.'
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