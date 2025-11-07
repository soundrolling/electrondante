<template>
  <!-- copied from components/signalmapper/NodeInspector.vue (consolidated under src/components) -->
  <div class="inspector-overlay" @click="emit('close')">
    <div class="inspector" @click.stop>
      <div class="inspector-header">
        <div class="title">
          <span class="badge">{{ type }}</span>
          <h3>{{ node.track_name || node.label }}</h3>
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
              <h4>{{ type === 'recorder' ? 'Record Tracks' : 'Inputs' }}</h4>
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
                    <option v-for="src in availableUpstreamSources" :key="src.feedKey" :value="src.feedKey">{{ src.label }}</option>
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
              <div class="map-node-name">{{ node.track_name || node.label }}</div>
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
        <div style="display:grid; grid-template-columns: 160px 1fr; align-items:center; gap:10px;">
          <label style="font-weight:600; color: var(--text-secondary);">Pad (dB)</label>
          <input class="input" type="number" v-model.number="sourcePadDb" step="1" min="-60" max="0" placeholder="0" />
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
import { getCompleteSignalPath, deleteNode, getConnections, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'
import { updateNode } from '@/services/signalMapperService'

const toast = useToast()

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  node: { type: Object, required: true },
  elements: { type: Array, default: () => [] },
  fromNode: { type: Object, default: null },
  // Optional: if provided, will check if node can be deleted from this view
  viewType: { type: String, default: null } // 'signal-flow' or 'mic-placement'
})
const emit = defineEmits(['close', 'node-deleted'])

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
// Transformer input gain tracking
const inputGain = ref({}) // { inputNumber: gainDb }
// Delete state
const deleting = ref(false)

onMounted(async () => {
  // Initialize sourcePadDb from node if present
  if (type.value === 'source') {
    const pad = props.node?.pad_db
    sourcePadDb.value = typeof pad === 'number' ? pad : 0
  }
  // Load transformer input gain values
  if (type.value === 'transformer') {
    await loadInputGain()
  }
})

async function saveSourceSettings() {
  try {
    const padDb = Number(sourcePadDb.value) || 0
    await updateNode({ id: props.node.id, pad_db: padDb })
    // Optimistically update local node
    props.node.pad_db = padDb
    toast.success('Source settings saved')
  } catch (e) {
    console.error('[Inspector][Settings] failed to save source settings', e)
    toast.error('Failed to save settings')
  }
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

  // Delete all outgoing and incoming connections (but keep the nodes they connect to)
  for (const conn of [...outgoingConns, ...incomingConns]) {
    try {
      await deleteConnectionFromDB(conn.id)
    } catch (err) {
      console.error('Error deleting connection:', err)
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

async function loadAvailableUpstreamSources() {
  if (!graph.value) {
    availableUpstreamSources.value = []
    return
  }
  
  // Recorders should only list sources from nodes that are actually connected upstream
  const isRecorder = type.value === 'recorder'
  
  // Get all connections to this node (used to track which ports are connected)
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  
  // For recorders, we want to show ALL recorders as potential sources (for recorder→recorder connections)
  // For other node types, only show connected sources
  const showAllRecorders = isRecorder
  
  // Only show connected sources for non-recorders; if there are no incoming connections, nothing to select
  if (!showAllRecorders && parents.length === 0) {
    availableUpstreamSources.value = []
    return
  }
  
  // Build a map of connected node IDs and their connected ports
  // Format: { nodeId: Set<port> } or { nodeId: null } for non-port-mapped sources
  const connectedNodes = new Map()
  
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
      // For transformers without port maps, we need to show all outputs
      // Since we don't know which specific output port was used, show all
      // This allows transformers to pass through their sources even without explicit port maps
      const numOutputs = srcNode.num_outputs || srcNode.outputs || 0
      if (numOutputs > 0) {
        connectedPorts = new Set(Array.from({ length: numOutputs }, (_, i) => i + 1))
      } else if (p.input_number) {
        // Fallback: if transformer has no num_outputs, infer from input_number (1:1 pass-through)
        connectedPorts = new Set([Number(p.input_number)])
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
    }
    // If no port maps and not a transformer/recorder, connectedPorts stays null (means single output source)
    
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
  // For other nodes, only show connected sources
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
      // For other nodes: only show connected feeds
      try {
        const { data: feeds } = await supabase
          .from('venue_source_feeds')
          .select('port_number, output_port_label')
          .eq('node_id', e.id)
          .order('port_number')
        
        if (feeds && feeds.length) {
          // When a Venue Sources node is connected, always expose ALL feeds
          for (const feed of feeds) {
            const port = feed.port_number
            sources.push({
              id: e.id,
              port,
              label: `${feed.output_port_label || `Output ${port}`} (Venue)`,
              feedKey: `${e.id}:${port}`
            })
          }
        } else {
          // Fallback: use output_port_labels if feeds table is empty
          const labels = e.output_port_labels || {}
          const numOutputs = e.num_outputs || 0
          for (let port = 1; port <= numOutputs; port++) {
            // If feeds table is empty, expose all labeled outputs
            const label = labels[port] || `Output ${port}`
            sources.push({
              id: e.id,
              port,
              label: `${label} (Venue)`,
              feedKey: `${e.id}:${port}`
            })
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
      // For other nodes: only show connected outputs
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
        // Show all outputs that correspond to mapped inputs
        for (let port = 1; port <= numOutputs; port++) {
          if (!mappedInputs.has(port)) continue
          try {
            const label = await getOutputLabel(e, port, graph.value)
            if (label && String(label).trim().length > 0) {
              sources.push({
                id: e.id,
                port,
                label: `${label} (Transformer ${e.track_name || e.label || ''})`.trim(),
                feedKey: `${e.id}:${port}`
              })
            }
          } catch (err) {
            // skip unmapped/unknown
          }
        }
      }
    } else if (eType === 'recorder') {
      // Recorders can output to other nodes (recorder-to-recorder or recorder-to-transformer)
      // Show ALL tracks from recorders as available outputs (not just connected ones)
      // This allows backup recorders to see all tracks from primary recorders
      const numTracks = e.num_tracks || e.tracks || e.num_records || e.numrecord || 0
      const numOutputs = e.num_outputs || e.outputs || numTracks // Use num_outputs if set, otherwise tracks
      const tracksToShow = Math.max(numTracks, numOutputs) // Show all available tracks/outputs
      
      // For recorder→recorder connections, ALWAYS show all tracks (multi-source support)
      // This allows adding multiple tracks from the same source recorder
      // For other node types, only show connected ports
      const shouldShowAll = showAllRecorders // Always show all tracks when target is a recorder
      const portsToShow = shouldShowAll 
        ? Array.from({ length: tracksToShow }, (_, i) => i + 1)
        : (connectedPortsSet ? Array.from(connectedPortsSet) : [])
      
      if (portsToShow.length > 0) {
        for (const port of portsToShow) {
          // Get the label for this recorder track output (traces back to original source)
          try {
            const label = await getOutputLabel(e, port, graph.value)
            // If we got a traced source name, use it directly; otherwise show track number
            if (label && label !== `Track ${port}`) {
              sources.push({
                id: e.id,
                port,
                label: label, // Show original source name (e.g., "Microphone 1", "Guitar L")
                feedKey: `${e.id}:${port}`
              })
            } else {
              // Fallback: no source traced, show track number with recorder name
              sources.push({
                id: e.id,
                port,
                label: `Track ${port} (${e.track_name || e.label || 'Recorder'})`,
                feedKey: `${e.id}:${port}`
              })
            }
          } catch (err) {
            // Fallback if label resolution fails
            sources.push({
              id: e.id,
              port,
              label: `Track ${port} (${e.track_name || e.label || 'Recorder'})`,
              feedKey: `${e.id}:${port}`
            })
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
  graph.value = await buildGraph(props.projectId)
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
      const inferredPort = null
      const usePortInFeedKey = (srcType === 'venue_sources' || srcType === 'transformer' || srcType === 'recorder') && inferredPort
      const feedKey = usePortInFeedKey ? `${p.from_node_id}:${inferredPort}` : p.from_node_id
      upstreamMap.value[inputNum] = feedKey
      const portForLabel = null
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
          await supabase.from('connections').insert([{ project_id: props.projectId, from_node_id: upstream.id, to_node_id: toNodeId, input_number: Number(chosen) }])
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
          .insert([{ project_id: props.projectId, from_node_id: upstream.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
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
          .insert([{ project_id: props.projectId, from_node_id: props.node.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
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
  console.log('[Inspector][Tracks] load:start', { project_id: props.projectId })
  const all = await getCompleteSignalPath(props.projectId)
  const here = all.filter(p => p.recorderId === props.node.id)
  trackList.value = here.map(p => ({ key: `${p.recorderId}:${p.track}`, track: p.track, source: p.sourceLabel }))
  console.log('[Inspector][Tracks] load:done', { count: trackList.value.length })
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
  // Autosave per-input for transformers and recorders; keeps UI in sync
  try {
    const feedKey = upstreamMap.value[inputNum]
    if (type.value === 'recorder') {
      console.log('[Inspector][Change] Track selection changed:', {
        inputNum,
        feedKey,
        feedKeyType: typeof feedKey,
        isNoSource: feedKey === '__NO_SOURCE__'
      })
    }
    const result = await saveMap(inputNum, true)
    // After save/refresh, force a focused reload of upstream sources and labels to update the dropdown text
    await loadAvailableUpstreamSources()
    await updateUpstreamLabels()
    if (result && result.savedCount > 0 && result.errorCount === 0) {
      saveStatus.value[inputNum] = 'saved'
      setTimeout(() => { if (saveStatus.value[inputNum] === 'saved') delete saveStatus.value[inputNum] }, 2000)
    } else if (type.value === 'recorder') {
      console.warn('[Inspector][Change] Save failed or nothing saved:', {
        inputNum,
        feedKey,
        result
      })
    }
  } catch (err) {
    if (type.value === 'recorder') {
      console.error('[Inspector][Change] Error saving track:', {
        inputNum,
        feedKey: upstreamMap.value[inputNum],
        error: err
      })
    }
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

async function clearUpstreamConnection(inputNum) {
  upstreamMap.value[inputNum] = '__NO_SOURCE__'
  delete upstreamConnections.value[inputNum]
  
  // Also clear gain value for transformer inputs
  if (type.value === 'transformer') {
    delete inputGain.value[inputNum]
    // Delete from database
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
  
  try {
    const result = await saveMap(inputNum, true)
    await loadAvailableUpstreamSources()
    await updateUpstreamLabels()
    if (result && result.errorCount === 0) {
      saveStatus.value[inputNum] = 'cleared'
      setTimeout(() => { if (saveStatus.value[inputNum] === 'cleared') delete saveStatus.value[inputNum] }, 2000)
    }
  } catch {}
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
                // Port map will be set up below in the common code
              } else {
                // No existing connection found - try to update, but handle duplicate key gracefully
                const { error: updateError } = await supabase
                  .from('connections')
                  .update({ from_node_id: nodeId })
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
              
              // For transformer/venue_source/recorder -> recorder/transformer connections, do NOT set input_number
              // even if feedPort is null. We want an unassigned connection until the user selects a port.
              // Recorder→recorder connections should always use port mappings to support multiple tracks
              const connectionData = {
                project_id: props.projectId,
                from_node_id: nodeId,
                to_node_id: props.node.id
              }
              
              // Only set input_number for simple source -> non-structured targets
              // Recorder→recorder should always use port mappings (multi-source)
              const shouldSetInputNumber = !((isTransformerOrVenueSource || isSourceRecorder) && isRecorderOrTransformer)
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
              
              const { data: newConn, error: insertError } = await supabase
                .from('connections')
                .insert([connectionData])
                .select()
                .single()
              
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
              
              // For recorder→recorder, always create port maps when feedPort is provided
              // For other types, only create when an explicit from_port (feedPort) is selected
              const shouldCreatePortMap = isTransformerOrVenueSourceOrRecorder && (isTargetRecorder || type.value === 'transformer')
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
              } else {
                // Only remove port map if it's not a transformer or venue source
                // For regular sources, port maps aren't needed
                // But only remove port maps for this specific to_port to avoid affecting other mappings
                await supabase.from('connection_port_map')
                  .delete()
                  .eq('connection_id', connId)
                  .eq('to_port', Number(inputNum))
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
          savedCount++
        }
      } catch (err) {
        console.error('[Inspector][Map] error saving upstream connection', inputNum, err)
        errorCount++
      }
    }
    
    // Note: Downstream connections are managed by configuring the receiving node's inputs
    // No need to save them from this node
    
    await refresh()
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
.inspector-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; }
.inspector { background: var(--bg-primary); color: var(--text-primary); width: 720px; max-width: 95vw; max-height: 85vh; overflow: auto; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
.inspector-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--border-separator); }
.title { display: flex; gap: 10px; align-items: center; }
.badge { background: var(--bg-elevated); border: 1px solid var(--border-medium); padding: 2px 8px; border-radius: 999px; font-size: 12px; color: var(--text-secondary); }
h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
.close-btn { background: transparent; border: none; color: var(--text-secondary); font-size: 22px; cursor: pointer; }
.meta { display: flex; gap: 12px; padding: 10px 18px; color: var(--text-secondary); font-size: 12px; }
.tabs { display: flex; gap: 6px; padding: 0 18px 8px 18px; border-bottom: 1px solid var(--border-separator); }
.tabs button { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-medium); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.tabs button.active { background: var(--bg-secondary); border-color: var(--border-dark); }
.tabs button.tab-delete { color: #dc2626; border-color: #dc2626; }
.tabs button.tab-delete:hover { background: #fee2e2; }
.tabs button.tab-delete.active { background: #fee2e2; border-color: #dc2626; }
.delete-warning { padding: 16px; background: #991b1b; border: 1px solid #7f1d1d; border-radius: 8px; color: white !important; }
.delete-warning p { margin: 0; color: white !important; }
.delete-warning strong { color: white !important; }
.delete-warning * { color: white !important; }
.btn-danger { background: #dc2626 !important; color: white !important; border: 1px solid #dc2626 !important; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
.btn-danger:hover:not(:disabled) { background: #b91c1c !important; border-color: #b91c1c !important; }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; background: #dc2626 !important; }
.btn-secondary { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-medium); padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.btn-secondary:hover { background: var(--bg-elevated); }
.panel { padding: 14px 18px 18px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.list li { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border-separator); border-radius: 6px; padding: 8px 10px; }
.muted { color: var(--text-muted); font-size: 12px; padding: 8px 0; }
.k { color: var(--text-secondary); }
.v { color: var(--text-primary); font-weight: 600; }
.arrow { color: var(--text-link); font-weight: 700; }
.map-unified { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: start; }
.map-section { display: flex; flex-direction: column; }
.map-section h4 { margin: 0 0 12px 0; color: var(--text-primary); font-size: 14px; }
.map-inputs, .map-outputs { display: flex; flex-direction: column; gap: 8px; }
.map-io-row { display: flex; flex-direction: column; gap: 4px; background: var(--bg-elevated); border: 1px solid var(--border-separator); padding: 8px 10px; border-radius: 6px; position: relative; }
.map-io-label { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.map-io-display { color: var(--text-primary); font-size: 12px; margin-top: 4px; flex: 1; }
.btn-danger-small { background: var(--btn-danger-bg); color: var(--btn-danger-text); border: 1px solid var(--btn-danger-border); border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; margin-top: 4px; }
.btn-danger-small:hover { background: var(--btn-danger-hover-bg); border-color: var(--btn-danger-hover-border); }
.clear-x-btn { background: transparent; border: none; color: #d33; margin-left: 8px; font-size: 14px; line-height: 1; cursor: pointer; padding: 0 4px; }
.clear-x-btn:hover { color: #b00; }
.save-indicator { color: #2e7d32; font-size: 11px; margin-top: 4px; }
.map-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: var(--bg-elevated); border: 2px solid var(--border-dark); border-radius: 8px; min-width: 150px; }
.map-node-badge { background: var(--bg-primary); border: 1px solid var(--border-medium); padding: 4px 12px; border-radius: 999px; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.map-node-name { color: var(--text-primary); font-weight: 600; font-size: 14px; text-align: center; }
.map-row, .feed-row { display: grid; grid-template-columns: 100px 1fr 120px; gap: 8px; align-items: center; background: var(--bg-elevated); border: 1px solid var(--border-separator); padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; }
.map-left, .feed-left { color: var(--text-secondary); }
.map-mid { color: var(--text-primary); font-weight: 600; }
.select, .input { background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-medium); border-radius: 6px; padding: 6px 8px; }
.actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.btn { background: var(--btn-positive-bg); color: var(--btn-positive-text); border: 1px solid var(--btn-positive-border); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
.btn:hover { background: var(--btn-positive-hover-bg); border-color: var(--btn-positive-hover-border); }
.btn:disabled { background: var(--bg-tertiary); color: var(--text-tertiary); cursor: not-allowed; }
.feeds-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.btn-secondary { background: transparent; color: var(--text-link); border: 1px solid var(--text-link); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.btn-danger { background: #dc2626 !important; color: white !important; border: 1px solid #dc2626 !important; border-radius: 6px; padding: 6px 8px; cursor: pointer; }
.btn-danger:hover { background: #b91c1c !important; border-color: #b91c1c !important; }
</style>


