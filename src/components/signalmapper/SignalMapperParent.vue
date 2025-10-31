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
    <button 
      :class="['tab-btn', { active: activeTab === 'export' }]"
      @click="activeTab = 'export'"
    >
      📤 Export
    </button>
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

    <!-- Export Tab: shows Mic Placement canvas, Signal Flow canvas, and Track List with totals -->
    <div v-if="activeTab === 'export'" class="export-tab">
      <!-- Hidden render of canvases to capture data URLs -->
      <div class="offscreen" aria-hidden="true">
        <MicPlacement
          ref="micPlacementRef"
          :projectId="projectId"
          :locationId="locationId"
          :nodes="sourceNodes"
          :gearList="gearList"
        />
        <SignalFlow
          ref="signalFlowRef"
          :projectId="projectId"
          :locationId="locationId"
          :nodes="allNodes"
          :connections="allConnections"
          :gearList="gearList"
        />
      </div>

      <div class="export-section">
        <h3>Mic Placement</h3>
        <div class="export-canvas-frame" v-if="exportMicDataUrl">
          <img :src="exportMicDataUrl" alt="Mic Placement" />
        </div>
        <div v-else class="export-placeholder">Preparing mic placement…</div>
      </div>

      <div class="export-section">
        <h3>Signal Flow</h3>
        <div class="export-canvas-frame" v-if="exportFlowDataUrl">
          <img :src="exportFlowDataUrl" alt="Signal Flow" />
        </div>
        <div v-else class="export-placeholder">Preparing signal flow…</div>
      </div>

      <div class="export-section">
        <h3>Track List</h3>
        <table class="export-table">
          <thead>
            <tr>
              <th>Track #</th>
              <th>Recorder</th>
              <th>Source Name</th>
              <th>Signal Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="path in signalPaths" :key="path.connection_id">
              <td>{{ path.track_number || '—' }}</td>
              <td>{{ path.recorder_label }}</td>
              <td>{{ path.track_name || path.source_label || '—' }}</td>
              <td>{{ (path.path || []).join(' → ') }}</td>
            </tr>
            <tr v-if="signalPaths.length === 0"><td colspan="4">No tracks</td></tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="tfoot-label">Total Tracks</td>
              <td class="tfoot-value">{{ signalPaths.length }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="export-actions-row">
          <button class="btn-export" @click="printExport">Print / Save as PDF</button>
          <button class="btn-export-all" @click="downloadImages">Download PNGs</button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
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

// Export tab refs/state
const micPlacementRef = ref(null)
const signalFlowRef = ref(null)
const exportMicDataUrl = ref(null)
const exportFlowDataUrl = ref(null)

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

 

// Prepare export images when Export tab becomes active
watch(activeTab, async (tab) => {
  if (tab !== 'export') return
  await nextTick()
  // Give child components a tick to render
  await nextTick()
  try {
    exportMicDataUrl.value = micPlacementRef.value?.getCanvasDataURL?.() || null
  } catch {}
  try {
    exportFlowDataUrl.value = signalFlowRef.value?.getCanvasDataURL?.() || null
  } catch {}
})

function printExport() {
  window.print()
}

function downloadImages() {
  const downloads = [
    { url: exportMicDataUrl.value, name: `mic-placement-${props.projectId}-${props.locationId}.png` },
    { url: exportFlowDataUrl.value, name: `signal-flow-${props.projectId}-${props.locationId}.png` }
  ].filter(x => !!x.url)
  downloads.forEach(d => {
    const a = document.createElement('a')
    a.href = d.url
    a.download = d.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  })
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
  background: #2563eb; /* blue-600 */
  color: #ffffff;
  border-color: #1d4ed8; /* blue-700 */
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35), 0 6px 14px rgba(37, 99, 235, 0.25);
  font-weight: 700;
}

.tab-content {
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  min-height: 500px;
}

.export-tab { padding: 16px; }
.offscreen { position: absolute; left: -99999px; top: -99999px; visibility: hidden; width: 0; height: 0; overflow: hidden; }
.export-section { margin-bottom: 24px; }
.export-canvas-frame { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background:#fff; }
.export-canvas-frame img { max-width: 100%; height: auto; display: block; }
.export-placeholder { color: #6b7280; font-size: 14px; }
.export-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.export-table th, .export-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 14px; }
.export-table thead { background: #f9fafb; }
.tfoot-label { text-align: right; font-weight: 600; }
.tfoot-value { font-weight: 700; }
.export-actions-row { display:flex; gap:8px; margin-top: 12px; }

 

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

