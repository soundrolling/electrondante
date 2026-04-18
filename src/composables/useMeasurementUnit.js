// src/composables/useMeasurementUnit.js

import { ref, computed } from 'vue'

// Module-level state (singleton pattern) - shared across all component instances
const measurementUnit = ref('metric') // 'metric' or 'imperial'

// Initialize from localStorage on module load
const stored = localStorage.getItem('weightUnit')
if (stored === 'lbs') measurementUnit.value = 'imperial'

export function useMeasurementUnit() {
  // Computed helpers
  const isImperial = computed(() => measurementUnit.value === 'imperial')
  const isMetric = computed(() => measurementUnit.value === 'metric')
  const weightUnit = computed(() => isImperial.value ? 'lbs' : 'kg')
  const tempUnit = computed(() => isImperial.value ? 'F' : 'C')
  const speedUnit = computed(() => isImperial.value ? 'mph' : 'km/h')

  // Initialize from profile (called by userStore after fetching profile)
  function initFromProfile(profile) {
    if (profile?.measurement_unit) {
      measurementUnit.value = profile.measurement_unit
    }
    // Sync to localStorage so existing weightUtils.getWeightUnit() still works
    syncToLocalStorage()
  }

  // Sync to localStorage for backward compat with existing weightUtils code
  function syncToLocalStorage() {
    localStorage.setItem('weightUnit', isImperial.value ? 'lbs' : 'kg')
  }

  // Set and persist (caller is responsible for saving to Supabase separately)
  function setMeasurementUnit(unit) {
    if (unit !== 'metric' && unit !== 'imperial') return
    measurementUnit.value = unit
    syncToLocalStorage()
  }

  return {
    measurementUnit,
    isImperial,
    isMetric,
    weightUnit,
    tempUnit,
    speedUnit,
    initFromProfile,
    setMeasurementUnit
  }
}
