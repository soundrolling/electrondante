<template>
<div class="signal-mapper-parent">
  <!-- Top Navigation Bar -->
  <div class="signalmapper-topbar">
    <button class="back-button" @click="goBack" aria-label="Back">← Back</button>
    <div class="location-label" v-if="currentLocation">
      <strong>Location:</strong>
      {{ currentLocation.venue_name }} – {{ currentLocation.stage_name }}
    </div>
    <div class="location-label" v-else>
      <strong>No location found.</strong>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button 
      :class="['tab-btn', { active: activeTab === 'placement' }]"
      @click="activeTab = 'placement'"
    >
      📍 Mic Placement
    </button>
    <button 
      :class="['tab-btn', { active: activeTab === 'flow' }]"
      @click="activeTab = 'flow'"
    >
      🔗 Signal Flow
    </button>
    <button 
      :class="['tab-btn', { active: activeTab === 'tracklist' }]"
      @click="activeTab = 'tracklist'"
    >
      📊 Track List
    </button>
  </div>

  <!-- Export Actions -->
  <div class="export-actions">
    <button class="btn-export" @click="exportCurrentTab">Export This Tab</button>
    <button class="btn-export-all" @click="exportAllTabs">Export All Tabs (PDF)</button>
  </div>

  <!-- Tab Content -->
  <div class="tab-content">
    <MicPlacement
      v-if="activeTab === 'placement'"
      :projectId="projectId"
      :locationId="locationId"
      :nodes="sourceNodes"
      :gearList="gearList"
      @node-updated="handleNodeUpdated"
      @node-added="handleNodeAdded"
      @node-deleted="handleNodeDeleted"
    />
    
    <SignalFlow
      v-if="activeTab === 'flow'"
      :projectId="projectId"
      :locationId="locationId"
      :nodes="allNodes"
      :connections="allConnections"
      :gearList="gearList"
      @node-updated="handleNodeUpdated"
      @node-added="handleNodeAdded"
      @node-deleted="handleNodeDeleted"
      @connection-added="handleConnectionAdded"
      @connection-updated="handleConnectionUpdated"
      @connection-deleted="handleConnectionDeleted"
    />
    
    <TrackList
      v-if="activeTab === 'tracklist'"
      :projectId="projectId"
      :signalPaths="signalPaths"
      :loading="loadingPaths"
    />
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import { 
  getNodes, 
  getConnections, 
  getSourceNodes,
  getCompleteSignalPath,
  subscribeToNodes,
  subscribeToConnections
} from '@/services/signalMapperService'
import { fetchTableData } from '@/services/dataService'
import MicPlacement from './MicPlacement.vue'
import SignalFlow from './SignalFlow.vue'
import TrackList from './TrackList.vue'

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  },
  locationId: {
    type: [String, Number],
    default: null
  }
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const activeTab = ref('placement')
const currentLocation = ref(null)
const allNodes = ref([])
const allConnections = ref([])
const gearList = ref([])
const signalPaths = ref([])
const loadingPaths = ref(false)

// Computed filtered data
const sourceNodes = computed(() => {
  return allNodes.value.filter(node => 
    node.gear_type === 'source' || node.node_type === 'source'
  )
})

// Navigation
const goBack = () => router.back()

// Load location data
async function fetchLocation() {
  const locId = props.locationId || route.query.locationId
  if (!locId) return

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locId)
    .single()

  if (!error && data) {
    currentLocation.value = data
  }
}

// Load gear list
async function fetchGearList() {
  if (!props.projectId) return

  try {
    const gearData = await fetchTableData('gear_table', { 
      eq: { project_id: props.projectId },
      order: [{ column: 'sort_order', ascending: true }]
    })
    
    const ids = gearData.map(g => g.id)
    const asns = ids.length
      ? await fetchTableData('gear_assignments', { in: { gear_id: ids }})
      : []
    
    const map = {}
    asns.forEach(a => {
      map[a.gear_id] = map[a.gear_id] || {}
      map[a.gear_id][a.location_id] = a.assigned_amount
    })
    
    gearList.value = gearData.map(g => {
      const m = map[g.id] || {}
      const tot = Object.values(m).reduce((s, v) => s + v, 0)
      
      return {
        ...g,
        assignments: m,
        total_assigned: tot,
        unassigned_amount: g.gear_amount - tot
      }
    })
  } catch (err) {
    console.error('Error loading gear:', err)
    toast.error('Failed to load gear list')
  }
}

// Load nodes and connections
async function loadNodesAndConnections() {
  if (!props.projectId) return

  try {
    const [nodes, connections] = await Promise.all([
      getNodes(props.projectId),
      getConnections(props.projectId)
    ])
    
    allNodes.value = nodes
    allConnections.value = connections
    
    // Load signal paths for track list
    await loadSignalPaths()
  } catch (err) {
    console.error('Error loading data:', err)
    toast.error('Failed to load signal mapper data')
  }
}

// Load signal paths
async function loadSignalPaths() {
  if (!props.projectId) return
  
  loadingPaths.value = true
  try {
    signalPaths.value = await getCompleteSignalPath(props.projectId)
  } catch (err) {
    console.error('Error loading signal paths:', err)
    toast.error('Failed to load signal paths')
  } finally {
    loadingPaths.value = false
  }
}

// Export current tab via browser print
function exportCurrentTab() {
  window.print()
}

// Export all tabs to a single print document
function exportAllTabs() {
  const w = window.open('', '_blank')
  if (!w) return
  const style = `
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; color:#111; margin:20px; }
      h1 { font-size:20px; margin:0 0 8px 0; }
      h2 { font-size:18px; margin:18px 0 8px 0; }
      table { width:100%; border-collapse: collapse; margin:8px 0 20px 0; }
      th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; font-size:12px; }
      thead { background:#f8fafc; }
      .section { page-break-inside: avoid; }
      .page-break { page-break-after: always; }
    </style>
  `

  const micRows = (sourceNodes.value || []).map(n => `<tr><td>${n.track_name || ''}</td><td>${n.label || ''}</td></tr>`).join('')
  const micHtml = `
    <div class="section">
      <h1>Mic Placement</h1>
      <table>
        <thead><tr><th>Track</th><th>Source</th></tr></thead>
        <tbody>${micRows || '<tr><td colspan=2>No sources</td></tr>'}</tbody>
      </table>
    </div>
  `

  const nodeLabel = id => (allNodes.value.find(n => n.id === id)?.label) || id
  const flowRows = (allConnections.value || []).map(c => `<tr><td>${nodeLabel(c.from_node_id)}</td><td>→</td><td>${nodeLabel(c.to_node_id)}</td></tr>`).join('')
  const flowHtml = `
    <div class="section page-break">
      <h1>Signal Flow (Connections)</h1>
      <table>
        <thead><tr><th>From</th><th></th><th>To</th></tr></thead>
        <tbody>${flowRows || '<tr><td colspan=3>No connections</td></tr>'}</tbody>
      </table>
    </div>
  `

  const tlRows = (signalPaths.value || []).map(p => `<tr><td>${p.track_number || ''}</td><td>${p.recorder_label || ''}</td><td>${p.track_name || p.source_label || ''}</td><td>${(p.path || []).join(' → ')}</td></tr>`).join('')
  const tlHtml = `
    <div class="section">
      <h1>Track List</h1>
      <table>
        <thead><tr><th>Track #</th><th>Recorder</th><th>Source</th><th>Signal Path</th></tr></thead>
        <tbody>${tlRows || '<tr><td colspan=4>No tracks</td></tr>'}</tbody>
      </table>
    </div>
  `

  w.document.write(`<!doctype html><html><head><meta charset=\"utf-8\">${style}</head><body>${micHtml}${flowHtml}${tlHtml}</body></html>`)
  w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } finally { w.close(); } }, 250)
}

// Event handlers
function handleNodeUpdated(node) {
  const index = allNodes.value.findIndex(n => n.id === node.id)
  if (index !== -1) {
    allNodes.value[index] = { ...allNodes.value[index], ...node }
  }
  loadSignalPaths()
}

function handleNodeAdded(node) {
  if (!allNodes.value.some(n => n.id === node.id)) {
    allNodes.value.push(node)
  }
  loadSignalPaths()
}

function handleNodeDeleted(nodeId) {
  allNodes.value = allNodes.value.filter(n => n.id !== nodeId)
  loadSignalPaths()
}

function handleConnectionAdded(connection) {
  if (!allConnections.value.some(c => c.id === connection.id)) {
    allConnections.value.push(connection)
  }
  loadSignalPaths()
}

function handleConnectionUpdated(connection) {
  const index = allConnections.value.findIndex(c => c.id === connection.id)
  if (index !== -1) {
    allConnections.value[index] = { ...allConnections.value[index], ...connection }
  }
  loadSignalPaths()
}

function handleConnectionDeleted(connectionId) {
  allConnections.value = allConnections.value.filter(c => c.id !== connectionId)
  loadSignalPaths()
}

// Setup realtime subscriptions
function setupRealtimeSubscriptions() {
  if (!props.projectId) return

  const nodesSubscription = subscribeToNodes(props.projectId, (payload) => {
    if (payload.eventType === 'INSERT') {
      handleNodeAdded(payload.new)
    } else if (payload.eventType === 'UPDATE') {
      handleNodeUpdated(payload.new)
    } else if (payload.eventType === 'DELETE') {
      handleNodeDeleted(payload.old.id)
    }
  })

  const connectionsSubscription = subscribeToConnections(props.projectId, (payload) => {
    if (payload.eventType === 'INSERT') {
      handleConnectionAdded(payload.new)
    } else if (payload.eventType === 'UPDATE') {
      handleConnectionUpdated(payload.new)
    } else if (payload.eventType === 'DELETE') {
      handleConnectionDeleted(payload.old.id)
    }
  })

  return () => {
    nodesSubscription?.unsubscribe()
    connectionsSubscription?.unsubscribe()
  }
}

// Lifecycle
onMounted(async () => {
  await fetchLocation()
  await fetchGearList()
  await loadNodesAndConnections()
  const cleanup = setupRealtimeSubscriptions()
  
  // Cleanup on unmount
  return cleanup
})
</script>

<style scoped>
.signal-mapper-parent {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.signalmapper-topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.back-button {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background: #5a6268;
}

.location-label {
  font-size: 14px;
  color: #495057;
}

.tab-navigation {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
  color: #495057;
}

.tab-btn:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.tab-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.tab-content {
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  min-height: 500px;
}

.export-actions { display:flex; gap:8px; margin: 6px 0 12px 0; }
.btn-export, .btn-export-all { padding:8px 12px; border:none; border-radius:6px; cursor:pointer; color:#fff; }
.btn-export { background:#111827; }
.btn-export-all { background:#0f766e; }
.btn-export:hover, .btn-export-all:hover { opacity: 0.92; }

@media (max-width: 768px) {
  .signal-mapper-parent {
    padding: 15px;
  }

  .tab-navigation {
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
  }
}
</style>

