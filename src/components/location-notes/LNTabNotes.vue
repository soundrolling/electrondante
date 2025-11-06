<template>
<div class="notes-pane">
  <div class="header-bar">
    <div class="header-left">
      <h3>Notes</h3>
      <div class="status-indicators">
        <span 
          class="sync-icon" 
          :class="{ 
            online: isOnline && !hasPendingSync, 
            offline: !isOnline, 
            pending: hasPendingSync 
          }"
          :title="isOnline ? (hasPendingSync ? 'Pending sync' : 'Online') : 'Offline'"
        >
          <span v-if="isOnline && !hasPendingSync">✓</span>
          <span v-else-if="!isOnline">⚠</span>
          <span v-else-if="hasPendingSync">⏳</span>
        </span>
      </div>
    </div>
    <div class="header-actions">
      <button
        class="btn btn-positive action-btn add-btn"
        @click="startEdit({ timestamp: nowTime(), recording_date: todayISO(), note: '' })"
      >
        New Note
      </button>
      <button class="btn btn-warning action-btn export-btn" @click="openExportModal">Export</button>
    </div>
  </div>

  <div v-if="pills.length" class="quickfire-section">
    <span class="label">Quick Notes:</span>
    <div class="pills-container">
      <button
        v-for="b in pills"
        :key="b.id || b._queuedKey"
        class="pill"
        :style="{ '--pill-bg': b.color, '--pill-fg': contrast(b.color) }"
        @click="onPillClick(b)"
      >
        {{ b.name }}
      </button>
    </div>
  </div>

  <!-- Controls: two neat rows; filters collapsed by default -->
  <div class="notes-controls">
    <div class="controls-row top">
      <div class="sort-wrap">
        <label for="sortKey" class="label">Sort:</label>
        <select id="sortKey" v-model="sortKey" class="sort-select">
          <option value="desc">Latest first</option>
          <option value="asc">Earliest first</option>
        </select>
      </div>
      <div class="recording-day-filter-row">
        <label class="label">Recording Day:</label>
        <select v-model="recordingDayFilter" class="recording-day-filter-select">
          <option value="all">All</option>
          <option value="unassigned">Unassigned</option>
          <option 
            v-for="stageHour in stageHours" 
            :key="stageHour.id" 
            :value="stageHour.id"
          >
            {{ stageHour.notes || `Day ${stageHour.id.slice(-4)}` }}
          </option>
        </select>
      </div>
      <div class="stage-hours-btn">
        <button class="btn btn-primary stage-hours-button" @click="openStageHoursModal" title="View & Edit Stage Hours">
          📅 Stage Hours
        </button>
      </div>
      <div class="spacer"></div>
      <button class="btn btn-warning filter-toggle" @click="toggleFilters" :aria-expanded="showFilters">{{ showFilters ? 'Hide Filters' : 'Filters' }}</button>
    </div>
    <div v-if="showFilters" class="controls-row filters">
      <div class="date-row">
        <label class="label">From:</label>
        <input type="datetime-local" v-model="rangeStart" class="date-range-input" />
        <button class="btn btn-danger reset-btn" @click="rangeStart = ''" title="Clear from date">✕</button>
      </div>
      <div class="date-row">
        <label class="label">To:</label>
        <input type="datetime-local" v-model="rangeEnd" class="date-range-input" />
        <button class="btn btn-danger reset-btn" @click="rangeEnd = ''" title="Clear to date">✕</button>
      </div>
      <div class="quick-range-btns">
        <button class="btn btn-primary today-btn" @click="setTodayRange" title="Set range to today">Today</button>
        <button class="btn btn-primary prevday-btn" @click="setPrevDayRange" title="Set range to previous day">Previous Day</button>
      </div>
    </div>
  </div>

  <!-- Spreadsheet-like table view -->
  <div v-if="filteredAndSortedNotes.length" class="notes-table-wrapper">
    <div class="notes-table-scroll">
    <table class="notes-table">
      <thead>
        <tr>
          <th class="note-datetime-header">Time / Date</th>
          <th class="note-text-header">Note</th>
          <th class="note-recording-day-header">Recording Day</th>
          <th class="note-actions-header">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in filteredAndSortedNotes" :key="n.id || n._queuedKey">
          <td class="note-datetime">
            <div class="datetime-combined">
              <span class="note-time">{{ n.timestamp }}</span>
              <span class="datetime-separator"> • </span>
              <span class="note-date">{{ fmtDate(n.recording_date) }}</span>
            </div>
          </td>
          <td class="note-text">{{ n.note }}</td>
          <td class="note-recording-day">{{ getRecordingDayDisplay(n) }}</td>
          <td class="note-actions">
            <button
              class="btn btn-primary icon-btn info"
              @click="showInfoModal(n)"
              title="More info"
            >ℹ️</button>
            <button
              class="btn btn-warning icon-btn edit"
              @click="startEdit(n)"
              title="Edit"
            >✎</button>
            <button
              class="btn btn-danger icon-btn del"
              @click="deleteNote(n.id)"
              title="Delete"
            >🗑</button>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
  <p v-else class="empty-state">No notes yet.</p>

  <div
    v-if="showForm"
    class="modal-overlay"
    @click.self="cancelEdit"
  >
    <div class="modal-content">
      <h4>{{ editingId ? 'Edit' : 'New' }} Note</h4>
      <div class="modal-grid">
        <div class="timestamp-row">
          <input
            v-model="draft.timestamp"
            type="text"
            placeholder="HH:MM:SS"
            class="time-input"
          />
          <button class="btn btn-warning refresh-btn" @click="refreshTimestamp" title="Set to current time">🔄</button>
        </div>
        <input
          v-model="draft.recording_date"
          type="date"
          class="date-input"
        />
        <div class="recording-day-row">
          <label class="label">Recording Day:</label>
          <div class="recording-day-input-group">
            <select v-model="draft.stage_hour_id" class="recording-day-select">
              <option value="">None/Unassigned</option>
              <option 
                v-for="stageHour in stageHours" 
                :key="stageHour.id" 
                :value="stageHour.id"
              >
                {{ stageHour.notes || `Day ${stageHour.id.slice(-4)}` }}
              </option>
            </select>
            <a href="#" class="helper-link" @click.prevent="showRecordingDayHelp = true">Don't see options?</a>
          </div>
        </div>
      </div>
      <textarea
        v-model="draft.note"
        rows="4"
        class="note-input"
        placeholder="Your note..."
      ></textarea>
      <div class="modal-actions">
        <button class="btn btn-warning cancel-btn" @click="cancelEdit">Cancel</button>
        <button
          class="btn btn-positive save-btn"
          @click="saveEdit"
          :disabled="!draft.note.trim()"
        >
          Save
        </button>
      </div>
    </div>
  </div>

  <!-- Info Modal -->
  <div v-if="showInfo" class="modal-overlay" @click.self="closeInfoModal">
    <div class="modal-content">
      <h4>Note Details</h4>
      <div class="modal-grid">
        <div><strong>Time:</strong> {{ infoNote?.timestamp }}</div>
        <div><strong>Date:</strong> {{ fmtDate(infoNote?.recording_date) }}</div>
        <div><strong>Recording Day:</strong> {{ getRecordingDayDisplay(infoNote) }}</div>
        <div><strong>Status:</strong> 
          <span class="sync-icon" :class="infoNote?._isTemp ? 'offline' : 'online'">
            <span v-if="infoNote?._isTemp">⚠</span>
            <span v-else>✓</span>
          </span>
          {{ infoNote?._isTemp ? 'Pending Sync' : 'Synced' }}
        </div>
        <div><strong>Author:</strong> {{ infoNote?.creator_email || 'unknown' }}</div>
      </div>
      <div style="margin-top: 12px;"><strong>Note:</strong><br>{{ infoNote?.note }}</div>
      <div class="modal-actions">
        <button class="btn btn-warning cancel-btn" @click="closeInfoModal">Close</button>
      </div>
    </div>
  </div>

  <!-- Export Modal -->
  <div v-if="showExportModal" class="modal-overlay" @click.self="closeExportModal">
    <div class="modal-content">
      <h4>Export Notes & Schedule</h4>
      <div class="modal-grid">
        <label>From:
          <input type="datetime-local" v-model="exportRangeStart" class="date-range-input" :disabled="exportWholeDay" />
        </label>
        <label>To:
          <input type="datetime-local" v-model="exportRangeEnd" class="date-range-input" :disabled="exportWholeDay" />
        </label>
        <label>Filename:
          <input type="text" v-model="exportFilename" class="export-filename-input" placeholder="location-notes.pdf" />
        </label>
        <label style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px;">
          <input type="checkbox" v-model="exportWholeDay" /> Export whole day
          <input type="date" v-model="exportWholeDayDate" class="date-range-input" :disabled="!exportWholeDay" />
        </label>
        <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px;">
          <button class="btn btn-primary" type="button" @click="applyFilterRange">Use current Notes filter range</button>
          <small style="color:#64748b">Quickly copy the From/To range from the table filters.</small>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-warning cancel-btn" @click="closeExportModal">Cancel</button>
        <button class="btn btn-positive save-btn" @click="doExportPdf">Export PDF</button>
        <button class="btn btn-positive save-btn" @click="doExportCsv">Export CSV</button>
      </div>
    </div>
  </div>

  <!-- Stage Hours Modal -->
  <div v-if="showStageHoursModal" class="modal-overlay" @click="closeStageHoursModal">
    <div class="modal-content stage-hours-modal">
      <div class="modal-header">
        <h3>Stage Hours - {{ location?.venue_name }} – {{ location?.stage_name }}</h3>
        <button class="btn btn-warning modal-close" @click="closeStageHoursModal">×</button>
      </div>
      <div class="modal-body">
        <div v-if="stageHours.length === 0" class="empty-state">
          <p>No stage hours configured for this stage.</p>
          <button class="btn btn-primary" @click="addNewStageHour">Add First Stage Hour</button>
        </div>
        <div v-else class="stage-hours-list">
          <div 
            v-for="stageHour in stageHours" 
            :key="stageHour.id"
            class="stage-hour-item"
          >
            <div v-if="!editingStageHour || editingStageHour.id !== stageHour.id" class="stage-hour-display">
              <div class="stage-hour-header">
                <span class="stage-hour-label">{{ stageHour.notes || `Day ${stageHour.id}` }}</span>
                <span class="stage-hour-dates">{{ formatStageHourDates(stageHour) }}</span>
                <button class="btn btn-warning mini edit-stage-hour-btn" @click="editStageHour(stageHour)">Edit</button>
              </div>
              <div class="stage-hour-times">
                <span class="start-time">{{ formatDateTime(stageHour.start_datetime) }}</span>
                <span class="time-separator">→</span>
                <span class="end-time">{{ formatDateTime(stageHour.end_datetime) }}</span>
              </div>
            </div>
            <div v-else class="stage-hour-edit">
              <div class="edit-form">
                <div class="form-row">
                  <label>Label/Notes:</label>
                  <input v-model="editingStageHour.notes" type="text" placeholder="e.g., Day 1, Setup Day, etc." />
                </div>
                <div class="form-row">
                  <label>Start Date & Time:</label>
                  <input v-model="editingStageHour.start_datetime" type="datetime-local" />
                </div>
                <div class="form-row">
                  <label>End Date & Time:</label>
                  <input v-model="editingStageHour.end_datetime" type="datetime-local" />
                </div>
                <div class="form-actions">
                  <button class="btn btn-warning mini" @click="cancelEditStageHour">Cancel</button>
                  <button class="btn btn-positive mini" @click="saveStageHour" :disabled="isSavingStageHour">
                    {{ isSavingStageHour ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="add-stage-hour-section">
            <button class="btn btn-primary" @click="addNewStageHour">+ Add Stage Hour</button>
          </div>
        </div>
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
              <li>Click the "Manage Hours" button below to open the Stage Hours manager</li>
              <li>Add time slots for each show or recording session</li>
              <li>Name them "Day 1", "Day 2", "Day 3", etc. (or any name you prefer)</li>
              <li>Set the start and end date/time for each slot</li>
            </ol>
            <p class="help-note">Once you've added stage hours with names, they will appear as options in the Recording Day dropdown.</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-warning" @click="showRecordingDayHelp = false">Close</button>
          <button class="btn btn-primary" @click="openStageHoursFromHelp">Manage Hours</button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
/**
 * Location Notes Component with Offline-First Functionality
 * 
 * This component implements a robust offline-first approach:
 * - Always saves to local storage first for immediate UI updates
 * - Queues changes for Supabase sync when offline
 * - Provides visual indicators for online/offline status
 * - Automatically syncs when coming back online
 * - Shows pending sync status to users
 */
import { ref, computed, onMounted, watch } from 'vue';
import Swal from 'sweetalert2';
import { useToast } from 'vue-toastification';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUserStore } from '@/stores/userStore';
import {
fetchTableData,
mutateTableData,
syncOfflineChanges,
hasPendingChanges
} from '@/services/dataService';
import { getSetting, getData } from '@/utils/indexedDB';

const props = defineProps({ locationId: { type: String, required: true } });

// Watch for location changes to reload data
watch(() => props.locationId, async (newLocationId, oldLocationId) => {
  if (newLocationId && newLocationId !== oldLocationId) {
    console.log(`[LNTabNotes] Location changed from ${oldLocationId} to ${newLocationId}`);
    hasLoaded.value = false;
    // Reload persisted values for the new location
    const newPersisted = loadPersistedValues(newLocationId);
    sortKey.value = newPersisted.sortKey;
    recordingDayFilter.value = newPersisted.recordingDayFilter;
    await ensureDataPersistence();
    await loadPills();
    await loadStageHours();
    await checkPendingChanges();
    hasLoaded.value = true;
  }
});
const toast = useToast();
const userStore = useUserStore();

const notes = ref([]);
const pills = ref([]);
const stageHours = ref([]);

// Persistence helper functions
function getStorageKeys(locationId) {
  const prefix = `ln_notes_${locationId}_`;
  return {
    prefix,
    sort: prefix + 'sortKey',
    recordingDay: prefix + 'recordingDayFilter'
  };
}

// Load persisted values or defaults
function loadPersistedValues(locationId) {
  const keys = getStorageKeys(locationId);
  try {
    return {
      sortKey: localStorage.getItem(keys.sort) || 'desc',
      recordingDayFilter: localStorage.getItem(keys.recordingDay) || 'all'
    };
  } catch {
    return { sortKey: 'desc', recordingDayFilter: 'all' };
  }
}

const persisted = loadPersistedValues(props.locationId);
const sortKey = ref(persisted.sortKey);
const recordingDayFilter = ref(persisted.recordingDayFilter);

// Watch and persist changes
watch(sortKey, (newSort) => {
  const keys = getStorageKeys(props.locationId);
  try {
    localStorage.setItem(keys.sort, newSort);
  } catch {}
});

watch(recordingDayFilter, (newFilter) => {
  const keys = getStorageKeys(props.locationId);
  try {
    localStorage.setItem(keys.recordingDay, newFilter);
  } catch {}
});

const editingId = ref(null);
const draft = ref({ timestamp: '', recording_date: '', note: '', stage_hour_id: null });
const showForm = ref(false);
const hasLoaded = ref(false);
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const hasPendingSync = ref(false);
const isSyncing = ref(false);
const showInfo = ref(false);
const infoNote = ref(null);

const showExportModal = ref(false);
const exportRangeStart = ref('');
const exportRangeEnd = ref('');
const exportWholeDay = ref(false);
const exportWholeDayDate = ref('');
const EXPORT_PREF_KEY = 'ln_notes_export_prefs';

// Stage Hours Modal
const showStageHoursModal = ref(false);
const showRecordingDayHelp = ref(false);
const editingStageHour = ref(null);
const isSavingStageHour = ref(false);
const location = ref(null);

function saveExportPrefs() {
  try {
    const prefs = {
      wholeDay: exportWholeDay.value,
      day: exportWholeDayDate.value,
      start: exportRangeStart.value,
      end: exportRangeEnd.value,
    };
    localStorage.setItem(EXPORT_PREF_KEY, JSON.stringify(prefs));
  } catch {}
}

function loadExportPrefs() {
  try {
    const raw = localStorage.getItem(EXPORT_PREF_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    exportWholeDay.value = !!p.wholeDay;
    exportWholeDayDate.value = p.day || todayISO();
    exportRangeStart.value = p.start || '';
    exportRangeEnd.value = p.end || '';
    return true;
  } catch { return false; }
}

function applyFilterRange() {
  exportWholeDay.value = false;
  exportRangeStart.value = rangeStart.value || '';
  exportRangeEnd.value = rangeEnd.value || '';
}
const exportFilename = ref('location-notes.pdf');
let exportCsvMode = false;

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 8);
const fmtDate = d =>
new Date(d).toLocaleDateString([], {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});
const contrast = hex => {
const [r, g, b] = hex
  .replace('#', '')
  .match(/.{2}/g)
  .map(h => parseInt(h, 16));
return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? '#fff' : '#000';
};

// Auto-detect current stage hour based on timestamp and date
function getCurrentStageHour(timestamp, recordingDate) {
  if (!stageHours.value.length || !timestamp || !recordingDate) return null;
  
  const noteDateTime = new Date(`${recordingDate}T${timestamp}`);
  
  for (const stageHour of stageHours.value) {
    const startDateTime = new Date(stageHour.start_datetime);
    const endDateTime = new Date(stageHour.end_datetime);
    
    // Check if note falls within this stage hour's time range
    if (noteDateTime >= startDateTime && noteDateTime <= endDateTime) {
      return stageHour.id;
    }
  }
  
  return null;
}

// Get recording day display name for a note
function getRecordingDayDisplay(note) {
  if (!note.stage_hour_id) return '—';
  
  const stageHour = stageHours.value.find(sh => sh.id === note.stage_hour_id);
  if (!stageHour) return '—';
  
  return stageHour.notes || `Day ${stageHour.id.slice(-4)}`;
}

// Update: sort filtered notes, not all notes
const sortedNotes = computed(() => {
  const arr = [...notes.value];
  // Always sort by full datetime (date + time)
  return arr.sort((a, b) => {
    const aDate = new Date(`${a.recording_date}T${a.timestamp}`);
    const bDate = new Date(`${b.recording_date}T${b.timestamp}`);
    return sortKey.value === 'asc' ? aDate - bDate : bDate - aDate;
  });
});

// Watch for online/offline status changes
watch(isOnline, (newStatus) => {
  if (newStatus && hasPendingSync.value) {
    // Add a small delay to prevent multiple rapid syncs
    setTimeout(() => {
      if (isOnline.value && hasPendingSync.value) {
        manualSync();
      }
    }, 1000);
  }
});

// Listen for online/offline events
onMounted(() => {
  const handleOnline = () => {
    isOnline.value = true;
    if (hasPendingSync.value) {
      // Add a small delay to prevent multiple rapid syncs
      setTimeout(() => {
        if (isOnline.value && hasPendingSync.value) {
          manualSync();
        }
      }, 1000);
    }
    // Refresh data when coming back online
    loadNotes();
  };
  
  const handleOffline = () => {
    isOnline.value = false;
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Cleanup function (though in Vue 3 this is less critical)
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
});

async function loadNotes() {
  try {
    // Always try to fetch from Supabase first when online
    if (isOnline.value) {
      notes.value = await fetchTableData('notes', {
        eq: { location_id: props.locationId },
        order: { column: 'created_at', ascending: false }
      });
      console.log(`[loadNotes] Loaded ${notes.value.length} notes (online)`);
    } else {
      // Use cached data when offline
      notes.value = await fetchTableData('notes', {
        eq: { location_id: props.locationId },
        order: { column: 'created_at', ascending: false }
      });
      console.log(`[loadNotes] Loaded ${notes.value.length} notes (offline)`);
      toast.info('Offline mode: using cached notes');
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    // Fallback to local data on error
    notes.value = await fetchTableData('notes', {
      eq: { location_id: props.locationId },
      order: { column: 'created_at', ascending: false }
    });
  }
}

async function loadPills() {
  try {
    if (isOnline.value) {
      pills.value = await fetchTableData('quickfire_buttons', {
        eq: { location_id: props.locationId }
      });
    } else {
      pills.value = await fetchTableData('quickfire_buttons', {
        eq: { location_id: props.locationId }
      });
      toast.info('Offline mode: using cached quick notes');
    }
  } catch (error) {
    console.error('Error loading pills:', error);
    pills.value = await fetchTableData('quickfire_buttons', {
      eq: { location_id: props.locationId }
    });
  }
}

async function loadStageHours() {
  try {
    const projectId = await getSetting('current-project-id');
    if (isOnline.value) {
      stageHours.value = await fetchTableData('stage_hours', {
        eq: { 
          project_id: projectId,
          stage_id: props.locationId 
        },
        order: { column: 'start_datetime', ascending: true }
      });
    } else {
      stageHours.value = await fetchTableData('stage_hours', {
        eq: { 
          project_id: projectId,
          stage_id: props.locationId 
        },
        order: { column: 'start_datetime', ascending: true }
      });
      toast.info('Offline mode: using cached stage hours');
    }
  } catch (error) {
    console.error('Error loading stage hours:', error);
    stageHours.value = await fetchTableData('stage_hours', {
      eq: { 
        project_id: await getSetting('current-project-id'),
        stage_id: props.locationId 
      },
      order: { column: 'start_datetime', ascending: true }
    });
  }
}

function startEdit(n) {
editingId.value = n.id || null;
const timestamp = n.timestamp || nowTime();
const recordingDate = n.recording_date || todayISO();
const autoDetectedStageHour = getCurrentStageHour(timestamp, recordingDate);

draft.value = {
  timestamp: timestamp,
  recording_date: recordingDate,
  note: n.note || '',
  stage_hour_id: n.stage_hour_id || autoDetectedStageHour
};
showForm.value = true;
}

function cancelEdit() {
showForm.value = false;
}

async function saveEdit() {
if (!draft.value.note.trim()) return;

const payload = {
  ...draft.value,
  location_id: props.locationId,
  creator_email: userStore.getUserEmail,
  project_id: await getSetting('current-project-id')
};

try {
  if (editingId.value) {
    // Update existing note
    await mutateTableData('notes', 'update', {
      id: editingId.value,
      ...payload
    });
    toast.success(isOnline.value ? 'Note updated' : 'Note updated offline');
  } else {
    // Create new note
    await mutateTableData('notes', 'insert', payload);
    toast.success(
      isOnline.value ? 'Note added' : 'Note saved offline - will sync when online'
    );
  }

  // Always save to local storage and update UI immediately
  await loadNotes();
  await checkPendingChanges();
  
  showForm.value = false;
} catch (error) {
  console.error('Error saving note:', error);
  toast.error('Failed to save note');
}
}

async function deleteNote(id) {
const { isConfirmed } = await Swal.fire({
  title: 'Delete this note?',
  text: 'Cannot undo.',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#ef4444'
});
if (!isConfirmed) return;

try {
  await mutateTableData('notes', 'delete', { id });
  toast.success(isOnline.value ? 'Note deleted' : 'Note deleted offline');
  await loadNotes();
  await checkPendingChanges();
} catch (error) {
  console.error('Error deleting note:', error);
  toast.error('Failed to delete note');
}
}

function onPillClick(b) {
startEdit({
  timestamp: nowTime(),
  recording_date: todayISO(),
  note: b.note
});
}

const rangeStart = ref('');
const rangeEnd = ref('');
// recordingDayFilter is now defined above with persistence
const showFilters = ref(false);
function toggleFilters(){ showFilters.value = !showFilters.value }
function clearRange() {
  rangeStart.value = '';
  rangeEnd.value = '';
}

function toDateTime(date, time) {
  return new Date(`${date}T${time}`);
}

const filteredAndSortedNotes = computed(() => {
  let arr = [...notes.value];
  
  // Filter by date-time range if set
  if (rangeStart.value) {
    const start = new Date(rangeStart.value);
    arr = arr.filter(n => toDateTime(n.recording_date, n.timestamp) >= start);
  }
  if (rangeEnd.value) {
    const end = new Date(rangeEnd.value);
    arr = arr.filter(n => toDateTime(n.recording_date, n.timestamp) <= end);
  }
  
  // Filter by recording day if set
  if (recordingDayFilter.value && recordingDayFilter.value !== 'all') {
    if (recordingDayFilter.value === 'unassigned') {
      arr = arr.filter(n => !n.stage_hour_id);
    } else {
      arr = arr.filter(n => n.stage_hour_id === recordingDayFilter.value);
    }
  }
  
  // Sort
  return arr.sort((a, b) => {
    const aDate = new Date(`${a.recording_date}T${a.timestamp}`);
    const bDate = new Date(`${b.recording_date}T${b.timestamp}`);
    return sortKey.value === 'asc' ? aDate - bDate : bDate - aDate;
  });
});

function openExportModal() {
  showExportModal.value = true;
  // Load saved prefs if available; otherwise defaults
  const loaded = loadExportPrefs();
  if (!loaded) {
    exportRangeStart.value = rangeStart.value || '';
    exportRangeEnd.value = rangeEnd.value || '';
    exportWholeDay.value = true;
    exportWholeDayDate.value = todayISO();
  }
  exportFilename.value = `location-notes-${props.locationId}.pdf`;
}
function closeExportModal() {
  showExportModal.value = false;
}

// Stage Hours Modal Functions
function openStageHoursModal() {
  console.log('Opening stage hours modal, stageHours data:', stageHours.value);
  showStageHoursModal.value = true;
}

function closeStageHoursModal() {
  showStageHoursModal.value = false;
  editingStageHour.value = null;
}

function openStageHoursFromHelp() {
  showRecordingDayHelp.value = false;
  openStageHoursModal();
}

function editStageHour(stageHour) {
  editingStageHour.value = { ...stageHour };
}

function cancelEditStageHour() {
  editingStageHour.value = null;
}

async function saveStageHour() {
  if (!editingStageHour.value) return;
  
  isSavingStageHour.value = true;
  try {
    const projectId = await getSetting('current-project-id');
    
    if (editingStageHour.value.id) {
      // Update existing stage hour
      await mutateTableData('stage_hours', 'update', {
        id: editingStageHour.value.id,
        notes: editingStageHour.value.notes,
        start_datetime: editingStageHour.value.start_datetime,
        end_datetime: editingStageHour.value.end_datetime
      });
    } else {
      // Create new stage hour
      await mutateTableData('stage_hours', 'insert', {
        project_id: projectId,
        stage_id: props.locationId,
        notes: editingStageHour.value.notes,
        start_datetime: editingStageHour.value.start_datetime,
        end_datetime: editingStageHour.value.end_datetime
      });
    }
    
    // Reload stage hours
    await loadStageHours();
    editingStageHour.value = null;
    toast.success('Stage hour saved successfully');
  } catch (error) {
    console.error('Error saving stage hour:', error);
    toast.error('Failed to save stage hour');
  } finally {
    isSavingStageHour.value = false;
  }
}

function addNewStageHour() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  editingStageHour.value = {
    id: null,
    notes: '',
    start_datetime: now.toISOString().slice(0, 16),
    end_datetime: tomorrow.toISOString().slice(0, 16)
  };
}

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function formatStageHourDates(stageHour) {
  const startDate = new Date(stageHour.start_datetime);
  const endDate = new Date(stageHour.end_datetime);
  
  const startDateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endDateStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  
  if (startDateStr === endDateStr) {
    return startDateStr;
  } else {
    return `${startDateStr} - ${endDateStr}`;
  }
}

// Only use date range for export, not for table filtering
function getExportedNotes() {
  let arr = [...notes.value];
  if (exportWholeDay.value && exportWholeDayDate.value) {
    const d = exportWholeDayDate.value;
    const start = new Date(`${d}T00:00:00`);
    const end = new Date(`${d}T23:59:59`);
    arr = arr.filter(n => {
      const dt = toDateTime(n.recording_date, n.timestamp);
      return dt >= start && dt <= end;
    });
  } else {
    if (exportRangeStart.value) {
      const start = new Date(exportRangeStart.value);
      arr = arr.filter(n => toDateTime(n.recording_date, n.timestamp) >= start);
    }
    if (exportRangeEnd.value) {
      const end = new Date(exportRangeEnd.value);
      arr = arr.filter(n => toDateTime(n.recording_date, n.timestamp) <= end);
    }
  }
  // Filter by recording day if a specific one is selected (not 'all')
  if (recordingDayFilter.value && recordingDayFilter.value !== 'all') {
    if (recordingDayFilter.value === 'unassigned') {
      arr = arr.filter(n => !n.stage_hour_id);
    } else {
      arr = arr.filter(n => n.stage_hour_id === recordingDayFilter.value);
    }
  }
  // Sort
  return arr.sort((a, b) => {
    const aDate = new Date(`${a.recording_date}T${a.timestamp}`);
    const bDate = new Date(`${b.recording_date}T${b.timestamp}`);
    return sortKey.value === 'asc' ? aDate - bDate : bDate - aDate;
  });
}

async function doExportPdf() {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    // Get project, venue, stage/location name, author, and timestamp
    let projectName = '';
    let stageName = '';
    let venueName = '';
    let author = '';
    let exportedAt = new Date().toLocaleString();
    try {
      const store = useUserStore();
      projectName = store.getCurrentProject?.name || store.getCurrentProject?.project_name || '';
      author = store.getUserEmail || '';
    } catch {}
    if (typeof location !== 'undefined' && location.value) {
      venueName = location.value.venue_name || '';
      stageName = location.value.stage_name || '';
    }
    // Date range
    let dateRange = '';
    if (exportWholeDay.value && exportWholeDayDate.value) {
      const d = new Date(exportWholeDayDate.value);
      const label = d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
      dateRange = `${label} (00:00–23:59:59)`;
    } else if (exportRangeStart.value || exportRangeEnd.value) {
      const fmt = (iso) => new Date(iso).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const startLbl = exportRangeStart.value ? fmt(exportRangeStart.value) : '…';
      const endLbl   = exportRangeEnd.value ? fmt(exportRangeEnd.value)     : '…';
      dateRange = `${startLbl} → ${endLbl}`;
    }
    let y = 40;
    doc.setFontSize(14);
    if (projectName) { doc.text(`Project: ${projectName}`, 40, y); y += 20; }
    if (venueName) { doc.text(`Venue: ${venueName}`, 40, y); y += 20; }
    if (stageName) { doc.text(`Stage: ${stageName}`, 40, y); y += 20; }
    if (author) { doc.text(`Author: ${author}`, 40, y); y += 20; }
    doc.text(`Exported at: ${exportedAt}`, 40, y); y += 20;
    if (dateRange) { doc.text(`Date Range: ${dateRange}`, 40, y); y += 20; }
    y += 10;
    // Notes table
    doc.setFontSize(16);
    doc.text('Location Notes', 40, y); y += 20;
    const exportedNotes = getExportedNotes();
    if (exportedNotes.length > 0) {
      autoTable(doc, {
        head: [['Time', 'Date', 'Recording Day', 'Note']],
        body: exportedNotes.map(n => [
          n.timestamp,
          fmtDate(n.recording_date),
          getRecordingDayDisplay(n),
          n.note
        ]),
        startY: y,
        styles: { fontSize: 9, cellPadding: 4 }
      });
    } else {
      doc.setFontSize(12);
      doc.text('No notes available', 40, y + 20);
    }
    // Get schedule data for the same location
    let schedules = await fetchTableData('schedules', {
      eq: { location_id: props.locationId },
      order: [
        { column: 'recording_date', ascending: true },
        { column: 'start_time', ascending: true }
      ]
    });
    // Filter schedules by recording day if a specific one is selected (not 'all')
    if (recordingDayFilter.value && recordingDayFilter.value !== 'all') {
      if (recordingDayFilter.value === 'unassigned') {
        schedules = schedules.filter(s => !s.stage_hour_id);
      } else {
        schedules = schedules.filter(s => s.stage_hour_id === recordingDayFilter.value);
      }
    }
    // Filter schedules by range
    if (exportWholeDay.value && exportWholeDayDate.value) {
      const d = exportWholeDayDate.value;
      const start = new Date(`${d}T00:00:00`);
      const end = new Date(`${d}T23:59:59`);
      schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) >= start && new Date(`${s.recording_date}T${s.start_time}`) <= end);
    } else {
      if (exportRangeStart.value) {
        const start = new Date(exportRangeStart.value);
        schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) >= start);
      }
      if (exportRangeEnd.value) {
        const end = new Date(exportRangeEnd.value);
        schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) <= end);
      }
    }
    // Add schedule table on new page if schedules exist
    if (schedules.length > 0) {
      doc.addPage();
      let y2 = 40;
      doc.setFontSize(14);
      if (projectName) { doc.text(`Project: ${projectName}`, 40, y2); y2 += 20; }
      if (venueName) { doc.text(`Venue: ${venueName}`, 40, y2); y2 += 20; }
      if (stageName) { doc.text(`Stage: ${stageName}`, 40, y2); y2 += 20; }
      if (author) { doc.text(`Author: ${author}`, 40, y2); y2 += 20; }
      doc.text(`Exported at: ${exportedAt}`, 40, y2); y2 += 20;
      if (dateRange) { doc.text(`Date Range: ${dateRange}`, 40, y2); y2 += 20; }
      y2 += 10;
      doc.setFontSize(16);
      doc.text('Stage Schedule', 40, y2); y2 += 20;
      autoTable(doc, {
        head: [['Artist', 'Start Time', 'End Time', 'Date']],
        body: schedules.map(s => [
          s.artist_name,
          s.start_time?.slice(0, 5) || '',
          s.end_time?.slice(0, 5) || '',
          s.recording_date
        ]),
        startY: y2,
        styles: { fontSize: 9, cellPadding: 4 }
      });
    }
    doc.save(exportFilename.value || `location-notes-${props.locationId}.pdf`);
    saveExportPrefs();
    toast.success('PDF exported successfully');
    closeExportModal();
  } catch (error) {
    console.error('Export error:', error);
    toast.error('Failed to export PDF');
  }
}

// CSV Export with header section
async function doExportCsv() {
  try {
    // Get project, venue, stage/location name, author, and timestamp
    let projectName = '';
    let stageName = '';
    let venueName = '';
    let author = '';
    let exportedAt = new Date().toLocaleString();
    try {
      const store = useUserStore();
      projectName = store.getCurrentProject?.name || store.getCurrentProject?.project_name || '';
      author = store.getUserEmail || '';
    } catch {}
    if (typeof location !== 'undefined' && location.value) {
      venueName = location.value.venue_name || '';
      stageName = location.value.stage_name || '';
    }
    // Date range
    let dateRange = '';
    if (exportWholeDay.value && exportWholeDayDate.value) {
      const d = new Date(exportWholeDayDate.value);
      const label = d.toLocaleDateString([], { year:'numeric', month:'short', day:'numeric' });
      dateRange = `${label} (00:00–23:59:59)`;
    } else if (exportRangeStart.value || exportRangeEnd.value) {
      const fmt = (iso) => new Date(iso).toLocaleString([], { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const startLbl = exportRangeStart.value ? fmt(exportRangeStart.value) : '…';
      const endLbl   = exportRangeEnd.value ? fmt(exportRangeEnd.value)     : '…';
      dateRange = `${startLbl} → ${endLbl}`;
    }
    // Notes table
    const exportedNotes = getExportedNotes();
    let csv = '';
    // Header section
    if (projectName) csv += `Project:,${projectName}\n`;
    if (venueName) csv += `Venue:,${venueName}\n`;
    if (stageName) csv += `Stage:,${stageName}\n`;
    if (author) csv += `Author:,${author}\n`;
    csv += `Exported at:,${exportedAt}\n`;
    if (dateRange) csv += `Date Range:,${dateRange}\n`;
    csv += '\n';
    // Notes table
    csv += 'Time,Date,Recording Day,Note\n';
    exportedNotes.forEach(n => {
      csv += `"${n.timestamp}","${fmtDate(n.recording_date)}","${getRecordingDayDisplay(n)}","${(n.note || '').replace(/"/g, '""')}"\n`;
    });
    // Get schedule data for the same location
    let schedules = await fetchTableData('schedules', {
      eq: { location_id: props.locationId },
      order: [
        { column: 'recording_date', ascending: true },
        { column: 'start_time', ascending: true }
      ]
    });
    // Filter schedules by recording day if a specific one is selected (not 'all')
    if (recordingDayFilter.value && recordingDayFilter.value !== 'all') {
      if (recordingDayFilter.value === 'unassigned') {
        schedules = schedules.filter(s => !s.stage_hour_id);
      } else {
        schedules = schedules.filter(s => s.stage_hour_id === recordingDayFilter.value);
      }
    }
    // Filter schedules by range
    if (exportWholeDay.value && exportWholeDayDate.value) {
      const d = exportWholeDayDate.value;
      const start = new Date(`${d}T00:00:00`);
      const end = new Date(`${d}T23:59:59`);
      schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) >= start && new Date(`${s.recording_date}T${s.start_time}`) <= end);
    } else {
      if (exportRangeStart.value) {
        const start = new Date(exportRangeStart.value);
        schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) >= start);
      }
      if (exportRangeEnd.value) {
        const end = new Date(exportRangeEnd.value);
        schedules = schedules.filter(s => new Date(`${s.recording_date}T${s.start_time}`) <= end);
      }
    }
    if (schedules.length > 0) {
      csv += '\n';
      // Schedule header section
      if (projectName) csv += `Project:,${projectName}\n`;
      if (venueName) csv += `Venue:,${venueName}\n`;
      if (stageName) csv += `Stage:,${stageName}\n`;
      if (author) csv += `Author:,${author}\n`;
      csv += `Exported at:,${exportedAt}\n`;
      if (dateRange) csv += `Date Range:,${dateRange}\n`;
      csv += '\n';
      csv += 'Artist,Start Time,End Time,Date\n';
      schedules.forEach(s => {
        csv += `"${s.artist_name}","${s.start_time?.slice(0, 5) || ''}","${s.end_time?.slice(0, 5) || ''}","${s.recording_date}"\n`;
      });
    }
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', (exportFilename.value || `location-notes-${props.locationId}.csv`).replace(/\.pdf$/, '.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
    saveExportPrefs();
    closeExportModal();
  } catch (error) {
    console.error('Export error:', error);
    toast.error('Failed to export CSV');
  }
}

async function manualSync() {
  if (!isOnline.value) {
    toast.warning('Cannot sync while offline');
    return;
  }

  if (isSyncing.value) {
    toast.info('Sync already in progress');
    return;
  }

  isSyncing.value = true;
  try {
    await syncOfflineChanges();
    await loadNotes();
    await checkPendingChanges();
    toast.success('Sync complete');
  } catch (error) {
    console.error('Sync error:', error);
    toast.error('Sync failed');
  } finally {
    isSyncing.value = false;
  }
}

async function checkPendingChanges() {
  hasPendingSync.value = await hasPendingChanges();
}

// Ensure data persistence across navigation and refreshes
async function loadLocation() {
  try {
    const res = await fetchTableData('locations', { eq: { id: props.locationId } });
    if (res.length) {
      location.value = res[0];
    } else {
      // Try to get from cache
      const all = await getData('locations');
      location.value = all.find(x => String(x.id) === props.locationId);
    }
  } catch (error) {
    console.error('Error loading location:', error);
  }
}

async function ensureDataPersistence() {
  try {
    // Always load from local storage first for immediate display
    const localNotes = await getData('notes');
    const filteredNotes = localNotes.filter(note => note.location_id === props.locationId);
    
    if (filteredNotes.length > 0) {
      notes.value = filteredNotes;
      console.log(`[ensureDataPersistence] Loaded ${filteredNotes.length} cached notes`);
    }
    
    // Then try to fetch fresh data if online
    if (isOnline.value) {
      await loadNotes();
    }
  } catch (error) {
    console.error('Error ensuring data persistence:', error);
  }
}

onMounted(async () => {
  if (!hasLoaded.value) {
    await ensureDataPersistence();
    await loadPills();
    await loadStageHours();
    await loadLocation();
    await checkPendingChanges();
    hasLoaded.value = true;
  }
});

// Expose refresh method for parent component
defineExpose({
  refresh: async () => {
    await loadNotes();
    await checkPendingChanges();
  }
});

function showInfoModal(note) {
  infoNote.value = note;
  showInfo.value = true;
}
function closeInfoModal() {
  showInfo.value = false;
  infoNote.value = null;
}

function refreshTimestamp() {
  draft.value.timestamp = nowTime();
}

function setTodayRange() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  rangeStart.value = `${yyyy}-${mm}-${dd}T00:00`;
  rangeEnd.value = `${yyyy}-${mm}-${dd}T23:59`;
}

function setPrevDayRange() {
  const today = new Date();
  const prev = new Date(today);
  prev.setDate(today.getDate() - 1);
  const yyyy = prev.getFullYear();
  const mm = String(prev.getMonth() + 1).padStart(2, '0');
  const dd = String(prev.getDate()).padStart(2, '0');
  rangeStart.value = `${yyyy}-${mm}-${dd}T00:00`;
  rangeEnd.value = `${yyyy}-${mm}-${dd}T23:59`;
}
</script>

<style scoped>
.note-status-dot {
font-size: 16px;
margin-left: 6px;
}

/* Status indicators */
.header-left {
display: flex;
align-items: center;
gap: 12px;
}

.status-indicators {
display: flex;
align-items: center;
gap: 8px;
}

.sync-icon {
font-size: 14px;
font-weight: bold;
display: inline-flex;
align-items: center;
justify-content: center;
width: 16px;
height: 16px;
border-radius: 50%;
}

.sync-icon.online {
color: var(--text-inverse) !important;
background-color: var(--color-success-500) !important;
}

.sync-icon.offline {
color: var(--text-inverse) !important;
background-color: var(--color-error-500) !important;
}

.sync-icon.pending {
color: var(--text-inverse) !important;
background-color: var(--color-warning-500) !important;
animation: pulse 2s infinite;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.5; }
}

.notes-pane {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 16px;
  color: var(--text-primary);
  font-family: var(--font-family-sans);
  max-width: 1000px;
  margin: 0 auto;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 12px;
  font-size: 0.9rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn {
  background: var(--color-success-500);
  color: var(--text-inverse);
}

.add-btn:hover {
  background: var(--color-success-600);
}

.export-btn {
  background: var(--color-warning-500);
  color: var(--text-inverse);
  border: 1px solid var(--color-warning-600);
}

.export-btn:hover {
  background: var(--color-warning-600);
}

.sync-btn {
  background: var(--color-success-500);
  color: var(--text-inverse);
}

.sync-btn:hover {
background: var(--color-success-600);
}

.sync-btn:disabled {
background: var(--color-secondary-500);
color: var(--text-inverse);
cursor: not-allowed;
}

.sync-btn:disabled:hover {
background: var(--color-secondary-500);
}

.sync-btn:disabled {
opacity: 0.6;
}

.quickfire-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.label {
  font-weight: 600;
  color: var(--text-secondary);
}

.pills-container {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  --pill-bg: var(--bg-secondary); /* Default uses theme, overridden inline */
  --pill-fg: var(--text-primary); /* Default uses theme, overridden inline */
  padding: 4px 12px;
  border: none;
  border-radius: 14px;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  background-color: var(--pill-bg) !important;
  color: var(--pill-fg) !important;
}

.pill:hover {
  /* Maintain background and text color on hover */
  background-color: var(--pill-bg) !important;
  color: var(--pill-fg) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.notes-controls { margin: 0 auto 20px auto; max-width: 1100px; }
.controls-row {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
}
.controls-row.top { margin-bottom: 12px; }
.sort-wrap { display: flex; align-items: center; gap: 8px; }
.spacer { flex: 1; }
.filter-col {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.sort-col {
  min-width: 180px;
  max-width: 260px;
  flex: 1 1 180px;
}
.date-col {
  min-width: 220px;
  max-width: 340px;
  flex: 1 1 220px;
  gap: 0.4em;
}
.date-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.recording-day-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 16px;
}

.recording-day-filter-select {
  max-width: 180px;
  min-width: 120px;
  width: 100%;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  padding: 8px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: none;
  transition: border-color 0.2s;
}

.recording-day-filter-select:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  outline: none;
}

.label {
  min-width: 38px;
  margin-right: 4px;
}
.sort-select, .date-range-input {
  max-width: 220px;
  min-width: 140px;
  width: 100%;
  margin-right: 0;
  border: 2px solid var(--border-medium) !important;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.sort-select:focus, .date-range-input:focus {
  border-color: var(--color-primary-500) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), var(--shadow-sm);
  outline: none;
}
@media (max-width: 900px) {
  .controls-row { flex-wrap: wrap; }
}
@media (min-width: 1024px) {
  .controls-row.top { flex-wrap: nowrap; }
  .quick-range-btns { margin-top: 0; }
}
@media (max-width: 768px) {
  .notes-table-wrapper {
    width: 100%;
    max-width: 100%;
  }
  .note-datetime-header,
  .note-datetime {
    width: 25%;
    min-width: 100px;
    word-break: break-word;
  }
  .note-text-header,
  .note-text {
    width: 35%;
    word-break: break-word;
  }
  .note-recording-day-header,
  .note-recording-day {
    width: 20%;
    min-width: 80px;
    word-break: break-word;
  }
  .note-actions-header,
  .note-actions {
    width: 20%;
    min-width: 100px;
  }
}

/* Mobile stacking for top controls */
@media (max-width: 640px) {
  .controls-row.top {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .quick-range-btns {
    align-self: stretch;
    justify-content: space-between;
  }
}

@media (max-width: 600px) {
  .controls-row { flex-direction: column; align-items: stretch; }
  .date-col {
    gap: 0.4em;
  }
  .date-row {
    margin-bottom: 4px;
  }
  .notes-pane {
    padding: 16px;
  }
  .notes-table-wrapper {
    width: 100%;
    max-width: 100%;
  }
}

/* Spreadsheet-like table view */
.notes-table-wrapper {
  width: 100%;
  max-width: 100%;
  margin-bottom: 32px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  overflow: hidden;
}
.notes-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.notes-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  font-size: 0.95rem;
  table-layout: fixed;
  max-width: 100%;
}
/* prevent column collapse on very small screens */
@media (max-width: 768px) {
  .notes-table {
    min-width: 720px;
  }
}

/* Stack time and date on small screens to avoid overlap */
@media (max-width: 640px) {
  .datetime-combined { flex-direction: column; align-items: flex-start; gap: 2px; }
  .datetime-separator { display: none; }
}

/* Optional: cap table height on small screens for better ergonomics */
@media (max-width: 640px) {
  .notes-table-scroll {
    max-height: 60vh;
    overflow-y: auto;
  }
}
.notes-table th, .notes-table td {
  padding: 12px 20px;
  border-bottom: 2px solid var(--border-light);
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}
.notes-table th {
  background: var(--bg-secondary);
  font-weight: 700;
  color: var(--text-heading);
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 3px solid var(--color-primary-500);
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
}
.notes-table tr:last-child td {
  border-bottom: none;
}
.notes-table tbody tr {
  transition: all 0.2s ease;
}
.notes-table tbody tr:hover {
  background: var(--bg-secondary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.note-datetime-header,
.note-datetime {
  font-size: 0.9rem;
  width: 20%;
  min-width: 140px;
  white-space: nowrap;
  word-break: break-word;
}
.datetime-combined {
  display: flex;
  align-items: center;
  gap: 4px;
}
.note-time {
  font-weight: 600;
  color: var(--color-primary-500);
  font-size: 0.9rem;
}
.note-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.datetime-separator {
  color: var(--text-tertiary);
  font-weight: 400;
}
.note-text-header,
.note-text {
  white-space: pre-line;
  word-break: break-word;
  width: 40%;
  font-size: 0.9rem;
  line-height: 1.4;
}

.note-recording-day-header,
.note-recording-day {
  width: 20%;
  min-width: 120px;
  font-size: 0.85rem;
  text-align: center;
  color: var(--text-secondary);
  word-break: break-word;
}

.note-actions-header,
.note-actions {
  display: flex;
  gap: 12px;
  width: 20%;
  min-width: 120px;
  justify-content: center;
}

/* Ensure header cells have proper alignment */
.note-datetime-header {
  text-align: left;
}

.note-text-header {
  text-align: left;
}

.note-recording-day-header {
  text-align: center !important;
}

.note-actions-header {
  text-align: center !important;
}
.icon-btn {
  width: 44px;
  height: 44px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 18px;
  margin: 0 1px;
  color: var(--text-inverse) !important;
}
.icon-btn.edit {
  background: var(--color-warning-500) !important;
  color: var(--text-inverse) !important;
}
.icon-btn.edit:hover {
  background: var(--color-warning-600) !important;
}
.icon-btn.del,
.icon-btn.delete {
  background: var(--color-error-500) !important;
  color: var(--text-inverse) !important;
}
.icon-btn.del:hover,
.icon-btn.delete:hover {
  background: var(--color-error-600) !important;
}
.icon-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.date-range-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.date-range-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.date-range-input {
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.97rem;
  flex: 1 1 auto;
  min-width: 120px;
}
.reset-btn {
  background: var(--color-error-500);
  color: var(--text-inverse);
  border: 2px solid var(--color-error-600);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 8px;
  box-shadow: var(--shadow-sm);
}
.reset-btn:hover {
  background: var(--color-error-600);
}
@media (max-width: 600px) {
  .date-range-section {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    margin-bottom: 6px;
  }
  .date-range-input-row {
    gap: 2px;
  }
  .date-range-input {
    font-size: 0.95rem;
    padding: 5px 6px;
    min-width: 0;
    width: 100%;
  }
  .reset-btn {
    width: 26px;
    height: 26px;
    font-size: 15px;
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1050);
}

.modal-content {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 8px;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--border-light);
}

.modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.time-input,
.date-input,
.note-input {
  width: 100%;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  padding: 8px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.recording-day-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.recording-day-select {
  width: 100%;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  padding: 8px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.note-input {
  resize: vertical;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  background: var(--color-warning-500);
  color: var(--text-inverse);
  border: 1px solid var(--color-warning-600);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn {
  background: var(--color-success-500);
  color: var(--text-inverse);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.save-btn:hover {
  background: var(--color-success-600);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  margin-top: 16px;
  font-size: 0.95rem;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .notes-pane {
    padding: 16px;
  }
  
  .header-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .sort-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .sort-select {
    min-width: auto;
  }
  
  .note-meta {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .modal-content {
    width: 95%;
    padding: 16px;
  }
  
  .modal-grid {
    grid-template-columns: 1fr;
  }
}

.icon-btn.info {
  background: var(--color-primary-600);
  color: var(--text-inverse);
}
.icon-btn.info:hover {
  background: var(--color-primary-700);
}
.icon-btn {
  color: var(--text-inverse) !important;
}
.icon-btn svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

.export-filename-input {
  padding: 6px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  min-width: 180px;
  width: 100%;
}

.timestamp-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.refresh-btn {
  background: var(--color-warning-500);
  color: var(--text-inverse);
  border: 1px solid var(--color-warning-600);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.2s;
}
.refresh-btn:hover {
  background: var(--color-warning-600);
}

/* Today and Previous Day button styles are now handled by btn btn-primary classes */

.quick-range-btns {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  align-self: flex-end;
}

/* High-contrast primary buttons for Today / Previous Day */
.btn.btn-primary {
  background-color: var(--color-primary-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-primary-700) !important;
  font-weight: 700;
}
.btn.btn-primary,
.btn.btn-primary * {
  color: var(--text-inverse) !important;
}
.btn.btn-primary:hover {
  background-color: var(--color-primary-700) !important;
}
.btn.btn-primary:focus {
  outline: 3px solid rgba(29, 78, 216, 0.35);
  outline-offset: 2px;
}
.btn.btn-primary svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

/* High-contrast positive and warning buttons (New Note, Export, Save) */
.btn.btn-positive {
  background-color: var(--color-success-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-success-700) !important;
  font-weight: 700;
}
.btn.btn-positive,
.btn.btn-positive * {
  color: var(--text-inverse) !important;
}
.btn.btn-positive:hover { background-color: var(--color-success-700) !important; }
.btn.btn-positive:focus { outline: 3px solid rgba(4,120,87,.35); outline-offset: 2px; }
.btn.btn-positive svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

.btn.btn-warning {
  background-color: var(--color-warning-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-warning-600) !important;
  font-weight: 700;
}
.btn.btn-warning,
.btn.btn-warning * {
  color: var(--text-inverse) !important;
}
.btn.btn-warning:hover { background-color: var(--color-warning-600) !important; }
.btn.btn-warning:focus { outline: 3px solid rgba(217,119,6,.35); outline-offset: 2px; }
.btn.btn-warning svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

.btn.btn-danger {
  background-color: var(--color-error-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-error-600) !important;
  font-weight: 700;
}
.btn.btn-danger,
.btn.btn-danger * {
  color: var(--text-inverse) !important;
}
.btn.btn-danger:hover { background-color: var(--color-error-600) !important; }
.btn.btn-danger:focus { outline: 3px solid rgba(239,68,68,.35); outline-offset: 2px; }
.btn.btn-danger svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}

/* Stage Hours Button */
.stage-hours-btn {
  flex-shrink: 0;
}

.stage-hours-button {
  background: var(--color-primary-600);
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-primary-700);
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}
.stage-hours-button,
.stage-hours-button * {
  color: var(--text-inverse) !important;
}

.stage-hours-button:hover {
  background: var(--color-primary-700);
  border-color: var(--color-primary-800);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}

/* Stage Hours Modal */
.stage-hours-modal {
  max-width: 700px;
  max-height: 80vh;
}

.stage-hours-list {
  max-height: 60vh;
  overflow-y: auto;
}

.stage-hour-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.stage-hour-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stage-hour-label {
  font-weight: 600;
  color: var(--text-heading);
}

.stage-hour-dates {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.edit-stage-hour-btn {
  background: var(--color-warning-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.8rem;
  cursor: pointer;
}

.edit-stage-hour-btn:hover {
  background: var(--color-warning-600);
}

.stage-hour-times {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.time-separator {
  color: var(--text-tertiary);
  font-weight: 500;
}

.stage-hour-edit {
  background: rgba(251, 191, 36, 0.15);
  border: 2px solid var(--color-warning-500);
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.form-row input {
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-row input:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  outline: none;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.add-stage-hour-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-medium);
  text-align: center;
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

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state p {
  margin-bottom: 16px;
  font-size: 1.1rem;
}
</style> 