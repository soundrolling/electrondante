<template>
<div v-if="!isReady" class="loading-state">
  <div v-if="loadingNodes || loadingConnections" class="loading-indicator">
    <p>Loading documentation...</p>
    <div class="loading-spinner"></div>
  </div>
  <div v-else-if="error" class="error-state">
    <p>Error loading documentation: {{ error }}</p>
    <button @click="loadDocumentationData" class="retry-btn">Retry</button>
  </div>
  <div v-else class="no-data-state">
    <p>No documentation data available</p>
  </div>
</div>
<div v-else class="signalmapper-documentation" :key="`doc-${nodes.length}-${connections.length}`">
  <!-- Documentation Header -->
  <div class="doc-header">
    <h3>Signal Mapper Documentation</h3>
    <p>Comprehensive documentation of your signal flow setup</p>
  </div>

  <!-- Gear Inventory Section -->
  <div class="doc-section">
    <h4>🎵 Gear Inventory</h4>
    <div class="gear-inventory">
      <div v-if="!gearCategories || gearCategories.length === 0" class="no-gear">
        <p>No gear found in the signal mapper</p>
      </div>
      <div v-else v-for="category in gearCategories" :key="category.name" class="gear-category" v-if="category">
        <h5>{{ category.name }}</h5>
        <div class="gear-list">
          <div v-if="!category.items || category.items.length === 0" class="no-items">
            <p>No items in this category</p>
          </div>
          <div 
            v-else v-for="gear in category.items" 
            :key="gear.id" 
            class="gear-item"
            v-if="gear"
          >
            <div class="gear-icon">{{ gear.icon || '🎵' }}</div>
            <div class="gear-info">
              <div class="gear-name">{{ gear.label || 'Unknown Gear' }}</div>
              <div class="gear-details">
                {{ gear.num_inputs || gear.numinputs || 0 }} in, {{ gear.num_outputs || 0 }} out
                <span v-if="gear.num_tracks">, {{ gear.num_tracks }} tracks</span>
              </div>
              <div class="gear-position">
                Position: ({{ gear.x || 0 }}, {{ gear.y || 0 }})
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Signal Flow Summary -->
  <div class="doc-section">
    <h4>🔗 Signal Flow Summary</h4>
    <div class="flow-summary">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon">🎤</div>
          <div class="card-content">
            <div class="card-title">Sources</div>
            <div class="card-value">{{ totalSources }}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">⚡</div>
          <div class="card-content">
            <div class="card-title">Transformers</div>
            <div class="card-value">{{ totalTransformers }}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">📼</div>
          <div class="card-content">
            <div class="card-title">Recorders</div>
            <div class="card-value">{{ totalRecorders }}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="card-icon">🔗</div>
          <div class="card-content">
            <div class="card-title">Connections</div>
            <div class="card-value">{{ totalConnections }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Connection Matrix -->
  <div class="doc-section">
    <h4>📊 Connection Matrix</h4>
    <div class="connection-matrix">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Input</th>
            <th>Output</th>
            <th>Track</th>
            <th>Pad</th>
            <th>Phantom Power</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="connection in connections" :key="connection.id" v-if="connection">
            <td>{{ getNodeLabel(connection.from_node_id || connection.from) }}</td>
            <td>{{ getNodeLabel(connection.to_node_id || connection.to) }}</td>
            <td>{{ connection.input_number || '\u2014' }}</td>
            <td v-if="connection.output_number && connection.input_number">{{ connection.output_number }}</td>
            <td v-else>\u2014</td>
            <td>{{ connection.track_number || '\u2014' }}</td>
            <td>
              <span :class="['status-badge', { 'active': connection.pad }]">
                {{ connection.pad ? 'Yes' : 'No' }}
              </span>
            </td>
            <td>
              <span :class="['status-badge', { 'active': connection.phantom_power }]">
                {{ connection.phantom_power ? 'Yes' : 'No' }}
              </span>
            </td>
            <td>
              <span class="status-badge connected">Connected</span>
            </td>
          </tr>
          <tr v-if="!connections || connections.length === 0">
            <td colspan="8" class="no-data">No connections found</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Signal Paths -->
  <div class="doc-section">
    <h4>🛤️ Signal Paths</h4>
    <div class="signal-paths">
      <div v-for="path in signalPaths" :key="path.id" class="signal-path" v-if="path">
        <div class="path-header">
          <span class="path-source">{{ path.source || 'Unknown' }}</span>
          <span class="path-arrow">→</span>
          <span class="path-destination">{{ path.destination || 'Unknown' }}</span>
        </div>
        <div class="path-details">
          <div class="path-route">
            <span class="route-label">Route:</span>
            <span class="route-path">{{ path.route }}</span>
          </div>
          <div class="path-tracks">
            <span class="tracks-label">Tracks:</span>
            <span class="tracks-list">{{ path.tracks && path.tracks.length ? path.tracks.join(', ') : 'None' }}</span>
          </div>
          <div class="path-properties">
            <span v-if="path.pad" class="property-badge">Pad</span>
            <span v-if="path.phantom_power" class="property-badge">+48V</span>
          </div>
        </div>
      </div>
      <div v-if="!signalPaths || signalPaths.length === 0" class="no-paths">
        No signal paths defined
      </div>
    </div>
  </div>

  <!-- Track Assignment -->
  <div class="doc-section">
    <h4>🎛️ Track Assignment</h4>
    <div class="track-assignment">
      <div v-if="!recorders || recorders.length === 0" class="no-recorders">
        <p>No recorders found in the signal mapper</p>
      </div>
      <div v-else v-for="recorder in recorders" :key="recorder.id" class="recorder-tracks" v-if="recorder">
        <h5>{{ recorder.label || 'Unknown Recorder' }}</h5>
        <div class="tracks-grid">
          <div v-if="!recorder.tracks || recorder.tracks.length === 0" class="no-tracks">
            <p>No tracks available</p>
          </div>
          <div 
            v-else v-for="track in recorder.tracks" 
            :key="track.number"
            :class="['track-item', { assigned: track.assigned }]"
            v-if="track"
          >
            <div class="track-number">{{ track.number }}</div>
            <div class="track-source">{{ track.source || 'Unassigned' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Export Options -->
  <div class="doc-section">
    <h4>📤 Export Options</h4>
    <div class="export-options">
      <div class="export-group">
        <h5>Documentation</h5>
        <div class="export-buttons">
          <button @click="exportFullDocumentation" class="export-btn primary">
            📄 Full Documentation PDF
          </button>
          <button @click="exportSignalFlowDoc" class="export-btn secondary">
            🔗 Signal Flow Report
          </button>
        </div>
      </div>
      
      <div class="export-group">
        <h5>Technical</h5>
        <div class="export-buttons">
          <button @click="exportConnectionMatrix" class="export-btn technical">
            📊 Connection Matrix CSV
          </button>
          <button @click="exportTrackAssignment" class="export-btn technical">
            🎛️ Track Assignment Sheet
          </button>
        </div>
      </div>
      
      <div class="export-group">
        <h5>Data</h5>
        <div class="export-buttons">
          <button @click="exportJSON" class="export-btn data">
            📋 JSON Data Export
          </button>
          <button @click="exportXML" class="export-btn data">
            📄 XML Data Export
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Print Preview -->
  <div class="doc-section">
    <h4>🖨️ Print Preview</h4>
    <div class="print-preview">
      <button @click="printDocumentation" class="print-btn">
        🖨️ Print Documentation
      </button>
      <div class="print-info">
        <p>This will generate a printer-friendly version of the documentation</p>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { useGraphStore } from '@/stores/graphStore'
import { jsPDF } from 'jspdf'
import { downloadPDF } from '@/utils/pdfDownloadHelper'
import { getNodes, getConnections } from '@/services/signalMapperService'

const props = defineProps({
locationId: {
  type: [String, Number],
  required: true
},
projectId: {
  type: [String, Number],
  required: true
},
gear: {
  type: Array,
  default: () => []
},
connections: {
  type: Array,
  default: () => []
}
})

const graphStore = useGraphStore()

// Loading states
const loadingNodes = ref(false)
const loadingConnections = ref(false)
const error = ref(null)

// Data from Supabase
const nodesData = ref([])
const connectionsData = ref([])

// Load data from Supabase
async function loadDocumentationData() {
if (!props.projectId) return

loadingNodes.value = true
loadingConnections.value = true
error.value = null

try {
  // Load nodes and connections from Supabase
  const [nodes, connections] = await Promise.all([
    getNodes(props.projectId),
    getConnections(props.projectId)
  ])
  
  nodesData.value = nodes
  connectionsData.value = connections
} catch (err) {
  console.error('Error loading documentation data:', err)
  error.value = err.message || 'Failed to load documentation data'
} finally {
  loadingNodes.value = false
  loadingConnections.value = false
}
}

// Use passed data or fall back to Supabase data
const nodes = computed(() => {
const gear = props.gear || []
const storeNodes = graphStore.nodes || []
const supabaseNodes = nodesData.value || []

if (Array.isArray(gear) && gear.length > 0) {
  return gear
}
if (Array.isArray(supabaseNodes) && supabaseNodes.length > 0) {
  return supabaseNodes
}
return storeNodes
})

const connections = computed(() => {
const conns = props.connections || []
const storeConnections = graphStore.connections || []
const supabaseConnections = connectionsData.value || []

if (Array.isArray(conns) && conns.length > 0) {
  return conns
}
if (Array.isArray(supabaseConnections) && supabaseConnections.length > 0) {
  return supabaseConnections
}
return storeConnections
})

// Reactive guard to ensure data is ready
const isReady = computed(() => {
return !loadingNodes.value && !loadingConnections.value && !error.value && 
       Array.isArray(nodes.value) && Array.isArray(connections.value)
})

// Computed properties
const gearCategories = computed(() => {
const categories = {
  sources: { name: 'Sources', items: [] },
  transformers: { name: 'Transformers', items: [] },
  recorders: { name: 'Recorders', items: [] },
  other: { name: 'Other', items: [] }
}

if (!nodes.value || !Array.isArray(nodes.value)) {
  return []
}

nodes.value.forEach(node => {
  if (!node || typeof node !== 'object') return
  const gearType = node.gearType || node.node_type || 'other'
  switch (gearType) {
    case 'source':
      categories.sources.items.push(node)
      break
    case 'transformer':
      categories.transformers.items.push(node)
      break
    case 'recorder':
      categories.recorders.items.push(node)
      break
    default:
      categories.other.items.push(node)
  }
})

return Object.values(categories).filter(cat => Array.isArray(cat.items) && cat.items.length > 0)
})

const totalSources = computed(() => {
if (!nodes.value || !Array.isArray(nodes.value)) return 0
return nodes.value.filter(node => node && typeof node === 'object' && (node.gearType || node.node_type) === 'source').length
})

const totalTransformers = computed(() => {
if (!nodes.value || !Array.isArray(nodes.value)) return 0
return nodes.value.filter(node => node && typeof node === 'object' && (node.gearType || node.node_type) === 'transformer').length
})

const totalRecorders = computed(() => {
if (!nodes.value || !Array.isArray(nodes.value)) return 0
return nodes.value.filter(node => node && typeof node === 'object' && (node.gearType || node.node_type) === 'recorder').length
})

const totalConnections = computed(() => {
if (!connections.value || !Array.isArray(connections.value)) return 0
return connections.value.filter(conn => conn && typeof conn === 'object').length
})

const signalPaths = computed(() => {
if (!connections.value || !Array.isArray(connections.value)) return []

return connections.value.map(conn => {
  if (!conn || typeof conn !== 'object') return null
  const fromNode = nodes.value?.find(n => n && typeof n === 'object' && (n.id === conn.from_node_id || n.id === conn.from))
  const toNode = nodes.value?.find(n => n && typeof n === 'object' && (n.id === conn.to_node_id || n.id === conn.to))
  
  return {
    id: conn.id || `conn_${Date.now()}`,
    source: fromNode?.label || 'Unknown',
    destination: toNode?.label || 'Unknown',
    route: `${fromNode?.label || 'Unknown'} // ${toNode?.label || 'Unknown'}`,
    tracks: Array.isArray(conn.track_number) ? conn.track_number : (conn.track_number ? [conn.track_number] : []),
    pad: conn.pad || false,
    phantom_power: conn.phantom_power || false
  }
}).filter(Boolean) // Remove null entries
})

const recorders = computed(() => {
if (!nodes.value || !Array.isArray(nodes.value)) return []

return nodes.value
  .filter(node => node && typeof node === 'object' && (node.gearType || node.node_type) === 'recorder')
  .map(recorder => {
    if (!recorder || typeof recorder !== 'object') return null
    const tracks = []
    const numTracks = recorder.num_tracks || recorder.tracks || recorder.num_records || recorder.numrecord || 0
    for (let i = 1; i <= numTracks; i++) {
      const connection = connections.value?.find(conn => 
        conn && typeof conn === 'object' && (conn.to_node_id === recorder.id || conn.to === recorder.id) && conn.track_number === i
      )
      tracks.push({
        number: i,
        assigned: !!connection,
        source: connection ? getNodeLabel(connection.from_node_id || connection.from) : null
      })
    }
    
    return {
      ...recorder,
      tracks
    }
  }).filter(Boolean) // Remove null entries
})

// Helper functions
function getNodeLabel(nodeId) {
if (!nodeId || !nodes.value || !Array.isArray(nodes.value)) return 'Unknown'
const node = nodes.value.find(n => n && typeof n === 'object' && n.id === nodeId)
return node?.label || 'Unknown'
}

// Export functions
async function exportFullDocumentation() {
const doc = new jsPDF('portrait', 'mm', 'a4')
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()

let yPos = 20

// Title
doc.setFontSize(20)
doc.text('Signal Mapper Documentation', pageW / 2, yPos, { align: 'center' })
yPos += 15

doc.setFontSize(12)
doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, yPos, { align: 'center' })
yPos += 20

// Summary
doc.setFontSize(16)
doc.text('Summary', 20, yPos)
yPos += 10

doc.setFontSize(12)
doc.text(`Sources: ${totalSources.value}`, 30, yPos)
yPos += 8
doc.text(`Transformers: ${totalTransformers.value}`, 30, yPos)
yPos += 8
doc.text(`Recorders: ${totalRecorders.value}`, 30, yPos)
yPos += 8
doc.text(`Connections: ${totalConnections.value}`, 30, yPos)
yPos += 15

// Gear Inventory
if (yPos > pageH - 100) {
  doc.addPage()
  yPos = 20
}

doc.setFontSize(16)
doc.text('Gear Inventory', 20, yPos)
yPos += 10

gearCategories.value.forEach(category => {
  if (yPos > pageH - 80) {
    doc.addPage()
    yPos = 20
  }
  
  doc.setFontSize(14)
  doc.text(category.name, 30, yPos)
  yPos += 8
  
  doc.setFontSize(10)
  category.items.forEach(item => {
    const text = `${item.label} (${item.numinputs || 0} in, ${item.num_outputs || 0} out)`
    doc.text(text, 40, yPos)
    yPos += 6
  })
  yPos += 5
})

// Connections
if (yPos > pageH - 80) {
  doc.addPage()
  yPos = 20
}

doc.setFontSize(16)
doc.text('Connections', 20, yPos)
yPos += 10

doc.setFontSize(10)
connections.value.forEach(conn => {
  const fromNode = getNodeLabel(conn.from_node_id)
  const toNode = getNodeLabel(conn.to_node_id)
  // Use "//" instead of "→" for PDF compatibility
  const text = `${fromNode} // ${toNode} (In: ${conn.input_number || '—'}, Out: ${conn.output_number || '—'})`
  doc.text(text, 30, yPos)
  yPos += 6
})

// Save PDF to storage instead of downloading
const fileName = `signal-mapper-documentation-${Date.now()}.pdf`
let venueId = null
if (props.locationId) {
  try {
    const { data: locationData } = await supabase
      .from('locations')
      .select('venue_id')
      .eq('id', props.locationId)
      .single()
    
    if (locationData) {
      venueId = locationData.venue_id || null
    }
  } catch (err) {
    console.warn('Error fetching venue_id:', err)
  }
}

const { savePDFToStorage } = await import('@/services/exportStorageService')
const description = 'Signal mapper documentation export'

const result = await savePDFToStorage(
  doc,
  fileName,
  props.projectId,
  venueId,
  props.locationId,
  description
)

if (result.success) {
  toast.success('PDF exported to Data Management successfully')
} else {
  toast.error(`Failed to save export: ${result.error || 'Unknown error'}`)
}
}

async function exportSignalFlowDoc() {
const doc = new jsPDF('portrait', 'mm', 'a4')
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()

let yPos = 20

doc.setFontSize(20)
doc.text('Signal Flow Report', pageW / 2, yPos, { align: 'center' })
yPos += 20

doc.setFontSize(12)
signalPaths.value.forEach((path, index) => {
  if (yPos > pageH - 60) {
    doc.addPage()
    yPos = 20
  }
  
  doc.setFontSize(14)
  // Use "//" instead of "→" for PDF compatibility
  doc.text(`Path ${index + 1}: ${path.source} // ${path.destination}`, 20, yPos)
  yPos += 10
  
  doc.setFontSize(10)
  doc.text(`Route: ${path.route}`, 30, yPos)
  yPos += 8
  
  if (path.tracks.length > 0) {
    doc.text(`Tracks: ${path.tracks.join(', ')}`, 30, yPos)
    yPos += 8
  }
  
  yPos += 10
})

// Save PDF to storage instead of downloading
const fileName = `signal-flow-report-${Date.now()}.pdf`
let venueId = null
if (props.locationId) {
  try {
    const { data: locationData } = await supabase
      .from('locations')
      .select('venue_id')
      .eq('id', props.locationId)
      .single()
    
    if (locationData) {
      venueId = locationData.venue_id || null
    }
  } catch (err) {
    console.warn('Error fetching venue_id:', err)
  }
}

const { savePDFToStorage } = await import('@/services/exportStorageService')
const description = 'Signal flow report export'

const result = await savePDFToStorage(
  doc,
  fileName,
  props.projectId,
  venueId,
  props.locationId,
  description
)

if (result.success) {
  toast.success('PDF exported to Data Management successfully')
} else {
  toast.error(`Failed to save export: ${result.error || 'Unknown error'}`)
}
}

function exportConnectionMatrix() {
let csv = 'From,To,Input,Output,Track\n'

connections.value.forEach(conn => {
  const fromNode = getNodeLabel(conn.from_node_id)
  const toNode = getNodeLabel(conn.to_node_id)
  csv += `${fromNode},${toNode},${conn.input_number || ''},${conn.output_number || ''},${conn.track_number || ''}\n`
})

const blob = new Blob([csv], { type: 'text/csv' })
const link = document.createElement('a')
link.download = 'connection-matrix.csv'
link.href = URL.createObjectURL(blob)
link.click()
}

function exportTrackAssignment() {
let csv = 'Recorder,Track,Source,Status\n'

recorders.value.forEach(recorder => {
  recorder.tracks.forEach(track => {
    csv += `${recorder.label},${track.number},${track.source || ''},${track.assigned ? 'Assigned' : 'Unassigned'}\n`
  })
})

const blob = new Blob([csv], { type: 'text/csv' })
const link = document.createElement('a')
link.download = 'track-assignment.csv'
link.href = URL.createObjectURL(blob)
link.click()
}

function exportJSON() {
const data = {
  nodes: nodes.value,
  connections: connections.value,
  summary: {
    sources: totalSources.value,
    transformers: totalTransformers.value,
    recorders: totalRecorders.value,
    connections: totalConnections.value
  },
  exported_at: new Date().toISOString()
}

const dataStr = JSON.stringify(data, null, 2)
const blob = new Blob([dataStr], { type: 'application/json' })
const link = document.createElement('a')
link.download = 'signal-mapper-data.json'
link.href = URL.createObjectURL(blob)
link.click()
}

function exportXML() {
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
xml += '<signal-mapper>\n'
xml += `  <exported-at>${new Date().toISOString()}</exported-at>\n`
xml += '  <summary>\n'
xml += `    <sources>${totalSources.value}</sources>\n`
xml += `    <transformers>${totalTransformers.value}</transformers>\n`
xml += `    <recorders>${totalRecorders.value}</recorders>\n`
xml += `    <connections>${totalConnections.value}</connections>\n`
xml += '  </summary>\n'
xml += '  <nodes>\n'

nodes.value.forEach(node => {
  xml += `    <node id="${node.id}" type="${node.node_type}">\n`
  xml += `      <label>${node.label}</label>\n`
  xml += `      <position x="${node.x}" y="${node.y}" />\n`
  xml += `      <ports inputs="${node.numinputs || 0}" outputs="${node.num_outputs || 0}" tracks="${node.num_tracks || 0}" />\n`
  xml += '    </node>\n'
})

xml += '  </nodes>\n'
xml += '  <connections>\n'

connections.value.forEach(conn => {
  xml += `    <connection id="${conn.id}">\n`
  xml += `      <from>${conn.from_node_id}</from>\n`
  xml += `      <to>${conn.to_node_id}</to>\n`
  xml += `      <input>${conn.input_number || ''}</input>\n`
  xml += `      <output>${conn.output_number || ''}</output>\n`
  xml += `      <track>${conn.track_number || ''}</track>\n`
  xml += '    </connection>\n'
})

xml += '  </connections>\n'
xml += '</signal-mapper>'

const blob = new Blob([xml], { type: 'application/xml' })
const link = document.createElement('a')
link.download = 'signal-mapper-data.xml'
link.href = URL.createObjectURL(blob)
link.click()
}

function printDocumentation() {
window.print()
}

// Load data on mount
onMounted(async () => {
await loadDocumentationData()
})
</script>

<style scoped>
.signalmapper-documentation {
padding: 20px;
}

.doc-header {
margin-bottom: 30px;
text-align: center;
padding: 20px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

.doc-header h3 {
margin: 0 0 10px 0;
color: var(--text-secondary);
font-size: 24px;
font-weight: 600;
}

.doc-header p {
margin: 0;
color: var(--text-secondary);
font-size: 16px;
}

.doc-section {
margin-bottom: 30px;
padding: 20px;
background: white;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.doc-section h4 {
margin: 0 0 20px 0;
color: var(--text-secondary);
font-size: 18px;
font-weight: 600;
}

/* Gear Inventory */
.gear-inventory {
display: grid;
gap: 20px;
}

.gear-category h5 {
margin: 0 0 15px 0;
color: var(--text-secondary);
font-size: 16px;
font-weight: 600;
padding-bottom: 8px;
border-bottom: 2px solid #e9ecef;
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
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

.gear-icon {
font-size: 24px;
width: 50px;
height: 50px;
display: flex;
align-items: center;
justify-content: center;
background: white;
border-radius: 8px;
border: 1px solid #dee2e6;
}

.gear-info {
flex: 1;
}

.gear-name {
font-weight: 600;
color: #212529;
margin-bottom: 4px;
font-size: 14px;
}

.gear-details {
font-size: 12px;
color: var(--text-secondary);
margin-bottom: 4px;
}

.gear-position {
font-size: 11px;
color: var(--text-tertiary);
}

/* Summary Cards */
.flow-summary {
max-width: 100%;
overflow-x: auto;
}

.summary-cards {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
gap: 20px;
width: 100%;
max-width: 700px;
margin: 0 auto;
box-sizing: border-box;
}

.summary-card {
display: flex;
align-items: center;
gap: 15px;
padding: 20px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

.card-icon {
font-size: 32px;
width: 60px;
height: 60px;
display: flex;
align-items: center;
justify-content: center;
background: white;
border-radius: 8px;
border: 1px solid #dee2e6;
}

.card-content {
flex: 1;
}

.card-title {
font-size: 14px;
color: var(--text-secondary);
margin-bottom: 4px;
}

.card-value {
font-size: 24px;
font-weight: 700;
color: var(--color-primary-500);
}

/* Connection Matrix */
.connection-matrix {
overflow-x: auto;
}

.matrix-table {
width: 100%;
border-collapse: collapse;
background: white;
border-radius: 8px;
overflow: hidden;
border: 1px solid #e9ecef;
}

.matrix-table th {
background: var(--bg-secondary);
padding: 12px;
text-align: left;
font-weight: 600;
color: var(--text-secondary);
border-bottom: 1px solid #e9ecef;
font-size: 14px;
}

.matrix-table td {
padding: 12px;
border-bottom: 1px solid #e9ecef;
font-size: 14px;
}

.matrix-table tr:hover {
background: var(--bg-secondary);
}

.status-badge {
padding: 4px 8px;
border-radius: 4px;
font-size: 12px;
font-weight: 500;
}

.status-badge.connected {
background: rgba(34, 197, 94, 0.15);
color: var(--color-success-700);
}

.status-badge.active {
background: rgba(34, 197, 94, 0.15);
color: var(--color-success-700);
}

.property-badge {
display: inline-block;
padding: 4px 8px;
border-radius: 4px;
font-size: 12px;
font-weight: 600;
background: rgba(34, 197, 94, 0.15);
color: var(--color-success-700);
margin-right: 5px;
}

.path-properties {
margin-top: 8px;
}

.no-data {
text-align: center;
color: var(--text-secondary);
font-style: italic;
}

/* Signal Paths */
.signal-paths {
display: grid;
gap: 15px;
}

.signal-path {
padding: 15px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

.path-header {
display: flex;
align-items: center;
gap: 10px;
margin-bottom: 10px;
font-weight: 600;
color: var(--text-secondary);
}

.path-arrow {
color: var(--color-primary-500);
font-weight: bold;
}

.path-details {
display: grid;
gap: 8px;
}

.path-route,
.path-tracks {
display: flex;
gap: 8px;
font-size: 14px;
}

.route-label,
.tracks-label {
font-weight: 500;
color: var(--text-secondary);
min-width: 60px;
}

.route-path,
.tracks-list {
color: var(--text-secondary);
}

.no-paths {
text-align: center;
color: var(--text-secondary);
font-style: italic;
padding: 20px;
}

/* Track Assignment */
.track-assignment {
display: grid;
gap: 20px;
}

.recorder-tracks h5 {
margin: 0 0 15px 0;
color: var(--text-secondary);
font-size: 16px;
font-weight: 600;
padding-bottom: 8px;
border-bottom: 2px solid #e9ecef;
}

.tracks-grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
gap: 10px;
}

.track-item {
padding: 10px;
background: var(--bg-secondary);
border-radius: 6px;
border: 1px solid #e9ecef;
text-align: center;
}

.track-item.assigned {
background: #d4edda;
border-color: #c3e6cb;
}

.track-number {
font-weight: 600;
color: var(--text-secondary);
margin-bottom: 4px;
}

.track-source {
font-size: 12px;
color: var(--text-secondary);
}

/* Export Options */
.export-options {
display: grid;
gap: 20px;
}

.export-group h5 {
margin: 0 0 15px 0;
color: var(--text-secondary);
font-size: 16px;
font-weight: 600;
padding-bottom: 8px;
border-bottom: 2px solid #e9ecef;
}

.export-buttons {
display: flex;
gap: 10px;
flex-wrap: wrap;
}

.export-btn {
padding: 12px 20px;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 14px;
font-weight: 500;
transition: all 0.2s;
}

.export-btn.primary {
background: #007bff;
color: white;
}

.export-btn.primary:hover {
background: #0056b3;
}

.export-btn.secondary {
background: #6c757d;
color: white;
}

.export-btn.secondary:hover {
background: #545b62;
}

.export-btn.technical {
background: #28a745;
color: white;
}

.export-btn.technical:hover {
background: #218838;
}

.export-btn.data {
background: #ffc107;
color: #212529;
}

.export-btn.data:hover {
background: #e0a800;
}

/* Print Preview */
.print-preview {
text-align: center;
padding: 20px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

.print-btn {
padding: 15px 30px;
background: #007bff;
color: white;
border: none;
border-radius: 8px;
cursor: pointer;
font-size: 16px;
font-weight: 500;
transition: background-color 0.2s;
}

.print-btn:hover {
background: #0056b3;
}

.print-info {
margin-top: 15px;
}

.print-info p {
margin: 0;
color: var(--text-secondary);
font-size: 14px;
}

.loading-state {
text-align: center;
padding: 40px;
color: var(--text-secondary);
}

.loading-state p {
margin: 0;
font-size: 16px;
}

.loading-indicator {
display: flex;
flex-direction: column;
align-items: center;
gap: 20px;
}

.loading-spinner {
width: 40px;
height: 40px;
border: 4px solid #e9ecef;
border-top: 4px solid #007bff;
border-radius: 50%;
animation: spin 1s linear infinite;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

.error-state {
display: flex;
flex-direction: column;
align-items: center;
gap: 20px;
padding: 40px;
color: #dc3545;
}

.error-state p {
margin: 0;
font-size: 16px;
text-align: center;
}

.retry-btn {
padding: 10px 20px;
background: #007bff;
color: white;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 14px;
font-weight: 500;
transition: background-color 0.2s;
}

.retry-btn:hover {
background: #0056b3;
}

.no-data-state {
text-align: center;
padding: 40px;
color: var(--text-secondary);
}

.no-data-state p {
margin: 0;
font-size: 16px;
}

.no-gear,
.no-recorders,
.no-tracks,
.no-items {
text-align: center;
color: var(--text-secondary);
font-style: italic;
padding: 20px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e9ecef;
}

@media (max-width: 800px) {
.summary-cards {
  grid-template-columns: 1fr 1fr;
  max-width: 100%;
}
}
@media (max-width: 500px) {
.summary-cards {
  grid-template-columns: 1fr;
}
}
</style> 