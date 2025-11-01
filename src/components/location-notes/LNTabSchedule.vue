<!-- src/components/location-notes/LNTabSchedule.vue -->
<template>
<section class="schedule-pane">
  <!-- Combined top row: sort/add + filter + alerts + recording day (on wide screens) -->
  <div class="controls-top combined">
    <div class="left-stack">
      <label class="label">Sort by:</label>
      <select v-model="sortOrder" class="sort-select">
        <option value="asc">Earliest</option>
        <option value="desc">Latest</option>
        <option value="artist">Artist A–Z</option>
      </select>
      <button 
        class="btn btn-primary filter-toggle-btn" 
        @click="showFilters = !showFilters"
        :class="{ active: showFilters }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="filter-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 011-1h8a1 1 0 011 1v1.586a1 1 0 01-.293.707l-4.414 4.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
        </svg>
        Filter
      </button>
      <button 
        class="btn btn-primary alert-toggle-btn" 
        @click="showNotifications = !showNotifications"
        :class="{ active: showNotifications }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
        </svg>
        Changeover Alerts
      </button>
      <button class="btn btn-positive btn-add" @click="openForm()">Add Schedule Item</button>
    </div>
    <div class="right-stack wide-screen-only">
      <label class="label">Recording Day:</label>
      <button class="btn btn-warning nav-btn" @click="idx--" :disabled="idx===0">‹</button>
      <div class="current-date">{{ currentGroupLabel }}</div>
      <button class="btn btn-warning nav-btn" @click="idx++" :disabled="idx>=groupedDays.length-1">›</button>
    </div>
  </div>

  <!-- Date range filters (collapsible) -->
  <transition name="fade-slide">
    <div v-if="showFilters" class="filters-panel">
      <div class="filters-content">
        <div class="filter-row">
          <label class="label">From:</label>
          <input type="datetime-local" v-model="fromDateTime" @change="saveRange" class="range-input" />
          <button v-if="fromDateTime" class="btn btn-danger clear-btn" @click="clearFrom">×</button>
          <label class="label">To:</label>
          <input type="datetime-local" v-model="toDateTime" @change="saveRange" class="range-input" />
          <button v-if="toDateTime" class="btn btn-danger clear-btn" @click="clearTo">×</button>
        </div>
        <div class="range-shortcuts">
          <button class="btn btn-primary shortcut-btn" @click="setToday">Today</button>
          <button class="btn btn-primary shortcut-btn" @click="setPreviousDay">Previous Day</button>
        </div>
      </div>
    </div>
  </transition>

  <!-- Date navigation (for smaller screens) -->
  <div class="controls-bottom mobile-only">
    <label class="label">Recording Day:</label>
    <button class="btn btn-warning nav-btn" @click="idx--" :disabled="idx===0">‹</button>
    <div class="current-date">{{ currentGroupLabel }}</div>
    <button class="btn btn-warning nav-btn" @click="idx++" :disabled="idx>=groupedDays.length-1">›</button>
  </div>

  <!-- Notification Settings (collapsible) -->
  <transition name="fade-slide">
    <div v-if="showNotifications" class="notification-settings">
      <h4 class="settings-title">Changeover Notifications</h4>
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="notificationsEnabled"
              @change="saveNotificationSettings"
              class="setting-checkbox"
            />
            <span>Enable changeover notifications</span>
          </label>
          <small class="setting-hint">Receive alerts when artists are about to start</small>
        </div>
        <div class="setting-item" v-if="notificationsEnabled">
          <label class="setting-label">
            Default warning time (minutes):
          </label>
          <input 
            type="number"
            v-model.number="defaultWarningMinutes"
            @change="saveNotificationSettings"
            min="0"
            max="60"
            step="1"
            class="setting-input"
            placeholder="2"
          />
          <small class="setting-hint">Minutes before artist start time to show notification</small>
        </div>
      </div>
    </div>
  </transition>

  <!-- Schedule list -->
  <div class="list-wrapper">
    <div class="list-scroll">
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
          <div class="form-field">
            <label>Recording Day</label>
            <select v-model="fStageHourId">
              <option value="">None/Unassigned</option>
              <option 
                v-for="sh in stageHours" 
                :key="sh.id" 
                :value="sh.id"
              >
                {{ sh.notes || formatStageHourFallback(sh) }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>Warning (minutes)</label>
            <input 
              v-model.number="fWarningMinutes" 
              type="number" 
              min="0" 
              max="60" 
              step="1"
              placeholder="2"
              title="Minutes before artist start time to show notification (default: 2)"
            />
            <small class="form-hint">Minutes before start time to show changeover notification</small>
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

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast }                         from 'vue-toastification'
import Swal                                 from 'sweetalert2'
import jsPDF                                from 'jspdf'
import autoTable                            from 'jspdf-autotable'
import { useUserStore }                     from '@/stores/userStore'
import { fetchTableData, mutateTableData }  from '@/services/dataService'
import { todayISO, niceDate, t5, getTodayTime, getDateTimeISO, pad2 } from '@/utils/scheduleHelpers'
import { useStageHours }                    from '@/composables/useStageHours'
import { getSetting, saveSetting }          from '@/utils/indexedDB'
import { setDefaultWarningMinutes }         from '@/services/scheduleNotificationService'

export default {
  name: 'LNTabSchedule',
  props: {
    locationId: String
  },
  emits: ['changeover-note', 'quick'],
  setup(props, { emit }) {
    const store = useUserStore()
    const toast = useToast()
    
    // Stage hours composable
    const { stageHours, loadStageHours, findStageHourIdFor, getRecordingDayDisplay, formatStageHourFallback } = useStageHours(props.locationId)

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
    const fStageHourId = ref('')
    const fWarningMinutes = ref(null) // null means use default
    const busy     = ref(false)
    const err      = ref(null)

    // Notification settings state
    const notificationsEnabled = ref(true) // Default to enabled
    const defaultWarningMinutes = ref(2) // Default 2 minutes

    // Filter panel state
    const showFilters = ref(false)
    const showNotifications = ref(false)

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

    // Fetch & group by recording day (stage hour)
    async function fetchAll() {
      // Load schedules and stage hours
      schedules.value = await fetchTableData('schedules', { eq:{ location_id: props.locationId }})
      await loadStageHours()

      // Build groups keyed by stage_hour_id, plus Unassigned
      const byStageHour = {}
      const unassigned = []
      schedules.value.forEach(s => {
        const sid = s.stage_hour_id || findStageHourIdFor(s.recording_date, s.start_time)
        if (sid) {
          byStageHour[sid] = byStageHour[sid] || []
          byStageHour[sid].push(s)
        } else {
          unassigned.push(s)
        }
      })

      const groups = stageHours.value.map(sh => ({
        id: sh.id,
        label: sh.notes || formatStageHourFallback(sh),
        start: sh.start_datetime,
        end: sh.end_datetime,
        events: byStageHour[sh.id] || []
      }))
      if (unassigned.length) {
        groups.push({ id: 'unassigned', label: 'Unassigned', events: unassigned })
      }
      groupedDays.value = groups
      idx.value = Math.max(0, 0)
    }

    const day  = computed(() => groupedDays.value[idx.value] || { id:null, label:null, events:[] })
    const currentGroupLabel = computed(() => day.value.label || '')
    const rows = computed(() => {
      const list = [...day.value.events]
      if (sortOrder.value === 'artist')
        return list.sort((a,b) => a.artist_name.localeCompare(b.artist_name))
      const dir = sortOrder.value === 'asc' ? 1 : -1
      // Sort by date+time combination, not just time
      return list.sort((a,b) => {
        const aDateTime = `${a.recording_date}T${a.start_time || '00:00:00'}`
        const bDateTime = `${b.recording_date}T${b.start_time || '00:00:00'}`
        return aDateTime.localeCompare(bDateTime) * dir
      })
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
          project_id: store.getCurrentProject ? store.getCurrentProject.id : null
        })
        
        toast.success(`Changeover note created for ${artist.artist_name}`)
        
        // Emit event to parent to refresh notes
        emit('changeover-note', changeoverNote)
      } catch (error) {
        console.error('Error creating changeover note:', error)
        toast.error('Failed to create changeover note')
      }
    }

    function openForm(item) {
      showForm.value = true
      if (item) {
        isEdit.value = true; editId = item.id
        fArtist.value = item.artist_name
        fStart.value  = item.start_time
        fEnd.value    = item.end_time
        fDate.value   = item.recording_date
        fStageHourId.value = item.stage_hour_id || (findStageHourIdFor(item.recording_date, item.start_time) || '')
        fWarningMinutes.value = item.warning_bell_minutes || null
      } else {
        isEdit.value = false; editId = null
        fArtist.value = fStart.value = fEnd.value = ''
        fDate.value = todayISO()
        // auto-detect stage hour for the given date/start time if available
        fStageHourId.value = findStageHourIdFor(fDate.value, fStart.value) || ''
        fWarningMinutes.value = null
      }
    }

    function closeForm() {
      showForm.value = false
      err.value = null
    }

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
            recording_date: fDate.value,
            stage_hour_id: fStageHourId.value || null,
            warning_bell_minutes: fWarningMinutes.value || null
          })
        } else {
          await mutateTableData('schedules','insert',{
            artist_name:    fArtist.value,
            start_time:     fStart.value,
            end_time:       fEnd.value,
            recording_date: fDate.value,
            location_id:    props.locationId,
            project_id:     store.getCurrentProject ? store.getCurrentProject.id : null,
            stage_hour_id:  fStageHourId.value || null,
            warning_bell_minutes: fWarningMinutes.value || null
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
        head: [['Artist','Start','End','Date','Recording Day']],
        body: schedules.value.map(s=>[
          s.artist_name, t5(s.start_time), t5(s.end_time), s.recording_date, getRecordingDayDisplay(s)
        ]),
        startY: 60,
        styles: { fontSize:9, cellPadding:4 }
      })
      doc.save('stage-schedule.pdf')
    }

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

    // Load notification settings
    async function loadNotificationSettings() {
      try {
        const enabled = await getSetting('schedule_notifications_enabled', true)
        const minutes = await getSetting('schedule_warning_minutes', 2)
        notificationsEnabled.value = enabled !== false // Default to true
        defaultWarningMinutes.value = parseInt(minutes, 10) || 2
      } catch (error) {
        console.error('Error loading notification settings:', error)
      }
    }

    // Save notification settings
    async function saveNotificationSettings() {
      try {
        await saveSetting('schedule_notifications_enabled', notificationsEnabled.value)
        await saveSetting('schedule_warning_minutes', defaultWarningMinutes.value)
        await setDefaultWarningMinutes(defaultWarningMinutes.value)
        toast.success('Notification settings saved')
      } catch (error) {
        console.error('Error saving notification settings:', error)
        toast.error('Failed to save notification settings')
      }
    }

    onMounted(async () => {
      await fetchAll()
      await loadNotificationSettings()
    })

    const exposed = {
      schedules, stageHours, groupedDays, idx, sortOrder,
      showForm, isEdit, fArtist, fStart, fEnd, fDate, fStageHourId, fWarningMinutes, busy, err,
      currentTimecode, day, currentGroupLabel, rows, hasNextArtist, nextArtist,
      activeIndex, filteredRows, fromDateTime, toDateTime,
      notificationsEnabled, defaultWarningMinutes, showFilters, showNotifications,
      openForm, closeForm, save, remove, exportPdf, emitChangeNote,
      createChangeoverNote, isActive,
      saveRange, clearFrom, clearTo, setToday, setPreviousDay,
      saveNotificationSettings,
      t5, niceDate, formatStageHourFallback
    }
    return exposed
  }
}

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
.controls-top.combined {
  justify-content: space-between;
}
.left-stack, .right-stack { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
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

/* High-contrast positive and warning button treatments across schedule UI */
.btn.btn-positive {
  background-color: #047857 !important;
  color: #ffffff !important;
  border: 2px solid #065f46 !important;
  font-weight: 700;
}
.btn.btn-positive:hover { background-color: #065f46 !important; }
.btn.btn-positive:focus { outline: 3px solid rgba(4,120,87,.35); outline-offset: 2px; }

.btn.btn-warning {
  background-color: #d97706 !important;
  color: #ffffff !important;
  border: 2px solid #b45309 !important;
  font-weight: 700;
}
.btn.btn-warning:hover { background-color: #b45309 !important; }
.btn.btn-warning:focus { outline: 3px solid rgba(217,119,6,.35); outline-offset: 2px; }

/* date nav */
.nav-btn {
  width: 40px; height: 40px;
  background-color: #d97706;
  color: #ffffff;
  border: 2px solid #b45309;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s;
}
.nav-btn:disabled {
opacity: 0.4;
cursor: default;
}
.nav-btn:hover:not(:disabled) { background-color: #b45309; }
.nav-btn:focus { outline: 3px solid rgba(217,119,6,.35); outline-offset: 2px; }
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
.list-scroll {
padding-right: 4px;
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
  width: 52px;
  height: 52px;
border: none;
border-radius: 6px;
display: inline-flex;
align-items: center;
justify-content: center;
cursor: pointer;
transition: background .2s;
}
.icon.edit { background: #f59e0b; color: #ffffff; }
.icon.edit:hover { background: #d97706; }
.icon.delete { background: #ef4444; color: #ffffff; }
.icon.delete:hover { background: #dc2626; }
.icon-svg { width: 32px; height: 32px; color: #fff; }

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
.form-hint {
font-size: 0.75rem;
color: #6b7280;
margin-top: 4px;
display: block;
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

/* Responsive controls */
.wide-screen-only {
  display: none;
}
.mobile-only {
  display: flex;
}

@media (min-width: 1024px) {
  .wide-screen-only {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mobile-only {
    display: none;
  }
  .controls-top.combined {
    justify-content: space-between;
  }
  .right-stack.wide-screen-only {
    margin-left: auto;
  }
}

@media (max-width: 640px) {
  .controls-top.combined {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .left-stack, .right-stack {
    width: 100%;
  }
  .controls-bottom.mobile-only {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .current-date {
    text-align: left;
  }
}

.icon.note { background: #34d399; color: #ffffff; }
.icon.note:hover { background: #10b981; }

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
/* High-contrast primary buttons for date shortcuts */
.btn.btn-primary {
  background-color: #1d4ed8 !important;
  color: #ffffff !important;
  border: 2px solid #1e40af !important;
  font-weight: 700;
}
.btn.btn-primary:hover { background-color: #1e40af !important; }
.btn.btn-primary:focus { outline: 3px solid rgba(29,78,216,.35); outline-offset: 2px; }

/* Filter Toggle Button */
.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
}
.filter-toggle-btn.active {
  background-color: #1e40af !important;
  box-shadow: 0 2px 4px rgba(29, 78, 216, 0.3);
}
.filter-icon,
.alert-icon {
  width: 16px;
  height: 16px;
}

/* Alert Toggle Button */
.alert-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
}
.alert-toggle-btn.active {
  background-color: #1e40af !important;
  box-shadow: 0 2px 4px rgba(29, 78, 216, 0.3);
}

/* Filters Panel */
.filters-panel {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.filters-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Fade slide transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.fade-slide-enter-from {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.fade-slide-enter-to {
  opacity: 1;
  max-height: 200px;
}
.fade-slide-leave-from {
  opacity: 1;
  max-height: 200px;
}
.fade-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Notification Settings */
.notification-settings {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.settings-title {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
}
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.setting-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #059669;
}
.setting-input {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  max-width: 120px;
}
.setting-input:focus {
  border-color: var(--accent2);
  outline: none;
}
.setting-hint {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 26px;
  display: block;
}
</style>