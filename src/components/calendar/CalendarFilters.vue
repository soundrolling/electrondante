<template>
  <!-- Desktop inline filters -->
  <div class="filters-bar desktop-filters">
    <div class="filter-group" v-if="showDateFilters">
      <label>From:</label>
      <input type="date" v-model="dateRangeStart" @change="updateFilters" />
    </div>
    <div class="filter-group" v-if="showDateFilters">
      <label>To:</label>
      <input type="date" v-model="dateRangeEnd" @change="updateFilters" />
    </div>
    <div class="filter-group">
      <label>Category:</label>
      <select v-model="selectedCategory" @change="updateFilters">
        <option value="">All Categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.label }}
        </option>
      </select>
    </div>
    <div class="filter-group">
      <label>Location:</label>
      <select v-model="selectedLocation" @change="updateFilters">
        <option value="">All Locations</option>
        <option value="none">No Location</option>
        <option v-for="location in sortedLocations" :key="location.id" :value="location.id">
          {{ location.stage_name }}
        </option>
      </select>
    </div>
  </div>

  <!-- Mobile filter button -->
  <button 
    class="mobile-filter-button" 
    @click="showMobileFilters = true"
    aria-label="Open filters"
  >
    🔍 Filters
  </button>

  <!-- Mobile bottom sheet -->
  <div 
    v-if="showMobileFilters" 
    class="mobile-filter-overlay" 
    @click.self="showMobileFilters = false"
  >
    <div class="mobile-filter-sheet" :class="{ 'sheet-open': showMobileFilters }">
      <div class="sheet-header">
        <h3>Filters</h3>
        <button 
          class="sheet-close" 
          @click="showMobileFilters = false"
          aria-label="Close filters"
        >
          ×
        </button>
      </div>
      <div class="sheet-content">
        <div class="filter-group" v-if="showDateFilters">
          <label>From:</label>
          <input type="date" v-model="dateRangeStart" @change="updateFilters" />
        </div>
        <div class="filter-group" v-if="showDateFilters">
          <label>To:</label>
          <input type="date" v-model="dateRangeEnd" @change="updateFilters" />
        </div>
        <div class="filter-group">
          <label>Category:</label>
          <select v-model="selectedCategory" @change="updateFilters">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.label }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Location:</label>
          <select v-model="selectedLocation" @change="updateFilters">
            <option value="">All Locations</option>
            <option value="none">No Location</option>
            <option v-for="location in sortedLocations" :key="location.id" :value="location.id">
              {{ location.stage_name }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
name: 'CalendarFilters',
props: {
  categories: {
    type: Array,
    default: () => []
  },
  locations: {
    type: Array,
    default: () => []
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  showDateFilters: {
    type: Boolean,
    default: true
  }
},
emits: ['update:filters'],
data() {
  return {
    dateRangeStart: '',
    dateRangeEnd: '',
    selectedCategory: '',
    selectedLocation: '',
    showMobileFilters: false
  }
},
computed: {
  sortedLocations() {
    return [...this.locations].sort((a, b) => {
      if (!a.stage_name) return 1;
      if (!b.stage_name) return -1;
      return a.stage_name.localeCompare(b.stage_name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
},
methods: {
  updateFilters() {
    this.$emit('update:filters', {
      dateStart: this.dateRangeStart,
      dateEnd: this.dateRangeEnd,
      category: this.selectedCategory,
      location: this.selectedLocation
    })
  }
},
mounted() {
  if (this.filters) {
    this.dateRangeStart = this.filters.dateStart || '';
    this.dateRangeEnd = this.filters.dateEnd || '';
    this.selectedCategory = this.filters.category || '';
    this.selectedLocation = this.filters.location || '';
  }
},
watch: {
  filters: {
    handler(newVal) {
      this.dateRangeStart = newVal.dateStart || '';
      this.dateRangeEnd = newVal.dateEnd || '';
      this.selectedCategory = newVal.category || '';
      this.selectedLocation = newVal.location || '';
    },
    deep: true
  }
}
}
</script>

<style scoped>
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-group label {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: var(--text-primary);
}

.filters-bar input,
.filters-bar select {
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 44px; /* Touch target */
}

/* Mobile filter button */
.mobile-filter-button {
  display: none;
  min-height: 44px;
  min-width: 44px;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
  background: var(--color-secondary-400);
  color: var(--text-inverse);
  width: 100%;
  margin-bottom: 0.5rem;
}

.mobile-filter-button:hover {
  background: var(--color-secondary-500);
}

/* Mobile bottom sheet */
.mobile-filter-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  align-items: flex-end;
}

.mobile-filter-sheet {
  background: var(--bg-primary);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-height: 80vh;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
  display: flex;
  flex-direction: column;
}

.mobile-filter-sheet.sheet-open {
  transform: translateY(0);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.sheet-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-heading);
}

.sheet-close {
  min-height: 44px;
  min-width: 44px;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.sheet-content .filter-group {
  margin-bottom: 1.5rem;
}

.sheet-content input,
.sheet-content select {
  width: 100%;
  min-height: 44px;
}

/* Responsive breakpoints */
@media (max-width: 1023px) {
  .desktop-filters {
    display: none;
  }
  
  .mobile-filter-button {
    display: inline-flex;
  }
  
  .mobile-filter-overlay {
    display: flex;
  }
}

@media (min-width: 1024px) {
  .mobile-filter-button {
    display: none;
  }
  
  .desktop-filters {
    display: flex;
  }
  
  .filter-group {
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
  }
  
  .filter-group label {
    margin: 0;
    white-space: nowrap;
  }
}
</style> 