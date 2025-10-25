<template>
<div class="calendar-grid-view">
  <div class="calendar-header">
    <button class="btn btn-warning nav-button" @click="$emit('previous-period')">
      &lt;
    </button>
    <strong>{{ weekRangeHeader }}</strong>
    <button class="btn btn-warning nav-button" @click="$emit('next-period')">
      &gt;
    </button>
    <button class="btn btn-primary jump-today-btn" @click="jumpToToday">Today</button>
  </div>

  <!-- SCROLL CONTAINER: synchronizes header & grid -->
  <div class="calendar-scroll">
    <div class="vertical-week-view" :class="{ 'highlight-week': isCurrentWeek }">
      <div v-for="(day, idx) in displayCalendarDays" :key="day.date" :class="['vertical-week-row', { 'highlight-today': day.date === todayDate }]">
        <div class="vertical-weekday-label">{{ calendarWeekDayHeaders[idx] }}</div>
        <div class="vertical-weekday-cell" :class="{ 'has-events': hasEvents(day.date) }">
          <div class="day-number">{{ new Date(day.date).getDate() }}</div>
          <div v-if="hasEvents(day.date)" class="event-list">
            <div v-for="evt in getEventsForDay(day.date)" :key="evt.category+'-'+evt.id" class="event-list-item" :class="{ 'multi-day-event': evt.end_date && evt.end_date !== evt.event_date }" @click="$emit('event-click', evt)">
              <div class="event-flex">
                <div class="event-times-col">
                  <div class="event-time event-time-start">{{ formatTime12(getDisplayStartTime(evt, day.date)) }}</div>
                  <div class="event-arrow">↓</div>
                  <div class="event-time event-time-end">{{ formatTime12(getDisplayEndTime(evt, day.date)) }}</div>
                </div>
                <div class="event-info-col">
                  <div class="event-title" v-html="evt.title"></div>
                  <div v-if="evt.location_id && getLocationName" class="event-location">{{ getLocationName(evt.location_id) }}</div>
                  <div v-if="evt.end_date && evt.end_date !== evt.event_date" class="multi-day-indicator">
                    <span class="multi-day-text">Multi-day event</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
export default {
name: 'CalendarGridView',
props: {
  weekRangeHeader: {
    type: String,
    required: true
  },
  isCurrentWeek: {
    type: Boolean,
    required: true
  },
  jumpToToday: {
    type: Function,
    required: true
  },
  todayDate: {
    type: String,
    required: true
  },
  calendarMode: {
    type: String,
    required: true
  },
  displayCalendarDays: {
    type: Array,
    required: true
  },
  getEventsForDay: {
    type: Function,
    required: true
  },
  hasEvents: {
    type: Function,
    required: true
  },
  getEventColor: {
    type: Function,
    required: true
  },
  getStageHoursForDay: {
    type: Function,
    required: true
  },
  contacts: {
    type: Array,
    default: () => []
  },
  getLocationName: {
    type: Function,
    default: null
  }
},
emits: ['previous-period', 'next-period', 'update:calendarMode', 'event-click'],
data() {
  return {
    calendarWeekDayHeaders: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    showEventModal: false,
    selectedDay: null
  }
},
methods: {
  formatTime12(ts) {
    if (!ts) return '';
    // Accepts 'HH:mm' or 'HH:mm:ss'
    const [h, m] = ts.split(':');
    let hour = parseInt(h, 10);
    const min = parseInt(m, 10);
    const ampm = hour >= 12 ? 'pm' : 'am';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    // Show minutes only if not :00
    return min === 0 ? `${hour}${ampm}` : `${hour}:${m}${ampm}`;
  },
  getDisplayStartTime(evt, dayDate) {
    // If event starts on this day, use the original start time
    if (evt.event_date === dayDate) {
      return evt.start_time;
    }
    // If event started on previous day but ends on this day, show midnight
    if (evt.end_date === dayDate && evt.event_date !== dayDate) {
      return '00:00';
    }
    return evt.start_time;
  },
  getDisplayEndTime(evt, dayDate) {
    // If event ends on this day, use the original end time
    if (evt.end_date === dayDate) {
      return evt.end_time;
    }
    // If event starts on this day but ends on next day, show midnight
    if (evt.event_date === dayDate && evt.end_date !== dayDate) {
      return '00:00';
    }
    return evt.end_time;
  },
  // Keep only event-click
}
}
</script>

<style scoped>
.calendar-grid-view {
padding: 10px;
box-sizing: border-box;
}
.calendar-header {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 0.5rem;
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
.calendar-scroll {
overflow-x: scroll;
padding: 0.5rem 10px;
margin-bottom: 1rem;
}
.calendar-scroll::-webkit-scrollbar {
height: 10px;
}
.calendar-scroll::-webkit-scrollbar-thumb {
background-color: rgba(0,0,0,0.2);
border-radius: 5px;
}
.calendar-scroll::-webkit-scrollbar-track {
background: transparent;
}
.vertical-week-view {
display: flex;
flex-direction: column;
width: 100%;
border: 1px solid #d1d5db;
border-radius: 0;
}
.vertical-week-row {
display: flex;
flex-direction: row;
align-items: center;
border-bottom: 1px solid #d1d5db;
min-height: 60px;
}
.vertical-week-row:last-child {
border-bottom: none;
}
.vertical-weekday-label {
width: 60px;
background: #f9fafb;
text-align: center;
font-weight: 600;
border-right: 1px solid #d1d5db;
padding: 10px 0;
}
.vertical-weekday-cell {
flex: 1;
display: flex;
align-items: center;
padding: 10px;
min-height: 60px;
}
.vertical-weekday-cell.has-events .day-number {
font-weight: 700;
}
.calendar-icon-wrapper {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 0.25rem;
}
.calendar-icon-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.calendar-green-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #28a745;
  border-radius: 50%;
}
.calendar-icon {
  display: block;
}
/* Modal styles */
.event-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.event-modal {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.15);
  min-width: 280px;
  max-width: 90vw;
  max-height: 80vh;
  padding: 1rem;
  overflow-y: auto;
}
.event-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #888;
}
.event-modal-body {
  font-size: 0.95rem;
}
.event-modal-item {
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}
.jump-today-btn {
  margin-left: 1rem;
  background: #f5f7fa;
  border: 1px solid #cfd6dd;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  font-weight: 600;
}
.jump-today-btn:hover {
  background: #eaeef2;
}
.highlight-week {
  background: #f0f8ff;
  border-radius: 8px;
}
.highlight-today {
  background: #d1fae5 !important;
}
.event-list {
  margin-top: 0.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.event-list-item {
  background: #f5f7fa;
  border-left: 4px solid #28a745;
  border-radius: 4px;
  padding: 0.2rem 0.7rem 0.2rem 0.7rem;
  font-size: 0.97rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.event-list-item:hover {
  background: #e0f7e9;
}
.event-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.event-time {
  color: #28a745;
  font-weight: 600;
  font-size: 0.98em;
  min-width: 44px;
  text-align: right;
}
.event-arrow {
  color: #28a745;
  font-size: 1.1em;
  margin: 0 0.2em;
  font-weight: 700;
}
.event-title {
  flex: 1;
  font-weight: 500;
  color: #222;
}
.event-location {
  color: #888;
  font-size: 0.97em;
  margin-left: 0.7em;
  font-style: italic;
}
.day-number {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-right: 1.2rem;
  display: inline-block;
}
.event-flex {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.1rem;
}
.event-times-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
  gap: 0.1rem;
}
.event-time {
  color: #28a745;
  font-weight: 600;
  font-size: 1.05em;
  text-align: center;
}
.event-time-end {
  margin-bottom: 0.1em;
}
.event-arrow {
  color: #28a745;
  font-size: 1.1em;
  font-weight: 700;
  margin: 0.1em 0;
}
.event-info-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
}
.event-title {
  font-weight: 500;
  color: #222;
  margin-bottom: 0.1em;
}
.event-location {
  color: #888;
  font-size: 0.97em;
  font-style: italic;
}
.multi-day-event {
  border-left: 4px solid #ff6b35 !important;
  background: #fff5f0 !important;
}
.multi-day-indicator {
  margin-top: 0.2rem;
}
.multi-day-text {
  font-size: 0.8em;
  color: #ff6b35;
  font-weight: 600;
  background: rgba(255, 107, 53, 0.1);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}
</style> 