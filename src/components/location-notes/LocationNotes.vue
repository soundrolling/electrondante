<!-- src/components/location-notes/LocationNotes.vue -->
<template>
<div class="location-notes">
  <div v-if="isLoading" class="load">Loading…</div>
  <div v-if="error" class="alert">{{ error }}</div>

  <main v-if="location && !isLoading && !error">
    <!-- Local page header (breadcrumbs removed; global header handles nav) -->
    <div class="single-row-header">
      <div class="stage-title">
        <h2>{{ location.venue_name }} – {{ location.stage_name }}</h2>
        <p class="subtitle">Notes, schedules & shortcuts for this stage</p>
      </div>
      <div class="timecode-display">
        <strong class="tc">{{ liveTimecode }}</strong>
        <small class="tc-label">{{ currentTimeSourceLabel }}</small>
      </div>
      <div class="sync-status" :class="{ pending: hasPendingSync, offline: !isOnline }" :title="syncStatusText">
        <span class="sync-icon" :class="{ online: isOnline && !hasPendingSync, offline: !isOnline, pending: hasPendingSync }">
          <span v-if="isOnline && !hasPendingSync">✓</span>
          <span v-else-if="!isOnline">⚠</span>
          <span v-else-if="hasPendingSync">⏳</span>
        </span>
        <span class="sync-text">{{ syncStatusText }}</span>
        <button 
          v-if="hasPendingSync && isOnline" 
          class="btn btn-warning mini sync-btn" 
          @click="manualSync"
          :disabled="isSyncing"
        >
          {{ isSyncing ? 'Syncing...' : 'Sync' }}
        </button>
      </div>
      <button class="btn btn-positive mini primary" @click="createNote">New note</button>
    </div>

    <!-- tab buttons -->
    <nav class="tabs">
      <button :class="{ active: activeTab==='notes' }"    @click="activeTab='notes'">Notes</button>
      <button :class="{ active: activeTab==='schedule' }" @click="activeTab='schedule'">Artist Timetable</button>
      <button :class="{ active: activeTab==='quickfire' }" @click="activeTab='quickfire'">Shortcuts</button>
    </nav>
    

    <!-- dynamic tab content wrapped in keep-alive -->
    <keep-alive>
      <div class="tab-content-scroll">
        <component
          :is="ActiveTabComp"
          :location-id="props.locationId"
          :live-timecode="liveTimecode"
          @quick="openQuickfireNote"
          @changeover-note="handleChangeoverNote"
          ref="tabRef"
        />
      </div>
    </keep-alive>
  </main>

  <!-- add-note modal -->
  <div v-if="showNoteInput" class="note-modal">
    <div class="modal-bg" @click="resetNoteForm" />
    <div class="modal-card">
      <h3>Add note</h3>
      <form @submit.prevent="saveNote">
        <label>Timestamp</label>
        <div class="timestamp-row">
          <input :value="copiedTimecode" disabled />
          <button type="button" class="btn btn-warning refresh-btn" @click="refreshTimestamp" title="Set to current time">🔄</button>
        </div>
        <label>Date</label>
        <input type="date" v-model="recordingDate" required />
        <label>Recording Day:</label>
        <select v-model="selectedStageHourId" class="recording-day-select">
          <option value="">None/Unassigned</option>
          <option 
            v-for="stageHour in stageHours" 
            :key="stageHour.id" 
            :value="stageHour.id"
          >
            {{ stageHour.notes || `Day ${stageHour.id.slice(-4)}` }}
          </option>
          <option v-if="stageHours.length === 0" value="" disabled>
            No recording days created yet
          </option>
        </select>
        <div v-if="stageHours.length === 0" class="help-text">
          <small>To create recording days, go to <router-link :to="{ name: 'ProjectLocations', params: { id: store.getCurrentProject?.id } }">Project Locations</router-link> and add stage hours for this location.</small>
        </div>
        <label>Note</label>
        <textarea v-model="newNote" rows="4" required />
        <div class="modal-actions">
          <button type="button" class="btn btn-warning mini" @click="resetNoteForm">Cancel</button>
          <button class="btn btn-positive mini primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>

</div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useUserStore } from '@/stores/userStore';
import { fetchTableData, mutateTableData } from '@/services/dataService';
import { getData, getSetting } from '@/utils/indexedDB';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const props = defineProps({ locationId: { type: String, required: true } });
const router = useRouter();
const route = useRoute();
const toast = useToast();
const store = useUserStore();
const goBack = () => router.back();

const location  = ref(null);
const isLoading = ref(true);
const error     = ref(null);

const activeTab = ref(route.query.tab === 'schedule' ? 'schedule' : (route.query.tab === 'quickfire' ? 'quickfire' : 'notes'));
const tabRef = ref(null);

const Tabs = {
notes: defineAsyncComponent(() => import('./LNTabNotes.vue')),
schedule: defineAsyncComponent(() => import('./LNTabSchedule.vue')),
quickfire: defineAsyncComponent(() => import('./LNTabQuickfire.vue')),
};
const ActiveTabComp = computed(() => Tabs[activeTab.value]);

const liveTimecode = computed(() => store.getLiveTimecode);
const currentTimeSourceLabel = computed(() => store.getCurrentTimeSourceLabel);

const showNoteInput = ref(false);
const newNote = ref('');
const copiedTimecode = ref('');
const recordingDate = ref(new Date().toISOString().slice(0, 10));
const selectedStageHourId = ref('');
const stageHours = ref([]);
const isSubmitting = ref(false);
const hasPendingSync = ref(false);
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const isSyncing = ref(false);

const syncStatusText = computed(() => {
  if (!isOnline.value) {
    return 'Offline - changes will sync when online';
  }
  if (hasPendingSync.value) {
    return 'Pending sync - changes will be uploaded';
  }
  return 'Synced';
});

async function fetchLocation() {
isLoading.value = true;
error.value = null;
try {
  const res = await fetchTableData('locations', { eq: { id: props.locationId } });
  if (res.length) location.value = res[0];
  else throw new Error('No supabase data');
} catch {
  try {
    const all = await getData('locations');
    location.value = all.find(x => String(x.id) === props.locationId);
    if (!location.value) error.value = `Location ${props.locationId} not in cache.`;
  } catch (e) {
    error.value = e.message;
  }
} finally {
  isLoading.value = false;
}
}

async function loadStageHours() {
  try {
    const projectId = await getSetting('current-project-id');
    console.log('Loading stage hours for project:', projectId, 'location:', props.locationId);
    
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
    
    console.log('Loaded stage hours:', stageHours.value);
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
onMounted(async () => {
  await fetchLocation();
  await loadStageHours();
  await checkPendingSync();
  
  // Listen for online/offline events
  const handleOnline = () => {
    isOnline.value = true;
    checkPendingSync();
    // Auto-sync when coming back online if there are pending changes
    if (hasPendingSync.value) {
      setTimeout(() => {
        if (isOnline.value && hasPendingSync.value && !isSyncing.value) {
          manualSync();
        }
      }, 1000);
    }
  };
  
  const handleOffline = () => {
    isOnline.value = false;
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Cleanup
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
});

function createNote() {
copiedTimecode.value = liveTimecode.value;
// Auto-detect the appropriate stage hour based on current time and date
const autoDetectedStageHour = getCurrentStageHour(copiedTimecode.value, recordingDate.value);
selectedStageHourId.value = autoDetectedStageHour || '';
showNoteInput.value = true;
}
// Auto-detect current stage hour based on timestamp and date
function getCurrentStageHour(timestamp, recordingDate) {
  console.log('getCurrentStageHour called with:', { timestamp, recordingDate, stageHoursCount: stageHours.value.length });
  
  if (!stageHours.value.length || !timestamp || !recordingDate) {
    console.log('No stage hours or missing timestamp/date');
    return null;
  }
  
  const noteDateTime = new Date(`${recordingDate}T${timestamp}`);
  console.log('Note datetime:', noteDateTime);
  
  for (const stageHour of stageHours.value) {
    const startDateTime = new Date(stageHour.start_datetime);
    const endDateTime = new Date(stageHour.end_datetime);
    
    console.log('Checking stage hour:', {
      id: stageHour.id,
      notes: stageHour.notes,
      start: startDateTime,
      end: endDateTime,
      noteTime: noteDateTime
    });
    
    // Check if note falls within this stage hour's time range
    if (noteDateTime >= startDateTime && noteDateTime <= endDateTime) {
      console.log('Found matching stage hour:', stageHour.id);
      return stageHour.id;
    }
  }
  
  console.log('No matching stage hour found');
  return null;
}

function openQuickfireNote(preset) {
newNote.value = preset;
copiedTimecode.value = liveTimecode.value;
recordingDate.value = new Date().toISOString().slice(0, 10);
// Auto-detect the appropriate stage hour based on current time and date
const autoDetectedStageHour = getCurrentStageHour(copiedTimecode.value, recordingDate.value);
selectedStageHourId.value = autoDetectedStageHour || '';
showNoteInput.value = true;
activeTab.value = 'notes';
}
function resetNoteForm() {
newNote.value = '';
selectedStageHourId.value = '';
showNoteInput.value = false;
}

async function saveNote() {
if (!newNote.value.trim()) return;
isSubmitting.value = true;
const payload = {
  project_id: store.getCurrentProject?.id,
  location_id: props.locationId,
  note: newNote.value.trim(),
  timestamp: copiedTimecode.value,
  recording_date: recordingDate.value,
  stage_hour_id: selectedStageHourId.value || null,
  creator_email: store.getUserEmail
};
try {
  await mutateTableData('notes', 'insert', payload);
  toast.success('Note saved');
  if (activeTab.value === 'notes') {
    tabRef.value?.refresh?.();
  }
  await checkPendingSync();
  resetNoteForm();
} catch (e) {
  toast.error(e.message);
} finally {
  isSubmitting.value = false;
}
}

async function checkPendingSync() {
  try {
    isOnline.value = navigator.onLine;
    const { hasPendingChanges } = await import('@/services/dataService');
    hasPendingSync.value = await hasPendingChanges();
  } catch (error) {
    console.error('Error checking pending sync:', error);
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
    const { syncOfflineChanges } = await import('@/services/dataService');
    await syncOfflineChanges();
    await checkPendingSync();
    // Refresh the notes tab if it's active
    if (activeTab.value === 'notes') {
      tabRef.value?.refresh?.();
    }
    toast.success('Sync complete');
  } catch (error) {
    console.error('Sync error:', error);
    toast.error('Sync failed');
  } finally {
    isSyncing.value = false;
  }
}

function handleChangeoverNote(note) {
  // Refresh the notes component to show the new changeover note
  if (activeTab.value === 'notes') {
    tabRef.value?.refresh?.();
  } else {
    // Switch to notes tab and refresh
    activeTab.value = 'notes';
    // Use nextTick to ensure the component is mounted before calling refresh
    nextTick(() => {
      tabRef.value?.refresh?.();
    });
  }
  // Check for pending sync after adding changeover note
  checkPendingSync();
}

function refreshTimestamp() {
  copiedTimecode.value = new Date().toTimeString().slice(0, 8);
}
</script>

<style scoped>
.location-notes {
min-height: 100vh;
background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.single-row-header {
background: rgba(255, 255, 255, 0.9);
margin: 16px 24px;
padding: 16px 20px;
border-radius: 12px;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
border: 1px solid rgba(255, 255, 255, 0.3);
backdrop-filter: blur(10px);
display: flex;
align-items: center;
gap: 16px;
flex-wrap: wrap;
}
@media (max-width: 420px) {
  .single-row-header {
    overflow: hidden;
  }
}

.stage-title {
flex: 1;
min-width: 300px;
text-align: center;
}

.stage-hours-btn {
  flex-shrink: 0;
  margin-right: 16px;
}

.stage-hours-button {
  background: #2563eb;
  color: #ffffff !important;
  border: 2px solid #1d4ed8;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
}

.stage-hours-button:hover {
  background: #1d4ed8;
  border-color: #1e40af;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}

.stage-hours-modal {
  max-width: 600px;
  max-height: 80vh;
}

.stage-hours-list {
  max-height: 60vh;
  overflow-y: auto;
}

.stage-hour-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.btn.back {
 background: #e0f2fe;
 color: #0c4a6e;
 border: 1px solid #7dd3fc;
 border-radius: 10px;
 padding: 8px 12px;
 font-size: 0.8rem;
 font-weight: 700;
 flex-shrink: 0;
 white-space: nowrap;
}


.stage-title h2 {
margin: 0 0 2px 0;
font-size: 1.1rem;
font-weight: 700;
color: #1e293b;
line-height: 1.1;
}

.subtitle {
color: #6c7a92;
font-size: 0.75rem;
margin: 0;
line-height: 1.1;
}

.timecode-display {
display: flex;
flex-direction: column;
align-items: center;
gap: 1px;
flex-shrink: 0;
min-width: 70px;
}

.tc {
font-family: monospace;
font-size: 1rem;
font-weight: 700;
color: #1e293b;
line-height: 1;
}

.tc-label {
font-size: 0.65rem;
color: #6c7a92;
line-height: 1;
}

.sync-status {
display: flex;
align-items: center;
gap: 6px;
padding: 6px 12px;
border-radius: 6px;
background: rgba(255, 255, 255, 0.8);
border: 1px solid rgba(255, 255, 255, 0.3);
font-size: 0.85rem;
font-weight: 500;
flex-shrink: 0;
}

.sync-status.pending {
background: rgba(255, 243, 205, 0.9);
border-color: rgba(251, 191, 36, 0.3);
color: #92400e;
}

.sync-status.offline {
background: rgba(254, 226, 226, 0.9);
border-color: rgba(239, 68, 68, 0.3);
color: #dc2626;
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
color: #ffffff !important;
background-color: #10b981 !important; /* green-500 */
}

.sync-icon.offline {
color: #ffffff !important;
background-color: #ef4444 !important; /* red-500 */
}

.sync-icon.pending {
color: #ffffff !important;
background-color: #f59e0b !important; /* amber-500 */
animation: pulse 2s infinite;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.5; }
}

.sync-text {
font-size: 0.8rem;
font-weight: 500;
}

.sync-btn {
  margin-left: 8px;
  padding: 4px 8px;
  font-size: 0.75rem;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.sync-btn:hover:not(:disabled) {
  background: #d97706;
}

.sync-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* Responsive design */
@media (max-width: 768px) {
.single-row-header {
  margin: 12px 16px;
  padding: 12px 16px;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.stage-title {
  text-align: left;
  order: 1;
  min-width: auto;
}

.stage-hours-btn {
  order: 2;
  align-self: flex-start;
  margin-right: 0;
  margin-bottom: 8px;
}

.btn.back {
  order: 3;
  align-self: flex-start;
}

.timecode-display {
  align-items: flex-start;
  order: 4;
}

.sync-status {
  order: 5;
  align-self: flex-start;
}

.single-row-header .btn.mini.primary {
  order: 6;
  align-self: flex-start;
}

.btn.back {
  order: 2;
  align-self: flex-start;
}

.timecode-display {
  align-items: flex-start;
  order: 3;
}

.sync-status {
  order: 4;
  align-self: flex-start;
}

.single-row-header .btn.mini.primary {
  order: 5;
  align-self: flex-start;
}

.stage-title h2 {
  font-size: 1rem;
}

.tc {
  font-size: 0.9rem;
}

.btn.back {
  font-size: 0.75rem;
  padding: 6px 10px;
}
}
.load {
padding: 40px;
text-align: center;
}
.alert {
margin: 16px;
padding: 12px;
background: #ffe8e8;
color: #d92d20;
border-left: 4px solid #d92d20;
border-radius: 8px;
}
.sync-status {
display: flex;
align-items: center;
gap: 4px;
font-size: 0.75rem;
color: #10b981;
font-weight: 500;
}
.sync-status.pending {
color: #f59e0b;
}
.sync-dot {
font-size: 8px;
}
.sync-text {
font-size: 0.7rem;
}
.btn.mini {
background: none;
border: 0;
color: #4a6cf7;
font-size: 0.8rem;
padding: 4px 8px;
}
.btn.mini.primary {
  background: #2563eb; /* blue-600: strong contrast */
  color: #ffffff !important;
  border-radius: 8px;
  border: 2px solid #1d4ed8; /* blue-700 */
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
}
.btn.mini.primary:hover {
  background: #1d4ed8; /* blue-700 */
  border-color: #1e40af; /* blue-800 */
}
.btn.mini.primary:active {
  transform: translateY(0px) scale(0.98);
}
.btn.mini.primary:focus {
  outline: 3px solid rgba(59,130,246,0.5);
  outline-offset: 2px;
}
.tabs {
display: flex;
background: var(--bg-primary);
border-bottom: 1px solid var(--border-light);
position: sticky;
top: 0;
z-index: 20;
backdrop-filter: blur(20px);
box-shadow: var(--shadow-sm);
}
.tabs button {
	flex: 1;
	padding: 16px 0;
	border: 0;
	background: none;
	color: var(--text-secondary);
	font-weight: 700;
	font-size: 0.95rem;
	transition: all 0.2s ease;
}
.tabs button.active {
	color: var(--text-heading);
	position: relative;
	background: rgba(59, 130, 246, 0.14);
}
.tabs button:hover {
	color: var(--text-heading);
	background: rgba(59, 130, 246, 0.12);
}
.tabs button.active::after {
content: '';
position: absolute;
bottom: 0;
left: 0;
width: 100%;
	height: 4px;
	background: var(--color-primary-600);
border-radius: 2px 2px 0 0;
}
.tabs button:focus-visible {
	outline: 3px solid var(--color-primary-600);
	outline-offset: 2px;
	border-radius: 6px;
}
.tab-content-scroll {
  padding: 12px 16px 24px;
}
@media (max-width: 640px) {
  .tab-content-scroll {
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
.note-modal {
position: fixed;
inset: 0;
z-index: 100;
display: flex;
align-items: center;
justify-content: center;
}
.modal-bg {
position: absolute;
inset: 0;
background: rgba(0, 0, 0, 0.4);
}
.modal-card {
position: relative;
background: var(--bg-primary);
border-radius: 12px;
padding: 20px;
width: 90%;
max-width: 420px;
box-shadow: var(--shadow-lg);
display: grid;
gap: 10px;
 max-height: 90vh;
 overflow-y: auto;
 border: 1px solid var(--border-light);
}
.modal-card label {
font-weight: 600;
margin-top: 8px;
color: var(--text-heading);
}
.modal-card input,
.modal-card textarea,
.modal-card select {
width: 100%;
border: 1px solid var(--border-medium);
border-radius: 6px;
padding: 8px;
font-size: 0.9rem;
background: var(--bg-primary);
color: var(--text-primary);
}

.recording-day-select {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.help-text {
  margin-top: 4px;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.help-text a {
  color: var(--text-link);
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}
.modal-actions {
text-align: right;
margin-top: 6px;
}
.modal-actions .btn {
margin-left: 8px;
}
.timestamp-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.refresh-btn {
  background: var(--color-warning-500);
  color: var(--text-primary);
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
  background: #d97706; /* amber-600 */
}
</style>