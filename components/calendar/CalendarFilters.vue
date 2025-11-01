<template>
<div class="filters-bar">
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
    selectedLocation: ''
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
color: #555;
}
.filters-bar input,
.filters-bar select {
padding: 0.45rem 0.55rem;
border: 1px solid #ccd0d5;
border-radius: 6px;
font-size: 0.95rem;
background: #fff;
}
@media (min-width: 700px) {
  /* On wider screens, align label/field inline for compactness */
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
@media (max-width: 600px) {
  .filters-bar {
    width: 100%;
  }
  .filters-bar select,
  .filters-bar input {
    width: 100%;
  }
}
</style> 