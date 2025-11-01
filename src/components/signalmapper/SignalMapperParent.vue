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
      :projectId="projectId"
      :locationId="effectiveLocationId"
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

