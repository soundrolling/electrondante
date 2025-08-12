<!-- src/components/location-notes/LocationNotes.vue -->
<template>
<div class="location-notes">
  <!-- top bar -->
  <header class="top-bar">
    <button class="btn back" @click="goBack">← Back</button>
  </header>

  <!-- stage header -->
  <section v-if="location" class="stage-card">
    <h2>{{ location.venue_name }} – {{ location.stage_name }}</h2>
    <p class="subtitle">Notes, schedules & shortcuts for this stage</p>
  </section>

  <div v-if="isLoading" class="load">Loading…</div>
  <div v-if="error" class="alert">{{ error }}</div>

  <main v-if="location && !isLoading && !error">
    <!-- sticky live-timecode strip -->
    <div class="timecode-strip">
      <div class="tc-wrap">
        <strong class="tc">{{ liveTimecode }}</strong>
        <small class="tc-label">{{ currentTimeSourceLabel }}</small>
      </div>
      <div class="tc-actions">
        <div class="sync-status" :class="{ pending: hasPendingSync }" :title="syncStatusText">
          <span class="sync-dot">●</span>
          <span class="sync-text">{{ hasPendingSync ? 'Pending' : 'Synced' }}</span>
        </div>
        <button class="btn mini primary" @click="createNote">New note</button>
      </div>
    </div>

    <!-- tab buttons -->
    <nav class="tabs">
      <button :class="{ active: activeTab==='notes' }"    @click="activeTab='notes'">Notes</button>
      <button :class="{ active: activeTab==='schedule' }" @click="activeTab='schedule'">Schedule</button>
      <button :class="{ active: activeTab==='quickfire' }" @click="activeTab='quickfire'">Shortcuts</button>
    </nav>

    <!-- dynamic tab content wrapped in keep-alive -->
    <keep-alive>
      <component
        :is="ActiveTabComp"
        :location-id="props.locationId"
        :live-timecode="liveTimecode"
        @quick="openQuickfireNote"
        @changeover-note="handleChangeoverNote"
        ref="tabRef"
      />
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
          <button type="button" class="refresh-btn" @click="refreshTimestamp" title="Set to current time">🔄</button>
        </div>
        <label>Date</label>
        <input type="date" v-model="recordingDate" required />
        <label>Note</label>
        <textarea v-model="newNote" rows="4" required />
        <div class="modal-actions">
          <button type="button" class="btn mini" @click="resetNoteForm">Cancel</button>
          <button class="btn mini primary" :disabled="isSubmitting">
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
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useUserStore } from '@/stores/userStore';
import { fetchTableData, mutateTableData } from '@/services/dataService';
import { getData } from '@/utils/indexedDB';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const props = defineProps({ locationId: { type: String, required: true } });
const router = useRouter();
const toast = useToast();
const store = useUserStore();
const goBack = () => router.back();

const location  = ref(null);
const isLoading = ref(true);
const error     = ref(null);

const activeTab = ref('notes');
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
const isSubmitting = ref(false);
const hasPendingSync = ref(false);

const syncStatusText = computed(() => {
  if (hasPendingSync.value) {
    return 'Notes have pending changes that need to sync';
  }
  return 'All notes are synced';
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
onMounted(async () => {
  await fetchLocation();
  await checkPendingSync();
});

function createNote() {
copiedTimecode.value = liveTimecode.value;
showNoteInput.value = true;
}
function openQuickfireNote(preset) {
newNote.value = preset;
copiedTimecode.value = liveTimecode.value;
recordingDate.value = new Date().toISOString().slice(0, 10);
showNoteInput.value = true;
activeTab.value = 'notes';
}
function resetNoteForm() {
newNote.value = '';
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
    const { hasPendingChanges } = await import('@/services/dataService');
    hasPendingSync.value = await hasPendingChanges();
  } catch (error) {
    console.error('Error checking pending sync:', error);
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
background: #f7f9fc;
font-family: Inter, Arial, sans-serif;
}
.top-bar {
position: sticky;
top: 0;
z-index: 30;
background: #fff;
padding: 8px 16px;
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}
.btn.back {
background: #e2e6ea;
border: 0;
border-radius: 8px;
padding: 6px 12px;
font-size: 0.9rem;
}
.stage-card {
background: #fff;
margin: 16px;
padding: 20px;
border-radius: 12px;
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}
.subtitle {
color: #6c7a92;
font-size: 0.9rem;
margin-top: 4px;
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
.timecode-strip {
position: sticky;
top: 56px;
z-index: 25;
background: #fff;
display: flex;
align-items: center;
justify-content: space-between;
padding: 12px 16px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.tc-wrap {
display: flex;
flex-direction: column;
gap: 2px;
}
.tc {
font-family: monospace;
font-size: 1.4rem;
}
.tc-label {
font-size: 0.75rem;
color: #6c7a92;
}
.tc-actions {
display: flex;
gap: 8px;
align-items: center;
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
background: #4a6cf7;
color: #fff;
border-radius: 6px;
}
.tabs {
display: flex;
background: #fff;
border-bottom: 1px solid #e3e7ee;
position: sticky;
top: 104px;
z-index: 20;
}
.tabs button {
flex: 1;
padding: 12px 0;
border: 0;
background: none;
color: #6c7a92;
font-weight: 500;
}
.tabs button.active {
color: #4a6cf7;
position: relative;
}
.tabs button.active::after {
content: '';
position: absolute;
bottom: -1px;
left: 0;
width: 100%;
height: 2px;
background: #4a6cf7;
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
background: #fff;
border-radius: 12px;
padding: 20px;
width: 90%;
max-width: 420px;
box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
display: grid;
gap: 10px;
}
.modal-card label {
font-weight: 600;
margin-top: 8px;
}
.modal-card input,
.modal-card textarea {
width: 100%;
border: 1px solid #ccd1da;
border-radius: 6px;
padding: 8px;
font-size: 0.9rem;
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
  background: #f3f4f6;
  color: #4a6cf7;
  border: none;
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
  background: #e0e7ff;
}
</style>