<template>
<transition name="fade">
  <div v-if="visible" class="modal-overlay">
    <div class="modal-content">
      <button class="close-button" @click="$emit('close')">×</button>
      <div class="stage-selector-container">
        <label for="stage-select" class="stage-select-label">Stage:</label>
        <select 
          id="stage-select"
          v-model="selectedStageId" 
          @change="onStageChange"
          class="stage-select"
        >
          <option 
            v-for="s in stages" 
            :key="s.id" 
            :value="s.id"
          >
            {{ s.stage_name }}
          </option>
        </select>
      </div>
      
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
            <button class="add-hours-btn" @click="openAddEditSlotModal(null)">
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
                <label>Start Date</label>
                <input type="date" v-model="slotForm.start_date" />
              </div>
              <div class="form-field">
                <label>Start Time</label>
                <input type="time" v-model="slotForm.start_time" />
              </div>
              <div class="form-field">
                <label>End Date</label>
                <input type="date" v-model="slotForm.end_date" />
              </div>
              <div class="form-field">
                <label>End Time</label>
                <input type="time" v-model="slotForm.end_time" />
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
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { supabase } from '../../supabase';

const props = defineProps({
stage: { type: Object, required: true },
projectId: { type: [String, Number], required: true },
stages: { type: Array, default: () => [] },
visible: { type: Boolean, default: false },
});

// Watch for prop changes and log for debugging
watch(() => [props.stage, props.projectId], ([stage, projectId]) => {
  if (props.visible) {
    console.log('StageQuickAccessMenu props updated:', {
      stage: stage,
      stageId: stage?.id,
      projectId: projectId,
      hasStage: !!stage,
      hasProjectId: !!projectId
    });
  }
}, { immediate: true });
const emit = defineEmits(['close', 'stage-change']);
const router = useRouter();
const route = useRoute();

const stageHours = ref([]);
const isStageLive = ref(false);
const nextTimeslot = ref(null);
const showHoursManagement = ref(false);
const showAddEditSlotModal = ref(false);
const editingSlot = ref(null);
const slotForm = ref({
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  notes: ''
});

const selectedStageId = ref(null);

// Watch for stage prop changes to update selectedStageId
watch(() => props.stage, async (newStage) => {
  if (newStage) {
    selectedStageId.value = newStage.id;
    await loadStageHours();
    checkLiveStatus();
    findNextTimeslot();
  }
}, { immediate: true });

onMounted(async () => {
  if (props.stage) {
    selectedStageId.value = props.stage.id;
  }
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
  // Validate props before opening modal
  if (!props.stage) {
    alert('Error: Stage information is not available. Please refresh the page.');
    console.error('Cannot open modal: stage is missing', props.stage);
    return;
  }
  
  // Try to get project ID from props or route
  const projectId = props.projectId || route.params.id;
  if (!projectId) {
    alert('Error: Project ID is not available. Please refresh the page.');
    console.error('Cannot open modal: projectId is missing', { propsProjectId: props.projectId, routeId: route.params.id });
    return;
  }
  
  if (!props.stage.id) {
    alert('Error: Stage ID is not available. Please refresh the page.');
    console.error('Cannot open modal: stage.id is missing', props.stage);
    return;
  }
  
  // Explicitly set editingSlot - ensure it's null for new slots
  editingSlot.value = slot && slot.id ? slot : null;
  showAddEditSlotModal.value = true;
  if (slot) {
    // Parse datetime into separate date and time
    const startDate = new Date(slot.start_datetime);
    const endDate = new Date(slot.end_datetime);
    
    slotForm.value = {
      start_date: formatDateForInput(startDate),
      start_time: formatTimeForInput(startDate),
      end_date: formatDateForInput(endDate),
      end_time: formatTimeForInput(endDate),
      notes: slot.notes || ''
    };
  } else {
    // Set default to today and tomorrow
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    slotForm.value = {
      start_date: formatDateForInput(now),
      start_time: '17:00',
      end_date: formatDateForInput(tomorrow),
      end_time: '03:00',
      notes: ''
    };
  }
}

function closeAddEditSlotModal() {
  showAddEditSlotModal.value = false;
  editingSlot.value = null;
  slotForm.value = { start_date: '', start_time: '', end_date: '', end_time: '', notes: '' };
}

async function saveSlot() {
  // Debug logging
  console.log('saveSlot called', { 
    stage: props.stage, 
    projectId: props.projectId,
    routeProjectId: route.params.id,
    stageId: props.stage?.id,
    slotForm: slotForm.value
  });
  
  if (!props.stage) {
    alert('Error: Stage information is missing');
    console.error('Stage is missing:', props.stage);
    return;
  }
  
  // Validate required fields - try props first, then route params as fallback
  let projectId = props.projectId;
  if (!projectId && route.params.id) {
    projectId = route.params.id;
    console.log('Using project ID from route:', projectId);
  }
  
  const stageId = props.stage?.id;
  
  // project_id is a UUID (string), stage_id is a BIGINT (number)
  if (!projectId || projectId === 'undefined' || projectId === undefined || projectId === null || String(projectId).trim() === '') {
    console.error('Project ID validation failed:', projectId, typeof projectId);
    alert('Error: Project ID is missing. Please refresh the page and try again.');
    return;
  }
  
  if (!stageId || stageId === 'undefined' || stageId === undefined || stageId === null || String(stageId).trim() === '') {
    console.error('Stage ID validation failed:', stageId, typeof stageId, 'stage object:', props.stage);
    alert('Error: Stage ID is missing. Please refresh the page and try again.');
    return;
  }
  
  // Combine date and time into datetime strings
  if (!slotForm.value.start_date || !slotForm.value.start_time) {
    alert('Please fill in both start date and time');
    return;
  }
  if (!slotForm.value.end_date || !slotForm.value.end_time) {
    alert('Please fill in both end date and time');
    return;
  }
  
  const startDatetime = combineDateAndTime(slotForm.value.start_date, slotForm.value.start_time);
  const endDatetime = combineDateAndTime(slotForm.value.end_date, slotForm.value.end_time);
  
  // Convert stage_id to number, handling various input types
  let numericStageId;
  if (typeof stageId === 'number') {
    numericStageId = stageId;
  } else if (typeof stageId === 'string') {
    numericStageId = parseInt(stageId, 10);
  } else {
    console.error('Invalid stageId type:', typeof stageId, stageId);
    alert('Error: Invalid stage ID type. Please refresh the page and try again.');
    return;
  }
  
  // Ensure project_id is a string (UUID) and stage_id is a number (BIGINT)
  const payload = {
    project_id: String(projectId).trim(), // UUID should be a string
    stage_id: numericStageId, // BIGINT should be a number
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    notes: slotForm.value.notes || ''
  };
  
  // Final validation - ensure stage_id is a valid number
  if (isNaN(payload.stage_id) || payload.stage_id <= 0 || !Number.isInteger(payload.stage_id)) {
    console.error('Stage ID is not a valid integer:', payload.stage_id, typeof payload.stage_id);
    alert('Error: Invalid stage ID. Please refresh the page and try again.');
    return;
  }
  
  // Validate project_id is a valid UUID format (basic check)
  if (!payload.project_id || payload.project_id.length < 10 || payload.project_id === 'undefined') {
    console.error('Project ID is invalid:', payload.project_id);
    alert('Error: Invalid project ID. Please refresh the page and try again.');
    return;
  }
  
  console.log('Payload before save:', payload);
  console.log('editingSlot.value:', editingSlot.value);
  console.log('editingSlot.value?.id:', editingSlot.value?.id);
  console.log('Type of editingSlot.value:', typeof editingSlot.value);
  console.log('Is editingSlot.value null?', editingSlot.value === null);
  console.log('Is editingSlot.value undefined?', editingSlot.value === undefined);
  
  try {
    // Extract slot ID safely
    const slotId = editingSlot.value?.id;
    
    // Default to INSERT unless we have a clear, valid ID
    // Be very defensive - only update if we're 100% sure
    const shouldUpdate = editingSlot.value !== null && 
                         editingSlot.value !== undefined && 
                         typeof slotId !== 'undefined' &&
                         slotId !== null &&
                         slotId !== '' &&
                         (typeof slotId === 'number' || typeof slotId === 'string') &&
                         !isNaN(Number(slotId)) &&
                         Number(slotId) > 0;
    
    console.log('=== SAVE SLOT DEBUG ===');
    console.log('editingSlot.value:', editingSlot.value);
    console.log('slotId:', slotId);
    console.log('slotId type:', typeof slotId);
    console.log('shouldUpdate:', shouldUpdate);
    console.log('======================');
    
    if (shouldUpdate) {
      // Update - only if we have a valid ID
      console.log('UPDATING slot with id:', slotId);
      const { error } = await supabase
        .from('stage_hours')
        .update(payload)
        .eq('id', slotId);
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
    } else {
      // Insert - default behavior for new slots
      console.log('INSERTING new slot');
      console.log('Reason: editingSlot.value =', editingSlot.value, ', slotId =', slotId);
      const { error } = await supabase
        .from('stage_hours')
        .insert([payload]);
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
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

// Helper functions for date/time formatting
function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateString, timeString) {
  // Combine date (YYYY-MM-DD) and time (HH:mm) into ISO string
  // Create date in local timezone, then convert to ISO
  const localDate = new Date(`${dateString}T${timeString}`);
  return localDate.toISOString();
}

function goTo(type) {
const id = props.projectId;
const s = props.stage;
if (!s) return;

// Ensure venue_id is available - use venue_id from stage, or try to find it from stages array
let venueId = s.venue_id;
if (!venueId && props.stages && props.stages.length > 0) {
  const stageWithVenue = props.stages.find(st => st.id === s.id);
  if (stageWithVenue && stageWithVenue.venue_id) {
    venueId = stageWithVenue.venue_id;
  }
}

// Build query object, only including venueId if it's defined
const buildQuery = (includeVenueId = true) => {
  const query = { stageId: s.id };
  if (includeVenueId && venueId) {
    query.venueId = venueId;
  }
  return query;
};

if (type === 'notes') {
  router.push({ name: 'LocationNotes', params: { id, locationId: s.id } });
} else if (type === 'signal') {
  router.push({ name: 'SignalMapper', params: { id, tab: 'placement' }, query: { ...buildQuery(), locationId: s.id } });
} else if (type === 'gear') {
  router.push({ name: 'ProjectGear', params: { id }, query: { locationId: s.id } });
} else if (type === 'photos') {
  router.push({ name: 'StagePictures', params: { id }, query: buildQuery() });
} else if (type === 'docs') {
  router.push({ name: 'StageDocs', params: { id }, query: buildQuery() });
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

function onStageChange() {
  if (selectedStageId.value) {
    const newStageId = typeof selectedStageId.value === 'string' 
      ? parseInt(selectedStageId.value, 10) 
      : selectedStageId.value;
    const currentStageId = props.stage?.id;
    if (newStageId !== currentStageId) {
      emit('stage-change', newStageId);
    }
  }
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

/* Dark mode for modal overlay */
.dark .modal-overlay {
background: rgba(0,0,0,0.6);
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

/* Dark mode for modal content */
.dark .modal-content {
box-shadow: 0 8px 32px rgba(0,0,0,0.5);
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

.stage-selector-container {
display: flex;
align-items: center;
justify-content: center;
gap: 12px;
margin-bottom: 24px;
padding: 12px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid var(--border-medium);
}

.stage-select-label {
font-size: 0.95rem;
font-weight: 600;
color: var(--text-secondary);
}

.stage-select {
flex: 1;
max-width: 300px;
padding: 8px 12px;
font-size: 1rem;
font-weight: 600;
color: var(--text-primary);
background: var(--bg-primary);
border: 1px solid var(--border-medium);
border-radius: 6px;
cursor: pointer;
transition: all 0.2s ease;
}

.stage-select:hover {
border-color: var(--color-primary-500);
}

.stage-select:focus {
outline: none;
border-color: var(--color-primary-600);
box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

/* Stage Hours Section */
.stage-hours-section {
margin-bottom: 20px;
padding: 16px;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid var(--border-medium);
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
border: 1px solid var(--border-medium);
border-radius: 6px;
cursor: pointer;
transition: all 0.2s ease;
width: 32px;
height: 32px;
}

.gear-button:hover {
background: var(--bg-tertiary);
border-color: var(--color-primary-500);
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
border: 1px solid var(--border-medium);
}

.time-range {
font-size: 0.9rem;
font-weight: 600;
color: var(--text-primary);
margin-bottom: 2px;
}

.hour-notes {
font-size: 0.8rem;
color: var(--text-tertiary);
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
border: 1px solid var(--border-medium);
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
color: var(--text-primary);
border-bottom: 1px solid var(--border-medium);
font-size: 0.8rem;
}

.hours-table td {
padding: 8px 12px;
border-bottom: 1px solid var(--border-medium);
color: var(--text-primary);
font-size: 0.8rem;
background: var(--bg-primary);
}

.hours-table tr:hover {
background: var(--bg-secondary);
}

.hours-table tr:hover td {
background: var(--bg-secondary);
}

.hours-table tr.past-hour {
background: var(--bg-tertiary);
opacity: 0.8;
}

.hours-table tr.past-hour td {
background: var(--bg-tertiary);
}

.hours-table tr.past-hour:hover {
background: var(--bg-secondary);
}

.hours-table tr.past-hour:hover td {
background: var(--bg-secondary);
}

/* Dark mode for table */
.dark .hours-table {
background: var(--bg-primary);
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.dark .hours-table th {
background: var(--bg-secondary);
color: var(--text-primary);
border-bottom-color: var(--border-medium);
}

.dark .hours-table td {
background: var(--bg-primary);
color: var(--text-primary);
border-bottom-color: var(--border-medium);
}

.dark .hours-table tr:hover {
background: var(--bg-secondary);
}

.dark .hours-table tr:hover td {
background: var(--bg-secondary);
color: var(--text-primary);
}

/* Dark mode for past hours */
.dark .hours-table tr.past-hour {
background: var(--bg-grouped);
opacity: 1;
}

.dark .hours-table tr.past-hour td {
background: var(--bg-grouped);
color: var(--text-primary);
}

.dark .hours-table tr.past-hour:hover {
background: var(--bg-tertiary);
}

.dark .hours-table tr.past-hour:hover td {
background: var(--bg-tertiary);
color: var(--text-primary);
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

/* Dark mode for status badges */
.dark .hour-status.past {
background: rgba(251, 191, 36, 0.2);
color: #fbbf24;
border: 1px solid rgba(251, 191, 36, 0.4);
}

.dark .hour-status.future {
background: rgba(59, 130, 246, 0.2);
color: #60a5fa;
border: 1px solid rgba(59, 130, 246, 0.4);
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
border: 1px solid var(--border-medium);
border-radius: 4px;
cursor: pointer;
transition: all 0.2s ease;
min-height: 28px;
min-width: 28px;
}

.icon-action:hover {
background: var(--bg-tertiary);
border-color: var(--color-primary-500);
}

.icon-action.delete:hover {
background: rgba(239, 68, 68, 0.1);
border-color: #ef4444;
color: #ef4444;
}

/* Dark mode for icon actions */
.dark .icon-action:hover {
background: var(--bg-tertiary);
border-color: var(--color-primary-400);
}

.dark .icon-action.delete:hover {
background: rgba(239, 68, 68, 0.2);
border-color: #ef4444;
color: #f87171;
}

.icon {
font-size: 0.75rem;
}

.no-hours {
text-align: center;
color: var(--text-tertiary);
font-style: italic;
padding: 20px;
background: var(--bg-primary);
border-radius: 6px;
border: 1px solid var(--border-medium);
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
border: 1px solid var(--border-medium);
border-radius: 6px;
font-size: 0.9rem;
background: var(--bg-primary);
color: var(--text-primary);
transition: all 0.2s ease;
}

.form-field input[type="date"],
.form-field input[type="time"] {
cursor: pointer;
position: relative;
}

.form-field input[type="date"]::-webkit-calendar-picker-indicator,
.form-field input[type="time"]::-webkit-calendar-picker-indicator {
cursor: pointer;
opacity: 0.7;
filter: invert(0);
transition: opacity 0.2s ease;
}

.form-field input[type="date"]::-webkit-calendar-picker-indicator:hover,
.form-field input[type="time"]::-webkit-calendar-picker-indicator:hover {
opacity: 1;
}

/* Dark mode for calendar picker icons */
.dark .form-field input[type="date"]::-webkit-calendar-picker-indicator,
.dark .form-field input[type="time"]::-webkit-calendar-picker-indicator {
filter: invert(1);
opacity: 0.8;
}

.dark .form-field input[type="date"]::-webkit-calendar-picker-indicator:hover,
.dark .form-field input[type="time"]::-webkit-calendar-picker-indicator:hover {
opacity: 1;
}

.form-field input:focus {
outline: none;
border-color: var(--color-primary-500);
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Dark mode for form inputs */
.dark .form-field input:focus {
border-color: var(--color-primary-400);
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
background: var(--bg-secondary);
color: var(--text-primary);
border: 1px solid var(--border-medium);
border-radius: 6px;
font-size: 0.9rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.secondary-button:hover {
background: var(--bg-tertiary);
border-color: var(--color-primary-500);
transform: translateY(-1px);
}

/* Dark mode for secondary button */
.dark .secondary-button {
background: var(--bg-tertiary);
border-color: var(--border-dark);
}

.dark .secondary-button:hover {
background: var(--bg-elevated);
border-color: var(--color-primary-400);
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
background: var(--bg-tertiary);
color: var(--color-primary-600);
box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Dark mode for menu items */
.dark .menu-item:hover {
background: var(--bg-tertiary);
color: var(--color-primary-400);
box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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