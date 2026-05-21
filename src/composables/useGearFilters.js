import { ref, computed } from 'vue'

// One filter bar at the top of the gear tab drives both the main gear
// section (sources / transformers / recorders) and the accessories section.
// We keep the previously-exposed accessories aliases (`filterAccessories*`,
// `sortAccessoriesBy`) so any external references that still read them get
// the unified values, but the template only renders a single set of inputs.
export function useGearFilters(gearList, locationsList, route) {
  const filterLocationId = ref(route?.query?.locationId || 'all')
  const filterOwner = ref('all')
  const sortBy = ref('default')

  const mainGearList = computed(() => {
    return gearList.value.filter(g => g.gear_type !== 'accessories_cables')
  })

  const accessoriesList = computed(() => {
    return gearList.value.filter(g => g.gear_type === 'accessories_cables')
  })

  const uniqueOwners = computed(() => {
    const owners = new Set()
    gearList.value.forEach(g => {
      if (g.owner_name && g.is_user_gear) {
        owners.add(g.owner_name)
      }
    })
    return Array.from(owners).sort()
  })

  function applyFilters(source) {
    let filtered = source

    if (filterLocationId.value === 'unassigned') {
      filtered = filtered.filter(g => g.unassigned_amount > 0)
    } else if (filterLocationId.value === 'assigned') {
      filtered = filtered.filter(g => g.total_assigned > 0)
    } else if (filterLocationId.value !== 'all') {
      filtered = filtered.filter(g => g.assignments?.[filterLocationId.value] > 0)
    }

    if (filterOwner.value !== 'all') {
      if (filterOwner.value === 'project') {
        filtered = filtered.filter(g => !g.is_user_gear)
      } else {
        filtered = filtered.filter(g => g.owner_name === filterOwner.value)
      }
    }

    if (sortBy.value === 'name-asc') {
      return [...filtered].sort((a, b) =>
        (a.gear_name || '').localeCompare(b.gear_name || '', undefined, { sensitivity: 'base' })
      )
    }
    if (sortBy.value === 'name-desc') {
      return [...filtered].sort((a, b) =>
        (b.gear_name || '').localeCompare(a.gear_name || '', undefined, { sensitivity: 'base' })
      )
    }
    if (sortBy.value === 'quantity-desc') {
      return [...filtered].sort((a, b) => (b.gear_amount || 0) - (a.gear_amount || 0))
    }
    if (sortBy.value === 'quantity-asc') {
      return [...filtered].sort((a, b) => (a.gear_amount || 0) - (b.gear_amount || 0))
    }
    return filtered
  }

  const filteredMainGearList = computed(() => applyFilters(mainGearList.value))
  const filteredAccessoriesList = computed(() => applyFilters(accessoriesList.value))

  return {
    filterLocationId,
    filterOwner,
    sortBy,
    // Back-compat aliases: anything that still reads these gets the unified
    // values. The separate accessories filter UI has been removed.
    filterAccessoriesLocationId: filterLocationId,
    filterAccessoriesOwner: filterOwner,
    sortAccessoriesBy: sortBy,
    mainGearList,
    accessoriesList,
    uniqueOwners,
    filteredMainGearList,
    filteredAccessoriesList
  }
}
