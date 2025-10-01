<!-- src/components/location-notes/LNTabSchedule.vue -->
<template>
<section class="schedule-pane">
  <!-- Top controls (sort + add) -->
  <div class="controls-top">
    <label class="label">Sort by:</label>
    <select v-model="sortOrder" class="sort-select">
      <option value="asc">Earliest</option>
      <option value="desc">Latest</option>
      <option value="artist">Artist A–Z</option>
    </select>
    <button class="btn btn-positive btn-add" @click="openForm()">Add Schedule Item</button>
  </div>

  <!-- Date range filter -->
  <div class="controls-range">
    <label class="label">From:</label>
    <input type="datetime-local" v-model="fromDateTime" @change="saveRange" class="range-input" />
    <button v-if="fromDateTime" class="btn btn-danger clear-btn" @click="clearFrom">×</button>
    <label class="label">To:</label>
    <input type="datetime-local" v-model="toDateTime" @change="saveRange" class="range-input" />
    <button v-if="toDateTime" class="btn btn-danger clear-btn" @click="clearTo">×</button>
    <div class="range-shortcuts">
      <button class="btn btn-primary shortcut-btn" @click="setToday">Today</button>
      <button class="btn btn-primary shortcut-btn" @click="setPreviousDay">Previous Day</button>
    </div>
  </div>

  <!-- Date navigation -->
  <div class="controls-bottom">
    <label class="label">Date:</label>
    <button class="btn btn-warning nav-btn" @click="idx--" :disabled="idx===0">‹</button>
    <div class="current-date">{{ niceDate(day.date) }}</div>
    <button class="btn btn-warning nav-btn" @click="idx++" :disabled="idx>=groupedDays.length-1">›</button>
  </div>

  <!-- Schedule list -->
  <div class="list-wrapper">
    <template v-if="filteredRows.length">
      <div
        v-for="(r, i) in filteredRows"
        :key="r.id"
        :class="['row-card', { 'active-card': isActive(r, i) }]"
      >
        <div class="row-content">
          <div class="artist">{{ r.artist_name }}</div>
          <div class="times">
            <span>Start: {{ t5(r.start_time) }}</span>
            <span>End: {{ t5(r.end_time) }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn-positive icon note" @click="emitChangeNote(r.artist_name)" title="Add quick note">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button class="btn btn-warning icon edit" @click="openForm(r)" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/>
              <path fill-rule="evenodd"
                    d="M2 15.5A1.5 1.5 0 013.5 14H5v1.5a.5.5 0 01-.5.5H2.5a.5.5 0 01-.5-.5zm11.293-9.793L10.5 2.914A1 1 0 009.793 2.207l-7 7V11h1.879l7-7a1 1 0 00-.379-1.293z"
                    clip-rule="evenodd"/>
            </svg>
          </button>
          <button class="btn btn-danger icon delete" @click="remove(r.id)" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H3.5a.5.5 0 000 1H4v10.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V5h.5a.5.5 0 000-1H15V3a1 1 0 00-1-1H6zm3 4a.5.5 0 011 0v8a.5.5 0 01-1 0V6zm3 0a.5.5 0 011 0v8a.5.5 0 01-1 0V6z"
                    clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </template>
    <p v-else class="empty-text">No schedule for this range.</p>
  </div>

  <!-- Modal overlay -->
  <div v-if="showForm" class="modal-overlay" @click="closeForm">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h4>{{ isEdit ? 'Edit' : 'Add' }} Schedule</h4>
        <button class="btn btn-warning modal-close" @click="closeForm">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-field">
            <label>Artist name*</label>
            <input v-model="fArtist" type="text" placeholder="Enter artist name" />
          </div>
          <div class="form-field">
            <label>Start time</label>
            <input v-model="fStart" type="time" />
          </div>
          <div class="form-field">
            <label>End time</label>
            <input v-model="fEnd" type="time" />
          </div>
          <div class="form-field">
            <label>Date</label>
            <input v-model="fDate" type="date" />
          </div>
        </div>
        <p v-if="err" class="error-text">{{ err }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-warning cancel-btn" @click="closeForm">Cancel</button>
        <button class="btn btn-positive save-btn" @click="save" :disabled="busy">
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineExpose, watch } from 'vue'
import { useToast }                         from 'vue-toastification'
import Swal                                 from 'sweetalert2'
import jsPDF                                from 'jspdf'
import autoTable                            from 'jspdf-autotable'
import { useUserStore }                     from '@/stores/userStore'
import { fetchTableData, mutateTableData }  from '@/services/dataService'

const props = defineProps({ locationId: String })
const emit = defineEmits(['changeover-note', 'quick'])
const store = useUserStore()
const toast = useToast()

// Data & state
const schedules   = ref([])
const groupedDays = ref([])
const idx         = ref(0)
const sortOrder   = ref('asc')

// Form state
const showForm = ref(false)
const isEdit   = ref(false)
let   editId   = null
const fArtist  = ref('')
const fStart   = ref('')
const fEnd     = ref('')
const fDate    = ref(new Date().toISOString().slice(0,10))
const busy     = ref(false)
const err      = ref(null)

// Highlighting
const timecodeSource = ref('live') // 'live', 'device', 'world', etc.

const getTimecode = () => {
  if (timecodeSource.value === 'live') {
    return localStorage.getItem('liveTimecode') || '00:00:00'
  }
  // Add other sources as needed
  if (timecodeSource.value === 'device') {
    return new Date().toTimeString().slice(0,8)
  }
  // Add 'world' or other sources here
  return '00:00:00'
}

const currentTimecode = ref(getTimecode())

// Update every second (or as needed)
let timerId
onMounted(() => {
  timerId = setInterval(() => {
    currentTimecode.value = getTimecode()
  }, 1000)
})
onUnmounted(() => clearInterval(timerId))

// Helpers
const todayISO = () => {
const d    = new Date()
const yyyy = d.getFullYear()
const mm   = String(d.getMonth()+1).padStart(2,'0')
const dd   = String(d.getDate()).padStart(2,'0')
return `${yyyy}-${mm}-${dd}`
}
const niceDate = d => d
? new Date(d).toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' })
: ''
const t5 = t => t?.slice(0,5)

function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Fetch & group
async function fetchAll() {
schedules.value = await fetchTableData('schedules', { eq:{ location_id: props.locationId }})
const map = {}
schedules.value.forEach(s => {
  map[s.recording_date] = map[s.recording_date] || []
  map[s.recording_date].push(s)
})
groupedDays.value = Object.keys(map)
  .sort((a,b) => new Date(a) - new Date(b))
  .map(date => ({ date, events: map[date] }))
idx.value = Math.max(0, groupedDays.value.findIndex(g => g.date === todayISO()))
}

const day  = computed(() => groupedDays.value[idx.value] || { date:null, events:[] })
const rows = computed(() => {
const list = [...day.value.events]
if (sortOrder.value === 'artist')
  return list.sort((a,b) => a.artist_name.localeCompare(b.artist_name))
const dir = sortOrder.value === 'asc' ? 1 : -1
return list.sort((a,b) => a.start_time.localeCompare(b.start_time) * dir)
})

// Find next artist for changeover
const hasNextArtist = computed(() => {
  const currentTime = getTimecode()
  const currentDate = todayISO()
  
  // Find the next artist after current time
  const nextArtist = schedules.value.find(s => {
    const scheduleTime = s.start_time
    const scheduleDate = s.recording_date
    
    // If it's today and the time is in the future, or it's a future date
    if (scheduleDate > currentDate) return true
    if (scheduleDate === currentDate && scheduleTime > currentTime) return true
    return false
  })
  
  return !!nextArtist
})

const nextArtist = computed(() => {
  const currentTime = getTimecode()
  const currentDate = todayISO()
  
  // Find the next artist after current time
  return schedules.value.find(s => {
    const scheduleTime = s.start_time
    const scheduleDate = s.recording_date
    
    // If it's today and the time is in the future, or it's a future date
    if (scheduleDate > currentDate) return true
    if (scheduleDate === currentDate && scheduleTime > currentTime) return true
    return false
  })
})

function getTodayTime(timeStr) {
  if (!timeStr) return null;
  const [h, m, s] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, s || 0, 0);
  return d;
}

const activeIndex = computed(() => {
  const [h, m, s] = currentTimecode.value.split(':').map(Number)
  const now = new Date()
  now.setHours(h || 0, m || 0, s || 0, 0)
  return rows.value.findIndex(item => {
    const start = getTodayTime(item.start_time)
    const end = getTodayTime(item.end_time)
    return start <= now && now < end
  })
})

function isActive(item, i) {
  return i === activeIndex.value
}

async function createChangeoverNote() {
  if (!hasNextArtist.value) {
    toast.warning('No next artist scheduled')
    return
  }

  const artist = nextArtist.value
  const currentTime = getTimecode()
  const currentDate = todayISO()
  
  const changeoverNote = `Changeover to ${artist.artist_name} - scheduled to start at ${artist.start_time}`
  
  try {
    await mutateTableData('notes', 'insert', {
      timestamp: currentTime,
      recording_date: currentDate,
      note: changeoverNote,
      location_id: props.locationId,
      creator_email: store.getUserEmail,
      project_id: store.getCurrentProject?.id
    })
    
    toast.success(`Changeover note created for ${artist.artist_name}`)
    
    // Emit event to parent to refresh notes
    emit('changeover-note', changeoverNote)
  } catch (error) {
    console.error('Error creating changeover note:', error)
    toast.error('Failed to create changeover note')
  }
}

function openForm(item=null) {
showForm.value = true
if (item) {
  isEdit.value = true; editId = item.id
  fArtist.value = item.artist_name
  fStart.value  = item.start_time
  fEnd.value    = item.end_time
  fDate.value   = item.recording_date
} else {
  isEdit.value = false; editId = null
  fArtist.value = fStart.value = fEnd.value = ''
  fDate.value = todayISO()
}
}

function closeForm(){ showForm.value=false; err.value=null }

async function save(){
if(!fArtist.value||!fStart.value||!fEnd.value){
  err.value='All fields are required'
  return
}
busy.value=true
try{
  if(isEdit.value){
    await mutateTableData('schedules','update',{
      id: editId,
      artist_name:  fArtist.value,
      start_time:   fStart.value,
      end_time:     fEnd.value,
      recording_date: fDate.value
    })
  } else {
    await mutateTableData('schedules','insert',{
      artist_name:    fArtist.value,
      start_time:     fStart.value,
      end_time:       fEnd.value,
      recording_date: fDate.value,
      location_id:    props.locationId,
      project_id:     store.getCurrentProject?.id
    })
  }
  await fetchAll()
  closeForm()
  toast.success('Saved!')
} catch(e){
  err.value=e.message
} finally {
  busy.value=false
}
}

async function remove(id){
const { isConfirmed } = await Swal.fire({
  title: 'Delete this slot?',
  text: 'This action cannot be undone.',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: 'var(--danger)'
})
if(!isConfirmed) return
await mutateTableData('schedules','delete',{ id })
await fetchAll()
toast.success('Deleted!')
}

// PDF export
function exportPdf(){
const doc = new jsPDF({ unit:'pt', format:'a4' })
doc.text('Stage Schedule',40,40)
autoTable(doc,{
  head: [['Artist','Start','End','Date']],
  body: schedules.value.map(s=>[
    s.artist_name, t5(s.start_time), t5(s.end_time), s.recording_date
  ]),
  startY: 60,
  styles: { fontSize:9, cellPadding:4 }
})
doc.save('stage-schedule.pdf')
}
defineExpose({ exportPdf })

function emitChangeNote(artistName) {
  emit('quick', `DJ Change - ${artistName}`);
}

// Date/time range filter state
const RANGE_KEY = 'ln_schedule_range'
const fromDateTime = ref(localStorage.getItem(RANGE_KEY + '_from') || '')
const toDateTime = ref(localStorage.getItem(RANGE_KEY + '_to') || '')

function saveRange() {
  localStorage.setItem(RANGE_KEY + '_from', fromDateTime.value)
  localStorage.setItem(RANGE_KEY + '_to', toDateTime.value)
}
function clearFrom() {
  fromDateTime.value = ''
  saveRange()
}
function clearTo() {
  toDateTime.value = ''
  saveRange()
}

// Filtering rows by date/time range
function getDateTimeISO(date, time) {
  if (!date || !time) return ''
  return date + 'T' + time
}
const filteredRows = computed(() => {
  let list = [...rows.value]
  if (fromDateTime.value) {
    list = list.filter(r => {
      const dt = getDateTimeISO(r.recording_date, r.start_time)
      return dt >= fromDateTime.value
    })
  }
  if (toDateTime.value) {
    list = list.filter(r => {
      const dt = getDateTimeISO(r.recording_date, r.end_time)
      return dt <= toDateTime.value
    })
  }
  return list
})

function pad2(n) { return n.toString().padStart(2, '0') }
function setToday() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  fromDateTime.value = `${yyyy}-${mm}-${dd}T00:00`
  toDateTime.value = `${yyyy}-${mm}-${dd}T23:59`
  saveRange()
}
function setPreviousDay() {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  const yyyy = now.getFullYear()
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  fromDateTime.value = `${yyyy}-${mm}-${dd}T00:00`
  toDateTime.value = `${yyyy}-${mm}-${dd}T23:59`
  saveRange()
}

onMounted(fetchAll)
</script>

<style scoped>
.schedule-pane {
--bg-light:      #f8fafc;
--text-med:      #64748b;
--border:        #e2e8f0;
--accent:        #3b82f6;
--accent2:       #3b82f6;
--accent2-dark:  #2563eb;
--danger:        #ef4444;
--danger-dark:   #dc2626;
--success-bg:    #ecfdf5;
--success-text:  #059669;
background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
padding: 32px;
border-radius: 16px;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
border: 1px solid rgba(255, 255, 255, 0.2);
max-width: 1200px;
margin: 0 auto;
}

/* controls */
.controls-top,
.controls-bottom {
display: flex;
align-items: center;
gap: 16px;
flex-wrap: wrap;
margin-bottom: 20px;
padding: 20px;
background: rgba(255, 255, 255, 0.8);
border-radius: 12px;
border: 1px solid rgba(255, 255, 255, 0.3);
backdrop-filter: blur(10px);
box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.label {
font-size: 0.9rem;
font-weight: 600;
color: var(--text-med);
}
.sort-select {
  padding: 8px 32px 8px 8px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: #fff;
  font-size: 0.95rem;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' fill='none' stroke='%236c7a92' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px 18px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.sort-select:focus {
  border-color: var(--accent2);
  outline: none;
}
.btn-add {
background: #059669;
color: #ffffff;
padding: 8px 16px;
border: none;
border-radius: 6px;
cursor: pointer;
transition: background .2s;
}
.btn-add:hover {
background: #047857;
}

/* date nav */
.nav-btn {
width: 32px; height: 32px;
background: #fff;
border: 1px solid var(--border);
border-radius: 6px;
display: inline-flex;
align-items: center;
justify-content: center;
font-size: 1.25rem;
color: var(--accent);
cursor: pointer;
transition: background .2s;
}
.nav-btn:disabled {
opacity: 0.4;
cursor: default;
}
.nav-btn:hover:not(:disabled) {
background: #f0f5ff;
}
.current-date {
flex: 1;
text-align: center;
font-weight: 600;
color: #111827;
}

/* list */
.list-wrapper {
margin-top: 16px;
}
.row-card {
display: flex;
justify-content: space-between;
align-items: center;
background: rgba(255, 255, 255, 0.9);
border: 1px solid rgba(255, 255, 255, 0.3);
border-radius: 12px;
padding: 20px;
margin-bottom: 16px;
box-shadow: 0 4px 12px rgba(0,0,0,0.08);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
backdrop-filter: blur(10px);
}
.row-card.active-card {
background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
border-color: #10b981;
box-shadow: 0 6px 20px rgba(16, 185, 129, 0.2);
}
.row-card:hover {
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.row-content {
flex: 1;
}
.artist {
font-size: 1rem;
font-weight: 600;
margin-bottom: 4px;
}
.times {
display: flex;
gap: 16px;
}
.times span {
font-size: 0.85rem;
color: #4b5563;
}
.row-actions {
display: flex;
gap: 8px;
}

/* inline edit/delete icons */
.icon {
width: 32px;
height: 32px;
border: none;
border-radius: 6px;
display: inline-flex;
align-items: center;
justify-content: center;
cursor: pointer;
transition: background .2s;
}
.icon.edit {
background: #d97706;
color: #ffffff;
}
.icon.edit:hover {
background: #b45309;
}
.icon.delete {
background: #dc2626;
color: #ffffff;
}
.icon.delete:hover {
background: #b91c1c;
}
.icon-svg {
width: 16px;
height: 16px;
color: #fff;
}

.empty-text {
text-align: center;
color: #4b5563;
margin-top: 20px;
}

/* modal */
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
.modal-content {
background: #fff;
border-radius: 12px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
max-width: 500px;
width: 90%;
max-height: 90vh;
overflow-y: auto;
}
.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 20px 24px 0;
}
.modal-header h4 {
margin: 0;
font-size: 1.25rem;
font-weight: 600;
color: #111827;
}
.modal-close {
background: #d97706;
color: #ffffff;
border: 1px solid #b45309;
font-size: 1.5rem;
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: background .2s;
}
.modal-close:hover {
background: #b45309;
}
.modal-body {
padding: 20px 24px;
}
.modal-footer {
display: flex;
justify-content: flex-end;
gap: 12px;
padding: 0 24px 20px;
}
.form-grid {
display: flex;
flex-direction: column;
gap: 16px;
margin-bottom: 16px;
}
.form-field {
display: flex;
flex-direction: column;
gap: 6px;
}
.form-field label {
font-size: 0.9rem;
font-weight: 600;
color: #374151;
}
.form-grid input {
padding: 8px;
border: 1px solid var(--border);
border-radius: 6px;
font-size: 0.95rem;
max-width: 300px;
}
.error-text {
color: var(--danger);
font-size: 0.85rem;
margin-bottom: 12px;
}
/* form actions now handled by modal-footer */
.btn {
padding: 8px 16px;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 0.95rem;
}
.cancel-btn {
background: #d97706;
color: #ffffff;
border: 1px solid #b45309;
}
.save-btn {
background: #059669;
color: #ffffff;
transition: background .2s;
}
.save-btn:hover:not(:disabled) {
background: #047857;
}
.save-btn:disabled {
opacity: 0.6;
cursor: default;
}

/* full‐width layout on larger screens */
@media (min-width: 640px) {
.schedule-pane {
  padding: 24px;
}
}

.icon.note {
  background: #059669;
  color: #ffffff;
}
.icon.note:hover {
  background: #047857;
}

.controls-range {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.range-input {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  min-width: 210px;
}
.clear-btn {
  background: var(--danger);
  color: #fff;
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .2s;
}
.clear-btn:hover {
  background: var(--danger-dark);
}

.range-shortcuts {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
/* Shortcut button styles are now handled by btn btn-primary classes */
</style>