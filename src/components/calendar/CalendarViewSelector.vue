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
  border-bottom: 2.5px solid #e5e7eb;
  background: #f9fafb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  border-radius: 8px 8px 0 0;
  margin-bottom: 0.5rem;
  padding-left: 2px;
}
.view-button {
  background: none;
  border: none;
  border-bottom: 2.5px solid transparent;
  padding: 0.8rem 2.1rem 0.7rem 2.1rem;
  font-size: 1.09rem;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: color 0.18s, border-bottom 0.18s, background 0.18s;
  outline: none;
  margin-bottom: -2.5px;
  position: relative;
  z-index: 2;
}
.view-button:not(.active):hover {
  background: #f3f4f6;
  color: #007bff;
}
.view-button.active {
  color: #007bff;
  border-bottom: 3px solid #007bff;
  background: #fff;
  font-weight: 600;
  z-index: 3;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
@media (max-width: 600px) {
  .view-button {
    padding: 0.7rem 0.7rem 0.6rem 0.7rem;
    font-size: 0.98rem;
  }
}
</style> 