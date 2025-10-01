<template>
<div class="timeline-view">
  <div class="timeline-nav">
    <button class="nav-button" @click="$emit('previous-day')">
      &lt;
    </button>
    <strong>{{ formattedTimelineDate }}</strong>
    <button class="nav-button" @click="$emit('next-day')">
      &gt;
    </button>
  </div>

  <!-- Stage Hours Section -->
  <div v-if="stageHours && Object.keys(stageHours).length" class="stage-hours-section">
    <h3>Stage Hours</h3>
    <div class="stage-hours-list">
      <div v-for="(hours, stageName) in stageHours" :key="stageName" class="stage-hour-item">
        <div class="stage-name">{{ stageName }}</div>
        <div class="hours-list">
          <div v-for="(hour, index) in hours" :key="index" class="hour-slot">
            <span class="time-range">{{ hour.start_time }}–{{ hour.end_time }}</span>
            <span v-if="hour.notes" class="notes">({{ hour.notes }})</span>
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
              :class="{ 'stage-hour-event': evt.isStageHour, 'red-accent': !evt.isStageHour }"
              :style="evt.isStageHour ? {} : { borderLeft: '5px solid #ef4444' }"
              @click="$emit('event-click', evt)"
            >
              <div class="event-content">
                <strong v-html="evt.title"></strong><br>
                <small>{{ formatTime(evt.start_time) }} – {{ formatTime(evt.end_time) }}</small>
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
  }
},
emits: ['event-click', 'previous-day', 'next-day'],
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
    let s = this.timeToMinutes(e.start_time),
        end = this.timeToMinutes(e.end_time);
    if (end < s) end += 1440;
    return s < slot + 15 && end > slot;
  },
  isContactAssignable(evt) {
    return evt && (evt.category === 'calltimes' || evt.category === 'wraptimes');
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
}
.nav-button {
background: #f5f7fa;
border: 1px solid #cfd6dd;
padding: 0.4rem 0.8rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.nav-button:hover {
background: #eaeef2;
}

.stage-hours-section {
margin-bottom: 1rem;
padding: 1rem;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.stage-hours-section h3 {
margin: 0 0 0.75rem 0;
color: #495057;
font-size: 1rem;
}

.stage-hours-list {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.stage-hour-item {
background: #fff;
padding: 0.5rem;
border-radius: 4px;
border: 1px solid #dee2e6;
}

.stage-name {
font-weight: 600;
margin-bottom: 0.25rem;
color: #495057;
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
color: #28a745;
}

.notes {
color: #6c757d;
font-style: italic;
}

.timeline-table {
width: 100%;
border-collapse: collapse;
}
.timeline-table th,
.timeline-table td {
border: 1px solid #e1e5eb;
padding: 0.5rem;
}
.time-col {
width: 70px;
text-align: right;
font-weight: 600;
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
color: #fff;
font-size: 0.85rem;
cursor: pointer;
display: flex;
align-items: center;
gap: 0.5rem;
}

.timeline-event.stage-hour-event {
border: 2px solid #28a745;
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
  background: #e0f2fe !important;
  transition: background 0.3s;
}

.timeline-table tbody tr:nth-child(even) {
  background: #f7fafc;
}

.timeline-event {
  background: #fff !important;
  color: #222;
  font-weight: 600;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  border-left: 5px solid #ef4444;
  transition: box-shadow 0.18s, background 0.18s;
}
.timeline-event:hover {
  background: #f3f4f6 !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
}
.timeline-event.stage-hour-event {
  border: 2px solid #28a745;
  border-left: 5px solid #28a745;
  background: #f0fdf4 !important;
  color: #14532d;
}
.timeline-event.red-accent {
  border-left: 5px solid #ef4444 !important;
}
</style> 