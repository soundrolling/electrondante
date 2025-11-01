<template>
<div class="bg-white rounded-lg shadow-xl w-full max-w-6xl flex flex-col overflow-hidden" style="max-height: 90vh;">
  <div class="px-6 py-4 border-b flex items-center justify-between">
    <h2 class="text-xl font-bold text-gray-800">
      <span v-if="targetNode?.node_type === 'source'" class="mr-2" aria-label="Source">🎤</span>
      <span v-else-if="targetNode?.node_type === 'transformer'" class="mr-2" aria-label="Transformer">🔀</span>
      <span v-else-if="targetNode?.node_type === 'recorder'" class="mr-2" aria-label="Recorder">🎚️</span>
      Matrix Port Mapping: {{ targetNode?.label }}
    </h2>
  </div>
  <div class="p-6 overflow-y-auto flex-grow" style="max-height: 70vh;">
    <!-- Node Information -->
    <div class="mb-6 p-4 bg-blue-50 rounded-lg">
      <h3 class="font-medium text-blue-800 mb-2">Node Information</h3>
      <div class="text-sm text-blue-700">
        <p><strong>{{ targetNode?.label }}</strong> <span v-if="targetNode?.node_type === 'source'">🎤 Source</span><span v-else-if="targetNode?.node_type === 'transformer'">🔀 Transformer</span><span v-else-if="targetNode?.node_type === 'recorder'">🎚️ Recorder</span></p>
        <p class="mt-1">
          <span v-if="targetNode?.node_type === 'source'">Outputs: {{ targetNode?.num_outputs }}</span>
          <span v-else>Inputs: {{ targetNode?.numinputs }}, Outputs: {{ targetNode?.num_outputs }}</span>
          <span v-if="targetNode?.node_type === 'recorder'">, Tracks: {{ targetNode?.num_tracks }}</span>
        </p>
        <p class="mt-1">Available upstream sources: {{ availableSources.length }}</p>
      </div>
    </div>
    <!-- Matrix Mapping -->
    <div class="mb-6">
      <h3 class="font-medium text-gray-800 mb-3">Input Mapping <span class="text-xs text-gray-400 ml-2">(Select any upstream source for each input. <span aria-label='Help' title='The dropdown shows all sources that can reach this node, with the last transformer in the path.'>?</span>)</span></h3>
      <div v-if="availableSources.length === 0" class="p-4 bg-yellow-50 text-yellow-700 rounded text-center">
        <span>No available upstream sources for this node.</span>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full table-fixed text-sm border-collapse">
          <colgroup>
            <col style="width: 18%" />
            <col style="width: 40%" />
            <col style="width: 28%" />
            <col style="width: 14%" />
          </colgroup>
          <thead>
            <tr class="bg-gray-100">
              <th class="border px-3 py-2 text-left">Input</th>
              <th class="border px-3 py-2 text-center">Source</th>
              <th class="border px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inputNum in targetNode.numinputs" :key="inputNum" 
                :class="{'bg-green-50': getInputMapping(inputNum), 'bg-gray-50': !getInputMapping(inputNum)}">
              <td class="border px-3 py-2 font-medium text-center">Input {{ inputNum }}</td>
              <td class="border px-3 py-2 text-center">
                <select 
                  :value="getInputMapping(inputNum)?.sourceId || ''"
                  @change="updateInputMapping(inputNum, 'sourceId', $event.target.value)"
                  class="w-full min-w-[120px] p-1 border border-gray-300 rounded text-center"
                  :aria-label="'Select source for input ' + inputNum"
                  title="Select the upstream source as delivered to this input."
                >
                  <option value="">— Select Source —</option>
                  <option v-for="source in getAvailableSourcesForInput(inputNum)" :key="source.sourceId" :value="source.sourceId">
                    <span v-if="getNodeTypeIcon(source.sourceId)">{{ getNodeTypeIcon(source.sourceId) }}</span>
                    {{ source.label }}
                  </option>
                </select>
              </td>
              <td class="border px-3 py-2 text-center">
                <span v-if="getInputMapping(inputNum)" class="text-green-600 font-semibold">Mapped</span>
                <span v-else class="text-gray-400">Unmapped</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Track Mapping for Recorders -->
    <div v-if="targetNode?.node_type === 'recorder'">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Track Mapping</h4>
      <div class="overflow-x-auto">
        <table class="w-full table-auto text-sm border-collapse">
          <thead>
            <tr class="bg-gray-100">
              <th class="border px-3 py-2 text-center">Track</th>
              <th class="border px-3 py-2 text-center">Input Source</th>
              <th class="border px-3 py-2 text-center">Source Details</th>
              <th class="border px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="trackNum in targetNode.num_tracks" :key="trackNum" 
                :class="{'bg-purple-50': getTrackMapping(trackNum), 'bg-gray-50': !getTrackMapping(trackNum)}">
              <td class="border px-3 py-2 font-medium text-center">Track {{ trackNum }}</td>
              <td class="border px-3 py-2 text-center">
                <select 
                  :value="getTrackMapping(trackNum)?.inputNumber || ''"
                  @change="updateTrackMapping(trackNum, $event.target.value)"
                  class="w-full p-1 border border-gray-300 rounded text-center"
                  :aria-label="'Select input for track ' + trackNum"
                  title="Assign an input to this track."
                >
                  <option value="">— Select Input —</option>
                  <option v-for="input in mappedInputs" :key="input" :value="input">
                    Input {{ input }} ({{ getInputSourceLabel(input) }})
                  </option>
                </select>
              </td>
              <td class="border px-3 py-2 text-center text-xs text-gray-600">
                {{ getTrackMapping(trackNum) ? getInputSourceDetails(getTrackMapping(trackNum).inputNumber) : '—' }}
              </td>
              <td class="border px-3 py-2 text-center">
                <span v-if="getTrackMapping(trackNum)" class="text-purple-600 font-semibold">Mapped</span>
                <span v-else class="text-gray-400">Unmapped</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Summary of current input mappings -->
    <div class="mt-6 p-3 bg-blue-50 rounded">
      <h4 class="font-medium text-blue-800 mb-1">Current Input Mappings</h4>
      <div v-if="Object.keys(inputMappings).length === 0" class="text-gray-500 italic">No inputs mapped yet.</div>
      <ul v-else class="text-sm">
        <li v-for="inputNum in targetNode.numinputs" :key="inputNum">
          <span class="font-semibold">Input {{ inputNum }}:</span>
          <span v-if="getInputMapping(inputNum)">
            <span v-if="getNodeTypeIcon(getInputMapping(inputNum).sourceId)">{{ getNodeTypeIcon(getInputMapping(inputNum).sourceId) }}</span>
            {{ getInputSourceLabel(inputNum) }}
          </span>
          <span v-else class="text-gray-400">Unmapped</span>
        </li>
      </ul>
    </div>
    <!-- Save/Revert Buttons -->
    <div class="flex space-x-2 mt-6 justify-end">
      <button
        @click="saveMapping"
        class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-base font-semibold shadow disabled:opacity-50"
        aria-label="Save Mapping"
      >
        Save Mapping
      </button>
      <button
        @click="revertMapping"
        class="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-base font-semibold shadow"
        aria-label="Revert Mapping"
      >
        Revert
      </button>
    </div>
  </div>
</div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { usePatchBayStore } from '@/stores/patchBayStore'

const props = defineProps({
targetNodeId: { type: [String, Number], required: true }
})

const emit = defineEmits(['close', 'saved'])

const patchBay = usePatchBayStore()

const targetNode = computed(() => patchBay.getNodeById(props.targetNodeId))

const availableSources = computed(() => {
if (!targetNode.value) return []
return patchBay.getAvailableUpstreamSources(props.targetNodeId)
})

// --- NEW: Build dropdown options with (via ...) ---
const upstreamSourceOptions = computed(() => {
return availableSources.value.map(source => {
  // source.path is an array of nodes from source to current node
  let label = source.label
  if (source.path && source.path.length > 2) {
    // Find the last transformer before the current node
    // path: [Mic 1, RME Stage Box, Netgear] for example
    // We want the last transformer before the last node
    const pathNodes = source.path
    // Exclude the last node (current node)
    const prevNodes = pathNodes.slice(0, -1)
    // Find the last transformer
    const lastTransformer = [...prevNodes].reverse().find(n => n.node_type === 'transformer')
    if (lastTransformer) {
      label += ` (via ${lastTransformer.label})`
    }
  }
  return {
    sourceId: source.sourceId,
    label,
    outputNumber: source.outputNumber || 1,
    path: source.path
  }
})
})

// Input mappings
const inputMappings = ref({})

// Track mappings (for recorders)
const trackMappings = ref({})

watch(() => props.targetNodeId, (newId) => {
if (newId) {
  // Load existing mappings if any
  inputMappings.value = {}
  trackMappings.value = {}
  // Get existing connections to this node
  const connections = patchBay.connections.filter(c => c.to_node === newId)
  connections.forEach(conn => {
    if (conn.input_number) {
      inputMappings.value[conn.input_number] = {
        sourceId: conn.source_node_id, // original source node
        fromNode: conn.from_node       // immediate upstream node
      }
    }
  })
  // Load track mappings for recorders
  if (targetNode.value?.node_type === 'recorder') {
    const recorderConnections = patchBay.connections.filter(c => c.to_node === newId && c.track_number)
    recorderConnections.forEach(conn => {
      if (conn.track_number) {
        trackMappings.value[conn.track_number] = {
          inputNumber: conn.input_number
        }
      }
    })
  }
}
}, { immediate: true })

function getInputMapping(inputNumber) {
return inputMappings.value[inputNumber]
}

function updateInputMapping(inputNumber, field, value) {
if (!inputMappings.value[inputNumber]) {
  inputMappings.value[inputNumber] = {};
}
if (field === 'sourceId') {
  // value is the sourceId; also get fromNodeId from the selected option
  const option = getAvailableSourcesForInput(inputNumber).find(opt => opt.sourceId === value);
  inputMappings.value[inputNumber].sourceId = value || null;
  inputMappings.value[inputNumber].fromNodeId = option?.fromNodeId || null;
}
}

function getSourcePath(sourceId) {
const source = availableSources.value.find(s => s.sourceId === sourceId)
return (source && Array.isArray(source.path))
  ? source.path.map(n => n.label).join(' → ')
  : '—'
}

function getTrackMapping(trackNumber) {
return trackMappings.value[trackNumber]
}

function updateTrackMapping(trackNumber, inputNumber) {
if (inputNumber) {
  trackMappings.value[trackNumber] = {
    inputNumber: parseInt(inputNumber)
  }
} else {
  delete trackMappings.value[trackNumber]
}
}

function getInputSourceLabel(inputNumber) {
const mapping = getInputMapping(inputNumber)
if (!mapping?.sourceId) return '—'

const source = patchBay.getNodeById(mapping.sourceId)
return source?.label || 'Unknown'
}

function getInputSourceDetails(inputNumber) {
const mapping = getInputMapping(inputNumber)
if (!mapping?.sourceId) return '—'

const source = patchBay.getNodeById(mapping.sourceId)
if (!source) return 'Unknown source'

const path = getSourcePath(mapping.sourceId)
return `${source.label} (${source.node_type}) → ${path}`
}

function getOutputConnection(outputNumber) {
const connections = patchBay.connections.filter(c => 
  c.from_node === props.targetNodeId && c.output_number === outputNumber
)
if (connections.length === 0) return null

const connection = connections[0]
const toNode = patchBay.getNodeById(connection.to_node)
return {
  toNode: toNode?.label || 'Unknown',
  inputNumber: connection.input_number,
  connectionId: connection.id
}
}

const mappedInputs = computed(() => {
return Object.keys(inputMappings.value).filter(inputNum => 
  inputMappings.value[inputNum]?.sourceId
).map(Number)
})

const mappedTracks = computed(() => {
return Object.keys(trackMappings.value).filter(trackNum => 
  trackMappings.value[trackNum]?.inputNumber
).map(Number)
})

const hasValidMapping = computed(() => {
if (targetNode.value?.node_type === 'source') return true
return mappedInputs.value.length > 0
})

const mappingStatus = computed(() => {
if (targetNode.value?.node_type === 'source') return 'Source node - outputs only'
if (mappedInputs.value.length === 0) return 'No inputs mapped'
if (mappedInputs.value.length === targetNode.value?.numinputs) return 'All inputs mapped'
return `${mappedInputs.value.length} of ${targetNode.value?.numinputs} inputs mapped`
})

async function saveMapping() {
try {
  let projectId = patchBay.currentLayout?.project_id || targetNode.value?.project_id
  if (!projectId) {
    alert('Cannot save mapping: Project is not loaded and project_id is missing.');
    return;
  }
  // Remove existing connections to this node first
  const existingConnections = patchBay.connections.filter(c => c.to_node === props.targetNodeId)
  for (const conn of existingConnections) {
    await patchBay.removeConnection(conn.id)
  }
  // Save input mappings as connections
  const connectionsToCreate = []
  Object.entries(inputMappings.value).forEach(([inputNum, mapping]) => {
    if (mapping.sourceId && mapping.fromNodeId) {
      connectionsToCreate.push({
        from_node: mapping.fromNodeId, // immediate upstream node
        to_node: props.targetNodeId, // UUID string
        source_node_id: mapping.sourceId, // original source node
        input_number: Number(inputNum),
        output_number: Number(inputNum), // Always match input number
        project_id: projectId,
        location_id: patchBay.currentLayout?.id
      })
    }
  })
  // Create connections
  for (const conn of connectionsToCreate) {
    await patchBay.addConnection(conn)
  }
  // After saving, reload connections from Supabase to ensure UI is up to date
  await patchBay.fetchConnections(patchBay.currentLayout.id)
  // Save track mappings for recorders
  if (targetNode.value?.node_type === 'recorder') {
    Object.entries(trackMappings.value).forEach(([trackNum, mapping]) => {
      if (mapping.inputNumber) {
        // Find the connection for this input and update with track number
        const connection = patchBay.connections.find(c => 
          c.to_node === props.targetNodeId && c.input_number === Number(mapping.inputNumber)
        )
        if (connection) {
          patchBay.updateConnection({
            ...connection,
            track_number: Number(trackNum)
          })
        }
      }
    })
  }
  emit('saved')
  emit('close')
} catch (err) {
  alert('Failed to save mapping: ' + err.message)
}
}

function getNodeTypeIcon(sourceId) {
const node = patchBay.getNodeById(sourceId)
if (!node) return ''
if (node.node_type === 'source') return '🎤'
if (node.node_type === 'transformer') return '🔀'
if (node.node_type === 'recorder') return '🎚️'
return ''
}

function getAvailableSourcesForInput(inputNum) {
const upstreamSources = patchBay.getAvailableUpstreamSources(targetNode.value.id);
return upstreamSources.map(source => {
  let label = source.label;
  let fromNodeId = null;
  if (source.path && source.path.length > 1) {
    fromNodeId = source.path[source.path.length - 2]?.id;
    // Find the last transformer in the path before the current node
    const prevNodes = source.path.slice(0, -1);
    const lastTransformer = [...prevNodes].reverse().find(n => n.node_type === 'transformer');
    if (lastTransformer) {
      label += ` (via ${lastTransformer.label})`;
    }
  }
  // If direct connection (source → this node), set fromNodeId to sourceId
  if (!fromNodeId && source.path && source.path.length === 2) {
    fromNodeId = source.path[0]?.id;
  }
  return {
    sourceId: source.sourceId,
    fromNodeId,
    label
  };
});
}
</script>

<style scoped>
.bg-red-50 { background-color: #fef2f2; }
</style> 