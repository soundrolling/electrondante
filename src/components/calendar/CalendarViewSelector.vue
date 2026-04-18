<template>
<div class="cal-view-selector" role="tablist" aria-label="Calendar view">
  <button
    v-for="v in views"
    :key="v.id"
    role="tab"
    :aria-selected="modelValue === v.id"
    :class="['cal-view-btn', { active: modelValue === v.id }]"
    :title="v.hint"
    @click="$emit('update:modelValue', v.id)"
  >
    <component :is="v.icon" :size="15" :stroke-width="2" />
    <span class="cal-view-label">{{ v.label }}</span>
  </button>
</div>
</template>

<script setup>
import { CalendarDays, LayoutGrid, Clock, List, Layers } from 'lucide-vue-next'
import { markRaw } from 'vue'

defineProps({
  modelValue: { type: String, required: true }
})
defineEmits(['update:modelValue'])

const views = [
  { id: 'month',     label: 'Month',    hint: 'Full month at a glance',         icon: markRaw(CalendarDays) },
  { id: 'grid',      label: 'Week',     hint: 'Week grid with per-day columns', icon: markRaw(LayoutGrid) },
  { id: 'timeline',  label: 'Day',      hint: 'Single day, hour by hour',       icon: markRaw(Clock) },
  { id: 'swimlanes', label: 'Swim',     hint: 'Month timeline grouped by stage / category / crew', icon: markRaw(Layers) },
  { id: 'list',      label: 'Agenda',   hint: 'Chronological list of events',   icon: markRaw(List) },
]
</script>

<style scoped>
.cal-view-selector {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.cal-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  height: 34px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-lg) - 3px);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  font-family: inherit;
  min-width: 0;
}
.cal-view-btn:hover { color: var(--text-primary); }
.cal-view-btn.active {
  background: var(--surface-card);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.cal-view-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

@media (max-width: 600px) {
  .cal-view-selector {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    max-width: 100%;
  }
  .cal-view-selector::-webkit-scrollbar { display: none; }
  .cal-view-btn { padding: 6px 10px; }
  .cal-view-label { display: inline; }
}
</style>
