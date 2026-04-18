<template>
<div class="cmv">
  <!-- Month header: prev / title / today / next -->
  <header class="cmv-head">
    <div class="cmv-title-row">
      <button class="cmv-nav-btn" @click="prevMonth" aria-label="Previous month" title="Previous month">
        <ChevronLeft :size="18" :stroke-width="2" />
      </button>
      <div class="cmv-title-group">
        <h2 class="cmv-title">{{ monthLabel }}</h2>
        <p v-if="eventsThisMonth" class="cmv-subtitle">
          {{ eventsThisMonth }} event{{ eventsThisMonth === 1 ? '' : 's' }} this month
        </p>
      </div>
      <button class="cmv-nav-btn" @click="nextMonth" aria-label="Next month" title="Next month">
        <ChevronRight :size="18" :stroke-width="2" />
      </button>
    </div>
    <button
      class="cmv-today-btn"
      :class="{ disabled: isCurrentMonth }"
      :disabled="isCurrentMonth"
      @click="jumpToToday"
      title="Jump to current month"
    >
      <CalendarCheck :size="14" :stroke-width="2" />
      <span>Today</span>
    </button>
  </header>

  <!-- Weekday row -->
  <div class="cmv-weekdays" aria-hidden="true">
    <div v-for="(wd, i) in weekdayLabels" :key="wd" :class="['cmv-weekday', { weekend: i === 0 || i === 6 }]">
      {{ wd }}
    </div>
  </div>

  <!-- The grid -->
  <div class="cmv-grid" role="grid" :aria-label="monthLabel">
    <button
      v-for="cell in cells"
      :key="cell.iso"
      type="button"
      role="gridcell"
      :class="[
        'cmv-day',
        {
          'out-of-month': !cell.inMonth,
          'is-today':     cell.isToday,
          'is-weekend':   cell.isWeekend,
          'is-selected':  cell.iso === selectedIso,
          'has-events':   cell.events.length > 0,
        }
      ]"
      :aria-label="cell.ariaLabel"
      :aria-current="cell.isToday ? 'date' : undefined"
      @click="onDayClick(cell)"
    >
      <div class="cmv-day-top">
        <span class="cmv-day-num">{{ cell.day }}</span>
        <span v-if="cell.events.length > 0" class="cmv-day-count">{{ cell.events.length }}</span>
      </div>
      <ul class="cmv-day-events">
        <li
          v-for="ev in cell.visibleEvents"
          :key="ev.id"
          class="cmv-event-chip"
          :style="chipStyle(ev)"
          :title="chipTitle(ev)"
          @click.stop="onEventClick(ev)"
        >
          <span v-if="ev.start_time && ev.start_time !== '00:00'" class="cmv-event-time">{{ shortTime(ev.start_time) }}</span>
          <span class="cmv-event-title">{{ ev.title }}</span>
        </li>
        <li
          v-if="cell.events.length > cell.visibleEvents.length"
          class="cmv-more"
          @click.stop="onDayClick(cell)"
        >
          +{{ cell.events.length - cell.visibleEvents.length }} more
        </li>
      </ul>
    </button>
  </div>

  <!-- Day detail panel (desktop side) / bottom sheet (mobile) -->
  <Teleport to="body">
    <div
      v-if="selectedIso"
      class="cmv-day-panel-backdrop"
      @click.self="closeDayPanel"
    >
      <aside class="cmv-day-panel" role="dialog" :aria-label="selectedPanelLabel">
        <header class="cmv-day-panel-head">
          <div>
            <div class="cmv-day-panel-kicker">{{ selectedDayWeekday }}</div>
            <h3 class="cmv-day-panel-title">{{ selectedDayLabel }}</h3>
            <p v-if="selectedDayEvents.length" class="cmv-day-panel-count">
              {{ selectedDayEvents.length }} event{{ selectedDayEvents.length === 1 ? '' : 's' }}
            </p>
            <p v-else class="cmv-day-panel-count muted">No events scheduled</p>
          </div>
          <button class="cmv-day-panel-close" @click="closeDayPanel" aria-label="Close day panel">
            <X :size="18" :stroke-width="2" />
          </button>
        </header>

        <div class="cmv-day-panel-body">
          <div v-if="selectedDayStageHours.length" class="cmv-stage-hours">
            <div class="cmv-section-kicker">
              <Clock :size="12" :stroke-width="2" />
              Stage hours
            </div>
            <ul class="cmv-stage-hours-list">
              <li v-for="sh in selectedDayStageHours" :key="sh.id" class="cmv-stage-row">
                <span class="cmv-stage-name">{{ sh.stageName || 'Stage' }}</span>
                <span class="cmv-stage-time">
                  {{ formatHour(sh.start_datetime) }} – {{ formatHour(sh.end_datetime) }}
                </span>
              </li>
            </ul>
          </div>

          <ul v-if="selectedDayEvents.length" class="cmv-day-events-list">
            <li
              v-for="ev in selectedDayEvents"
              :key="ev.id"
              class="cmv-day-event"
              :style="{ borderLeftColor: eventBg(ev).borderColor }"
              @click="onEventClick(ev)"
            >
              <div class="cmv-day-event-top">
                <span class="cmv-day-event-cat" :style="catChipStyle(ev)">
                  {{ ev.category }}
                </span>
                <span v-if="ev.start_time && ev.start_time !== '00:00'" class="cmv-day-event-time">
                  {{ shortTime(ev.start_time) }}<template v-if="ev.end_time && ev.end_time !== '00:00' && ev.end_time !== ev.start_time"> – {{ shortTime(ev.end_time) }}</template>
                </span>
                <span v-else class="cmv-day-event-time">All day</span>
              </div>
              <div class="cmv-day-event-title">{{ ev.title }}</div>
              <div v-if="ev.location_id && getLocationName" class="cmv-day-event-meta">
                <MapPin :size="12" :stroke-width="2" />
                {{ getLocationName(ev.location_id) }}
              </div>
              <p v-if="ev.notes" class="cmv-day-event-notes">{{ ev.notes }}</p>
            </li>
          </ul>

          <div v-else class="cmv-day-empty">
            <div class="cmv-day-empty-icon">
              <CalendarDays :size="22" :stroke-width="1.5" />
            </div>
            <p class="cmv-day-empty-text">Nothing scheduled for this day.</p>
          </div>

          <button
            v-if="!readOnly"
            class="cmv-add-event-btn"
            @click="onAddEventForDay"
          >
            <Plus :size="16" :stroke-width="2" />
            <span>Add event on {{ selectedDayShort }}</span>
          </button>
        </div>
      </aside>
    </div>
  </Teleport>
</div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  CalendarDays,
  MapPin,
  Clock,
  Plus,
  X,
} from 'lucide-vue-next'

const props = defineProps({
  // Absolute anchor for the displayed month. Changing it re-renders.
  currentDate:    { type: Date, required: true },
  // (date: Date|string) -> Event[]
  getEventsForDay: { type: Function, required: true },
  // (event) -> { bg, borderColor, color } — same shape as classic getEventColor
  getEventColor:   { type: Function, required: true },
  // (date: Date|string) -> StageHour[]
  getStageHoursForDay: { type: Function, default: null },
  // (locationId) -> string
  getLocationName: { type: Function, default: null },
  readOnly:        { type: Boolean, default: false },
})

const emit = defineEmits([
  'previous-period',
  'next-period',
  'jump-to-today',
  'event-click',
  'add-event-for-day',
])

/* ─── Month math ──────────────────────────────────────── */
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthLabel = computed(() =>
  props.currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return (
    now.getFullYear() === props.currentDate.getFullYear() &&
    now.getMonth() === props.currentDate.getMonth()
  )
})

function toIso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const cells = computed(() => {
  const anchor = props.currentDate
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const first = new Date(year, month, 1)
  const gridStart = new Date(first)
  gridStart.setDate(1 - first.getDay()) // back-up to Sunday
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const out = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const iso = toIso(d)
    const dow = d.getDay()
    const dayEvents = props.getEventsForDay(d) || []
    out.push({
      date: d,
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: d.getTime() === today.getTime(),
      isWeekend: dow === 0 || dow === 6,
      events: dayEvents,
      visibleEvents: dayEvents.slice(0, 3),
      ariaLabel: d.toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }) + (dayEvents.length ? ` · ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''),
    })
  }
  return out
})

const eventsThisMonth = computed(() =>
  cells.value
    .filter(c => c.inMonth)
    .reduce((sum, c) => sum + c.events.length, 0)
)

function prevMonth() {
  const d = new Date(props.currentDate)
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  emit('previous-period', d)
}
function nextMonth() {
  const d = new Date(props.currentDate)
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  emit('next-period', d)
}
function jumpToToday() {
  emit('jump-to-today')
}

/* ─── Day detail panel state ──────────────────────────── */
const selectedIso = ref(null)

function onDayClick(cell) {
  selectedIso.value = cell.iso
}
function closeDayPanel() {
  selectedIso.value = null
}

// Re-close the panel whenever the month anchor shifts
watch(() => props.currentDate, () => { selectedIso.value = null })

const selectedDayEvents = computed(() => {
  if (!selectedIso.value) return []
  const c = cells.value.find(c => c.iso === selectedIso.value)
  return c ? c.events : []
})

const selectedDayStageHours = computed(() => {
  if (!selectedIso.value || !props.getStageHoursForDay) return []
  try {
    return props.getStageHoursForDay(selectedIso.value) || []
  } catch {
    return []
  }
})

const selectedDayWeekday = computed(() => {
  if (!selectedIso.value) return ''
  const d = new Date(selectedIso.value + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long' })
})

const selectedDayLabel = computed(() => {
  if (!selectedIso.value) return ''
  const d = new Date(selectedIso.value + 'T12:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
})

const selectedDayShort = computed(() => {
  if (!selectedIso.value) return ''
  const d = new Date(selectedIso.value + 'T12:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
})

const selectedPanelLabel = computed(() =>
  selectedDayWeekday.value && selectedDayLabel.value
    ? `${selectedDayWeekday.value} ${selectedDayLabel.value}`
    : 'Day detail'
)

function onEventClick(ev) {
  emit('event-click', ev)
}

function onAddEventForDay() {
  if (!selectedIso.value) return
  emit('add-event-for-day', selectedIso.value)
}

/* ─── Formatting helpers ──────────────────────────────── */
function shortTime(t) {
  if (!t || typeof t !== 'string') return ''
  const [h, m] = t.split(':')
  return `${parseInt(h, 10)}${m && m !== '00' ? ':' + m : ''}${parseInt(h, 10) >= 12 ? 'pm' : 'am'}`.replace('12pm', 'noon').replace('0am', '12am')
}

function formatHour(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

function eventBg(ev) {
  try { return props.getEventColor(ev) || { bg: '#f3f4f6', borderColor: '#d1d5db', color: '#1f2937' } }
  catch { return { bg: '#f3f4f6', borderColor: '#d1d5db', color: '#1f2937' } }
}

function chipStyle(ev) {
  const c = eventBg(ev)
  return {
    background: c.bg,
    color: c.color || '#1f2937',
    borderLeft: `3px solid ${c.borderColor || '#d1d5db'}`,
  }
}

function catChipStyle(ev) {
  const c = eventBg(ev)
  return {
    background: c.bg,
    color: c.color || '#1f2937',
    borderColor: c.borderColor || 'transparent',
  }
}

function chipTitle(ev) {
  const parts = [ev.title]
  if (ev.start_time && ev.start_time !== '00:00') {
    parts.push(`${shortTime(ev.start_time)}${ev.end_time ? '–' + shortTime(ev.end_time) : ''}`)
  }
  if (ev.category) parts.push(`(${ev.category})`)
  return parts.join(' ')
}
</script>

<style scoped>
.cmv {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  min-height: 500px;
}

/* ─── Header ───────────────────────────────────────────── */
.cmv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.cmv-title-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.cmv-title-group { min-width: 0; padding: 0 6px; }
.cmv-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.1;
  white-space: nowrap;
}
.cmv-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0;
  font-variant-numeric: tabular-nums;
}
.cmv-nav-btn {
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
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.cmv-nav-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.cmv-today-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 34px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.cmv-today-btn:hover:not(.disabled) {
  background: var(--color-primary-50);
  border-color: var(--color-primary-300);
  color: var(--color-primary-700);
}
.cmv-today-btn.disabled { opacity: 0.55; cursor: not-allowed; }

/* ─── Weekday row ──────────────────────────────────────── */
.cmv-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding: 0 1px;
}
.cmv-weekday {
  padding: 6px 8px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  text-align: left;
}
.cmv-weekday.weekend { color: var(--text-quaternary); }

/* ─── Grid ─────────────────────────────────────────────── */
.cmv-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(118px, 1fr);
  gap: 2px;
  background: var(--surface-border);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.cmv-day {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: var(--surface-card);
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: left;
  min-width: 0;
  min-height: 0;
  font-family: inherit;
}
.cmv-day:hover { background: var(--surface-hover); }
.cmv-day:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--focus-ring);
  z-index: 1;
  position: relative;
}
.cmv-day.is-weekend { background: var(--surface-card-muted); }
.cmv-day.out-of-month { background: var(--surface-card-muted); }
.cmv-day.out-of-month .cmv-day-num { color: var(--text-quaternary); }
.cmv-day.is-today {
  background: color-mix(in srgb, var(--color-primary-50) 75%, var(--surface-card));
}
.cmv-day.is-today .cmv-day-num {
  background: var(--color-primary-500);
  color: #ffffff;
}
.cmv-day.is-selected {
  box-shadow: inset 0 0 0 2px var(--color-primary-500);
  z-index: 1;
  position: relative;
}

.cmv-day-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.cmv-day-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.cmv-day-count {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  background: var(--chip-bg);
  border-radius: var(--radius-full);
}

.cmv-day-events {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.cmv-event-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: filter var(--transition-fast);
}
.cmv-event-chip:hover { filter: brightness(0.94); }
.cmv-event-time {
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
  flex-shrink: 0;
}
.cmv-event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.cmv-more {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-primary-600);
  padding: 2px 6px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cmv-more:hover { text-decoration: underline; }

/* ─── Day detail panel ─────────────────────────────────── */
.cmv-day-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: var(--z-modal);
  display: flex;
  justify-content: flex-end;
  animation: cmv-fade 140ms ease-out;
}
@keyframes cmv-fade { from { opacity: 0; } to { opacity: 1; } }
.cmv-day-panel {
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
  width: 100%;
  max-width: 420px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(15, 23, 42, 0.2);
  animation: cmv-slide 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes cmv-slide { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.cmv-day-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  gap: var(--space-2);
}
.cmv-day-panel-kicker {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}
.cmv-day-panel-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
  margin: 2px 0 0;
}
.cmv-day-panel-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 4px 0 0;
  font-weight: var(--font-medium);
}
.cmv-day-panel-count.muted { color: var(--text-tertiary); font-style: italic; }

.cmv-day-panel-close {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  flex-shrink: 0;
}
.cmv-day-panel-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border);
}

.cmv-day-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Stage hours block */
.cmv-stage-hours {
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.cmv-section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}
.cmv-stage-hours-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cmv-stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.cmv-stage-name {
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmv-stage-time {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* Day events list */
.cmv-day-events-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.cmv-day-event {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-left: 3px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal);
}
.cmv-day-event:hover { background: var(--surface-hover); }
.cmv-day-event-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 4px;
}
.cmv-day-event-cat {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: var(--radius-full);
  border: 1px solid;
}
.cmv-day-event-time {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-medium);
  margin-left: auto;
}
.cmv-day-event-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  line-height: 1.3;
  word-break: break-word;
}
.cmv-day-event-meta {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.cmv-day-event-meta svg { color: var(--text-tertiary); }
.cmv-day-event-notes {
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.cmv-day-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  gap: 6px;
  background: var(--surface-card-muted);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-md);
}
.cmv-day-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
.cmv-day-empty-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
}

.cmv-add-event-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.cmv-add-event-btn:hover {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}

/* ─── Mobile: bottom sheet panel + smaller day cells ──── */
@media (max-width: 640px) {
  .cmv-grid { grid-auto-rows: minmax(78px, 1fr); }
  .cmv-event-chip { padding: 1px 4px; font-size: 10px; }
  .cmv-more { padding: 1px 4px; }
  .cmv-weekday { padding: 4px 6px; }
  .cmv-title { font-size: var(--text-xl); }

  .cmv-day-panel-backdrop {
    justify-content: center;
    align-items: flex-end;
  }
  .cmv-day-panel {
    max-width: 100%;
    height: 82vh;
    border-left: none;
    border-top: 1px solid var(--surface-border);
    border-top-left-radius: var(--radius-xl);
    border-top-right-radius: var(--radius-xl);
    animation: cmv-sheet 200ms cubic-bezier(0.25, 0.8, 0.35, 1);
  }
  @keyframes cmv-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .cmv-day-panel-head { padding: var(--space-3) var(--space-4); }
  .cmv-day-panel-body { padding: var(--space-3); }
}

@media (prefers-reduced-motion: reduce) {
  .cmv-day-panel,
  .cmv-day-panel-backdrop { animation: none; }
}
</style>
