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
      ➕ Add Venue Sources
    </button>
    <div class="toolbar-divider"></div>
    <span class="node-count">
      Sources: {{ sourceCount }} | Transformers: {{ transformerCount }} | Recorders: {{ recorderCount }}
    </span>
    <button class="tool-btn" @click="exportToPDF" title="Export signal flow as PDF">
      📄 Export PDF
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

  <!-- Connection Type Legend -->
  <div class="connection-legend">
    <div class="legend-title">Connection Types:</div>
    <div class="legend-items">
      <div v-for="type in connectionTypes" :key="type" class="legend-item">
        <span 
          class="legend-color" 
          :style="{ backgroundColor: getConnectionColor(type) }"
        ></span>
        <span class="legend-label">{{ type }}</span>
      </div>
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
    <!-- Connection Details Modal (Read-Only) -->
    <div 
      v-if="selectedConnectionId" 
      class="modal-overlay"
      @click.self="selectedConnectionId = null"
    >
      <div class="connection-details-modal" @click.stop>
        <div class="connection-details-header">
          <h4>Connection Details</h4>
          <button @click="selectedConnectionId = null" class="close-btn">×</button>
        </div>
        <div class="connection-details-body">
          <div class="detail-row">
            <span class="label">From:</span>
            <span class="value">{{ getNodeLabelById(selectedConn?.from_node_id) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">To:</span>
            <span class="value">{{ getNodeLabelById(selectedConn?.to_node_id) }}</span>
          </div>
          <!-- Only show input_number if connection doesn't use port maps -->
          <template v-if="selectedConn?.input_number && !selectedConnHasPortMaps">
            <div class="detail-row">
              <span class="label">Input:</span>
              <span class="value">{{ selectedConn.input_number }}</span>
            </div>
          </template>
          <!-- Show port map info if connection uses port maps -->
          <template v-if="selectedConnHasPortMaps">
            <div class="detail-row">
              <span class="label">Port Mapping:</span>
              <span class="value">Multiple ports mapped</span>
            </div>
          </template>
          <!-- Signal Type Selector -->
          <div style="margin-top: 16px; display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 8px;">
            <label style="font-weight: 600; color: var(--text-secondary);">Signal Type</label>
            <select v-model="editType" class="select" style="padding: 8px; border-radius: 6px; border: 1px solid var(--border);"><option v-for="t in connectionTypes" :key="t" :value="t">{{ t }}</option></select>
          </div>
          <div class="detail-actions" style="margin-top: 16px; display: flex; gap: 8px; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; color: var(--text-muted);">Legend color:</span>
              <span :style="{ width: '16px', height: '16px', backgroundColor: getConnectionColor(editType), display: 'inline-block', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)'}"></span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn" @click="saveSelectedConnection">Save</button>
              <button class="btn-delete" @click="deleteSelectedConnection">Delete Connection</button>
            </div>
          </div>
        </div>
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
        <h3>Add Venue Sources</h3>
        <button @click="closeSourceModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="venue-sources-info">
          <p>Create a master node to manage all venue sources (DJ feeds, Program sources, etc.) in one place.</p>
          <p class="warning-text" v-if="hasVenueSourcesNode">
            ⚠️ A Venue Sources node already exists. Click on it to configure feeds.
          </p>
        </div>
        <div class="gear-list">
          <div 
            v-if="!hasVenueSourcesNode"
            @click="addSourceNode(venueSourcePreset)"
            class="gear-item venue-sources-item"
          >
            <div class="gear-icon">🎛️</div>
            <div class="gear-info">
              <div class="gear-name">Venue Sources</div>
              <div class="gear-details">Master hub for all venue sources</div>
            </div>
          </div>
          <div v-else class="venue-sources-exists">
            <p>Venue Sources node already exists. Click on it in the signal flow to configure feeds.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Legacy connection modal removed: use NodeInspector instead -->
  <NodeInspector
    v-if="inspectorOpen && inspectorNode"
    :projectId="projectId"
    :node="inspectorNode"
    :fromNode="inspectorFromNode"
    :elements="nodes"
    viewType="signal-flow"
    @close="inspectorOpen = false; inspectorNode = null"
    @node-deleted="handleInspectorNodeDeleted"
  />
  
  <!-- Venue Sources Configuration Modal -->
  <VenueSourcesConfigModal
    v-if="showVenueSourcesConfig && selectedVenueSourcesNode"
    :nodeId="selectedVenueSourcesNode.id"
    :projectId="projectId"
    @saved="handleVenueSourcesSaved"
    @close="showVenueSourcesConfig = false"
  />

  <!-- Input Modal -->
  <InputModal
    :show="showInputModal"
    :title="inputModalConfig.title"
    :message="inputModalConfig.message"
    :label="inputModalConfig.label"
    v-model="inputModalValue"
    :placeholder="inputModalConfig.placeholder"
    :confirm-text="inputModalConfig.confirmText"
    :cancel-text="inputModalConfig.cancelText"
    @confirm="handleInputConfirm"
    @cancel="handleInputCancel"
  />
</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { buildGraph } from '@/services/signalGraph'
import { getOutputLabel as svcGetOutputLabel, resolveTransformerInputLabel as svcResolveTransformerInputLabel, hydrateVenueLabels } from '@/services/portLabelService'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { addNode, updateNode, deleteNode, addConnection as addConnectionToDB, updateConnection, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'
import { jsPDF } from 'jspdf'
// Legacy modal removed; inspector-based editing is used instead
// import ConnectionDetailsModal from './ConnectionDetailsModal.vue'
import NodeInspector from '@/components/signalmapper/NodeInspector.vue'
import InputModal from '@/components/signalmapper/InputModal.vue'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  connections: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] },
  initialSelectedConnectionId: { type: [String, Number], default: null }
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
const canvasHeight = ref(800)
const canvasStyle = computed(() => 
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; transform-origin: top left;`
)

// Tool state
const tool = ref('select')
const linkSource = ref(null)
const selectedNode = ref(null)
const selectedConnectionId = ref(null)
// Inspector state
const inspectorOpen = ref(false)
const inspectorNode = ref(null)
const inspectorFromNode = ref(null)
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
const editingIdx = ref(null)
const editFromPort = ref(null)
const editToPort = ref(null)
// Venue Sources: Text input for feed label
const venueSourceLabelInput = ref('')
// Venue Sources: Track next available port number (all feeds are mono)
let venueSourceNextPort = 1
// Upstream source labels for selected connection's FROM transformer
const upstreamLabelsForFromNode = ref({})
const graphRef = ref(null)
// Store recorder track names (track number -> source label) for the FROM recorder when editing
const recorderTrackNamesForEdit = ref({})
const draggingNode = ref(null)
let dragStart = null // { x, y, node } or null - tracks potential drag start

// Zoom state
const zoomLevel = ref(1.0)
const minZoom = 0.25
const maxZoom = 4.0
const zoomStep = 0.25

// Modal state
const showGearModal = ref(false)
const showSourceModal = ref(false)
const showConnectionModal = ref(false)
const showVenueSourcesConfig = ref(false)
const selectedVenueSourcesNode = ref(null)
const pendingConnection = ref(null)
const gearFilter = ref('Transformers')
const submittingConnection = ref(false)

// Input modal state
const showInputModal = ref(false)
const inputModalValue = ref('')
const inputModalConfig = ref({
  title: 'Enter Value',
  message: '',
  label: '',
  placeholder: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  onConfirm: null
})

// Connection type colors - chosen for good contrast with light background (#f8f9fa)
const connectionTypeColors = {
  'Mic': '#dc3545',      // Red
  'Line': '#007bff',     // Blue
  'Dante': '#28a745',    // Green
  'Midi': '#ffc107',     // Yellow/Amber
  'Madi': '#6f42c1'      // Purple
}

// Default color for connections without a type
const defaultConnectionColor = '#6c757d' // Gray

// Connection types list for legend
const connectionTypes = ['Mic', 'Line', 'Dante', 'Midi', 'Madi']

// Function to get color for connection type
function getConnectionColor(type) {
  return connectionTypeColors[type] || defaultConnectionColor
}

// Node counts
const sourceCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.type) === 'source').length
)
const transformerCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.type) === 'transformer').length
)
const recorderCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.type) === 'recorder').length
)

// Available gear for modal
const availableGear = computed(() => {
  const filterType = gearFilter.value === 'Transformers' ? 'transformer' : 'recorder'
  return props.gearList.filter(g => 
    g.gear_type === filterType && g.assignments?.[props.locationId] > 0
  )
})

// Venue Sources preset - only one type now
const venueSourcePreset = { key: 'venue_sources', name: 'Venue Sources', outputs: 0, category: 'Master', isVenueSources: true }

// Check if Venue Sources node already exists
const hasVenueSourcesNode = computed(() => {
  return props.nodes.some(n => 
    n.gear_type === 'venue_sources' || (n.type === 'venue_sources')
  )
})

// Combined nodes for modal
const allNodesForModal = computed(() => props.nodes)

const selectedConn = computed(() => props.connections.find(c => c.id === selectedConnectionId.value) || null)

// Cache for port map checks
const portMapCache = ref(new Map()) // Map<connId, boolean>
const selectedConnHasPortMaps = ref(false)

// Async function to check if connection has port maps
// Uses cached graph data first, then cache, then DB query as fallback
async function checkPortMapsForConnection(connId) {
  if (!connId) {
    selectedConnHasPortMaps.value = false
    return false
  }
  
  // First check cache
  if (portMapCache.value.has(connId)) {
    const hasMaps = portMapCache.value.get(connId)
    selectedConnHasPortMaps.value = hasMaps
    return hasMaps
  }
  
  // Try to use graph cache if available
  if (graphRef.value?.mapsByConnId) {
    const portMaps = graphRef.value.mapsByConnId[connId] || []
    const hasMaps = portMaps.length > 0
    portMapCache.value.set(connId, hasMaps)
    selectedConnHasPortMaps.value = hasMaps
    return hasMaps
  }
  
  // Fallback to DB query only if graph not available
  try {
    const { data } = await supabase
      .from('connection_port_map')
      .select('id')
      .eq('connection_id', connId)
      .limit(1)
    const hasMaps = !!(data && data.length > 0)
    portMapCache.value.set(connId, hasMaps)
    selectedConnHasPortMaps.value = hasMaps
    return hasMaps
  } catch {
    selectedConnHasPortMaps.value = false
    return false
  }
}

// Watch selected connection and check for port maps
watch(selectedConnectionId, async (connId) => {
  if (connId) {
    await checkPortMapsForConnection(connId)
  } else {
    selectedConnHasPortMaps.value = false
  }
}, { immediate: true })

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
const fromNodeType = computed(() => (fromNodeOfSelected.value?.gear_type || fromNodeOfSelected.value?.type || '').toLowerCase())
const toNodeType = computed(() => (toNodeOfSelected.value?.gear_type || toNodeOfSelected.value?.type || '').toLowerCase())
const isRecorderFrom = computed(() => {
  const from = fromNodeOfSelected.value
  if (!from) return false
  const type = (from.gear_type || from.type || '').toLowerCase()
  return type === 'recorder' || !!(from.num_tracks || from.tracks || from.num_records || from.numrecord)
})
const isRecorderTo = computed(() => {
  const to = toNodeOfSelected.value
  if (!to) return false
  const type = (to.gear_type || to.type || '').toLowerCase()
  return type === 'recorder' || !!(to.num_tracks || to.tracks || to.num_records || to.numrecord)
})

// Check if this connection needs port mapping UI
const needsPortMappingForSelected = computed(() => {
  const fromType = fromNodeType.value
  const toType = toNodeType.value
  // Allow mapping when:
  // - transformer → transformer/recorder
  // - recorder → recorder
  // - multi-output source (e.g., stereo) → transformer/recorder
  // - venue_sources → transformer/recorder (can have unlimited source tracks)
  const fromNode = fromNodeOfSelected.value
  const isMultiOutputSource = (fromType === 'source') && ((fromNode?.num_outputs || fromNode?.outputs || 0) > 1)
  const isVenueSources = fromType === 'venue_sources'
  return (fromType === 'transformer' && (toType === 'transformer' || toType === 'recorder')) ||
         (fromType === 'recorder' && toType === 'recorder') ||
         (isMultiOutputSource && (toType === 'transformer' || toType === 'recorder')) ||
         (isVenueSources && (toType === 'transformer' || toType === 'recorder'))
})

// Recursively trace source label through transformer chain
// Always uses nodeId as primary identifier - ensures we track by ID, not just by name
// inputNum should represent the source output port (1=L, 2=R for stereo sources)
function traceSourceLabel(nodeId, inputNum, visitedNodes = new Set()) {
  if (visitedNodes.has(nodeId)) return null
  visitedNodes.add(nodeId)
  
  // Look up node by ID (primary identifier) - name is derived from node properties
  const node = props.nodes.find(n => n.id === nodeId)
  if (!node) return null
  
  const nodeType = (node.gear_type || node.type || '').toLowerCase()
  
  // If it's a venue_sources node, use centralized helper to get label
  if (nodeType === 'venue_sources') {
    // inputNum should represent the venue source output port
    // Check node's output_port_labels first (these are set from custom labels)
    if (node.output_port_labels && typeof node.output_port_labels === 'object') {
      const storedLabel = node.output_port_labels[String(inputNum)] || node.output_port_labels[inputNum]
      if (storedLabel) return storedLabel
    }
    // Fallback to async helper (which queries venue_source_feeds)
    // Note: This is a sync function, so we can't await, but getSourceLabelFromNode
    // will be called async elsewhere. For now, return null to let the fallback work.
    return null
  }
  
  // If it's a source, check output_port_labels first (synchronous)
  if (nodeType === 'source') {
    // inputNum should represent the source output port (1=L, 2=R for stereo)
    // Check node's output_port_labels first (most reliable, synchronous)
    if (node.output_port_labels && typeof node.output_port_labels === 'object') {
      const storedLabel = node.output_port_labels[String(inputNum)] || node.output_port_labels[inputNum]
      if (storedLabel) return storedLabel
    }
    // Fallback: compute label synchronously from node properties
    // Don't call async getSourceLabelFromNode here - it's used in sync contexts
    const outCount = node?.num_outputs || node?.outputs || 0
    const label = node.label || ''
    const trackName = node.track_name || ''
    const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
    const num = m ? m[2] : ''
    let base
    if (trackName) {
      base = trackName.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
    } else if (m) {
      base = m[1].replace(/\s*LR$/i, '').trim()
    } else {
      base = label.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
    }
    const numSuffix = num ? ` (${num})` : ''
    if (outCount === 2 && typeof inputNum === 'number') {
      if (inputNum === 1) {
        return `${base} L${numSuffix}`
      } else if (inputNum === 2) {
        return `${base} R${numSuffix}`
      }
    }
    return `${base}${numSuffix}`
  }
  
  // For transformers, trace through to find the source
  if (nodeType === 'transformer') {
    // Find connection feeding this transformer's input
    const incoming = props.connections.find(c => 
      (c.to_node_id === nodeId || c.to === nodeId) && c.input_number === inputNum
    )
    
    if (incoming) {
      const parentNodeId = incoming.from_node_id || incoming.from
      const parentNode = props.nodes.find(n => n.id === parentNodeId)
      
      if (parentNode) {
        const parentType = (parentNode.gear_type || parentNode.type || '').toLowerCase()
        
        // For venue sources, check node's output_port_labels first
        // This works even if the connection is port-mapped because venue sources
        // store labels by port number in output_port_labels
        if (parentType === 'venue_sources') {
          // Check if venue sources has output_port_labels for this port
          if (parentNode.output_port_labels && typeof parentNode.output_port_labels === 'object') {
            const storedLabel = parentNode.output_port_labels[String(inputNum)] || parentNode.output_port_labels[inputNum]
            if (storedLabel) return storedLabel
          }
          // Fallback: trace recursively (will check output_port_labels in venue_sources handler)
          return traceSourceLabel(parentNodeId, inputNum, visitedNodes)
        }
        
        // For other node types, trace from parent with the same port number
        return traceSourceLabel(parentNodeId, inputNum, visitedNodes)
      }
    }
    
    // Also check for port-mapped connections (transformer to transformer or venue sources)
    // Find any connection to this transformer
    const anyIncoming = props.connections.find(c => 
      (c.to_node_id === nodeId || c.to === nodeId)
    )
    
    if (anyIncoming) {
      const parentNodeId = anyIncoming.from_node_id || anyIncoming.from
      const parentNode = props.nodes.find(n => n.id === parentNodeId)
      
      if (parentNode) {
        const parentType = (parentNode.gear_type || parentNode.type || '').toLowerCase()
        
        // For venue sources, check output_port_labels using inputNum
        // Note: For port-mapped connections, inputNum might not match the venue source port,
        // but we'll check anyway - the port mapping section in buildUpstreamLabelsForEdit
        // handles this correctly by using the from_port from the mapping
        if (parentType === 'venue_sources') {
          if (parentNode.output_port_labels && typeof parentNode.output_port_labels === 'object') {
            const storedLabel = parentNode.output_port_labels[String(inputNum)] || parentNode.output_port_labels[inputNum]
            if (storedLabel) return storedLabel
          }
          return traceSourceLabel(parentNodeId, inputNum, visitedNodes)
        }
      }
      
      // Fallback: trace from parent with inputNum as a hint
      return traceSourceLabel(parentNodeId, inputNum, visitedNodes)
    }
  }
  
  return null
}

// Trace track name from recorder output (track number)
function traceRecorderTrackName(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // Find connection TO this recorder that uses this track number
  // For recorders, output port number corresponds to track number
  const trackConn = props.connections.find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  if (!trackConn) return null
  
  // Trace back from the source of this connection
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Check if the source is another recorder
  const sourceNode = props.nodes.find(n => n.id === sourceNodeId)
  const sourceType = sourceNode ? (sourceNode.gear_type || sourceNode.type || '').toLowerCase() : ''
  
  if (sourceType === 'recorder') {
    // Source is another recorder - recursively trace from that recorder's output
    // The output port number corresponds to the track number on the source recorder
    const sourceOutputPort = trackConn.output_number || trackConn.input_number || trackNumber
    return traceRecorderTrackName(sourceNodeId, sourceOutputPort, visitedNodes)
  }
  
  // For sources and transformers, use the existing trace function
  // Determine the source output port - use output_number if available, otherwise use input_number
  const sourceOutputPort = trackConn.output_number || trackConn.input_number || 1
  const sourceLabel = traceSourceLabel(sourceNodeId, sourceOutputPort, new Set(visitedNodes))
  return sourceLabel
}

function getFromPortDisplayForEdit(portNum) {
  const from = fromNodeOfSelected.value
  if (!from) return `Output ${portNum}`
  
  const fromType = (from.gear_type || from.node_type || from.type || '').toLowerCase()
  
  // For recorders, first check the preloaded async names, then fallback to sync version
  if (fromType === 'recorder') {
    // First try the preloaded async names
    if (recorderTrackNamesForEdit.value && recorderTrackNamesForEdit.value[portNum]) {
      return recorderTrackNamesForEdit.value[portNum]
    }
    // Check cached upstream labels
    if (upstreamLabelsForFromNode.value && upstreamLabelsForFromNode.value[portNum]) {
      return upstreamLabelsForFromNode.value[portNum]
    }
    // Fallback to sync version
    const trackName = traceRecorderTrackName(from.id, portNum)
    if (trackName) {
      // Cache it for future use
      if (upstreamLabelsForFromNode.value) {
        upstreamLabelsForFromNode.value[portNum] = trackName
      }
      return trackName
    }
    // Fallback to track number if no source found
    return `Track ${portNum}`
  }
  
  // Check if we have a cached label from buildUpstreamLabelsForEdit
  if (upstreamLabelsForFromNode.value && upstreamLabelsForFromNode.value[portNum]) {
    return upstreamLabelsForFromNode.value[portNum]
  }
  
  // For venue_sources, check node's output_port_labels first (these are set from custom labels)
  if (fromType === 'venue_sources') {
    if (from.output_port_labels && typeof from.output_port_labels === 'object') {
      const storedLabel = from.output_port_labels[String(portNum)] || from.output_port_labels[portNum]
      if (storedLabel) return storedLabel
    }
    // Fallback to venue_source_feeds if node labels not available
    return `Output ${portNum}`
  }
  
  // Label stereo source ports as L/R - check output_port_labels first (synchronous)
  if (fromType === 'source') {
    // portNum should represent the source output port (1=L, 2=R for stereo)
    // Check node's output_port_labels first (most reliable, synchronous)
    if (from.output_port_labels && typeof from.output_port_labels === 'object') {
      const storedLabel = from.output_port_labels[String(portNum)] || from.output_port_labels[portNum]
      if (storedLabel) return storedLabel
    }
    // Fallback: compute label synchronously from node properties
    const outCount = from?.num_outputs || from?.outputs || 0
    const label = from.label || ''
    const trackName = from.track_name || ''
    const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
    const num = m ? m[2] : ''
    let base
    if (trackName) {
      base = trackName.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
    } else if (m) {
      base = m[1].replace(/\s*LR$/i, '').trim()
    } else {
      base = label.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
    }
    const numSuffix = num ? ` (${num})` : ''
    if (outCount === 2 && typeof portNum === 'number') {
      if (portNum === 1) {
        return `${base} L${numSuffix}`
      } else if (portNum === 2) {
        return `${base} R${numSuffix}`
      }
    }
    return `${base}${numSuffix}`
  }
  
  // For transformers, recursively trace to source
  if (fromType === 'transformer') {
    const sourceLabel = traceSourceLabel(from.id, portNum)
    if (sourceLabel) return sourceLabel
    
    // Fallback to direct incoming connection
    const incoming = props.connections.find(c => 
      (c.to_node_id === from.id || c.to === from.id) && c.input_number === portNum
    )
    if (incoming) {
      const sourceLabelFromConn = traceSourceLabel(incoming.from_node_id || incoming.from, incoming.input_number || portNum)
      if (sourceLabelFromConn) return sourceLabelFromConn
      
      const upNode = props.nodes.find(nd => nd.id === (incoming.from_node_id || incoming.from))
      return upNode?.track_name || upNode?.label || `Output ${portNum}`
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
  const fromType = (from?.gear_type || from?.node_type || from?.type || '').toLowerCase()
  for (let n = 1; n <= count; n++) {
    if (used.has(n)) continue
    let label = upstreamLabelsForFromNode.value[n] || `Output ${n}`
    
    // For sources, check stored output port labels first
    if (fromType === 'source') {
      if (from.output_port_labels && typeof from.output_port_labels === 'object') {
        const storedLabel = from.output_port_labels[String(n)] || from.output_port_labels[n]
        if (storedLabel) {
          label = storedLabel
          opts.push({ value: n, label })
          continue
        }
      }
      // Fallback to computed label if not stored
      label = getFromPortDisplayForEdit(n)
    } else if (fromType === 'venue_sources') {
      // For venue sources, prefer node.output_port_labels (set by custom labels)
      if (from.output_port_labels && typeof from.output_port_labels === 'object') {
        const storedLabel = from.output_port_labels[String(n)] || from.output_port_labels[n]
        if (storedLabel) {
          label = storedLabel
          opts.push({ value: n, label })
          continue
        }
      }
      // Fallback to any upstream cached label or generic output label
      label = upstreamLabelsForFromNode.value[n] || `Output ${n}`
    } else if (fromType === 'recorder') {
      // For recorders, output port corresponds to track number - use track name
      // First try the preloaded async names, then fallback to sync version
      label = recorderTrackNamesForEdit.value[n] || traceRecorderTrackName(from.id, n)
      if (!label) label = `Track ${n}`
    } else if (fromType === 'transformer') {
      // Use recursive tracing to get source label
      const sourceLabel = traceSourceLabel(from.id, n)
      if (sourceLabel) {
        label = sourceLabel
      } else if (!upstreamLabelsForFromNode.value[n]) {
        // Fallback to direct connection
        const incoming = props.connections.find(c =>
          (c.to_node_id === from?.id || c.to === from?.id) && c.input_number === n
        )
        if (incoming) {
          const sourceLabelFromConn = traceSourceLabel(incoming.from_node_id || incoming.from, incoming.input_number || n)
          if (sourceLabelFromConn) {
            label = sourceLabelFromConn
          } else {
            const upNode = props.nodes.find(nd => nd.id === (incoming.from_node_id || incoming.from))
            if (upNode) label = upNode.track_name || upNode.label || label
          }
        }
      }
    }
    opts.push({ value: n, label })
  }
  return opts
})

async function buildUpstreamLabelsForEdit() {
  upstreamLabelsForFromNode.value = {}
  const from = fromNodeOfSelected.value
  if (!from) return
  if (!graphRef.value) {
    try { graphRef.value = await buildGraph(props.projectId) } catch {}
  }
  const count = from?.num_outputs || from?.outputs || 0
  const fromType = (from.gear_type || from.node_type || from.type || '').toLowerCase()
  if (fromType === 'transformer') {
    for (let n = 1; n <= count; n++) {
      try {
        const label = await svcResolveTransformerInputLabel(from, n, graphRef.value)
        if (label) upstreamLabelsForFromNode.value[n] = label
      } catch {}
    }
  } else if (fromType === 'recorder') {
    await loadRecorderTrackNamesForEdit(from.id)
    for (let n = 1; n <= count; n++) {
      const tn = recorderTrackNamesForEdit.value?.[n]
      if (tn) upstreamLabelsForFromNode.value[n] = tn
    }
  } else {
    for (let n = 1; n <= count; n++) {
      try {
        const label = await svcGetOutputLabel(from, n, graphRef.value)
        if (label) upstreamLabelsForFromNode.value[n] = label
      } catch {}
    }
  }
}

// Load recorder track names asynchronously (similar to ConnectionDetailsModal)
async function loadRecorderTrackNamesForEdit(recorderId) {
  recorderTrackNamesForEdit.value = {}
  const numOutputs = fromNodeOfSelected.value?.num_outputs || fromNodeOfSelected.value?.numoutputs || fromNodeOfSelected.value?.outputs || fromNodeOfSelected.value?.num_tracks || fromNodeOfSelected.value?.tracks || fromNodeOfSelected.value?.num_records || fromNodeOfSelected.value?.numrecord || 0
  
  // Load all track names in parallel
  const trackPromises = []
  for (let n = 1; n <= numOutputs; n++) {
    trackPromises.push(traceRecorderTrackNameAsync(recorderId, n))
  }
  
  const trackNames = await Promise.all(trackPromises)
  
  for (let n = 1; n <= numOutputs; n++) {
    const trackName = trackNames[n - 1]
    if (trackName) {
      recorderTrackNamesForEdit.value[n] = trackName
      upstreamLabelsForFromNode.value[n] = trackName
    }
  }
}

// Async version of traceRecorderTrackName that handles port mappings
async function traceRecorderTrackNameAsync(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // Find connection TO this recorder that uses this track number
  let trackConn = props.connections.find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  // If no direct connection found, check port mappings
  if (!trackConn) {
    const recorderConns = props.connections.filter(c => 
      (c.to_node_id === recorderId || c.to === recorderId)
    )
    
    if (recorderConns.length > 0) {
      const connIds = recorderConns.map(c => c.id).filter(Boolean)
      if (connIds.length > 0) {
        try {
          const { data: portMaps } = await supabase
            .from('connection_port_map')
            .select('connection_id, from_port, to_port')
            .in('connection_id', connIds)
            .eq('to_port', trackNumber)
          
          if (portMaps && portMaps.length > 0) {
            const portMap = portMaps[0]
            trackConn = recorderConns.find(c => c.id === portMap.connection_id)
            if (trackConn) {
              trackConn._mappedFromPort = portMap.from_port
            }
          }
        } catch (err) {
          console.error('Error querying port maps:', err)
        }
      }
    }
  }
  
  if (!trackConn) return null
  
  // Trace back from the source
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Determine which port on the source to trace from
  let sourcePort = trackConn.output_number || trackConn.input_number || 1
  if (trackConn._mappedFromPort !== undefined) {
    sourcePort = trackConn._mappedFromPort
  }
  
  const sourceNode = props.nodes.find(n => n.id === sourceNodeId)
  if (!sourceNode) return null
  
  const sourceType = (sourceNode.gear_type || sourceNode.type || '').toLowerCase()
  
  if (sourceType === 'recorder') {
    // Source is another recorder - recursively trace
    const recursiveTrackName = await traceRecorderTrackNameAsync(sourceNodeId, sourcePort, visitedNodes)
    if (recursiveTrackName) return recursiveTrackName
  } else if (sourceType === 'source') {
    // Direct source - get source label
    const traceConn = {
      from_node_id: sourceNodeId,
      input_number: sourcePort,
      output_number: sourcePort
    }
    // Use traceSourceLabel to get the label
    const sourceLabel = traceSourceLabel(sourceNodeId, sourcePort)
    if (sourceLabel) return sourceLabel
  } else if (sourceType === 'transformer') {
    // Transformer - trace through it
    const sourceLabel = traceSourceLabel(sourceNodeId, sourcePort)
    if (sourceLabel) return sourceLabel
  }
  
  return null
}

// Trace what input is assigned to a recorder track (for showing in "To Port" dropdown)
function traceRecorderTrackInput(recorderId, trackNumber, visitedNodes = new Set()) {
  if (visitedNodes.has(recorderId)) return null
  visitedNodes.add(recorderId)
  
  // Find connection TO this recorder that uses this track number
  const trackConn = props.connections.find(c => 
    (c.to_node_id === recorderId || c.to === recorderId) &&
    (c.track_number === trackNumber || c.input_number === trackNumber)
  )
  
  if (!trackConn) return null
  
  // Trace back to get the source label
  const sourceNodeId = trackConn.from_node_id || trackConn.from
  if (!sourceNodeId) return null
  
  // Check if the source is another recorder
  const sourceNode = props.nodes.find(n => n.id === sourceNodeId)
  const sourceType = sourceNode ? (sourceNode.gear_type || sourceNode.type || '').toLowerCase() : ''
  
  if (sourceType === 'recorder') {
    // Source is another recorder - recursively trace from that recorder's output
    const sourceOutputPort = trackConn.output_number || trackConn.input_number || trackNumber
    return traceRecorderTrackInput(sourceNodeId, sourceOutputPort, visitedNodes)
  }
  
  // For sources and transformers, use the existing trace function
  // Determine the source output port - use output_number if available, otherwise use input_number
  const sourceOutputPort = trackConn.output_number || trackConn.input_number || 1
  const sourceLabel = traceSourceLabel(sourceNodeId, sourceOutputPort, new Set(visitedNodes))
  return sourceLabel
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
      if (!taken) {
        // Trace what input is assigned to this track to show as the track name (like transformers)
        const assignedInput = traceRecorderTrackInput(to?.id, n)
        const label = assignedInput || `Track ${n}`
        opts.push({ value: n, label })
      }
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

// Add venue source port mapping from text input
function addVenueSourcePortMapping() {
  const label = venueSourceLabelInput.value?.trim()
  if (!label) {
    toast.error('Please enter a label')
    return
  }
  // Auto-select first free destination if none chosen
  if (!newMappingToPort.value) {
    const firstFree = (availableToPortsForEdit.value || []).find(o => !o.disabled)
    if (firstFree) {
      newMappingToPort.value = firstFree.value
    } else {
      toast.error('No available destination inputs')
      return
    }
  }
  
  // Check if destination port is already in use
  const portAlreadyUsed = editPortMappings.value.some(m => m.to_port === newMappingToPort.value)
  if (portAlreadyUsed) {
    toast.error('This port is already mapped in this connection')
    return
  }
  
  // Find next available from_port (venue sources use sequential port numbers)
  const usedPorts = new Set(editPortMappings.value.map(m => m.from_port).filter(Boolean))
  let nextPort = venueSourceNextPort
  while (usedPorts.has(nextPort)) {
    nextPort++
  }
  
  // Capture destination before we clear inputs
  const destPort = newMappingToPort.value
  // Add mapping with label stored for display
  editPortMappings.value.push({
    from_port: nextPort,
    to_port: destPort,
    label: label // Store label for display
  })
  console.log('[SignalMapper][Flow] Added venue mapping (pending save)', {
    from_node_id: fromNodeOfSelected.value?.id,
    to_node_id: toNodeOfSelected.value?.id,
    label,
    from_port: nextPort,
    to_port: destPort
  })
  
  // Update upstreamLabelsForFromNode for display
  if (!upstreamLabelsForFromNode.value) {
    upstreamLabelsForFromNode.value = {}
  }
  upstreamLabelsForFromNode.value[nextPort] = label
  
  // Update port counter for next mapping
  venueSourceNextPort = nextPort + 1
  
  // Clear inputs
  venueSourceLabelInput.value = ''
  newMappingToPort.value = null
  
  const destLabel = toNodeType.value === 'recorder' ? `Track ${destPort}` : `Input ${destPort}`
  toast.success(`Added ${label} → ${destLabel}`)
}

function removeEditPortMapping(index) {
  const removed = editPortMappings.value[index]
  editPortMappings.value.splice(index, 1)
  if (editingIdx.value === index) {
    editingIdx.value = null
  }
  // If this mapping belongs to an existing connection, delete the row immediately
  try {
    if (selectedConn.value && selectedConn.value.id && removed && (removed.to_port || removed.from_port)) {
      supabase
        .from('connection_port_map')
        .delete()
        .match({ connection_id: selectedConn.value.id, from_port: removed.from_port, to_port: removed.to_port })
        .then(() => {
          const destLabel = toNodeType.value === 'recorder' ? `Track ${removed.to_port}` : `Input ${removed.to_port}`
          const srcLabel = removed.label || upstreamLabelsForFromNode.value[removed.from_port] || `Output ${removed.from_port}`
          toast.success(`Removed ${srcLabel} → ${destLabel}`)
        })
        .catch(() => {})
    } else {
      const destLabel = toNodeType.value === 'recorder' ? `Track ${removed?.to_port}` : `Input ${removed?.to_port}`
      const srcLabel = removed?.label || (removed?.from_port ? `Output ${removed.from_port}` : 'Mapping')
      toast.success(`Removed ${srcLabel} → ${destLabel}`)
    }
  } catch {}
}

function startEditMapping(index) {
  editingIdx.value = index
  editFromPort.value = editPortMappings.value[index].from_port
  editToPort.value = editPortMappings.value[index].to_port
}

function saveEditMapping() {
  if (editingIdx.value !== null && editFromPort.value && editToPort.value) {
    editPortMappings.value[editingIdx.value] = {
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

// Get display name for destination recorder track when routing from a recorder
// For recorder-to-recorder: show the track name from the source recorder's track
// For source/transformer-to-recorder: show what's assigned to that track
function getToRecorderTrackNameDisplayForEdit(trackNumber, fromPort = null) {
  // If routing from a recorder to a recorder, use the track name from the source recorder
  if (isRecorderFrom.value && isRecorderTo.value && fromPort) {
    // For recorder-to-recorder, we want to show the track name that will be assigned
    // This comes from tracing what's on the FROM recorder's track
    const sourceTrackName = traceRecorderTrackName(fromNodeOfSelected.value?.id, fromPort)
    if (sourceTrackName) return sourceTrackName
    // Fallback if we can't get the track name
    return `Track ${trackNumber}`
  }
  
  // For source/transformer-to-recorder: show what's currently assigned to this track
  return traceRecorderTrackInput(toNodeOfSelected.value?.id, trackNumber) || `Track ${trackNumber}`
}

async function loadPortMappingsForConnection(connId) {
  if (!connId) {
    editPortMappings.value = []
    return
  }
  
  // Try to use graph cache first (much faster)
  if (graphRef.value?.mapsByConnId) {
    const portMaps = graphRef.value.mapsByConnId[connId] || []
    if (portMaps.length > 0) {
      // Sort by from_port to match DB query behavior
      const sortedMaps = [...portMaps].sort((a, b) => Number(a.from_port) - Number(b.from_port))
      const data = sortedMaps.map(m => ({ from_port: m.from_port, to_port: m.to_port }))
      
      // Process the data (same logic as before)
      if (data && data.length > 0) {
        // If this is a venue sources connection, load labels from node's output_port_labels first
        if (fromNodeType.value === 'venue_sources' && fromNodeOfSelected.value) {
          // Build a complete list of ports so un-mapped ports also get labels
          const totalPorts = (fromNodeOfSelected.value.num_outputs || fromNodeOfSelected.value.outputs || 0) || 0
          const portNumbers = totalPorts > 0
            ? Array.from({ length: totalPorts }, (_, i) => i + 1)
            : data.map(m => m.from_port)
          
          // First, check node's output_port_labels (these are set from custom labels in port map)
          const nodeLabels = {}
          if (fromNodeOfSelected.value.output_port_labels && typeof fromNodeOfSelected.value.output_port_labels === 'object') {
            portNumbers.forEach(portNum => {
              const label = fromNodeOfSelected.value.output_port_labels[String(portNum)] || 
                           fromNodeOfSelected.value.output_port_labels[portNum]
              if (label) {
                nodeLabels[portNum] = label
              }
            })
          }
          
          // Fallback: Query venue_source_feeds for any ports not found in node labels
          const missingPorts = portNumbers.filter(p => !nodeLabels[p])
          const feedMap = { ...nodeLabels }
          
          if (missingPorts.length > 0) {
            const { data: feeds } = await supabase
              .from('venue_source_feeds')
              .select('port_number, output_port_label, source_type, feed_identifier, channel')
              .eq('node_id', fromNodeOfSelected.value.id)
              .in('port_number', missingPorts)
            
            if (feeds) {
              feeds.forEach(feed => {
                if (feed.output_port_label && feed.output_port_label.trim()) {
                  feedMap[feed.port_number] = feed.output_port_label.trim()
                } else {
                  // Construct a readable fallback from source_type/feed_identifier/channel
                  const baseType = (feed.source_type || '').replace(/_/g, ' ')
                  const typeName = baseType ? (baseType.charAt(0).toUpperCase() + baseType.slice(1)) : 'Source'
                  let constructed = typeName
                  if (feed.feed_identifier) constructed += ` ${feed.feed_identifier}`
                  if (Number(feed.channel) === 1) constructed += ' L'
                  if (Number(feed.channel) === 2) constructed += ' R'
                  feedMap[feed.port_number] = constructed.trim()
                }
              })
            }
          }
          
          editPortMappings.value = data.map(m => ({
            from_port: m.from_port,
            to_port: m.to_port,
            label: feedMap[m.from_port] // Include label from node or venue_source_feeds
          }))
          
          // Initialize upstreamLabelsForFromNode with loaded labels
          if (!upstreamLabelsForFromNode.value) {
            upstreamLabelsForFromNode.value = {}
          }
          // Populate upstream labels for all known ports
          portNumbers.forEach(p => {
            if (feedMap[p]) {
              upstreamLabelsForFromNode.value[p] = feedMap[p]
            }
          })

          // Locally ensure the node carries labels for all ports so dropdowns show names
          const existing = fromNodeOfSelected.value.output_port_labels || {}
          const mergedLabels = { ...existing }
          portNumbers.forEach(p => {
            if (feedMap[p]) mergedLabels[String(p)] = feedMap[p]
          })
          fromNodeOfSelected.value.output_port_labels = mergedLabels
          
          // Initialize venue source port counter
          const usedPorts = new Set(data.map(m => m.from_port).filter(Boolean))
          venueSourceNextPort = 1
          while (usedPorts.has(venueSourceNextPort)) {
            venueSourceNextPort++
          }
          return // Successfully loaded from cache
        } else {
          editPortMappings.value = data.map(m => ({ from_port: m.from_port, to_port: m.to_port }))
          return // Successfully loaded from cache
        }
      }
    }
  }
  
  // Fallback to DB query if graph cache not available or empty
  try {
    const { data, error } = await supabase
      .from('connection_port_map')
      .select('from_port, to_port')
      .eq('connection_id', connId)
      .order('from_port')
    if (!error && data) {
      // If this is a venue sources connection, load labels from node's output_port_labels first
      if (fromNodeType.value === 'venue_sources' && fromNodeOfSelected.value) {
        // Build a complete list of ports so un-mapped ports also get labels
        const totalPorts = (fromNodeOfSelected.value.num_outputs || fromNodeOfSelected.value.outputs || 0) || 0
        const portNumbers = totalPorts > 0
          ? Array.from({ length: totalPorts }, (_, i) => i + 1)
          : data.map(m => m.from_port)
        
        // First, check node's output_port_labels (these are set from custom labels in port map)
        const nodeLabels = {}
        if (fromNodeOfSelected.value.output_port_labels && typeof fromNodeOfSelected.value.output_port_labels === 'object') {
          portNumbers.forEach(portNum => {
            const label = fromNodeOfSelected.value.output_port_labels[String(portNum)] || 
                         fromNodeOfSelected.value.output_port_labels[portNum]
            if (label) {
              nodeLabels[portNum] = label
            }
          })
        }
        
        // Fallback: Query venue_source_feeds for any ports not found in node labels
        const missingPorts = portNumbers.filter(p => !nodeLabels[p])
        const feedMap = { ...nodeLabels }
        
        if (missingPorts.length > 0) {
          const { data: feeds } = await supabase
            .from('venue_source_feeds')
            .select('port_number, output_port_label, source_type, feed_identifier, channel')
            .eq('node_id', fromNodeOfSelected.value.id)
            .in('port_number', missingPorts)
          
          if (feeds) {
            feeds.forEach(feed => {
              if (feed.output_port_label && feed.output_port_label.trim()) {
                feedMap[feed.port_number] = feed.output_port_label.trim()
              } else {
                // Construct a readable fallback from source_type/feed_identifier/channel
                const baseType = (feed.source_type || '').replace(/_/g, ' ')
                const typeName = baseType ? (baseType.charAt(0).toUpperCase() + baseType.slice(1)) : 'Source'
                let constructed = typeName
                if (feed.feed_identifier) constructed += ` ${feed.feed_identifier}`
                if (Number(feed.channel) === 1) constructed += ' L'
                if (Number(feed.channel) === 2) constructed += ' R'
                feedMap[feed.port_number] = constructed.trim()
              }
            })
          }
        }
        
        editPortMappings.value = data.map(m => ({
          from_port: m.from_port,
          to_port: m.to_port,
          label: feedMap[m.from_port] // Include label from node or venue_source_feeds
        }))
        
        // Initialize upstreamLabelsForFromNode with loaded labels
        if (!upstreamLabelsForFromNode.value) {
          upstreamLabelsForFromNode.value = {}
        }
        // Populate upstream labels for all known ports
        portNumbers.forEach(p => {
          if (feedMap[p]) {
            upstreamLabelsForFromNode.value[p] = feedMap[p]
          }
        })

        // Locally ensure the node carries labels for all ports so dropdowns show names
        const existing = fromNodeOfSelected.value.output_port_labels || {}
        const mergedLabels = { ...existing }
        portNumbers.forEach(p => {
          if (feedMap[p]) mergedLabels[String(p)] = feedMap[p]
        })
        fromNodeOfSelected.value.output_port_labels = mergedLabels
        
        // Initialize venue source port counter
        const usedPorts = new Set(data.map(m => m.from_port).filter(Boolean))
        venueSourceNextPort = 1
        while (usedPorts.has(venueSourceNextPort)) {
          venueSourceNextPort++
        }
      } else {
        editPortMappings.value = data.map(m => ({ from_port: m.from_port, to_port: m.to_port }))
      }
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
    editingIdx.value = null
    editFromPort.value = null
    editToPort.value = null
    return
  }
  editPad.value = Number(c.pad || 0)
  editPhantom.value = !!c.phantom_power
  editType.value = c.connection_type || 'Mic'
  editInput.value = c.input_number || null
  editTrack.value = c.track_number || null
  
  // Reset editing state
  editingIdx.value = null
  editFromPort.value = null
  editToPort.value = null
  venueSourceLabelInput.value = ''
  venueSourceNextPort = 1
  
  // Always ensure upstreamLabelsForFromNode is initialized
  if (!upstreamLabelsForFromNode.value) {
    upstreamLabelsForFromNode.value = {}
  }
  // Refresh graph snapshot for deterministic label resolution
  try { graphRef.value = await buildGraph(props.projectId) } catch {}
  // Hydrate venue source labels when editing a connection from venue_sources
  try {
    const from = fromNodeOfSelected.value
    const type = (from?.gear_type || from?.node_type || from?.type || '').toLowerCase()
    if (type === 'venue_sources') {
      await hydrateVenueLabels(from)
    }
  } catch {}
  
  // Load port mappings if this is a port-mapped connection
  if (needsPortMappingForSelected.value) {
    await loadPortMappingsForConnection(c.id)
    await buildUpstreamLabelsForEdit()
  } else {
    editPortMappings.value = []
    // Still build upstream labels for recorders even if not port-mapped
    // (needed for display purposes)
    if (isRecorderFrom.value) {
      await buildUpstreamLabelsForEdit()
    } else {
      upstreamLabelsForFromNode.value = {}
    }
  }
})

async function saveSelectedConnection() {
  const c = selectedConn.value
  if (!c) return
  try {
    // Handle port mapping connections
    if (needsPortMappingForSelected.value) {
      // If there are no port maps to save, allow updating connection metadata only
      if (editPortMappings.value.length === 0) {
        const payload = {
          id: c.id,
          pad: -Math.abs(Number(editPad.value) || 0),
          phantom_power: editPhantom.value,
          connection_type: editType.value
        }
        const updatedMeta = await updateConnection(payload)
        emit('connection-updated', updatedMeta)
        toast.success('Connection saved successfully')
        selectedConnectionId.value = null // Close modal after successful save
        return
      }
      
      // Update parent connection properties
      // For port-mapped connections, clear input_number and track_number since port maps handle everything
      const payload = {
        id: c.id,
        pad: -Math.abs(Number(editPad.value) || 0),
        phantom_power: editPhantom.value,
        connection_type: editType.value,
        input_number: null, // Port maps handle the mapping, no need for single input_number
        track_number: null // Port maps handle track mapping
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
      
      // If this is a venue sources connection, save labels to venue_source_feeds table
      if (fromNodeType.value === 'venue_sources' && fromNodeOfSelected.value && editPortMappings.value.length > 0) {
        const venueFeedInserts = []
        for (const mapping of editPortMappings.value) {
          if (mapping.label) {
            const label = mapping.label.trim()
            // Parse label (e.g., "DJA L", "DJA R", "Program 1")
            const parts = label.match(/^([A-Za-z]+)\s*([A-Z0-9]+)\s*(L|R)?$/i)
            if (parts) {
              const sourceType = parts[1].toLowerCase()
              const feedIdentifier = parts[2]
              const channel = parts[3] ? (parts[3].toUpperCase() === 'R' ? 2 : 1) : 1
              
              // Check if feed already exists
              const { data: existing } = await supabase
                .from('venue_source_feeds')
                .select('id')
                .eq('node_id', fromNodeOfSelected.value.id)
                .eq('port_number', mapping.from_port)
                .maybeSingle()
              
              if (existing) {
                await supabase
                  .from('venue_source_feeds')
                  .update({
                    source_type: sourceType,
                    feed_identifier: feedIdentifier,
                    channel: channel,
                    output_port_label: label
                  })
                  .eq('id', existing.id)
              } else {
                venueFeedInserts.push({
                  project_id: props.projectId,
                  node_id: fromNodeOfSelected.value.id,
                  source_type: sourceType,
                  feed_identifier: feedIdentifier,
                  port_number: mapping.from_port,
                  channel: channel,
                  output_port_label: label
                })
              }
            } else {
              // Generic feed if can't parse
              const { data: existing } = await supabase
                .from('venue_source_feeds')
                .select('id')
                .eq('node_id', fromNodeOfSelected.value.id)
                .eq('port_number', mapping.from_port)
                .maybeSingle()
              
              if (existing) {
                await supabase
                  .from('venue_source_feeds')
                  .update({ output_port_label: label })
                  .eq('id', existing.id)
              } else {
                venueFeedInserts.push({
                  project_id: props.projectId,
                  node_id: fromNodeOfSelected.value.id,
                  source_type: 'custom',
                  feed_identifier: String(mapping.from_port),
                  port_number: mapping.from_port,
                  channel: 1,
                  output_port_label: label
                })
              }
            }
          }
        }
        
        if (venueFeedInserts.length > 0) {
          const { error: feedError } = await supabase
            .from('venue_source_feeds')
            .insert(venueFeedInserts)
          if (feedError) {
            console.error('Error saving venue source feeds:', feedError)
          }
        }
        
        // Update the venue source node's output_port_labels with all custom labels
        // This makes the custom labels become the node's output labels
        const outputPortLabels = {}
        for (const mapping of editPortMappings.value) {
          if (mapping.label && mapping.from_port) {
            outputPortLabels[String(mapping.from_port)] = mapping.label.trim()
          }
        }
        
        // Only update if we have labels
        if (Object.keys(outputPortLabels).length > 0) {
          // Get current node to preserve other fields
          const { data: currentNode } = await supabase
            .from('nodes')
            .select('output_port_labels')
            .eq('id', fromNodeOfSelected.value.id)
            .single()
          
          // Merge with existing labels (if any) and update
          const existingLabels = currentNode?.output_port_labels || {}
          const mergedLabels = { ...existingLabels, ...outputPortLabels }
          
          const { error: nodeError } = await supabase
            .from('nodes')
            .update({ output_port_labels: mergedLabels })
            .eq('id', fromNodeOfSelected.value.id)
          
          if (nodeError) {
            console.error('Error updating venue source node output_port_labels:', nodeError)
          } else {
            // Update the local node reference with the new output_port_labels
            // so the Connection Details modal shows the updated labels immediately
            if (fromNodeOfSelected.value) {
              fromNodeOfSelected.value.output_port_labels = mergedLabels
            }
            // Also update it in the props.nodes array if it exists there
            const nodeIndex = props.nodes.findIndex(n => n.id === fromNodeOfSelected.value.id)
            if (nodeIndex !== -1) {
              props.nodes[nodeIndex].output_port_labels = mergedLabels
            }
          }
        }
      }
      
      emit('connection-updated', { ...c, ...payload })
      toast.success('Connection saved successfully')
      selectedConnectionId.value = null // Close modal after successful save
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
    toast.success('Connection saved successfully')
    selectedConnectionId.value = null // Close modal after successful save
  } catch (err) {
    console.error('Failed to update connection:', err)
    toast.error('Failed to update connection')
  }
}

async function deleteSelectedConnection() {
  const c = selectedConn.value
  if (!c) return
  try {
    // Always delete port mappings first (deleteConnection will do this, but we do it explicitly here too)
    // to ensure cleanup happens before cascade logic
    try {
      await supabase
        .from('connection_port_map')
        .delete()
        .eq('connection_id', c.id)
    } catch (err) {
      console.error('Error deleting port mappings:', err)
      // Continue with deletion
    }
    
    // Check if this is a source→transformer connection
    const fromNode = props.nodes.find(n => n.id === c.from_node_id)
    const toNode = props.nodes.find(n => n.id === c.to_node_id)
    const isSourceConn = (fromNode?.gear_type || fromNode?.type) === 'source'
    
    if (isSourceConn && c.input_number && toNode) {
      // Cascade cleanup: remove downstream port mappings that depend on this input
      await cascadeCleanupDownstream(toNode.id, c.input_number)
    }
    
    // Also check for connections FROM the TO node that might reference this connection
    // Find connections that use port mappings referencing this connection's output
    const downstreamConns = props.connections.filter(conn => 
      conn.to_node_id === c.to_node_id && conn.id !== c.id
    )
    
    // Clean up any port mappings on downstream connections that reference this connection's ports
    for (const conn of downstreamConns) {
      try {
        const { data: maps } = await supabase
          .from('connection_port_map')
          .select('id, from_port, to_port')
          .eq('connection_id', conn.id)
        
        if (maps && maps.length > 0) {
          // Check if any mapping references ports from the deleted connection
          // Since we're deleting the connection, we should check if mappings are invalid
          // For now, we'll let the cascade cleanup handle this
        }
      } catch (err) {
        console.error('Error checking downstream port mappings:', err)
      }
    }
    
    // Delete the connection (this will also delete port mappings via deleteConnection)
    await deleteConnectionFromDB(c.id)
    
    // Clear any cached track names that might reference this connection
    recorderTrackNamesForEdit.value = {}
    upstreamLabelsForFromNode.value = {}
    
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
  
  // Background (not scaled - canvas stays same size)
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Draw connections (elements will be scaled by zoom, but canvas stays same)
  props.connections.forEach(conn => {
    drawConnection(ctx, conn, conn.id === selectedConnectionId.value)
  })

  // Draw nodes (elements will be scaled by zoom, but canvas stays same)
  props.nodes.forEach(node => {
    drawNode(ctx, node)
  })
}

function drawNode(ctx, node) {
  const isSource = (node.gear_type || node.type) === 'source'
  const isVenueSources = (node.gear_type || node.type) === 'venue_sources'
  const isAdHocSource = isSource && ((node.type === 'source') || !node.gear_id)
  const isSelected = node === selectedNode.value
  const pos = getCanvasPos(node)
  
  ctx.save()
  
  // Apply zoom to node size only (not position)
  const nodeRadius = 35 * zoomLevel.value
  const lineWidth = (isSelected ? 4 : 2) * zoomLevel.value
  
  // Node circle (scaled size)
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI)
  
  // Color based on type
  const colors = {
    source: '#28a745',
    transformer: '#007bff',
    recorder: '#dc3545'
  }
  // Ad-hoc sources use purple for extra clarity
  const color = isVenueSources ? '#6d28d9' : (isAdHocSource ? '#6d28d9' : (colors[node.gear_type || node.type] || '#6c757d'))
  
  // Venue Sources should be solid purple regardless of selection
  ctx.fillStyle = isVenueSources ? '#6d28d9' : (isSelected ? color : '#fff')
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.fill()
  ctx.stroke()

  // Selection indicator - enhanced visibility that persists (scaled)
  if (isSelected) {
    // Outer glow ring (subtle background)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 50 * zoomLevel.value, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.lineWidth = 1 * zoomLevel.value
    ctx.globalAlpha = 0.2
    ctx.stroke()
    ctx.globalAlpha = 1.0
    
    // Main dashed selection ring
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 45 * zoomLevel.value, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.lineWidth = 3 * zoomLevel.value // Thicker for better visibility
    ctx.setLineDash([8 * zoomLevel.value, 4 * zoomLevel.value]) // More pronounced dashed pattern
    ctx.stroke()
    ctx.setLineDash([])
    
    // Inner accent ring for extra emphasis (scaled)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 40 * zoomLevel.value, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.lineWidth = 1 * zoomLevel.value
    ctx.globalAlpha = 0.5
    ctx.stroke()
    ctx.globalAlpha = 1.0
  }

  // Label (scaled font size)
  ctx.fillStyle = '#222'
  const fontSize = 12 * zoomLevel.value
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  
  // For sources, show track name if available
  const label = isSource && node.track_name ? node.track_name : node.label
  ctx.fillText(label, pos.x, pos.y + 40 * zoomLevel.value)

  // Draw an icon inside for ad-hoc sources (scaled)
  if (isAdHocSource) {
    ctx.fillStyle = '#6d28d9'
    ctx.font = `${20 * zoomLevel.value}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎚️', pos.x, pos.y)
  } else if (isSource && node.gear_id) {
    // Draw gear name inside circle for source mics (first 6 characters, scaled)
    const gear = props.gearList.find(g => g.id === node.gear_id)
    if (gear && gear.gear_name) {
      const gearNameText = gear.gear_name.length > 6 
        ? gear.gear_name.substring(0, 6).toUpperCase() + '...'
        : gear.gear_name.toUpperCase()
      ctx.font = `bold ${11 * zoomLevel.value}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = isSelected ? '#fff' : '#495057'
      ctx.fillText(gearNameText, pos.x, pos.y)
    }
  }

  ctx.restore()

  // Draw full gear name above node when dragging (for source mics, scaled)
  if (draggingNode.value === node && isSource && node.gear_id) {
    const gear = props.gearList.find(g => g.id === node.gear_id)
    if (gear && gear.gear_name) {
      const gearNameText = gear.gear_name
      
      // Set font before measuring (scaled)
      const dragFontSize = 12 * zoomLevel.value
      ctx.font = `bold ${dragFontSize}px sans-serif`
      ctx.textAlign = 'center'
      const textMetrics = ctx.measureText(gearNameText)
      
      const padX = 8 * zoomLevel.value
      const padY = 4 * zoomLevel.value
      const bgW = Math.ceil(textMetrics.width) + padX * 2
      const bgH = 18 * zoomLevel.value + padY * 2
      const labelY = pos.y - 55 * zoomLevel.value // Position above the node
      
      // Background with border (scaled)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.lineWidth = 1 * zoomLevel.value
      ctx.beginPath()
      ctx.rect(pos.x - bgW / 2, labelY - padY, bgW, bgH)
      ctx.fill()
      ctx.stroke()
      
      // Text
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#222'
      ctx.fillText(gearNameText, pos.x, labelY + padY)
    }
  }
}

function drawConnection(ctx, conn, isSelected = false) {
  const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
  const toNode = props.nodes.find(n => n.id === conn.to_node_id)
  
  if (!fromNode || !toNode) return

  const fromPos = getCanvasPos(fromNode)
  const toPos = getCanvasPos(toNode)

  // Get color based on connection type, or default
  const connType = conn.connection_type || 'Mic'
  const baseColor = getConnectionColor(connType)
  // When selected, use orange; otherwise use the type-based color
  const strokeColor = isSelected ? '#ff7a00' : baseColor

  ctx.save()
  ctx.strokeStyle = strokeColor
  // Scale line width with zoom
  ctx.lineWidth = (isSelected ? 4 : 3) * zoomLevel.value
  ctx.setLineDash(isSelected ? [4 * zoomLevel.value, 4 * zoomLevel.value] : [8 * zoomLevel.value, 4 * zoomLevel.value])

  ctx.beginPath()
  ctx.moveTo(fromPos.x, fromPos.y)
  ctx.lineTo(toPos.x, toPos.y)
  ctx.stroke()

  ctx.setLineDash([])

  // Arrow at midpoint (scaled)
  const mx = (fromPos.x + toPos.x) / 2
  const my = (fromPos.y + toPos.y) / 2
  const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)
  const arrowSize = 12 * zoomLevel.value

  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - arrowSize * Math.cos(angle - Math.PI / 6), my - arrowSize * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - arrowSize * Math.cos(angle + Math.PI / 6), my - arrowSize * Math.sin(angle + Math.PI / 6))
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2 * zoomLevel.value
  ctx.stroke()

  ctx.restore()
}

// Pointer events
function onPointerDown(e) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  const clickedNode = getNodeAt(x, y)
  
  if (tool.value === 'select') {
    if (clickedNode) {
      // Select the clicked node
      // Double-tap detection to open NodeInspector
      const now = Date.now()
      const last = (onPointerDown._lastTapTime || 0)
      const same = (onPointerDown._lastNodeId === clickedNode.id)
      onPointerDown._lastTapTime = now
      onPointerDown._lastNodeId = clickedNode.id
      if (same && now - last < 350) {
        inspectorNode.value = clickedNode
        inspectorOpen.value = true
        selectedNode.value = null // Clear selection when opening inspector
        // Don't set draggingNode on double-click
      } else {
        selectedNode.value = clickedNode
        // Store potential drag start but don't enable dragging yet
        // Dragging will only start if mouse moves beyond threshold
        dragStart = { x, y, node: clickedNode }
        draggingNode.value = null // Don't start dragging immediately
      }
      selectedConnectionId.value = null // Clear connection selection when selecting a node
      
      // If Venue Sources node is clicked, open configuration modal
      const nodeType = (clickedNode.gear_type || clickedNode.type || '').toLowerCase()
      if (nodeType === 'venue_sources') {
        selectedVenueSourcesNode.value = clickedNode
        showVenueSourcesConfig.value = true
      }
      
      drawCanvas() // Redraw to show the selection immediately
    } else {
      // Clicked on empty space - check if it's a connection first
      const conn = getConnectionAt(x, y)
      if (conn) {
        selectedConnectionId.value = conn.id
        selectedNode.value = null // Deselect node when selecting connection
      } else {
        // Clicked on truly empty space - deselect everything
        selectedNode.value = null
        selectedConnectionId.value = null
      }
      // Clear drag state when clicking empty space
      dragStart = null
      draggingNode.value = null
      drawCanvas() // Redraw to update selection state
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
        // Create a base parent connection (anchor) and do not open inspector.
        // Mapping/editing happens via double‑tap later.
        (async () => {
          try {
            const exist = props.connections.find(c => c.from_node_id === linkSource.value.id && c.to_node_id === clickedNode.id)
            if (!exist) {
              const payload = { project_id: props.projectId, from_node_id: linkSource.value.id, to_node_id: clickedNode.id }
              const saved = await addConnectionToDB(payload)
              emit('connection-added', saved)
              toast.success('Linked nodes')
            } else {
              toast.info('Nodes already linked')
            }
          } catch (err) {
            console.error('Anchor link failed:', err)
            toast.error('Failed to link nodes')
          }
        })()
        linkSource.value = null
      } else {
        linkSource.value = null
      }
    }
    // Clear drag state in link mode
    dragStart = null
    draggingNode.value = null
  }

  drawCanvas()
}

function onPointerMove(e) {
  e.preventDefault()
  
  // Only start dragging if we have a dragStart and mouse has moved beyond threshold
  if (dragStart && dragStart.node && !draggingNode.value) {
    const { x, y } = getCanvasCoords(e)
    const dx = Math.abs(x - dragStart.x)
    const dy = Math.abs(y - dragStart.y)
    const threshold = 5 // pixels - only start dragging if moved more than this
    
    if (dx > threshold || dy > threshold) {
      // Start dragging - user has moved mouse enough
      draggingNode.value = dragStart.node
    }
  }
  
  // Only update position if actively dragging
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
  }
  
  // Always clear drag state on pointer up
  draggingNode.value = null
  dragStart = null
}

function getCanvasCoords(e) {
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / rect.width
  const scaleY = canvas.value.height / rect.height
  // No need to divide by zoom since we're not scaling the canvas coordinates anymore
  // Positions stay the same, only element sizes scale
  return {
    x: (e.clientX - rect.left) * scaleX / dpr,
    y: (e.clientY - rect.top) * scaleY / dpr
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


function canConnect(from, to) {
  const fromType = from.gear_type || from.type
  const toType = to.gear_type || to.type

  // Valid connections:
  // source -> transformer
  // source -> recorder
  // venue_sources -> transformer (treat like source)
  // venue_sources -> recorder (treat like source)
  // transformer -> transformer
  // transformer -> recorder
  // recorder -> recorder

  if ((fromType === 'source' || fromType === 'venue_sources') && (toType === 'transformer' || toType === 'recorder')) return true
  if (fromType === 'transformer' && (toType === 'transformer' || toType === 'recorder')) return true
  if (fromType === 'recorder' && toType === 'recorder') return true
  
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

// Show input modal helper
function showInput(title, message, defaultValue = '', label = '', placeholder = '') {
  return new Promise((resolve) => {
    let resolved = false
    inputModalConfig.value = {
      title,
      message,
      label,
      placeholder,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: (value) => {
        if (!resolved) {
          resolved = true
          showInputModal.value = false
          resolve(value)
        }
      },
      onCancel: () => {
        if (!resolved) {
          resolved = true
          showInputModal.value = false
          resolve(null)
        }
      }
    }
    inputModalValue.value = defaultValue
    showInputModal.value = true
  })
}

function handleInputConfirm() {
  if (inputModalConfig.value.onConfirm && inputModalValue.value.trim()) {
    inputModalConfig.value.onConfirm(inputModalValue.value.trim())
  }
}

function handleInputCancel() {
  if (inputModalConfig.value.onCancel) {
    inputModalConfig.value.onCancel()
  }
}

async function addGearNode(gear) {
  try {
    const label = await showInput(
      'Enter Label',
      'Enter a label for this gear node:',
      gear.gear_name,
      'Node Label',
      'Enter label...'
    )
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
      num_outputs: gear.num_tracks || gear.num_outputs || 0, // For recorders, tracks are outputs
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


async function addSourceNode(preset) {
  try {
    // Only handle Venue Sources now
    if (preset.key !== 'venue_sources') {
      toast.error('Only Venue Sources can be added')
      return
    }
    
    // Check if Venue Sources node already exists for this project
    if (hasVenueSourcesNode.value) {
      toast.warning('Venue Sources node already exists. Please configure the existing node.')
      closeSourceModal()
      return
    }
    
    // Create Venue Sources master node
    // Explicitly exclude node_type (column doesn't exist in database)
    const nodeData = {
      project_id: props.projectId,
      type: 'venue_sources',
      label: 'Venue Sources',
      track_name: 'Venue Sources',
      x: 0.5,
      y: 0.5,
      flow_x: 0.5,
      flow_y: 0.5,
      gear_type: 'venue_sources',
      num_inputs: 0,
      num_outputs: 0, // Will be calculated based on feeds
      num_tracks: 0,
      output_port_labels: {} // Will be populated when feeds are added
    }
    // Ensure node_type is not included
    delete nodeData.node_type
    const newNode = await addNode(nodeData)
    
    emit('node-added', newNode)
    closeSourceModal()
    toast.success('Venue Sources node created. Click to configure feeds.')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error adding venue sources node:', err)
    toast.error('Failed to add Venue Sources node: ' + (err.message || 'Unknown error'))
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

async function cascadeDeleteNode(nodeId) {
  // Find all connections FROM this node (outgoing)
  const outgoingConns = props.connections.filter(c => c.from_node_id === nodeId)
  
  // Find all connections TO this node (incoming)
  const incomingConns = props.connections.filter(c => c.to_node_id === nodeId)

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
      emit('connection-deleted', conn.id)
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

function handleVenueSourcesSaved() {
  // Reload nodes to get updated output counts and labels
  emit('node-updated', selectedVenueSourcesNode.value)
  // The parent will reload nodes and connections
}

function handleInspectorNodeDeleted(nodeId) {
  // Close inspector and emit node-deleted event
  inspectorOpen.value = false
  inspectorNode.value = null
  selectedNode.value = null
  emit('node-deleted', nodeId)
  nextTick(drawCanvas)
}

async function deleteSelected() {
  if (!selectedNode.value) return

  // Check if this is a gear source node (from mic placement)
  // These should only be deleted from the Mic Placement tab
  const isGearSource = (selectedNode.value.gear_type || selectedNode.value.type) === 'source' && 
                       selectedNode.value.gear_id
  
  if (isGearSource) {
    toast.error('Cannot delete mic-placement sources here. Delete from Mic Placement tab.')
    return
  }

  // Allow deletion of:
  // - Transformers (gear_type === 'transformer')
  // - Recorders (gear_type === 'recorder')
  // - Ad-hoc sources (type === 'source' without gear_id)
  // - Venue sources (gear_type === 'venue_sources')
  const nodeLabel = selectedNode.value.label

  try {
    await cascadeDeleteNode(selectedNode.value.id)
    selectedNode.value = null
    toast.success(`${nodeLabel} and connections deleted`)
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
      
      // Background (not scaled - canvas stays same size)
      ctx.fillStyle = '#f8f9fa'
      ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

      // Draw connections (including the new one) - elements will be scaled by zoom
      optimisticConnections.forEach(conn => {
        drawConnection(ctx, conn, conn.id === selectedConnectionId.value)
      })

      // Draw nodes - elements will be scaled by zoom
      props.nodes.forEach(node => {
        drawNode(ctx, node)
      })
      
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
// Keyboard handler for Delete key
function handleKeyDown(e) {
  // Handle Delete or Backspace key
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode.value) {
    // Prevent default browser behavior (e.g., going back in history)
    e.preventDefault()
    deleteSelected()
  }
}

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
  }
  nextTick(drawCanvas)
  // Note: All scroll/wheel blocking has been removed to allow normal page scrolling.
  // Zoom is ONLY controlled via the +/- buttons with preset intervals (25% steps).
  // Scrolling will NOT trigger zoom changes.
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
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

// Watch for external connection selection
watch(() => props.initialSelectedConnectionId, (newId) => {
  if (newId && props.connections.find(c => c.id === newId)) {
    selectedConnectionId.value = newId
    selectedNode.value = null // Clear node selection
    nextTick(() => {
      drawCanvas()
    })
  } else if (!newId) {
    // Clear selection when prop is null
    selectedConnectionId.value = null
    nextTick(() => {
      drawCanvas()
    })
  }
})

// Expose method to select connection from parent
function selectConnection(connectionId) {
  if (props.connections.find(c => c.id === connectionId)) {
    selectedConnectionId.value = connectionId
    selectedNode.value = null // Clear node selection
    nextTick(() => {
      drawCanvas()
    })
  }
}

defineExpose({ getCanvasDataURL, selectConnection })

// Export/Print the current signal flow canvas with print preview (PDF default)
async function exportToPDF() {
  if (!canvas.value) return
  
  // Build an export canvas that fits all nodes and connections with padding
  const PADDING = 20
  const dprLocal = window.devicePixelRatio || 1
  
  // Calculate bounding box of all elements (nodes + connection paths)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  // Create measurement context for accurate label width calculation
  const measure = document.createElement('canvas').getContext('2d')
  if (measure) {
    measure.font = 'bold 12px sans-serif'
  }
  
  // Include all nodes (radius 35px + label height ~40px below)
  props.nodes.forEach(node => {
    const pos = getCanvasPos(node)
    const nodeRadius = 35
    const labelHeight = 40
    const labelText = (node.gear_type || node.type) === 'source' && node.track_name 
      ? node.track_name 
      : node.label
    // Calculate actual label width
    const labelWidth = measure && labelText 
      ? measure.measureText(labelText).width 
      : (labelText?.length || 0) * 7
    
    minX = Math.min(minX, pos.x - nodeRadius)
    minY = Math.min(minY, pos.y - nodeRadius)
    maxX = Math.max(maxX, pos.x + nodeRadius)
    maxY = Math.max(maxY, pos.y + nodeRadius)
    
    // Include label bounds
    minX = Math.min(minX, pos.x - labelWidth / 2)
    maxX = Math.max(maxX, pos.x + labelWidth / 2)
    maxY = Math.max(maxY, pos.y + nodeRadius + labelHeight)
  })
  
  // Include all connections (lines between nodes)
  props.connections.forEach(conn => {
    const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
    const toNode = props.nodes.find(n => n.id === conn.to_node_id)
    if (fromNode && toNode) {
      const fromPos = getCanvasPos(fromNode)
      const toPos = getCanvasPos(toNode)
      
      // Include the line segment and arrow
      minX = Math.min(minX, Math.min(fromPos.x, toPos.x) - 12) // arrow extends
      minY = Math.min(minY, Math.min(fromPos.y, toPos.y) - 12)
      maxX = Math.max(maxX, Math.max(fromPos.x, toPos.x) + 12)
      maxY = Math.max(maxY, Math.max(fromPos.y, toPos.y) + 12)
    }
  })
  
  // If no elements found, use canvas bounds
  if (!isFinite(minX) || !isFinite(minY)) {
    minX = 0
    minY = 0
    maxX = canvasWidth.value
    maxY = canvasHeight.value
  }
  
  // Apply padding
  const exportW = Math.max(1, Math.ceil((maxX - minX) + PADDING * 2))
  const exportH = Math.max(1, Math.ceil((maxY - minY) + PADDING * 2))
  
  // Create offscreen canvas
  const off = document.createElement('canvas')
  off.width = exportW * dprLocal
  off.height = exportH * dprLocal
  const ctx = off.getContext('2d')
  if (!ctx) {
    toast.error('Failed to create export canvas')
    return
  }
  ctx.scale(dprLocal, dprLocal)
  
  // Fill background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, exportW, exportH)
  
  // Translate to account for bounding box offset and padding
  ctx.save()
  ctx.translate(-minX + PADDING, -minY + PADDING)
  
  // Draw connections first (so they appear under nodes)
  props.connections.forEach(conn => {
    drawConnection(ctx, conn, false)
  })
  
  // Draw nodes
  props.nodes.forEach(node => {
    drawNode(ctx, node)
  })
  
  ctx.restore()
  
  // Get data URL
  let dataURL
  try {
    dataURL = off.toDataURL('image/png', 1.0)
  } catch (e) {
    console.error('Error generating export image:', e)
    toast.error('Failed to generate export image')
    return
  }
  
  try {
    // Prompt for filename
    const defaultName = `signal-flow-${Date.now()}`
    const fileName = await showInput(
      'Export PDF',
      'Enter a filename for the PDF export:',
      defaultName,
      'Filename',
      'Enter filename...'
    ) || defaultName
    if (!fileName) {
      return // User cancelled
    }
    
    // Ensure filename has .pdf extension
    const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: exportW > exportH ? 'landscape' : 'portrait',
      unit: 'px',
      format: [exportW, exportH]
    })
    
    // Add image to PDF (scale to fit)
    pdf.addImage(dataURL, 'PNG', 0, 0, exportW, exportH)
    
    // Download PDF with iOS-compatible blob approach
    try {
      const pdfBlob = pdf.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = finalFileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 100)
      toast.success('PDF exported successfully')
    } catch (blobError) {
      // Fallback: try using data URI
      try {
        const pdfDataUri = pdf.output('datauristring')
        const link = document.createElement('a')
        link.href = pdfDataUri
        link.download = finalFileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('PDF exported successfully')
      } catch (dataUriError) {
        // Final fallback: use jsPDF's save method
        pdf.save(finalFileName)
        toast.success('PDF exported successfully')
      }
    }
  } catch (e) {
    console.error('Error exporting canvas:', e)
    toast.error('Failed to export signal flow')
  }
}
</script>

<style scoped>
.venue-sources-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.venue-sources-info p {
  margin: 0.5rem 0;
  color: #666;
}

.warning-text {
  color: #dc3545;
  font-weight: 500;
  margin-top: 0.75rem !important;
}

.venue-sources-item {
  cursor: pointer;
  transition: background-color 0.2s;
}

.venue-sources-item:hover {
  background-color: #f0f0f0;
}

.venue-sources-exists {
  padding: 1.5rem;
  text-align: center;
  color: #666;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
}

.venue-sources-exists p {
  margin: 0;
}

/* Dark mode styles for venue sources modal */
.dark .venue-sources-info {
  background: #1a1a1a;
  border: 1px solid #404040;
}

.dark .venue-sources-info p {
  color: #e0e0e0;
}

.dark .warning-text {
  color: #ff7070;
}

.dark .venue-sources-item:hover {
  background-color: #2a2a2a;
}

.dark .venue-sources-exists {
  background: #3d2f00;
  border: 1px solid #d97706;
  color: #ffd700;
}

.dark .venue-sources-exists p {
  color: #ffd700;
}

.signal-flow-container {
  padding: 20px;
  min-height: 100vh;
  width: 100%;
}

.flow-header {
  margin-bottom: 20px;
  text-align: center;
}

.flow-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: var(--text-primary);
}

.flow-header p {
  margin: 0;
  color: var(--text-secondary);
}

.flow-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 8px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.connection-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid #dee2e6;
  flex-wrap: wrap;
}

.legend-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
  margin-right: 4px;
}

.legend-items {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  display: inline-block;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.legend-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
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
  border-color: var(--color-primary-500);
}

.flow-toolbar .select-btn.active {
  background: var(--color-success-500) !important;
  color: var(--text-inverse) !important;
  border-color: var(--color-success-600) !important;
  border-width: 3px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.flow-toolbar .connect-btn.active {
  background: var(--color-success-500) !important;
  color: var(--text-inverse) !important;
  border-color: var(--color-success-600) !important;
  border-width: 3px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.flow-toolbar .link-btn.active {
  background: var(--color-success-500) !important;
  color: var(--text-inverse) !important;
  border-color: var(--color-success-600) !important;
  border-width: 3px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.btn-add {
  background: var(--color-primary-500) !important;
  color: var(--text-inverse) !important;
  border-color: var(--color-primary-500) !important;
}

.btn-add:hover {
  background: var(--color-primary-600) !important;
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
  color: var(--text-secondary);
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
  width: 100%;
  min-height: 100vh;
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

.connection-details-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 1001;
}
.connection-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}
.connection-details-header h4 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}
.connection-details-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  color: var(--text-primary);
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 0;
  font-size: 13px;
}
.detail-row .label { color: var(--text-muted); }
.detail-row .value { color: var(--text-primary); font-weight: 600; }
.inline-select { padding: 4px 8px; border: 1px solid #dee2e6; border-radius: 6px; }
.port-mapping-section { flex-direction: column; align-items: flex-start; }
.port-mappings-list-edit { width: 100%; }
.port-mapping-row-edit {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}
.port-mapping-row-edit > span:last-of-type {
  margin-right: auto;
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
.btn-edit-small {
  background: var(--color-primary-500);
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
.btn-edit-small:hover {
  background: var(--color-primary-600);
}
.btn-save-small {
  background: var(--color-success-500);
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
  background: var(--color-success-600);
}
.btn-cancel-small {
  background: var(--color-secondary-500);
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
  background: var(--color-secondary-600);
}
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

.form-input-small {
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  flex: 1;
  min-width: 120px;
}

.form-input-small:focus {
  outline: none;
  border-color: #007bff;
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
}

/* Dark mode modal styling */
.dark .modal-content {
  background: #1a1a1a;
  border: 1px solid #404040;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}

.dark .modal-header h3 {
  color: #ffffff;
}

.dark .modal-body {
  color: #e0e0e0;
}

.dark .close-btn {
  color: #ffffff;
  background: #2a2a2a;
  border: 1px solid #404040;
}

.dark .close-btn:hover {
  background: #333333;
}

.dark .modal-header {
  border-bottom: 1px solid #404040;
}

.dark .gear-item {
  background: #2a2a2a;
  border-color: #404040;
}

.dark .gear-item:hover {
  background: #333333;
  border-color: #505050;
}

.dark .gear-name {
  color: #ffffff;
}

.dark .gear-details {
  color: #b0b0b0;
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
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-secondary);
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.numbering-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.numbering-label {
  font-weight: 500;
  color: #495057;
  font-size: 14px;
}

.numbering-select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.numbering-select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.gear-categories {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.gear-categories button {
  flex: 1;
  padding: 10px;
  background: var(--bg-secondary);
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
  border-color: var(--color-primary-500);
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
  background: var(--bg-secondary);
  border-color: var(--color-primary-500);
}

.gear-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.gear-info {
  flex: 1;
}

.gear-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.gear-details {
  font-size: 12px;
  color: var(--text-secondary);
}

.no-gear {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
</style>


