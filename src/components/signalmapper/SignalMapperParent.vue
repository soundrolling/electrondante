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
      @click="setActiveTab('placement')"
    >
      📍 Mic Placement
    </button>
    <button 
      :class="['tab-btn', { active: activeTab === 'flow' }]"
      @click="setActiveTab('flow')"
    >
      🔗 Signal Flow
    </button>
    <button 
      :class="['tab-btn', { active: activeTab === 'tracklist' }]"
      @click="setActiveTab('tracklist')"
    >
      📊 Track List
    </button>
    <button 
      :class="['tab-btn', { active: activeTab === 'dante' }]"
      @click="setActiveTab('dante')"
    >
      🎛️ Dante
    </button>
  </div>

  

  <!-- Tab Content -->
  <div class="tab-content">
    <MicPlacement
      v-if="activeTab === 'placement'"
      :projectId="projectId"
      :locationId="effectiveLocationId"
      :nodes="sourceNodes"
      :gearList="gearList"
      @node-updated="handleNodeUpdated"
      @node-added="handleNodeAdded"
      @node-deleted="handleNodeDeleted"
    />
    
    <SignalFlow
      v-if="activeTab === 'flow'"
      ref="signalFlowRef"
      :projectId="projectId"
      :locationId="effectiveLocationId"
      :nodes="allNodes"
      :connections="allConnections"
      :gearList="gearList"
      :initialSelectedConnectionId="selectedConnectionId"
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
      :locationId="effectiveLocationId"
      :signalPaths="signalPaths"
      :loading="loadingPaths"
      @track-name-clicked="handleTrackNameClicked"
      @refetch-paths="loadSignalPaths"
    />

    <DanteConfig
      v-if="activeTab === 'dante'"
      :projectId="projectId"
      :locationId="effectiveLocationId"
    />

  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
import DanteConfig from './DanteConfig.vue'

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  },
  locationId: {
    type: [String, Number],
    default: null
  },
  tab: {
    type: String,
    default: 'placement',
    validator: (value) => ['placement', 'flow', 'tracklist', 'dante'].includes(value)
  }
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Initialize activeTab from route param (prop) or query param (fallback for old URLs)
const activeTab = ref(props.tab || route.query.tab || 'placement')
const currentLocation = ref(null)
const allNodes = ref([])
const allConnections = ref([])
const gearList = ref([])
const signalPaths = ref([])
const loadingPaths = ref(false)
const selectedConnectionId = ref(null)
const signalFlowRef = ref(null)

// Computed filtered data
const sourceNodes = computed(() => {
  // Show only gear-based sources (placed in Mic Placement). Exclude ad-hoc Signal Flow sources.
  return allNodes.value.filter(node => 
    (node.gear_type === 'source' || node.node_type === 'source') &&
    (node.gear_id || node.type === 'gear')
  )
})

// Ensure children always receive a valid location id if present via route
const effectiveLocationId = computed(() => {
  return props.locationId || route.query.locationId || currentLocation.value?.id || null
})

// Navigation
const goBack = () => router.back()

// Set active tab and update URL
function setActiveTab(tab) {
  activeTab.value = tab
  // Clear selected connection when switching away from flow tab
  if (tab !== 'flow') {
    selectedConnectionId.value = null
  }
  // Update URL route parameter (more reliable than query params)
  router.replace({
    name: 'SignalMapper',
    params: {
      id: props.projectId,
      tab: tab
    },
    query: route.query // Preserve other query params (venueId, stageId, locationId)
  })
}

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
    const allGearData = await fetchTableData('gear_table', { 
      eq: { project_id: props.projectId },
      order: [{ column: 'sort_order', ascending: true }]
    })
    // Exclude accessories_cables from signal mapper
    const gearData = allGearData.filter(g => g.gear_type !== 'accessories_cables')
    
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

// Load nodes and connections - filtered by location if provided
async function loadNodesAndConnections() {
  if (!props.projectId) return

  try {
    const locId = effectiveLocationId.value
    const [nodes, connections] = await Promise.all([
      getNodes(props.projectId, locId),
      getConnections(props.projectId, locId)
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
  // Remove the connection from local state immediately (synchronous update)
  allConnections.value = allConnections.value.filter(c => c.id !== connectionId)
  // Reload signal paths to ensure all cached data is cleared (async, non-blocking)
  loadSignalPaths()
  // Don't reload all nodes/connections - just let the canvas redraw with the updated connections array
  // The watcher in SignalFlow will handle the canvas redraw automatically
}

function handleTrackNameClicked(connectionId) {
  selectedConnectionId.value = connectionId
  setActiveTab('flow')
  // Wait for SignalFlow to mount and then select the connection
  nextTick(() => {
    // Use a small delay to ensure the component is fully rendered
    setTimeout(() => {
      if (signalFlowRef.value && signalFlowRef.value.selectConnection) {
        signalFlowRef.value.selectConnection(connectionId)
      }
    }, 150)
  })
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

// Watch for route changes to update active tab (both params and query for backward compatibility)
watch(() => route.params.tab || route.query.tab, (newTab) => {
  if (newTab && ['placement', 'flow', 'tracklist', 'dante'].includes(newTab)) {
    activeTab.value = newTab
  } else if (!newTab) {
    // Default to placement if no tab in URL
    activeTab.value = 'placement'
    // Redirect to placement tab if invalid/missing
    if (route.params.tab && !['placement', 'flow', 'tracklist', 'dante'].includes(route.params.tab)) {
      setActiveTab('placement')
    }
  }
})

// Watch for location changes and reload nodes/connections
watch(effectiveLocationId, () => {
  loadNodesAndConnections()
})

// Lifecycle
onMounted(async () => {
  // Initialize tab from route param (preferred) or query param (backward compatibility)
  const tabFromUrl = route.params.tab || route.query.tab
  if (tabFromUrl && ['placement', 'flow', 'tracklist', 'dante'].includes(tabFromUrl)) {
    activeTab.value = tabFromUrl
    // If we're using query param, migrate to route param
    if (route.query.tab && !route.params.tab) {
      setActiveTab(tabFromUrl)
    }
  } else {
    // If no valid tab in URL, set default and update URL
    if (!route.params.tab && !route.query.tab) {
      setActiveTab('placement')
    }
  }
  
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
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.back-button {
  padding: 8px 16px;
  background: var(--color-secondary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.back-button:hover {
  background: var(--color-secondary-600);
}

.location-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.tab-navigation {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: var(--bg-primary);
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.tab-btn:hover {
  border-color: var(--color-primary-500);
  background: var(--bg-secondary);
}

.tab-btn.active {
  background: var(--color-primary-600);
  color: var(--text-inverse);
  border-color: var(--color-primary-700);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35), 0 6px 14px rgba(37, 99, 235, 0.25);
  font-weight: 700;
}

.tab-content {
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid #e9ecef;
  min-height: 500px;
}

 

 

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

