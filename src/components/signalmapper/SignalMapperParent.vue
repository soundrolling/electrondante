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
    <div class="recording-day-selector" v-if="effectiveLocationId">
      <label for="recording-day-select">Recording Day:</label>
      <select 
        id="recording-day-select"
        v-model="selectedStageHourId" 
        @change="onRecordingDayChange"
        class="recording-day-select"
        :disabled="stageHours.length === 0"
      >
        <option v-if="stageHours.length === 0" :value="null" disabled>No recording days available</option>
        <option 
          v-for="stageHour in stageHours" 
          :key="stageHour.id" 
          :value="stageHour.id"
        >
          {{ getRecordingDayLabel(stageHour) }}
        </option>
      </select>
      <button 
        v-if="selectedStageHourId && stageHours.length > 1"
        @click="showCopyModal = true"
        class="copy-btn"
        title="Copy signal flow from another recording day"
      >
        📋 Copy from Previous
      </button>
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
      🎛️ Setup Files
    </button>
  </div>

  

  <!-- Tab Content -->
  <div class="tab-content">
    <div v-if="!selectedStageHourId && effectiveLocationId" class="no-stage-hour-message">
      <p>Please select a recording day to view signal mapper data.</p>
    </div>
    <MicPlacement
      v-else-if="activeTab === 'placement' && selectedStageHourId"
      :projectId="projectId"
      :locationId="effectiveLocationId"
      :stageHourId="selectedStageHourId"
      :nodes="sourceNodes"
      :gearList="gearList"
      :stageName="currentLocation?.stage_name"
      @node-updated="handleNodeUpdated"
      @node-added="handleNodeAdded"
      @node-deleted="handleNodeDeleted"
    />
    
    <SignalFlow
      v-else-if="activeTab === 'flow' && selectedStageHourId"
      ref="signalFlowRef"
      :projectId="projectId"
      :locationId="effectiveLocationId"
      :stageHourId="selectedStageHourId"
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
      v-else-if="activeTab === 'tracklist' && selectedStageHourId"
      :projectId="projectId"
      :locationId="effectiveLocationId"
      :stageHourId="selectedStageHourId"
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

  <!-- Copy from Previous Recording Day Modal -->
  <div v-if="showCopyModal" class="modal-overlay" @click.self="showCopyModal = false">
    <div class="modal-content copy-modal">
      <div class="modal-header">
        <h3>Copy Signal Flow from Previous Recording Day</h3>
        <button class="modal-close" @click="showCopyModal = false">×</button>
      </div>
      <div class="modal-body">
        <p>Select a recording day to copy signal flow from:</p>
        <select 
          v-model="copySourceStageHourId" 
          class="copy-source-select"
          :disabled="isCopying"
        >
          <option :value="null">-- Select Recording Day --</option>
          <option 
            v-for="stageHour in availableSourceStageHours" 
            :key="stageHour.id" 
            :value="stageHour.id"
          >
            {{ getRecordingDayLabel(stageHour) }}
          </option>
        </select>
        <div class="copy-warning" v-if="copySourceStageHourId">
          <p><strong>Warning:</strong> This will copy all nodes and connections from the selected recording day to the current one. Existing data for the current recording day will remain unchanged.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button 
          class="btn btn-secondary" 
          @click="showCopyModal = false"
          :disabled="isCopying"
        >
          Cancel
        </button>
        <button 
          class="btn btn-primary" 
          @click="handleCopyFromRecordingDay"
          :disabled="!copySourceStageHourId || isCopying"
        >
          {{ isCopying ? 'Copying...' : 'Copy' }}
        </button>
      </div>
    </div>
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
  subscribeToConnections,
  copySignalFlowFromRecordingDay
} from '@/services/signalMapperService'
import { useStageHours } from '@/composables/useStageHours'
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
const selectedStageHourId = ref(null)
const showCopyModal = ref(false)
const copySourceStageHourId = ref(null)
const isCopying = ref(false)

// Ensure children always receive a valid location id if present via route
const effectiveLocationId = computed(() => {
  return props.locationId || route.query.locationId || currentLocation.value?.id || null
})

// Load stage hours for recording day selector
const { stageHours, loadStageHours, formatStageHourFallback } = useStageHours(effectiveLocationId)

// Computed filtered data
const sourceNodes = computed(() => {
  // Show only gear-based sources (placed in Mic Placement). Exclude ad-hoc Signal Flow sources.
  return allNodes.value.filter(node => 
    (node.gear_type === 'source' || node.node_type === 'source') &&
    (node.gear_id || node.type === 'gear')
  )
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

// Load nodes and connections - filtered by location and recording day if provided
async function loadNodesAndConnections() {
  if (!props.projectId) return
  // Require a stage hour ID to be selected
  if (!selectedStageHourId.value) {
    // Clear data if no stage hour is selected
    allNodes.value = []
    allConnections.value = []
    signalPaths.value = []
    return
  }

  try {
    const locId = effectiveLocationId.value
    const stageHourId = selectedStageHourId.value
    const [nodes, connections] = await Promise.all([
      getNodes(props.projectId, locId, stageHourId),
      getConnections(props.projectId, locId, stageHourId)
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
  // Require a stage hour ID to be selected
  if (!selectedStageHourId.value) {
    signalPaths.value = []
    loadingPaths.value = false
    return
  }
  
  loadingPaths.value = true
  try {
    const locId = effectiveLocationId.value
    const stageHourId = selectedStageHourId.value
    signalPaths.value = await getCompleteSignalPath(props.projectId, locId, stageHourId)
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

// Recording day helper functions
function getRecordingDayLabel(stageHour) {
  if (!stageHour) return ''
  return stageHour.notes || formatStageHourFallback(stageHour)
}

const availableSourceStageHours = computed(() => {
  return stageHours.value.filter(sh => sh.id !== selectedStageHourId.value)
})

function onRecordingDayChange() {
  loadNodesAndConnections()
}

async function handleCopyFromRecordingDay() {
  if (!copySourceStageHourId.value || !selectedStageHourId.value) {
    toast.error('Please select a source recording day')
    return
  }
  
  if (copySourceStageHourId.value === selectedStageHourId.value) {
    toast.error('Cannot copy to the same recording day')
    return
  }
  
  isCopying.value = true
  try {
    const result = await copySignalFlowFromRecordingDay(
      props.projectId,
      effectiveLocationId.value,
      copySourceStageHourId.value,
      selectedStageHourId.value
    )
    
    toast.success(`Copied ${result.nodes} nodes and ${result.connections} connections`)
    showCopyModal.value = false
    copySourceStageHourId.value = null
    
    // Reload data to show the copied signal flow
    await loadNodesAndConnections()
  } catch (err) {
    console.error('Error copying signal flow:', err)
    toast.error(err.message || 'Failed to copy signal flow')
  } finally {
    isCopying.value = false
  }
}

// Watch for location changes and reload nodes/connections
watch(effectiveLocationId, async (newLocId) => {
  if (newLocId) {
    await loadStageHours()
  }
  // Only load if we have a selected stage hour
  if (selectedStageHourId.value) {
    loadNodesAndConnections()
  }
})

// Watch for stage hours to auto-select first one if none selected
watch(stageHours, (newStageHours) => {
  // Auto-select first stage hour if none is selected and stage hours are available
  if (!selectedStageHourId.value && newStageHours.length > 0) {
    selectedStageHourId.value = newStageHours[0].id
  }
}, { immediate: true })

// Watch for recording day changes
watch(selectedStageHourId, () => {
  // Only load if we have a selected stage hour
  if (selectedStageHourId.value) {
    loadNodesAndConnections()
  }
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
  if (effectiveLocationId.value) {
    await loadStageHours()
    // Auto-select first stage hour if none is selected
    if (!selectedStageHourId.value && stageHours.value.length > 0) {
      selectedStageHourId.value = stageHours.value[0].id
    }
  }
  await fetchGearList()
  // Only load nodes/connections if we have a selected stage hour
  if (selectedStageHourId.value) {
    await loadNodesAndConnections()
  }
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

.no-stage-hour-message {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-stage-hour-message p {
  margin: 0;
  font-size: 16px;
}

.recording-day-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.recording-day-selector label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.recording-day-select {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  min-width: 200px;
}

.recording-day-select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.copy-btn {
  padding: 6px 12px;
  background: var(--color-primary-500);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: var(--color-primary-600);
}

/* Copy Modal Styles */
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

.copy-modal {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
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

.modal-close {
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

.modal-close:hover {
  background: #f0f0f0;
}

.modal-body {
  padding: 20px;
}

.modal-body p {
  margin: 0 0 15px 0;
  color: var(--text-secondary);
}

.copy-source-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 15px;
}

.copy-source-select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.copy-source-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.copy-warning {
  padding: 12px;
  background: var(--color-warning-100);
  border: 1px solid var(--color-warning-400);
  border-radius: 6px;
  margin-top: 15px;
}

.copy-warning p {
  margin: 0;
  color: var(--color-warning-800);
  font-size: 13px;
}

/* Dark mode adjustments for warning */
.dark .copy-warning {
  background: var(--color-warning-900);
  border-color: var(--color-warning-600);
}

.dark .copy-warning p {
  color: var(--color-warning-200);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e9ecef;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-primary {
  background: var(--color-primary-500);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
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

  .signalmapper-topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .recording-day-selector {
    margin-left: 0;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .recording-day-select {
    width: 100%;
  }

  .copy-btn {
    width: 100%;
  }
}
</style>

