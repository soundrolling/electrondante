<template>
<div class="signal-mapper-parent">
  <!-- Slim header -->
  <div class="sm-header">
    <button class="sm-back" @click="goBack" aria-label="Back">
      <ArrowLeft :size="16" :stroke-width="2" />
      <span class="sm-back-label">Back</span>
    </button>
    <div class="sm-location" v-if="currentLocation">
      <span class="sm-location-kicker">Location</span>
      <span class="sm-location-value">
        {{ currentLocation.venue_name }}
        <span v-if="currentLocation.stage_name" class="sm-location-sep">·</span>
        {{ currentLocation.stage_name }}
      </span>
    </div>
    <div class="sm-location sm-location-empty" v-else>
      <span>No location found</span>
    </div>
  </div>

  <!-- Sticky recording-day rail -->
  <div v-if="effectiveLocationId && stageHours.length" class="rec-day-rail" role="tablist" aria-label="Recording day">
    <Calendar :size="14" :stroke-width="2" class="rec-day-icon" />
    <div class="rec-day-chips">
      <button
        v-for="stageHour in stageHours"
        :key="stageHour.id"
        role="tab"
        :aria-selected="selectedStageHourId === stageHour.id"
        :class="['rec-day-chip', { active: selectedStageHourId === stageHour.id }]"
        @click="selectRecordingDay(stageHour.id)"
      >
        {{ getRecordingDayLabel(stageHour) }}
      </button>
    </div>
    <button
      v-if="selectedStageHourId"
      class="rec-day-export"
      @click="openShowExportModal"
      :disabled="isExportingShow"
      title="Export show bible (PDF)"
      aria-label="Export show bible PDF"
    >
      <FileDown :size="14" :stroke-width="2" />
      <span class="rec-day-export-label">{{ isExportingShow ? 'Exporting…' : 'Export' }}</span>
    </button>
    <button
      v-if="selectedStageHourId && stageHours.length > 1"
      class="rec-day-copy"
      @click="showCopyModal = true"
      title="Copy signal flow from another recording day"
      aria-label="Copy from previous day"
    >
      <Copy :size="14" :stroke-width="2" />
      <span class="rec-day-copy-label">Copy</span>
    </button>
  </div>

  <!-- Desktop / tablet tab bar (segmented) -->
  <div class="tab-nav tab-nav-top" role="tablist" aria-label="Signal mapper sections">
    <button
      v-for="t in tabs"
      :key="t.key"
      role="tab"
      :aria-selected="activeTab === t.key"
      :class="['tab-nav-btn', { active: activeTab === t.key }]"
      @click="setActiveTab(t.key)"
    >
      <component :is="t.icon" :size="16" :stroke-width="2" />
      <span class="tab-nav-label">{{ t.label }}</span>
    </button>
  </div>



  <!-- Tab Content -->
  <div class="tab-content">
    <div v-if="!selectedStageHourId && effectiveLocationId" class="no-stage-hour-message">
      <p>Please select a recording day to view signal mapper data.</p>
    </div>
    <!-- Use KeepAlive to preserve component state when switching tabs -->
    <KeepAlive :max="2">
      <MicPlacement
        v-if="activeTab === 'placement' && selectedStageHourId"
        :key="`placement-${selectedStageHourId}`"
        ref="micPlacementRef"
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
        :key="`flow-${selectedStageHourId}`"
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
        :key="`tracklist-${selectedStageHourId}`"
        :projectId="projectId"
        :locationId="effectiveLocationId"
        :stageHourId="selectedStageHourId"
        :signalPaths="signalPaths"
        :loading="loadingPaths"
        @track-name-clicked="handleTrackNameClicked"
        @refetch-paths="loadSignalPaths"
      />

      <DanteConfig
        v-else-if="activeTab === 'dante'"
        :key="`dante-${effectiveLocationId}`"
        :projectId="projectId"
        :locationId="effectiveLocationId"
      />
    </KeepAlive>
  </div>

  <!-- Mobile bottom tab nav (fixed) -->
  <nav class="tab-nav-bottom" role="tablist" aria-label="Signal mapper sections">
    <button
      v-for="t in tabs"
      :key="t.key"
      role="tab"
      :aria-selected="activeTab === t.key"
      :class="['tab-nav-bottom-btn', { active: activeTab === t.key }]"
      @click="setActiveTab(t.key)"
    >
      <component :is="t.icon" :size="20" :stroke-width="2" />
      <span class="tab-nav-bottom-label">{{ t.shortLabel || t.label }}</span>
    </button>
  </nav>

  <!-- Show Bible Export Modal -->
  <div v-if="showExportModal" class="modal-overlay" @click.self="showExportModal = false">
    <div class="modal-content export-modal">
      <div class="modal-header">
        <h3>Export show bible</h3>
        <button class="modal-close" @click="showExportModal = false" :disabled="isExportingShow">×</button>
      </div>
      <div class="modal-body">
        <p>Generate one PDF combining the sections you choose for the current recording day.</p>

        <div class="export-field">
          <label class="export-label">Filename</label>
          <input
            v-model="exportOptions.filename"
            type="text"
            class="export-input"
            placeholder="project-venue-stage-day-show-bible"
            :disabled="isExportingShow"
          />
        </div>

        <fieldset class="export-field" :disabled="isExportingShow">
          <legend class="export-label">Include</legend>
          <label class="export-check">
            <input type="checkbox" v-model="exportOptions.cover" />
            <span>Cover page</span>
          </label>
          <label class="export-check">
            <input type="checkbox" v-model="exportOptions.micPlacement" />
            <span>Mic placement image</span>
          </label>
          <label class="export-check">
            <input type="checkbox" v-model="exportOptions.signalFlow" />
            <span>Signal flow image</span>
          </label>
          <label class="export-check">
            <input type="checkbox" v-model="exportOptions.trackList" />
            <span>Track list tables</span>
          </label>
          <label class="export-check" v-if="exportOptions.trackList">
            <input type="checkbox" v-model="exportOptions.includeSignalPath" />
            <span class="sub">Include signal path column</span>
          </label>
        </fieldset>

        <p v-if="exportProgress" class="export-progress">{{ exportProgress }}</p>
      </div>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          @click="showExportModal = false"
          :disabled="isExportingShow"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="runShowExport"
          :disabled="!canRunShowExport || isExportingShow"
        >
          {{ isExportingShow ? 'Exporting…' : 'Export PDF' }}
        </button>
      </div>
    </div>
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
import { ref, computed, onMounted, watch, nextTick, defineAsyncComponent, markRaw, KeepAlive } from 'vue'
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
import {
  ArrowLeft,
  Calendar,
  Copy,
  FileDown,
  MapPin,
  Workflow,
  ListOrdered,
  Save,
} from 'lucide-vue-next'
import { buildShowPDF, defaultShowBibleFilename } from '@/services/showPdfExportService'
import { savePDFToStorage, showExportSuccessModal } from '@/services/exportStorageService'
import { downloadPDF } from '@/utils/pdfDownloadHelper'

// Lazy load heavy components for better initial load performance
const MicPlacement = defineAsyncComponent(() => import('./MicPlacement.vue'))
const SignalFlow = defineAsyncComponent(() => import('./SignalFlow.vue'))
const TrackList = defineAsyncComponent(() => import('./TrackList.vue'))
const DanteConfig = defineAsyncComponent(() => import('./DanteConfig.vue'))

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

// Refs to child components (for export)
const micPlacementRef = ref(null)

// Show bible export state
const showExportModal = ref(false)
const isExportingShow = ref(false)
const exportProgress = ref('')
const exportOptions = ref({
  filename: '',
  cover: true,
  micPlacement: true,
  signalFlow: true,
  trackList: true,
  includeSignalPath: true,
})

// Tab config (shared between desktop bar + mobile bottom nav)
const tabs = [
  { key: 'placement', label: 'Mic Placement', shortLabel: 'Mics', icon: markRaw(MapPin) },
  { key: 'flow', label: 'Signal Flow', shortLabel: 'Flow', icon: markRaw(Workflow) },
  { key: 'tracklist', label: 'Track List', shortLabel: 'Tracks', icon: markRaw(ListOrdered) },
  { key: 'dante', label: 'Setup Files', shortLabel: 'Files', icon: markRaw(Save) },
]

function selectRecordingDay(id) {
  selectedStageHourId.value = id
  if (typeof onRecordingDayChange === 'function') onRecordingDayChange()
}

/* ───────── Show bible export ───────── */

const currentStageHour = computed(() => {
  return stageHours.value.find(s => s.id === selectedStageHourId.value) || null
})

const exportMeta = computed(() => ({
  projectName: currentProjectName.value || '',
  venueName: currentLocation.value?.venue_name || '',
  stageName: currentLocation.value?.stage_name || '',
  recordingDayLabel: currentStageHour.value ? getRecordingDayLabel(currentStageHour.value) : '',
  appName: 'Spatial Notes',
  micCount: Array.isArray(allNodes.value)
    ? allNodes.value.filter(n => (n.gear_type === 'source' || n.node_type === 'source') && (n.gear_id || n.type === 'gear')).length
    : 0,
  connectionCount: Array.isArray(allConnections.value) ? allConnections.value.length : 0,
  trackCount: Array.isArray(signalPaths.value) ? signalPaths.value.length : 0,
  recorderCount: Array.isArray(signalPaths.value)
    ? new Set(signalPaths.value.map(p => p.recorder_label || 'Unknown')).size
    : 0,
}))

const currentProjectName = ref('')
async function fetchProjectName() {
  if (!props.projectId) return
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('project_name')
      .eq('id', props.projectId)
      .single()
    if (!error && data) currentProjectName.value = data.project_name || ''
  } catch {}
}

const canRunShowExport = computed(() => {
  if (!selectedStageHourId.value) return false
  const o = exportOptions.value
  return o.cover || o.micPlacement || o.signalFlow || o.trackList
})

function openShowExportModal() {
  if (!selectedStageHourId.value) return
  exportOptions.value.filename = defaultShowBibleFilename(exportMeta.value)
  exportProgress.value = ''
  showExportModal.value = true
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms))
}

async function captureCurrentMicImage() {
  const prevTab = activeTab.value
  if (prevTab !== 'placement') {
    activeTab.value = 'placement'
    await nextTick()
    await sleep(350)
  }
  await nextTick()
  const inst = micPlacementRef.value
  if (!inst || typeof inst.getCanvasDataURL !== 'function') return null
  try {
    return inst.getCanvasDataURL() || null
  } catch (err) {
    console.error('Failed to capture mic placement canvas:', err)
    return null
  }
}

async function captureCurrentFlowImage() {
  const prevTab = activeTab.value
  if (prevTab !== 'flow') {
    activeTab.value = 'flow'
    await nextTick()
    await sleep(350)
  }
  await nextTick()
  const inst = signalFlowRef.value
  if (!inst || typeof inst.getCanvasDataURL !== 'function') return null
  try {
    return inst.getCanvasDataURL() || null
  } catch (err) {
    console.error('Failed to capture signal flow canvas:', err)
    return null
  }
}

function reversedPathForExport(pathArr) {
  if (!Array.isArray(pathArr)) return []
  return [...pathArr].reverse()
}

function compareTrackNumbersForExport(a, b) {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return String(a || '').localeCompare(String(b || ''))
}

function getTrackIdForExport(p) {
  return `${p.recorder_label || 'Unknown'}::${p.track_number || ''}::${p.track_name || p.source_label || ''}`
}

async function runShowExport() {
  if (isExportingShow.value) return
  if (!canRunShowExport.value) return

  const originalTab = activeTab.value
  isExportingShow.value = true
  try {
    const o = exportOptions.value
    let micDataURL = null
    let flowDataURL = null

    if (o.micPlacement) {
      exportProgress.value = 'Capturing mic placement…'
      micDataURL = await captureCurrentMicImage()
    }

    if (o.signalFlow) {
      exportProgress.value = 'Capturing signal flow…'
      flowDataURL = await captureCurrentFlowImage()
    }

    exportProgress.value = 'Assembling PDF…'

    const doc = await buildShowPDF({
      meta: exportMeta.value,
      include: {
        cover: !!o.cover,
        micPlacement: !!o.micPlacement && !!micDataURL,
        signalFlow: !!o.signalFlow && !!flowDataURL,
        trackList: !!o.trackList,
      },
      micPlacementDataURL: micDataURL,
      signalFlowDataURL: flowDataURL,
      signalPaths: signalPaths.value || [],
      includeSignalPath: !!o.includeSignalPath,
      getTrackId: getTrackIdForExport,
      reversedPath: reversedPathForExport,
      compareTrackNumbers: compareTrackNumbersForExport,
    })

    exportProgress.value = 'Saving…'
    const filename = (o.filename?.trim() || defaultShowBibleFilename(exportMeta.value)) + '.pdf'

    // Determine venue id for storage path
    let venueId = null
    try {
      if (effectiveLocationId.value) {
        const { data } = await supabase
          .from('locations')
          .select('venue_id')
          .eq('id', effectiveLocationId.value)
          .single()
        venueId = data?.venue_id || null
      }
    } catch {}

    const description = `Show bible${exportMeta.value.recordingDayLabel ? ' · ' + exportMeta.value.recordingDayLabel : ''}`
    let result
    try {
      result = await savePDFToStorage(
        doc,
        filename,
        props.projectId,
        venueId,
        effectiveLocationId.value,
        description
      )
    } catch (err) {
      console.error('Show bible: storage save threw, falling back to download:', err)
      result = { success: false, error: err?.message }
    }

    if (result && result.success) {
      showExportSuccessModal(result, filename, {
        projectId: props.projectId,
        venueId,
        stageId: effectiveLocationId.value,
        mimeType: 'application/pdf',
      })
    } else {
      // Fallback: direct download
      try {
        await downloadPDF(doc, filename, toast)
        toast.warning('Show bible downloaded locally — cloud save failed.')
      } catch (dlErr) {
        console.error('Show bible: both save and download failed:', dlErr)
        toast.error('Failed to export show bible. Please try again.')
      }
    }

    showExportModal.value = false
  } catch (err) {
    console.error('Show bible export failed:', err)
    toast.error(`Failed to export show bible: ${err?.message || 'unknown error'}`)
  } finally {
    exportProgress.value = ''
    isExportingShow.value = false
    if (activeTab.value !== originalTab) {
      activeTab.value = originalTab
    }
  }
}

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
  fetchProjectName()
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
/* ─── Shell ────────────────────────────────────────────── */
.signal-mapper-parent {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4);
  padding-bottom: calc(var(--space-4) + 72px + env(safe-area-inset-bottom, 0));
}

/* ─── Slim header ──────────────────────────────────────── */
.sm-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}
.sm-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: background var(--transition-normal), color var(--transition-normal);
  flex-shrink: 0;
}
.sm-back:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.sm-back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.sm-location {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.sm-location-kicker {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  line-height: 1;
}
.sm-location-value {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.sm-location-sep { color: var(--text-tertiary); margin: 0 4px; font-weight: var(--font-normal); }
.sm-location-empty .sm-location-value { color: var(--text-tertiary); font-style: italic; font-weight: var(--font-medium); }

/* ─── Sticky recording-day rail ────────────────────────── */
.rec-day-rail {
  position: sticky;
  top: 56px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 10px;
  background: var(--surface-filter-rail);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  backdrop-filter: saturate(140%) blur(6px);
}
.rec-day-icon { color: var(--text-tertiary); flex-shrink: 0; }
.rec-day-chips {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
}
.rec-day-chips::-webkit-scrollbar { display: none; }
.rec-day-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  height: 28px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  border-radius: var(--radius-full);
  color: var(--chip-text);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  white-space: nowrap;
  flex-shrink: 0;
}
.rec-day-chip:hover { background: var(--surface-hover); color: var(--text-primary); }
.rec-day-chip.active {
  background: var(--chip-bg-active);
  color: var(--chip-text-active);
  border-color: var(--chip-border-active);
}
.rec-day-chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.rec-day-copy,
.rec-day-export {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  flex-shrink: 0;
}
.rec-day-copy:hover,
.rec-day-export:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
  color: var(--text-primary);
}
.rec-day-export:disabled { opacity: 0.55; cursor: not-allowed; }
.rec-day-copy-label,
.rec-day-export-label { display: none; }

/* ─── Top tab bar (segmented) ──────────────────────────── */
.tab-nav-top {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}
.tab-nav-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-lg) - 3px);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  min-width: 0;
}
.tab-nav-btn:hover { color: var(--text-primary); }
.tab-nav-btn.active {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
  font-weight: var(--font-semibold);
}
.tab-nav-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.tab-nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Tab content shell ───────────────────────────────── */
.tab-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  min-height: 500px;
  overflow: hidden;
}
.no-stage-hour-message {
  padding: var(--space-12) var(--space-4);
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

/* ─── Mobile bottom tab nav (fixed) ────────────────────── */
.tab-nav-bottom {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-fixed);
  background: var(--surface-app-bar);
  border-top: 1px solid var(--surface-border);
  padding: 4px 8px calc(4px + env(safe-area-inset-bottom, 0));
  backdrop-filter: saturate(140%) blur(8px);
}
.tab-nav-bottom-btn {
  flex: 1;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 4px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: color var(--transition-normal);
  min-height: 52px;
  min-width: 0;
}
.tab-nav-bottom-btn:hover { color: var(--text-secondary); }
.tab-nav-bottom-btn.active {
  color: var(--color-primary-600);
  font-weight: var(--font-semibold);
}
.tab-nav-bottom-btn.active svg { color: var(--color-primary-500); }
.tab-nav-bottom-btn:focus-visible {
  outline: none;
  background: var(--surface-hover);
  border-radius: var(--radius-md);
}
.tab-nav-bottom-label { line-height: 1; }

/* ─── Modal ────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}
.copy-modal {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: var(--shadow-xl);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
}
.modal-header h3 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
}
.modal-close {
  background: none;
  border: none;
  font-size: var(--text-xl);
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background var(--transition-normal);
}
.modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.modal-body { padding: var(--space-4) var(--space-5); }
.modal-body p {
  margin: 0 0 var(--space-3) 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
.copy-source-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  margin-bottom: var(--space-3);
  min-height: 40px;
}
.copy-source-select:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.copy-source-select:disabled { opacity: 0.6; cursor: not-allowed; }
.copy-warning {
  padding: 10px 12px;
  background: var(--color-warning-50);
  border: 1px solid var(--color-warning-200);
  border-radius: var(--radius-md);
  margin-top: var(--space-2);
}
.copy-warning p {
  margin: 0;
  color: var(--color-warning-800);
  font-size: var(--text-xs);
}
.dark .copy-warning {
  background: rgba(120, 53, 15, 0.25);
  border-color: var(--color-warning-700);
}
.dark .copy-warning p { color: var(--color-warning-200); }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--surface-border);
}
.btn {
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  min-height: 36px;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--surface-border);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.btn-primary {
  background: var(--color-primary-500);
  color: #ffffff;
  border: 1px solid var(--color-primary-600);
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}

/* Export modal */
.export-modal { max-width: 520px; }
.export-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: var(--space-3);
  border: none;
  padding: 0;
}
.export-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0;
}
.export-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 40px;
  font-family: inherit;
}
.export-input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.export-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}
.export-check input { width: 16px; height: 16px; cursor: pointer; }
.export-check .sub { color: var(--text-tertiary); font-size: var(--text-xs); }
.export-progress {
  margin-top: var(--space-3);
  padding: 8px 10px;
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  border-radius: var(--radius-md);
  color: var(--color-primary-700);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}
.dark .export-progress {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.3);
  color: var(--color-primary-300);
}

/* ─── Tablet + desktop ─────────────────────────────────── */
@media (min-width: 601px) {
  .signal-mapper-parent { padding: var(--space-5); padding-bottom: var(--space-5); }
  .rec-day-copy-label,
  .rec-day-export-label { display: inline; }
  .sm-back-label { display: inline; }
}

@media (min-width: 1025px) {
  .signal-mapper-parent { padding: var(--space-6); padding-bottom: var(--space-6); }
}

/* ─── Mobile ───────────────────────────────────────────── */
@media (max-width: 600px) {
  .signal-mapper-parent { padding: var(--space-3); }
  .sm-header { padding: 6px 8px; gap: var(--space-2); }
  .sm-back { padding: 6px; width: 32px; justify-content: center; }
  .sm-back-label { display: none; }
  .sm-location-kicker { display: none; }
  .rec-day-rail {
    position: sticky;
    top: 52px;
    padding: 6px 8px;
    border-radius: var(--radius-md);
  }
  .rec-day-copy-label,
  .rec-day-export-label { display: none; }
  .rec-day-copy,
  .rec-day-export { padding: 0; width: 28px; justify-content: center; }
  .tab-nav-top { display: none; }
  .tab-nav-bottom { display: flex; }
  .tab-content { border-radius: var(--radius-md); min-height: 400px; }
}

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .sm-header,
  .rec-day-rail,
  .rec-day-chip,
  .tab-nav-btn,
  .tab-nav-bottom { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .rec-day-chip,
  .rec-day-copy,
  .tab-nav-btn,
  .tab-nav-bottom-btn,
  .sm-back,
  .btn { transition: none; }
}
</style>



