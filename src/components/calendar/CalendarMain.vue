<template>
<div class="calendar-page">
  <!-- Global header is rendered by App.vue; remove local page header to avoid duplication -->

  <!-- TOAST -->
  <div v-if="toastMsg" class="toast" @click="toastMsg = ''">
    {{ toastMsg }}
  </div>

  <!-- CONTROLS -->
  <section class="controls-section cal-controls">
    <div class="cal-controls-left">
      <CalendarViewSelector v-model="currentView" />
      <CalendarFilters
        :categories="eventCategories"
        :locations="locations"
        :filters="filters"
        :showDateFilters="true"
        @update:filters="updateFilters"
      />
    </div>

    <div class="cal-controls-right">
      <button
        class="cal-refresh-btn"
        @click="forceRefresh"
        aria-label="Refresh calendar"
        title="Refresh"
      >
        <span class="cal-refresh-icon" aria-hidden="true">↻</span>
      </button>
      <div class="cal-export-wrap" ref="exportWrapRef">
        <button
          class="cal-refresh-btn"
          :class="{ open: showExportMenu }"
          @click="showExportMenu = !showExportMenu"
          aria-label="Export calendar"
          title="Export / subscribe"
          :aria-expanded="showExportMenu"
        >
          <span class="cal-refresh-icon" aria-hidden="true">↓</span>
        </button>
        <div v-if="showExportMenu" class="cal-export-menu" role="menu" @click.stop>
          <div class="cal-export-menu-head">
            <div class="cal-export-menu-kicker">Export</div>
            <div class="cal-export-menu-title">Share this calendar</div>
          </div>
          <button class="cal-export-menu-item" role="menuitem" @click="onDownloadIcs">
            <span class="cal-export-menu-item-title">Download .ics file</span>
            <span class="cal-export-menu-item-desc">One-off snapshot for Apple Calendar, Google, Outlook, etc.</span>
          </button>

          <div class="cal-export-menu-divider"></div>

          <!-- Subscribe URL -->
          <div class="cal-export-subscribe">
            <div class="cal-export-subscribe-head">
              <div>
                <div class="cal-export-menu-item-title">Subscribe URL</div>
                <div class="cal-export-menu-item-desc">Auto-updating iCal feed for crew &amp; artists</div>
              </div>
              <span v-if="activeShareToken" class="cal-share-badge live">Live</span>
              <span v-else class="cal-share-badge off">Off</span>
            </div>

            <div v-if="activeShareToken" class="cal-share-urlbox">
              <input
                type="text"
                readonly
                class="cal-share-url"
                :value="activeSubscribeUrl"
                @focus="$event.target.select()"
                aria-label="Subscribe URL"
              />
              <button class="cal-share-copy" @click="onCopySubscribeUrl" :title="copyHint">
                {{ copyHint }}
              </button>
            </div>

            <div class="cal-share-actions">
              <button
                v-if="!activeShareToken"
                class="cal-share-btn primary"
                @click="onCreateShare"
                :disabled="shareBusy"
              >
                {{ shareBusy ? 'Creating…' : 'Enable subscribe URL' }}
              </button>
              <template v-else>
                <a
                  :href="webcalUrl"
                  class="cal-share-btn primary"
                  target="_blank"
                  rel="noopener"
                  title="Opens your default calendar app with one click"
                >
                  Open in calendar
                </a>
                <button
                  class="cal-share-btn"
                  @click="onCreateShare"
                  :disabled="shareBusy"
                  title="Rotate the URL; old subscribers will stop receiving updates"
                >
                  {{ shareBusy ? '…' : 'Regenerate' }}
                </button>
                <button
                  class="cal-share-btn danger"
                  @click="onRevokeShare"
                  :disabled="shareBusy"
                  title="Revoke — existing subscribers 404 on next refresh"
                >
                  Revoke
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
      <button
        class="cal-add-btn desktop-add-button"
        @click="openNewEventModal"
        aria-label="Add new event"
      >
        <span class="cal-add-plus" aria-hidden="true">+</span>
        <span>New event</span>
      </button>
    </div>
  </section>

  <!-- Mobile FAB -->
  <button 
    v-if="!readOnly"
    class="mobile-fab" 
    @click="openNewEventModal"
    aria-label="Add new event"
  >
    <span class="fab-icon">+</span>
  </button>

  <!-- LEGEND -->
  <CalendarLegend 
    :categories="eventCategories"
    :stage-hours="getFilteredStageHoursForDay(currentDateString)"
    :enabledCategories="enabledCategories"
    @update:enabledCategories="updateEnabledCategories"
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

  <!-- Skeleton Loading States -->
  <div v-if="loading && !events.length" class="skeleton-container">
    <div v-for="i in 5" :key="i" class="skeleton-item">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-text"></div>
      <div class="skeleton-line skeleton-text short"></div>
    </div>
  </div>

  <!-- MAIN VIEWS -->
  <section class="views-container">
    <!-- SWIMLANES VIEW -->
    <CalendarSwimlanesView
      v-if="currentView==='swimlanes'"
      :current-date="currentDate"
      :events="sortedEvents"
      :get-event-color="getEventColorRich"
      :locations="locations"
      :contacts="contacts"
      @previous-period="handleMonthNav"
      @next-period="handleMonthNav"
      @jump-to-today="jumpToToday"
      @event-click="openDetailsModal"
    />

    <!-- MONTH VIEW (default) -->
    <CalendarMonthView
      v-else-if="currentView==='month'"
      :current-date="currentDate"
      :get-events-for-day="getEventsForDay"
      :get-event-color="getEventColorRich"
      :get-stage-hours-for-day="getFilteredStageHoursForDay"
      :get-location-name="getLocationName"
      :read-only="readOnly"
      @previous-period="handleMonthNav"
      @next-period="handleMonthNav"
      @jump-to-today="jumpToToday"
      @event-click="openDetailsModal"
      @add-event-for-day="onAddEventForDay"
      @event-reschedule="onEventReschedule"
    />

    <!-- WEEK (grid) VIEW -->
    <CalendarGridView
      v-else-if="currentView==='grid'"
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
      :get-location-name="getLocationName"
      @event-click="openDetailsModal"
      @previous-period="previousPeriod"
      @next-period="nextPeriod"
      @edit-stage-hours="openStageHoursModal"
    >
      <template #event-card="{ event }">
        <slot name="event-card" :event="event"></slot>
      </template>
      <template #day-header="{ date }">
        <slot name="day-header" :date="date"></slot>
      </template>
    </CalendarGridView>

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
      @previous-day="previousDayTimeline"
      @next-day="nextDayTimeline"
      @edit-stage-hours="openStageHoursModal"
    >
      <template #event-card="{ event }">
        <slot name="event-card" :event="event"></slot>
      </template>
      <template #day-header="{ date }">
        <slot name="day-header" :date="date"></slot>
      </template>
    </CalendarTimelineView>

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
      @edit-save="onEditEvent"
      @delete="onDeleteEvent"
      @edit-stage-hours="openStageHoursModal"
    >
      <template #event-card="{ event }">
        <slot name="event-card" :event="event"></slot>
      </template>
    </CalendarListView>
    
    <!-- Empty State Slot -->
    <div v-if="!loading && sortedEvents.length === 0" class="empty-state">
      <slot name="empty-state">
        <p>No events found. Click "Add Event" to create one.</p>
      </slot>
    </div>
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

  <!-- Stage Hours List Modal -->
  <div v-if="showStageHoursModal && !editingStageHour" class="modal-overlay" @click.self="closeStageHoursModal">
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
                  <button class="btn-warning btn-sm" @click="editStageHour(hour, stage)">✏️</button>
                  <button class="btn-danger btn-sm" @click="deleteStageHour(hour)">🗑️</button>
                </div>
              </div>
            </div>
            <button class="btn-primary btn-sm" @click="addStageHour(stage)">+ Add Hours</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Stage Hours Form Modal -->
  <StageHoursModal
    :show="!!editingStageHour || !!selectedStageForHours"
    :stages="locations"
    :editing-hour="editingStageHour"
    :selected-stage="selectedStageForHours"
    @close="closeStageHoursFormModal"
    @save="saveStageHour"
  />

  <!-- Confirmation Modal -->
  <ConfirmationModal
    :show="showConfirmationModal"
    :title="confirmationConfig.title"
    :message="confirmationConfig.message"
    :confirm-text="confirmationConfig.confirmText"
    :cancel-text="confirmationConfig.cancelText"
    @confirm="handleConfirm"
    @cancel="cancelConfirmation"
  />
</div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useUserStore } from "../../stores/userStore";
import { fetchTableData } from "../../services/dataService";
import { supabase } from "../../supabase";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useCalendarEvents } from "../../composables/useCalendarEvents";
import { useCalendarNavigation } from "../../composables/useCalendarNavigation";
import { useCalendarFilters } from "../../composables/useCalendarFilters";

// Import subcomponents
import CalendarViewSelector from "./CalendarViewSelector.vue";
import CalendarFilters from "./CalendarFilters.vue";
import CalendarLegend from "./CalendarLegend.vue";
import CalendarListView from "./CalendarListView.vue";
import CalendarTimelineView from "./CalendarTimelineView.vue";
import CalendarGridView from "./CalendarGridView.vue";
import CalendarMonthView from "./CalendarMonthView.vue";
import CalendarSwimlanesView from "./CalendarSwimlanesView.vue";
import { downloadCalendarICS } from "@/services/icsExportService";
import {
  getActiveShare,
  createShare,
  revokeActiveShare,
  buildSubscribeUrl,
  toWebcalUrl,
} from "@/services/calendarShareService";
import EventDetailsModal from "./EventDetailsModal.vue";
import NewEventModal from "./NewEventModal.vue";
import ConfirmationModal from "./ConfirmationModal.vue";
import StageHoursModal from "./StageHoursModal.vue";


export default {
name: "CalendarMain",
props: {
  projectId: {
    type: [String, Number],
    default: null
  },
  initialView: {
    type: String,
    default: 'grid'
  },
  initialDate: {
    type: [String, Date],
    default: null
  },
  readOnly: {
    type: Boolean,
    default: false
  }
},
components: {
  CalendarViewSelector,
  CalendarFilters,
  CalendarLegend,
  CalendarListView,
  CalendarTimelineView,
  CalendarGridView,
  CalendarMonthView,
  CalendarSwimlanesView,
  EventDetailsModal,
  NewEventModal,
  ConfirmationModal,
  StageHoursModal
},
setup(props, { emit }) {
  const userStore = useUserStore();
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  
  // Project ID for composables - use prop if provided, otherwise from store
  const projectId = computed(() => props.projectId || userStore.getCurrentProject?.id);
  
  // Use composables
  const calendarEvents = useCalendarEvents(projectId, userStore);
  const {
    loading: eventsLoading,
    error: eventsError,
    events,
    allEvents,
    fetchEvents,
    fetchTravelTrips,
    createEvent,
    updateEvent,
    deleteEvent
  } = calendarEvents;
  
  const calendarNavigation = useCalendarNavigation();
  const {
    currentDate,
    currentDateString,
    activeDayIndex,
    weekDaysData,
    displayCalendarDays,
    weekRangeHeader,
    currentWeekDates,
    todayDate,
    isCurrentWeek,
    jumpToToday,
    previousDay,
    nextDay,
    previousPeriod,
    nextPeriod,
    navigateToDayIndex
  } = calendarNavigation;

  const locations = ref([]);
  const stageHours = ref([]);
  const contacts = ref([]);
  const loading = ref(true);
  const error = ref("");
  const calendarError = ref("");
  const locationsError = ref("");
  const stageHoursError = ref("");
  const toastMsg = ref("");

  const currentView = ref(props.initialView || "month");
  
  // Watch for view changes and emit event
  watch(currentView, (newView) => {
    emit('view-changed', newView);
  });
  
  // Watch for date changes and emit event
  watch(currentDate, (newDate) => {
    emit('date-changed', newDate);
  });

  // Category color system - consistent palette for light/dark mode
  const categoryColors = {
    calltimes: { bg: '#dcfce7', border: '#22c55e', text: '#166534', main: '#22c55e' },
    wraptimes: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', main: '#f59e0b' },
    artisttimes: { bg: '#e0e7ff', border: '#6366f1', text: '#312e81', main: '#6366f1' },
    deliveries: { bg: '#fce7f3', border: '#ec4899', text: '#831843', main: '#ec4899' },
    recording: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', main: '#ef4444' },
    meeting: { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', main: '#3b82f6' },
    setup: { bg: '#f3f4f6', border: '#6b7280', text: '#1f2937', main: '#6b7280' },
    showday: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', main: '#f59e0b' },
    travel: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e', main: '#0ea5e9' },
    other: { bg: '#f5f5f5', border: '#9ca3af', text: '#374151', main: '#9ca3af' }
  };

  // Event categories with icons and colors
  const eventCategories = [
    { id: 'calltimes', label: 'Call Times', icon: '⏰', color: categoryColors.calltimes.main },
    { id: 'wraptimes', label: 'Wrap Times', icon: '🔚', color: categoryColors.wraptimes.main },
    { id: 'artisttimes', label: 'Artist Times', icon: '🎨', color: categoryColors.artisttimes.main },
    { id: 'deliveries', label: 'Deliveries', icon: '📦', color: categoryColors.deliveries.main },
    { id: 'recording', label: 'Recording', icon: '🎤', color: categoryColors.recording.main },
    { id: 'meeting', label: 'Meeting', icon: '👥', color: categoryColors.meeting.main },
    { id: 'setup', label: 'Setup/Breakdown', icon: '🛠️', color: categoryColors.setup.main },
    { id: 'showday', label: 'Show Day', icon: '🎭', color: categoryColors.showday.main },
    { id: 'travel', label: 'Travel', icon: '✈️', color: categoryColors.travel.main },
    { id: 'other', label: 'Other', icon: '❓', color: categoryColors.other.main }
  ];

  // Initialize enabledCategories with all categories enabled by default
  const initializeEnabledCategories = () => {
    const defaultEnabled = {};
    eventCategories.forEach(cat => {
      defaultEnabled[cat.id] = true;
    });
    return defaultEnabled;
  };

  const enabledCategories = ref(initializeEnabledCategories());

  // Use filters composable
  const calendarFilters = useCalendarFilters(allEvents, enabledCategories, route);
  const {
    filters,
    filteredEvents,
    sortedEvents,
    resetFilters,
    syncFromRoute,
    autoCalculateFilterRange
  } = calendarFilters;

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
  const editingStageHour = ref(null);
  const selectedStageForHours = ref(null);

  // CONFIRMATION MODAL STATE
  const showConfirmationModal = ref(false);
  const confirmationConfig = ref({
    title: 'Confirm Action',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null
  });

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

    // Fetch events using composable
    try {
      await fetchEvents();
      await fetchTravelTrips();
      calendarError.value = eventsError.value || "";
    } catch (e) {
      console.error('[fetchAll] Calendar events error:', e);
      calendarError.value = "Failed to load calendar events: " + e.message;
    }

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

    // Note: Travel trips are already fetched via fetchTravelTrips() composable above
    
    // Auto-calculate filter range to include all days with events
    if (allEvents.value.length > 0) {
      autoCalculateFilterRange(allEvents.value);
    }
    
    loading.value = false;
  }

  // FORMATTING HELPERS
  function formatDate(ds) {
    if (!ds) return "";
    // Append T12:00 for date-only strings to prevent timezone-related date shifts
    const dateStr = ds.length === 10 ? ds + 'T12:00:00' : ds;
    return new Date(dateStr).toLocaleDateString("en-US", {
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
    // Use category color from the new system
    if (ev.category && categoryColors[ev.category]) {
      return categoryColors[ev.category].main;
    }

    // Fallback to location color if category not found
    const l = locations.value.find(x => x.id === ev.location_id);
    const label = l ? `${l.venue_name} - ${l.stage_name}` : "Unspecified";
    return locationColorMap.value[label] || "#bdc3c7";
  }

  // Rich colour helper used by the new Month view. Returns bg / border /
  // text so the month-grid chips can render coloured blocks while keeping
  // the single-hex getEventColor signature intact for the existing views.
  function getEventColorRich(ev) {
    const c = ev?.category && categoryColors[ev.category]
    if (c) return { bg: c.bg, borderColor: c.border, color: c.text }
    const l = locations.value.find(x => x.id === ev?.location_id)
    const label = l ? `${l.venue_name} - ${l.stage_name}` : 'Unspecified'
    const main = locationColorMap.value[label] || '#bdc3c7'
    return { bg: main + '22', borderColor: main, color: '#1f2937' }
  }

  // Month view navigation — advances currentDate by a whole month.
  function handleMonthNav(nextDate) {
    if (nextDate instanceof Date && !isNaN(nextDate)) {
      currentDate.value = nextDate
    }
  }
  // Month view "Add event" from the day panel — prefill the date.
  const prefilledEventDate = ref(null)
  function onAddEventForDay(iso) {
    prefilledEventDate.value = iso
    openNewEventModal()
  }

  // Month view drag-to-reschedule. The child emits { event, newDate,
  // newEndDate, daysDelta } — we keep the existing start_time/end_time
  // (just the date moves), preserve duration, and optimistically update
  // local state before the network round-trip so the chip lands on the
  // target cell immediately.
  async function onEventReschedule({ event, newDate, newEndDate }) {
    if (!event || !event.id || event.isSynthetic) return
    const prevEventDate = event.event_date
    const prevEndDate = event.end_date
    // Optimistic: mutate the live event object so the grid re-renders now
    event.event_date = newDate
    event.end_date = newEndDate
    const payload = {
      category: event.category,
      title: event.title,
      event_date: newDate,
      end_date: newEndDate,
      start_time: event.start_time,
      end_time: event.end_time,
      location_id: event.location_id,
      notes: event.notes,
      assigned_contacts: event.assigned_contacts || [],
    }
    const ok = await updateEvent(event.id, payload)
    if (!ok) {
      // Roll back
      event.event_date = prevEventDate
      event.end_date = prevEndDate
    }
  }

  /* ─── .ics export + subscribe URL ──────────────────── */
  const showExportMenu = ref(false)
  const exportWrapRef = ref(null)

  const activeShareToken = ref(null)
  const shareBusy = ref(false)
  const copyHint = ref('Copy')

  const activeSubscribeUrl = computed(() =>
    activeShareToken.value ? buildSubscribeUrl(activeShareToken.value) : ''
  )
  const webcalUrl = computed(() => toWebcalUrl(activeSubscribeUrl.value))

  async function refreshActiveShare() {
    if (!props.projectId) return
    try {
      const row = await getActiveShare(props.projectId)
      activeShareToken.value = row?.token || null
    } catch (err) {
      console.warn('[Calendar] refreshActiveShare failed', err)
    }
  }

  async function onCreateShare() {
    if (!props.projectId || shareBusy.value) return
    shareBusy.value = true
    try {
      const row = await createShare(props.projectId, userStore.getUserId || null)
      activeShareToken.value = row?.token || null
      toastMsg.value = 'Subscribe URL ready'
      setTimeout(() => { toastMsg.value = '' }, 3000)
    } catch (err) {
      console.error('[Calendar] createShare failed', err)
      toastMsg.value = 'Failed to create subscribe URL'
    } finally {
      shareBusy.value = false
    }
  }

  async function onRevokeShare() {
    if (!props.projectId || shareBusy.value) return
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('Revoke the current subscribe URL? Anyone using it will stop receiving updates.')) return
    }
    shareBusy.value = true
    try {
      await revokeActiveShare(props.projectId)
      activeShareToken.value = null
      toastMsg.value = 'Subscribe URL revoked'
      setTimeout(() => { toastMsg.value = '' }, 3000)
    } catch (err) {
      console.error('[Calendar] revokeActiveShare failed', err)
    } finally {
      shareBusy.value = false
    }
  }

  async function onCopySubscribeUrl() {
    const url = activeSubscribeUrl.value
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      copyHint.value = 'Copied'
      setTimeout(() => { copyHint.value = 'Copy' }, 1500)
    } catch {
      copyHint.value = 'Tap and hold to copy'
      setTimeout(() => { copyHint.value = 'Copy' }, 2500)
    }
  }

  // Fetch the current share token whenever the menu is first opened
  watch(showExportMenu, (open) => {
    if (open && activeShareToken.value === null && props.projectId) {
      refreshActiveShare()
    }
  })

  function onExportClickOutside(e) {
    if (!showExportMenu.value) return
    const wrap = exportWrapRef.value
    if (wrap && !wrap.contains(e.target)) showExportMenu.value = false
  }
  function onExportEsc(e) {
    if (e.key === 'Escape') showExportMenu.value = false
  }

  function calendarExportName() {
    const project = userStore.getCurrentProject
    const parts = []
    if (project?.project_name) parts.push(project.project_name)
    // Use the first location as the calendar subtitle if only one exists
    if (locations.value?.length === 1) {
      const l = locations.value[0]
      const tail = [l.venue_name, l.stage_name].filter(Boolean).join(' · ')
      if (tail) parts.push(tail)
    }
    return parts.join(' · ') || 'Show calendar'
  }

  async function onDownloadIcs() {
    showExportMenu.value = false
    try {
      const project = userStore.getCurrentProject
      const result = downloadCalendarICS({
        calName: calendarExportName(),
        projectId: project?.id || props.projectId || 'project',
        events: allEvents.value || [],
        locations: locations.value || [],
      })
      toastMsg.value = `Exported ${result.filename}`
      setTimeout(() => { toastMsg.value = '' }, 3000)
    } catch (err) {
      console.error('ICS export failed:', err)
      toastMsg.value = 'Failed to export calendar'
    }
  }

  function getLocationName(locationId) {
    if (!locationId) return "—";
    const l = locations.value.find(x => x.id === locationId);
    return l ? `${l.venue_name} - ${l.stage_name}` : "—";
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

  // Helper to extract time in HH:mm from ISO/datetime string without timezone conversion
  function extractTimeFromISO(isoString) {
    if (!isoString) return '';
    // Parse directly from string "YYYY-MM-DDTHH:mm:ss" to avoid timezone issues
    const timePart = isoString.slice(11, 16);
    return timePart || '';
  }

  // allEvents, filteredEvents, and sortedEvents are now provided by composables

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
        // EXCEPT for all-day events (00:00 to 23:59), which should always be shown
        if (e.event_date === currentDate) {
          const isAllDay = e.start_time === '00:00' && e.end_time === '23:59';
          if (isAllDay) return true;
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

  // Timeline-specific day navigation
  function previousDayTimeline() {
    if (activeDayIndex.value > 0) {
      navigateToDayIndex(activeDayIndex.value - 1, daysWithEvents.value);
    }
  }
  
  function nextDayTimeline() {
    if (activeDayIndex.value < daysWithEvents.value.length - 1) {
      navigateToDayIndex(activeDayIndex.value + 1, daysWithEvents.value);
    }
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
    // Use immediate update for date filters to avoid delay
    const isDateFilter = newFilters.dateStart !== undefined || newFilters.dateEnd !== undefined;
    calendarFilters.updateFilters(newFilters, isDateFilter);
  }

  function openDetailsModal(evt) {
    detailsEvent.value = { ...evt };
    detailsMode.value = "view";
    showDetailsModal.value = true;
  }
  function closeDetailsModal() {
    showDetailsModal.value = false;
  }
  // Show confirmation modal
  function showConfirmation(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      let resolved = false;
      confirmationConfig.value = {
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          if (!resolved) {
            resolved = true;
            showConfirmationModal.value = false;
            resolve(true);
          }
        },
        onCancel: () => {
          if (!resolved) {
            resolved = true;
            showConfirmationModal.value = false;
            resolve(false);
          }
        }
      };
      showConfirmationModal.value = true;
    });
  }

  function handleConfirm() {
    if (confirmationConfig.value.onConfirm) {
      confirmationConfig.value.onConfirm();
    }
  }

  function cancelConfirmation() {
    if (confirmationConfig.value.onCancel) {
      confirmationConfig.value.onCancel();
    }
  }

  async function confirmDelete() {
    // Don't allow deleting synthetic events (travel, build days)
    if (detailsEvent.value.isSynthetic) {
      if (detailsEvent.value.category === 'travel') {
        toast.info("Travel events cannot be deleted from the calendar. Please manage them in the Travel section.");
      } else {
        toast.info("This event cannot be deleted from the calendar as it is automatically generated.");
      }
      closeDetailsModal();
      return;
    }
    
    if (!detailsEvent.value.id) { 
      toast.error("Missing ID"); 
      return; 
    }
    
    const confirmed = await showConfirmation(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      "Delete",
      "Cancel"
    );
    
    if (!confirmed) return;
    
    const success = await deleteEvent(detailsEvent.value.id);
    if (success) {
      closeDetailsModal(); 
      emit('event-deleted', detailsEvent.value.id);
      // Refresh other data
      await fetchAll();
    }
  }
  async function saveDetails() {
    const ev = detailsEvent.value;
    
    // Don't allow saving synthetic events
    if (ev.isSynthetic) {
      if (ev.category === 'travel') {
        toast.info("Travel events cannot be edited from the calendar. Please manage them in the Travel section.");
      } else {
        toast.info("This event cannot be edited from the calendar as it is automatically generated.");
      }
      detailsMode.value = "view";
      return;
    }
    
    if (!ev.id) { 
      toastMsg.value = "Missing ID"; 
      return; 
    }
    
    const success = await updateEvent(ev.id, ev);
    if (success) {
      detailsMode.value = "view"; 
      closeDetailsModal();
      emit('event-updated', ev);
      // Refresh other data
      await fetchAll();
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
    editingStageHour.value = hour;
    selectedStageForHours.value = stage;
    showStageHoursModal.value = false; // Hide list modal, show form modal
  }

  function addStageHour(stage) {
    editingStageHour.value = null;
    selectedStageForHours.value = stage;
    showStageHoursModal.value = false; // Hide list modal, show form modal
  }

  function closeStageHoursFormModal() {
    editingStageHour.value = null;
    selectedStageForHours.value = null;
  }

  async function saveStageHour(payload) {
    try {
      const projectId = userStore.getCurrentProject?.id;
      if (!projectId) {
        toast.error("No project selected");
        return;
      }

      const stageHourData = {
        project_id: projectId,
        stage_id: payload.stage_id,
        start_datetime: payload.start_datetime,
        end_datetime: payload.end_datetime,
        notes: payload.notes || null
      };

      if (payload.id) {
        // Update existing
        const { error } = await supabase
          .from('stage_hours')
          .update(stageHourData)
          .eq('id', payload.id);
        
        if (error) throw error;
        
        // Update local state
        const index = stageHours.value.findIndex(h => h.id === payload.id);
        if (index > -1) {
          Object.assign(stageHours.value[index], { ...stageHourData, id: payload.id });
        }
        
        toast.success('Stage hour updated successfully');
      } else {
        // Create new
        const { data, error } = await supabase
          .from('stage_hours')
          .insert([stageHourData])
          .select()
          .single();
        
        if (error) throw error;
        
        // Add to local state
        stageHours.value.push(data);
        
        toast.success('Stage hour created successfully');
      }
      
      closeStageHoursFormModal();
    } catch (error) {
      console.error('Error saving stage hour:', error);
      toast.error('Failed to save stage hour: ' + error.message);
    }
  }

  async function deleteStageHour(hour) {
    const confirmed = await showConfirmation(
      "Delete Stage Hour",
      "Are you sure you want to delete this stage hour? This action cannot be undone.",
      "Delete",
      "Cancel"
    );
    
    if (!confirmed) return;
    
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

  // Load enabled categories from user preferences
  async function loadEnabledCategories() {
    try {
      await userStore.fetchUserProfile();
      if (userStore.userProfile && userStore.userProfile.calendar_event_toggles) {
        const savedToggles = userStore.userProfile.calendar_event_toggles;
        // Merge saved toggles with defaults (in case new categories were added)
        const merged = initializeEnabledCategories();
        Object.keys(savedToggles).forEach(catId => {
          if (merged.hasOwnProperty(catId)) {
            merged[catId] = savedToggles[catId];
          }
        });
        enabledCategories.value = merged;
      }
    } catch (e) {
      console.error('Failed to load enabled categories:', e);
      // Use defaults on error
    }
  }

  // Save enabled categories to user preferences
  async function saveEnabledCategories() {
    try {
      const currentProfile = userStore.userProfile || {};
      await userStore.upsertUserProfile({
        ...currentProfile,
        calendar_event_toggles: enabledCategories.value
      });
    } catch (e) {
      console.error('Failed to save enabled categories:', e);
      toast.error('Failed to save event visibility preferences');
    }
  }

  // Handle enabled categories update from CalendarLegend
  async function updateEnabledCategories(newEnabledCategories) {
    // Update the ref immediately to trigger reactivity
    enabledCategories.value = { ...newEnabledCategories };
    // Save asynchronously (non-blocking)
    saveEnabledCategories().catch(e => {
      console.error('Failed to save enabled categories:', e);
    });
  }

  // Sync filters and view from route query (using composable function)
  // Reset filters when project changes
  function resetFiltersForProject() {
    calendarFilters.resetFilters();
  }

  // Watch for project changes
  watch(
    () => userStore.getCurrentProject?.id,
    (newProjectId, oldProjectId) => {
      if (newProjectId && newProjectId !== oldProjectId) {
        resetFiltersForProject();
        fetchAll();
      }
    }
  );

  // Sync view from route
  function syncViewFromRoute() {
    const q = route.query;
    if (q.view && typeof q.view === 'string' && ['grid', 'timeline', 'list'].includes(q.view)) {
      currentView.value = q.view;
    }
  }

  onMounted(async () => {
    await loadEnabledCategories();
    fetchAll();
    calendarFilters.syncFromRoute();
    syncViewFromRoute();
    // Initialize date if provided
    if (props.initialDate) {
      calendarNavigation.goToDate(props.initialDate);
    }
    document.addEventListener('click', onExportClickOutside);
    document.addEventListener('keydown', onExportEsc);
  });

  onUnmounted(() => {
    document.removeEventListener('click', onExportClickOutside);
    document.removeEventListener('keydown', onExportEsc);
  });
  
  watch(() => route.query, () => {
    calendarFilters.syncFromRoute();
    syncViewFromRoute();
  });

  async function onEditEvent(event) {
    // Don't allow editing synthetic events
    if (event.isSynthetic) {
      if (event.category === 'travel') {
        toast.info("Travel events cannot be edited from the calendar. Please manage them in the Travel section.");
      } else {
        toast.info("This event cannot be edited from the calendar as it is automatically generated.");
      }
      return;
    }
    
    if (!event.id) { 
      toastMsg.value = "Missing event ID"; 
      return; 
    }
    
    const success = await updateEvent(event.id, event);
    if (success) {
      await fetchAll();
    }
  }

  async function onDeleteEvent(event) {
    // Don't allow deleting synthetic events (travel, build days)
    if (event.isSynthetic) {
      if (event.category === 'travel') {
        toast.info("Travel events cannot be deleted from the calendar. Please manage them in the Travel section.");
      } else {
        toast.info("This event cannot be deleted from the calendar as it is automatically generated.");
      }
      return;
    }
    
    if (!event.id) { 
      toast.error("Missing event ID"); 
      return; 
    }
    
    const confirmed = await showConfirmation(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      "Delete",
      "Cancel"
    );
    
    if (!confirmed) return;
    
    const success = await deleteEvent(event.id);
    if (success) {
      await fetchAll();
    }
  }

  return {
    loading, error, calendarError, locationsError, stageHoursError, toastMsg,
    currentView, currentDate, currentDateString,
    filters, updateFilters,
    locations, events, sortedEvents, stageHours, filteredStageHours, contacts,
    eventCategories, categoryColors, categoryColorMap, locationColorMap, getEventColor, getEventColorRich, getLocationName,
    getStageHoursForDay, getFilteredStageHoursForDay,
    handleMonthNav, onAddEventForDay, onEventReschedule,
    showExportMenu, exportWrapRef, onDownloadIcs,
    activeShareToken, activeSubscribeUrl, webcalUrl, shareBusy, copyHint,
    onCreateShare, onRevokeShare, onCopySubscribeUrl,
    timeSlots, timelineDayEvents, formattedTimelineDate,
    displayCalendarDays, hasEvents, getEventsForDay,
    showDetailsModal, detailsMode, detailsEvent,
    showNewModal,
    showConfirmationModal, confirmationConfig, handleConfirm, cancelConfirmation,
    openDetailsModal, closeDetailsModal, confirmDelete, saveDetails,
    openNewEventModal, closeNewEventModal, createNewEvent,
    previousDay: previousDayTimeline, nextDay: nextDayTimeline, previousPeriod, nextPeriod,
    weekRangeHeader,
    isCurrentWeek,
    jumpToToday,
    todayDate,
    onEditEvent, onDeleteEvent,
    forceRefresh,
    enabledCategories, updateEnabledCategories,
    showStageHoursModal, openStageHoursModal, closeStageHoursModal,
    getStageHoursForStage, formatDateTime, editStageHour, addStageHour, deleteStageHour,
    editingStageHour, selectedStageForHours, closeStageHoursFormModal, saveStageHour,
    
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

/* ─── Modernised controls bar (Phase 1) ───────────────── */
.cal-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  flex-wrap: wrap;
}
.cal-controls-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
}
.cal-controls-right {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}
.cal-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-base);
  line-height: 1;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  font-family: inherit;
}
.cal-refresh-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.cal-refresh-icon { font-size: var(--text-lg); }
.cal-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 36px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-fast);
  font-family: inherit;
}
.cal-add-btn:hover {
  background: var(--color-primary-600);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}
.cal-add-btn:active { transform: scale(0.98); }
.cal-add-plus {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  line-height: 1;
}
@media (max-width: 640px) {
  .cal-controls-left { flex-wrap: wrap; gap: var(--space-2); }
  .cal-add-btn span:not(.cal-add-plus) { display: none; }
  .cal-add-btn { padding: 0; width: 36px; justify-content: center; }
}

/* Export menu popover */
.cal-export-wrap {
  position: relative;
  display: inline-flex;
}
.cal-refresh-btn.open {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.cal-export-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 260px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: var(--z-popover);
  animation: cal-pop-in 120ms ease-out;
}
@keyframes cal-pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.cal-export-menu-head {
  padding: 8px 10px 6px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 4px;
}
.cal-export-menu-kicker {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}
.cal-export-menu-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin-top: 2px;
}
.cal-export-menu-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 10px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition-fast), border-color var(--transition-normal);
}
.cal-export-menu-item:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border);
}
.cal-export-menu-item-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
}
.cal-export-menu-item-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: 1.4;
}
.cal-export-menu-hint {
  padding: 8px 10px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--surface-border);
  line-height: 1.4;
}
.cal-export-menu-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 6px 4px;
}

.cal-export-subscribe {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cal-export-subscribe-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}
.cal-share-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.cal-share-badge.live {
  background: color-mix(in srgb, var(--color-success-500) 15%, transparent);
  color: var(--color-success-700);
}
.cal-share-badge.off {
  background: var(--chip-bg);
  color: var(--text-tertiary);
}
.cal-share-urlbox {
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.cal-share-url {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-family-mono);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cal-share-url:focus {
  outline: none;
  border-color: var(--color-primary-300);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.cal-share-copy {
  flex-shrink: 0;
  padding: 6px 10px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.cal-share-copy:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.cal-share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cal-share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  height: 32px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.cal-share-btn:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.cal-share-btn.primary {
  background: var(--color-primary-500);
  border-color: var(--color-primary-600);
  color: #ffffff;
}
.cal-share-btn.primary:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.cal-share-btn.danger {
  color: var(--color-error-600);
  border-color: var(--color-error-200);
}
.cal-share-btn.danger:hover:not(:disabled) {
  background: var(--color-error-50);
  color: var(--color-error-700);
  border-color: var(--color-error-300);
}
.cal-share-btn:disabled { opacity: 0.55; cursor: not-allowed; }

@media (max-width: 640px) {
  .cal-export-menu {
    left: auto;
    right: 0;
    min-width: 240px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cal-export-menu { animation: none; }
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

/* Mobile FAB */
.mobile-fab {
  display: none;
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-success-500);
  color: var(--text-inverse);
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  z-index: 100;
  transition: transform 0.2s, box-shadow 0.2s;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  min-width: 56px;
}

.mobile-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.mobile-fab:active {
  transform: scale(0.95);
}

.fab-icon {
  font-size: 2rem;
  line-height: 1;
  font-weight: 300;
}

/* RESPONSIVE */
@media (max-width: 768px) {
  .controls-section {
    flex-direction: column;
  }
  
  .desktop-add-button,
  .desktop-refresh-button {
    display: none;
  }
  
  .mobile-fab {
    display: flex;
  }
}

@media (min-width: 769px) {
  .mobile-fab {
    display: none;
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

/* Keyboard navigation support */
.calendar-page:focus-within {
  outline: none;
}

/* Focus visible styles for accessibility */
button:focus-visible,
.event-list-item:focus-visible,
.timeline-event:focus-visible,
.schedule-item:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
</style> 