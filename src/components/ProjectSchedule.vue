<!-- src/components/ProjectSchedule.vue -->
<template>
<div class="project-schedule">
  <!-- TOP BAR -->
  <div class="top-bar">
    <button class="back-button" @click="goBack">← Back</button>
  </div>

  <!-- HEADER -->
  <header class="header-section">
    <h1>
      Artist Schedule
      <p v-if="currentLocation">
        Viewing Schedule for
        <strong>{{ currentLocation.venue_name }} - {{ currentLocation.stage_name }}</strong>
      </p>
      <p v-else><em>No location selected</em></p>
    </h1>
  </header>

  <!-- LOADING -->
  <div v-if="isLoading" class="loading-indicator">
    <svg class="spinner" viewBox="0 0 24 24">
      <circle class="spinner__bg" cx="12" cy="12" r="10" />
      <path class="spinner__arc" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    <span class="loading-text">Loading schedules...</span>
  </div>

  <!-- ERROR -->
  <div v-if="formError" class="error-message" role="alert">
    <strong>Error:</strong> {{ formError }}
  </div>

  <!-- MAIN CONTENT -->
  <main v-else class="schedule-management">
    <!-- CURRENT TIME -->
    <div class="live-timecode">Current Time: {{ formattedCurrentDeviceTime }}</div>

    <!-- LOCATION SELECTOR -->
    <div class="input-container" v-if="!routeLocationId">
      <label class="label" for="locationSelect">Select Location:</label>
      <select
        id="locationSelect"
        v-model.number="selectedLocationId"
        @change="onLocationSelect"
        class="input-field"
      >
        <option value="" disabled>Select a location</option>
        <option
          v-for="loc in locations"
          :key="loc.id"
          :value="loc.id"
        >
          {{ loc.venue_name }} - {{ loc.stage_name }}
        </option>
      </select>
    </div>

    <!-- FILTERS AND CONTROLS -->
    <section class="filters-section-modern" v-if="selectedLocationId && schedules.length">
      <div class="filters-grid">
        <div class="filter-block">
          <label class="label-modern">Sort by</label>
          <select v-model="sortOrder" class="input-modern">
            <option value="asc">Earliest</option>
            <option value="desc">Latest</option>
            <option value="artist">Artist A–Z</option>
          </select>
        </div>
        <div class="filter-block">
          <label class="label-modern">Start</label>
          <input v-model="filterStart" type="datetime-local" class="input-modern" />
        </div>
        <div class="filter-block">
          <label class="label-modern">End</label>
          <input v-model="filterEnd" type="datetime-local" class="input-modern" />
        </div>
      </div>
      <div class="date-row-modern">
        <label class="label-modern">Date</label>
        <button class="nav-btn-modern" @click="previousDay" :disabled="currentDayIndex === 0">‹</button>
        <div class="current-date-modern">{{ formatDisplayDate(currentDay?.date) }}</div>
        <button class="nav-btn-modern" @click="nextDay" :disabled="currentDayIndex >= groupedDays.length - 1">›</button>
      </div>
    </section>

    <!-- COLLAPSIBLE FORM -->
    <section class="collapsible-form-modern">
      <button @click="toggleForm" class="primary-button add-schedule-btn-modern">
        {{ isFormOpen ? 'Hide Form' : 'Add to Schedule' }}
      </button>
      <transition name="fade">
        <div v-if="isFormOpen" class="schedule-form">
          <h3>{{ isEditing ? 'Edit Schedule Item' : 'Add Schedule Item' }}</h3>
          <form @submit.prevent="handleFormSubmit">
            <div class="form-group">
              <label for="artistName">Artist Name <span>*</span></label>
              <input
                v-model="newArtistName"
                id="artistName"
                type="text"
                placeholder="Enter artist name"
                required
              />
            </div>
            <div class="form-group">
              <label for="startTime">Start Time <span>*</span></label>
              <input
                v-model="newStartTime"
                id="startTime"
                type="time"
                required
              />
            </div>
            <div class="form-group">
              <label for="endTime">End Time <span>*</span></label>
              <input
                v-model="newEndTime"
                id="endTime"
                type="time"
                required
              />
            </div>
            <div class="form-group">
              <label for="recordingDate">Recording Date <span>*</span></label>
              <input
                v-model="newRecordingDate"
                id="recordingDate"
                type="date"
                required
              />
            </div>
            <div class="form-group">
              <label for="warningMinutes">Warning (minutes)</label>
              <input
                v-model.number="newWarningMinutes"
                id="warningMinutes"
                type="number"
                min="0"
                max="60"
                step="1"
                placeholder="2"
                title="Minutes before artist start time to show notification (default: 2)"
              />
              <small class="form-hint">Minutes before start time to show changeover notification</small>
            </div>
            <div class="form-actions">
              <button type="button" @click="cancelForm" class="secondary-button">
                Cancel
              </button>
              <button
                type="submit"
                class="primary-button"
                :disabled="isSubmitting || !newArtistName || !newStartTime || !newEndTime || !newRecordingDate"
              >
                <svg v-if="isSubmitting" class="spinner-icon" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span>
                  {{ isSubmitting 
                    ? (isEditing ? 'Updating...' : 'Adding...') 
                    : (isEditing ? 'Update Schedule' : 'Add Schedule') }}
                </span>
              </button>
            </div>
          </form>
        </div>
      </transition>
    </section>

    <!-- SCHEDULE TABLE -->
    <section class="schedule-table-container">
      <h3>Schedules</h3>
      <div v-if="filteredSchedules.length === 0" class="empty-state">
        <p>No schedules found for {{ formatDisplayDate(currentDay?.date) }} with the current filters.</p>
      </div>
      <div v-else class="responsive-table">
        <table class="schedule-table">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Start</th>
              <th>End</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in filteredSchedules"
              :key="s.id"
              :class="{ 'current-schedule': isWithinCurrentTime(s) }"
            >
              <td>{{ s.artist_name }}</td>
              <td>{{ formatTime(s.start_time) }}</td>
              <td>{{ formatTime(s.end_time) }}</td>
              <td class="actions">
                <button
                  @click="editSchedule(s)"
                  class="icon-button edit"
                  aria-label="Edit"
                >
                  <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  @click="confirmDelete(s.id)"
                  class="icon-button delete"
                  aria-label="Delete"
                >
                  <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- EXPORT -->
    <section class="export-section">
      <h2>Export Schedule</h2>
      <button
        @click="exportScheduleToPDF"
        class="primary-button"
        :disabled="schedules.length === 0 || isExporting"
      >
        <svg v-if="isExporting" class="spinner-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>{{ isExporting ? 'Exporting...' : 'Export to PDF' }}</span>
      </button>
    </section>
  </main>
</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchTableData, mutateTableData, syncOfflineChanges } from '@/services/dataService'



const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

// State
const schedules          = ref([])
const locations          = ref([])
const selectedLocationId = ref(null)
const currentLocation    = ref(null)
const routeLocationId    = route.query.locationId ? Number(route.query.locationId) : null

const isLoading    = ref(false)
const isSubmitting = ref(false)
const isExporting  = ref(false)

const newArtistName    = ref('')
const newStartTime     = ref('')
const newEndTime       = ref('')
const newRecordingDate = ref(getFormattedCurrentDate())
const newWarningMinutes = ref(null) // null means use default
const isEditing        = ref(false)
const currentEditId    = ref(null)
const isFormOpen       = ref(false)
const formError        = ref(null)

// Filtering and Navigation
const sortOrder         = ref('asc')
const groupedDays       = ref([])
const currentDayIndex   = ref(0)
const filterStart       = ref('')
const filterEnd         = ref('')

// Clock
const currentDeviceTime = ref(new Date())
let timecodeInterval = null
const formattedCurrentDeviceTime = computed(() => {
const d = currentDeviceTime.value
return [d.getHours(), d.getMinutes(), d.getSeconds()]
  .map(n => String(n).padStart(2,'0'))
  .join(':')
})

// Lifecycle
onMounted(() => {
timecodeInterval = setInterval(() => {
  currentDeviceTime.value = new Date()
}, 1000)
fetchLocationsData()
window.addEventListener('online', handleOnline)
})
onBeforeUnmount(() => {
clearInterval(timecodeInterval)
window.removeEventListener('online', handleOnline)
})

// Helpers
function getFormattedCurrentDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'No date'
  const date = new Date(dateStr)
  return date.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
}

function groupSchedulesByDay(schedulesList) {
  const map = {}
  schedulesList.forEach(s => {
    map[s.recording_date] = map[s.recording_date] || []
    map[s.recording_date].push(s)
  })
  return Object.keys(map)
    .sort((a,b) => new Date(a) - new Date(b))
    .map(date => ({ date, events: map[date] }))
}

function sortSchedules(schedules, order) {
  const sorted = [...schedules]
  switch (order) {
    case 'artist':
      return sorted.sort((a,b) => a.artist_name.localeCompare(b.artist_name))
    case 'desc':
      return sorted.sort((a,b) => b.start_time.localeCompare(a.start_time))
    case 'asc':
    default:
      return sorted.sort((a,b) => a.start_time.localeCompare(b.start_time))
  }
}

// Computed
const currentDay = computed(() => groupedDays.value[currentDayIndex.value] || { date: null, events: [] })

const filteredSchedules = computed(() => {
  if (!currentDay.value.events) return []
  let filtered = [...currentDay.value.events]
  // Filter by start/end datetime if set
  if (filterStart.value) {
    const startISO = filterStart.value
    filtered = filtered.filter(s => {
      const dt = s.recording_date + 'T' + s.start_time.padEnd(5, '0')
      return dt >= startISO
    })
  }
  if (filterEnd.value) {
    const endISO = filterEnd.value
    filtered = filtered.filter(s => {
      const dt = s.recording_date + 'T' + s.end_time.padEnd(5, '0')
      return dt <= endISO
    })
  }
  return sortSchedules(filtered, sortOrder.value)
})

// Fetchers
async function fetchSchedulesByLocation(locId) {
if (!locId) return
isLoading.value = true
try {
  schedules.value = await fetchTableData('schedules', {
    eq: { location_id: Number(locId) },
    order: [
      { column:'recording_date', ascending:true },
      { column:'start_time',      ascending:true }
    ]
  })
  
  // Group schedules by day
  groupedDays.value = groupSchedulesByDay(schedules.value)
  
  // Set current day to today or first available day
  const today = getFormattedCurrentDate()
  const todayIndex = groupedDays.value.findIndex(day => day.date === today)
  currentDayIndex.value = todayIndex >= 0 ? todayIndex : 0
  
  formError.value = null
} catch (err) {
  formError.value = err.message
  toast.error(err.message)
} finally {
  isLoading.value = false
}
}
async function fetchLocationsData() {
isLoading.value = true
try {
  const projectId = route.params.id || userStore.getCurrentProject?.id
  locations.value = await fetchTableData('locations', { eq:{ project_id: projectId }})
  if (routeLocationId) {
    selectedLocationId.value = routeLocationId
    currentLocation.value = locations.value.find(l=>l.id===routeLocationId) || null
  } else if (locations.value.length) {
    selectedLocationId.value = locations.value[0].id
    currentLocation.value = locations.value[0]
  }
  await fetchSchedulesByLocation(selectedLocationId.value)
} catch (err) {
  formError.value = err.message
  toast.error(err.message)
} finally {
  isLoading.value = false
}
}

// UI Handlers
function onLocationSelect() {
currentLocation.value = locations.value.find(l=>l.id===selectedLocationId.value) || null
fetchSchedulesByLocation(selectedLocationId.value)
}

function previousDay() {
if (currentDayIndex.value > 0) {
  currentDayIndex.value--
}
}

function nextDay() {
if (currentDayIndex.value < groupedDays.value.length - 1) {
  currentDayIndex.value++
}
}
function toggleForm() {
isFormOpen.value = !isFormOpen.value
if (!isFormOpen.value) clearForm()
}
function clearForm() {
newArtistName.value    = ''
newStartTime.value     = ''
newEndTime.value       = ''
newRecordingDate.value = getFormattedCurrentDate()
newWarningMinutes.value = null
formError.value        = null
}
function handleFormSubmit() {
isEditing.value ? updateScheduleItem() : addScheduleItem()
}
function goBack() {
router.back()
}

// CRUD
async function addScheduleItem() {
if (![newArtistName.value, newStartTime.value, newEndTime.value, newRecordingDate.value].every(Boolean)) {
  formError.value = 'All fields required'
  return
}
isSubmitting.value = true
try {
  await mutateTableData('schedules','insert', {
    artist_name: newArtistName.value,
    start_time: newStartTime.value,
    end_time: newEndTime.value,
    recording_date: newRecordingDate.value,
    location_id: Number(selectedLocationId.value),
    project_id: route.params.id,
    warning_bell_minutes: newWarningMinutes.value || null
  })
  toast.success('Added')
  await fetchSchedulesByLocation(selectedLocationId.value)
  clearForm()
  isFormOpen.value = false
} catch (err) {
  formError.value = err.message
  toast.error(err.message)
} finally {
  isSubmitting.value = false
}
}
function editSchedule(s) {
isEditing.value    = true
currentEditId.value= s.id
newArtistName.value= s.artist_name
newStartTime.value = s.start_time
newEndTime.value   = s.end_time
newRecordingDate.value = s.recording_date
newWarningMinutes.value = s.warning_bell_minutes || null
isFormOpen.value   = true
}
async function updateScheduleItem() {
if (![newArtistName.value, newStartTime.value, newEndTime.value, newRecordingDate.value].every(Boolean)) {
  formError.value = 'All fields required'
  return
}
isSubmitting.value = true
try {
  await mutateTableData('schedules','update',{
    id: currentEditId.value,
    artist_name: newArtistName.value,
    start_time: newStartTime.value,
    end_time: newEndTime.value,
    recording_date: newRecordingDate.value,
    warning_bell_minutes: newWarningMinutes.value || null
  })
  toast.success('Updated')
  await fetchSchedulesByLocation(selectedLocationId.value)
  clearForm()
  isEditing.value  = false
  isFormOpen.value = false
} catch (err) {
  formError.value = err.message
  toast.error(err.message)
} finally {
  isSubmitting.value = false
}
}
function cancelForm() {
clearForm()
isEditing.value = false
isFormOpen.value= false
}
function confirmDelete(id) {
Swal.fire({
  title: 'Delete?',
  text: 'This cannot be undone.',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#ef4444'
}).then(r => r.isConfirmed && deleteSchedule(id))
}
async function deleteSchedule(id) {
isSubmitting.value = true
try {
  await mutateTableData('schedules','delete',{ id })
  toast.success('Deleted')
  await fetchSchedulesByLocation(selectedLocationId.value)
} catch (err) {
  formError.value = err.message
  toast.error(err.message)
} finally {
  isSubmitting.value = false
}
}

// Export / Helpers
async function exportScheduleToPDF() {
if (!filteredSchedules.value.length) {
  toast.info('No data to export')
  return
}
isExporting.value = true
try {
  const doc = new jsPDF()
  const loc = currentLocation.value
    ? `${currentLocation.value.venue_name} - ${currentLocation.value.stage_name}`
    : 'Schedule'
  const dateInfo = currentDay.value?.date ? ` - ${formatDisplayDate(currentDay.value.date)}` : ''
  doc.text(loc + dateInfo, 20, 10)
  autoTable(doc,{
    head: [['Artist','Start','End']],
    body: filteredSchedules.value.map(s=>[
      s.artist_name, formatTime(s.start_time),
      formatTime(s.end_time)
    ]),
    startY: 20
  })
  // Save PDF to storage instead of downloading
  const filename = `${loc.replace(/\s+/g,'_')}_${currentDay.value?.date || 'schedule'}.pdf`
  let venueId = null
  let stageId = null
  if (currentLocation.value) {
    venueId = currentLocation.value.venue_id || null
    stageId = currentLocation.value.id || null
  }
  
  const projectId = route.params.id
  const { savePDFToStorage, showExportSuccessToast } = await import('@/services/exportStorageService')
  const description = `Schedule export - ${loc}${dateInfo}`
  
  const result = await savePDFToStorage(
    doc,
    filename,
    projectId,
    venueId,
    stageId,
    description
  )
  
  showExportSuccessToast(toast, result, filename)
} catch (err) {
  toast.error(err.message)
} finally {
  isExporting.value = false
}
}
function formatTime(t) {
const [h,m] = t.split(':')
return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`
}
function formatDate(d) {
const dt = new Date(d)
return [
  String(dt.getDate()).padStart(2,'0'),
  String(dt.getMonth()+1).padStart(2,'0'),
  dt.getFullYear()
].join('/')
}
function isWithinCurrentTime(s) {
const now = new Date()
const [sh,sm] = s.start_time.split(':').map(Number)
const [eh,em] = s.end_time.split(':').map(Number)
const start = new Date(now); start.setHours(sh,sm,0,0)
const end   = new Date(now); end.setHours(eh,em,0,0)
const rec   = new Date(s.recording_date)
return rec.toDateString()===now.toDateString() && now>=start && now<=end
}
async function handleOnline() {
await syncOfflineChanges()
if (selectedLocationId.value) fetchSchedulesByLocation(selectedLocationId.value)
}
</script>

<style scoped>
.project-schedule {
--bg-light:      #f9fafd;
--text-dark:     #1f2937;
--text-med:      #6c7a92;
--border:        #dce0e8;
--accent:        #1890ff;
--accent2:       #4a6cf7;
--accent2-dark:  #3b5bd0;
--danger:        #ef4444;
--danger-dark:   #dc2626;
background: var(--bg-light);
padding: 24px;
border-radius: 12px;
color: var(--text-dark);
font-family: system-ui, sans-serif;
}

/* Top bar */
.top-bar {
display: flex;
margin-bottom: 16px;
}
.back-button {
background: var(--color-primary-500);
color: var(--text-inverse);
border: none;
border-radius: 6px;
padding: 8px 14px;
cursor: pointer;
transition: background .2s;
}
.back-button:hover {
background: var(--color-primary-600);
}

/* Header */
.header-section {
text-align: center;
margin-bottom: 24px;
}
.header-section h1 {
font-size: 1.75rem;
margin-bottom: 0.5rem;
}
.header-section p {
font-size: 1rem;
color: var(--text-med);
}

/* Loading */
.loading-indicator {
display: flex;
flex-direction: column;
align-items: center;
padding: 48px 0;
}
.spinner {
width: 40px; height: 40px;
animation: spin 1s linear infinite;
}
.spinner__bg {
stroke: var(--border); stroke-width: 4; opacity: .25;
}
.spinner__arc {
fill: var(--accent); opacity: .75;
}
.loading-text {
margin-top: 8px; font-size: 1rem; color: var(--accent2);
}

/* Error */
.error-message {
background: rgba(239, 68, 68, 0.1);
border: 1px solid var(--color-error-300);
color: var(--color-error-700);
padding: 16px;
border-radius: 6px;
margin-bottom: 24px;
text-align: center;
}

/* Live timecode */
.live-timecode {
text-align: center;
font-weight: 600;
margin-bottom: 16px;
}

/* Inputs */
.input-container {
margin-bottom: 24px;
}
.label {
display: block;
margin-bottom: 6px;
font-weight: 600;
color: var(--text-med);
}
.input-field {
width: 100%;
padding: 10px;
border: 1px solid var(--border);
border-radius: 6px;
transition: border-color .2s;
}
.input-field:focus {
border-color: var(--accent2);
outline: none;
}

/* Collapsible form */
.collapsible-form-modern {
margin: 18px 0 28px 0;
}
.collapsible-header {
width: 100%;
background: var(--color-primary-500);
color: var(--text-inverse);
border: none;
border-radius: 6px;
padding: 12px;
text-align: left;
cursor: pointer;
transition: background .2s;
}
.collapsible-header:hover {
background: var(--color-primary-600);
}
.schedule-form {
background: var(--bg-primary);
border: 1px solid var(--border-light);
border-radius: 6px;
padding: 16px;
margin-top: 12px;
box-shadow: var(--shadow-sm);
}
.schedule-form h3 {
text-align: center;
margin-bottom: 16px;
font-size: 1.125rem;
}
.form-group {
margin-bottom: 16px;
}
.form-group label span {
color: var(--danger);
}
.form-group input {
width: 100%;
padding: 10px;
border: 1px solid var(--border);
border-radius: 6px;
transition: border-color .2s;
}
.form-group input:focus {
border-color: var(--accent2);
}
.form-hint {
font-size: 0.75rem;
  color: var(--text-secondary);
margin-top: 4px;
display: block;
}

/* Form actions */
.form-actions {
display: flex;
justify-content: flex-end;
gap: 12px;
}
.primary-button,
.secondary-button {
padding: 10px 16px;
border: none;
border-radius: 6px;
cursor: pointer;
transition: background .2s;
}
.primary-button {
background: var(--color-primary-500);
color: var(--text-inverse);
}
.primary-button:hover:not(:disabled) {
background: var(--color-primary-600);
}
.primary-button:disabled {
opacity: .6;
cursor: default;
}
.secondary-button {
background: var(--bg-primary);
color: var(--text-dark);
border: 1px solid var(--border);
}
.secondary-button:hover {
background: var(--bg-secondary);
}

/* Schedule table */
.schedule-table-container {
margin-bottom: 32px;
}
.schedule-table-container h3 {
margin-bottom: 12px;
font-size: 1.25rem;
}
.responsive-table {
overflow-x: auto;
}
.schedule-table {
width: 100%;
border-collapse: collapse;
min-width: 320px;
}
.schedule-table th,
.schedule-table td {
padding: 12px;
border: 1px solid var(--border);
text-align: left;
font-size: .9rem;
}
.schedule-table th {
background: var(--bg-secondary);
text-transform: uppercase;
font-weight: 600;
}
.schedule-table tbody tr:hover {
background: var(--bg-secondary);
}
.current-schedule {
background: rgba(34, 197, 94, 0.1);
}

/* Actions */
.actions {
display: flex; gap: 8px;
}
.icon-button {
width: 32px; height: 32px;
border: none; border-radius: 6px;
display: inline-flex; align-items: center; justify-content: center;
cursor: pointer; transition: background .2s, transform .2s;
}
.icon-button.edit {
 background: var(--color-warning-500) !important;
 color: var(--text-primary) !important;
}
.icon-button.edit:hover {
 background: var(--color-warning-600) !important;
 transform: translateY(-2px);
}
.icon-button.delete {
 background: var(--danger) !important;
 color: var(--text-inverse) !important;
}
.icon-button.delete:hover {
 background: var(--danger-dark) !important;
 transform: translateY(-2px);
}
.action-icon {
width: 16px; height: 16px;
 stroke: currentColor; fill: none; stroke-width: 2;
stroke-linecap: round; stroke-linejoin: round;
}

/* Export */
.export-section {
text-align: center;
margin-top: 32px;
}
.export-section h2 {
margin-bottom: 12px;
font-size: 1.25rem;
}
.export-section .primary-button {
max-width: 240px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
transition: opacity .3s;
}
.fade-enter-from,
.fade-leave-to {
opacity: 0;
}
.spinner-icon {
width: 16px; height: 16px; margin-right: 6px;
animation: spin 1s linear infinite;
}
@keyframes spin {
to { transform: rotate(360deg); }
}

/* Filters and Controls */
.filters-section-modern {
  margin-bottom: 20px;
  background: var(--bg-primary);
  border-radius: 14px;
  box-shadow: 0 2px 12px 0 rgba(30,34,90,0.07);
  padding: 12px 12px 10px 12px; /* match calendar tighter header */
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.filters-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}
.filter-block {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  flex: 1 1 140px;
}
.label-modern {
  font-size: 0.95rem;
  font-weight: 600;
  color: #4a5677;
  margin-bottom: 6px;
}
.input-modern {
  padding: 9px 10px;
  border: 1.5px solid #e3e7ef;
  border-radius: 8px;
  font-size: 0.98rem;
  background: var(--bg-primary);
  transition: border-color .2s;
}
.input-modern:focus {
  border-color: #4a6cf7;
  outline: none;
}
.date-row-modern {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.nav-btn-modern {
  width: 32px;
  height: 32px;
  background: #f4f6fa;
  border: 1.5px solid #e3e7ef;
  border-radius: 8px;
  font-size: 1.2rem;
  color: #4a6cf7;
  cursor: pointer;
  transition: background .2s, border-color .2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-btn-modern:disabled {
  opacity: 0.4;
  cursor: default;
}
.current-date-modern {
  min-width: 120px;
  text-align: center;
  font-weight: 700;
  color: #222b45;
  font-size: 1.08rem;
}
.collapsible-form-modern {
  margin: 18px 0 28px 0;
}
.add-schedule-btn-modern {
  width: 100%;
  max-width: 340px;
  margin: 0 auto 0 auto;
  display: block;
  font-size: 1.08rem;
  padding: 14px 0;
  border-radius: 10px;
  box-shadow: 0 1px 6px 0 rgba(30,34,90,0.04);
}
@media (max-width: 700px) {
  .filters-grid {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .filter-block {
    min-width: unset;
    flex: 1 1 100%;
  }
  .filters-section-modern {
    padding: 10px 8px 8px 8px;
  }
  .add-schedule-btn-modern {
    width: 100%;
    min-width: unset;
    font-size: 1rem;
    padding: 12px 0;
  }
}

/* Empty state */
.empty-state {
text-align: center;
padding: 48px 24px;
color: var(--text-med);
}
.empty-state p {
margin: 0;
font-size: 1rem;
}
</style>