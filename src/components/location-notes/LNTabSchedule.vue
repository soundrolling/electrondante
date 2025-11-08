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
      <button class="btn btn-positive btn-add" @click="openForm()">Add Artist Time</button>
      <button class="btn btn-warning export-btn" @click="openExportModal">Export</button>
    </div>
    <div class="right-stack wide-screen-only">
      <label class="label">Recording Day:</label>
      <button class="btn btn-warning nav-btn" @click="idx--" :disabled="idx===0">‹</button>
      <div class="current-date">{{ currentGroupLabel }}</div>
      <button class="btn btn-warning nav-btn" @click="idx++" :disabled="idx>=groupedDaysLength-1">›</button>
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
        <div class="setting-item" v-if="notificationsEnabled">
          <label class="setting-label">
            Notification scope:
          </label>
          <select 
            v-model="notificationScope"
            @change="saveNotificationSettings"
            class="setting-input"
          >
            <option value="current_project">Current project only</option>
            <option value="all_projects">All my projects</option>
          </select>
          <small class="setting-hint">Receive notifications for current project or all projects you're a member of</small>
        </div>
      </div>
    </div>
  </transition>

  <!-- Schedule list -->
  <div class="list-wrapper">
    <div class="list-scroll">
    <!-- Debug: Show active count (remove after testing) -->
    <div v-if="true" style="padding: 10px; background: yellow; margin-bottom: 10px; font-size: 12px;">
      Debug: Active count: {{ activeScheduleIds.length }}, Current time: {{ currentDeviceTime.toLocaleTimeString() }}, Timestamp: {{ currentTimeTimestamp }}
    </div>
    <template v-if="filteredRows.length">
      <div
        v-for="(r, i) in filteredRows"
        :key="r.id"
        :class="['row-card', { 'active-card': isActive(r) }]"
        :data-active="isActive(r)"
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
            <div class="recording-day-input-group">
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
              <a href="#" class="helper-link" @click.prevent="showRecordingDayHelp = true">Don't see options?</a>
            </div>
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

  <!-- Export Modal -->
  <div v-if="showExportModal" class="modal-overlay" @click.self="closeExportModal">
    <div class="modal-content export-modal">
      <h4>Export Schedule</h4>
      <div class="modal-grid">
        <label style="grid-column: 1 / -1;">Export by:
          <select v-model="exportMode" class="export-mode-select">
            <option value="recording_day">Recording Day</option>
            <option value="date_range">Date Range</option>
          </select>
        </label>
        
        <!-- Recording Day Selection -->
        <div v-if="exportMode === 'recording_day'" style="grid-column: 1 / -1;" class="recording-day-export-section">
          <label>Recording Day:
            <select v-model="exportRecordingDayId" class="export-recording-day-select">
              <option value="all">All Recording Days</option>
              <option value="unassigned">Unassigned</option>
              <option 
                v-for="sh in stageHours" 
                :key="sh.id" 
                :value="sh.id"
              >
                {{ sh.notes || formatStageHourFallback(sh) }}
              </option>
            </select>
          </label>
        </div>
        
        <!-- Date Range Section (Collapsible) -->
        <div v-if="exportMode === 'date_range'" style="grid-column: 1 / -1;" class="date-range-export-section">
          <button 
            class="btn btn-primary date-range-toggle" 
            type="button" 
            @click="showDateRangeOptions = !showDateRangeOptions"
          >
            {{ showDateRangeOptions ? 'Hide' : 'Show' }} Date Range Options
          </button>
          <div v-if="showDateRangeOptions" class="date-range-options">
            <label>From:
              <input type="datetime-local" v-model="exportRangeStart" class="date-range-input" :disabled="exportWholeDay" />
            </label>
            <label>To:
              <input type="datetime-local" v-model="exportRangeEnd" class="date-range-input" :disabled="exportWholeDay" />
            </label>
            <label style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px;">
              <input type="checkbox" v-model="exportWholeDay" /> Export whole day
              <input type="date" v-model="exportWholeDayDate" class="date-range-input" :disabled="!exportWholeDay" />
            </label>
          </div>
        </div>
        
        <label style="grid-column: 1 / -1;">Filename:
          <input type="text" v-model="exportFilename" class="export-filename-input" placeholder="stage-schedule.pdf" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-warning cancel-btn" @click="closeExportModal">Cancel</button>
        <button class="btn btn-positive save-btn" @click="doExportPdf">Export PDF</button>
        <button class="btn btn-positive save-btn" @click="doExportCsv">Export CSV</button>
      </div>
    </div>
  </div>

  <!-- Recording Day Help Modal -->
  <div v-if="showRecordingDayHelp" class="modal-overlay" @click.self="showRecordingDayHelp = false">
    <div class="modal-content recording-day-help-modal">
      <div class="modal-header">
        <h3>Recording Day Options</h3>
        <button class="btn btn-warning modal-close" @click="showRecordingDayHelp = false">×</button>
      </div>
      <div class="modal-body">
        <div class="help-content">
          <p>To see options in the Recording Day dropdown, you need to add time slots (stage hours) for shows.</p>
          <div class="help-steps">
            <h4>How to add Recording Days:</h4>
            <ol>
              <li>Go to <router-link :to="{ name: 'ProjectLocations', params: { id: store.getCurrentProject?.id } }" @click="showRecordingDayHelp = false">Project Locations</router-link> and select this location</li>
              <li>Add time slots for each show or recording session</li>
              <li>Name them "Day 1", "Day 2", "Day 3", etc. (or any name you prefer)</li>
              <li>Set the start and end date/time for each slot</li>
            </ol>
            <p class="help-note">Once you've added stage hours with names, they will appear as options in the Recording Day dropdown.</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-warning" @click="showRecordingDayHelp = false">Close</button>
          <router-link 
            :to="{ name: 'ProjectLocations', params: { id: store.getCurrentProject?.id } }" 
            class="btn btn-primary"
            @click="showRecordingDayHelp = false"
          >
            Go to Project Locations
          </router-link>
        </div>
      </div>
    </div>
  </div>
</section>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter }                        from 'vue-router'
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
    
    // Persistence keys - function to get keys for current project and location
    const getStorageKeys = async (locationId) => {
      const projectId = await getSetting('current-project-id') || 'default'
      const prefix = `ln_schedule_${projectId}_${locationId}_`
      return {
        prefix,
        idx: prefix + 'idx',
        sort: prefix + 'sortOrder',
        fromDateTime: prefix + 'fromDateTime',
        toDateTime: prefix + 'toDateTime',
        showFilters: prefix + 'showFilters'
      }
    }
    
    // Load persisted values or defaults
    const loadPersistedValues = async (locationId) => {
      const keys = await getStorageKeys(locationId)
      try {
        const savedIdx = localStorage.getItem(keys.idx)
        if (savedIdx !== null) {
          const parsed = parseInt(savedIdx, 10)
          if (!isNaN(parsed)) {
            return { 
              idx: parsed, 
              sortOrder: localStorage.getItem(keys.sort) || 'asc',
              fromDateTime: localStorage.getItem(keys.fromDateTime) || '',
              toDateTime: localStorage.getItem(keys.toDateTime) || '',
              showFilters: localStorage.getItem(keys.showFilters) === 'true' || false
            }
          }
        }
      } catch {}
      return { 
        idx: 0, 
        sortOrder: 'asc',
        fromDateTime: '',
        toDateTime: '',
        showFilters: false
      }
    }
    
    // Initialize with default values, will be updated in onMounted
    const idx = ref(0)
    const sortOrder = ref('asc')
    const fromDateTime = ref('')
    const toDateTime = ref('')
    
    // Filter panel state (declared before watch statements)
    const showFilters = ref(false)
    const showNotifications = ref(false)
    
    // Watch and persist changes
    watch(idx, async (newIdx) => {
      const keys = await getStorageKeys(props.locationId)
      try {
        localStorage.setItem(keys.idx, String(newIdx))
      } catch {}
    })
    
    watch(sortOrder, async (newSort) => {
      const keys = await getStorageKeys(props.locationId)
      try {
        localStorage.setItem(keys.sort, newSort)
      } catch {}
    })
    
    watch(fromDateTime, async (newValue) => {
      const keys = await getStorageKeys(props.locationId)
      try {
        localStorage.setItem(keys.fromDateTime, newValue)
      } catch {}
    })
    
    watch(toDateTime, async (newValue) => {
      const keys = await getStorageKeys(props.locationId)
      try {
        localStorage.setItem(keys.toDateTime, newValue)
      } catch {}
    })
    
    watch(showFilters, async (newValue) => {
      const keys = await getStorageKeys(props.locationId)
      try {
        localStorage.setItem(keys.showFilters, String(newValue))
      } catch {}
    })

    // Form state
    const showForm = ref(false)
    const showRecordingDayHelp = ref(false)
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
    const notificationScope = ref('current_project') // 'current_project' or 'all_projects'
    
    // Export modal state
    const showExportModal = ref(false)
    const exportMode = ref('recording_day') // 'recording_day' or 'date_range'
    const exportRecordingDayId = ref('all')
    const exportRangeStart = ref('')
    const exportRangeEnd = ref('')
    const exportWholeDay = ref(false)
    const exportWholeDayDate = ref('')
    const showDateRangeOptions = ref(false)
    const exportFilename = ref('stage-schedule.pdf')

    // Highlighting - use userStore's reactive liveTimecode
    const currentTimecode = computed(() => store.liveTimecode || '00:00:00')
    
    // Reactive current device time for highlighting (updates every second)
    // Use a timestamp to ensure Vue detects the change
    const currentDeviceTime = ref(new Date())
    const currentTimeTimestamp = ref(Date.now())
    let highlightTimerId = null
    onMounted(() => {
      // Update current device time every second for reactive highlighting
      highlightTimerId = setInterval(() => {
        const now = new Date()
        currentDeviceTime.value = now
        currentTimeTimestamp.value = now.getTime() // Force reactivity with timestamp
      }, 1000)
    })
    onUnmounted(() => {
      if (highlightTimerId) {
        clearInterval(highlightTimerId)
      }
    })

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
      // Restore persisted index if valid, otherwise use 0
      const keys = await getStorageKeys(props.locationId)
      const savedIdx = parseInt(localStorage.getItem(keys.idx) || '0', 10)
      if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < groups.length) {
        idx.value = savedIdx
      } else {
        idx.value = 0
        localStorage.setItem(keys.idx, '0')
      }
    }

    const day  = computed(() => groupedDays.value[idx.value] || { id:null, label:null, events:[] })
    const currentGroupLabel = computed(() => day.value.label || '')
    const groupedDaysLength = computed(() => groupedDays.value?.length || 0)
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

    // Helper function to check if a schedule is currently active
    const checkIfActive = (item) => {
      if (!item || !item.start_time || !item.end_time || !item.recording_date || !item.id) {
        return false
      }
      
      const now = currentDeviceTime.value
      const scheduleDate = item.recording_date
      
      // Parse schedule date (format: YYYY-MM-DD)
      const dateParts = scheduleDate.split('-').map(Number)
      if (dateParts.length !== 3 || dateParts.some(isNaN)) {
        return false
      }
      const [scheduleYear, scheduleMonth, scheduleDay] = dateParts
      
      // Validate date parts
      if (scheduleYear < 2000 || scheduleYear > 2100 || scheduleMonth < 1 || scheduleMonth > 12 || scheduleDay < 1 || scheduleDay > 31) {
        return false
      }
      
      // Parse schedule times (format: HH:MM:SS or HH:MM)
      const parseTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return null
        const parts = timeStr.split(':').map(Number)
        if (parts.some(isNaN) || parts.length < 2) return null
        return {
          hours: parts[0] || 0,
          minutes: parts[1] || 0,
          seconds: parts[2] || 0
        }
      }
      
      const startTime = parseTime(item.start_time)
      const endTime = parseTime(item.end_time)
      
      if (!startTime || !endTime) {
        return false
      }
      
      // Create Date objects for schedule start and end times using the schedule's date
      // Note: month is 0-indexed in Date constructor
      const startDateTime = new Date(scheduleYear, scheduleMonth - 1, scheduleDay, 
                                     startTime.hours, startTime.minutes, startTime.seconds)
      const endDateTime = new Date(scheduleYear, scheduleMonth - 1, scheduleDay, 
                                   endTime.hours, endTime.minutes, endTime.seconds)
      
      // Ensure we have valid Date objects
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        return false
      }
      
      // Check if current device time (date + time) is within the schedule range
      // Inclusive start, exclusive end
      const nowTime = now.getTime()
      const startTimeMs = startDateTime.getTime()
      const endTimeMs = endDateTime.getTime()
      const isInRange = nowTime >= startTimeMs && nowTime < endTimeMs
      
      // Log every check for debugging (we'll remove this later)
      if (console) {
        console.log('[LNTabSchedule] Time comparison:', {
          artist: item.artist_name,
          scheduleDate: scheduleDate,
          scheduleStart: item.start_time,
          scheduleEnd: item.end_time,
          parsedDate: { scheduleYear, scheduleMonth, scheduleDay },
          parsedStartTimeObj: startTime,
          parsedEndTimeObj: endTime,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          now: now.toISOString(),
          nowTime,
          startTimeMs,
          endTimeMs,
          isInRange,
          beforeStart: nowTime < startTimeMs,
          afterEnd: nowTime >= endTimeMs,
          diffFromStartMs: nowTime - startTimeMs,
          diffFromEndMs: nowTime - endTimeMs,
          diffFromStartMinutes: Math.round((nowTime - startTimeMs) / 60000),
          diffFromEndMinutes: Math.round((nowTime - endTimeMs) / 60000)
        })
      }
      
      return isInRange
    }

    // Computed property to track which schedules are currently active (reactive to currentDeviceTime)
    const activeScheduleIds = computed(() => {
      // Access timestamp to force reactivity
      const _ = currentTimeTimestamp.value
      const activeIds = []
      const now = currentDeviceTime.value
      
      if (!schedules.value || schedules.value.length === 0) {
        return activeIds
      }
      
      // Debug: log occasionally to see what's happening (every 5 seconds)
      if (schedules.value.length > 0 && console && Math.floor(now.getTime() / 5000) % 2 === 0) {
        const firstSchedule = schedules.value[0]
        console.log('[LNTabSchedule] Checking schedules:', {
          total: schedules.value.length,
          firstSchedule: {
            id: firstSchedule.id,
            artist: firstSchedule.artist_name,
            date: firstSchedule.recording_date,
            start: firstSchedule.start_time,
            end: firstSchedule.end_time
          },
          currentTime: now.toISOString(),
          currentDate: now.toLocaleDateString(),
          currentTimeOnly: now.toLocaleTimeString(),
          activeCount: activeIds.length
        })
      }
      
      schedules.value.forEach(item => {
        const isActive = checkIfActive(item)
        if (isActive) {
          activeIds.push(item.id)
          if (console) {
            console.log('[LNTabSchedule] Active schedule found:', {
              id: item.id,
              artist: item.artist_name,
              date: item.recording_date,
              start: item.start_time,
              end: item.end_time
            })
          }
        }
      })
      
      return activeIds
    })

    // Create a computed map of active schedule IDs for O(1) lookup
    const activeScheduleMap = computed(() => {
      // Access timestamp to force reactivity
      const _ = currentTimeTimestamp.value
      const now = currentDeviceTime.value
      const map = new Map()
      
      if (!schedules.value || schedules.value.length === 0) {
        return map
      }
      
      schedules.value.forEach(item => {
        if (checkIfActive(item)) {
          map.set(item.id, true)
        }
      })
      
      return map
    })

    // Check if an item is currently active - uses computed map for reactivity
    function isActive(item, i) {
      if (!item || !item.id) {
        return false
      }
      // Access the computed map to ensure reactivity
      return activeScheduleMap.value.has(item.id)
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

    // Get exported schedules based on export mode
    function getExportedSchedules() {
      let arr = [...schedules.value]
      
      if (exportMode.value === 'recording_day') {
        if (exportRecordingDayId.value && exportRecordingDayId.value !== 'all') {
          if (exportRecordingDayId.value === 'unassigned') {
            arr = arr.filter(s => !s.stage_hour_id)
          } else {
            arr = arr.filter(s => s.stage_hour_id === exportRecordingDayId.value)
          }
        }
      } else if (exportMode.value === 'date_range') {
        if (exportWholeDay.value && exportWholeDayDate.value) {
          const d = exportWholeDayDate.value
          const start = new Date(`${d}T00:00:00`)
          const end = new Date(`${d}T23:59:59`)
          arr = arr.filter(s => {
            const dt = new Date(`${s.recording_date}T${s.start_time}`)
            return dt >= start && dt <= end
          })
        } else {
          if (exportRangeStart.value) {
            const start = new Date(exportRangeStart.value)
            arr = arr.filter(s => new Date(`${s.recording_date}T${s.start_time}`) >= start)
          }
          if (exportRangeEnd.value) {
            const end = new Date(exportRangeEnd.value)
            arr = arr.filter(s => new Date(`${s.recording_date}T${s.end_time}`) <= end)
          }
        }
      }
      
      return arr.sort((a, b) => {
        const aDateTime = `${a.recording_date}T${a.start_time || '00:00:00'}`
        const bDateTime = `${b.recording_date}T${b.start_time || '00:00:00'}`
        return aDateTime.localeCompare(bDateTime)
      })
    }

    function openExportModal() {
      showExportModal.value = true
      exportMode.value = 'recording_day'
      exportRecordingDayId.value = 'all'
      showDateRangeOptions.value = false
      exportFilename.value = `stage-schedule-${props.locationId}.pdf`
    }

    function closeExportModal() {
      showExportModal.value = false
    }

    // PDF export
    function doExportPdf(){
      try {
        const doc = new jsPDF({ unit:'pt', format:'a4' })
        const exportedSchedules = getExportedSchedules()
        
        // Get export info
        let exportInfo = ''
        if (exportMode.value === 'recording_day') {
          if (exportRecordingDayId.value === 'all') {
            exportInfo = 'All Recording Days'
          } else if (exportRecordingDayId.value === 'unassigned') {
            exportInfo = 'Unassigned'
          } else {
            const stageHour = stageHours.value.find(sh => sh.id === exportRecordingDayId.value)
            exportInfo = stageHour ? (stageHour.notes || formatStageHourFallback(stageHour)) : 'Selected Recording Day'
          }
        } else {
          if (exportWholeDay.value && exportWholeDayDate.value) {
            const d = new Date(exportWholeDayDate.value)
            const label = d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' })
            exportInfo = `${label} (00:00–23:59:59)`
          } else if (exportRangeStart.value || exportRangeEnd.value) {
            const fmt = (iso) => new Date(iso).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
            const startLbl = exportRangeStart.value ? fmt(exportRangeStart.value) : '…'
            const endLbl = exportRangeEnd.value ? fmt(exportRangeEnd.value) : '…'
            exportInfo = `${startLbl} → ${endLbl}`
          }
        }
        
        let y = 40
        doc.setFontSize(14)
        if (exportInfo) {
          doc.text(`${exportMode.value === 'recording_day' ? 'Recording Day' : 'Date Range'}: ${exportInfo}`, 40, y)
          y += 20
        }
        doc.setFontSize(16)
        doc.text('Stage Schedule', 40, y)
        y += 20
        
        if (exportedSchedules.length > 0) {
          autoTable(doc, {
            head: [['Artist','Start','End','Date','Recording Day']],
            body: exportedSchedules.map(s => [
              s.artist_name, t5(s.start_time), t5(s.end_time), s.recording_date, getRecordingDayDisplay(s)
            ]),
            startY: y,
            styles: { fontSize:9, cellPadding:4 }
          })
        } else {
          doc.setFontSize(12)
          doc.text('No schedules available', 40, y + 20)
        }
        
        doc.save(exportFilename.value || 'stage-schedule.pdf')
        toast.success('PDF exported successfully')
        closeExportModal()
      } catch (error) {
        console.error('Export error:', error)
        toast.error('Failed to export PDF')
      }
    }

    // CSV export
    function doExportCsv() {
      try {
        const exportedSchedules = getExportedSchedules()
        
        // Get export info
        let exportInfo = ''
        if (exportMode.value === 'recording_day') {
          if (exportRecordingDayId.value === 'all') {
            exportInfo = 'All Recording Days'
          } else if (exportRecordingDayId.value === 'unassigned') {
            exportInfo = 'Unassigned'
          } else {
            const stageHour = stageHours.value.find(sh => sh.id === exportRecordingDayId.value)
            exportInfo = stageHour ? (stageHour.notes || formatStageHourFallback(stageHour)) : 'Selected Recording Day'
          }
        } else {
          if (exportWholeDay.value && exportWholeDayDate.value) {
            const d = new Date(exportWholeDayDate.value)
            const label = d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' })
            exportInfo = `${label} (00:00–23:59:59)`
          } else if (exportRangeStart.value || exportRangeEnd.value) {
            const fmt = (iso) => new Date(iso).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
            const startLbl = exportRangeStart.value ? fmt(exportRangeStart.value) : '…'
            const endLbl = exportRangeEnd.value ? fmt(exportRangeEnd.value) : '…'
            exportInfo = `${startLbl} → ${endLbl}`
          }
        }
        
        let csv = ''
        if (exportInfo) csv += `${exportMode.value === 'recording_day' ? 'Recording Day' : 'Date Range'}:,${exportInfo}\n`
        csv += '\n'
        csv += 'Artist,Start Time,End Time,Date,Recording Day\n'
        exportedSchedules.forEach(s => {
          csv += `"${s.artist_name}","${t5(s.start_time)}","${t5(s.end_time)}","${s.recording_date}","${getRecordingDayDisplay(s)}"\n`
        })
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.setAttribute('download', (exportFilename.value || 'stage-schedule.csv').replace(/\.pdf$/, '.csv'))
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('CSV exported successfully')
        closeExportModal()
      } catch (error) {
        console.error('Export error:', error)
        toast.error('Failed to export CSV')
      }
    }

    function emitChangeNote(artistName) {
      emit('quick', `DJ Change - ${artistName}`);
    }

    // Date/time range filter state - persistence is handled by watch functions above
    function saveRange() {
      // Persistence is handled by watch functions, this function kept for compatibility
    }
    function clearFrom() {
      fromDateTime.value = ''
    }
    function clearTo() {
      toDateTime.value = ''
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
        const scope = await getSetting('schedule_notification_scope', 'current_project')
        notificationsEnabled.value = enabled !== false // Default to true
        defaultWarningMinutes.value = parseInt(minutes, 10) || 2
        notificationScope.value = scope || 'current_project'
      } catch (error) {
        console.error('Error loading notification settings:', error)
      }
    }

    // Save notification settings
    async function saveNotificationSettings() {
      try {
        await saveSetting('schedule_notifications_enabled', notificationsEnabled.value)
        await saveSetting('schedule_warning_minutes', defaultWarningMinutes.value)
        await saveSetting('schedule_notification_scope', notificationScope.value)
        await setDefaultWarningMinutes(defaultWarningMinutes.value)
        
        // Restart notifications with new scope if service is running
        const { startScheduleNotifications, stopScheduleNotifications } = await import('@/services/scheduleNotificationService')
        stopScheduleNotifications()
        if (notificationsEnabled.value && store.getCurrentProject) {
          startScheduleNotifications(store.getCurrentProject.id)
        }
        
        toast.success('Notification settings saved')
      } catch (error) {
        console.error('Error saving notification settings:', error)
        toast.error('Failed to save notification settings')
      }
    }

    // Watch for location changes to reload data and reset persisted index
    watch(() => props.locationId, async (newLocationId, oldLocationId) => {
      if (newLocationId && newLocationId !== oldLocationId) {
        // Reload persisted values for the new location
        const newPersisted = await loadPersistedValues(newLocationId)
        sortOrder.value = newPersisted.sortOrder
        fromDateTime.value = newPersisted.fromDateTime
        toDateTime.value = newPersisted.toDateTime
        showFilters.value = newPersisted.showFilters
        await fetchAll()
        // fetchAll will restore the correct idx, but ensure it's valid
        if (idx.value >= groupedDays.value.length) {
          idx.value = Math.max(0, groupedDays.value.length - 1)
        }
      }
    })

    onMounted(async () => {
      // Load persisted values first
      const persisted = await loadPersistedValues(props.locationId)
      idx.value = persisted.idx
      sortOrder.value = persisted.sortOrder
      fromDateTime.value = persisted.fromDateTime
      toDateTime.value = persisted.toDateTime
      showFilters.value = persisted.showFilters
      
      await fetchAll()
      await loadNotificationSettings()
      // Ensure idx is within valid range after data loads
      if (idx.value >= groupedDays.value.length) {
        idx.value = Math.max(0, groupedDays.value.length - 1)
      }
    })

    const exposed = {
      schedules, stageHours, groupedDays, groupedDaysLength, idx, sortOrder,
      showForm, showRecordingDayHelp, isEdit, fArtist, fStart, fEnd, fDate, fStageHourId, fWarningMinutes, busy, err,
      currentTimecode, day, currentGroupLabel, rows, hasNextArtist, nextArtist,
      filteredRows, fromDateTime, toDateTime, activeScheduleIds, activeScheduleMap, currentDeviceTime, currentTimeTimestamp,
      notificationsEnabled, defaultWarningMinutes, notificationScope, showFilters, showNotifications,
      showExportModal, exportMode, exportRecordingDayId, exportRangeStart, exportRangeEnd, 
      exportWholeDay, exportWholeDayDate, showDateRangeOptions, exportFilename,
      openForm, closeForm, save, remove, doExportPdf, doExportCsv, emitChangeNote,
      createChangeoverNote, isActive,
      saveRange, clearFrom, clearTo, setToday, setPreviousDay,
      saveNotificationSettings, openExportModal, closeExportModal,
      t5, niceDate, formatStageHourFallback, store
    }
    return exposed
  }
}

</script>

<style scoped>
/* Using global CSS variables from index.css - these respond to dark mode */
.schedule-pane {
background: var(--bg-primary);
padding: 32px;
border-radius: 16px;
box-shadow: var(--shadow-md);
border: 1px solid var(--border-light);
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
background: var(--bg-secondary);
border-radius: 12px;
border: 1px solid var(--border-light);
backdrop-filter: blur(10px);
box-shadow: var(--shadow-sm);
}
.controls-top.combined {
  justify-content: space-between;
}
.left-stack, .right-stack { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.label {
font-size: 0.9rem;
font-weight: 600;
color: var(--text-secondary);
}
.sort-select {
  padding: 8px 32px 8px 8px;
  border: 1.5px solid var(--border-medium);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  /* Icon color adapts to theme */
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' fill='none' stroke='%2364748b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px 18px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.dark .sort-select {
  background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' fill='none' stroke='%23e5e7eb' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
}
.sort-select:focus {
  border-color: var(--color-primary-500);
  outline: none;
}
.btn-add {
background: var(--color-success-500);
color: var(--text-inverse) !important;
padding: 8px 16px;
border: none;
border-radius: 6px;
cursor: pointer;
transition: background .2s;
font-weight: 700;
}
.btn-add,
.btn-add * {
  color: var(--text-inverse) !important;
}
.btn-add:hover {
background: var(--color-success-600);
}

/* High-contrast positive and warning button treatments across schedule UI */
.btn.btn-positive {
  background-color: var(--color-success-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-success-700) !important;
  font-weight: 700;
}
.btn.btn-positive:hover { background-color: var(--color-success-700) !important; }
.btn.btn-positive:focus { outline: 3px solid rgba(4,120,87,.35); outline-offset: 2px; }

.btn.btn-warning {
  background-color: var(--color-warning-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-warning-600) !important;
  font-weight: 700;
}
.btn.btn-warning:hover { background-color: var(--color-warning-600) !important; }
.btn.btn-warning:focus { outline: 3px solid rgba(217,119,6,.35); outline-offset: 2px; }

.btn.btn-danger {
  background-color: var(--color-error-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-error-600) !important;
  font-weight: 700;
}
.btn.btn-danger:hover { background-color: var(--color-error-600) !important; }
.btn.btn-danger:focus { outline: 3px solid rgba(239,68,68,.35); outline-offset: 2px; }
.btn.btn-danger svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

/* date nav */
.nav-btn {
  width: 40px; height: 40px;
  background-color: var(--color-warning-500);
  color: var(--text-inverse);
  border: 2px solid var(--color-warning-600);
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
.nav-btn:hover:not(:disabled) { background-color: var(--color-warning-600); }
.nav-btn:focus { outline: 3px solid rgba(217,119,6,.35); outline-offset: 2px; }
.current-date {
flex: 1;
text-align: center;
font-weight: 600;
color: var(--text-heading);
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
background: var(--bg-primary);
border: 1px solid var(--border-light);
border-radius: 12px;
padding: 20px;
margin-bottom: 16px;
box-shadow: var(--shadow-md);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
backdrop-filter: blur(10px);
}
.row-card.active-card {
background: rgba(34, 197, 94, 0.25) !important;
border: 3px solid var(--color-success-500) !important;
box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4) !important;
transform: scale(1.02);
}
.row-card:hover {
transform: translateY(-2px);
box-shadow: var(--shadow-lg);
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
color: var(--text-secondary);
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
.icon.edit { background: var(--color-warning-500); color: var(--text-inverse); }
.icon.edit:hover { background: var(--color-warning-600); }
.icon.delete { background: var(--color-error-500); color: var(--text-inverse); }
.icon.delete:hover { background: var(--color-error-600); }
.icon-svg { 
  width: 32px; 
  height: 32px; 
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

.empty-text {
text-align: center;
color: var(--text-secondary);
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
z-index: var(--z-modal, 1050);
}
.modal-content {
background: var(--bg-primary);
border-radius: 12px;
box-shadow: var(--shadow-lg);
max-width: 500px;
width: 90%;
max-height: 90vh;
overflow-y: auto;
border: 1px solid var(--border-light);
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
color: var(--text-heading);
}
.modal-close {
background: var(--color-warning-500);
color: var(--text-inverse);
border: 1px solid var(--color-warning-600);
font-size: 1.5rem;
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: background .2s;
}
.modal-close:hover {
background: var(--color-warning-600);
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
color: var(--text-secondary);
}
.form-hint {
font-size: 0.75rem;
color: var(--text-secondary);
margin-top: 4px;
display: block;
}
.form-grid input {
padding: 8px;
border: 1px solid var(--border-medium);
border-radius: 6px;
font-size: 0.95rem;
max-width: 300px;
background: var(--bg-primary);
color: var(--text-primary);
}
.error-text {
color: var(--color-error-600);
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
background: var(--color-warning-500);
color: var(--text-inverse);
border: 1px solid var(--color-warning-600);
}
.save-btn {
background: var(--color-success-500);
color: var(--text-inverse);
transition: background .2s;
}
.save-btn:hover:not(:disabled) {
background: var(--color-success-600);
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

.icon.note { background: var(--color-success-400); color: var(--text-inverse); }
.icon.note:hover { background: var(--color-success-500); }

.range-input {
  padding: 8px;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 0.95rem;
  min-width: 210px;
}
.clear-btn {
  background: var(--color-error-500);
  color: var(--text-inverse);
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
  background: var(--color-error-600);
}

.range-shortcuts {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
/* High-contrast primary buttons for date shortcuts */
.btn.btn-primary {
  background-color: var(--color-primary-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-primary-700) !important;
  font-weight: 700;
}
.btn.btn-primary:hover { background-color: var(--color-primary-700) !important; }
.btn.btn-primary:focus { outline: 3px solid rgba(29,78,216,.35); outline-offset: 2px; }
.btn.btn-primary svg,
.btn.btn-primary .filter-icon,
.btn.btn-primary .alert-icon {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}
.btn.btn-primary,
.btn.btn-primary * {
  color: var(--text-inverse) !important;
}

/* Filter Toggle Button */
.filter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  color: var(--text-inverse) !important;
}
.filter-toggle-btn,
.filter-toggle-btn * {
  color: var(--text-inverse) !important;
}
.filter-toggle-btn.active {
  background-color: var(--color-primary-700) !important;
  box-shadow: 0 2px 4px rgba(29, 78, 216, 0.3);
}
.filter-icon,
.alert-icon {
  width: 16px;
  height: 16px;
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

/* Alert Toggle Button */
.alert-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  color: var(--text-inverse) !important;
}
.alert-toggle-btn,
.alert-toggle-btn * {
  color: var(--text-inverse) !important;
}
.alert-toggle-btn.active {
  background-color: var(--color-primary-700) !important;
  box-shadow: 0 2px 4px rgba(29, 78, 216, 0.3);
}

/* Filters Panel */
.filters-panel {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
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
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
}
.settings-title {
  margin: 0 0 16px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-heading);
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
  color: var(--text-secondary);
  cursor: pointer;
}
.setting-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-success-500);
}
.recording-day-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.helper-link {
  color: var(--primary-color, #007bff);
  font-size: 0.85rem;
  text-decoration: none;
  cursor: pointer;
  align-self: flex-start;
}

.helper-link:hover {
  text-decoration: underline;
}

.recording-day-help-modal {
  max-width: 520px;
}

.help-content {
  margin-bottom: 20px;
}

.help-content p {
  margin-bottom: 16px;
  color: var(--text-primary);
}

.help-steps {
  background: var(--bg-secondary, #f8f9fa);
  padding: 16px;
  border-radius: 6px;
  margin-top: 12px;
}

.help-steps h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 1rem;
}

.help-steps ol {
  margin: 0;
  padding-left: 20px;
  color: var(--text-primary);
}

.help-steps li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.help-note {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-medium);
  font-style: italic;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.setting-input {
  padding: 8px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.95rem;
  max-width: 120px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.setting-input:focus {
  border-color: var(--color-primary-500);
  outline: none;
}
.setting-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: 26px;
  display: block;
}

.export-btn {
  background: var(--color-warning-500);
  color: var(--text-inverse);
  border: 2px solid var(--color-warning-600);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background .2s;
  font-weight: 700;
}

.export-btn:hover {
  background: var(--color-warning-600);
}

.export-modal {
  max-width: 600px;
}

.export-mode-select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-top: 4px;
}

.export-mode-select:focus {
  border-color: var(--color-primary-500);
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.recording-day-export-section {
  margin-top: 12px;
}

.export-recording-day-select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-top: 4px;
}

.export-recording-day-select:focus {
  border-color: var(--color-primary-500);
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.date-range-export-section {
  margin-top: 12px;
}

.date-range-toggle {
  width: 100%;
  margin-bottom: 12px;
}

.date-range-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.export-filename-input {
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  min-width: 180px;
  width: 100%;
}

.date-range-input {
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.95rem;
  width: 100%;
}
</style>