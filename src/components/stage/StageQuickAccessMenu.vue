<template>
<transition name="fade">
  <div v-if="visible" class="modal-overlay">
    <div class="modal-content">
      <button class="close-button" @click="$emit('close')">×</button>
      <h2 class="modal-title">{{ stage.stage_name }}</h2>
      
      <!-- Show Times / Managing Hours Section -->
      <div v-if="stageHours.length > 0" class="stage-hours-section">
        <h3 class="hours-title">Show Times / Managing Hours</h3>
        <div class="hours-list">
          <div v-for="hour in stageHours" :key="hour.id" class="hour-item">
            <div class="time-range">{{ formatTime(hour.start_datetime) }} - {{ formatTime(hour.end_datetime) }}</div>
            <div v-if="hour.notes" class="hour-notes">{{ hour.notes }}</div>
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
    </div>
  </div>
</transition>
</template>

<script setup>
import { ref, onMounted } from 'vue';
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

onMounted(async () => {
  await loadStageHours();
});

async function loadStageHours() {
  try {
    const { data, error } = await supabase
      .from('stage_hour_events')
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
background: #fff;
border-radius: 12px;
box-shadow: 0 8px 32px rgba(0,0,0,0.18);
padding: 32px 40px 24px 40px;
min-width: 260px;
max-width: 95vw;
width: 100%;
display: flex;
flex-direction: column;
align-items: stretch;
position: relative;
}
.close-button {
position: absolute;
top: 12px;
right: 18px;
background: none;
border: none;
font-size: 1.7rem;
cursor: pointer;
color: #64748b;
border-radius: 6px;
transition: background 0.2s;
padding: 2px 8px;
}
.close-button:hover {
background: #f1f5f9;
color: #1d4ed8;
}
.modal-title {
text-align: center;
font-size: 1.2rem;
color: #1f2937;
font-weight: 600;
margin-bottom: 18px;
}

/* Stage Hours Section */
.stage-hours-section {
margin-bottom: 20px;
padding: 16px;
background: #f8fafc;
border-radius: 8px;
border: 1px solid #e2e8f0;
}

.hours-title {
font-size: 1rem;
font-weight: 600;
color: #374151;
margin: 0 0 12px 0;
text-align: center;
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
background: #ffffff;
border-radius: 6px;
border: 1px solid #e5e7eb;
}

.time-range {
font-size: 0.9rem;
font-weight: 600;
color: #1f2937;
margin-bottom: 2px;
}

.hour-notes {
font-size: 0.8rem;
color: #6b7280;
text-align: center;
}
.menu-list {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 12px;
margin-top: 8px;
}
.menu-item {
background: #f8fafc;
border: none;
width: 100%;
text-align: center;
padding: 18px 0 12px 0;
font-size: 1rem;
color: #1f2937;
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
}

/* Mobile */
@media (max-width: 767px) {
.modal-content {
  min-width: 0;
  padding: 18px 8px 12px 8px;
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