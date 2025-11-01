<template>
<div class="calendar-page">
  <!-- Global header is rendered by App.vue; remove local page header to avoid duplication -->

  <!-- TOAST -->
  <div v-if="toastMsg" class="toast" @click="toastMsg = ''">
    {{ toastMsg }}
  </div>

  <!-- CONTROLS -->
  <section class="controls-section">
    <div class="view-controls">
      <CalendarViewSelector v-model="currentView" />
    </div>

    <CalendarFilters 
      :categories="eventCategories"
      :locations="locations"
      :filters="filters"
      :showDateFilters="currentView === 'list'"
      @update:filters="updateFilters"
    />

    <button class="btn btn-positive add-button" @click="openNewEventModal">
      + Add Event
    </button>
    <button class="btn btn-secondary" @click="forceRefresh" style="margin-left: 0.5rem;">
      🔄 Refresh
    </button>
  </section>

  <!-- LEGEND -->
  <CalendarLegend 
    :categories="eventCategories"
    :stage-hours="getFilteredStageHoursForDay(currentDateString)"
  />

  <!-- ERRORS / LOADING -->
  <section class="status-section">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading data…</p>
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="calendarError" class="error-message">{{ calendarError }}</div>
    <div v-if="locationsError" class="error-message">{{ locationsError }}</div>
    <div v-if="stageHoursError" class="error-message">{{ stageHoursError }}</div>
  </section>

  <!-- MAIN VIEWS -->
  <section class="views-container">
    <!-- CALENDAR GRID VIEW -->
    <CalendarGridView
      v-if="currentView==='grid'"
      :week-range-header="weekRangeHeader"
      :display-calendar-days="displayCalendarDays"
      :get-events-for-day="getEventsForDay"
      :has-events="hasEvents"
      :get-event-color="getEventColor"
      :get-stage-hours-for-day="getStageHoursForDay"
      :stage-hours="getFilteredStageHoursForDay(currentDateString)"
      :contacts="contacts"
      :is-current-week="isCurrentWeek"
      :jump-to-today="jumpToToday"
      :today-date="todayDate"
      @event-click="openDetailsModal"
      @previous-period="previousPeriod"
      @next-period="nextPeriod"
      @edit-stage-hours="openStageHoursModal"
    />

    <!-- TIMELINE VIEW -->
    <CalendarTimelineView
      v-else-if="currentView==='timeline'"
      :timeline-day-events="timelineDayEvents"
      :time-slots="timeSlots"
      :formatted-timeline-date="formattedTimelineDate"
      :stage-hours="getFilteredStageHoursForDay(currentDateString)"
      :get-event-color="getEventColor"
      :contacts="contacts"
      :current-date-string="currentDateString"
      :locations="locations"
      @event-click="openDetailsModal"
      @previous-day="previousDay"
      @next-day="nextDay"
      @edit-stage-hours="openStageHoursModal"
    />

    <!-- LIST VIEW -->
    <CalendarListView
      v-else
      :sorted-events="sortedEvents"
      :locations="locations"
      :stage-hours="getFilteredStageHoursForDay(currentDateString)"
      :categories="eventCategories"
      :get-event-color="getEventColor"
      :contacts="contacts"
      @event-click="openDetailsModal"
      @edit="onEditEvent"
      @delete="onDeleteEvent"
      @edit-stage-hours="openStageHoursModal"
    />
  </section>

  <!-- MODALS -->
  <EventDetailsModal
    :show="showDetailsModal"
    :mode="detailsMode"
    :event="detailsEvent"
    :locations="locations"
    :categories="eventCategories"
    :contacts="contacts"
    @close="closeDetailsModal"
    @edit="detailsMode = 'edit'"
    @delete="confirmDelete"
    @save="saveDetails"
    @cancel-edit="detailsMode = 'view'"
  />

  <NewEventModal
    :show="showNewModal"
    :locations="locations"
    :categories="eventCategories"
    :contacts="contacts"
    @close="closeNewEventModal"
    @create="createNewEvent"
  />

  <!-- Stage Hours Modal -->
  <div v-if="showStageHoursModal" class="modal-overlay" @click.self="closeStageHoursModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Edit Stage Hours</h2>
        <button class="close-button" @click="closeStageHoursModal">×</button>
      </div>
      <div class="modal-body">
        <div class="stage-hours-list">
          <div v-for="stage in locations" :key="stage.id" class="stage-hours-item">
            <div class="stage-name">{{ stage.venue_name }} - {{ stage.stage_name }}</div>
            <div class="hours-list">
              <div v-for="hour in getStageHoursForStage(stage.id)" :key="hour.id" class="hour-item">
                <span class="time-range">{{ formatDateTime(hour.start_datetime) }} - {{ formatDateTime(hour.end_datetime) }}</span>
                <span v-if="hour.notes" class="day-id">{{ hour.notes.startsWith('Day') ? hour.notes : 'Day ' + hour.notes }}</span>
                <div class="hour-actions">
                  <button class="btn btn-warning btn-sm" @click="editStageHour(hour, stage)">✏️</button>
                  <button class="btn btn-danger btn-sm" @click="deleteStageHour(hour)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" @click="addStageHour(stage)">+ Add Hours</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useUserStore } from "../../stores/userStore";
import { fetchTableData } from "../../services/dataService";
import { supabase } from "../../supabase";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";

// Import subcomponents
import CalendarViewSelector from "./CalendarViewSelector.vue";
import CalendarFilters from "./CalendarFilters.vue";
import CalendarLegend from "./CalendarLegend.vue";
import CalendarListView from "./CalendarListView.vue";
import CalendarTimelineView from "./CalendarTimelineView.vue";
import CalendarGridView from "./CalendarGridView.vue";
import EventDetailsModal from "./EventDetailsModal.vue";
import NewEventModal from "./NewEventModal.vue";


export default {
name: "CalendarMain",
components: {
  CalendarViewSelector,
  CalendarFilters,
  CalendarLegend,
  CalendarListView,
  CalendarTimelineView,
  CalendarGridView,
  EventDetailsModal,
  NewEventModal
},
setup() {
  const userStore = useUserStore();
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  const loading = ref(true);
  const error = ref("");
  const calendarError = ref("");
  const locationsError = ref("");
  const stageHoursError = ref("");
  const toastMsg = ref("");

  const events = ref([]);
  const locations = ref([]);
  const stageHours = ref([]);
  const contacts = ref([]);
  const travelTrips = ref([]);

  const currentView = ref("grid");
  const currentDate = ref(new Date());

  // Set default date filters to today
  const todayStr = new Date().toISOString().split('T')[0];
  const filters = ref({
    dateStart: todayStr,
    dateEnd: todayStr,
    category: '',
    location: ''
  });

  // Event categories with icons
  const eventCategories = [
    { id: 'calltimes', label: 'Call Times', icon: '⏰' },
    { id: 'wraptimes', label: 'Wrap Times', icon: '🔚' },
    { id: 'deliveries', label: 'Deliveries', icon: '📦' },
    { id: 'recording', label: 'Recording', icon: '🎤' },
    { id: 'meeting', label: 'Meeting', icon: '👥' },
    { id: 'setup', label: 'Setup/Breakdown', icon: '🛠️' },
    { id: 'showday', label: 'Show Day', icon: '🎭' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'other', label: 'Other', icon: '❓' }
  ];

  // DETAILS MODAL STATE
  const showDetailsModal = ref(false);
  const detailsMode = ref("view");
  const detailsEvent = ref({
    id: null,
    category: "calltimes",
    title: "",
    event_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    location_id: null,
    notes: ""
  });

  // NEW EVENT MODAL STATE
  const showNewModal = ref(false);
  const showStageHoursModal = ref(false);

  // FETCH ALL DATA FROM SUPABASE
  async function fetchAll() {
    loading.value = true;
    error.value = "";
    calendarError.value = "";
    locationsError.value = "";
    stageHoursError.value = "";

    const pid = userStore.getCurrentProject?.id;
    if (!pid) {
      error.value = "No project selected.";
      loading.value = false;
      return;
    }

    // Calendar events
    let rawCal = [];
    try {
      console.log('[fetchAll] Fetching calendar events for project:', pid);
      rawCal = await fetchTableData("calendar_events", { eq: { project_id: pid } });
      console.log('[fetchAll] Fetched calendar events:', rawCal.length);
    } catch (e) {
      console.error('[fetchAll] Calendar events error:', e);
      calendarError.value = "Failed to load calendar events: " + e.message;
    }
    const calData = rawCal.map(c => ({
      id: c.id,
      category: c.category || "calltimes",
      title: c.title,
      event_date: c.event_date,
      start_time: c.start_time,
      end_date: c.end_date || c.event_date, // Default to event_date if no end_date
      end_time: c.end_time,
      location_id: c.location_id,
      notes: c.notes || "",
      assigned_contacts: c.assigned_contacts || []
    }));

    // Locations
    try {
      locations.value = await fetchTableData("locations", { eq: { project_id: pid } });
    } catch (e) {
      locationsError.value = "Failed to load locations: " + e.message;
    }

    // Contacts
    try {
      contacts.value = await fetchTableData("project_contacts", { eq: { project_id: pid } });
    } catch (e) {
      // Don't show error for contacts as they might not exist yet
      console.log("No contacts found or error loading contacts:", e.message);
    }

    // Stage hours
    try {
      const { data: hoursData, error: hoursError } = await supabase
        .from('stage_hours')
        .select('*')
        .eq('project_id', pid);
      
      if (hoursError) throw hoursError;
      stageHours.value = hoursData || [];
    } catch (e) {
      stageHoursError.value = "Failed to load stage hours: " + e.message;
    }

    // Travel trips
    try {
      const { data: trips, error: tripsError } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', pid);
      if (tripsError) throw tripsError;
      travelTrips.value = trips || [];
    } catch (e) {
      console.error('Failed to load travel trips:', e.message);
      travelTrips.value = [];
    }

    events.value = calData;
    console.log('[fetchAll] Final events count:', events.value.length);
    
    // Auto-calculate filter range to include all days with events
    if (calData.length > 0) {
      const allDates = [];
      calData.forEach(event => {
        allDates.push(event.event_date);
        if (event.end_date && event.end_date !== event.event_date) {
          // Add all dates between start and end date
          const start = new Date(event.event_date);
          const end = new Date(event.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
          }
        }
      });
      
      if (allDates.length > 0) {
        const sortedDates = [...new Set(allDates)].sort();
        filters.value.dateStart = sortedDates[0];
        filters.value.dateEnd = sortedDates[sortedDates.length - 1];
      }
    }
    
    loading.value = false;
  }

  // FORMATTING HELPERS
  function formatDate(ds) {
    if (!ds) return "";
    return new Date(ds).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });
  }
  function formatTime(ts) {
    return ts ? ts.slice(0, 5) : "";
  }
  function timeToMinutes(ts) {
    if (!ts) return 0;
    const [h, m] = ts.split(":").map(Number);
    return h * 60 + m;
  }

  // COLOR MAPS
  const categoryColorMap = computed(() => {
    const m = {};
    eventCategories.forEach(cat => m[cat.id] = cat.color);
    return m;
  });

  const uniqueLocationLabels = computed(() =>
    Array.from(new Set(events.value
      .filter(e => e.location_id)
      .map(e => {
        const l = locations.value.find(x => x.id === e.location_id);
        return l ? `${l.venue_name} - ${l.stage_name}` : "Unspecified";
      })
    ))
  );
  const locationColorMap = computed(() => {
    const palette = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c"];
    const m = {};
    uniqueLocationLabels.value.forEach((lbl, i) => m[lbl] = palette[i % palette.length]);
    return m;
  });

  function getEventColor(ev) {
    // Use category color if available, otherwise location color
    const categoryColor = categoryColorMap.value[ev.category];
    if (categoryColor) return categoryColor;
    
    const l = locations.value.find(x => x.id === ev.location_id);
    const label = l ? `${l.venue_name} - ${l.stage_name}` : "Unspecified";
    return locationColorMap.value[label] || "#bdc3c7";
  }

  // STAGE HOURS HELPERS
  function getStageHoursForDate(date) {
    return stageHours.value.filter(hour => {
      const startDate = hour.start_datetime.slice(0, 10);
      const endDate = hour.end_datetime.slice(0, 10);
      
      // Include stage hours that:
      // 1. Start on the current date, OR
      // 2. End on the current date, OR  
      // 3. Span across the current date (start before and end after)
      return startDate === date || endDate === date || (startDate < date && endDate > date);
    });
  }

  function getStageHoursForDay(date) {
    const hours = getStageHoursForDate(date);
    const hoursByStage = {};
    
    hours.forEach(hour => {
      const stage = locations.value.find(l => l.id === hour.stage_id);
      if (stage) {
        const stageKey = `${stage.venue_name} - ${stage.stage_name}`;
        if (!hoursByStage[stageKey]) {
          hoursByStage[stageKey] = [];
        }
        
        // Calculate display times for the current day
        const startDate = hour.start_datetime.slice(0, 10);
        const endDate = hour.end_datetime.slice(0, 10);
        
        let displayStartTime = extractTimeFromISO(hour.start_datetime);
        let displayEndTime = extractTimeFromISO(hour.end_datetime);
        
        // If stage hours start on a previous day, show from 00:00
        if (startDate < date) {
          displayStartTime = '00:00';
        }
        
        // If stage hours end on a future day, show until 00:00 (next day)
        if (endDate > date) {
          displayEndTime = '00:00';
        }
        
        hoursByStage[stageKey].push({
          start_time: displayStartTime,
          end_time: displayEndTime,
          notes: hour.notes,
          isMultiDay: startDate !== endDate
        });
      }
    });
    
    return hoursByStage;
  }

  // Filtered version of getStageHoursForDay that respects current filters
  function getFilteredStageHoursForDay(date) {
    const hours = filteredStageHours.value.filter(hour => {
      const startDate = hour.start_datetime.slice(0, 10);
      const endDate = hour.end_datetime.slice(0, 10);
      
      // Include stage hours that:
      // 1. Start on the current date, OR
      // 2. End on the current date, OR  
      // 3. Span across the current date (start before and end after)
      return startDate === date || endDate === date || (startDate < date && endDate > date);
    });
    
    const hoursByStage = {};
    
    hours.forEach(hour => {
      const stage = locations.value.find(l => l.id === hour.stage_id);
      if (stage) {
        const stageKey = `${stage.venue_name} - ${stage.stage_name}`;
        if (!hoursByStage[stageKey]) {
          hoursByStage[stageKey] = [];
        }
        
        // Calculate display times for the current day
        const startDate = hour.start_datetime.slice(0, 10);
        const endDate = hour.end_datetime.slice(0, 10);
        
        let displayStartTime = extractTimeFromISO(hour.start_datetime);
        let displayEndTime = extractTimeFromISO(hour.end_datetime);
        
        // If stage hours start on a previous day, show from 00:00
        if (startDate < date) {
          displayStartTime = '00:00';
        }
        
        // If stage hours end on a future day, show until 00:00 (next day)
        if (endDate > date) {
          displayEndTime = '00:00';
        }
        
        hoursByStage[stageKey].push({
          start_time: displayStartTime,
          end_time: displayEndTime,
          notes: hour.notes,
          isMultiDay: startDate !== endDate
        });
      }
    });
    
    return hoursByStage;
  }

  // Helper to extract time in HH:mm from ISO string
  function extractTimeFromISO(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Combine regular events with stage hour events and synthetic build/show day events and travel events
  const allEvents = computed(() => {
    const regularEvents = events.value;
    // --- Synthetic build day events ---
    const project = userStore.getCurrentProject;
    let syntheticEvents = [];
    if (project) {
      if (Array.isArray(project.build_days)) {
        syntheticEvents = syntheticEvents.concat(
          project.build_days.map(date => ({
            id: `build_${date}`,
            category: 'setup',
            title: 'Build Day',
            event_date: date,
            start_time: '',
            end_time: '',
            location_id: null,
            notes: 'Build day (auto-added)',
            isSynthetic: true
          }))
        );
      }
    }
    // --- Synthetic travel events ---
    let travelEvents = [];
    if (Array.isArray(travelTrips.value)) {
      travelTrips.value.forEach(trip => {
        // For each day in the trip, create an all-day event
        const start = new Date(trip.start_date);
        const end = new Date(trip.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().slice(0, 10);
          travelEvents.push({
            id: `travel_${trip.id}_${dateStr}`,
            category: 'travel',
            title: `Travel: ${trip.name}${trip.destination ? ' - ' + trip.destination : ''}`,
            event_date: dateStr,
            start_time: '',
            end_time: '',
            location_id: null,
            notes: trip.description || 'Travel event (auto-added)',
            isSynthetic: true
          });
        }
      });
    }
    return [...regularEvents, ...syntheticEvents, ...travelEvents];
  });

  // FILTER & SORT
  const filteredEvents = computed(() => {
    let arr = allEvents.value.slice();
    
    // Filter by date range - check if event overlaps with the filter range
    if (filters.value.dateStart || filters.value.dateEnd) {
      arr = arr.filter(e => {
        const eventStart = e.event_date;
        const eventEnd = e.end_date || e.event_date;
        
        // Event overlaps with filter range if:
        // - Event starts before filter ends AND event ends after filter starts
        const filterStart = filters.value.dateStart || '1900-01-01';
        const filterEnd = filters.value.dateEnd || '2100-12-31';
        
        return eventStart <= filterEnd && eventEnd >= filterStart;
      });
    }
    
    if (filters.value.category) arr = arr.filter(e => e.category === filters.value.category);
    if (filters.value.location) arr = arr.filter(e => e.location_id === parseInt(filters.value.location));
    return arr;
  });
  const sortedEvents = computed(() =>
    filteredEvents.value.slice().sort((a, b) => {
      const d = a.event_date.localeCompare(b.event_date);
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
    })
  );

  // Filtered stage hours based on current filters
  const filteredStageHours = computed(() => {
    let hours = stageHours.value.slice();
    
    // Filter by location if specified
    if (filters.value.location) {
      hours = hours.filter(hour => hour.stage_id === parseInt(filters.value.location));
    }
    
    // Filter by date range if specified
    if (filters.value.dateStart || filters.value.dateEnd) {
      hours = hours.filter(hour => {
        const hourStart = hour.start_datetime.slice(0, 10);
        const hourEnd = hour.end_datetime.slice(0, 10);
        
        const filterStart = filters.value.dateStart || '1900-01-01';
        const filterEnd = filters.value.dateEnd || '2100-12-31';
        
        return hourStart <= filterEnd && hourEnd >= filterStart;
      });
    }
    
    return hours;
  });

  // TIMELINE
  const daysWithEvents = computed(() => {
    const dates = new Set();
    sortedEvents.value.forEach(e => {
      // Add the start date
      dates.add(e.event_date);
      // Add the end date if it's different from start date
      if (e.end_date && e.end_date !== e.event_date) {
        dates.add(e.end_date);
      }
    });
    return Array.from(dates).sort();
  });
  const activeDayIndex = ref(-1);
  watch(sortedEvents, () => {
    const dates = daysWithEvents.value;
    if (!dates.length) {
      activeDayIndex.value = -1;
      return;
    }
    let idx = dates.indexOf(new Date().toISOString().split("T")[0]);
    if (idx < 0) idx = 0;
    activeDayIndex.value = idx;
    currentDate.value = new Date(dates[idx]);
  }, { immediate: true });

  const currentDateString = computed(() => currentDate.value.toISOString().split("T")[0]);

  // Helper to check if current date is today
  function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  }

  // Show events for the current day, using the same logic as grid view
  const timelineDayEvents = computed(() => {
    const currentDate = currentDateString.value;
    
    // Use the same filtering logic as getEventsForDay for consistency
    let events = sortedEvents.value.filter(e => {
      const eventStart = e.event_date;
      const eventEnd = e.end_date || e.event_date;
      return currentDate >= eventStart && currentDate <= eventEnd;
    });
    
    // Filter out events without start/end times for timeline view (since we need times for positioning)
    events = events.filter(e => e.start_time && e.end_time);
    
    // Sort by start time within the day
    events = events.sort((a, b) => {
      // If events start on different days, sort by start date first
      const dateCompare = a.event_date.localeCompare(b.event_date);
      if (dateCompare !== 0) return dateCompare;
      
      // Then sort by start time
      return a.start_time.localeCompare(b.start_time);
    });
    
    // Apply today-specific filtering if viewing today and no date filters are active
    if (isToday(new Date(currentDate)) && !filters.value.dateStart && !filters.value.dateEnd) {
      events = events.filter(e => {
        // For events starting today, only show if start_time >= 03:00
        if (e.event_date === currentDate) {
          return e.start_time >= '03:00';
        }
        // For events starting on previous days but ending today, always show
        return true;
      });
    }
    
    return events;
  });
  const timeSlots = computed(() => {
    const arr = [];
    for (let m = 0; m < 1440; m += 15) arr.push(m);
    return arr;
  });
  const formattedTimelineDate = computed(() =>
    currentDate.value.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    })
  );

  // CALENDAR GRID
  function makeWeekDays() {
    const dow = currentDate.value.getDay();
    // JS: 0=Sun, 1=Mon, ..., 6=Sat. We want Monday=0, Sunday=6
    const monday = new Date(currentDate.value);
    monday.setDate(monday.getDate() - ((dow === 0 ? 7 : dow) - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: d.toISOString().split("T")[0], currentMonth: d.getMonth() === currentDate.value.getMonth() };
    });
  }

  const weekDaysData = computed(makeWeekDays);
  const displayCalendarDays = weekDaysData;

  // Add a computed property for the week range header
  const weekRangeHeader = computed(() => {
    const week = weekDaysData.value;
    if (!week.length) return '';
    const start = new Date(week[0].date);
    const end = new Date(week[6].date);
    const startMonth = start.toLocaleString('default', { month: 'long' });
    const endMonth = end.toLocaleString('default', { month: 'long' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = end.getFullYear();
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}–${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
    }
  });

  // Add a computed property for the current week dates
  const currentWeekDates = computed(() => weekDaysData.value.map(d => d.date));
  const todayDate = new Date().toISOString().split('T')[0];
  const isCurrentWeek = computed(() => currentWeekDates.value.includes(todayDate));

  function jumpToToday() {
    currentDate.value = new Date();
  }

  // NAVIGATION
  function previousDay() {
    if (activeDayIndex.value > 0) {
      activeDayIndex.value--;
      currentDate.value = new Date(daysWithEvents.value[activeDayIndex.value]);
    }
  }
  function nextDay() {
    if (activeDayIndex.value < daysWithEvents.value.length - 1) {
      activeDayIndex.value++;
      currentDate.value = new Date(daysWithEvents.value[activeDayIndex.value]);
    }
  }
  function previousPeriod() {
    const d = new Date(currentDate.value);
    d.setDate(d.getDate() - 7);
    currentDate.value = d;
  }
  function nextPeriod() {
    const d = new Date(currentDate.value);
    d.setDate(d.getDate() + 7);
    currentDate.value = d;
  }

  // WATCHERS: Auto‐copy start_time → end_time
  watch(
    () => detailsEvent.value.start_time,
    (newStart) => {
      if (
        detailsMode.value === "edit" &&
        newStart &&
        (
          !detailsEvent.value.end_time ||
          detailsEvent.value.end_time === newStart
        )
      ) {
        detailsEvent.value.end_time = newStart;
      }
    }
  );

  // CRUD & MODALS
  function updateFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function openDetailsModal(evt) {
    detailsEvent.value = { ...evt };
    detailsMode.value = "view";
    showDetailsModal.value = true;
  }
  function closeDetailsModal() {
    showDetailsModal.value = false;
  }
  async function confirmDelete() {
    if (!detailsEvent.value.id) { toast.error("Missing ID"); return; }
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("calendar_events")
      .delete().eq("id", detailsEvent.value.id);
    if (error) {
      toast.error("Failed to delete event: " + error.message);
    } else { 
      closeDetailsModal(); 
      fetchAll();
      toast.success("Event deleted successfully");
    }
  }
  async function saveDetails() {
    const ev = detailsEvent.value;
    if (!ev.id) { toastMsg.value = "Missing ID"; return; }
    const { error } = await supabase
      .from("calendar_events")
      .update({
        category: ev.category,
        event_date: ev.event_date,
        start_time: ev.start_time,
        end_date: ev.end_date || ev.event_date, // Default to start date if no end date
        end_time: ev.end_time,
        title: ev.title,
        location_id: ev.location_id,
        notes: ev.notes,
        assigned_contacts: ev.assigned_contacts || []
      })
      .eq("id", ev.id);
    if (error) {
      toastMsg.value = "Update failed: " + error.message;
      toast.error("Failed to save event changes");
    } else { 
      detailsMode.value = "view"; 
      closeDetailsModal();
      fetchAll();
      toast.success("Event changes saved successfully");
    }
  }

  function openNewEventModal() {
    showNewModal.value = true;
  }
  function closeNewEventModal() {
    showNewModal.value = false;
  }

  // Stage Hours Modal Functions
  function openStageHoursModal() {
    showStageHoursModal.value = true;
  }

  function closeStageHoursModal() {
    showStageHoursModal.value = false;
  }

  function getStageHoursForStage(stageId) {
    return stageHours.value.filter(hour => hour.stage_id === stageId);
  }

  function formatDateTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  function editStageHour(hour, stage) {
    // Navigate to ProjectLocations with the specific stage
    const projectId = userStore.getCurrentProject?.id;
    router.push({
      name: 'ProjectLocations',
      params: { id: projectId },
      query: { stageId: stage.id }
    });
  }

  function addStageHour(stage) {
    // Navigate to ProjectLocations with the specific stage
    const projectId = userStore.getCurrentProject?.id;
    router.push({
      name: 'ProjectLocations',
      params: { id: projectId },
      query: { stageId: stage.id }
    });
  }

  async function deleteStageHour(hour) {
    if (confirm('Are you sure you want to delete this stage hour?')) {
      try {
        const { error } = await supabase
          .from('stage_hours')
          .delete()
          .eq('id', hour.id);
        
        if (error) throw error;
        
        // Remove from local state
        const index = stageHours.value.findIndex(h => h.id === hour.id);
        if (index > -1) {
          stageHours.value.splice(index, 1);
        }
        
        toast.success('Stage hour deleted successfully');
      } catch (error) {
        console.error('Error deleting stage hour:', error);
        toast.error('Failed to delete stage hour');
      }
    }
  }
  
  // Force refresh function for debugging
  async function forceRefresh() {
    console.log('[forceRefresh] Manually refreshing calendar data...');
    await fetchAll();
  }
  async function createNewEvent(newEventData) {
    if (!newEventData.title || !newEventData.event_date || !newEventData.start_time) {
      toast.error("Please fill in title, date & start time.");
      return;
    }
    
    try {
      const eventPayload = {
        project_id: userStore.getCurrentProject.id,
        category: newEventData.category,
        event_date: newEventData.event_date,
        start_time: newEventData.start_time,
        end_date: newEventData.end_date || newEventData.event_date, // Default to start date if no end date
        end_time: newEventData.end_time,
        title: newEventData.title,
        location_id: newEventData.location_id,
        notes: newEventData.notes,
        assigned_contacts: newEventData.assigned_contacts || []
      };
      
      const { error } = await supabase
        .from("calendar_events")
        .insert([eventPayload]);
        
      if (error) {
        console.error('Calendar event creation error:', error);
        toast.error("Failed to create event: " + error.message);
        return;
      }
      
      // Close modal and refresh data
      closeNewEventModal();
      
      // Add a small delay to ensure the database operation is complete
      setTimeout(async () => {
        await fetchAll();
        toast.success("Event created successfully!");
      }, 500);
      
    } catch (err) {
      console.error('Calendar event creation error:', err);
      toast.error("Failed to create event: " + err.message);
    }
  }

  // Helper functions for calendar grid
  function hasEvents(d) {
    return sortedEvents.value.some(e => {
      const eventStart = e.event_date;
      const eventEnd = e.end_date || e.event_date;
      return d >= eventStart && d <= eventEnd;
    });
  }
  function getEventsForDay(d) {
    return sortedEvents.value.filter(e => {
      const eventStart = e.event_date;
      const eventEnd = e.end_date || e.event_date;
      return d >= eventStart && d <= eventEnd;
    });
  }

  // --- NEW: Sync filters and view from route query ---
  function syncFromRoute() {
    const q = route.query;
    if (q.view && typeof q.view === 'string') currentView.value = q.view;
    if (q.date && typeof q.date === 'string') {
      filters.value.dateStart = q.date;
      filters.value.dateEnd = q.date;
      currentDate.value = new Date(q.date);
    }
    if (q.locationId && (typeof q.locationId === 'string' || typeof q.locationId === 'number')) {
      filters.value.location = q.locationId;
    }
  }
  onMounted(() => {
    fetchAll();
    syncFromRoute();
  });
  watch(() => route.query, syncFromRoute);

  async function onEditEvent(event) {
    if (!event.id) { toastMsg.value = "Missing event ID"; return; }
    const { error } = await supabase
      .from("calendar_events")
      .update({
        category: event.category,
        event_date: event.event_date,
        start_time: event.start_time,
        end_date: event.end_date || event.event_date, // Default to start date if no end date
        end_time: event.end_time,
        title: event.title,
        location_id: event.location_id,
        notes: event.notes,
        assigned_contacts: event.assigned_contacts || []
      })
      .eq("id", event.id);
    if (error) {
      toastMsg.value = "Update failed: " + error.message;
      toast.error("Failed to save event changes");
    } else {
      fetchAll();
      toast.success("Event changes saved successfully");
    }
  }

  async function onDeleteEvent(event) {
    if (!event.id) { toast.error("Missing event ID"); return; }
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", event.id);
    if (error) {
      toast.error("Failed to delete event: " + error.message);
    } else {
      fetchAll();
      toast.success("Event deleted successfully");
    }
  }

  return {
    loading, error, calendarError, locationsError, stageHoursError, toastMsg,
    currentView, currentDate, currentDateString,
    filters, updateFilters,
    locations, events, sortedEvents, stageHours, filteredStageHours, contacts,
    eventCategories, categoryColorMap, locationColorMap, getEventColor,
    getStageHoursForDay, getFilteredStageHoursForDay,
    timeSlots, timelineDayEvents, formattedTimelineDate,
    displayCalendarDays, hasEvents, getEventsForDay,
    showDetailsModal, detailsMode, detailsEvent,
    showNewModal,
    openDetailsModal, closeDetailsModal, confirmDelete, saveDetails,
    openNewEventModal, closeNewEventModal, createNewEvent,
    previousDay, nextDay, previousPeriod, nextPeriod,
    weekRangeHeader,
    isCurrentWeek,
    jumpToToday,
    todayDate,
    onEditEvent, onDeleteEvent,
    forceRefresh,
    
  };
}
};
</script>

<style scoped>
/* === GLOBAL & RESET === */
.calendar-page {
font-family: var(--font-family-sans);
color: var(--text-primary);
background: var(--bg-primary);
box-sizing: border-box;
padding: 0 15px;
}

/* === HEADER === */
.header-section {
display: flex;
align-items: center;
justify-content: space-between;
background: var(--bg-secondary);
padding: 1rem 1.5rem;
border-bottom: 2px solid var(--border-medium);
}
.header-section h1 {
margin: 0;
font-size: 1.75rem;
color: var(--text-heading);
}
.button {
background: var(--color-success-500);
color: var(--text-inverse);
border: none;
padding: 0.6rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.button:hover {
background: var(--color-success-600);
}
.add-button {
background: var(--color-success-500);
}

/* === TOAST === */
.toast {
position: fixed;
top: 1rem;
left: 50%;
transform: translateX(-50%);
background: #e74c3c;
color: #fff;
padding: 0.75rem 1.25rem;
border-radius: 4px;
box-shadow: 0 2px 6px rgba(0,0,0,0.15);
z-index: 1000;
}

/* === CONTROLS === */
.controls-section {
padding: 0.75rem 1rem 0.6rem 1rem;
background: var(--bg-primary);
border-bottom: 1px solid var(--border-light);
display: flex;
flex-wrap: wrap;
align-items: center;
gap: 0.6rem 1rem;
}

/* Push the add button to the right on wide screens */
.add-button {
  margin-left: auto;
}

/* === STATUS === */
.status-section {
padding: 0.7rem 1.2rem 0.5rem 1.2rem;
}
.loading-state,
.error-message {
text-align: center;
margin: 0.7rem 0;
color: var(--text-secondary);
}
.spinner {
border: 4px solid var(--bg-secondary);
border-top: 4px solid var(--color-primary-500);
border-radius: 50%;
width: 36px;
height: 36px;
margin: 0 auto 0.5rem;
animation: spin 1s linear infinite;
}
@keyframes spin {
to { transform: rotate(360deg); }
}

/* === GLOBAL PADDING FOR VIEWS === */
.views-container {
padding: 8px 0 0 0;
box-sizing: border-box;
}

/* Make legend more compact */
.legend-standout {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-medium);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  padding: 0.7rem 1.1rem 0.7rem 1.1rem;
  margin-bottom: 0.7rem;
}

/* RESPONSIVE */
@media(max-width:600px){
.controls-section {
  flex-direction: column;
}
}

/* Stage Hours Modal Styles */
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
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-heading);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.close-button:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.stage-hours-item {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--bg-secondary);
}

.stage-name {
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-heading);
}

.hours-list {
  margin-bottom: 1rem;
}

.hour-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: var(--bg-primary);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.time-range {
  font-weight: 500;
  color: var(--color-success-500);
}

.day-id {
  color: #6c757d;
  font-style: italic;
  margin-left: 1rem;
}

.hour-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}
</style> 