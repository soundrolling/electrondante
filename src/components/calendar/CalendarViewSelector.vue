<template>
<div class="view-controls">
  <button
    v-for="v in views"
    :key="v.id"
    @click="$emit('update:modelValue', v.id)"
    :class="['view-button', { active: modelValue === v.id }]"
  >
    {{ v.label }}
  </button>
</div>
</template>

<script>
export default {
name: 'CalendarViewSelector',
props: {
  modelValue: {
    type: String,
    required: true
  }
},
emits: ['update:modelValue'],
data() {
  return {
    views: [
      { id: "grid", label: "Grid View" },
      { id: "timeline", label: "Timeline View" },
      { id: "list", label: "List View" }
    ]
  }
}
}
</script>

<style scoped>
.view-controls {
  display: flex;
  gap: 0;
  border-bottom: 2.5px solid var(--border-medium);
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  border-radius: 8px 8px 0 0;
  margin-bottom: 0.4rem;
  padding-left: 2px;
}
.view-button {
  background: none;
  border: none;
  border-bottom: 2.5px solid transparent;
  padding: 0.72rem 1.6rem 0.64rem 1.6rem;
  font-size: 1.09rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: color 0.18s, border-bottom 0.18s, background 0.18s;
  outline: none;
  margin-bottom: -2.5px;
  position: relative;
  z-index: 2;
}
.view-button:not(.active):hover {
  background: var(--bg-tertiary);
  color: var(--color-primary-500);
}
.view-button.active {
  color: var(--color-primary-600);
  border-bottom: 3px solid var(--color-primary-500);
  background: var(--bg-primary);
  font-weight: 600;
  z-index: 3;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
@media (max-width: 600px) {
  .view-button {
    padding: 0.6rem 0.7rem 0.55rem 0.7rem;
    font-size: 0.95rem;
  }
  .view-controls {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style> 