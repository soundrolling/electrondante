<template>
  <!-- copied from components/signalmapper/NodeInspector.vue (consolidated under src/components) -->
  <div class="inspector-overlay" @click="emit('close')">
    <div class="inspector" @click.stop>
      <div class="inspector-header">
        <div class="title">
          <span class="badge">{{ type }}</span>
          <!-- Editable label for transformers and recorders -->
          <input 
            v-if="type === 'transformer' || type === 'recorder'"
            v-model="editableLabel"
            @blur="saveLabel"
            @keyup.enter="saveLabel"
            @keyup.esc="cancelLabelEdit"
            class="editable-label"
            :class="{ saving: savingLabel }"
            :disabled="savingLabel"
          />
          <h3 v-else>{{ node.track_name || node.label }}</h3>
        </div>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
      <div class="meta">
        <span v-if="type !== 'recorder'">{{ inputs }} in</span>
        <span v-if="type === 'recorder'">{{ tracks || inputs }} tracks</span>
        <span>{{ outputs }} out</span>
      </div>

    <div class="tabs">
      <button :class="{ active: tab==='map' }" @click="tab='map'">Map</button>
      <button v-if="type==='source'" :class="{ active: tab==='settings' }" @click="tab='settings'">Settings</button>
      <button :class="{ active: tab==='delete' }" @click="tab='delete'" class="tab-delete">🗑️ Delete</button>
    </div>

      <div class="panel" v-if="tab==='map'">
        <!-- Venue Sources: Show feeds in Map tab -->
        <div v-if="type==='venue_sources'">
          <div class="feeds-toolbar">
            <button class="btn-secondary" @click="addFeed">Add Feed</button>
          </div>
          <div class="feed-row" v-for="row in feeds" :key="row.port">
            <div class="feed-left">Output {{ row.port }}</div>
            <input class="input" :placeholder="`Label for ${row.port}`" v-model="row.label" />
            <button class="btn-danger" @click="removeFeed(row.port)">Remove</button>
          </div>
          <div v-if="!feeds.length" class="muted">No feeds yet. Click "Add Feed" to create one.</div>
          <div class="actions">
            <button class="btn" @click="saveFeeds" :disabled="saving">Save Feeds</button>
          </div>
        </div>
        <!-- Other nodes: Show editable connections -->
        <div v-else>
          <div class="map-unified">
            <!-- Upstream (Inputs/Tracks) Section -->
            <div class="map-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4>{{ type === 'recorder' ? 'Record Tracks' : 'Inputs' }}</h4>
                <button 
                  @click="refreshSourceNames" 
                  class="btn-refresh"
                  title="Refresh source names to show latest venue source names"
                  style="padding: 4px 8px; font-size: 12px; background: var(--bg-secondary); border: 1px solid var(--border-medium); border-radius: 4px; cursor: pointer; color: var(--text-primary);"
                >
                  🔄 Refresh Names
                </button>
              </div>
              <div class="map-inputs">
                <div v-for="n in inputCount" :key="`in-${n}`" class="map-io-row">
                  <div class="map-io-label">
                    {{ type === 'recorder' ? 'Track' : 'Input' }} {{ n }}
                    <button
                      v-if="upstreamMap[n]"
                      class="clear-x-btn"
                      title="Clear"
                      @click="clearUpstreamConnection(n)"
                    >×</button>
                  </div>
                  <select v-model="upstreamMap[n]" class="select" @change="onUpstreamChange(n)">
                    <option :value="'__NO_SOURCE__'">-- No source --</option>
                    <option v-for="src in getAvailableSourcesForInput(n)" :key="src.feedKey" :value="src.feedKey">{{ src.label }}</option>
                  </select>
                  <!-- Gain field for transformer inputs (only show when input is assigned) -->
                  <div v-if="type === 'transformer' && upstreamMap[n] && upstreamMap[n] !== '__NO_SOURCE__'" style="display: grid; grid-template-columns: 80px 1fr; align-items: center; gap: 8px; margin-top: 8px;">
                    <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">Gain (dB):</label>
                    <input 
                      type="number" 
                      v-model.number="inputGain[n]" 
                      @blur="saveInputGain(n)"
                      step="0.5" 
                      min="-60" 
                      max="60" 
                      placeholder="0.0"
                      class="input"
                      style="padding: 6px 8px; font-size: 13px;"
                    />
                  </div>
                  <div v-if="saveStatus[n] === 'saved'" class="save-indicator">✓ Saved</div>
                  <div v-else-if="saveStatus[n] === 'cleared'" class="save-indicator">✓ Cleared</div>
                </div>
                <div v-if="!inputCount" class="muted">{{ type === 'recorder' ? 'No tracks' : 'No inputs' }}</div>
              </div>
            </div>

            <!-- Current Node (Center) -->
            <div class="map-center">
              <div class="map-node-badge">{{ type }}</div>
              <div class="map-node-name">{{ (type === 'transformer' || type === 'recorder') ? editableLabel : (node.track_name || node.label) }}</div>
              <div class="map-node-hint" style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">
                To route outputs, configure the receiving node's inputs
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="btn" @click="saveMap" :disabled="saving">Save Map</button>
          </div>
        </div>
      </div>
      <!-- Settings tab for Source nodes -->
      <div class="panel" v-if="tab==='settings' && type==='source'">
        <div style="display:grid; grid-template-columns: 160px 1fr; align-items:center; gap:10px; margin-bottom:12px;">
          <label style="font-weight:600; color: var(--text-secondary);">Pad (dB)</label>
          <input class="input" type="number" v-model.number="sourcePadDb" step="1" min="-60" max="0" placeholder="0" />
        </div>
        <div style="display:grid; grid-template-columns: 160px 1fr; align-items:center; gap:10px;">
          <label style="font-weight:600; color: var(--text-secondary);">Phantom Power</label>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" v-model="sourcePhantomPower" style="width:auto; min-height:unset; cursor:pointer;" />
            <span style="font-size:14px; color: var(--text-primary);">+48V</span>
          </label>
        </div>
        <div class="actions">
          <button class="btn" @click="saveSourceSettings" :disabled="saving">Save Settings</button>
        </div>
      </div>
      <!-- Delete tab -->
      <div class="panel" v-if="tab==='delete'">
        <div class="delete-warning">
          <p><strong>⚠️ Warning:</strong> This will permanently delete this node and all its connections.</p>
          <p style="margin-top: 8px; color: white;">
            Node: <strong>{{ node.track_name || node.label }}</strong>
          </p>
        </div>
        <div class="actions" style="margin-top: 20px;">
          <button class="btn btn-danger" @click="handleDelete" :disabled="deleting">
            {{ deleting ? 'Deleting...' : '🗑️ Delete Node' }}
          </button>
          <button class="btn btn-secondary" @click="tab='map'" style="margin-left: 8px;">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { buildGraph } from '@/services/signalGraph'
import { hydrateVenueLabels, getOutputLabel, resolveTransformerInputLabel } from '@/services/portLabelService'
import { getCompleteSignalPath, deleteNode, getConnections, deleteConnection as deleteConnectionFromDB, getSourceLabelFromNode } from '@/services/signalMapperService'
import { updateNode } from '@/services/signalMapperService'
import { invalidateTableCache } from '@/services/cacheService'

const toast = useToast()

const props = defineProps({
  stageHourId: { type: [String, Number], default: null },
  projectId: { type: [String, Number], required: true },
  node: { type: Object, required: true },
  elements: { type: Array, default: () => [] },
  fromNode: { type: Object, default: null },
  // Optional: if provided, will check if node can be deleted from this view
  viewType: { type: String, default: null }, // 'signal-flow' or 'mic-placement'
  locationId: { type: [String, Number], default: null } // Location/stage ID for filtering
})
const emit = defineEmits(['close', 'node-deleted', 'node-updated'])

const type = computed(() => (props.node.gear_type || props.node.node_type || props.node.type || '').toLowerCase())
const inputs = computed(() => props.node.num_inputs || props.node.inputs || 0)
const outputs = computed(() => props.node.num_outputs || props.node.outputs || 0)
const tracks = computed(() => props.node.num_tracks || props.node.tracks || props.node.num_records || props.node.numrecord || 0)
const tab = ref('map')
const fromNodeRef = computed(() => props.fromNode)
const isIncomingMap = computed(() => !!fromNodeRef.value)

const graph = ref(null)
// Source settings
const sourcePadDb = ref(0)
const sourcePhantomPower = ref(false)
// Transformer input gain tracking
const inputGain = ref({}) // { inputNumber: gainDb }
// Delete state
const deleting = ref(false)
// Label editing state
const editableLabel = ref('')
const savingLabel = ref(false)
const originalLabel = ref('')

onMounted(async () => {
  // Initialize sourcePadDb from node if present
  if (type.value === 'source') {
    const pad = props.node?.pad_db
    sourcePadDb.value = typeof pad === 'number' ? pad : 0
    const phantom = props.node?.phantom_power
    sourcePhantomPower.value = typeof phantom === 'boolean' ? phantom : false
  }
  // Load transformer input gain values
  if (type.value === 'transformer') {
    await loadInputGain()
  }
  // Initialize editable label for transformers and recorders
  if (type.value === 'transformer' || type.value === 'recorder') {
    editableLabel.value = props.node.label || props.node.track_name || ''
    originalLabel.value = editableLabel.value
  }
})

async function saveSourceSettings() {
  try {
    const padDb = Number(sourcePadDb.value) || 0
    const phantomPower = !!sourcePhantomPower.value
    await updateNode({ id: props.node.id, pad_db: padDb, phantom_power: phantomPower })
    // Optimistically update local node
    props.node.pad_db = padDb
    props.node.phantom_power = phantomPower
    toast.success('Source settings saved')
  } catch (e) {
    console.error('[Inspector][Settings] failed to save source settings', e)
    toast.error('Failed to save settings')
  }
}

async function saveLabel() {
  if (savingLabel.value) return
  
  const trimmedLabel = editableLabel.value.trim()
  if (!trimmedLabel) {
    // Revert to original if empty
    editableLabel.value = originalLabel.value
    toast.error('Label cannot be empty')
    return
  }
  
  if (trimmedLabel === originalLabel.value) {
    // No change, nothing to save
    return
  }
  
  savingLabel.value = true
  try {
    await updateNode({ id: props.node.id, label: trimmedLabel })
    // Optimistically update local node
    props.node.label = trimmedLabel
    originalLabel.value = trimmedLabel
    toast.success('Label updated')
    // Emit node-updated event so parent can refresh
    emit('node-updated', props.node)
  } catch (e) {
    console.error('[Inspector] failed to save label', e)
    toast.error('Failed to save label')
    // Revert on error
    editableLabel.value = originalLabel.value
  } finally {
    savingLabel.value = false
  }
}

function cancelLabelEdit() {
  editableLabel.value = originalLabel.value
}

async function cascadeDeleteNode(nodeId) {
  // Fetch all connections for this project
  const allConnections = await getConnections(props.projectId)
  
  // Find all connections FROM this node (outgoing)
  const outgoingConns = allConnections.filter(c => c.from_node_id === nodeId)
  
  // Find all connections TO this node (incoming)
  const incomingConns = allConnections.filter(c => c.to_node_id === nodeId)

  // Delete all port mappings for these connections
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

  // Batch delete all outgoing and incoming connections (but keep the nodes they connect to)
  if (allConnIds.length > 0) {
    try {
      // Batch delete connections from database
      const { error: connError } = await supabase
        .from('connections')
        .delete()
        .in('id', allConnIds)
      
      if (connError) {
        console.error('Error batch deleting connections:', connError)
        throw connError
      }
      
      // Emit all deletions at once
      allConnIds.forEach(id => emit('connection-deleted', id))
    } catch (err) {
      console.error('Error deleting connections:', err)
      // Fallback to sequential deletion if batch fails
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

  // Finally, delete the node itself
  try {
    await deleteNode(nodeId)
    emit('node-deleted', nodeId)
  } catch (err) {
    console.error('Error deleting node:', err)
    throw err
  }
}

async function handleDelete() {
  // Check deletion restrictions based on view type
  if (props.viewType === 'signal-flow') {
    // In signal flow, don't allow deleting gear source nodes
    const isGearSource = (props.node.gear_type || props.node.type) === 'source' && props.node.gear_id
    if (isGearSource) {
      toast.error('Cannot delete mic-placement sources here. Delete from Mic Placement tab.')
      return
    }
  } else if (props.viewType === 'mic-placement') {
    // In mic placement, only allow deleting gear source nodes
    const isGearSource = props.node.gear_id && props.node.gear_type === 'source'
    if (!isGearSource) {
      toast.error('Only gear source nodes can be deleted from Mic Placement view.')
      return
    }
  }

  deleting.value = true
  try {
    await cascadeDeleteNode(props.node.id)
    toast.success('Node deleted successfully')
    emit('close')
  } catch (err) {
    console.error('Error deleting node:', err)
    toast.error('Failed to delete node')
  } finally {
    deleting.value = false
  }
}

// Load gain values for transformer inputs
async function loadInputGain() {
  if (type.value !== 'transformer') return
  
  try {
    const { data, error } = await supabase
      .from('transformer_input_gain')
      .select('input_number, gain_db')
      .eq('node_id', props.node.id)
    
    if (error) throw error
    
    // Initialize all inputs to 0, then update with loaded values
    const gainMap = {}
    for (let i = 1; i <= inputCount.value; i++) {
      gainMap[i] = 0
    }
    
    if (data) {
      data.forEach(row => {
        gainMap[row.input_number] = Number(row.gain_db) || 0
      })
    }
    
    inputGain.value = gainMap
  } catch (e) {
    console.error('[Inspector] failed to load input gain', e)
    // Initialize with default values on error
    const gainMap = {}
    for (let i = 1; i <= inputCount.value; i++) {
      gainMap[i] = 0
    }
    inputGain.value = gainMap
  }
}

// Save gain value for a specific transformer input
async function saveInputGain(inputNum) {
  if (type.value !== 'transformer') return
  
  const gainValue = Number(inputGain.value[inputNum]) || 0
  
  try {
    // Use upsert to insert or update
    const { error } = await supabase
      .from('transformer_input_gain')
      .upsert({
        node_id: props.node.id,
        project_id: props.projectId,
        input_number: Number(inputNum),
        gain_db: gainValue
      }, {
        onConflict: 'node_id,input_number'
      })
    
    if (error) throw error
    
    // Show subtle feedback (optional - can remove if too noisy)
    // toast.success(`Gain for Input ${inputNum} saved`)
  } catch (e) {
    console.error('[Inspector] failed to save input gain', e)
    toast.error(`Failed to save gain for Input ${inputNum}`)
  }
}
const upstream = ref([])
const downstream = ref([])
const inputLabels = ref({})
// For recorders, use tracks count instead of inputs count
const inputCount = computed(() => {
  if (type.value === 'recorder') {
    // Some recorders only set num_inputs; use it as a fallback for track count
    return tracks.value || inputs.value || 0
  }
  return inputs.value || 0
})
const outputCount = computed(() => outputs.value || 0)

// Unified map state
const upstreamMap = ref({}) // { inputNum: sourceNodeId }
const downstreamMap = ref({}) // { outputNum: targetNodeId }
const downstreamPortMap = ref({}) // { outputNum: targetPortNum }
const upstreamConnections = ref({}) // { inputNum: connectionId }
const downstreamConnections = ref({}) // { outputNum: connectionId }
const upstreamLabels = ref({}) // { inputNum: label } - cached labels for display
const saveStatus = ref({}) // { inputNum: 'saved' | 'error' }

const availableUpstreamSources = ref([]) // [{ id: nodeId, port: portNum (for venue), label: string, feedKey: 'nodeId:port' }]

// Get available sources for a specific input, excluding sources already assigned to other inputs
function getAvailableSourcesForInput(inputNum) {
  // Get the currently selected source for this input (if any)
  const currentFeedKey = upstreamMap.value[inputNum]
  
  // Filter out sources already assigned to other inputs
  // Get all feedKeys that are currently assigned to other inputs
  const usedFeedKeys = new Set()
  for (const [otherInputNum, feedKey] of Object.entries(upstreamMap.value)) {
    if (Number(otherInputNum) !== Number(inputNum) && feedKey && feedKey !== '__NO_SOURCE__') {
      usedFeedKeys.add(feedKey)
    }
  }
  
  // Filter out sources that are already used by other inputs, but always include the currently selected source
  const availableSources = availableUpstreamSources.value.filter(src => 
    !usedFeedKeys.has(src.feedKey) || src.feedKey === currentFeedKey
  )
  
  // Parse labels to extract device name for grouping
  // Format: "Source Name (Transformer DEVICE)" or "Source Name (Direct)"
  function extractDeviceName(label) {
    const match = label.match(/\(([^)]+)\)$/)
    if (match) {
      return match[1] // Returns "Transformer DEVICE" or "Direct"
    }
    return '(Direct)' // Default for sources without parentheses
  }
  
  function extractSourceName(label) {
    const match = label.match(/^(.+?)\s*\(/)
    if (match) {
      return match[1].trim() // Returns "Source Name"
    }
    return label // Return full label if no parentheses
  }
  
  // Group sources by device name
  const grouped = new Map()
  availableSources.forEach(src => {
    const deviceName = extractDeviceName(src.label)
    if (!grouped.has(deviceName)) {
      grouped.set(deviceName, [])
    }
    grouped.get(deviceName).push(src)
  })
  
  // Sort groups by device name (alphabetically)
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const deviceA = a[0]
    const deviceB = b[0]
    // Put "(Direct)" at the end
    if (deviceA === '(Direct)' && deviceB !== '(Direct)') return 1
    if (deviceA !== '(Direct)' && deviceB === '(Direct)') return -1
    return deviceA.localeCompare(deviceB)
  })
  
  // Sort sources within each group alphabetically by source name
  sortedGroups.forEach(([deviceName, sources]) => {
    sources.sort((a, b) => {
      const nameA = extractSourceName(a.label)
      const nameB = extractSourceName(b.label)
      return nameA.localeCompare(nameB)
    })
  })
  
  // Flatten grouped sources back into array
  const result = []
  sortedGroups.forEach(([deviceName, sources]) => {
    result.push(...sources)
  })
  
  return result
}

async function loadAvailableUpstreamSources() {
  if (!graph.value) {
    availableUpstreamSources.value = []
    return
  }
  
  // Recorders should only list sources from nodes that are actually connected upstream
  const isRecorder = type.value === 'recorder'
  const isTransformer = type.value === 'transformer'
  
  // Get all connections to this node (used to track which ports are connected)
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  
  // For recorders, we want to show ALL recorders as potential sources (for recorder→recorder connections)
  // For transformers and other nodes, only show sources that are actually connected upstream
  const showAllRecorders = isRecorder
  
  // Only show connected sources for non-recorders; if there are no incoming connections, nothing to select
  if (!showAllRecorders && parents.length === 0) {
    availableUpstreamSources.value = []
    return
  }
  
  // Build a map of connected node IDs and their connected ports
  // Format: { nodeId: Set<port> } or { nodeId: null } for non-port-mapped sources
  const connectedNodes = new Map()
  
  // Pre-process venue sources to collect all their connections at once
  // This ensures we capture ALL venue source feeds that are connected
  const venueSourceConnections = new Map() // { venueNodeId: [all connections from this venue] }
  for (const p of parents) {
    const nodeId = p.from_node_id
    if (!nodeId) continue
    const srcNode = props.elements.find(e => e.id === nodeId)
    const srcType = srcNode ? (srcNode.gear_type || srcNode.node_type || srcNode.type || '').toLowerCase() : ''
    if (srcType === 'venue_sources') {
      if (!venueSourceConnections.has(nodeId)) {
        venueSourceConnections.set(nodeId, [])
      }
      venueSourceConnections.get(nodeId).push(p)
    }
  }
  
  for (const p of parents) {
    const nodeId = p.from_node_id
    if (!nodeId) continue
    
    // Find the source node to determine its type
    const srcNode = props.elements.find(e => e.id === nodeId)
    const srcType = srcNode ? (srcNode.gear_type || srcNode.node_type || srcNode.type || '').toLowerCase() : ''
    
    // Get port maps for this connection from cached graph data (no DB query needed)
    let connectedPorts = null // null means no port map (single output source)
    const portMaps = (graph.value.mapsByConnId || {})[p.id] || []
    if (portMaps && portMaps.length > 0) {
      // Has port maps - track which ports are connected
      connectedPorts = new Set(portMaps.map(m => Number(m.from_port)))
    } else if (srcType === 'transformer') {
      // For transformer->transformer connections: show ALL outputs that have valid sources
      // Get all connections TO the source transformer to find ALL its assigned inputs
      const sourceParents = (graph.value.parentsByToNode || {})[nodeId] || []
      const sourceAssignedInputs = new Set()
      
      for (const sp of sourceParents) {
        const spMaps = (graph.value.mapsByConnId || {})[sp.id] || []
        if (spMaps.length > 0) {
          // Port maps: use to_port (destination input on source transformer)
          spMaps.forEach(m => sourceAssignedInputs.add(Number(m.to_port)))
        } else if (sp.input_number) {
          // Direct connection: use input_number
          sourceAssignedInputs.add(Number(sp.input_number))
        }
      }
      
      const numOutputs = srcNode.num_outputs || srcNode.outputs || 0
      
      if (sourceAssignedInputs.size > 0) {
        // For 1-output transformers: all assigned inputs are available on output 1
        // For multi-output transformers: input N → output N (1:1 pass-through)
        if (numOutputs === 1) {
          // All assigned inputs are available - use input numbers as identifiers
          connectedPorts = sourceAssignedInputs
        } else {
          // 1:1 pass-through: show outputs where corresponding input has a source
          // Use the assigned input numbers as output port numbers (1:1 mapping)
          connectedPorts = sourceAssignedInputs
        }
      } else {
        // No sources assigned to transformer - check if we have port maps on this connection
        const portMapsForThisConn = (graph.value.mapsByConnId || {})[p.id] || []
        if (portMapsForThisConn.length > 0) {
          // Has port maps - use the from_port values
          connectedPorts = new Set(portMapsForThisConn.map(m => Number(m.from_port)))
        } else if (p.input_number) {
          // Fallback: use input_number if available
          connectedPorts = new Set([Number(p.input_number)])
        } else {
          // No input_number - can't determine, show all (will be filtered later)
          connectedPorts = numOutputs > 0 
            ? new Set(Array.from({ length: numOutputs }, (_, i) => i + 1))
            : new Set([1])
        }
      }
    } else if (srcType === 'recorder') {
      // For recorders without port maps, infer from input_number (1:1 pass-through)
      // Recorder output track N corresponds to input track N
      if (p.input_number) {
        connectedPorts = new Set([Number(p.input_number)])
      } else {
        // No input_number, can't determine which track - skip
        continue
      }
    } else if (srcType === 'venue_sources') {
      // For venue sources, collect ALL feeds from ALL connections to this transformer
      // Use the pre-processed venue source connections to ensure we get everything
      const allConnectionsFromVenue = venueSourceConnections.get(nodeId) || []
      
      // Check if any connection has port maps
      let hasPortMaps = false
      const connectedVenuePorts = new Set()
      
      // Process ALL connections from this venue source to collect all feed ports
      for (const conn of allConnectionsFromVenue) {
        const connMaps = (graph.value.mapsByConnId || {})[conn.id] || []
        if (connMaps.length > 0) {
          // Has port maps - use from_port values (which represent venue source feed ports)
          // Add ALL mapped ports from this connection
          hasPortMaps = true
          connMaps.forEach(m => connectedVenuePorts.add(Number(m.from_port)))
        } else if (conn.input_number) {
          // No port maps but has input_number - for direct connections
          // When there are port maps, we track specific ports
          // When there are no port maps (direct connection), we want to show ALL feeds
          // So we don't add to the Set here - we'll set connectedPorts to null below
        }
      }
      
      if (hasPortMaps && connectedVenuePorts.size > 0) {
        // We have port maps with specific ports - use them (this Set contains ALL mapped feed ports)
        connectedPorts = connectedVenuePorts
      } else {
        // No port maps or no specific ports found - for direct connections, show ALL feeds
        // This allows users to route any venue source feed, not just the ones currently connected
        connectedPorts = null // null means direct connection, show all feeds
      }
    }
    // If no port maps and not a transformer/recorder/venue_sources, connectedPorts stays null (means single output source)
    
    // Store connection info
    if (!connectedNodes.has(nodeId)) {
      connectedNodes.set(nodeId, connectedPorts)
    } else {
      // Merge port sets if both are sets
      const existing = connectedNodes.get(nodeId)
      if (existing instanceof Set && connectedPorts instanceof Set) {
        // Merge sets
        connectedPorts.forEach(port => existing.add(port))
      } else if (connectedPorts instanceof Set) {
        // Replace null with set
        connectedNodes.set(nodeId, connectedPorts)
      }
      // If both are null, keep null (regular source with single output)
    }
  }
  
  const sources = []
  
  // For recorders, show ALL recorders as potential sources (not just connected ones)
  // For transformers and other nodes, only show connected sources
  let nodesToProcess = Array.from(connectedNodes.keys())
    .map(nodeId => props.elements.find(e => e.id === nodeId))
    .filter(Boolean)
  
  if (showAllRecorders) {
    // Add all recorders that aren't already in the connected nodes list
    const allRecorders = props.elements.filter(e => {
      const eType = (e.gear_type || e.node_type || e.type || '').toLowerCase()
      return eType === 'recorder' && e.id !== props.node.id // Don't include self
    })
    
    for (const recorder of allRecorders) {
      if (!connectedNodes.has(recorder.id)) {
        // Add to nodesToProcess and set connectedPorts to null (will show all tracks)
        connectedNodes.set(recorder.id, null) // null means show all outputs
        nodesToProcess.push(recorder)
      }
    }
  }
  
  for (const e of nodesToProcess) {
    if (!e || e.id === props.node.id) continue
    
    const eType = (e.gear_type || e.node_type || e.type || '').toLowerCase()
    
    // Get connected ports for this node (if connected)
    const connectedPortsSet = connectedNodes.get(e.id) || null
    
    // Show all source types (gear sources, venue sources, transformers, recorders)
    if (eType === 'venue_sources') {
      // For recorders: show ALL venue source feeds
      // For transformers and other nodes: show connected feeds (with port maps or direct connections)
      if (!showAllRecorders && connectedPortsSet === undefined) {
        // Not connected and not showing all - skip
        continue
      }
      
      // For non-recorders, venue sources should show ALL feeds when connected
      // This allows users to route any venue source feed, not just the ones currently connected
      // Port maps are used to track which feeds are already in use, but we still show all available feeds
      if (!showAllRecorders) {
        // If it's a Set but empty, skip (no connected ports)
        if (connectedPortsSet instanceof Set && connectedPortsSet.size === 0) {
          continue
        }
        // If connectedPortsSet is undefined, we already skipped above
        // If it's null or a Set, we'll show all feeds below (venue sources always show all feeds when connected)
      }
      
      try {
        const { data: feeds } = await supabase
          .from('venue_source_feeds')
          .select('port_number, output_port_label')
          .eq('node_id', e.id)
          .order('port_number')
        
        if (feeds && feeds.length) {
          // For venue sources: ALWAYS show ALL feeds when connected (regardless of port maps)
          // This allows users to route any feed to any transformer input
          // Port maps are only used to track which feeds are already assigned, not to limit selection
          for (const feed of feeds) {
            const port = feed.port_number
            // Always include all feeds when venue source is connected
            // connectedPortsSet being null or a Set both mean the venue source is connected
            const shouldInclude = showAllRecorders || 
              connectedPortsSet !== undefined // Connected (either null or Set means connected)
            if (shouldInclude) {
              sources.push({
                id: e.id,
                port,
                label: `${feed.output_port_label || `Output ${port}`} (Venue)`,
                feedKey: `${e.id}:${port}`
              })
            }
          }
        } else {
          // Fallback: use output_port_labels if feeds table is empty
          const labels = e.output_port_labels || {}
          const numOutputs = e.num_outputs || 0
          for (let port = 1; port <= numOutputs; port++) {
            // Always include all feeds when venue source is connected
            // connectedPortsSet being null or a Set both mean the venue source is connected
            const shouldInclude = showAllRecorders || 
              connectedPortsSet !== undefined // Connected (either null or Set means connected)
            if (shouldInclude) {
              const label = labels[port] || `Output ${port}`
              sources.push({
                id: e.id,
                port,
                label: `${label} (Venue)`,
                feedKey: `${e.id}:${port}`
              })
            }
          }
        }
      } catch (err) {
        console.error('[Inspector] failed to load venue feeds', err)
        // Skip on error
      }
    } else if (eType === 'source') {
      // Regular gear sources: often have a single output and no port maps
      // Treat "null" connectedPortsSet as connected (single-output). Include only if connected (undefined means not connected)
      if (connectedPortsSet !== undefined) {
        sources.push({
          id: e.id,
          port: null,
          label: `${e.track_name || e.label} (Direct)`,
          feedKey: e.id
        })
      }
    } else if (eType === 'transformer') {
      // For recorders: show ALL transformer outputs
      // For transformers and other nodes: only show connected outputs
      const numOutputs = e.num_outputs || e.outputs || 0
      if (numOutputs > 0) {
        // Include ALL transformer outputs that have a valid upstream source
        // Exclude outputs where the corresponding input is "-- No source --"
        const parentsOfTransformer = (graph.value.parentsByToNode || {})[e.id] || []
        const mappedInputs = new Set()
        for (const p of parentsOfTransformer) {
          const maps = (graph.value.mapsByConnId || {})[p.id] || []
          // Only include inputs that have explicit port maps (not cleared)
          maps.forEach(m => mappedInputs.add(Number(m.to_port)))
          // For connections without port maps, check if input_number is set
          // This handles direct sources, but only if there's no port map (meaning it's not cleared)
          if (maps.length === 0 && p.input_number) {
            mappedInputs.add(Number(p.input_number))
          }
        }
        
        // Special handling for transformers with 1 output: show all mapped inputs
        // For transformers with multiple outputs, use 1:1 pass-through (output N = input N)
        if (numOutputs === 1 && mappedInputs.size > 0) {
          // Transformer has 1 output but multiple inputs - all inputs are available on that single output
          // Show each mapped input as a separate source option, all pointing to output port 1
          const outputPort = 1
          // For non-recorders, check if transformer is connected
          // For 1-output transformers, connectedPortsSet contains input numbers, not output port
          // So we check if the set has any values (meaning transformer is connected and has sources)
          const isConnected = showAllRecorders || 
            connectedPortsSet === null || 
            (connectedPortsSet instanceof Set && connectedPortsSet.size > 0)
          
          if (isConnected) {
            // Show all mapped inputs as available sources on the single output
            for (const inputNum of mappedInputs) {
              try {
                // Get the label for this input (which will be available on the single output)
                const label = await getOutputLabel(e, inputNum, graph.value)
                if (label && String(label).trim().length > 0) {
                  // Check if this traces back to a venue source
                  const originalSource = await traceToOriginalVenueSource(e.id, inputNum, graph.value)
                  const labelSuffix = originalSource ? ' (Venue)' : ` (Transformer ${e.track_name || e.label || ''})`
                  // Use inputNum as the port for feedKey to distinguish between different inputs
                  // But all point to the same output port (1)
                  sources.push({
                    id: e.id,
                    port: inputNum, // Use input number as port identifier for feedKey
                    label: `${label}${labelSuffix}`.trim(),
                    feedKey: `${e.id}:${inputNum}` // Use input number to distinguish sources
                  })
                }
              } catch (err) {
                // skip unmapped/unknown
              }
            }
          }
        } else {
          // Multiple outputs: use 1:1 pass-through (output N = input N)
          // For transformer → transformer: show ALL outputs with valid sources
          // Don't filter by connectedPortsSet - allow user to map any available source
          for (const inputNum of mappedInputs) {
            // Show this output even if not explicitly port-mapped to us
            // This allows flexible routing between transformers
            // For multi-output transformers, input N maps to output N (1:1 pass-through)
            const outputPort = inputNum
            
            // For non-recorders, check if this transformer is connected
            // If connected, show all outputs with valid sources (don't restrict by port)
            if (!showAllRecorders) {
              // If transformer is not connected at all, skip
              if (connectedPortsSet === undefined) {
                continue
              }
              // If transformer is connected (null or Set), show all outputs with sources
              // Don't filter by specific port - allow mapping any available source
            }
            
            try {
              const label = await getOutputLabel(e, inputNum, graph.value)
              if (label && String(label).trim().length > 0) {
                // Check if this traces back to a venue source
                const originalSource = await traceToOriginalVenueSource(e.id, inputNum, graph.value)
                const labelSuffix = originalSource ? ' (Venue)' : ` (Transformer ${e.track_name || e.label || ''})`
                sources.push({
                  id: e.id,
                  port: outputPort, // Use output port number (1:1 with input)
                  label: `${label}${labelSuffix}`.trim(),
                  feedKey: `${e.id}:${outputPort}`
                })
              }
            } catch (err) {
              // skip unmapped/unknown
            }
          }
        }
      }
    } else if (eType === 'recorder') {
      // Recorders can output to other nodes (recorder-to-recorder or recorder-to-transformer)
      // Only show tracks that have valid upstream sources assigned (not empty tracks)
      const numTracks = e.num_tracks || e.tracks || e.num_records || e.numrecord || 0
      const numOutputs = e.num_outputs || e.outputs || numTracks // Use num_outputs if set, otherwise tracks
      const tracksToShow = Math.max(numTracks, numOutputs) // Show all available tracks/outputs
      
      // For recorder→recorder connections, show tracks with valid sources
      // For other node types, only show connected ports
      const shouldShowAll = showAllRecorders // Always show tracks with sources when target is a recorder
      const portsToShow = shouldShowAll 
        ? Array.from({ length: tracksToShow }, (_, i) => i + 1)
        : (connectedPortsSet ? Array.from(connectedPortsSet) : [])
      
      if (portsToShow.length > 0) {
        // Check which tracks on this recorder have valid upstream sources
        // IMPORTANT: Only check connections TO this recorder (incoming), not FROM this recorder (outgoing)
        // Port mappings on outgoing connections (like "Assign as Backup") should not affect this recorder's source options
        const parentsOfRecorder = (graph.value.parentsByToNode || {})[e.id] || []
        const tracksWithSources = new Set()
        
        // Check port mappings to find tracks with sources
        // Only consider connections TO this recorder (where this recorder is the destination)
        for (const parent of parentsOfRecorder) {
          // Verify this connection is actually TO this recorder (safety check)
          const isIncoming = (parent.to_node_id === e.id || parent.to === e.id)
          if (!isIncoming) continue // Skip if not an incoming connection
          
          const portMaps = (graph.value.mapsByConnId || {})[parent.id] || []
          if (portMaps && portMaps.length > 0) {
            // Has port maps - track which tracks have sources
            // to_port is the destination track on this recorder
            portMaps.forEach(m => {
              const trackNum = Number(m.to_port)
              if (trackNum) tracksWithSources.add(trackNum)
            })
          } else if (parent.input_number || parent.track_number) {
            // Direct connection without port maps
            const trackNum = Number(parent.input_number || parent.track_number)
            if (trackNum) tracksWithSources.add(trackNum)
          }
        }
        
        for (const port of portsToShow) {
          // Only show tracks that have valid upstream sources
          if (!tracksWithSources.has(port)) {
            continue
          }
          
          // Get the label for this recorder track output (traces back to original source)
          try {
            const label = await getOutputLabel(e, port, graph.value)
            // Only show if we got a valid traced source name (not just "Track N")
            if (label && label !== `Track ${port}` && !label.includes('-- No source --')) {
              sources.push({
                id: e.id,
                port,
                label: label, // Show original source name (e.g., "Microphone 1", "Guitar L")
                feedKey: `${e.id}:${port}`
              })
            }
          } catch (err) {
            // Skip tracks that fail to resolve labels
          }
        }
      }
    }
  }
  
  availableUpstreamSources.value = sources
}

const availableDownstreamTargets = computed(() => {
  if (!graph.value) return []
  // Only show nodes that are actually connected from this node's outputs
  const children = (graph.value.connections || []).filter(c => c.from_node_id === props.node.id)
  const connectedIds = new Set(children.map(c => c.to_node_id).filter(Boolean))
  return props.elements.filter(e => {
    if (e.id === props.node.id) return false
    if (!connectedIds.has(e.id)) return false
    const eType = (e.gear_type || e.node_type || e.type || '').toLowerCase()
    return (eType === 'transformer' || eType === 'recorder')
  }).map(e => ({ id: e.id, label: e.track_name || e.label }))
})

const saving = ref(false)

// Venue sources feeds editor (independent from node.num_outputs)
const feeds = ref([]) // [{ port: number, label: string }]
const nextFeedPort = ref(1)
const trackList = ref([])

async function refresh() {
  // Always rebuild graph to ensure we have latest connections and port maps
  // This ensures we fetch all connected sources and their current state
  graph.value = await buildGraph(props.projectId, props.locationId, props.stageHourId)
  if (type.value === 'venue_sources') {
    await hydrateVenueLabels(props.node)
  }
  await loadConnections() // Load connections first to get the feedKeys
  await loadAvailableUpstreamSources() // Refresh available sources after connections are loaded - fetches connected sources
  await updateUpstreamLabels() // Update labels after connections and sources are loaded
  await loadLabels() // Load transformer input labels
  // Populate recorder track list mapping from sources → recorder for tracking view
  if (type.value === 'recorder') {
    await loadTracks()
  }
  if (isIncomingMap.value) tab.value = 'map'
  if (type.value === 'venue_sources') await loadFeeds()
}

async function loadConnections() {
  upstream.value = []
  downstream.value = []
  upstreamMap.value = {}
  downstreamMap.value = {}
  downstreamPortMap.value = {}
  upstreamConnections.value = {}
  downstreamConnections.value = {}
  upstreamLabels.value = {} // Clear cached labels
  
  // Load upstream connections
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  for (const p of parents) {
    const src = props.elements.find(e => e.id === p.from_node_id)
    const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
    const portMaps = (graph.value.mapsByConnId || {})[p.id] || []

    if (portMaps && portMaps.length > 0) {
      // Map each to_port explicitly for connections that use port maps
      for (const m of portMaps) {
        const inputNum = Number(m.to_port)
        if (!inputNum) continue
        upstreamConnections.value[inputNum] = p.id
        const inferredPort = m.from_port
        const usePortInFeedKey = (srcType === 'venue_sources' || srcType === 'transformer' || srcType === 'recorder') && inferredPort
        const feedKey = usePortInFeedKey ? `${p.from_node_id}:${inferredPort}` : p.from_node_id
        upstreamMap.value[inputNum] = feedKey
        const portForLabel = inferredPort || null
        const label = src ? (await getOutputLabel(src, portForLabel, graph.value)) : 'Unknown'
        upstreamLabels.value[inputNum] = label
        upstream.value.push({ key: `${p.id}:${inputNum}`, input: inputNum, label })
      }
      continue
    }

    // No port maps: only assign to a concrete input when input_number is present
    if (p.input_number) {
      const inputNum = Number(p.input_number)
      upstreamConnections.value[inputNum] = p.id
      // For venue sources and recorders with direct connections, use input_number as the port
      // This allows venue sources to work like regular sources when directly connected
      const inferredPort = (srcType === 'venue_sources' || srcType === 'recorder') ? inputNum : null
      const usePortInFeedKey = (srcType === 'venue_sources' || srcType === 'transformer' || srcType === 'recorder') && inferredPort
      const feedKey = usePortInFeedKey ? `${p.from_node_id}:${inferredPort}` : p.from_node_id
      upstreamMap.value[inputNum] = feedKey
      const portForLabel = inferredPort
      const label = src ? (await getOutputLabel(src, portForLabel, graph.value)) : 'Unknown'
      upstreamLabels.value[inputNum] = label
      upstream.value.push({ key: p.id, input: inputNum, label })
    }
  }
  // Initialize any unmapped inputs/tracks to explicit "No Source" sentinel
  const totalInputs = inputCount.value
  for (let i = 1; i <= totalInputs; i++) {
    if (typeof upstreamMap.value[i] === 'undefined' || upstreamMap.value[i] === null) {
      upstreamMap.value[i] = '__NO_SOURCE__'
      upstreamLabels.value[i] = '—'
    }
  }
  
  // Load downstream connections
  const children = (graph.value.connections || []).filter(c => c.from_node_id === props.node.id)
  for (const c of children) {
    let maps = []
    try {
      const { data } = await supabase
        .from('connection_port_map')
        .select('from_port, to_port')
        .eq('connection_id', c.id)
      maps = data || []
    } catch {}
    if (maps.length) {
      maps.forEach(m => {
        const outPort = m.from_port
        downstreamMap.value[outPort] = c.to_node_id
        downstreamPortMap.value[outPort] = m.to_port
        downstreamConnections.value[outPort] = c.id
        downstream.value.push({ key: `${c.id}:${m.to_port}`, kind: 'Input', port: m.to_port, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
      })
    } else {
      const outPort = 1 // For non-port-mapped, assume output 1
      downstreamMap.value[outPort] = c.to_node_id
      downstreamPortMap.value[outPort] = c.input_number || 1
      downstreamConnections.value[outPort] = c.id
      downstream.value.push({ key: c.id, kind: 'Input', port: c.input_number || 1, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
    }
  }
}

function getNodeLabel(id) {
  const n = props.elements.find(e => e.id === id)
  return n?.track_name || n?.label || 'Unknown'
}

async function loadLabels() {
  inputLabels.value = {}
  if (type.value !== 'transformer') return
  const count = inputCount.value
  for (let i = 1; i <= count; i++) {
    const lbl = await resolveTransformerInputLabel(props.node, i, graph.value)
    inputLabels.value[i] = lbl
  }
}

async function saveMappings() {
  saving.value = true
  try {
    if (isIncomingMap.value) {
      const upstream = fromNodeRef.value
      const upstreamType = (upstream.gear_type || upstream.node_type || upstream.type || '').toLowerCase()
      const toNodeId = props.node.id
      const upstreamOutputs = upstream.num_outputs || upstream.outputs || 0
      if (upstreamType === 'source' || upstreamType === 'venue_sources') {
        if (upstreamOutputs <= 1) {
          const chosen = draftMappings.value[1] || draftMappings.value['1']
          if (!chosen) return
          await supabase.from('connections').insert([{ project_id: props.projectId, location_id: props.locationId || null, stage_hour_id: props.stageHourId || null, from_node_id: upstream.id, to_node_id: toNodeId, input_number: Number(chosen) }])
          invalidateTableCache('connections', props.projectId)
          invalidateTableCache('graph', props.projectId)
          await refresh()
          return
        }
      }
      let parentId
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .eq('project_id', props.projectId)
        .eq('from_node_id', upstream.id)
        .eq('to_node_id', toNodeId)
        .maybeSingle()
      if (existing) parentId = existing.id
      else {
        const { data: saved } = await supabase
          .from('connections')
          .insert([{ project_id: props.projectId, location_id: props.locationId || null, stage_hour_id: props.stageHourId || null, from_node_id: upstream.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
        invalidateTableCache('connections', props.projectId)
        invalidateTableCache('graph', props.projectId)
      }
      await supabase.from('connection_port_map').delete().eq('connection_id', parentId)
      const inserts = Object.entries(draftMappings.value)
        .filter(([from, to]) => Number(to) > 0)
        .map(([from, to]) => ({ project_id: props.projectId, connection_id: parentId, from_port: Number(from), to_port: Number(to) }))
      if (inserts.length) {
        await supabase.from('connection_port_map').insert(inserts)
      }
      await refresh()
    } else {
      const toNodeId = selectedToNodeId.value
      if (!toNodeId) return
      let parentId
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .eq('project_id', props.projectId)
        .eq('from_node_id', props.node.id)
        .eq('to_node_id', toNodeId)
        .maybeSingle()
      if (existing) parentId = existing.id
      else {
        const { data: saved } = await supabase
          .from('connections')
          .insert([{ project_id: props.projectId, location_id: props.locationId || null, stage_hour_id: props.stageHourId || null, from_node_id: props.node.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
        invalidateTableCache('connections', props.projectId)
        invalidateTableCache('graph', props.projectId)
      }
      await supabase.from('connection_port_map').delete().eq('connection_id', parentId)
      const inserts = Object.entries(draftMappings.value)
        .filter(([from, to]) => Number(to) > 0)
        .map(([from, to]) => ({ project_id: props.projectId, connection_id: parentId, from_port: Number(from), to_port: Number(to) }))
      if (inserts.length) {
        await supabase.from('connection_port_map').insert(inserts)
      }
      await refresh()
    }
  } finally {
    saving.value = false
  }
}

async function saveFeeds() {
  saving.value = true
  try {
    console.log('[Inspector][Feeds] save:start', { node_id: props.node.id })
    // Build rows and track identifiers to ensure uniqueness
    const seenIdentifiers = new Map() // Map: uniqueKey -> port number
    const rows = feeds.value
      .map((f, idx) => {
        const label = (f.label || '').trim()
        if (!label) return null
        // Extract source type and identifier from label
        let sourceType = 'gear'
        let feedIdentifier = String(f.port) // Default to port number for uniqueness
        const m = label.match(/^([A-Z]+)\s+([A-Z0-9]+)/i)
        if (m) {
          const type = m[1].toLowerCase()
          if (['dj', 'program', 'handheld'].includes(type)) {
            sourceType = type === 'handheld' ? 'handheld_mic' : type
            feedIdentifier = m[2]
          } else {
            // Gear source - ensure uniqueness by including port number
            sourceType = 'gear'
            const baseId = m[2] || label.substring(0, 10).replace(/\s/g, '_')
            feedIdentifier = `${baseId}_${f.port}`
          }
        } else {
          // No pattern match - assume gear source, use port number for uniqueness
          sourceType = 'gear'
          const baseId = label.substring(0, 10).replace(/\s/g, '_') || `port${f.port}`
          feedIdentifier = `${baseId}_${f.port}`
        }
        
        // Ensure uniqueness within the batch: check if this identifier already exists
        // For standard sources (DJ/Program/Handheld), allow duplicates (they might be stereo pairs)
        // For gear sources, ensure uniqueness by always including port
        const uniqueKey = `${sourceType}:${feedIdentifier}:1` // channel is always 1 for now
        if (sourceType === 'gear') {
          // For gear sources, identifier should already include port, but double-check
          if (!feedIdentifier.includes(`_${f.port}`) && !feedIdentifier.endsWith(String(f.port))) {
            feedIdentifier = `${feedIdentifier}_${f.port}`
          }
        } else {
          // For standard sources, if duplicate found, append port to make unique
          if (seenIdentifiers.has(uniqueKey)) {
            feedIdentifier = `${feedIdentifier}_${f.port}`
          }
        }
        seenIdentifiers.set(`${sourceType}:${feedIdentifier}:1`, f.port)
        
        return {
          project_id: props.projectId,
          node_id: props.node.id,
          source_type: sourceType,
          feed_identifier: feedIdentifier,
          port_number: Number(f.port),
          channel: 1,
          numbering_style: 'numbers',
          output_port_label: label
        }
      })
      .filter(r => r !== null && r.output_port_label && r.output_port_label.length > 0)
    
    // Delete existing feeds
    const { error: deleteError } = await supabase.from('venue_source_feeds').delete().eq('node_id', props.node.id)
    if (deleteError) throw deleteError
    
    // Insert new feeds
    if (rows.length) {
      const { error: insertError } = await supabase.from('venue_source_feeds').insert(rows)
      if (insertError) throw insertError
    }
    
    // Update node num_outputs (optional, don't fail if it errors)
    try { 
      await supabase.from('nodes').update({ num_outputs: rows.length }).eq('id', props.node.id) 
    } catch (err) {
      console.warn('[Inspector][Feeds] failed to update num_outputs', err)
    }
    
    await hydrateVenueLabels(props.node)
    await refresh()
    console.log('[Inspector][Feeds] save:done', { count: rows.length })
    
    toast.success(`Saved ${rows.length} feed(s)`)
  } catch (err) {
    console.error('[Inspector][Feeds] save failed', err)
    toast.error('Failed to save feeds: ' + (err.message || 'Unknown error'))
  } finally {
    saving.value = false
  }
}

async function loadTracks() {
  console.log('[Inspector][Tracks] load:start', { project_id: props.projectId, locationId: props.locationId })
  const all = await getCompleteSignalPath(props.projectId, props.locationId)
  const here = all.filter(p => p.recorder_id === props.node.id)
  trackList.value = here.map(p => ({ 
    key: `${p.recorder_id}:${p.track_number}`, 
    track: p.track_number, 
    source: p.source_label || p.track_name 
  }))
  console.log('[Inspector][Tracks] load:done', { count: trackList.value.length, totalPaths: all.length, filteredPaths: here.length })
}

onMounted(async () => {
  console.log('[Inspector] open', { node_id: props.node.id, type: type.value })
  // Force refresh of graph and all connected sources when inspector opens
  graph.value = null // Clear any stale graph
  await refresh()
  console.log('[Inspector] ready')
})

async function loadFeeds() {
  try {
    const { data } = await supabase
      .from('venue_source_feeds')
      .select('port_number, output_port_label')
      .eq('node_id', props.node.id)
      .order('port_number')
    const list = (data || []).map(r => ({ port: Number(r.port_number), label: r.output_port_label || '' }))
    feeds.value = list
    const used = new Set(list.map(f => f.port))
    nextFeedPort.value = 1
    while (used.has(nextFeedPort.value)) nextFeedPort.value++
    // Auto-generate feeds from connected gear source nodes
    await autoGenerateFeedsFromGearSources()
  } catch {}
}

async function autoGenerateFeedsFromGearSources() {
  try {
    if (!graph.value) return
    // Find all gear source nodes connected to this venue_sources node
    const parents = (graph.value?.parentsByToNode || {})[props.node.id] || []
    const gearSources = []
    for (const p of parents) {
      const src = props.elements.find(e => e.id === p.from_node_id)
      if (src && (src.gear_type || src.node_type || src.type) === 'source' && src.gear_id) {
        gearSources.push({ conn: p, node: src })
      }
    }
    if (!gearSources.length) return
    // For each gear source, create/update a feed if not already present
    for (const { conn, node } of gearSources) {
      const port = conn.input_number || 1
      const existing = feeds.value.find(f => f.port === port)
      if (!existing) {
        const gearName = node.label || node.track_name || 'Gear Source'
        feeds.value.push({ port, label: gearName })
        const used = new Set(feeds.value.map(f => f.port))
        nextFeedPort.value = 1
        while (used.has(nextFeedPort.value)) nextFeedPort.value++
      } else if (!existing.label) {
        // Update existing feed with gear name if label is empty
        const gearName = node.label || node.track_name || 'Gear Source'
        existing.label = gearName
      }
    }
  } catch {}
}

function addFeed() {
  const port = nextFeedPort.value
  feeds.value.push({ port, label: '' })
  const used = new Set(feeds.value.map(f => f.port))
  nextFeedPort.value = 1
  while (used.has(nextFeedPort.value)) nextFeedPort.value++
}

function removeFeed(port) {
  feeds.value = feeds.value.filter(f => f.port !== port)
}

// Unified map functions
// Update labels for all inputs after connections are loaded
async function updateUpstreamLabels() {
  if (!graph.value) return
  
  for (const inputNum in upstreamMap.value) {
    const feedKey = upstreamMap.value[inputNum]
    if (!feedKey || feedKey === '__NO_SOURCE__') {
      upstreamLabels.value[inputNum] = '—'
      continue
    }
    
    // Try to find in availableUpstreamSources first (fast path)
    // This should work after loadAvailableUpstreamSources() refreshes the list
    const src = availableUpstreamSources.value.find(s => s.feedKey === feedKey)
    if (src && src.label) {
      upstreamLabels.value[inputNum] = src.label
      continue
    }
    
    // If not found in available sources, resolve from connection/graph
    // This ensures we use the exact port map that was saved
    try {
      const connId = upstreamConnections.value[inputNum]
      if (connId && graph.value) {
        // Find the connection in the graph
        const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
        const conn = parents.find(p => p.id === connId)
        if (conn) {
          // Get port map if exists from cached graph data (no DB query needed)
          // This is the authoritative source for which port to use
          let feedPort = null
          const portMaps = (graph.value.mapsByConnId || {})[connId] || []
          if (portMaps && portMaps.length > 0) {
            const matchingMap = portMaps.find(m => Number(m.to_port) === Number(inputNum))
            if (matchingMap) {
              feedPort = matchingMap.from_port
            } else if (portMaps.length === 1) {
              feedPort = portMaps[0].from_port
            }
          }
          
          // Find source node
          const srcNode = props.elements.find(e => e.id === conn.from_node_id)
          if (srcNode) {
            const srcType = (srcNode.gear_type || srcNode.node_type || srcNode.type || '').toLowerCase()
            let portForLabel = feedPort
            
            // Only use explicit port maps for label resolution; avoid inferring when none exists
            if (feedPort !== null) {
              portForLabel = feedPort
            }
            
            // Resolve label from graph using the determined port
            const label = await getOutputLabel(srcNode, portForLabel, graph.value)
            if (label) {
              upstreamLabels.value[inputNum] = label
              continue
            }
          }
        }
      }
      
      // Fallback: parse feedKey and try to resolve directly
      // This uses the feedKey that was saved, which should match what was selected
      if (feedKey.includes(':')) {
        const parts = feedKey.split(':')
        const nodeId = parts[0]
        const port = parts.length > 1 ? Number(parts[1]) : null
        const srcNode = props.elements.find(e => e.id === nodeId)
        if (srcNode && graph.value && port !== null) {
          // Use the port from feedKey - this is what was selected
          const label = await getOutputLabel(srcNode, port, graph.value)
          if (label) {
            upstreamLabels.value[inputNum] = label
            continue
          }
        }
      }
    } catch (err) {
      console.warn('[Inspector][Map] failed to resolve label for input', inputNum, err)
    }
    
    // Final fallback
    upstreamLabels.value[inputNum] = 'Unknown'
  }
}

function getUpstreamLabel(inputNum) {
  return upstreamLabels.value[inputNum] || '—'
}

async function onUpstreamChange(inputNum) {
  // Store the selected value before any async operations
  const selectedFeedKey = upstreamMap.value[inputNum]
  
  try {
    if (type.value === 'recorder') {
      console.log('[Inspector][Change] Track selection changed:', {
        inputNum,
        feedKey: selectedFeedKey,
        feedKeyType: typeof selectedFeedKey,
        isNoSource: selectedFeedKey === '__NO_SOURCE__'
      })
    }
    
    // Save first and wait for it to complete
    const result = await saveMap(inputNum, true)
    
    // Rebuild the graph with fresh data AFTER save completes
    graph.value = await buildGraph(props.projectId, props.locationId, props.stageHourId)
    
    // Now reload sources and labels
    await loadAvailableUpstreamSources()
    await updateUpstreamLabels()
    
    // IMPORTANT: Restore the selected value if it was overwritten
    // This handles race conditions where refresh() resets the selection
    if (selectedFeedKey && selectedFeedKey !== '__NO_SOURCE__') {
      upstreamMap.value[inputNum] = selectedFeedKey
    }
    
    if (result && result.savedCount > 0 && result.errorCount === 0) {
      saveStatus.value[inputNum] = 'saved'
      setTimeout(() => { if (saveStatus.value[inputNum] === 'saved') delete saveStatus.value[inputNum] }, 2000)
    } else if (type.value === 'recorder') {
      console.warn('[Inspector][Change] Save failed or nothing saved:', {
        inputNum,
        feedKey: selectedFeedKey,
        result
      })
    }
  } catch (err) {
    // On error, restore the selection so user can try again
    upstreamMap.value[inputNum] = selectedFeedKey
    if (type.value === 'recorder') {
      console.error('[Inspector][Change] Error saving track:', {
        inputNum,
        feedKey: selectedFeedKey,
        error: err
      })
    }
    toast.error('Failed to save source selection')
  }
}

function onDownstreamChange(outputNum) {
  // Clear port mapping when target changes
  downstreamPortMap.value[outputNum] = null
}

function getDownstreamPortOptions(targetNodeId) {
  if (!targetNodeId) return []
  const n = props.elements.find(e => e.id === targetNodeId)
  if (!n) return []
  const isRecorder = ((n.gear_type || n.node_type || n.type || '').toLowerCase()) === 'recorder'
  const count = isRecorder
    ? (n.num_tracks || n.tracks || n.num_records || n.numrecord || n.num_inputs || n.inputs || 0)
    : (n.num_inputs || n.inputs || 0)
  return Array.from({ length: Math.max(0, count) }, (_, i) => i + 1)
}

// Trace back through transformers to find if the original source is a venue source
async function traceToOriginalVenueSource(nodeId, portNum, graph) {
  try {
    const node = props.elements.find(e => e.id === nodeId)
    if (!node) return false
    
    const nodeType = (node.gear_type || node.type || '').toLowerCase()
    
    // If this is already a venue source, return true
    if (nodeType === 'venue_sources') return true
    
    // If this is a source (not venue), return false
    if (nodeType === 'source') return false
    
    // For transformers, trace back through the input that corresponds to this output port
    if (nodeType === 'transformer') {
      // For transformers, output port N typically corresponds to input N (1:1 pass-through)
      const inputNum = portNum
      
      // Find connections feeding this transformer's input
      const parents = (graph.parentsByToNode || {})[nodeId] || []
      const portMaps = graph.mapsByConnId || {}
      
      // Check for port-mapped connections first
      for (const parent of parents) {
        const maps = portMaps[parent.id] || []
        const relevantMap = maps.find(m => Number(m.to_port) === Number(inputNum))
        
        if (relevantMap) {
          // Recursively trace from the upstream node's output port
          const upstreamNodeId = parent.from_node_id
          const upstreamPort = relevantMap.from_port
          return await traceToOriginalVenueSource(upstreamNodeId, upstreamPort, graph)
        }
      }
      
      // Check for direct connections
      const directParent = parents.find(p => Number(p.input_number) === Number(inputNum))
      if (directParent) {
        const upstreamNodeId = directParent.from_node_id
        // For direct connections, infer the upstream port
        const upstreamNode = props.elements.find(e => e.id === upstreamNodeId)
        if (upstreamNode) {
          const upstreamType = (upstreamNode.gear_type || upstreamNode.type || '').toLowerCase()
          if (upstreamType === 'venue_sources') return true
          if (upstreamType === 'source') return false
          if (upstreamType === 'transformer') {
            // Recursively trace
            return await traceToOriginalVenueSource(upstreamNodeId, inputNum, graph)
          }
        }
      }
    }
    
    // For recorders, trace back through their inputs
    if (nodeType === 'recorder') {
      // Recorder output port N corresponds to track N, which is fed by input N
      const trackNum = portNum
      const parents = (graph.parentsByToNode || {})[nodeId] || []
      const portMaps = graph.mapsByConnId || {}
      
      // Find connection feeding this recorder's track
      for (const parent of parents) {
        const maps = portMaps[parent.id] || []
        const relevantMap = maps.find(m => Number(m.to_port) === Number(trackNum))
        
        if (relevantMap) {
          const upstreamNodeId = parent.from_node_id
          const upstreamPort = relevantMap.from_port
          return await traceToOriginalVenueSource(upstreamNodeId, upstreamPort, graph)
        }
      }
      
      // Check direct connection
      const directParent = parents.find(p => 
        Number(p.input_number) === Number(trackNum) || Number(p.track_number) === Number(trackNum)
      )
      if (directParent) {
        const upstreamNodeId = directParent.from_node_id
        const upstreamNode = props.elements.find(e => e.id === upstreamNodeId)
        if (upstreamNode) {
          const upstreamType = (upstreamNode.gear_type || upstreamNode.type || '').toLowerCase()
          if (upstreamType === 'venue_sources') return true
          if (upstreamType === 'source') return false
          // Recursively trace for transformers/recorders
          return await traceToOriginalVenueSource(upstreamNodeId, directParent.input_number || trackNum, graph)
        }
      }
    }
    
    return false
  } catch (err) {
    console.error('Error tracing to original venue source:', err)
    return false
  }
}

// Refresh source names to show latest venue source names
async function refreshSourceNames() {
  try {
    toast.info('Refreshing source names...')
    // Rebuild graph to get latest connections
    graph.value = await buildGraph(props.projectId, props.locationId, props.stageHourId)
    // Reload available sources with updated names
    await loadAvailableUpstreamSources()
    // Update upstream labels
    await updateUpstreamLabels()
    toast.success('Source names refreshed')
  } catch (err) {
    console.error('Error refreshing source names:', err)
    toast.error('Failed to refresh source names')
  }
}

async function clearUpstreamConnection(inputNum) {
  // Store info before clearing
  const existingConnId = upstreamConnections.value[inputNum]
  const existingFeedKey = upstreamMap.value[inputNum]
  
  // Clear the dropdown selection immediately for responsive UI
  upstreamMap.value[inputNum] = '__NO_SOURCE__'
  delete upstreamConnections.value[inputNum]
  
  // Also clear gain value for transformer inputs
  if (type.value === 'transformer') {
    delete inputGain.value[inputNum]
    try {
      await supabase
        .from('transformer_input_gain')
        .delete()
        .eq('node_id', props.node.id)
        .eq('input_number', Number(inputNum))
    } catch (e) {
      console.warn('[Inspector] failed to delete input gain', e)
    }
  }
  
  // Delete only the port map for this input, NOT the entire connection
  // This keeps the source node "connected" so it remains in the dropdown
  if (existingConnId) {
    try {
      // Delete only the port map for this specific input
      const { error: deleteError } = await supabase
        .from('connection_port_map')
        .delete()
        .eq('connection_id', existingConnId)
        .eq('to_port', Number(inputNum))
      
      if (deleteError) {
        console.warn('[Inspector] failed to delete port map', deleteError)
      }
      
      // For transformers: DO NOT delete the connection even if no port maps remain
      // This keeps the upstream node "connected" so its sources stay in the dropdown
      // The connection acts as a "link" between nodes
      
      // For recorders: check if any port maps remain, delete connection if empty
      if (type.value === 'recorder') {
        const { data: remainingMaps } = await supabase
          .from('connection_port_map')
          .select('id')
          .eq('connection_id', existingConnId)
          .limit(1)
        
        if (!remainingMaps || remainingMaps.length === 0) {
          // Check if it's a direct connection (no port maps were ever used)
          const { data: conn } = await supabase
            .from('connections')
            .select('input_number')
            .eq('id', existingConnId)
            .single()
          
          // Only delete if this was a direct connection matching this input
          if (conn && conn.input_number === Number(inputNum)) {
            await supabase
              .from('connections')
              .delete()
              .eq('id', existingConnId)
          }
        }
      }
      
      // Invalidate cache
      invalidateTableCache('connections', props.projectId)
      invalidateTableCache('graph', props.projectId)
      
      // Rebuild graph with fresh data
      graph.value = await buildGraph(props.projectId, props.locationId, props.stageHourId)
      
      // Refresh available sources and labels
      await loadAvailableUpstreamSources()
      await updateUpstreamLabels()
      
      saveStatus.value[inputNum] = 'cleared'
      setTimeout(() => { if (saveStatus.value[inputNum] === 'cleared') delete saveStatus.value[inputNum] }, 2000)
    } catch (err) {
      console.error('[Inspector] failed to clear connection', err)
      toast.error('Failed to clear connection')
    }
  } else {
    // No connection ID stored - check for direct connection by input_number
    try {
      const { data: directConn } = await supabase
        .from('connections')
        .select('id, input_number')
        .eq('project_id', props.projectId)
        .eq('to_node_id', props.node.id)
        .eq('input_number', Number(inputNum))
        .maybeSingle()
      
      if (directConn) {
        await supabase
          .from('connections')
          .delete()
          .eq('id', directConn.id)
        
        invalidateTableCache('connections', props.projectId)
        invalidateTableCache('graph', props.projectId)
        
        graph.value = await buildGraph(props.projectId, props.locationId, props.stageHourId)
        await loadAvailableUpstreamSources()
        await updateUpstreamLabels()
      }
    } catch (err) {
      console.warn('[Inspector] error checking for direct connection', err)
    }
  }
}

function clearDownstreamConnection(outputNum) {
  downstreamMap.value[outputNum] = null
  downstreamPortMap.value[outputNum] = null
  delete downstreamConnections.value[outputNum]
}

async function saveMap(onlyInputNum = null, suppressToasts = false) {
  saving.value = true
  try {
    console.log('[Inspector][Map] save:start', { node_id: props.node.id })
    
    let savedCount = 0
    let errorCount = 0
    
    // Save upstream connections
    for (const inputNum in upstreamMap.value) {
      if (onlyInputNum !== null && Number(inputNum) !== Number(onlyInputNum)) continue
      const feedKey = upstreamMap.value[inputNum] // Can be nodeId or nodeId:port or '__NO_SOURCE__'
      const existingConnId = upstreamConnections.value[inputNum]
      
      // Debug logging for all saves
      if (type.value === 'recorder') {
        console.log('[Inspector][Map] Processing track:', {
          inputNum,
          feedKey,
          existingConnId,
          willProcess: feedKey && feedKey !== '__NO_SOURCE__'
        })
      }
      
      try {
        if (feedKey && feedKey !== '__NO_SOURCE__') {
          // Parse feedKey: nodeId:port or just nodeId
          const parts = feedKey.toString().split(':')
          const nodeId = parts[0]
          const feedPort = parts.length > 1 ? Number(parts[1]) : null
          
          // Debug logging for recorder→recorder connections
          if (type.value === 'recorder') {
            console.log('[Inspector][Map] Recorder→Recorder mapping:', {
              inputNum,
              feedKey,
              nodeId,
              feedPort,
              parsedCorrectly: parts.length > 1,
              parts
            })
          }
          
          // For recorder→recorder, feedPort MUST be provided (from the feedKey)
          // If it's missing, we can't create a port mapping
          const srcNode = props.elements.find(e => e.id === nodeId)
          const srcType = srcNode ? (srcNode.gear_type || srcNode.node_type || srcNode.type || '').toLowerCase() : ''
          const isSourceRecorder = (srcType === 'recorder')
          
          if (isSourceRecorder && type.value === 'recorder' && feedPort === null) {
            console.error('[Inspector][Map] Recorder→Recorder requires feedPort in feedKey, but got:', {
              feedKey,
              parts,
              inputNum,
              nodeId
            })
            errorCount++
            continue
          }
          
          // Validate that source node exists
          if (!srcNode) {
            console.warn('[Inspector][Map] source node not found', nodeId)
            errorCount++
            continue
          }
          
          // Validate that target node (this node) exists
          if (!props.node.id) {
            console.warn('[Inspector][Map] target node has no ID')
            errorCount++
            continue
          }
          
          if (existingConnId) {
            // Check if source changed
            const { data: existing, error: fetchError } = await supabase
              .from('connections')
              .select('from_node_id')
              .eq('id', existingConnId)
              .single()
            
            if (fetchError) throw fetchError
            
            let connId = existingConnId
            
            if (existing && existing.from_node_id !== nodeId) {
              // Source changed - check if a connection with the new source already exists
              // Try multiple queries to be thorough
              let existingWithNewSource = null
              try {
                const { data } = await supabase
                  .from('connections')
                  .select('id')
                  .eq('project_id', props.projectId)
                  .eq('from_node_id', nodeId)
                  .eq('to_node_id', props.node.id)
                  .eq('input_number', Number(inputNum))
                  .maybeSingle()
                existingWithNewSource = data
              } catch (checkErr) {
                // If check fails, we'll try to update and catch the error
                console.warn('[Inspector][Map] connection check failed', checkErr)
              }
              
              if (existingWithNewSource) {
                // Connection with new source already exists - use it and delete the old one
                // Delete old connection and its port maps
                await supabase.from('connection_port_map').delete().eq('connection_id', existingConnId)
                await supabase.from('connections').delete().eq('id', existingConnId)
                
                // Use the existing connection with new source
                connId = existingWithNewSource.id
                upstreamConnections.value[inputNum] = connId
                // Invalidate cache
                invalidateTableCache('connections', props.projectId)
                invalidateTableCache('graph', props.projectId)
                // Port map will be set up below in the common code
              } else {
                  // No existing connection found - try to update, but handle duplicate key gracefully
                  const { error: updateError } = await supabase
                    .from('connections')
                    .update({ from_node_id: nodeId, location_id: props.locationId || null })
                    .eq('id', existingConnId)
                
                if (updateError) {
                  // If update fails with duplicate key, find and use existing connection
                  if (updateError.code === '23505' || updateError.code === 'PGRST116') {
                    // Try to find the existing connection (might have been created between check and update)
                    try {
                      const { data: existingConn } = await supabase
                        .from('connections')
                        .select('id')
                        .eq('project_id', props.projectId)
                        .eq('from_node_id', nodeId)
                        .eq('to_node_id', props.node.id)
                        .eq('input_number', Number(inputNum))
                        .maybeSingle()
                      
                      if (existingConn) {
                        // Use existing connection, delete old one
                        await supabase.from('connection_port_map').delete().eq('connection_id', existingConnId)
                        await supabase.from('connections').delete().eq('id', existingConnId)
                        connId = existingConn.id
                        upstreamConnections.value[inputNum] = connId
                        // Invalidate cache
                        invalidateTableCache('connections', props.projectId)
                        invalidateTableCache('graph', props.projectId)
                      } else {
                        // Couldn't find existing connection - log and skip this connection
                        console.warn('[Inspector][Map] duplicate key error but could not find existing connection', updateError)
                        // Set connId to null to skip port map update
                        connId = null
                      }
                    } catch (fetchErr) {
                      console.warn('[Inspector][Map] failed to fetch existing connection after duplicate key', fetchErr)
                      // Set connId to null to skip port map update
                      connId = null
                    }
                  } else {
                    throw updateError
                  }
                }
                // Invalidate cache after update
                invalidateTableCache('connections', props.projectId)
                invalidateTableCache('graph', props.projectId)
              }
            }
            
            // Update port map if feed port is specified (only if we have a valid connId)
            // For transformers and venue_sources, ALWAYS create port maps to preserve feed tracking
            if (connId) {
              const src = props.elements.find(e => e.id === nodeId)
              const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
              const isTransformerOrVenueSource = (srcType === 'transformer' || srcType === 'venue_sources')
              
              // Only create a port map when an explicit from_port (feedPort) is selected
              const portToUse = (feedPort !== null) ? feedPort : null
              
              if (portToUse !== null) {
                // Validate port numbers are valid
                if (isNaN(portToUse) || portToUse < 1 || isNaN(Number(inputNum)) || Number(inputNum) < 1) {
                  console.warn('[Inspector][Map] invalid port numbers', { from_port: portToUse, to_port: inputNum })
                  errorCount++
                  continue
                }
                
                // Delete any existing mapping that targets this to_port OR uses this from_port
                // This avoids violating the unique (connection_id, from_port) constraint and keeps 1:1 mapping
                let { error: deleteError } = await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('to_port', Number(inputNum))
                if (deleteError) throw deleteError
                ;({ error: deleteError } = await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('from_port', Number(portToUse)))
                if (deleteError) throw deleteError
                
                const { error: insertError } = await supabase.from('connection_port_map').insert([{
                  project_id: props.projectId,
                  connection_id: connId,
                  from_port: portToUse,
                  to_port: Number(inputNum)
                }])
                if (insertError) {
                  console.error('[Inspector][Map] failed to save port map', insertError)
                  throw insertError
                }
                // Optimistically set the selected feedKey so the dropdown shows the saved value
                upstreamMap.value[inputNum] = `${nodeId}:${portToUse}`
              } else {
                // Only remove port map if it's not a transformer or venue source
                // For regular sources, port maps aren't needed
                // But only remove port maps for this specific to_port to avoid affecting other mappings
                const { error: deleteError } = await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('to_port', Number(inputNum))
                if (deleteError) throw deleteError
              }
              savedCount++
            }
          } else {
            // Check if connection already exists (might not be in our cache)
            let connId = null
            let existingConn = null
            
            // Try to check for existing connection, but don't fail if check fails
            // For port-mapped connections (transformer/venue_source/recorder to recorder/transformer), 
            // don't require input_number in the check
            try {
              const src = props.elements.find(e => e.id === nodeId)
              const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
              const isTransformerOrVenueSource = (srcType === 'transformer' || srcType === 'venue_sources')
              const isSourceRecorder = (srcType === 'recorder')
              const isRecorderOrTransformer = (type.value === 'recorder' || type.value === 'transformer')
              // Recorder→recorder connections should always use port mappings (multi-source)
              // Don't require feedPort !== null - recorder→recorder is always port-mapped
              const isPortMapped = ((isTransformerOrVenueSource || isSourceRecorder) && isRecorderOrTransformer)
              
              let checkQuery = supabase
                .from('connections')
                .select('id')
                .eq('project_id', props.projectId)
                .eq('from_node_id', nodeId)
                .eq('to_node_id', props.node.id)
              
              // For port-mapped connections, don't filter by input_number
              if (!isPortMapped) {
                checkQuery = checkQuery.eq('input_number', Number(inputNum))
              }
              
              const { data, error: checkError } = await checkQuery.maybeSingle()
              
              if (!checkError && data) {
                existingConn = data
                // Debug logging for recorder→recorder
                if (isSourceRecorder && isRecorderOrTransformer) {
                  console.log('[Inspector][Map] Found existing recorder→recorder connection:', {
                    connection_id: data.id,
                    inputNum,
                    from_node: nodeId,
                    to_node: props.node.id
                  })
                }
              }
              // If checkError exists (like 406), we'll proceed to insert and catch duplicate key
            } catch (checkErr) {
              // Ignore check errors, we'll handle duplicates on insert
              console.warn('[Inspector][Map] connection check failed, will try insert', checkErr)
            }
            
            if (existingConn) {
              // Use existing connection
              connId = existingConn.id
              upstreamConnections.value[inputNum] = connId
              // Debug logging for recorder→recorder
              const src = props.elements.find(e => e.id === nodeId)
              const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
              const isSourceRecorder = (srcType === 'recorder')
              if (isSourceRecorder && type.value === 'recorder') {
                console.log('[Inspector][Map] Reusing existing recorder→recorder connection for track:', {
                  connection_id: connId,
                  inputNum,
                  from_node: nodeId,
                  to_node: props.node.id,
                  feedKey,
                  feedPort,
                  willCreatePortMap: feedPort !== null
                })
              }
            } else {
              // Try to create new connection
              // For transformers/venue_sources/recorders connecting to recorders/transformers, don't set input_number
              // if we're using port maps (port maps handle the mapping)
              const src = props.elements.find(e => e.id === nodeId)
              const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
              const isTransformerOrVenueSource = (srcType === 'transformer' || srcType === 'venue_sources')
              const isSourceRecorder = (srcType === 'recorder')
              const isRecorderOrTransformer = (type.value === 'recorder' || type.value === 'transformer')
              
              // For transformer/venue_source/recorder -> recorder/transformer connections:
              // - If feedPort is null (direct connection), set input_number to allow direct pass-through
              // - If feedPort is set (port-mapped), don't set input_number (port maps handle it)
              // Recorder→recorder connections should always use port mappings to support multiple tracks
              const connectionData = {
                project_id: props.projectId,
                from_node_id: nodeId,
                to_node_id: props.node.id
              }
              
              // Set input_number for:
              // 1. Simple source -> non-structured targets (always)
              // 2. Venue sources/transformers -> transformers/recorders when feedPort is null (direct connection)
              // Don't set input_number for port-mapped connections (feedPort is set)
              const isDirectConnection = feedPort === null
              const shouldSetInputNumber = !((isTransformerOrVenueSource || isSourceRecorder) && isRecorderOrTransformer) || 
                                          (isDirectConnection && (isTransformerOrVenueSource || isSourceRecorder) && isRecorderOrTransformer)
              if (shouldSetInputNumber) {
                connectionData.input_number = Number(inputNum)
              }
              
              // Debug logging for recorder→recorder
              if (isSourceRecorder && isRecorderOrTransformer) {
                console.log('[Inspector][Map] Creating new recorder→recorder connection:', {
                  connectionData,
                  inputNum,
                  feedPort,
                  willSetInputNumber: shouldSetInputNumber
                })
              }
              
              const connectionDataWithLocation = {
                ...connectionData,
                location_id: props.locationId || null
              }
              const { data: newConn, error: insertError } = await supabase
                .from('connections')
                .insert([connectionDataWithLocation])
                .select()
                .single()
              
              if (!insertError && newConn) {
                // Store the connection ID for this input
                upstreamConnections.value[inputNum] = newConn.id
                // Invalidate cache immediately after successful insert
                invalidateTableCache('connections', props.projectId)
                invalidateTableCache('graph', props.projectId)
              }
              
              if (insertError) {
                // If it's a duplicate key error, fetch the existing connection
                if (insertError.code === '23505') {
                  try {
                    // Try to find the existing connection - the constraint might be on (from_node_id, to_node_id) 
                    // or (from_node_id, to_node_id, input_number)
                    // For port-mapped connections, try without input_number first
                    const src = props.elements.find(e => e.id === nodeId)
                    const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
                    const isTransformerOrVenueSource = (srcType === 'transformer' || srcType === 'venue_sources')
                    const isSourceRecorder = (srcType === 'recorder')
                    const isRecorderOrTransformer = (type.value === 'recorder' || type.value === 'transformer')
                    // Recorder→recorder connections should always use port mappings (multi-source)
                    const isPortMapped = ((isTransformerOrVenueSource || isSourceRecorder) && isRecorderOrTransformer)
                    
                    // For port-mapped connections, try finding without input_number first
                    if (isPortMapped) {
                      const { data: existingWithoutInput } = await supabase
                        .from('connections')
                        .select('id')
                        .eq('project_id', props.projectId)
                        .eq('from_node_id', nodeId)
                        .eq('to_node_id', props.node.id)
                        .maybeSingle()
                      
                      if (existingWithoutInput) {
                        connId = existingWithoutInput.id
                        upstreamConnections.value[inputNum] = connId
                      } else {
                        throw insertError
                      }
                    } else {
                      // For non-port-mapped, try with input_number
                      const { data: existing } = await supabase
                        .from('connections')
                        .select('id')
                        .eq('project_id', props.projectId)
                        .eq('from_node_id', nodeId)
                        .eq('to_node_id', props.node.id)
                        .eq('input_number', Number(inputNum))
                        .maybeSingle()
                      
                      if (existing) {
                        connId = existing.id
                        upstreamConnections.value[inputNum] = connId
                      } else {
                        // Constraint might be on (from_node_id, to_node_id) only, try without input_number
                        const { data: existingWithoutInput } = await supabase
                          .from('connections')
                          .select('id')
                          .eq('project_id', props.projectId)
                          .eq('from_node_id', nodeId)
                          .eq('to_node_id', props.node.id)
                          .maybeSingle()
                        
                        if (existingWithoutInput) {
                          // Update the existing connection with the input_number
                          const { data: updated } = await supabase
                            .from('connections')
                            .update({ input_number: Number(inputNum) })
                            .eq('id', existingWithoutInput.id)
                            .select()
                            .single()
                          
                          if (updated) {
                            connId = updated.id
                            upstreamConnections.value[inputNum] = connId
                          } else {
                            throw insertError
                          }
                        } else {
                          throw insertError
                        }
                      }
                    }
                  } catch (fetchErr) {
                    // If we can't fetch the existing connection, log but don't throw
                    console.warn('[Inspector][Map] duplicate connection exists but could not fetch', fetchErr)
                    // Connection exists but we can't fetch it - set connId to null to skip port map handling
                    connId = null
                  }
                } else {
                  throw insertError
                }
              } else if (newConn) {
                connId = newConn.id
                upstreamConnections.value[inputNum] = connId
              }
            }
            
            // Create/update port map if feed port is specified
            // For transformers, venue_sources, and recorders, ALWAYS create port maps to preserve feed tracking
            // Recorder→recorder connections should always use port mappings to support multiple tracks
            if (connId) {
              const src = props.elements.find(e => e.id === nodeId)
              const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
              const isTransformerOrVenueSourceOrRecorder = (srcType === 'transformer' || srcType === 'venue_sources' || srcType === 'recorder')
              const isTargetRecorder = (type.value === 'recorder')
              const isSourceRecorder = (srcType === 'recorder')
              
              // Create port maps when:
              // 1. feedPort is explicitly provided (port-mapped connection)
              // 2. For recorder→recorder, always use port maps when feedPort is provided
              // 3. For venue sources/transformers → transformers/recorders, create port map if feedPort is set
              // 4. Special case: For transformers with 1 output, always create port maps to distinguish inputs
              const srcNumOutputs = srcNode ? (srcNode.num_outputs || srcNode.outputs || 0) : 0
              const isSingleOutputTransformer = (srcType === 'transformer' && srcNumOutputs === 1)
              const shouldCreatePortMap = (feedPort !== null) && 
                                        (isTransformerOrVenueSourceOrRecorder || isSingleOutputTransformer) && 
                                        (isTargetRecorder || type.value === 'transformer')
              // Only use feedPort if explicitly provided - don't use inputNum as fallback to avoid constraint violations
              const portToUse = (feedPort !== null) ? feedPort : null
              
              // Debug logging for recorder→recorder
              if (isSourceRecorder && isTargetRecorder) {
                console.log('[Inspector][Map] Port map check:', {
                  shouldCreatePortMap,
                  portToUse,
                  feedPort,
                  feedKey,
                  inputNum,
                  connId
                })
              }
              
              if (portToUse !== null && shouldCreatePortMap) {
                // Validate port numbers are valid
                if (isNaN(portToUse) || portToUse < 1 || isNaN(Number(inputNum)) || Number(inputNum) < 1) {
                  console.warn('[Inspector][Map] invalid port numbers', { from_port: portToUse, to_port: inputNum })
                  errorCount++
                  continue
                }
                
                // Delete mapping for this specific to_port (destination track) first
                await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('to_port', Number(inputNum))
                
                // Also delete any existing mapping that uses this from_port (source track)
                // This is required because the database has a unique constraint on (connection_id, from_port)
                // This means each source track can only map to one destination track per connection
                // But we can map multiple different source tracks to multiple different destination tracks
                const { error: deleteFromPortError } = await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('from_port', Number(portToUse))
                
                if (deleteFromPortError) {
                  console.warn('[Inspector][Map] failed to delete existing from_port mapping (continuing anyway)', deleteFromPortError)
                }
                
                // Debug logging for recorder→recorder
                if (isSourceRecorder && isTargetRecorder) {
                  console.log('[Inspector][Map] Creating recorder→recorder port map:', {
                    connection_id: connId,
                    from_port: portToUse,
                    to_port: inputNum,
                    feedKey,
                    feedPort
                  })
                }
                
                // Insert new port map
                const { error: portMapError } = await supabase.from('connection_port_map').insert([{
                  project_id: props.projectId,
                  connection_id: connId,
                  from_port: portToUse,
                  to_port: Number(inputNum)
                }])
                
                if (portMapError) {
                  // If it's a duplicate key error, the mapping might already exist - try to update instead
                  if (portMapError.code === '23505') {
                    console.warn('[Inspector][Map] Port map already exists (duplicate from_port), attempting update:', {
                      connection_id: connId,
                      from_port: portToUse,
                      to_port: inputNum,
                      feedKey,
                      feedPort,
                      error: portMapError
                    })
                    // Try to update the existing mapping to point to the new destination
                    const { error: updateError } = await supabase.from('connection_port_map')
                      .update({ to_port: Number(inputNum) })
                      .eq('connection_id', connId)
                      .eq('from_port', Number(portToUse))
                    
                    if (updateError) {
                      console.error('[Inspector][Map] failed to update port map', updateError)
                      throw updateError
                    }
                  } else {
                    console.error('[Inspector][Map] failed to save port map', portMapError)
                    throw portMapError
                  }
                } else {
                  // Success - log for debugging
                  if (isSourceRecorder && isTargetRecorder) {
                    console.log('[Inspector][Map] Successfully created recorder→recorder port map:', {
                      connection_id: connId,
                      from_port: portToUse,
                      to_port: inputNum
                    })
                  }
                }
                // Optimistically set the selected feedKey so the dropdown shows the saved value
                upstreamMap.value[inputNum] = `${nodeId}:${portToUse}`
                // Store connection ID
                upstreamConnections.value[inputNum] = connId
                // Invalidate cache to ensure fresh data
                invalidateTableCache('connections', props.projectId)
                invalidateTableCache('graph', props.projectId)
              } else {
                // Only remove port map if it's not a transformer or venue source
                // For regular sources, port maps aren't needed
                // But only remove port maps for this specific to_port to avoid affecting other mappings
                await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('to_port', Number(inputNum))
                // Invalidate cache
                invalidateTableCache('connections', props.projectId)
                invalidateTableCache('graph', props.projectId)
              }
              savedCount++
            }
          }
        } else if (existingConnId) {
          // Clear only this input's mapping. Delete the connection only if no maps remain.
          await supabase.from('connection_port_map')
            .delete()
            .eq('connection_id', existingConnId)
            .eq('to_port', Number(inputNum))
          // Check if any port maps remain for this connection
          const { data: remainingMaps } = await supabase
            .from('connection_port_map')
            .select('id')
            .eq('connection_id', existingConnId)
            .limit(1)
          if (!remainingMaps || remainingMaps.length === 0) {
            await supabase.from('connections').delete().eq('id', existingConnId)
            delete upstreamConnections.value[inputNum]
          }
          // Invalidate cache
          invalidateTableCache('connections', props.projectId)
          invalidateTableCache('graph', props.projectId)
          savedCount++
        }
      } catch (err) {
        console.error('[Inspector][Map] error saving upstream connection', inputNum, err)
        errorCount++
      }
    }
    
    // Note: Downstream connections are managed by configuring the receiving node's inputs
    // No need to save them from this node
    
    // Invalidate cache before refresh to ensure we get fresh data
    if (savedCount > 0) {
      invalidateTableCache('connections', props.projectId)
      invalidateTableCache('graph', props.projectId)
      invalidateTableCache('port_maps', props.projectId)
    }
    
    // Refresh graph and reload available sources to update dropdown labels
    await refresh()
    await loadAvailableUpstreamSources()
    await updateUpstreamLabels()
    
    console.log('[Inspector][Map] save:done', { savedCount, errorCount, onlyInputNum })
    if (!suppressToasts) {
      if (errorCount > 0) {
        toast.error(`Failed to save ${errorCount} input connection(s)`) 
      } else if (savedCount > 0) {
        toast.success(`Saved ${savedCount} input mapping(s)`) 
      } else {
        toast.info('No changes to save')
      }
    }
    return { savedCount, errorCount }
  } catch (err) {
    console.error('[Inspector][Map] save failed', err)
    toast.error('Failed to save map: ' + (err.message || 'Unknown error'))
    return { savedCount: 0, errorCount: 1 }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* ─── Overlay + card ──────────────────────────────────── */
.inspector-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  animation: ni-fade 140ms ease-out;
}
@keyframes ni-fade { from { opacity: 0; } to { opacity: 1; } }
.inspector {
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: hidden;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  animation: ni-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes ni-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

/* ─── Header ──────────────────────────────────────────── */
.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: capitalize;
  letter-spacing: 0.04em;
  background: var(--chip-bg-active);
  color: var(--chip-text-active);
  flex-shrink: 0;
}
h3 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: uppercase;
}
.editable-label {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  min-width: 0;
  width: 100%;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
  font-family: inherit;
}
.editable-label:hover { border-color: var(--surface-border-strong); }
.editable-label:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
  text-transform: none;
}
.editable-label:disabled { opacity: 0.65; cursor: not-allowed; }
.editable-label.saving { border-color: var(--color-success-500); }
.close-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xl);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  flex-shrink: 0;
}
.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border);
}

/* ─── Meta row ────────────────────────────────────────── */
.meta {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  flex-shrink: 0;
}
.meta span {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: var(--chip-bg);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  font-variant-numeric: tabular-nums;
}

/* ─── Tabs (segmented control) ────────────────────────── */
.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin: 0 var(--space-4) var(--space-3);
  background: var(--chip-bg);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}
.tabs button {
  flex: 1;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  padding: 7px 14px;
  border-radius: calc(var(--radius-lg) - 3px);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: background var(--transition-normal), color var(--transition-normal);
  min-height: 32px;
}
.tabs button:hover { color: var(--text-primary); }
.tabs button.active {
  background: var(--surface-card);
  color: var(--text-heading);
  font-weight: var(--font-semibold);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.tabs button.tab-delete { color: var(--color-error-600); }
.tabs button.tab-delete:hover { color: var(--color-error-700); }
.tabs button.tab-delete.active {
  background: var(--color-error-50);
  color: var(--color-error-700);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
:deep(.dark) .tabs button.tab-delete.active {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-error-200);
}

/* ─── Panel wrapper ───────────────────────────────────── */
.panel {
  padding: 0 var(--space-4) var(--space-4);
  overflow-y: auto;
  flex: 1;
}

/* ─── Buttons ─────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-primary-500);
  color: #ffffff;
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  min-height: 36px;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.btn:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.btn:disabled {
  background: var(--chip-bg);
  color: var(--text-tertiary);
  border-color: transparent;
  cursor: not-allowed;
  box-shadow: none;
}
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  min-height: 34px;
  transition: background var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal);
}
.btn-secondary:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
  color: var(--text-primary);
}
.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-error-500);
  color: #ffffff;
  border: 1px solid var(--color-error-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  min-height: 36px;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.btn-danger:hover:not(:disabled) {
  background: var(--color-error-600);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
}
.btn-danger:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-danger-small {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: transparent;
  color: var(--color-error-600);
  border: 1px solid var(--color-error-200);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-weight: var(--font-medium);
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  margin-top: 4px;
}
.btn-danger-small:hover {
  background: var(--color-error-50);
  border-color: var(--color-error-300);
  color: var(--color-error-700);
}
.clear-x-btn {
  background: transparent;
  border: none;
  color: var(--color-error-500);
  margin-left: 8px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-normal), color var(--transition-normal);
}
.clear-x-btn:hover {
  background: var(--color-error-50);
  color: var(--color-error-700);
}
.btn-refresh {
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  padding: 5px 10px !important;
  font-size: var(--text-xs) !important;
  background: var(--surface-card-muted) !important;
  border: 1px solid var(--surface-border) !important;
  border-radius: var(--radius-md) !important;
  color: var(--text-secondary) !important;
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.btn-refresh:hover {
  background: var(--surface-hover) !important;
  color: var(--text-primary) !important;
  border-color: var(--surface-border-strong) !important;
}

/* ─── Inputs & selects ────────────────────────────────── */
.select,
.input {
  background: var(--surface-card);
  color: var(--text-primary);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: var(--text-sm);
  min-height: 38px;
  font-family: inherit;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}
.select:hover,
.input:hover { border-color: var(--surface-border-strong); }
.select:focus,
.input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ─── Map layout ──────────────────────────────────────── */
.map-unified {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
  align-items: start;
  padding-top: var(--space-2);
}
.map-section { display: flex; flex-direction: column; }
.map-section h4 {
  margin: 0 0 10px 0;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.map-inputs,
.map-outputs { display: flex; flex-direction: column; gap: 8px; }

/* Each input/output row */
.map-io-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  position: relative;
  transition: border-color var(--transition-normal);
}
.map-io-row:hover { border-color: var(--surface-border-strong); }
.map-io-label {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.map-io-display {
  color: var(--text-primary);
  font-size: var(--text-sm);
  margin-top: 4px;
  flex: 1;
}
.save-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--color-success-700);
  background: color-mix(in srgb, var(--color-success-500) 12%, transparent);
  font-size: 11px;
  font-weight: var(--font-medium);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-top: 2px;
  align-self: flex-start;
}

/* Node summary card */
.map-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: var(--surface-card-muted);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-lg);
  text-align: center;
  min-height: 140px;
}
.map-node-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: capitalize;
  letter-spacing: 0.04em;
  background: var(--chip-bg);
  color: var(--text-tertiary);
  margin-bottom: 8px;
}
.map-node-name {
  color: var(--text-heading);
  font-weight: var(--font-bold);
  font-size: var(--text-sm);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: -0.01em;
}
.map-node-hint {
  font-size: 11px !important;
  color: var(--text-tertiary) !important;
  margin-top: var(--space-2) !important;
  max-width: 30ch;
  line-height: 1.4;
}

/* Legacy/feed rows */
.map-row,
.feed-row {
  display: grid;
  grid-template-columns: 100px 1fr 120px;
  gap: 8px;
  align-items: center;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  margin-bottom: 8px;
}
.map-left,
.feed-left {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.map-mid {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
}
.feeds-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

/* ─── Delete tab ──────────────────────────────────────── */
.delete-warning {
  padding: var(--space-4);
  background: var(--color-error-50);
  border: 1px solid var(--color-error-200);
  border-left: 3px solid var(--color-error-500);
  border-radius: var(--radius-md);
  color: var(--color-error-900);
}
.delete-warning p { margin: 0; color: var(--color-error-900); font-size: var(--text-sm); line-height: 1.5; }
.delete-warning p + p { margin-top: 6px; }
.delete-warning strong { color: var(--color-error-900); font-weight: var(--font-semibold); }
:deep(.dark) .delete-warning {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-error-200);
}
:deep(.dark) .delete-warning p,
:deep(.dark) .delete-warning strong { color: var(--color-error-200); }

/* ─── Misc bits ───────────────────────────────────────── */
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.list li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
}
.muted {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  padding: var(--space-2) 0;
  font-style: italic;
}
.k { color: var(--text-tertiary); font-size: var(--text-xs); }
.v { color: var(--text-primary); font-weight: var(--font-semibold); }
.arrow { color: var(--color-primary-500); font-weight: var(--font-bold); }
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--surface-border);
}

/* ─── Mobile: full-height sheet ───────────────────────── */
@media (max-width: 640px) {
  .inspector-overlay { padding: 0; align-items: flex-end; }
  .inspector {
    width: 100%;
    max-height: 92vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    animation: ni-sheet 200ms cubic-bezier(0.25, 0.8, 0.35, 1);
  }
  @keyframes ni-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .inspector-header { padding: var(--space-3); }
  .tabs { margin: 0 var(--space-3) var(--space-3); }
  .panel { padding: 0 var(--space-3) var(--space-4); }
  .meta { padding: var(--space-2) var(--space-3); }
  .map-row, .feed-row { grid-template-columns: 1fr; }
  .map-left, .feed-left {
    padding-bottom: 2px;
    border-bottom: 1px solid var(--surface-border);
  }
}

@media (prefers-reduced-motion: reduce) {
  .inspector-overlay,
  .inspector { animation: none; }
}
</style>


