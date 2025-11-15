<template>
<div class="track-list-container">
  <div class="track-list-header">
    <h3>Track List</h3>
    <p v-if="customTitle">{{ customTitle }}</p>
    <p v-else>Complete signal routing from source to recorder tracks</p>
  </div>

  <!-- Export Buttons -->
  <div class="track-list-actions">
    <button @click="refetchSignalPaths" class="btn-refetch" :disabled="loading">
      🔄 {{ loading ? 'Refreshing...' : 'Refetch Signal Paths' }}
    </button>
    <button @click="exportToPDF" class="btn-export" :disabled="signalPaths.length === 0">
      🖨️ Print / Export PDF
    </button>
    <button @click="exportCSV" class="btn-export">
      📥 Export CSV
    </button>
  </div>

  <!-- Loading State -->
  <div v-if="loading" class="loading-state">
    <p>Loading track list...</p>
  </div>

  <!-- No Data State -->
  <div v-else-if="signalPaths.length === 0" class="no-data-state">
    <p>No signal paths found.</p>
    <p class="hint">Connect sources to recorders in the Signal Flow tab to see them here.</p>
  </div>

  <!-- Track List Table -->
  <div v-else class="track-list-table-wrapper">
    <template v-for="(tracks, recorderName) in groupedByRecorder" :key="recorderName">
      <div class="recorder-group">
        <h4 class="recorder-group-header">{{ recorderName }}</h4>
        <table class="track-list-table">
          <thead>
            <tr>
              <th>Track #</th>
              <th>Source Name</th>
              <th>Signal Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="path in tracks" :key="path.connection_id" class="track-row">
              <td class="track-number">{{ path.track_number || '—' }}</td>
              <td class="source-name">
                <strong 
                  v-if="path.connection_id"
                  class="track-name-link"
                  @click="handleTrackNameClick(path.connection_id)"
                  :title="'Click to view connection in Signal Flow'"
                >
                  {{ path.track_name || path.source_label || '—' }}
                </strong>
                <strong v-else>{{ path.track_name || path.source_label || '—' }}</strong>
                <div v-if="path.source_gear_name" class="source-gear-name">
                  ({{ path.source_gear_name }})
                </div>
              </td>
              <td class="signal-path">
                <div class="path-flow">
                  <template v-for="(node, index) in reversedPath(path.path)" :key="index">
                    <span class="path-node">
                      {{ node }}
                      <span v-if="index < reversedPath(path.path).length - 1" class="path-arrow">→</span>
                    </span>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>

  <!-- Summary Stats -->
  <div v-if="signalPaths.length > 0" class="track-list-summary">
    <div class="summary-item">
      <span class="summary-label">Total Tracks:</span>
      <span class="summary-value">{{ signalPaths.length }}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Recorders:</span>
      <span class="summary-value">{{ Object.keys(groupedByRecorder).length }}</span>
    </div>
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
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadPDF } from '@/utils/pdfDownloadHelper'
import InputModal from '@/components/signalmapper/InputModal.vue'
import { supabase } from '@/supabase'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
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

// Group paths by recorder, then sort by track number within each group
const groupedByRecorder = computed(() => {
  const groups = {}
  
  props.signalPaths.forEach(path => {
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
    
    let csv = 'Recorder,Track #,Source Name,Source Gear,Signal Path\n'
    
    // Sort recorders alphabetically for consistent output
    Object.keys(groupedByRecorder.value).sort().forEach(recorderName => {
      const tracks = groupedByRecorder.value[recorderName]
      
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
      
      // Prepare table data
      const tracks = groupedByRecorder.value[recorderName]
      
      if (!tracks || tracks.length === 0) {
        console.warn(`No tracks found for recorder: ${recorderName}`)
        doc.setFontSize(10)
        doc.setTextColor(0, 0, 0)
        doc.text('No tracks found for this recorder', margin, yPos)
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
      const { savePDFToStorage, showExportSuccessModal } = await import('@/services/exportStorageService')
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
.track-list-container {
  padding: 20px;
}

.track-list-header {
  margin-bottom: 20px;
  text-align: center;
}

.track-list-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: var(--text-primary);
}

.track-list-header p {
  margin: 0;
  color: var(--text-secondary);
}

.track-list-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
}

.btn-refetch {
  padding: 10px 20px;
  background: var(--color-secondary-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-refetch:hover:not(:disabled) {
  background: var(--color-secondary-600);
}

.btn-refetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-export,
.btn-print {
  padding: 10px 20px;
  background: var(--color-primary-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-export:hover,
.btn-print:hover {
  background: var(--color-primary-600);
}

.loading-state,
.no-data-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.no-data-state p {
  margin: 10px 0;
}

.no-data-state .hint {
  font-size: 14px;
  color: var(--text-tertiary);
}

.track-list-table-wrapper {
  overflow-x: auto;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #e9ecef);
}

.track-list-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-primary);
}

.track-list-table thead {
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.track-list-table th {
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border-color, #e9ecef);
  font-size: 14px;
}

.track-list-table td {
  padding: 15px;
  border-bottom: 1px solid var(--border-color, #e9ecef);
  font-size: 14px;
  color: var(--text-secondary);
}

.track-list-table tbody tr:hover {
  background: var(--bg-secondary);
}

.track-list-table tbody tr:last-child td {
  border-bottom: none;
}

.recorder-group {
  margin-bottom: 30px;
}

.recorder-group-header {
  margin: 0 0 15px 0;
  padding: 12px 16px;
  background: var(--color-primary-500);
  color: white;
  font-size: 18px;
  border-radius: 8px;
  font-weight: 600;
}

.track-number {
  font-weight: 700;
  color: var(--color-primary-600, #007bff);
  font-size: 16px;
}

.recorder-name {
  font-weight: 600;
  color: var(--color-danger-500, #dc3545);
}

.source-name strong {
  color: var(--color-success-600, #28a745);
  font-size: 15px;
}

.track-name-link {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: var(--color-success-300, rgba(40, 167, 69, 0.5));
  transition: all 0.2s ease;
}

.track-name-link:hover {
  color: var(--color-success-700, #1e7e34);
  text-decoration-color: var(--color-success-600, #28a745);
  text-decoration-thickness: 2px;
}

.source-gear-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: normal;
}

.signal-path {
  font-family: 'Courier New', monospace;
}

.path-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.path-node {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.path-arrow {
  color: var(--color-primary-600, #007bff);
  font-weight: bold;
  margin: 0 2px;
}

.boolean-cell {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-tertiary, #e9ecef);
  color: var(--text-secondary);
}

.status-badge.active {
  background: var(--color-success-100, #d4edda);
  color: var(--color-success-800, #155724);
}

.track-list-summary {
  display: flex;
  gap: 30px;
  justify-content: center;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e9ecef);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary-600, #007bff);
}

@media (max-width: 768px) {
  .track-list-table-wrapper {
    overflow-x: scroll;
  }

  .track-list-table {
    min-width: 800px;
  }

  .track-list-summary {
    flex-direction: column;
    gap: 15px;
  }
}

@media print {
  /* Hide everything on the page except this component */
  body * {
    visibility: hidden;
  }
  
  .track-list-container,
  .track-list-container * {
    visibility: visible;
  }
  
  .track-list-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .track-list-actions {
    display: none;
  }

  .track-list-summary {
    page-break-before: avoid;
  }

  .track-list-table {
    page-break-inside: auto;
  }

  .track-row {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}

/* PDF Export Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.pdf-export-modal {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #e9ecef);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-heading);
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.modal-close:hover {
  background: var(--bg-secondary);
}

.modal-body {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary-500);
}

.recorder-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color, #e9ecef);
}

.recorder-checkbox {
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.recorder-checkbox:hover {
  background: var(--bg-primary);
}

.checkbox-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary-500);
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
  padding: 0;
  transition: color 0.2s;
}

.btn-link:hover {
  color: var(--color-primary-600);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #e9ecef);
}

.confirm-button {
  background: var(--color-success-500);
  color: var(--text-inverse) !important;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.confirm-button:hover:not(:disabled) {
  background: var(--color-success-600);
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-button {
  background: var(--color-secondary-400);
  color: var(--text-inverse) !important;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.cancel-button:hover {
  background: var(--color-secondary-500);
}
</style>

