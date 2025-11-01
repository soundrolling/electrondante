<template>
<div class="timeline-view">
  <div class="timeline-nav">
    <button class="btn btn-warning nav-button" @click="$emit('previous-day')">
      &lt;
    </button>
    <strong>{{ formattedTimelineDate }}</strong>
    <button class="btn btn-warning nav-button" @click="$emit('next-day')">
      &gt;
    </button>
  </div>

  <!-- Stage Hours Section -->
  <div v-if="stageHours && Object.keys(stageHours).length" class="stage-hours-section">
    <div class="stage-hours-header">
      <h3>Stage Hours</h3>
      <button class="btn btn-warning edit-stage-hours-btn" @click="editStageHours">
        ✏️ Edit Hours
      </button>
    </div>
    <div class="stage-hours-list">
      <div v-for="(hours, stageName) in stageHours" :key="stageName" class="stage-hour-item">
        <div class="stage-name">{{ stageName }}</div>
        <div class="hours-list">
          <div v-for="(hour, index) in hours" :key="index" class="hour-slot" :class="{ 'multi-day-stage-hour': hour.isMultiDay }">
            <span class="time-range">{{ hour.start_time }}–{{ hour.end_time }}</span>
            <span v-if="hour.isMultiDay" class="multi-day-stage-indicator">Multi-day</span>
            <span v-if="hour.notes" class="notes">({{ hour.notes.startsWith('Day') ? hour.notes : 'Day ' + hour.notes }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <table class="timeline-table">
    <thead>
      <tr>
        <th class="time-col">Time</th>
        <th>Events</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="slot in timeSlots" :key="slot" :class="{ 'current-timeslot': isTodayView && slot === currentSlot }">
        <td class="time-col">{{ formatTimeSlot(slot) }}</td>
        <td>
          <div class="events-row">
            <div
              v-for="evt in timelineDayEvents.filter(e => overlapsSlot(e,slot))"
              :key="evt.category+'-'+evt.id"
              class="timeline-event"
              :class="{ 
                'stage-hour-event': evt.isStageHour, 
                'red-accent': !evt.isStageHour,
                'multi-day-event': isMultiDayEvent(evt)
              }"
              :style="evt.isStageHour ? {} : { borderLeft: '5px solid #ef4444' }"
              @click="$emit('event-click', evt)"
            >
              <div class="event-content">
                <strong v-html="evt.title"></strong><br>
                <small>{{ formatTime(getDisplayStartTime(evt)) }} – {{ formatTime(getDisplayEndTime(evt)) }}</small>
                <div v-if="getEventLocation(evt)" class="event-location">
                  <span class="location-text">📍 {{ getEventLocation(evt) }}</span>
                </div>
                <div v-if="isMultiDayEvent(evt)" class="multi-day-indicator">
                  <span class="multi-day-text">Multi-day event</span>
                </div>
              </div>
              <div v-if="isContactAssignable(evt) && evt.assigned_contacts && evt.assigned_contacts.length > 0" class="assigned-contacts-mini">
                <span class="contacts-count-mini">{{ evt.assigned_contacts.length }}</span>
                <span class="contacts-icon-mini">👥</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
</template>

<script>
export default {
name: 'CalendarTimelineView',
props: {
  timelineDayEvents: {
    type: Array,
    required: true
  },
  timeSlots: {
    type: Array,
    required: true
  },
  formattedTimelineDate: {
    type: String,
    required: true
  },
  stageHours: {
    type: Object,
    default: () => ({})
  },
  getEventColor: {
    type: Function,
    required: true
  },
  contacts: {
    type: Array,
    default: () => []
  },
  currentDateString: {
    type: String,
    required: true
  },
  locations: {
    type: Array,
    default: () => []
  }
},
emits: ['event-click', 'previous-day', 'next-day', 'edit-stage-hours'],
data() {
  return {
    now: new Date(),
    timer: null
  }
},
computed: {
  isTodayView() {
    // Compare formattedTimelineDate to today (ignoring year for safety)
    const today = new Date();
    const viewed = new Date(this.now);
    // Use the formattedTimelineDate string to get the viewed date
    // Fallback: compare to today
    return this.formattedTimelineDate.includes(today.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }))
      && this.formattedTimelineDate.includes(today.toLocaleDateString(undefined, { weekday: 'long' }));
  },
  currentSlot() {
    if (!this.isTodayView) return null;
    const now = this.now;
    const minutes = now.getHours() * 60 + now.getMinutes();
    // Find the slot that contains 'minutes'
    let slot = null;
    for (let i = 0; i < this.timeSlots.length; i++) {
      const start = this.timeSlots[i];
      const end = start + 15;
      if (minutes >= start && minutes < end) {
        slot = start;
        break;
      }
    }
    return slot;
  }
},
mounted() {
  // Update now every minute
  this.timer = setInterval(() => {
    this.now = new Date();
  }, 60000);
},
beforeUnmount() {
  clearInterval(this.timer);
},
methods: {
  formatTime(ts) {
    return ts ? ts.slice(0,5) : "";
  },
  formatTimeSlot(m) {
    const h = String(Math.floor(m/60)).padStart(2,"0"),
          mm = String(m%60).padStart(2,"0");
    return `${h}:${mm}`;
  },
  timeToMinutes(ts) {
    if (!ts) return 0;
    const [h,m] = ts.split(":").map(Number);
    return h*60 + m;
  },
  overlapsSlot(e, slot) {
    // Use display times to properly handle multi-day events
    const startTime = this.getDisplayStartTime(e);
    const endTime = this.getDisplayEndTime(e);
    
    let s = this.timeToMinutes(startTime),
        end = this.timeToMinutes(endTime);
    if (end < s) end += 1440;
    return s < slot + 15 && end > slot;
  },
  isContactAssignable(evt) {
    return evt && (evt.category === 'calltimes' || evt.category === 'wraptimes');
  },
  getDisplayStartTime(evt) {
    // If event starts on this day, use the original start time
    if (evt.event_date === this.currentDateString) {
      return evt.start_time;
    }
    // If event started on previous day but ends on this day, show midnight
    if (evt.end_date === this.currentDateString && evt.event_date !== this.currentDateString) {
      return '00:00';
    }
    return evt.start_time;
  },
  getDisplayEndTime(evt) {
    // If event ends on this day, use the original end time
    if (evt.end_date === this.currentDateString) {
      return evt.end_time;
    }
    // If event starts on this day but ends on next day, show midnight
    if (evt.event_date === this.currentDateString && evt.end_date !== this.currentDateString) {
      return '00:00';
    }
    return evt.end_time;
  },
  isMultiDayEvent(evt) {
    return evt.end_date && evt.end_date !== evt.event_date;
  },
  getEventLocation(evt) {
    if (!evt.location_id || !this.locations) return null;
    const location = this.locations.find(l => l.id === evt.location_id);
    if (!location) return null;
    return `${location.venue_name} - ${location.stage_name}`;
  },
  editStageHours() {
    this.$emit('edit-stage-hours');
  }
}
}
</script>

<style scoped>
.timeline-view {
padding: 10px;
box-sizing: border-box;
}
.timeline-nav {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 0.75rem;
color: var(--text-primary);
}
.nav-button {
background: var(--bg-secondary);
border: 1px solid var(--border-medium);
padding: 0.4rem 0.8rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
color: var(--text-primary);
}
.nav-button:hover {
background: var(--bg-tertiary);
}

.stage-hours-section {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.stage-hours-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stage-hours-header h3 {
  margin: 0;
  color: var(--text-secondary);
}

.edit-stage-hours-btn {
  font-size: 0.8rem;
  padding: 0.4rem 0.8rem;
}

.stage-hours-section h3 {
margin: 0 0 0.75rem 0;
color: var(--text-secondary);
font-size: 1rem;
}

.stage-hours-list {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.stage-hour-item {
background: var(--bg-primary);
padding: 0.5rem;
border-radius: 4px;
border: 1px solid var(--border-light);
}

.stage-name {
font-weight: 600;
margin-bottom: 0.25rem;
color: var(--text-secondary);
font-size: 0.9rem;
}

.hours-list {
display: flex;
flex-direction: column;
gap: 0.1rem;
}

.hour-slot {
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.8rem;
}

.time-range {
font-weight: 500;
color: var(--color-success-500);
}

.notes {
color: var(--text-secondary);
font-style: italic;
}

.timeline-table {
width: 100%;
border-collapse: collapse;
background: var(--bg-primary);
}
.timeline-table th,
.timeline-table td {
border: 1px solid var(--border-medium);
padding: 0.5rem;
}
.timeline-table th {
background: var(--bg-secondary);
color: var(--text-primary);
}
.timeline-table td {
background: var(--bg-primary);
color: var(--text-primary);
}
.time-col {
width: 70px;
text-align: right;
font-weight: 600;
color: var(--text-primary);
}
.events-row {
display: flex;
flex-wrap: wrap;
gap: 0.5rem;
}
.timeline-event {
margin: 2px 0;
padding: 6px 8px;
border-radius: 4px;
color: var(--text-primary);
font-size: 0.85rem;
cursor: pointer;
display: flex;
align-items: center;
gap: 0.5rem;
}

.timeline-event.stage-hour-event {
border: 2px solid var(--color-success-500);
font-weight: 600;
}

.event-content {
flex: 1;
}

.assigned-contacts-mini {
display: flex;
align-items: center;
gap: 0.25rem;
font-size: 0.7rem;
opacity: 0.9;
}

.contacts-count-mini {
background: rgba(255, 255, 255, 0.2);
border-radius: 50%;
width: 14px;
height: 14px;
display: flex;
align-items: center;
justify-content: center;
font-weight: 600;
font-size: 0.6rem;
}

.contacts-icon-mini {
font-size: 0.7rem;
}

.current-timeslot {
  background: rgba(59, 130, 246, 0.15) !important;
  transition: background 0.3s;
}

.timeline-table tbody tr:nth-child(even) {
  background: var(--bg-secondary);
}
.timeline-table tbody tr:nth-child(odd) {
  background: var(--bg-primary);
}

.timeline-event {
  background: var(--bg-secondary) !important;
  color: var(--text-primary);
  font-weight: 600;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid var(--border-medium);
  border-left: 5px solid var(--color-error-500);
  transition: box-shadow 0.18s, background 0.18s;
}
.timeline-event:hover {
  background: var(--bg-tertiary) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
}
.timeline-event.stage-hour-event {
  border: 2px solid var(--color-success-500);
  border-left: 5px solid var(--color-success-500);
  background: rgba(34, 197, 94, 0.1) !important;
  color: var(--color-success-600);
}
.timeline-event.red-accent {
  border-left: 5px solid var(--color-error-500) !important;
}

.timeline-event.multi-day-event {
  border-left: 5px solid var(--color-warning-500) !important;
  background: rgba(251, 191, 36, 0.1) !important;
}

.multi-day-indicator {
  margin-top: 0.2rem;
}

.multi-day-text {
  font-size: 0.7em;
  color: var(--color-warning-600);
  font-weight: 600;
  background: rgba(251, 191, 36, 0.15);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.event-location {
  margin-top: 0.2rem;
}

.location-text {
  font-size: 0.7em;
  color: var(--text-secondary);
  font-weight: 500;
  background: var(--bg-tertiary);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.multi-day-stage-hour {
  background: rgba(251, 191, 36, 0.1) !important;
  border-left: 3px solid var(--color-warning-500) !important;
}

.multi-day-stage-indicator {
  font-size: 0.7em;
  color: var(--color-warning-600);
  font-weight: 600;
  background: rgba(251, 191, 36, 0.2);
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  margin-left: 0.5rem;
}
</style> 