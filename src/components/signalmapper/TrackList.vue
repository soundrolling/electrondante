<template>
<div class="track-list-container">
  <div class="track-list-header">
    <h3>Track List</h3>
    <p>Complete signal routing from source to recorder tracks</p>
  </div>

  <!-- Export Buttons -->
  <div class="track-list-actions">
    <button @click="exportCSV" class="btn-export">
      📊 Export CSV
    </button>
    <button @click="printTrackList" class="btn-print">
      🖨️ Print
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
    <table class="track-list-table">
      <thead>
        <tr>
          <th>Track #</th>
          <th>Recorder</th>
          <th>Source Name</th>
          <th>Signal Path</th>
          <th>Pad</th>
          <th>Phantom Power</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="path in sortedPaths" :key="path.connection_id" class="track-row">
          <td class="track-number">{{ path.track_number || '—' }}</td>
          <td class="recorder-name">{{ path.recorder_label }}</td>
          <td class="source-name">
            <strong>{{ path.track_name || path.source_label || '—' }}</strong>
          </td>
          <td class="signal-path">
            <div class="path-flow">
              <span v-for="(node, index) in path.path" :key="index" class="path-node">
                {{ node }}
                <span v-if="index < path.path.length - 1" class="path-arrow">→</span>
              </span>
            </div>
          </td>
          <td class="boolean-cell">
            <span class="status-badge">
              {{ typeof path.pad === 'number' ? path.pad : (path.pad ? 1 : 0) }}
            </span>
          </td>
          <td class="boolean-cell">
            <span :class="['status-badge', { active: path.phantom_power }]">
              {{ path.phantom_power ? 'Yes' : 'No' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Summary Stats -->
  <div v-if="signalPaths.length > 0" class="track-list-summary">
    <div class="summary-item">
      <span class="summary-label">Total Tracks:</span>
      <span class="summary-value">{{ signalPaths.length }}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">With Pad:</span>
      <span class="summary-value">{{ padsCount }}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">With Phantom Power:</span>
      <span class="summary-value">{{ phantomPowerCount }}</span>
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

// Sort paths by track number
const sortedPaths = computed(() => {
  return [...props.signalPaths].sort((a, b) => {
    const trackA = a.track_number || 0
    const trackB = b.track_number || 0
    return trackA - trackB
  })
})

// Summary stats
const padsCount = computed(() => 
  props.signalPaths.filter(p => p.pad).length
)

const phantomPowerCount = computed(() => 
  props.signalPaths.filter(p => p.phantom_power).length
)

// Export to CSV
function exportCSV() {
  const headers = ['Track #', 'Recorder', 'Source Name', 'Signal Path', 'Pad', 'Phantom Power']
  const rows = sortedPaths.value.map(path => [
    path.track_number || '',
    path.recorder_label || '',
    path.track_name || path.source_label || '',
    path.path.join(' → '),
    path.pad ? 'Yes' : 'No',
    path.phantom_power ? 'Yes' : 'No'
  ])

  let csv = headers.join(',') + '\n'
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n'
  })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `track_list_${new Date().toISOString().slice(0, 10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Print track list
function printTrackList() {
  window.print()
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
  color: #212529;
}

.track-list-header p {
  margin: 0;
  color: #6c757d;
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
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-export:hover,
.btn-print:hover {
  background: #0056b3;
}

.loading-state,
.no-data-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.no-data-state p {
  margin: 10px 0;
}

.no-data-state .hint {
  font-size: 14px;
  color: #adb5bd;
}

.track-list-table-wrapper {
  overflow-x: auto;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.track-list-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.track-list-table thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.track-list-table th {
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #e9ecef;
  font-size: 14px;
}

.track-list-table td {
  padding: 15px;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
  color: #495057;
}

.track-list-table tbody tr:hover {
  background: #f8f9fa;
}

.track-list-table tbody tr:last-child td {
  border-bottom: none;
}

.track-number {
  font-weight: 700;
  color: #007bff;
  font-size: 16px;
}

.recorder-name {
  font-weight: 600;
  color: #dc3545;
}

.source-name strong {
  color: #28a745;
  font-size: 15px;
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
  color: #007bff;
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
  background: #e9ecef;
  color: #6c757d;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.track-list-summary {
  display: flex;
  gap: 30px;
  justify-content: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.summary-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #007bff;
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

