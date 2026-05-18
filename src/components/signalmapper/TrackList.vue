<template>
<div class="track-list-container">
  <!-- Header -->
  <div class="tl-head">
    <div class="tl-head-title">
      <h2 class="tl-title">Track List</h2>
      <p v-if="customTitle" class="tl-subtitle">{{ customTitle }}</p>
      <p v-else class="tl-subtitle">Complete routing from source to recorder</p>
    </div>
    <div class="tl-counts" v-if="signalPaths.length > 0">
      <span class="tl-count">
        <span class="tl-count-value">{{ visiblePaths.length }}</span>
        <span class="tl-count-label">tracks</span>
      </span>
      <span class="tl-count">
        <span class="tl-count-value">{{ Object.keys(groupedByRecorder).length }}</span>
        <span class="tl-count-label">recorders</span>
      </span>
      <span v-if="hiddenTracks.size > 0" class="tl-count muted">
        <span class="tl-count-value">{{ hiddenTracks.size }}</span>
        <span class="tl-count-label">hidden</span>
      </span>
    </div>
  </div>

  <!-- Filter + action bar -->
  <div class="tl-toolbar">
    <div class="tl-search">
      <Search :size="16" :stroke-width="2" class="tl-search-icon" />
      <input
        v-model="trackFilter"
        placeholder="Search tracks, sources, recorders…"
        class="tl-search-input"
        type="search"
      />
    </div>
    <div class="tl-actions">
      <button
        class="tl-chip-btn"
        :class="{ active: showHidden }"
        @click="toggleShowHidden"
        :title="showHidden ? 'Hide hidden tracks' : 'Show hidden tracks'"
      >
        <EyeOff v-if="showHidden" :size="14" :stroke-width="2" />
        <Eye v-else :size="14" :stroke-width="2" />
        <span>{{ showHidden ? 'Hiding shown' : 'Show hidden' }}</span>
      </button>
      <button
        class="tl-icon-btn"
        @click="refetchSignalPaths"
        :disabled="loading"
        :class="{ spinning: loading }"
        title="Refetch signal paths"
        aria-label="Refetch signal paths"
      >
        <RefreshCw :size="16" :stroke-width="2" />
      </button>
      <button
        class="tl-icon-btn"
        @click="exportCSV"
        title="Export CSV"
        aria-label="Export CSV"
      >
        <FileDown :size="16" :stroke-width="2" />
      </button>
      <button
        class="tl-primary-btn"
        @click="exportToPDF"
        :disabled="signalPaths.length === 0"
      >
        <Printer :size="16" :stroke-width="2" />
        <span class="tl-primary-btn-label">Export PDF</span>
      </button>
    </div>
  </div>

  <!-- Loading -->
  <div v-if="loading" class="tl-state loading">
    <RefreshCw :size="20" :stroke-width="2" class="tl-state-icon spinning" />
    <p>Loading track list…</p>
  </div>

  <!-- Empty -->
  <div v-else-if="signalPaths.length === 0" class="tl-state empty">
    <div class="tl-state-icon-bg">
      <ListOrdered :size="24" :stroke-width="1.5" />
    </div>
    <p class="tl-state-title">No tracks yet</p>
    <p class="tl-state-hint">Connect sources to recorders in the Signal Flow tab to see tracks here.</p>
  </div>

  <!-- No matches (after filter) -->
  <div v-else-if="!hasVisibleFilteredGroups" class="tl-state empty">
    <div class="tl-state-icon-bg">
      <Search :size="24" :stroke-width="1.5" />
    </div>
    <p class="tl-state-title">No tracks match your search</p>
    <p class="tl-state-hint">Try a different term or clear the search.</p>
  </div>

  <!-- Recorder groups -->
  <div v-else class="tl-groups">
    <template v-for="(tracks, recorderName) in filteredGroupedByRecorder" :key="recorderName">
      <section v-if="tracks.length" class="tl-group">
        <header class="tl-group-header">
          <HardDrive :size="15" :stroke-width="2" />
          <span class="tl-group-name">{{ recorderName }}</span>
          <span class="tl-group-count">{{ tracks.length }}</span>
        </header>

        <!-- Desktop table -->
        <table class="tl-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-source">Source</th>
              <th class="col-path">Signal path</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="path in tracks"
              :key="getTrackId(path)"
              class="tl-row"
              :class="{ 'track-hidden': isTrackHidden(path) && showHidden }"
            >
              <td class="col-num">{{ path.track_number || '—' }}</td>
              <td class="col-source">
                <button
                  v-if="path.connection_id"
                  class="tl-track-link"
                  @click="handleTrackNameClick(path.connection_id)"
                  title="View this connection in Signal Flow"
                >
                  {{ path.track_name || path.source_label || '—' }}
                </button>
                <span v-else class="tl-track-name">{{ path.track_name || path.source_label || '—' }}</span>
                <div v-if="path.source_gear_name" class="tl-source-gear">{{ path.source_gear_name }}</div>
              </td>
              <td class="col-path">
                <div class="tl-path-flow">
                  <template v-for="(node, index) in reversedPath(path.path)" :key="index">
                    <span class="tl-path-node">{{ node }}</span>
                    <ChevronRight
                      v-if="index < reversedPath(path.path).length - 1"
                      :size="12"
                      :stroke-width="2"
                      class="tl-path-arrow"
                    />
                  </template>
                </div>
              </td>
              <td class="col-actions">
                <button
                  @click="toggleTrackVisibility(path)"
                  class="tl-icon-btn small"
                  :title="isTrackHidden(path) ? 'Show track' : 'Hide track'"
                  :aria-label="isTrackHidden(path) ? 'Show track' : 'Hide track'"
                >
                  <Eye v-if="isTrackHidden(path)" :size="14" :stroke-width="2" />
                  <EyeOff v-else :size="14" :stroke-width="2" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Mobile card list -->
        <ul class="tl-cards">
          <li
            v-for="path in tracks"
            :key="'c-'+getTrackId(path)"
            class="tl-card"
            :class="{ 'track-hidden': isTrackHidden(path) && showHidden }"
          >
            <div class="tl-card-top">
              <span class="tl-card-num">Track {{ path.track_number || '—' }}</span>
              <button
                @click="toggleTrackVisibility(path)"
                class="tl-icon-btn small"
                :aria-label="isTrackHidden(path) ? 'Show track' : 'Hide track'"
              >
                <Eye v-if="isTrackHidden(path)" :size="14" :stroke-width="2" />
                <EyeOff v-else :size="14" :stroke-width="2" />
              </button>
            </div>
            <button
              v-if="path.connection_id"
              class="tl-track-link tl-card-source"
              @click="handleTrackNameClick(path.connection_id)"
            >
              {{ path.track_name || path.source_label || '—' }}
            </button>
            <span v-else class="tl-track-name tl-card-source">{{ path.track_name || path.source_label || '—' }}</span>
            <div v-if="path.source_gear_name" class="tl-source-gear">{{ path.source_gear_name }}</div>
            <div class="tl-path-flow tl-card-path">
              <template v-for="(node, index) in reversedPath(path.path)" :key="'cp'+index">
                <span class="tl-path-node">{{ node }}</span>
                <ChevronRight
                  v-if="index < reversedPath(path.path).length - 1"
                  :size="12"
                  :stroke-width="2"
                  class="tl-path-arrow"
                />
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>

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

  <!-- PDF Export Options Modal -->
  <div v-if="showPDFExportModal" class="modal-overlay" @click.self="closePDFExportModal">
    <div class="modal pdf-export-modal">
      <div class="modal-header">
        <h3>PDF Export Options</h3>
        <button class="modal-close" @click="closePDFExportModal">×</button>
      </div>
      <div class="modal-body">
        <!-- Filename -->
        <div class="form-group">
          <label class="form-label">Filename</label>
          <input
            v-model="pdfExportOptions.fileName"
            type="text"
            class="form-input"
            placeholder="Enter filename..."
          />
        </div>

        <!-- Include Signal Path -->
        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="pdfExportOptions.includeSignalPath"
              type="checkbox"
              class="checkbox-input"
            />
            <span>Include Signal Path column</span>
          </label>
        </div>

        <!-- Recording Date Name -->
        <div class="form-group">
          <label class="form-label">Recording Date/Name (optional)</label>
          <input
            v-model="pdfExportOptions.recordingDateName"
            type="text"
            class="form-input"
            placeholder="e.g., Day 1, Session 1, etc."
          />
        </div>

        <!-- Recorder Selection -->
        <div class="form-group">
          <label class="form-label">Select Recorders to Export</label>
          <div class="recorder-checkboxes">
            <label
              v-for="recorderName in availableRecorders"
              :key="recorderName"
              class="checkbox-label recorder-checkbox"
            >
              <input
                v-model="pdfExportOptions.selectedRecorders"
                type="checkbox"
                :value="recorderName"
                class="checkbox-input"
              />
              <span>{{ recorderName }}</span>
            </label>
          </div>
          <div class="checkbox-actions">
            <button type="button" class="btn-link" @click="selectAllRecorders">Select All</button>
            <button type="button" class="btn-link" @click="deselectAllRecorders">Deselect All</button>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-warning cancel-button" @click="closePDFExportModal">Cancel</button>
        <button
          class="btn btn-positive confirm-button"
          @click="confirmPDFExport"
          :disabled="!canExportPDF || isExportingPDF"
        >
          {{ isExportingPDF ? 'Exporting...' : 'Export PDF' }}
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { buildGraph } from '@/services/signalGraph'
import { resolveTransformerInputLabel as svcResolveTransformerInputLabel, getOutputLabel as svcGetOutputLabel } from '@/services/portLabelService'
import { downloadPDF } from '@/utils/pdfDownloadHelper'
import InputModal from '@/components/signalmapper/InputModal.vue'
import { supabase } from '@/supabase'
import {
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  FileDown,
  Printer,
  ListOrdered,
  HardDrive,
  ChevronRight,
} from 'lucide-vue-next'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  stageHourId: { type: [String, Number], default: null },
  signalPaths: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['track-name-clicked', 'refetch-paths'])
const graphRef = ref(null)

// Project and stage info for custom title
const projectName = ref('')
const stageName = ref('')
const venueName = ref('')
const dateRange = ref('')

// Computed custom title
const customTitle = computed(() => {
  const parts = []
  if (projectName.value) parts.push(projectName.value)
  if (stageName.value) parts.push(stageName.value)
  if (dateRange.value) parts.push(dateRange.value)
  return parts.length > 0 ? parts.join(' • ') : null
})

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

// Track visibility state
const hiddenTracks = ref(new Set())
const showHidden = ref(false)

// Free-text filter across track name, source, recorder, signal path
const trackFilter = ref('')

// PDF Export modal state
const showPDFExportModal = ref(false)
const isExportingPDF = ref(false)
const pdfExportOptions = ref({
  fileName: '',
  includeSignalPath: true,
  recordingDateName: '',
  selectedRecorders: []
})

// Available recorders for selection
const availableRecorders = computed(() => {
  return Object.keys(groupedByRecorder.value).sort()
})

// Check if export can proceed
const canExportPDF = computed(() => {
  return pdfExportOptions.value.selectedRecorders.length > 0 &&
         pdfExportOptions.value.fileName.trim().length > 0
})

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

function handleTrackNameClick(connectionId) {
  emit('track-name-clicked', connectionId)
}

function refetchSignalPaths() {
  emit('refetch-paths')
}

// Generate unique track ID from path properties
function getTrackId(path) {
  // Create a unique identifier combining recorder, track number, and connection
  const recorder = path.recorder_label || path.recorder_id || 'unknown'
  const trackNum = path.track_number || 'unknown'
  const connId = path.connection_id || path.source_id || 'unknown'
  return `${recorder}|${trackNum}|${connId}`
}

// Track visibility functions
function isTrackHidden(path) {
  const trackId = getTrackId(path)
  return hiddenTracks.value.has(trackId)
}

function toggleTrackVisibility(path) {
  const trackId = getTrackId(path)
  if (hiddenTracks.value.has(trackId)) {
    hiddenTracks.value.delete(trackId)
  } else {
    hiddenTracks.value.add(trackId)
  }
}

function toggleShowHidden() {
  showHidden.value = !showHidden.value
}

// PDF Export modal functions
function openPDFExportModal() {
  // Initialize with default values
  const defaultName = `track-list-${Date.now()}`
  pdfExportOptions.value = {
    fileName: defaultName,
    includeSignalPath: true,
    recordingDateName: '',
    selectedRecorders: [...availableRecorders.value] // Select all by default
  }
  showPDFExportModal.value = true
}

function closePDFExportModal() {
  showPDFExportModal.value = false
}

function selectAllRecorders() {
  pdfExportOptions.value.selectedRecorders = [...availableRecorders.value]
}

function deselectAllRecorders() {
  pdfExportOptions.value.selectedRecorders = []
}

// Filter paths to exclude hidden tracks (for display)
const visiblePaths = computed(() => {
  return props.signalPaths.filter(path => {
    const trackId = getTrackId(path)
    return !hiddenTracks.value.has(trackId) || showHidden.value
  })
})

// Group paths by recorder, then sort by track number within each group
const groupedByRecorder = computed(() => {
  const groups = {}

  visiblePaths.value.forEach(path => {
    const recorderName = path.recorder_label || 'Unknown Recorder'
    if (!groups[recorderName]) {
      groups[recorderName] = []
    }
    groups[recorderName].push(path)
  })

  // Sort each group by track number using smart sorting
  Object.keys(groups).forEach(recorder => {
    groups[recorder].sort((a, b) => {
      return compareTrackNumbers(a.track_number, b.track_number)
    })
  })

  return groups
})

// Apply search filter to the grouped view
const filteredGroupedByRecorder = computed(() => {
  const q = trackFilter.value.trim().toLowerCase()
  if (!q) return groupedByRecorder.value
  const result = {}
  for (const [recorder, tracks] of Object.entries(groupedByRecorder.value)) {
    const recorderMatches = recorder.toLowerCase().includes(q)
    const filtered = tracks.filter(p => {
      if (recorderMatches) return true
      const fields = [
        p.track_name,
        p.source_label,
        p.source_gear_name,
        String(p.track_number || ''),
        Array.isArray(p.path) ? p.path.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase()
      return fields.includes(q)
    })
    if (filtered.length) result[recorder] = filtered
  }
  return result
})

const hasVisibleFilteredGroups = computed(() => {
  return Object.values(filteredGroupedByRecorder.value).some(arr => arr && arr.length > 0)
})

// Sort paths by track number (for backward compatibility)
const sortedPaths = computed(() => {
  return [...props.signalPaths].sort((a, b) => {
    const recorderA = a.recorder_label || ''
    const recorderB = b.recorder_label || ''
    if (recorderA !== recorderB) {
      return recorderA.localeCompare(recorderB)
    }
    return compareTrackNumbers(a.track_number, b.track_number)
  })
})

// Reverse the path array (last transformer down to recorder)
function reversedPath(path) {
  if (!Array.isArray(path)) return []
  return [...path].reverse()
}

// Fetch project and stage information
async function fetchProjectAndStageInfo() {
  try {
    // Fetch project name
    if (props.projectId) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, main_show_days')
        .eq('id', props.projectId)
        .single()
      
      if (projectData) {
        projectName.value = projectData.project_name || ''
        
        // Format date range from main_show_days
        if (projectData.main_show_days && Array.isArray(projectData.main_show_days) && projectData.main_show_days.length > 0) {
          const dates = projectData.main_show_days
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b)
          
          if (dates.length > 0) {
            const start = dates[0]
            const end = dates[dates.length - 1]
            
            const formatDate = (date) => {
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
              })
            }
            
            if (start.getTime() === end.getTime()) {
              dateRange.value = formatDate(start)
            } else {
              dateRange.value = `${formatDate(start)} - ${formatDate(end)}`
            }
          }
        }
      }
    }
    
    // Fetch stage/venue name
    if (props.locationId) {
      const { data: locationData } = await supabase
        .from('locations')
        .select('stage_name, venue_name')
        .eq('id', props.locationId)
        .single()
      
      if (locationData) {
        stageName.value = locationData.stage_name || ''
        venueName.value = locationData.venue_name || ''
      }
    }
  } catch (error) {
    console.error('Error fetching project and stage info:', error)
  }
}

// Watch for changes to projectId or locationId
watch([() => props.projectId, () => props.locationId], () => {
  fetchProjectAndStageInfo()
}, { immediate: false })

// Optional: if later we compute paths locally, we will use the services.
onMounted(async () => {
  try { graphRef.value = await buildGraph(props.projectId, props.locationId) } catch {}
  await fetchProjectAndStageInfo()
})

// Smart track number sorting that handles numbers, letters, and alphanumeric combinations
// Examples: 1, 2, 3, A, B, C, 1L, 1R, 2L, 2R, 10A, 10B
function compareTrackNumbers(a, b) {
  // Handle null/undefined
  if (!a && !b) return 0
  if (!a) return 1  // null/undefined goes to end
  if (!b) return -1
  
  const strA = String(a).trim()
  const strB = String(b).trim()
  
  // If both are pure numbers, compare numerically
  const numA = Number(strA)
  const numB = Number(strB)
  if (!isNaN(numA) && !isNaN(numB) && strA === String(numA) && strB === String(numB)) {
    return numA - numB
  }
  
  // Natural sort: split into parts (numbers and text)
  const partsA = strA.match(/(\d+|\D+)/g) || []
  const partsB = strB.match(/(\d+|\D+)/g) || []
  
  const maxLength = Math.max(partsA.length, partsB.length)
  
  for (let i = 0; i < maxLength; i++) {
    const partA = partsA[i] || ''
    const partB = partsB[i] || ''
    
    // If one part is missing, the shorter string comes first
    if (!partA) return -1
    if (!partB) return 1
    
    // Check if both parts are numeric
    const numPartA = Number(partA)
    const numPartB = Number(partB)
    const isNumA = !isNaN(numPartA) && partA === String(numPartA)
    const isNumB = !isNaN(numPartB) && partB === String(numPartB)
    
    if (isNumA && isNumB) {
      // Both are numbers, compare numerically
      if (numPartA !== numPartB) {
        return numPartA - numPartB
      }
    } else if (isNumA) {
      // A is number, B is text - numbers come before letters
      return -1
    } else if (isNumB) {
      // A is text, B is number - numbers come before letters
      return 1
    } else {
      // Both are text, compare alphabetically
      const comparison = partA.localeCompare(partB, undefined, { numeric: true, sensitivity: 'base' })
      if (comparison !== 0) {
        return comparison
      }
    }
  }
  
  // If all parts are equal, they're the same
  return 0
}

// no additional summary columns

// Export to CSV file
function exportCSV() {
  if (props.signalPaths.length === 0) {
    return
  }
  
  try {
    // Helper to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) {
        return ''
      }
      const stringValue = String(value)
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }
    
    // Filter out hidden tracks for export
    const pathsToExport = props.signalPaths.filter(path => {
      const trackId = getTrackId(path)
      return !hiddenTracks.value.has(trackId)
    })
    
    if (pathsToExport.length === 0) {
      alert('No visible tracks to export. Please unhide some tracks or add tracks to the list.')
      return
    }
    
    // Group by recorder for export
    const exportGroups = {}
    pathsToExport.forEach(path => {
      const recorderName = path.recorder_label || 'Unknown Recorder'
      if (!exportGroups[recorderName]) {
        exportGroups[recorderName] = []
      }
      exportGroups[recorderName].push(path)
    })
    
    // Sort each group by track number
    Object.keys(exportGroups).forEach(recorder => {
      exportGroups[recorder].sort((a, b) => {
        return compareTrackNumbers(a.track_number, b.track_number)
      })
    })
    
    let csv = 'Recorder,Track #,Source Name,Source Gear,Signal Path\n'
    
    // Sort recorders alphabetically for consistent output
    Object.keys(exportGroups).sort().forEach(recorderName => {
      const tracks = exportGroups[recorderName]
      
      tracks.forEach(path => {
        const recorder = escapeCSV(recorderName)
        const trackNum = escapeCSV(path.track_number || '')
        const sourceName = escapeCSV(path.track_name || path.source_label || '')
        const sourceGear = escapeCSV(path.source_gear_name || '')
        const signalPath = escapeCSV(reversedPath(path.path).join(' → '))
        
        csv += `${recorder},${trackNum},${sourceName},${sourceGear},${signalPath}\n`
      })
    })
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `track-list-${props.projectId || 'export'}-${Date.now()}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100)
  } catch (e) {
    console.error('Error exporting CSV:', e)
    alert('Failed to export CSV. Please try again.')
  }
}

// Shared print styles function
function getPrintStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8f9fa;
      padding: 20px;
    }
    .print-content {
      background: white;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 100%;
    }
    .print-header {
      margin-bottom: 20px;
      text-align: center;
    }
    .print-header h3 {
      margin: 0 0 5px 0;
      font-size: 24px;
      color: #212529;
    }
    .print-header p {
      margin: 0;
      color: #6c757d;
      font-size: 14px;
    }
    .recorder-group-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .recorder-section-header {
      margin: 0 0 15px 0;
      padding: 10px;
      background: #2563eb;
      color: white;
      font-size: 18px;
      border-radius: 6px;
      font-weight: 600;
    }
    .track-list-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .track-list-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #dee2e6;
      font-weight: 600;
      color: #212529;
    }
    .track-list-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e9ecef;
      color: #495057;
    }
    .track-list-table tbody tr:hover {
      background: #f8f9fa;
    }
    .track-list-summary {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      text-align: center;
    }
    .summary-item {
      display: inline-block;
      margin: 0 20px;
    }
    .summary-label {
      color: #6c757d;
      margin-right: 8px;
    }
    .summary-value {
      font-weight: 600;
      color: #212529;
    }
    .print-actions {
      text-align: center;
      margin-top: 20px;
      padding: 15px;
    }
    .print-actions button {
      padding: 10px 20px;
      margin: 0 5px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    .print-actions button:hover {
      background: #1d4ed8;
    }
    .print-actions button.secondary {
      background: #6c757d;
    }
    .print-actions button.secondary:hover {
      background: #5a6268;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .print-content {
        padding: 0;
        box-shadow: none;
      }
      .print-header {
        margin-bottom: 15px;
      }
      .print-actions {
        display: none;
      }
      .track-list-table {
        page-break-inside: auto;
      }
      .track-list-table tbody tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      .recorder-group-section {
        page-break-after: avoid;
      }
    }
    @page {
      margin: 1cm;
    }
  `
}

// Export/Print track list as PDF (grouped by recorder)
async function exportToPDF() {
  if (props.signalPaths.length === 0) {
    return
  }
  
  // Open the PDF export options modal
  openPDFExportModal()
}

// Confirm and execute PDF export with selected options
async function confirmPDFExport() {
  if (!canExportPDF.value) {
    console.warn('Cannot export PDF: validation failed', {
      hasRecorders: pdfExportOptions.value.selectedRecorders.length > 0,
      hasFileName: pdfExportOptions.value.fileName.trim().length > 0
    })
    return
  }
  
  if (isExportingPDF.value) {
    return // Prevent multiple simultaneous exports
  }
  
  try {
    isExportingPDF.value = true
    closePDFExportModal()

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    // Ensure filename has .pdf extension
    const fileName = pdfExportOptions.value.fileName.trim()
    const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`

    console.log('Starting PDF export...', { finalFileName, selectedRecorders: pdfExportOptions.value.selectedRecorders })

    // Create PDF
    const doc = new jsPDF('portrait', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    
    // Filter recorders based on selection
    const selectedRecorderNames = pdfExportOptions.value.selectedRecorders.sort()
    
    if (selectedRecorderNames.length === 0) {
      throw new Error('No recorders selected for export')
    }
    
    // Process each selected recorder on a separate page
    selectedRecorderNames.forEach((recorderName, index) => {
      // Start new page for each recorder (except first one which starts on first page)
      if (index > 0) {
        doc.addPage()
      }
      
      let yPos = margin
      
      // Add header
      doc.setFontSize(18)
      doc.text('Track List', pageWidth / 2, yPos, { align: 'center' })
      yPos += 8
      
      // Add subtitle
      doc.setFontSize(12)
      let subtitle = customTitle.value || 'Complete signal routing from source to recorder tracks'
      if (pdfExportOptions.value.recordingDateName) {
        subtitle = `${subtitle} • ${pdfExportOptions.value.recordingDateName}`
      }
      doc.text(subtitle, pageWidth / 2, yPos, { align: 'center' })
      yPos += 15
      
      // Add recorder header
      doc.setFontSize(14)
      doc.setTextColor(37, 99, 235) // Blue color
      doc.text(recorderName, margin, yPos)
      yPos += 8
      
      // Get all tracks for this recorder, then filter out hidden ones
      const allTracksForRecorder = props.signalPaths.filter(path => {
        const pathRecorderName = path.recorder_label || 'Unknown Recorder'
        return pathRecorderName === recorderName
      })
      
      // Filter out hidden tracks for export
      const tracks = allTracksForRecorder.filter(path => {
        const trackId = getTrackId(path)
        return !hiddenTracks.value.has(trackId)
      })
      
      // Sort by track number
      tracks.sort((a, b) => {
        return compareTrackNumbers(a.track_number, b.track_number)
      })
      
      if (!tracks || tracks.length === 0) {
        console.warn(`No visible tracks found for recorder: ${recorderName}`)
        doc.setFontSize(10)
        doc.setTextColor(0, 0, 0)
        doc.text('No visible tracks found for this recorder', margin, yPos)
        return
      }
      
      // Build table columns based on options
      const tableHead = ['Track #', 'Source Name']
      if (pdfExportOptions.value.includeSignalPath) {
        tableHead.push('Signal Path')
      }
      
      const tableData = tracks.map(path => {
        const trackNum = path.track_number || '—'
        const sourceName = path.track_name || path.source_label || '—'
        const row = [trackNum, sourceName]
        if (pdfExportOptions.value.includeSignalPath) {
          // Use "//" instead of "→" for PDF compatibility
          const signalPath = reversedPath(path.path).join(' // ')
          row.push(signalPath)
        }
        return row
      })
      
      // Add table
      autoTable(doc, {
        head: [tableHead],
        body: tableData,
        startY: yPos,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 250] }
      })
      
      doc.setTextColor(0, 0, 0) // Reset to black
    })
    
    console.log('PDF document created successfully')
    
    // Save PDF to storage instead of downloading
    let venueId = null
    if (props.locationId) {
      try {
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('venue_id')
          .eq('id', props.locationId)
          .single()
        
        if (locationError) {
          console.warn('Error fetching venue_id:', locationError)
        } else if (locationData) {
          venueId = locationData.venue_id || null
        }
      } catch (err) {
        console.warn('Error fetching venue_id:', err)
      }
    }
    
    try {
      const { savePDFToStorage, showExportSuccessModal } = await import('@/services/exportDocsStorage')
      const description = `Track list export${customTitle.value ? ` - ${customTitle.value}` : ''}${pdfExportOptions.value.recordingDateName ? ` (${pdfExportOptions.value.recordingDateName})` : ''}`
      
      console.log('Saving PDF to storage...', { projectId: props.projectId, venueId, stageId: props.locationId })
      
      const result = await savePDFToStorage(
        doc,
        finalFileName,
        props.projectId,
        venueId,
        props.locationId,
        description
      )
      
      console.log('Save result:', result)
      
      if (result.success) {
        showExportSuccessModal(result, finalFileName, {
          projectId: props.projectId,
          venueId,
          stageId: props.locationId,
          mimeType: 'application/pdf'
        })
      } else {
        // Fallback: download directly if storage fails
        console.warn('Storage save failed, falling back to direct download:', result.error)
        doc.save(finalFileName)
        alert(`PDF exported successfully, but failed to save to storage: ${result.error || 'Unknown error'}. The file has been downloaded to your device.`)
      }
    } catch (storageError) {
      console.error('Error saving to storage, falling back to direct download:', storageError)
      // Fallback: download directly if storage service fails
      doc.save(finalFileName)
      alert(`PDF exported successfully, but failed to save to storage. The file has been downloaded to your device.`)
    }
  } catch (e) {
    console.error('Error exporting track list:', e)
    alert(`Failed to export track list: ${e.message || 'Unknown error'}. Please check the console for details.`)
  } finally {
    isExportingPDF.value = false
  }
}
</script>

<style scoped>
/* ─── Container ────────────────────────────────────────── */
.track-list-container {
  padding: var(--space-4);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ─── Header ───────────────────────────────────────────── */
.tl-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.tl-head-title { min-width: 0; }
.tl-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  margin: 0;
  letter-spacing: -0.02em;
}
.tl-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0 0;
}
.tl-counts { display: flex; gap: var(--space-3); }
.tl-count { display: inline-flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.tl-count-value {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--color-primary-600);
  font-variant-numeric: tabular-nums;
}
.tl-count.muted .tl-count-value { color: var(--text-tertiary); }
.tl-count-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-weight: var(--font-medium);
}

/* ─── Toolbar ──────────────────────────────────────────── */
.tl-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}
.tl-search { position: relative; flex: 1 1 220px; min-width: 180px; }
.tl-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.tl-search-input {
  width: 100%;
  height: 34px;
  padding: 0 10px 0 32px;
  font-size: var(--text-sm);
  background: var(--surface-card);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: background var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
  -webkit-appearance: none;
  appearance: none;
}
.tl-search-input::placeholder { color: var(--text-tertiary); }
.tl-search-input:focus {
  outline: none;
  border-color: var(--color-primary-300);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.tl-actions { display: flex; gap: 6px; align-items: center; margin-left: auto; }
.tl-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  height: 34px;
  background: var(--chip-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--chip-text);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.tl-chip-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
.tl-chip-btn.active {
  background: var(--chip-bg-active);
  color: var(--chip-text-active);
  border-color: var(--chip-border-active);
}
.tl-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.tl-icon-btn.small { width: 28px; height: 28px; background: transparent; border: none; }
.tl-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.tl-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tl-icon-btn.spinning svg { animation: tlSpin 0.9s linear infinite; }
@keyframes tlSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.tl-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 34px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.tl-primary-btn:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.tl-primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── States ───────────────────────────────────────────── */
.tl-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  background: var(--surface-card);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-lg);
  gap: 6px;
  text-align: center;
}
.tl-state-icon-bg {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}
.tl-state-icon.spinning { animation: tlSpin 0.9s linear infinite; color: var(--color-primary-500); }
.tl-state-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.tl-state-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  max-width: 40ch;
}

/* ─── Groups ───────────────────────────────────────────── */
.tl-groups { display: flex; flex-direction: column; gap: var(--space-3); }
.tl-group {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tl-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface-card-muted);
  border-bottom: 1px solid var(--surface-border);
  color: var(--text-secondary);
}
.tl-group-header svg { color: var(--color-primary-500); }
.tl-group-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-group-count {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  background: var(--chip-bg);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-variant-numeric: tabular-nums;
}

/* ─── Table (desktop) ──────────────────────────────────── */
.tl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  table-layout: fixed;
}
.tl-table thead { display: none; }
.tl-table thead th {
  text-align: left;
  padding: 8px 14px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: transparent;
  border-bottom: 1px solid var(--surface-border);
}
.tl-table thead th.col-num { width: 48px; }
.tl-table thead th.col-source { width: 220px; }
.tl-table thead th.col-actions { width: 40px; text-align: right; }
.tl-table col,
.tl-table tbody td.col-num { width: 56px; }
.tl-table tbody td.col-source { width: 240px; }
.tl-table tbody td.col-actions { width: 44px; text-align: right; }
.tl-table tbody td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--surface-border);
  vertical-align: top;
  color: var(--text-primary);
}
.tl-table tbody tr:last-child td { border-bottom: none; }
.tl-table tbody tr.track-hidden { opacity: 0.45; }
.col-num {
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.col-actions { text-align: right; }
.tl-track-link {
  display: inline;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--color-primary-600);
  cursor: pointer;
  font-weight: var(--font-semibold);
  text-align: left;
}
.tl-track-link:hover { color: var(--color-primary-700); text-decoration: underline; }
.tl-track-name { font-weight: var(--font-semibold); color: var(--text-heading); }
.tl-source-gear { font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 2px; }

/* ─── Signal path ─────────────────────────────────────── */
.tl-path-flow {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-family: var(--font-family-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.tl-path-node { background: var(--chip-bg); padding: 2px 7px; border-radius: var(--radius-sm); white-space: nowrap; }
.tl-path-arrow { color: var(--text-tertiary); }

/* ─── Card list (mobile) ──────────────────────────────── */
.tl-cards { display: none; list-style: none; padding: 0; margin: 0; }
.tl-card {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tl-card:last-child { border-bottom: none; }
.tl-card.track-hidden { opacity: 0.45; }
.tl-card-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.tl-card-num {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}
.tl-card-source { font-size: var(--text-sm); text-align: left; line-height: 1.25; }
.tl-card-path { margin-top: 4px; }

/* ─── Mobile layout ────────────────────────────────────── */
@media (max-width: 600px) {
  .track-list-container { padding: var(--space-3); }
  .tl-head { flex-direction: column; align-items: stretch; gap: var(--space-2); }
  .tl-counts { justify-content: flex-start; gap: var(--space-4); }
  .tl-count { align-items: flex-start; }
  .tl-toolbar { padding: 6px; }
  .tl-actions { gap: 4px; }
  .tl-chip-btn span { display: none; }
  .tl-primary-btn-label { display: none; }
  .tl-primary-btn { width: 34px; padding: 0; justify-content: center; }
  .tl-table { display: none; }
  .tl-cards { display: flex; flex-direction: column; }
  .tl-group-header { top: 104px; }
}

:deep(.dark) .tl-path-node { background: rgba(255,255,255,0.06); }

/* ─── PDF export modal (restyled) ──────────────────────── */
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
.pdf-export-modal {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  max-width: 520px;
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
}
.modal-close:hover { background: var(--surface-hover); color: var(--text-primary); }
.modal-body { padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 36px;
}
.form-input:focus { outline: none; border-color: var(--color-primary-400); box-shadow: 0 0 0 3px var(--focus-ring); }
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}
.checkbox-input { width: 16px; height: 16px; cursor: pointer; }
.recorder-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}
.recorder-checkbox { padding: 4px 2px; }
.checkbox-actions { display: flex; gap: var(--space-3); margin-top: 6px; }
.btn-link {
  background: none;
  border: none;
  color: var(--color-primary-600);
  font-size: var(--text-xs);
  cursor: pointer;
  padding: 2px 4px;
  font-weight: var(--font-medium);
}
.btn-link:hover { text-decoration: underline; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--surface-border);
}
.btn {
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal);
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-warning { background: transparent; color: var(--text-secondary); border-color: var(--surface-border); }
.btn-warning:hover:not(:disabled) { background: var(--surface-hover); color: var(--text-primary); border-color: var(--surface-border-strong); }
.btn-positive { background: var(--color-primary-500); color: #ffffff; border-color: var(--color-primary-600); }
.btn-positive:hover:not(:disabled) { background: var(--color-primary-600); box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25); }

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .tl-toolbar,
  .tl-group,
  .tl-chip-btn,
  .tl-icon-btn,
  .tl-primary-btn,
  .tl-state { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .tl-icon-btn,
  .tl-chip-btn,
  .tl-primary-btn,
  .tl-search-input { transition: none; }
  .tl-icon-btn.spinning svg { animation: none; }
  .tl-state-icon.spinning { animation: none; }
}
</style>

