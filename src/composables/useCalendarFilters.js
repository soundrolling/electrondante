import { ref, computed, watch } from 'vue'

// Simple debounce utility
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function useCalendarFilters(allEvents, enabledCategories, route = null) {
  // Filter state
  const todayStr = new Date().toISOString().split('T')[0]
  const filters = ref({
    dateStart: todayStr,
    dateEnd: todayStr,
    category: '',
    location: ''
  })

  // Update filters with debouncing for performance
  const updateFiltersDebounced = debounce((newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }, 300)

  function updateFilters(newFilters, immediate = false) {
    if (immediate) {
      filters.value = { ...filters.value, ...newFilters }
    } else {
      updateFiltersDebounced(newFilters)
    }
  }

  // Reset filters to defaults
  function resetFilters() {
    filters.value = {
      dateStart: todayStr,
      dateEnd: todayStr,
      category: '',
      location: ''
    }
  }

  // Sync filters from route query params
  function syncFromRoute() {
    if (!route) return
    
    const q = route.query
    if (q.date && typeof q.date === 'string') {
      filters.value.dateStart = q.date
      filters.value.dateEnd = q.date
    }
    if (q.locationId && (typeof q.locationId === 'string' || typeof q.locationId === 'number')) {
      filters.value.location = String(q.locationId)
    }
    if (q.category && typeof q.category === 'string') {
      filters.value.category = q.category
    }
  }

  // Filtered events based on current filters
  const filteredEvents = computed(() => {
    let arr = allEvents.value.slice()
    
    // Filter by enabled categories first
    arr = arr.filter(e => {
      const categoryEnabled = enabledCategories.value[e.category] !== false
      return categoryEnabled
    })
    
    // Filter by date range - check if event overlaps with the filter range
    if (filters.value.dateStart || filters.value.dateEnd) {
      arr = arr.filter(e => {
        const eventStart = e.event_date
        const eventEnd = e.end_date || e.event_date
        
        // Event overlaps with filter range if:
        // - Event starts before filter ends AND event ends after filter starts
        const filterStart = filters.value.dateStart || '1900-01-01'
        const filterEnd = filters.value.dateEnd || '2100-12-31'
        
        return eventStart <= filterEnd && eventEnd >= filterStart
      })
    }
    
    // Filter by category
    if (filters.value.category) {
      arr = arr.filter(e => e.category === filters.value.category)
    }
    
    // Filter by location
    if (filters.value.location) {
      arr = arr.filter(e => e.location_id === parseInt(filters.value.location))
    }
    
    return arr
  })

  // Sorted events (by date, then time)
  const sortedEvents = computed(() =>
    filteredEvents.value.slice().sort((a, b) => {
      const d = a.event_date.localeCompare(b.event_date)
      return d !== 0 ? d : (a.start_time || '').localeCompare(b.start_time || '')
    })
  )

  // Auto-calculate filter range to include all days with events
  function autoCalculateFilterRange(events) {
    if (events.length === 0) return

    const allDates = []
    events.forEach(event => {
      allDates.push(event.event_date)
      if (event.end_date && event.end_date !== event.event_date) {
        // Add all dates between start and end date
        const start = new Date(event.event_date)
        const end = new Date(event.end_date)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          allDates.push(d.toISOString().split('T')[0])
        }
      }
    })

    if (allDates.length > 0) {
      const sortedDates = [...new Set(allDates)].sort()
      filters.value.dateStart = sortedDates[0]
      filters.value.dateEnd = sortedDates[sortedDates.length - 1]
    }
  }

  // Watch route query changes if route is provided
  if (route) {
    watch(() => route.query, syncFromRoute)
  }

  return {
    // State
    filters,
    
    // Computed
    filteredEvents,
    sortedEvents,
    
    // Methods
    updateFilters,
    resetFilters,
    syncFromRoute,
    autoCalculateFilterRange
  }
}

