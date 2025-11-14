import { ref, computed } from 'vue'

export function useGearFilters(gearList, locationsList, route) {
  // Main gear filters
  const filterLocationId = ref(route?.query?.locationId || 'all')
  const filterOwner = ref('all')
  const sortBy = ref('default')

  // Accessories filters
  const filterAccessoriesLocationId = ref(route?.query?.locationId || 'all')
  const filterAccessoriesOwner = ref('all')
  const sortAccessoriesBy = ref('default')

  // Split gear list into main gear and accessories
  const mainGearList = computed(() => {
    return gearList.value.filter(g => g.gear_type !== 'accessories_cables')
  })

  const accessoriesList = computed(() => {
    return gearList.value.filter(g => g.gear_type === 'accessories_cables')
  })

  // Get unique owners from gear list
  const uniqueOwners = computed(() => {
    const owners = new Set()
    gearList.value.forEach(g => {
      if (g.owner_name && g.is_user_gear) {
        owners.add(g.owner_name)
      }
    })
    return Array.from(owners).sort()
  })

  // Filter and sort main gear
  const filteredMainGearList = computed(() => {
    let filtered = []

    // Apply location/assignment filter
    if (filterLocationId.value === 'all') {
      filtered = mainGearList.value
    } else if (filterLocationId.value === 'unassigned') {
      filtered = mainGearList.value.filter(g => g.unassigned_amount > 0)
    } else if (filterLocationId.value === 'assigned') {
      filtered = mainGearList.value.filter(g => g.total_assigned > 0)
    } else {
      filtered = mainGearList.value.filter(g => g.assignments?.[filterLocationId.value] > 0)
    }

    // Apply owner filter
    if (filterOwner.value !== 'all') {
      if (filterOwner.value === 'project') {
        filtered = filtered.filter(g => !g.is_user_gear)
      } else {
        filtered = filtered.filter(g => g.owner_name === filterOwner.value)
      }
    }

    // Apply sorting
    if (sortBy.value === 'default') {
      return filtered
    } else if (sortBy.value === 'name-asc') {
      return [...filtered].sort((a, b) =>
        (a.gear_name || '').localeCompare(b.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortBy.value === 'name-desc') {
      return [...filtered].sort((a, b) =>
        (b.gear_name || '').localeCompare(a.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortBy.value === 'quantity-desc') {
      return [...filtered].sort((a, b) => (b.gear_amount || 0) - (a.gear_amount || 0))
    } else if (sortBy.value === 'quantity-asc') {
      return [...filtered].sort((a, b) => (a.gear_amount || 0) - (b.gear_amount || 0))
    }

    return filtered
  })

  // Filter and sort accessories
  const filteredAccessoriesList = computed(() => {
    let filtered = []

    // Apply location/assignment filter
    if (filterAccessoriesLocationId.value === 'all') {
      filtered = accessoriesList.value
    } else if (filterAccessoriesLocationId.value === 'unassigned') {
      filtered = accessoriesList.value.filter(g => g.unassigned_amount > 0)
    } else if (filterAccessoriesLocationId.value === 'assigned') {
      filtered = accessoriesList.value.filter(g => g.total_assigned > 0)
    } else {
      filtered = accessoriesList.value.filter(g => g.assignments?.[filterAccessoriesLocationId.value] > 0)
    }

    // Apply owner filter
    if (filterAccessoriesOwner.value !== 'all') {
      if (filterAccessoriesOwner.value === 'project') {
        filtered = filtered.filter(g => !g.is_user_gear)
      } else {
        filtered = filtered.filter(g => g.owner_name === filterAccessoriesOwner.value)
      }
    }

    // Apply sorting
    if (sortAccessoriesBy.value === 'default') {
      return filtered
    } else if (sortAccessoriesBy.value === 'name-asc') {
      return [...filtered].sort((a, b) =>
        (a.gear_name || '').localeCompare(b.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortAccessoriesBy.value === 'name-desc') {
      return [...filtered].sort((a, b) =>
        (b.gear_name || '').localeCompare(a.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortAccessoriesBy.value === 'quantity-desc') {
      return [...filtered].sort((a, b) => (b.gear_amount || 0) - (a.gear_amount || 0))
    } else if (sortAccessoriesBy.value === 'quantity-asc') {
      return [...filtered].sort((a, b) => (a.gear_amount || 0) - (b.gear_amount || 0))
    }

    return filtered
  })

  return {
    filterLocationId,
    filterOwner,
    sortBy,
    filterAccessoriesLocationId,
    filterAccessoriesOwner,
    sortAccessoriesBy,
    mainGearList,
    accessoriesList,
    uniqueOwners,
    filteredMainGearList,
    filteredAccessoriesList
  }
}

