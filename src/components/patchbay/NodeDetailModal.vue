<!-- src/components/patchbay/NodeDetailModal.vue -->
<template>
<div
  v-if="node"
  class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  @mousedown.self="closeModal"
>
  <div
    class="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
    style="max-height:85vh;"
  >
    <!-- HEADER & TABS -->
    <div class="px-6 py-4 border-b flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-800 truncate" :title="local.label">
          Node: {{ local.label }}
        </h2>
        <div class="flex mt-2 -mb-px">
          <button
            @click="activeTab = 'details'"
            :class="tabClass('details')"
          >Details</button>
          <button
            @click="activeTab = 'connections'"
            :class="tabClass('connections')"
          >{{ isRecorder ? 'Track List & Connections' : 'Connections' }}</button>
          <button
            @click="activeTab = 'signalFlow'"
            :class="tabClass('signalFlow')"
          >Signal Flow</button>
        </div>
      </div>
    </div>

    <!-- BODY -->
    <div class="p-6 overflow-y-auto flex-grow">
      <!-- DETAILS TAB -->
      <div v-show="activeTab === 'details'">
        <h3 class="text-lg font-semibold mb-3 text-gray-700">
          Edit Node Details
        </h3>

        <form @submit.prevent="saveNodeDetails" class="space-y-4">
          <!-- Label -->
          <div>
            <label class="block text-xs font-medium text-gray-600">Label</label>
            <input
              v-model="local.label"
              required
              class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                     focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Type -->
          <div>
            <label class="block text-xs font-medium text-gray-600">Type</label>
            <select
              v-model="local.node_type"
              class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                     focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="source">Source</option>
              <option value="transformer">Transformer</option>
              <option value="recorder">Recorder</option>
            </select>
          </div>

          <!-- Gear (always visible) -->
          <div>
            <label class="block text-xs font-medium text-gray-600">Gear</label>
            <select
              v-model="local.gear_id"
              @change="onGearChange"
              class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                     focus:ring-blue-500 focus:border-blue-500"
            >
              <option :value="null">-- Select Gear --</option>
              <option
                v-for="g in gearListOfThisType"
                :key="g.id"
                :value="g.id"
              >
                {{ g.name }}
              </option>
            </select>
          </div>
          <p v-if="selectedGear" class="text-gray-500 text-xs italic mt-1">
            Selected: <span class="font-medium">{{ selectedGear.name }}</span>
            — Inputs: {{ selectedGear.numinputs }}, Outputs: {{ selectedGear.num_outputs }}
          </p>

          <!-- Inputs & Outputs -->
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label class="block text-xs font-medium text-gray-600">Inputs</label>
              <input
                type="number"
                v-model.number="local.numinputs"
                min="0"
                :max="selectedGear ? selectedGear.numinputs : undefined"
                :readonly="!canEditPorts"
                class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                       focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600">Outputs</label>
              <input
                type="number"
                v-model.number="local.num_outputs"
                min="0"
                :max="selectedGear ? selectedGear.num_outputs : undefined"
                :readonly="!canEditPorts"
                class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                       focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <p class="text-xs text-gray-500 italic mb-4">
            Inputs/outputs come from the selected gear if any. To edit manually, clear the gear.
          </p>

          <!-- Recorder‐only Tracks -->
          <div v-if="isRecorder">
            <label class="block text-xs font-medium text-gray-600">Tracks</label>
            <input
              type="number"
              v-model.number="local.num_tracks"
              min="0"
              class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm
                     focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Flags -->
          <div class="flex items-center space-x-6 text-sm text-gray-700">
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="local.pad"
                class="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Pad
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="local.phantom_power"
                class="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Phantom
            </label>
            <label class="flex items-center">
              <input
                type="checkbox"
                v-model="local.wireless"
                class="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Wireless
            </label>
          </div>

          <!-- Save & Delete -->
          <div class="flex space-x-2 pt-4">
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors disabled:opacity-50"
              :disabled="isSavingDetails"
            >
              {{ detailsButtonText }}
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm transition-colors"
              @click="deleteNode"
            >
              Delete Node
            </button>
          </div>
        </form>
      </div>

      <!-- CONNECTIONS TAB -->
      <div v-show="activeTab === 'connections'">
        <h3 class="text-lg font-semibold mb-3 text-gray-700">Input Mapping</h3>
        <MatrixPortMapper
          :targetNodeId="local.id"
          @saved="onMappingSaved"
          @close="onMappingSaved"
        />
      </div>

      <!-- SIGNAL FLOW TAB -->
      <div v-show="activeTab === 'signalFlow'">
        <EnhancedSignalFlow />
      </div>
    </div>

    <!-- FOOTER -->
    <div class="px-6 py-3 bg-gray-50 border-t flex justify-end space-x-3">
      <button
        class="px-4 py-2 bg-white hover:bg-gray-100 border rounded text-sm"
        @click="exportTrackList"
      >
        Export Track List
      </button>
      <button
        class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        @click="closeModal"
      >
        Close
      </button>
    </div>

    <!-- TOAST -->
    <transition name="fade">
      <div v-if="toast" class="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg">
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { usePatchBayStore }               from '@/stores/patchBayStore'
import { jsPDF }                           from 'jspdf'
import MatrixPortMapper from './MatrixPortMapper.vue'
import EnhancedSignalFlow from './EnhancedSignalFlow.vue'

const props    = defineProps({
nodeId:    { type: [String, Number], required: true },
gearList:  { type: Array,        default: () => [] },
projectId: { type: [String, Number], required: true }
})
const emit     = defineEmits(['close', 'node-updated', 'connections-updated'])
const patchBay = usePatchBayStore()

// — Toast state & helper —
const toast        = ref(false)
const toastMessage = ref('')
function showToast(msg) {
toastMessage.value = msg
toast.value        = true
setTimeout(() => (toast.value = false), 3000)
}

// — Local node copy & active tab —
const activeTab = ref('details')
const node      = ref(null)
const local     = reactive({
id:            null,     // node primary key (UUID)
label:         '',
node_type:     '',       // "source" | "transformer" | "recorder"
gear_id:       null,     // full gear‐UUID or null
numinputs:     0,
num_outputs:   0,
num_tracks:    0,
pad:           false,
phantom_power: false,
wireless:      false,
port_map:      null
})

// — Computed: is this a Source or Recorder? —
const isSource   = computed(() => local.node_type === 'source')
const isRecorder = computed(() => local.node_type === 'recorder')

// — Computed: filter gearList by the currently selected node_type —
const gearListOfThisType = computed(() => {
if (!local.node_type) return []
return props.gearList.filter(g => g.gear_type === local.node_type)
})

// — "Selected gear" object (if gear_id is non-null) —
const selectedGear = computed(() => {
return props.gearList.find(g => g.id === local.gear_id) || null
})

// — canEditPorts = true if gear_id === null, false if gear is chosen —
const canEditPorts = computed(() => local.gear_id === null)

// ========== WATCH: when node_type changes ========== //
// 1) If it becomes "source" and no gear is chosen → manual ports 0/1.
//    If gear was already chosen → apply that gear's ports.
// 2) If it becomes "transformer" or "recorder" and gear was chosen, apply gear ports.
//    If no gear and brand-new → default to 1/1.
// 3) Always rebuild mappingRows.
watch(
() => local.node_type,
(newType) => {
  if (newType === 'source') {
    // If source:
    if (local.gear_id) {
      // Re-apply that gear's ports
      const chosen = props.gearList.find(g => g.id === local.gear_id)
      if (chosen) {
        local.numinputs   = chosen.numinputs   ?? local.numinputs
        local.num_outputs = chosen.num_outputs ?? local.num_outputs
      }
    } else {
      // No gear: manual source defaults
      if (!local.id) {
        local.numinputs   = 0
        local.num_outputs = 1
      }
    }
    local.num_tracks = 0
    return
  }

  // Transformer or Recorder:
  if ((newType === 'transformer' || newType === 'recorder') && local.gear_id) {
    const chosen = props.gearList.find(g => g.id === local.gear_id)
    if (chosen) {
      local.numinputs   = chosen.numinputs   ?? local.numinputs
      local.num_outputs = chosen.num_outputs ?? local.num_outputs
    }
  } else {
    // No gear & brand new → default to 1/1
    if (!local.id && newType !== 'source') {
      local.numinputs   = 1
      local.num_outputs = 1
    }
  }

  if (newType !== 'recorder') {
    local.num_tracks = 0
  }
},
{ immediate: true }
)

// ========== WATCH: when gear_id changes ========== //
// 1) If source & gear chosen → apply gear ports.
// 2) If source & gear cleared → manual 0/1.
// 3) If transformer/recorder & gear chosen → apply gear ports.
// 4) If transformer/recorder & gear cleared → manual 1/1 if brand new.
// 5) Always rebuild mappingRows.
watch(
() => local.gear_id,
(newGearId) => {
  if (local.node_type === 'source') {
    if (newGearId) {
      const chosen = props.gearList.find(g => g.id === newGearId)
      if (chosen) {
        local.numinputs   = chosen.numinputs   ?? local.numinputs
        local.num_outputs = chosen.num_outputs ?? local.num_outputs
      }
    } else {
      local.numinputs   = 0
      local.num_outputs = 1
    }
  }

  // Transformer or Recorder:
  if (newGearId) {
    const chosen = props.gearList.find(g => g.id === newGearId)
    if (chosen) {
      local.numinputs   = chosen.numinputs   ?? local.numinputs
      local.num_outputs = chosen.num_outputs ?? local.num_outputs
    }
  } else {
    if (!local.id) {
      local.numinputs   = 1
      local.num_outputs = 1
    }
  }
},
{ immediate: true }
)

// ========== WATCH: when nodeId prop changes ========== //
watch(
() => props.nodeId,
(id) => {
  const n = patchBay.getNodeById(id)
  node.value = n
  if (n) {
    Object.assign(local, JSON.parse(JSON.stringify(n)))

    if (local.gear_id) {
      const chosen = props.gearList.find(g => g.id === local.gear_id)
      if (chosen) {
        local.numinputs   = chosen.numinputs   ?? local.numinputs
        local.num_outputs = chosen.num_outputs ?? local.num_outputs
      }
    } else {
      if (local.node_type === 'source') {
        local.numinputs   = local.numinputs ?? 0
        local.num_outputs = local.num_outputs ?? 1
      }
      if (
        (local.node_type === 'transformer' || local.node_type === 'recorder') &&
        local.numinputs === 0 &&
        local.num_outputs === 0
      ) {
        local.numinputs   = 1
        local.num_outputs = 1
      }
    }

    if (local.node_type !== 'recorder') {
      local.num_tracks = 0
    }
  }
},
{ immediate: true }
)

// ========== UNIQUE SOURCES for Connections drop-downs ========== //
const allOriginalSources = computed(() =>
  patchBay.nodes.filter(n => n.node_type === 'source').map(n => ({
    key: `${n.id}-1`, // default output 1
    label: n.label
  }))
)

// NEW: Get all available upstream sources for this node
const availableUpstreamSources = computed(() => {
  if (!local.id) return []
  return patchBay.getAvailableUpstreamSources(local.id)
})

function availableSourcesForRow(row) {
  // For transformers, show all available upstream sources (including through other transformers)
  if (local.node_type === 'transformer') {
    return availableUpstreamSources.value
  }
  
  // For recorders, show all available upstream sources
  if (local.node_type === 'recorder') {
    return availableUpstreamSources.value
  }
  
  // For sources, show all original sources (fallback)
  return allOriginalSources.value.filter(opt =>
    opt.key === row.source_key ||
    !mappingRows.some(r => r.source_key === opt.key)
  )
}

// ========== Reset output if source cleared ========== //
function onSourceChange(row) {
if (!row.source_key) {
  row.output_number = null
}
}

// ========== Debug function to show current connections ========== //
function debugConnections() {
console.log('=== Current Connections ===')
patchBay.connections.forEach(conn => {
  const fromNode = patchBay.getNodeById(conn.from_node)
  const toNode = patchBay.getNodeById(conn.to_node)
  console.log(`${fromNode?.label || 'Unknown'} (${conn.from_node}) → ${toNode?.label || 'Unknown'} (${conn.to_node})`)
  console.log(`  Input: ${conn.input_number}, Output: ${conn.output_number}, Source: ${conn.source_node}`)
})
console.log('=== End Connections ===')
}

// ========== Tab-button styling helper ========== //
const tabClass = tab => [
'py-3 px-5 text-sm font-medium focus:outline-none -ml-px',
activeTab.value === tab
  ? 'border-b-2 border-blue-500 text-blue-600'
  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
]

// ========== EXPORT TRACK LIST AS PDF via jsPDF ========== //
function exportTrackList() {
const doc = new jsPDF({ unit: 'pt' })
doc.setFontSize(16)
doc.text(`Track List for ${local.label}`, 40, 40)
doc.setFontSize(12)

if (isRecorder.value) {
  // For recorders, show incoming connections
  const incoming = patchBay.connections.filter(c => c.to_node === local.id)
  incoming.forEach((conn, index) => {
    const fromNode = patchBay.getNodeById(conn.from_node)
    doc.text(`Input ${conn.input_number || index + 1}: ${fromNode?.label || 'Unknown'}`, 40, 70 + index * 20)
  })
} else {
  // For other nodes, show connections
  const connections = patchBay.connections.filter(c => c.from_node === local.id || c.to_node === local.id)
  connections.forEach((conn, index) => {
    const fromNode = patchBay.getNodeById(conn.from_node)
    const toNode = patchBay.getNodeById(conn.to_node)
    doc.text(`${fromNode?.label || 'Unknown'} → ${toNode?.label || 'Unknown'}`, 40, 70 + index * 20)
  })
}

doc.save(`${local.label.replace(/\s+/g, '_')}_tracks.pdf`)
}

// ========== DETAILS TAB: Save / Delete Node ========== //
const isSavingDetails   = ref(false)
const detailsButtonText = ref('Save Details')

async function saveNodeDetails() {
isSavingDetails.value   = true
detailsButtonText.value = 'Saving…'
try {
  await patchBay.updateNode(local)
  emit('node-updated')
  showToast('Details saved!')
} finally {
  detailsButtonText.value = 'Saved ✔'
  setTimeout(() => (detailsButtonText.value = 'Save Details'), 1500)
  isSavingDetails.value = false
}
}

async function deleteNode() {
if (!confirm('Delete this node and all its connections?')) return
await patchBay.removeNode(local.id)
emit('connections-updated')
emit('close')
}

// ========== Close modal ========== //
function closeModal() {
emit('close')
}

// ========== New connection handling ========== //
const newConnectionTarget = ref(null)
const incomingConnections = computed(() => patchBay.connections.filter(c => c.to_node === local.id))
const outgoingConnections = computed(() => patchBay.connections.filter(c => c.from_node === local.id))
const availableTargetNodes = computed(() => patchBay.nodes.filter(n => n.id !== local.id))

function getNodeById(id) {
  return patchBay.getNodeById(id)
}

async function removeConnection(connId) {
  if (!confirm('Remove this connection?')) return
  await patchBay.removeConnection(connId)
  emit('connections-updated')
}

async function addConnection() {
  if (!newConnectionTarget.value) return
  try {
    await patchBay.createSimpleLink(
      newConnectionTarget.value,
      local.id,
      props.projectId,
      patchBay.currentLayout.id
    )
    newConnectionTarget.value = null
    emit('connections-updated')
  } catch (err) {
    alert('Failed to create connection: ' + err.message)
  }
}

// ========== Signal Flow Summary ========== //
const signalFlowSummary = computed(() => {
  if (!local.id) return null
  return patchBay.getSignalFlowSummaryForNode(local.id)
})

// ========== Update connection ========== //
async function updateConnection(conn) {
  if (!conn.input_number || !conn.output_number) return
  try {
    await patchBay.updateConnection({
      id: conn.id,
      from_node: conn.from_node,
      to_node: conn.to_node,
      source_node: conn.source_node,
      input_number: conn.input_number,
      output_number: conn.output_number
    })
    emit('connections-updated')
  } catch (err) {
    alert('Failed to update connection: ' + err.message)
  }
}

// ========== New function to get upstream sources for a connection ========== //
function getUpstreamSourcesForConnection(conn) {
  if (!conn.from_node || !conn.to_node) return []
  return patchBay.getUpstreamSourcesForConnection(conn.from_node, conn.to_node)
}

// ========== New function to open port mapping modal ========== //
const selectedConnection = ref(null)

function openPortMapping(conn) {
  selectedConnection.value = conn
}

function onMappingSaved() {
  showToast('Mapping saved!')
  emit('connections-updated')
}

function getTrackInput(track) {
  // Find the input mapped to this track
  const connections = patchBay.connections.filter(c => c.to_node === local.id && c.track_number === track)
  if (connections.length > 0) {
    return connections[0].input_number
  }
  return '—'
}
function getTrackSourcePath(track) {
  // Find the source and path for this track
  const connections = patchBay.connections.filter(c => c.to_node === local.id && c.track_number === track)
  if (connections.length > 0) {
    const conn = connections[0]
    const sources = patchBay.getUpstreamSourcesForConnection(conn.from_node, conn.to_node)
    if (sources.length > 0) {
      const source = sources[0]
      let label = source.label
      if (source.path && source.path.length > 2) {
        const pathNodes = source.path
        const prevNodes = pathNodes.slice(0, -1)
        const lastTransformer = [...prevNodes].reverse().find(n => n.node_type === 'transformer')
        if (lastTransformer) {
          label += ` (via ${lastTransformer.label})`
        }
      }
      return label
    }
  }
  return '—'
}
</script>

<style scoped>
/* toast fade */
.fade-enter-active,
.fade-leave-active { transition: opacity .3s ease; }
.fade-enter-from,
.fade-leave-to      { opacity: 0; }
</style>