<template>
<transition name="fade">
  <div v-if="visible" class="modal-overlay">
    <div class="modal-content">
      <button class="close-button" @click="$emit('close')">×</button>
      <h2 class="modal-title">{{ stage.stage_name }}</h2>
      
      <!-- Show Times / Managing Hours Section -->
      <div v-if="stageHours.length > 0" class="stage-hours-section">
        <div class="hours-header-with-status">
          <h3 class="hours-title">Show Times / Managing Hours</h3>
          <div class="hours-controls">
            <button class="gear-button" @click="toggleHoursManagement" :title="showHoursManagement ? 'Hide Hours Management' : 'Manage Hours'">
              <span class="gear-icon">⚙️</span>
            </button>
            <div class="live-status-indicator" :class="{ 'live': isStageLive, 'scheduled': !isStageLive }">
              <span class="status-dot"></span>
              <span class="status-text">{{ isStageLive ? 'LIVE' : 'SCHEDULED' }}</span>
            </div>
          </div>
        </div>
        <div class="hours-list">
          <div v-for="hour in upcomingStageHours" :key="hour.id" class="hour-item">
            <div class="time-range">{{ formatTimeWithDate(hour.start_datetime) }} > {{ formatTimeWithDate(hour.end_datetime) }}</div>
            <div v-if="hour.notes" class="hour-notes">{{ hour.notes }}</div>
          </div>
        </div>
        <!-- Inline Hours Management directly below the section -->
        <div v-if="showHoursManagement" class="hours-management-section">
          <div class="hours-header">
            <h3 class="hours-title">Stage Hours & Timeslots</h3>
            <button class="add-hours-btn" @click="openAddEditSlotModal">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Add Slot</span>
            </button>
          </div>
          <div v-if="stageHours.length > 0" class="hours-table-container">
            <table class="hours-table">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>End</th>
                  <th>Day ID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hour in sortedStageHours" :key="hour.id" :class="{ 'past-hour': isPastHour(hour) }">
                  <td>{{ formatDateTime(hour.start_datetime) }}</td>
                  <td>{{ formatDateTime(hour.end_datetime) }}</td>
                  <td>{{ hour.notes || '-' }}</td>
                  <td>
                    <span class="hour-status" :class="{ 'past': isPastHour(hour), 'future': !isPastHour(hour) }">
                      {{ isPastHour(hour) ? 'Past' : 'Scheduled' }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="icon-action" @click="openAddEditSlotModal(hour)" title="Edit">
                      <span class="icon">✏️</span>
                    </button>
                    <button class="icon-action delete" @click="deleteSlot(hour)" title="Delete">
                      <span class="icon">🗑️</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="no-hours">
            <p>No hours recorded for this stage.</p>
          </div>
        </div>
      </div>
      
      <div class="menu-list">
        <button class="menu-item" @click="goTo('notes')">
          <span class="emoji">📝</span> Notes
        </button>
        <button class="menu-item" @click="goTo('schedule')">
          <span class="emoji">🎤</span> Artist Schedule
        </button>
        <button class="menu-item" @click="goToStageContacts">
          <span class="emoji">👥</span> Stage Contacts
        </button>
        <button class="menu-item" @click="goTo('gear')">
          <span class="emoji">🎸</span> Gear
        </button>
        <button class="menu-item" @click="goTo('signal')">
          <span class="emoji">🗺️</span> Signal Mapper
        </button>
        <button class="menu-item" @click="goTo('photos')">
          <span class="emoji">🖼️</span> Photos
        </button>
        <button class="menu-item" @click="goTo('docs')">
          <span class="emoji">📄</span> Documents
        </button>
        <button class="menu-item" @click="goTo('calendar')">
          <span class="emoji">📆</span> Calendar
        </button>
      </div>
      
      
      
      <!-- Add/Edit Slot Modal -->
      <transition name="fade">
        <div v-if="showAddEditSlotModal" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>{{ editingSlot ? 'Edit' : 'Add' }} Hours for {{ stage.stage_name }}</h2>
              <button class="close-button" @click="closeAddEditSlotModal">×</button>
            </div>
            <div class="modal-body">
              <div class="form-field">
                <label>Start Date & Time</label>
                <input type="datetime-local" v-model="slotForm.start_datetime" />
              </div>
              <div class="form-field">
                <label>End Date & Time</label>
                <input type="datetime-local" v-model="slotForm.end_datetime" />
              </div>
              <div class="form-field">
                <label>Recording Day ID</label>
                <input type="text" v-model="slotForm.notes" placeholder="e.g., 1, 2, 3, 4" />
              </div>
              <div class="form-actions">
                <button class="primary-button save-button" @click="saveSlot">Save</button>
                <button class="secondary-button" @click="closeAddEditSlotModal">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</transition>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../../supabase';

const props = defineProps({
stage: { type: Object, required: true },
projectId: { type: [String, Number], required: true },
visible: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
const router = useRouter();

const stageHours = ref([]);
const isStageLive = ref(false);
const nextTimeslot = ref(null);
const showHoursManagement = ref(false);
const showAddEditSlotModal = ref(false);
const editingSlot = ref(null);
const slotForm = ref({
  start_datetime: '',
  end_datetime: '',
  notes: ''
});

onMounted(async () => {
  await loadStageHours();
  checkLiveStatus();
  findNextTimeslot();
});

// Computed property for sorted stage hours
const sortedStageHours = computed(() => {
  return [...stageHours.value].sort((a, b) => 
    new Date(a.start_datetime) - new Date(b.start_datetime)
  );
});

// Upcoming hours: anything that hasn't ended yet (includes current + future)
const upcomingStageHours = computed(() => {
  const now = new Date();
  return [...stageHours.value]
    .filter(h => new Date(h.end_datetime) > now)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
});

// Helper function to check if an hour is in the past
function isPastHour(hour) {
  const now = new Date();
  const endTime = new Date(hour.end_datetime);
  return endTime < now;
}

async function loadStageHours() {
  try {
    const { data, error } = await supabase
      .from('stage_hours')
      .select('*')
      .eq('stage_id', props.stage.id)
      .order('start_datetime', { ascending: true });

    if (error) {
      console.error('Error loading stage hours:', error);
      return;
    }

    stageHours.value = data || [];
  } catch (err) {
    console.error('Unexpected error loading stage hours:', err);
  }
}

function formatTime(datetime) {
  if (!datetime) return '';
  const d = new Date(datetime);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTimeWithDate(datetime) {
  if (!datetime) return '';
  const d = new Date(datetime);
  const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

function checkLiveStatus() {
  const now = new Date();
  isStageLive.value = stageHours.value.some(hour => {
    const startTime = new Date(hour.start_datetime);
    const endTime = new Date(hour.end_datetime);
    return startTime <= now && now < endTime;
  });
}

function findNextTimeslot() {
  const now = new Date();
  const futureHours = stageHours.value
    .filter(hour => new Date(hour.start_datetime) > now)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  
  nextTimeslot.value = futureHours.length > 0 ? futureHours[0] : null;
}

function formatNextTimeslot(timeslot) {
  if (!timeslot) return '';
  const startDate = new Date(timeslot.start_datetime);
  const endDate = new Date(timeslot.end_datetime);
  
  const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  
  return `${date} ${startTime}-${endTime}`;
}

function toggleHoursManagement() {
  showHoursManagement.value = !showHoursManagement.value;
}

function openAddEditSlotModal(slot = null) {
  editingSlot.value = slot;
  showAddEditSlotModal.value = true;
  if (slot) {
    slotForm.value = {
      start_datetime: toLocalInputValue(slot.start_datetime),
      end_datetime: toLocalInputValue(slot.end_datetime),
      notes: slot.notes || ''
    };
  } else {
    slotForm.value = {
      start_datetime: '',
      end_datetime: '',
      notes: ''
    };
  }
}

function closeAddEditSlotModal() {
  showAddEditSlotModal.value = false;
  editingSlot.value = null;
  slotForm.value = { start_datetime: '', end_datetime: '', notes: '' };
}

async function saveSlot() {
  if (!props.stage) return;
  const payload = {
    project_id: props.projectId,
    stage_id: props.stage.id,
    start_datetime: toUTCISOString(slotForm.value.start_datetime),
    end_datetime: toUTCISOString(slotForm.value.end_datetime),
    notes: slotForm.value.notes
  };
  try {
    if (editingSlot.value) {
      // Update
      const { error } = await supabase
        .from('stage_hours')
        .update(payload)
        .eq('id', editingSlot.value.id);
      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('stage_hours')
        .insert([payload]);
      if (error) throw error;
    }
    await loadStageHours();
    checkLiveStatus();
    findNextTimeslot();
    closeAddEditSlotModal();
  } catch (e) {
    alert('Failed to save: ' + e.message);
  }
}

async function deleteSlot(slot) {
  if (!confirm('Delete this slot?')) return;
  try {
    const { error } = await supabase
      .from('stage_hours')
      .delete()
      .eq('id', slot.id);
    if (error) throw error;
    await loadStageHours();
    checkLiveStatus();
    findNextTimeslot();
  } catch (e) {
    alert('Failed to delete: ' + e.message);
  }
}

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// Helper functions for converting between local and UTC
function toLocalInputValue(utcString) {
  const d = new Date(utcString);
  // Adjust for timezone offset
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toUTCISOString(localString) {
  // localString: 'YYYY-MM-DDTHH:mm'
  const d = new Date(localString);
  return d.toISOString();
}

function goTo(type) {
const id = props.projectId;
const s = props.stage;
if (!s) return;
if (type === 'notes') {
  router.push({ name: 'LocationNotes', params: { id, locationId: s.id } });
} else if (type === 'signal') {
  router.push({ name: 'SignalMapper', params: { id }, query: { venueId: s.venue_id, stageId: s.id, locationId: s.id } });
} else if (type === 'gear') {
  router.push({ name: 'ProjectGear', params: { id }, query: { locationId: s.id } });
} else if (type === 'photos') {
  router.push({ name: 'StagePictures', params: { id }, query: { venueId: s.venue_id, stageId: s.id } });
} else if (type === 'docs') {
  router.push({ name: 'StageDocs', params: { id }, query: { venueId: s.venue_id, stageId: s.id } });
} else if (type === 'schedule') {
  // Route into Location Notes with schedule tab active for this stage
  router.push({ name: 'LocationNotes', params: { id, locationId: s.id }, query: { tab: 'schedule' } });
} else if (type === 'calendar') {
  const today = new Date().toISOString().slice(0, 10);
  router.push({ name: 'Calendar', params: { id }, query: { locationId: s.id, date: today, view: 'timeline' } });
}
emit('close');
}

function goToStageContacts() {
router.push({
  name: 'ProjectContacts',
  params: { id: props.projectId },
  query: { stage: props.stage.stage_name }
});
emit('close');
}
</script>

<style scoped>
.modal-overlay {
position: fixed;
top: 0; left: 0; right: 0; bottom: 0;
background: rgba(0,0,0,0.18);
display: flex;
align-items: center;
justify-content: center;
z-index: 2000;
}
.modal-content {
background: var(--bg-primary);
border-radius: 12px;
box-shadow: 0 8px 32px rgba(0,0,0,0.18);
padding: 32px 40px 24px 40px;
min-width: 260px;
max-width: 95vw;
width: 100%;
max-height: 90vh;
display: flex;
flex-direction: column;
align-items: stretch;
position: relative;
overflow-y: auto;
}
.close-button {
position: absolute;
top: 12px;
right: 18px;
background: none;
border: none;
font-size: 1.7rem;
cursor: pointer;
color: var(--text-secondary);
border-radius: 6px;
transition: background 0.2s;
padding: 2px 8px;
}
.close-button:hover {
background: var(--bg-secondary);
color: var(--color-primary-600);
}
.modal-title {
text-align: center;
font-size: 1.2rem;
color: var(--text-primary);
font-weight: 600;
margin-bottom: 18px;
}

/* Stage Hours Section */
.stage-hours-section {
margin-bottom: 20px;
padding: 16px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e2e8f0;
}

.hours-title {
font-size: 1rem;
font-weight: 600;
color: var(--text-secondary);
margin: 0 0 12px 0;
text-align: center;
}

.hours-header-with-status {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 12px;
gap: 12px;
}

.hours-controls {
display: flex;
align-items: center;
gap: 8px;
}

.gear-button {
display: flex;
align-items: center;
justify-content: center;
padding: 6px;
background: var(--bg-secondary);
border: 1px solid #e2e8f0;
border-radius: 6px;
cursor: pointer;
transition: all 0.2s ease;
width: 32px;
height: 32px;
}

.gear-button:hover {
background: #e2e8f0;
border-color: #0066cc;
transform: scale(1.05);
}

.gear-button:active {
transform: scale(0.95);
background: var(--border-medium);
}

.gear-icon {
font-size: 1rem;
color: var(--text-secondary);
}

.live-status-indicator {
display: flex;
align-items: center;
gap: 6px;
padding: 4px 8px;
border-radius: 12px;
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.025em;
}

.live-status-indicator.live {
  background: rgba(251, 191, 36, 0.15);
  color: var(--color-warning-700);
  border: 1px solid var(--color-warning-300);
}

.live-status-indicator.scheduled {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-300);
}

/* Dark mode styling for status indicators */
.dark .live-status-indicator.live {
  background: var(--color-warning-700);
  color: var(--text-inverse);
  border: 1px solid var(--color-warning-600);
}

.dark .live-status-indicator.scheduled {
  background: var(--color-primary-700);
  color: var(--text-inverse);
  border: 1px solid var(--color-primary-600);
}

.live-status-indicator .status-dot {
width: 6px;
height: 6px;
border-radius: 50%;
display: inline-block;
}

.live-status-indicator.live .status-dot {
background: var(--color-warning-700);
animation: pulse 2s infinite;
}

.live-status-indicator.scheduled .status-dot {
background: var(--color-primary-700);
}

/* Dark mode status dot colors */
.dark .live-status-indicator.live .status-dot {
  background: var(--text-inverse);
}

.dark .live-status-indicator.scheduled .status-dot {
  background: var(--text-inverse);
}

.hours-list {
display: flex;
flex-direction: column;
gap: 8px;
}

.hour-item {
display: flex;
flex-direction: column;
align-items: center;
padding: 8px 12px;
background: var(--bg-primary);
border-radius: 6px;
border: 1px solid #e5e7eb;
}

.time-range {
font-size: 0.9rem;
font-weight: 600;
color: var(--text-primary);
margin-bottom: 2px;
}

.hour-notes {
font-size: 0.8rem;
color: #6b7280;
text-align: center;
}


@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.5; }
}

/* Hours Management Section */
.hours-management-section {
margin-top: 16px;
padding: 16px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid #e2e8f0;
  /* Ensure it doesn't get clipped inside the modal */
  max-height: none;
  overflow: visible;
}

.hours-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 16px;
}

.hours-title {
font-size: 1rem;
font-weight: 600;
color: var(--text-secondary);
margin: 0;
}

.add-hours-btn {
display: flex;
align-items: center;
gap: 6px;
padding: 8px 12px;
background: var(--color-primary-500);
  color: var(--text-inverse);
border: none;
border-radius: 6px;
font-size: 0.85rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.add-hours-btn:hover {
background: var(--color-primary-600);
transform: translateY(-1px);
}

.add-hours-btn:active {
transform: scale(0.98);
}

.hours-table-container {
overflow-x: auto;
margin-bottom: 16px;
}

.hours-table {
width: 100%;
border-collapse: collapse;
background: var(--bg-primary);
border-radius: 6px;
overflow: hidden;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
font-size: 0.85rem;
}

.hours-table th {
background: var(--bg-secondary);
padding: 8px 12px;
text-align: left;
font-weight: 600;
color: var(--text-secondary);
border-bottom: 1px solid #e2e8f0;
font-size: 0.8rem;
}

.hours-table td {
padding: 8px 12px;
border-bottom: 1px solid #e2e8f0;
color: var(--text-secondary);
font-size: 0.8rem;
}

.hours-table tr:hover {
background: var(--bg-secondary);
}

.hours-table tr.past-hour {
background: #f9fafb;
opacity: 0.8;
}

.hours-table tr.past-hour:hover {
background: #f3f4f6;
}

.hour-status {
display: inline-block;
padding: 2px 8px;
border-radius: 12px;
font-size: 0.75rem;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.025em;
}

.hour-status.past {
background: #fef3c7;
color: #92400e;
border: 1px solid #fde68a;
}

.hour-status.future {
background: #dbeafe;
color: #1e40af;
border: 1px solid #93c5fd;
}

.actions-cell {
display: flex;
gap: 4px;
align-items: center;
}

.icon-action {
display: flex;
align-items: center;
justify-content: center;
padding: 4px;
background: var(--bg-secondary);
border: 1px solid #e2e8f0;
border-radius: 4px;
cursor: pointer;
transition: all 0.2s ease;
min-height: 28px;
min-width: 28px;
}

.icon-action:hover {
background: #e2e8f0;
border-color: #0066cc;
}

.icon-action.delete:hover {
background: #fef2f2;
border-color: #dc3545;
color: #dc3545;
}

.icon {
font-size: 0.75rem;
}

.no-hours {
text-align: center;
color: #6b7280;
font-style: italic;
padding: 20px;
background: var(--bg-primary);
border-radius: 6px;
border: 1px solid #e2e8f0;
}

/* Form Elements */
.form-field {
margin-bottom: 16px;
}

.form-field label {
display: block;
font-weight: 600;
color: var(--text-secondary);
margin-bottom: 6px;
font-size: 0.9rem;
}

.form-field input {
width: 100%;
padding: 8px 12px;
border: 1px solid #d1d5db;
border-radius: 6px;
font-size: 0.9rem;
background: var(--bg-primary);
color: var(--text-secondary);
transition: all 0.2s ease;
}

.form-field input:focus {
outline: none;
border-color: #0066cc;
box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.form-actions {
display: flex;
gap: 8px;
justify-content: flex-end;
margin-top: 16px;
}

.primary-button {
display: inline-flex;
align-items: center;
justify-content: center;
gap: 6px;
padding: 8px 16px;
background: #10b981;
color: #ffffff;
border: none;
border-radius: 6px;
font-size: 0.9rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.primary-button:hover {
background: #059669;
transform: translateY(-1px);
}

.primary-button:active {
transform: scale(0.98);
}

.secondary-button {
display: inline-flex;
align-items: center;
justify-content: center;
gap: 6px;
padding: 8px 16px;
background: #f3f4f6;
color: var(--text-secondary);
border: 1px solid #d1d5db;
border-radius: 6px;
font-size: 0.9rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.secondary-button:hover {
background: #e5e7eb;
border-color: #0066cc;
transform: translateY(-1px);
}

.secondary-button:active {
transform: scale(0.98);
}
.menu-list {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 12px;
margin-top: 8px;
}
.menu-item {
background: var(--bg-secondary);
border: none;
width: 100%;
text-align: center;
padding: 18px 0 12px 0;
font-size: 1rem;
color: var(--text-primary);
border-radius: 10px;
cursor: pointer;
display: flex;
flex-direction: column;
align-items: center;
gap: 0.5em;
transition: background 0.18s, color 0.18s, box-shadow 0.18s;
box-shadow: 0 1px 4px rgba(0,0,0,0.04);
font-weight: 600;
}
.menu-item:hover {
background: #e0e7ef;
color: #2563eb;
box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.emoji {
font-size: 1.6em;
margin-bottom: 4px;
}
/* Tablet and Desktop - 3 columns */
@media (min-width: 768px) {
.modal-content {
  min-width: 400px;
  max-width: 600px;
  padding: 32px 40px 24px 40px;
  max-height: 85vh;
}
.menu-list {
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.menu-item {
  padding: 20px 0 14px 0;
  font-size: 1rem;
}
.emoji {
  font-size: 1.6em;
}
.stage-hours-section {
  padding: 20px;
}
.hours-list {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
.hour-item {
  flex: 0 0 auto;
  min-width: 120px;
}
/* no max-height on desktop */
}

/* Mobile */
@media (max-width: 767px) {
.modal-content {
  min-width: 0;
  padding: 18px 8px 12px 8px;
  max-height: 95vh;
}
.menu-list {
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.menu-item {
  padding: 12px 0 8px 0;
  font-size: 0.97rem;
}
.emoji {
  font-size: 1.3em;
}
/* keep natural height on mobile too */
.hours-management-section { padding: 12px; }
}
.fade-enter-active,
.fade-leave-active {
transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
opacity: 1;
}
</style> 