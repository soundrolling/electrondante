<template>
<section class="legend-section legend-standout">
  <div class="legend-header" @click="collapsed = !collapsed">
    <h3>Event Categories Legend</h3>
    <button class="btn btn-warning legend-toggle-btn" :aria-label="collapsed ? 'Expand legend' : 'Collapse legend'">
      <span v-if="collapsed">▼</span>
      <span v-else>▲</span>
    </button>
  </div>
  <transition name="legend-fade">
    <div v-show="!collapsed">
      <!-- Event Categories -->
      <div class="legend-block">
        <strong>Event Categories:</strong>
        <div class="legend-items">
          <label class="legend-item" v-for="category in categories" :key="category.id">
            <input 
              type="checkbox" 
              :checked="enabledCategories[category.id] !== false"
              @change="toggleCategory(category.id)"
              class="category-toggle"
            />
            <span class="legend-icon">{{ category.icon }}</span>
            {{ category.label }}
            <!-- Stage hours under Recording -->
            <template v-if="category.id === 'recording' && stageHours && Object.keys(stageHours).length">
              <div class="stage-hours-legend">
                <div v-for="(hours, stageName) in stageHours" :key="stageName" class="stage-hour-item-legend">
                  <strong>{{ stageName }}:</strong>
                    <span v-for="(hour, index) in hours" :key="index" class="hour-slot-legend">
                    {{ hour.start_time }}–{{ hour.end_time }}
                    <span v-if="hour.notes" class="hour-notes">({{ hour.notes.startsWith('Day') ? hour.notes : 'Day ' + hour.notes }})</span>
                  </span>
                </div>
              </div>
            </template>
          </label>
        </div>
        <div class="legend-note">
          <small>Note: Stage hours appear as "Recording" events with green borders</small>
        </div>
      </div>
    </div>
  </transition>
</section>
</template>

<script>
export default {
name: 'CalendarLegend',
props: {
  categories: {
    type: Array,
    required: true
  },
  stageHours: {
    type: Object,
    default: () => ({})
  },
  enabledCategories: {
    type: Object,
    default: () => ({})
  }
},
emits: ['update:enabledCategories'],
data() {
  return {
    collapsed: true
  }
},
methods: {
  toggleCategory(categoryId) {
    // Create a new object to ensure Vue detects the change
    const updated = { ...this.enabledCategories };
    // Get current value - undefined means enabled by default (true)
    const currentValue = updated[categoryId];
    // Toggle: if false, set to true; if true or undefined, set to false
    updated[categoryId] = currentValue === false;
    // Emit the new object to trigger reactivity
    this.$emit('update:enabledCategories', updated);
  }
}
}
</script>

<style scoped>
.legend-section {
  padding: 0.8rem 1rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  max-width: 700px;
  margin: 0 auto 1rem auto;
  box-sizing: border-box;
}
.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  color: var(--text-primary);
}
.legend-toggle-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  margin-left: 0.5em;
  color: var(--text-tertiary);
}
.legend-fade-enter-active, .legend-fade-leave-active {
  transition: opacity 0.2s;
}
.legend-fade-enter-from, .legend-fade-leave-to {
  opacity: 0;
}
.legend-block {
margin-bottom: 0.75rem;
}
.legend-items {
display: flex;
flex-wrap: wrap;
gap: 0.75rem;
margin-top: 0.5rem;
}
.legend-item {
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.9rem;
color: var(--text-primary);
cursor: pointer;
}
.category-toggle {
margin-right: 0.3rem;
cursor: pointer;
width: 16px;
height: 16px;
accent-color: var(--color-primary-500);
}
.legend-icon {
  font-size: 1.2em;
  margin-right: 0.3em;
  display: inline-block;
  width: 1.3em;
  text-align: center;
}
.legend-note {
margin-top: 0.5rem;
color: var(--text-secondary);
font-style: italic;
}
.stage-hours-legend {
  margin-top: 0.3em;
  margin-bottom: 0.2em;
  font-size: 0.97em;
}
.stage-hour-item-legend {
  margin-bottom: 0.1em;
}
.hour-slot-legend {
  margin-left: 0.5em;
  color: var(--color-success-500);
}
.hour-notes {
font-style: italic;
color: var(--text-tertiary);
}
.legend-standout {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-medium);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 0.8rem 1rem 0.9rem 1rem;
  margin-bottom: 0;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}
@media (max-width: 800px) {
  .legend-section, .legend-standout {
    max-width: 98vw;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
</style> 