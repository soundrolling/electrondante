<template>
<div class="csv">
  <!-- Header: month nav + group-by chips -->
  <header class="csv-head">
    <div class="csv-title-row">
      <button class="csv-nav-btn" @click="prevMonth" aria-label="Previous month" title="Previous month">
        <ChevronLeft :size="18" :stroke-width="2" />
      </button>
      <div class="csv-title-group">
        <h2 class="csv-title">{{ monthLabel }}</h2>
        <p class="csv-subtitle">{{ totalEvents }} event{{ totalEvents === 1 ? '' : 's' }} · grouped by {{ groupByLabel }}</p>
      </div>
      <button class="csv-nav-btn" @click="nextMonth" aria-label="Next month" title="Next month">
        <ChevronRight :size="18" :stroke-width="2" />
      </button>
    </div>

    <div class="csv-head-actions">
      <div class="csv-groupby" role="radiogroup" aria-label="Group by">
        <button
          v-for="opt in GROUP_OPTIONS"
          :key="opt.id"
          type="button"
          role="radio"
          :aria-checked="groupBy === opt.id"
          :class="['csv-groupby-btn', { active: groupBy === opt.id }]"
          :title="`Group by ${opt.label.toLowerCase()}`"
          @click="groupBy = opt.id"
        >
          <component :is="opt.icon" :size="14" :stroke-width="2" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
      <button
        class="csv-today-btn"
        :class="{ disabled: isCurrentMonth }"
        :disabled="isCurrentMonth"
        @click="jumpToToday"
        title="Jump to current month"
      >
        <CalendarCheck :size="14" :stroke-width="2" />
        <span>Today</span>
      </button>
    </div>
  </header>

  <!-- Scrollable swimlane chart -->
  <div class="csv-scroll-wrap" v-if="visibleGroups.length">
    <div class="csv-chart" :style="{ '--day-col': dayColWidth + 'px', '--lane-w': laneWidth + 'px' }">
      <!-- Day header row (sticky top) -->
      <div class="csv-day-header" role="row">
        <div class="csv-corner"></div>
        <div class="csv-day-header-track">
          <div
            v-for="day in days"
            :key="day.iso"
            :class="['csv-day-cell-head', { 'is-today': day.isToday, 'is-weekend': day.isWeekend }]"
          >
            <span class="csv-day-wd">{{ day.weekday }}</span>
            <span class="csv-day-num">{{ day.num }}</span>
          </div>
        </div>
      </div>

      <!-- Each group row (sticky left label + event bars over day cells) -->
      <div
        v-for="group in visibleGroups"
        :key="group.key"
        class="csv-lane"
        role="row"
      >
        <div class="csv-lane-label" :title="group.label">
          <span class="csv-lane-swatch" :style="{ background: group.color }"></span>
          <div class="csv-lane-text">
            <span class="csv-lane-name">{{ group.label }}</span>
            <span class="csv-lane-count">{{ group.events.length }} event{{ group.events.length === 1 ? '' : 's' }}</span>
          </div>
        </div>
        <div
          class="csv-lane-track"
          :style="{ height: (group.rows.length * ROW_HEIGHT + 12) + 'px' }"
        >
          <!-- Grid background: day columns + weekend/today tint -->
          <div
            v-for="day in days"
            :key="day.iso + '-bg'"
            :class="['csv-lane-day-cell', { 'is-today': day.isToday, 'is-weekend': day.isWeekend }]"
          ></div>
          <!-- Event bars -->
          <div
            v-for="bar in group.bars"
            :key="bar.id"
            :class="['csv-bar', { 'is-synthetic': bar.event.isSynthetic }]"
            :style="barStyle(bar)"
            :title="barTitle(bar.event)"
            @click.stop="onEventClick(bar.event)"
          >
            <span v-if="bar.event.start_time && bar.event.start_time !== '00:00'" class="csv-bar-time">
              {{ shortTime(bar.event.start_time) }}
            </span>
            <span class="csv-bar-title">{{ bar.event.title }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty state -->
  <div v-else class="csv-empty">
    <div class="csv-empty-icon">
      <Layers :size="26" :stroke-width="1.5" />
    </div>
    <p class="csv-empty-title">Nothing to show for {{ monthLabel }}</p>
    <p class="csv-empty-hint">
      Add events, build days, or travel and they'll appear grouped by {{ groupByLabel }}.
    </p>
  </div>
</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Layers,
  MapPin,
  Tag,
  Users,
} from 'lucide-vue-next'
import { markRaw } from 'vue'

const props = defineProps({
  currentDate:    { type: Date, required: true },
  events:         { type: Array, default: () => [] },
  getEventColor:  { type: Function, required: true },
  locations:      { type: Array, default: () => [] },
  contacts:       { type: Array, default: () => [] },
})

const emit = defineEmits([
  'previous-period',
  'next-period',
  'jump-to-today',
  'event-click',
])

/* ─── Grouping options ─────────────────────────────────── */
const GROUP_OPTIONS = [
  { id: 'stage',    label: 'Stage',    icon: markRaw(MapPin) },
  { id: 'category', label: 'Category', icon: markRaw(Tag) },
  { id: 'crew',     label: 'Crew',     icon: markRaw(Users) },
]
const groupBy = ref('stage')
const groupByLabel = computed(() => {
  const o = GROUP_OPTIONS.find(x => x.id === groupBy.value)
  return o ? o.label.toLowerCase() : 'group'
})

/* ─── Month math ──────────────────────────────────────── */
const monthLabel = computed(() =>
  props.currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)
const isCurrentMonth = computed(() => {
  const now = new Date()
  return now.getFullYear() === props.currentDate.getFullYear()
      && now.getMonth()   === props.currentDate.getMonth()
})

function toIso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const days = computed(() => {
  const year  = props.currentDate.getFullYear()
  const month = props.currentDate.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const out = []
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    out.push({
      iso: toIso(date),
      num: d,
      weekday: date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1),
      isWeekend: dow === 0 || dow === 6,
      isToday: date.getTime() === today.getTime(),
    })
  }
  return out
})

/* ─── Layout constants ────────────────────────────────── */
const ROW_HEIGHT = 26
const LANE_GAP = 4
const dayColWidth = ref(40)
const laneWidth = ref(180)

/* ─── Group events + pack bars ────────────────────────── */
function locationLabelOf(locationId) {
  const l = props.locations.find(x => x.id === locationId)
  if (!l) return null
  return [l.venue_name, l.stage_name].filter(Boolean).join(' · ')
}

function contactLabelOf(contactId) {
  const c = props.contacts.find(x => String(x.id) === String(contactId))
  if (!c) return null
  return c.name || c.label || null
}

function isoInRange(iso, startIso, endIso) {
  return iso >= startIso && iso <= endIso
}

const monthRange = computed(() => {
  if (!days.value.length) return null
  return { start: days.value[0].iso, end: days.value[days.value.length - 1].iso }
})

// Expand events so they have a deterministic "primary" group key for
// this groupBy setting. Some events belong to multiple groups (e.g.
// two crew members assigned) — we emit one bar per matching group so
// each lane shows it.
const expandedEvents = computed(() => {
  const range = monthRange.value
  if (!range) return []
  const mode = groupBy.value
  const out = []
  for (const ev of props.events || []) {
    const startIso = (ev.event_date || '').slice(0, 10)
    const endIso = (ev.end_date || ev.event_date || '').slice(0, 10)
    if (!startIso || !endIso) continue
    // Does this event overlap with the current month?
    if (endIso < range.start || startIso > range.end) continue

    // Gather candidate group keys for this mode
    let keys = []
    let labels = {}
    if (mode === 'stage') {
      const label = locationLabelOf(ev.location_id) || 'No stage'
      const key = ev.location_id ? `loc:${ev.location_id}` : 'loc:none'
      keys.push(key)
      labels[key] = label
    } else if (mode === 'category') {
      const key = `cat:${ev.category || 'other'}`
      keys.push(key)
      labels[key] = (ev.category || 'other').replace(/(^|\s)\S/g, t => t.toUpperCase())
    } else if (mode === 'crew') {
      const assigned = Array.isArray(ev.assigned_contacts) ? ev.assigned_contacts : []
      if (!assigned.length) {
        keys.push('crew:unassigned')
        labels['crew:unassigned'] = 'Unassigned'
      } else {
        for (const id of assigned) {
          const label = contactLabelOf(id) || 'Unknown'
          const key = `crew:${id}`
          keys.push(key)
          labels[key] = label
        }
      }
    }

    for (const k of keys) {
      out.push({
        event: ev,
        groupKey: k,
        groupLabel: labels[k],
        startIso,
        endIso,
      })
    }
  }
  return out
})

// Build groups + pack overlapping events into rows within each group
function packIntoRows(entries) {
  // Greedy sweep: sort by startIso, assign to first row whose previous
  // event's endIso is < current startIso
  const sorted = [...entries].sort((a, b) => a.startIso.localeCompare(b.startIso) || a.endIso.localeCompare(b.endIso))
  const rows = [] // Array<{ lastEndIso }>
  const placed = sorted.map(e => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].lastEndIso < e.startIso) {
        rows[i].lastEndIso = e.endIso
        return { ...e, rowIndex: i }
      }
    }
    rows.push({ lastEndIso: e.endIso })
    return { ...e, rowIndex: rows.length - 1 }
  })
  return { placed, rows }
}

const GROUP_COLOURS = [
  '#0ea5e9', '#f59e0b', '#22c55e', '#6366f1', '#ec4899',
  '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6',
]
function colourForKey(key, idx) {
  return GROUP_COLOURS[idx % GROUP_COLOURS.length]
}

const visibleGroups = computed(() => {
  const byKey = new Map()
  for (const e of expandedEvents.value) {
    if (!byKey.has(e.groupKey)) byKey.set(e.groupKey, { key: e.groupKey, label: e.groupLabel, entries: [] })
    byKey.get(e.groupKey).entries.push(e)
  }
  const out = []
  let idx = 0
  for (const grp of byKey.values()) {
    const { placed, rows } = packIntoRows(grp.entries)
    const bars = placed.map(p => {
      const dayIndex = days.value.findIndex(d => d.iso === p.startIso)
      const endIndex = days.value.findIndex(d => d.iso === p.endIso)
      const startIdx = dayIndex === -1 ? 0 : dayIndex
      const endIdx = endIndex === -1 ? days.value.length - 1 : endIndex
      return {
        id: `${p.event.id}:${p.groupKey}`,
        event: p.event,
        rowIndex: p.rowIndex,
        startIdx,
        spanDays: Math.max(1, endIdx - startIdx + 1),
      }
    })
    out.push({
      key: grp.key,
      label: grp.label,
      color: colourForKey(grp.key, idx),
      events: grp.entries.map(e => e.event),
      rows,
      bars,
    })
    idx++
  }
  // Sort: group with most events first, unassigned / no-stage pushed to bottom
  out.sort((a, b) => {
    const aMuted = /:(unassigned|none)$/.test(a.key)
    const bMuted = /:(unassigned|none)$/.test(b.key)
    if (aMuted !== bMuted) return aMuted ? 1 : -1
    return b.events.length - a.events.length
  })
  return out
})

const totalEvents = computed(() =>
  new Set(expandedEvents.value.map(e => e.event.id)).size
)

/* ─── Bar rendering ────────────────────────────────────── */
function barStyle(bar) {
  const c = (() => {
    try { return props.getEventColor(bar.event) || { bg: '#e5e7eb', borderColor: '#9ca3af', color: '#1f2937' } }
    catch { return { bg: '#e5e7eb', borderColor: '#9ca3af', color: '#1f2937' } }
  })()
  return {
    left: `calc(${bar.startIdx} * var(--day-col))`,
    width: `calc(${bar.spanDays} * var(--day-col) - 3px)`,
    top: (bar.rowIndex * ROW_HEIGHT + 6) + 'px',
    height: (ROW_HEIGHT - LANE_GAP) + 'px',
    background: c.bg,
    color: c.color || '#1f2937',
    borderLeft: `3px solid ${c.borderColor || '#9ca3af'}`,
  }
}

function barTitle(ev) {
  const parts = [ev.title]
  const timeBit = (ev.start_time && ev.start_time !== '00:00')
    ? `${shortTime(ev.start_time)}${ev.end_time ? '–' + shortTime(ev.end_time) : ''}` : 'All day'
  parts.push(timeBit)
  if (ev.category) parts.push(`(${ev.category})`)
  return parts.join(' · ')
}

function shortTime(t) {
  if (!t || typeof t !== 'string') return ''
  const [h, m] = t.split(':')
  return `${parseInt(h, 10)}${m && m !== '00' ? ':' + m : ''}${parseInt(h, 10) >= 12 ? 'pm' : 'am'}`.replace('12pm', 'noon').replace('0am', '12am')
}

function onEventClick(ev) {
  emit('event-click', ev)
}

function prevMonth() {
  const d = new Date(props.currentDate); d.setDate(1); d.setMonth(d.getMonth() - 1)
  emit('previous-period', d)
}
function nextMonth() {
  const d = new Date(props.currentDate); d.setDate(1); d.setMonth(d.getMonth() + 1)
  emit('next-period', d)
}
function jumpToToday() {
  emit('jump-to-today')
}
</script>

<style scoped>
.csv {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  min-height: 520px;
}

/* ─── Header ───────────────────────────────────────────── */
.csv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.csv-title-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.csv-title-group { padding: 0 6px; }
.csv-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.1;
  white-space: nowrap;
}
.csv-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0;
}
.csv-nav-btn {
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
.csv-nav-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}

.csv-head-actions {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}

.csv-groupby {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
}
.csv-groupby-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  height: 30px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  font-family: inherit;
}
.csv-groupby-btn:hover { color: var(--text-primary); }
.csv-groupby-btn.active {
  background: var(--surface-card);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.csv-today-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 30px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: var(--font-semibold);
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.csv-today-btn:hover:not(.disabled) {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border-color: var(--color-primary-300);
}
.csv-today-btn.disabled { opacity: 0.55; cursor: not-allowed; }

/* ─── Chart ────────────────────────────────────────────── */
.csv-scroll-wrap {
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: auto;
  background: var(--surface-card);
  max-height: 70vh;
}
.csv-chart {
  display: flex;
  flex-direction: column;
  min-width: max-content;
}

/* Day header row */
.csv-day-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}
.csv-corner {
  position: sticky;
  left: 0;
  z-index: 4;
  width: var(--lane-w);
  flex-shrink: 0;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
}
.csv-day-header-track {
  display: flex;
  flex: 1;
}
.csv-day-cell-head {
  width: var(--day-col);
  flex-shrink: 0;
  padding: 6px 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border-left: 1px solid var(--surface-border);
  background: var(--surface-card);
}
.csv-day-wd {
  font-size: 9px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.06em;
}
.csv-day-num {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.csv-day-cell-head.is-weekend { background: var(--surface-card-muted); }
.csv-day-cell-head.is-today {
  background: color-mix(in srgb, var(--color-primary-50) 70%, var(--surface-card));
}
.csv-day-cell-head.is-today .csv-day-num { color: var(--color-primary-700); }

/* Lane row */
.csv-lane {
  display: flex;
  border-bottom: 1px solid var(--surface-border);
}
.csv-lane:last-child { border-bottom: none; }

.csv-lane-label {
  position: sticky;
  left: 0;
  z-index: 2;
  width: var(--lane-w);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  min-width: 0;
}
.csv-lane-swatch {
  width: 6px;
  height: 28px;
  border-radius: 3px;
  flex-shrink: 0;
}
.csv-lane-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.csv-lane-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.csv-lane-count {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: var(--font-medium);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

.csv-lane-track {
  position: relative;
  flex: 1;
  display: flex;
  background: var(--surface-card);
  min-height: 44px;
}
.csv-lane-day-cell {
  width: var(--day-col);
  flex-shrink: 0;
  border-left: 1px solid var(--surface-border);
}
.csv-lane-day-cell.is-weekend { background: var(--surface-card-muted); }
.csv-lane-day-cell.is-today {
  background: color-mix(in srgb, var(--color-primary-50) 60%, var(--surface-card));
}

/* Bars */
.csv-bar {
  position: absolute;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  cursor: pointer;
  transition: filter var(--transition-fast), transform var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
.csv-bar:hover { filter: brightness(0.95); transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.12); }
.csv-bar.is-synthetic { opacity: 0.88; font-style: italic; }
.csv-bar-time {
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  opacity: 0.85;
}
.csv-bar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--font-medium);
}

/* Empty state */
.csv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-12) var(--space-4);
  text-align: center;
  background: var(--surface-card);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-lg);
}
.csv-empty-icon {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}
.csv-empty-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.csv-empty-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  max-width: 40ch;
}

/* ─── Mobile ───────────────────────────────────────────── */
@media (max-width: 640px) {
  .csv-groupby-btn span { display: none; }
  .csv-title { font-size: var(--text-xl); }
  .csv-lane-label { width: 120px; }
  .csv-corner { width: 120px; }
  .csv-chart { --lane-w: 120px; --day-col: 32px; }
  .csv-scroll-wrap { max-height: 65vh; }
}
</style>
