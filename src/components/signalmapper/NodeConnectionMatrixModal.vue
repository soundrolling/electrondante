<template>
<div class="modal-overlay" @mousedown.self="$emit('close')">
  <div class="modal-content large matrix-modal-content" @click.stop>
    <div class="modal-header">
      <h3>Connection Matrix for {{ node.label }}</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    <div class="modal-body matrix-modal-body">
      <div v-if="node.gearType === 'transformer' || node.node_type === 'transformer' || node.gear_type === 'transformer'">
        <h4>Inputs</h4>
        <div class="matrix-table-wrapper">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>Input #</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in maxPorts" :key="n">
                <td>{{ n }}</td>
                <td>
                  <select v-model="inputAssignments[n-1].from" @change="emitEdit('input', n, inputAssignments[n-1])">
                    <option value="">-- None --</option>
                    <option v-for="el in findDirectlyConnectedSources(n)" :key="el.id" :value="el.id">
                      {{ getNodeLabel(el.id) }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="node.gearType === 'recorder' || node.node_type === 'recorder' || node.gear_type === 'recorder'">
        <h4>Tracks</h4>
        <div class="matrix-table-wrapper">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>Track #</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="n in numTracks" :key="n">
                <td>{{ n }}</td>
                <td>
                  <template v-if="trackAssignments[n-1].from">
                    <span class="assigned-label">{{ getNodeLabel(trackAssignments[n-1].from) }}</span>
                  </template>
                  <template v-else>
                    <select v-model="trackAssignments[n-1].from" @change="emitEdit('track', n, trackAssignments[n-1])">
                      <option value="">-- None --</option>
                      <option v-for="item in findReachableSourcesWithPaths()" :key="item.source.id" :value="item.source.id">
                        {{ getNodeLabel(item.source.id) }}<span v-if="item.path && item.path.length > 2"> (via {{ item.path.slice(1, -1).map(id => getNodeLabel(id)).join(' → ') }})</span>
                      </option>
                    </select>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Save/Cancel Buttons -->
      <div class="matrix-modal-actions">
        <button class="btn-save" @click="saveMatrix" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save' }}
        </button>
        <button class="btn-cancel" @click="$emit('close')" :disabled="loading">Cancel</button>
      </div>
      <div v-if="errorMsg" class="error-message">
        {{ errorMsg }}
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { updateConnection } from '@/services/signalMapperService'

const props = defineProps({
node: { type: Object, required: true },
elements: { type: Array, default: () => [] },
connections: { type: Array, default: () => [] },
projectId: {
  type: [String, Number],
  required: true
}
})

// Debug logging
console.log('NodeConnectionMatrixModal props:', props)
console.log('Node data:', props.node)
console.log('Node gearType:', props.node?.gearType)
console.log('Node node_type:', props.node?.node_type)
console.log('Node gear_type:', props.node?.gear_type)
const emit = defineEmits(['close', 'edit-connection', 'save'])

const numInputs = props.node.num_inputs || props.node.numinputs || props.node.inputs || 0
const numOutputs = props.node.num_outputs || props.node.numoutputs || props.node.outputs || 0
const numTracks = props.node.num_tracks || props.node.tracks || props.node.num_records || props.node.numrecord || 0
const maxPorts = Math.max(numInputs, numOutputs)

const inputAssignments = ref([])
const outputAssignments = ref([])
const trackAssignments = ref([])
const loading = ref(false)
const errorMsg = ref('')

for (let n = 1; n <= maxPorts; n++) {
const conn = props.connections.find(c => (c.to === props.node.id || c.to_node_id === props.node.id) && c.input_number === n)
inputAssignments.value.push({ from: conn ? conn.from || conn.from_node_id : '', ...conn })
const connOut = props.connections.find(c => (c.from === props.node.id || c.from_node_id === props.node.id) && c.output_number === n)
outputAssignments.value.push({ to: connOut ? connOut.to || connOut.to_node_id : '', ...connOut })
}
for (let n = 1; n <= numTracks; n++) {
const conn = props.connections.find(c => (c.to === props.node.id || c.to_node_id === props.node.id) && c.track_number === n)
trackAssignments.value.push({ from: conn ? conn.from || conn.from_node_id : '', ...conn })
}

function emitEdit(type, n, assignment) {
emit('edit-connection', { type, index: n, assignment })
}

function connectedInputNodes(inputNum) {
// Find all nodes that have a connection to this input number
return props.connections
  .filter(c => (c.to === props.node.id || c.to_node_id === props.node.id) && c.input_number === inputNum && c.from)
  .map(c => props.elements.find(e => e.id === (c.from || c.from_node_id)))
  .filter(Boolean)
}

// Helper: Find all source nodes with a valid path to this recorder, and return the path as well
function findReachableSourcesWithPaths() {
const sources = props.elements.filter(e => (e.type === 'gear' && (e.gearType === 'source' || e.node_type === 'source')))
const reachable = []
for (const source of sources) {
  const path = findPath(source.id, props.node.id, props.connections)
  if (path) {
    reachable.push({ source, path })
  }
}
return reachable
}

// BFS to find a path from sourceId to targetId (returns array of node ids)
function findPath(sourceId, targetId, connections) {
const visited = new Set()
const queue = [[sourceId]]
while (queue.length > 0) {
  const currentPath = queue.shift()
  const current = currentPath[currentPath.length - 1]
  if (current === targetId) return currentPath
  visited.add(current)
  for (const conn of connections) {
    if ((conn.from === current || conn.from_node_id === current) && !visited.has(conn.to || conn.to_node_id)) {
      queue.push([...currentPath, conn.to || conn.to_node_id])
    }
  }
}
return null
}

// Replace findAllConnectedSources() with a function that, for each input, returns sources directly connected to that input, or unassigned sources
function findDirectlyConnectedSources(inputNum) {
// Find all sources
const sources = props.elements.filter(e => (e.type === 'gear' && (e.gearType === 'source' || e.node_type === 'source')))
// Find all sources that have any connection to this transformer
const connectedSourceIds = props.connections
  .filter(c => (c.to === props.node.id || c.to_node_id === props.node.id) && sources.some(s => s.id === (c.from || c.from_node_id)))
  .map(c => c.from || c.from_node_id)
// Find sources already assigned to other inputs
const assignedSourceIds = inputAssignments.value
  .filter((a, i) => i !== inputNum - 1 && a.from)
  .map(a => a.from)
// Allow any connected source not already assigned to another input
const availableSources = sources.filter(s => connectedSourceIds.includes(s.id) && !assignedSourceIds.includes(s.id))
// If this input already has a source assigned, include it
const currentAssigned = inputAssignments.value[inputNum-1]?.from
if (currentAssigned) {
  const assignedSource = sources.find(s => s.id === currentAssigned)
  if (assignedSource && !availableSources.some(s => s.id === assignedSource.id)) {
    availableSources.push(assignedSource)
  }
}
return availableSources
}

async function saveMatrix() {
loading.value = true
errorMsg.value = ''
try {
  if (props.node.gearType === 'recorder' || props.node.node_type === 'recorder' || props.node.gear_type === 'recorder') {
    // For recorders: update track assignments
    for (let i = 0; i < trackAssignments.value.length; i++) {
      const assignment = trackAssignments.value[i]
      const existingConn = props.connections.find(c => 
        (c.to === props.node.id || c.to_node_id === props.node.id) && c.track_number === i + 1
      )
      
      if (assignment.from && existingConn) {
        // Update existing connection
        await updateConnection({
          ...existingConn,
          from_node_id: assignment.from,
          track_number: i + 1
        })
      }
    }
    emit('save', trackAssignments.value.map((a, i) => ({ track: i+1, from: a.from })))
  } else if (props.node.gearType === 'transformer' || props.node.node_type === 'transformer' || props.node.gear_type === 'transformer') {
    // For transformers: update input assignments
    for (let i = 0; i < inputAssignments.value.length; i++) {
      const assignment = inputAssignments.value[i]
      const existingConn = props.connections.find(c => 
        (c.to === props.node.id || c.to_node_id === props.node.id) && c.input_number === i + 1
      )
      
      if (assignment.from && existingConn) {
        // Update existing connection
        await updateConnection({
          ...existingConn,
          from_node_id: assignment.from,
          input_number: i + 1
        })
      }
    }
    emit('save', inputAssignments.value.map((a, i) => ({ input: i+1, from: a.from })))
  }
} catch (e) {
  errorMsg.value = e.message || 'Failed to save matrix assignments.'
} finally {
  loading.value = false
}
}

function getNodeLabel(id) {
const node = props.elements.find(e => e.id === id)
return node?.label || id
}
</script>

<style scoped>
.matrix-modal-content {
max-width: 700px;
width: 90vw;
margin: 32px auto;
box-sizing: border-box;
padding: 0 32px 32px 32px;
max-height: 90vh;
overflow: hidden;
background: var(--bg-primary);
box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 1.5px 4px rgba(0,0,0,0.04);
border-radius: 18px;
border: 1px solid #e9ecef;
display: flex;
flex-direction: column;
}
.matrix-modal-body {
max-height: 70vh;
overflow-y: auto;
padding: 32px 18px 18px 18px;
}
.matrix-table-wrapper {
overflow-x: auto;
background: var(--bg-primary);
border-radius: 10px;
box-shadow: 0 1px 4px rgba(0,0,0,0.04);
margin-top: 12px;
}
.matrix-table {
width: 100%;
border-collapse: separate;
border-spacing: 0;
background: white;
border-radius: 8px;
overflow: hidden;
border: 1px solid #e9ecef;
font-size: 15px;
}
.matrix-table th, .matrix-table td {
padding: 12px 14px;
border-bottom: 1px solid #e9ecef;
font-size: 15px;
}
.matrix-table th {
background: var(--bg-secondary);
font-weight: 700;
color: var(--text-secondary);
position: sticky;
top: 0;
z-index: 2;
}
.matrix-table tr:last-child td {
border-bottom: none;
}
.matrix-table tr:nth-child(even) {
background: var(--bg-secondary);
}
.matrix-table tr:hover {
background: rgba(59, 130, 246, 0.1);
transition: background 0.15s;
}
select {
width: 100%;
padding: 7px 10px;
border: 1.5px solid #dee2e6;
border-radius: 6px;
background: var(--bg-primary);
font-size: 15px;
  color: var(--text-primary);
transition: border 0.15s;
outline: none;
}
select:focus {
border-color: var(--color-primary-500);
background: rgba(59, 130, 246, 0.1);
}
.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 22px 24px 0 24px;
border-bottom: 1px solid #e9ecef;
background: var(--bg-primary);
border-top-left-radius: 14px;
border-top-right-radius: 14px;
}
.modal-header h3 {
margin: 0;
font-size: 20px;
font-weight: 700;
color: var(--text-primary);
}
.close-btn {
background: none;
border: none;
font-size: 28px;
cursor: pointer;
color: var(--text-secondary);
padding: 0 4px;
border-radius: 4px;
transition: background 0.15s;
}
.close-btn:hover {
background: var(--bg-secondary);
color: var(--text-secondary);
}
h4 {
margin: 0 0 12px 0;
font-size: 17px;
font-weight: 600;
color: var(--text-secondary);
}
@media (max-width: 600px) {
.matrix-modal-content {
  padding: 0 8px 16px 8px;
  width: 98vw;
  max-width: 98vw;
  margin: 8px auto;
}
.matrix-modal-body {
  padding: 16px 4px 8px 4px;
}
.modal-header {
  padding: 14px 10px 0 10px;
}
}
.matrix-modal-actions {
display: flex;
justify-content: flex-end;
gap: 12px;
margin-top: 28px;
}
.btn-save {
background: var(--color-primary-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
padding: 12px 24px;
font-size: 15px;
font-weight: 500;
cursor: pointer;
transition: background 0.2s;
}
.btn-save:hover {
background: var(--color-primary-600);
}
.btn-cancel {
background: var(--color-secondary-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
padding: 12px 24px;
font-size: 15px;
font-weight: 500;
cursor: pointer;
transition: background 0.2s;
}
.btn-cancel:hover {
background: var(--color-secondary-600);
}
.error-message {
color: red;
margin-top: 12px;
font-size: 15px;
}
.assigned-label {
color: var(--text-tertiary);
font-style: italic;
background: var(--bg-tertiary);
padding: 4px 10px;
border-radius: 6px;
display: inline-block;
}
</style> 