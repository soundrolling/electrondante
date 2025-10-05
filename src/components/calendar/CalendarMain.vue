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

    <div class="controls-spacer"></div>
    <button class="btn light-btn" @click="goToProjectHome">
      Project Home
    </button>
    <button class="btn btn-positive add-button" @click="openNewEventModal">
      + Add Event
    </button>
  </section>

  <!-- LEGEND -->
  <CalendarLegend 
    :categories="eventCategories"
    :stage-hours="getStageHoursForDay(currentDateString)"
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
      :contacts="contacts"
      :is-current-week="isCurrentWeek"
      :jump-to-today="jumpToToday"
      :today-date="todayDate"
      @event-click="openDetailsModal"
      @previous-period="previousPeriod"
      @next-period="nextPeriod"
    />

    <!-- TIMELINE VIEW -->
    <CalendarTimelineView
      v-else-if="currentView==='timeline'"
      :timeline-day-events="timelineDayEvents"
      :time-slots="timeSlots"
      :formatted-timeline-date="formattedTimelineDate"
      :stage-hours="getStageHoursForDay(currentDateString)"
      :get-event-color="getEventColor"
      :contacts="contacts"
      @event-click="openDetailsModal"
      @previous-day="previousDay"
      @next-day="nextDay"
    />

    <!-- LIST VIEW -->
    <CalendarListView
      v-else
      :sorted-events="sortedEvents"
      :locations="locations"
      :stage-hours="getStageHoursForDay(currentDateString)"
      :categories="eventCategories"
      :get-event-color="getEventColor"
      :contacts="contacts"
      @event-click="openDetailsModal"
      @edit="onEditEvent"
      @delete="onDeleteEvent"
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
</div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useUserStore } from "../../stores/userStore";
import { fetchTableData } from "../../services/dataService";
import { supabase } from "../../supabase";
import { useRoute, useRouter } from "vue-router";

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
    end_time: "",
    location_id: null,
    notes: ""
  });

  // NEW EVENT MODAL STATE
  const showNewModal = ref(false);

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
      rawCal = await fetchTableData("calendar_events", { eq: { project_id: pid } });
    } catch (e) {
      calendarError.value = "Failed to load calendar events: " + e.message;
    }
    const calData = rawCal.map(c => ({
      id: c.id,
      category: c.category || "calltimes",
      title: c.title,
      event_date: c.event_date,
      start_time: c.start_time,
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
    return stageHours.value.filter(hour => 
      hour.start_datetime.slice(0, 10) === date
    );
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
        hoursByStage[stageKey].push({
          start_time: formatTime(hour.start_datetime),
          end_time: formatTime(hour.end_datetime),
          notes: hour.notes
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
    if (filters.value.dateStart) arr = arr.filter(e => e.event_date >= filters.value.dateStart);
    if (filters.value.dateEnd) arr = arr.filter(e => e.event_date <= filters.value.dateEnd);
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

  // TIMELINE
  const daysWithEvents = computed(() => {
    return Array.from(new Set(sortedEvents.value.map(e => e.event_date))).sort();
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

  // Only show events between 03:00 and 23:59 for today if no explicit filter is set
  const timelineDayEvents = computed(() => {
    let events = sortedEvents.value.filter(e => e.event_date === currentDateString.value && e.start_time && e.end_time);
    if (isToday(currentDate.value) && !filters.value.dateStart && !filters.value.dateEnd) {
      events = events.filter(e => {
        // Compare start_time >= 03:00 and end_time <= 23:59
        return e.start_time >= '03:00' && e.start_time <= '23:59';
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
    if (!detailsEvent.value.id) { toastMsg.value = "Missing ID"; return; }
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("calendar_events")
      .delete().eq("id", detailsEvent.value.id);
    if (error) toastMsg.value = "Delete failed: " + error.message;
    else { closeDetailsModal(); fetchAll(); }
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
        end_time: ev.end_time,
        title: ev.title,
        location_id: ev.location_id,
        notes: ev.notes,
        assigned_contacts: ev.assigned_contacts || []
      })
      .eq("id", ev.id);
    if (error) toastMsg.value = "Update failed: " + error.message;
    else { detailsMode.value = "view"; fetchAll(); }
  }

  function openNewEventModal() {
    showNewModal.value = true;
  }
  function closeNewEventModal() {
    showNewModal.value = false;
  }
  async function createNewEvent(newEventData) {
    if (!newEventData.title || !newEventData.event_date || !newEventData.start_time) {
      toastMsg.value = "Please fill in title, date & start time.";
      return;
    }
    const { error } = await supabase
      .from("calendar_events")
      .insert([{
        project_id: userStore.getCurrentProject.id,
        category: newEventData.category,
        event_date: newEventData.event_date,
        start_time: newEventData.start_time,
        end_time: newEventData.end_time,
        title: newEventData.title,
        location_id: newEventData.location_id,
        notes: newEventData.notes,
        assigned_contacts: newEventData.assigned_contacts || []
      }]);
    if (error) toastMsg.value = "Create failed: " + error.message;
    else { closeNewEventModal(); fetchAll(); }
  }

  // Helper functions for calendar grid
  function hasEvents(d) {
    return sortedEvents.value.some(e => e.event_date === d);
  }
  function getEventsForDay(d) {
    return sortedEvents.value.filter(e => e.event_date === d);
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

  function goToProjectHome() {
    const project = userStore.getCurrentProject;
    if (project?.id) {
      router.push({ name: 'ProjectDetail', params: { id: project.id } });
    }
  }

  async function onEditEvent(event) {
    if (!event.id) { toastMsg.value = "Missing event ID"; return; }
    const { error } = await supabase
      .from("calendar_events")
      .update({
        category: event.category,
        event_date: event.event_date,
        start_time: event.start_time,
        end_time: event.end_time,
        title: event.title,
        location_id: event.location_id,
        notes: event.notes,
        assigned_contacts: event.assigned_contacts || []
      })
      .eq("id", event.id);
    if (error) toastMsg.value = "Update failed: " + error.message;
    else fetchAll();
  }

  async function onDeleteEvent(event) {
    if (!event.id) { toastMsg.value = "Missing event ID"; return; }
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", event.id);
    if (error) toastMsg.value = "Delete failed: " + error.message;
    else fetchAll();
  }

  return {
    loading, error, calendarError, locationsError, stageHoursError, toastMsg,
    currentView, currentDate,
    filters, updateFilters,
    locations, events, sortedEvents, stageHours, contacts,
    eventCategories, categoryColorMap, locationColorMap, getEventColor,
    getStageHoursForDay,
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
    goToProjectHome
  };
}
};
</script>

<style scoped>
/* === GLOBAL & RESET === */
.calendar-page {
font-family: sans-serif;
color: #333;
background: #f9fafb;
box-sizing: border-box;
padding: 0 15px;
}

/* === HEADER === */
.header-section {
display: flex;
align-items: center;
justify-content: space-between;
background: #f0f4f8;
padding: 1rem 1.5rem;
border-bottom: 2px solid #d1d9e6;
}
.header-section h1 {
margin: 0;
font-size: 1.75rem;
}
.button {
background: #27ae60;
color: #fff;
border: none;
padding: 0.6rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.button:hover {
background: #219150;
}
.add-button {
background: #2ecc71;
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
padding: 0.7rem 1.2rem 0.5rem 1.2rem;
background: #fff;
border-bottom: 1px solid #e1e5eb;
display: flex;
flex-wrap: wrap;
gap: 0.7rem;
}

/* === STATUS === */
.status-section {
padding: 0.7rem 1.2rem 0.5rem 1.2rem;
}
.loading-state,
.error-message {
text-align: center;
margin: 0.7rem 0;
color: #555;
}
.spinner {
border: 4px solid #f3f3f3;
border-top: 4px solid #007bff;
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
padding: 6px 0 0 0;
box-sizing: border-box;
}

/* Make legend more compact */
.legend-standout {
  background: #f8fafc;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 0.7rem 1.1rem 0.7rem 1.1rem;
  margin-bottom: 0.7rem;
}

/* RESPONSIVE */
@media(max-width:600px){
.controls-section {
  flex-direction: column;
}
}
</style> 