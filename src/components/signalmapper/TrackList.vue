<template>
<div class="track-list-container">
  <div class="track-list-header">
    <h3>Track List</h3>
    <p>Complete signal routing from source to recorder tracks</p>
  </div>

  <!-- Export Buttons -->
  <div class="track-list-actions">
    <button @click="exportToPDF" class="btn-export">
      🖨️ Print / Export PDF
    </button>
    <button @click="exportCSV" class="btn-export">
      🖨️ Print / Export CSV
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
</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  signalPaths: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['track-name-clicked'])

function handleTrackNameClick(connectionId) {
  emit('track-name-clicked', connectionId)
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
  
  // Sort each group by track number
  Object.keys(groups).forEach(recorder => {
    groups[recorder].sort((a, b) => {
      const trackA = a.track_number || 0
      const trackB = b.track_number || 0
      return trackA - trackB
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
    const trackA = a.track_number || 0
    const trackB = b.track_number || 0
    return trackA - trackB
  })
})

// Reverse the path array (last transformer down to recorder)
function reversedPath(path) {
  if (!Array.isArray(path)) return []
  return [...path].reverse()
}

// no additional summary columns

// Export to CSV (using print preview)
function exportCSV() {
  if (props.signalPaths.length === 0) {
    return
  }
  
  try {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      return
    }
    
    const buildCSVTableHTML = () => {
      let html = ''
      
      Object.keys(groupedByRecorder.value).sort().forEach(recorderName => {
        const tracks = groupedByRecorder.value[recorderName]
        
        html += `
          <div class="recorder-group-section">
            <h3 class="recorder-section-header">${recorderName}</h3>
            <table class="track-list-table">
              <thead>
                <tr>
                  <th>Track #</th>
                  <th>Source Name</th>
                  <th>Signal Path</th>
                </tr>
              </thead>
              <tbody>
        `
        
        tracks.forEach(path => {
          const trackNum = path.track_number || '—'
          const sourceName = path.track_name || path.source_label || '—'
          const signalPath = reversedPath(path.path).join(' → ')
          
          html += `
            <tr>
              <td>${trackNum}</td>
              <td><strong>${sourceName}</strong></td>
              <td>${signalPath}</td>
            </tr>
          `
        })
        
        html += `
              </tbody>
            </table>
          </div>
        `
      })
      
      return html
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Track List (CSV) - Print Preview</title>
          <style>
            ${getPrintStyles()}
            .recorder-group-section {
              margin-bottom: 40px;
              page-break-inside: avoid;
            }
            .recorder-section-header {
              margin: 0 0 15px 0;
              padding: 10px;
              background: var(--color-primary-500);
              color: white;
              font-size: 18px;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <div class="print-content">
            <div class="print-header">
              <h3>Track List</h3>
              <p>Complete signal routing from source to recorder tracks</p>
            </div>
            ${buildCSVTableHTML()}
            <div class="track-list-summary">
              <div class="summary-item">
                <span class="summary-label">Total Tracks:</span>
                <span class="summary-value">${props.signalPaths.length}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Recorders:</span>
                <span class="summary-value">${Object.keys(groupedByRecorder.value).length}</span>
              </div>
            </div>
          </div>
          <div class="print-actions">
            <button onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="secondary" onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    
    printWindow.onload = () => {
      printWindow.focus()
    }
  } catch (e) {
    console.error('Error exporting CSV:', e)
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

// Export/Print track list with print preview (grouped by recorder)
function exportToPDF() {
  if (props.signalPaths.length === 0) {
    return
  }
  
  try {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      return
    }
    
    const buildTableHTML = () => {
      let html = ''
      
      Object.keys(groupedByRecorder.value).sort().forEach(recorderName => {
        const tracks = groupedByRecorder.value[recorderName]
        
        html += `
          <div class="recorder-group-section">
            <h3 class="recorder-section-header">${recorderName}</h3>
            <table class="track-list-table">
              <thead>
                <tr>
                  <th>Track #</th>
                  <th>Source Name</th>
                  <th>Signal Path</th>
                </tr>
              </thead>
              <tbody>
        `
        
        tracks.forEach(path => {
          const trackNum = path.track_number || '—'
          const sourceName = path.track_name || path.source_label || '—'
          const signalPath = reversedPath(path.path).join(' → ')
          
          html += `
            <tr>
              <td>${trackNum}</td>
              <td><strong>${sourceName}</strong></td>
              <td>${signalPath}</td>
            </tr>
          `
        })
        
        html += `
              </tbody>
            </table>
          </div>
        `
      })
      
      return html
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Track List - Print Preview</title>
          <style>
            ${getPrintStyles()}
          </style>
        </head>
        <body>
          <div class="print-content">
            <div class="print-header">
              <h3>Track List</h3>
              <p>Complete signal routing from source to recorder tracks</p>
            </div>
            ${buildTableHTML()}
            <div class="track-list-summary">
              <div class="summary-item">
                <span class="summary-label">Total Tracks:</span>
                <span class="summary-value">${props.signalPaths.length}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Recorders:</span>
                <span class="summary-value">${Object.keys(groupedByRecorder.value).length}</span>
              </div>
            </div>
          </div>
          <div class="print-actions">
            <button onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="secondary" onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    
    printWindow.onload = () => {
      printWindow.focus()
    }
  } catch (e) {
    console.error('Error exporting track list:', e)
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
</style>

