import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { fetchTableData, mutateTableData } from '@/services/dataService'
import { supabase } from '@/supabase'

export function useGearManagement(projectId, userStore) {
  const toast = useToast()
  const loading = ref(false)
  const error = ref(null)
  const gearList = ref([])
  const locationsList = ref([])

  const userId = computed(() => userStore?.user?.id || null)

  async function fetchLocations() {
    if (!projectId.value) return
    loading.value = true
    try {
      locationsList.value = await fetchTableData('locations', {
        eq: { project_id: projectId.value },
        order: [{ column: 'order', ascending: true }]
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  async function fetchGearList() {
    if (!projectId.value) {
      error.value = 'Project ID not found.'
      return
    }
    loading.value = true
    try {
      const gearData = await fetchTableData('gear_table', {
        eq: { project_id: projectId.value },
        order: [{ column: 'sort_order', ascending: true }]
      })

      // If online, try to get user information for user gear
      let userGearInfo = {}
      if (navigator.onLine) {
        try {
          const userGearIds = gearData
            .filter(g => g.is_user_gear && g.user_gear_id)
            .map(g => g.user_gear_id)

          if (userGearIds.length > 0) {
            const { data: userGearData, error } = await supabase
              .from('user_gear_view')
              .select('id, owner_name, owner_company')
              .in('id', userGearIds)

            if (!error && userGearData) {
              userGearData.forEach(ug => {
                userGearInfo[ug.id] = ug
              })
            }
          }
        } catch (err) {
          console.warn('Could not fetch user gear info:', err)
        }
      }

      const ids = gearData.map(g => g.id)
      const asns = ids.length
        ? await fetchTableData('gear_assignments', { in: { gear_id: ids } })
        : []
      const map = {}
      asns.forEach(a => {
        map[a.gear_id] = map[a.gear_id] || {}
        map[a.gear_id][a.location_id] = a.assigned_amount
      })

      gearList.value = gearData.map(g => {
        const m = map[g.id] || {}
        const tot = Object.values(m).reduce((s, v) => s + v, 0)
        const userInfo = g.is_user_gear && g.user_gear_id ? userGearInfo[g.user_gear_id] : null
        // Ensure num_tracks is always set for recorders
        let num_tracks = g.num_tracks
        if (!num_tracks && g.num_records) num_tracks = g.num_records
        return {
          ...g,
          assignments: m,
          total_assigned: tot,
          unassigned_amount: g.gear_amount - tot,
          owner_name: userInfo?.owner_name || (g.is_user_gear ? 'Unknown' : null),
          owner_company: userInfo?.owner_company || null,
          num_tracks // always present for recorders
        }
      })
      error.value = null
    } catch (err) {
      error.value = err.message
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  async function addGear(formData, currentProject) {
    loading.value = true
    try {
      const payload = {
        gear_name: formData.gearName,
        gear_type: formData.gearType,
        num_inputs: formData.gearType === 'source' ? 0 : (formData.gearType === 'accessories_cables' ? null : formData.gearNumInputs),
        num_outputs: formData.gearType === 'source' ? 1 : (formData.gearType === 'accessories_cables' ? null : formData.gearNumOutputs),
        num_records: formData.gearType === 'recorder' ? Number(formData.gearNumRecords) : null,
        gear_amount: formData.gearAmount,
        is_rented: formData.isRented,
        vendor: formData.vendor,
        default_color: formData.gearType === 'source' ? formData.gearDefaultColor : null,
        project_id: currentProject.id,
        sort_order: gearList.value.length + 1
      }
      const inserted = await mutateTableData('gear_table', 'insert', payload)

      // Process multiple assignments
      const validAssignments = formData.assignments || []

      if (validAssignments.length > 0) {
        for (const assignment of validAssignments) {
          const assignAmount = Math.min(Number(assignment.amount), formData.gearAmount)
          await mutateTableData('gear_assignments', 'insert', {
            gear_id: inserted.id,
            location_id: Number(assignment.locationId),
            assigned_amount: assignAmount
          })
        }
        const totalAssigned = validAssignments.reduce((sum, a) => sum + Number(a.amount), 0)
        toast.success(`Gear added and ${totalAssigned} assigned across ${validAssignments.length} stage(s)`)
      } else {
        toast.success('Gear added')
      }
      await fetchGearList()
      return true
    } catch (err) {
      toast.error(err.message)
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteGear(gearId, isProjectOwner, currentProject) {
    if (!gearId) {
      toast.error('Invalid gear ID')
      return false
    }

    const gearToDelete = gearList.value.find(g => g.id === gearId)
    const isUserGear = gearToDelete?.is_user_gear

    // Check permissions
    if (!isProjectOwner && isUserGear && gearToDelete?.owner_id !== userId.value) {
      toast.error('You can only delete your own gear or project gear. Project owners can delete any gear.')
      return false
    }

    loading.value = true
    try {
      if (isUserGear) {
        if (navigator.onLine) {
          try {
            const userGearId = gearToDelete.user_gear_id
            const userGear = await fetchTableData('user_gear', { eq: { id: userGearId } })
            if (!userGear || userGear.length === 0) {
              console.warn('Could not find user gear to update:', userGearId)
              return false
            }

            const currentAssigned = userGear[0]?.assigned_quantity || 0
            const currentQuantity = userGear[0]?.quantity || 0
            const gearAmount = gearToDelete.gear_amount || 1
            const newAssigned = Math.max(0, currentAssigned - gearAmount)
            const availableQty = currentQuantity - newAssigned

            await mutateTableData('user_gear', 'update', {
              id: userGearId,
              assigned_quantity: newAssigned,
              availability: availableQty > 0 ? 'available' : 'unavailable'
            })
          } catch (err) {
            console.warn('Could not update user gear assigned_quantity:', err)
          }
          try {
            const { data, error } = await supabase.rpc('return_user_gear_to_owner', { gear_id: gearId })
            if (error) throw error
            toast.success('Gear returned to owner successfully.')
          } catch (err) {
            console.warn('Could not use database function, falling back to manual delete:', err)
            await mutateTableData('gear_table', 'delete', { id: gearId })
            toast.success('Gear removed from project.')
          }
        } else {
          await mutateTableData('gear_table', 'delete', { id: gearId })
          toast.success('Gear removed from project.')
        }
      } else {
        await mutateTableData('gear_table', 'delete', { id: gearId })
        toast.success('Gear and all related data deleted.')
      }
      await fetchGearList()
      return true
    } catch (err) {
      console.error('Delete error:', err)
      toast.error(err.message || 'Failed to delete gear')
      return false
    } finally {
      loading.value = false
    }
  }

  async function updateGear(gearId, formData, assignments) {
    loading.value = true
    try {
      await mutateTableData('gear_table', 'update', {
        id: gearId,
        gear_name: formData.gearName,
        gear_type: formData.gearType,
        num_inputs: formData.gearType === 'source' ? 0 : formData.numInputs,
        num_outputs: formData.gearType === 'source' ? 1 : formData.numOutputs,
        num_records: formData.gearType === 'recorder' ? Number(formData.numRecords) : null,
        gear_amount: formData.gearAmount,
        is_rented: formData.isRented,
        vendor: formData.vendor,
        default_color: formData.gearType === 'source' ? formData.gearDefaultColor : null
      })

      // Update assignments if provided
      if (assignments) {
        const allLocationIds = new Set([
          ...Object.keys(assignments).map(Number),
          ...Object.keys(gearList.value.find(g => g.id === gearId)?.assignments || {}).map(Number)
        ])

        for (const [locationId, newAmount] of Object.entries(assignments)) {
          const existing = await fetchTableData('gear_assignments', {
            eq: { gear_id: gearId, location_id: Number(locationId) }
          })

          if (existing.length > 0) {
            if (newAmount > 0) {
              await mutateTableData('gear_assignments', 'update', {
                id: existing[0].id,
                assigned_amount: newAmount
              })
            } else {
              await mutateTableData('gear_assignments', 'delete', { id: existing[0].id })
            }
          } else if (newAmount > 0) {
            await mutateTableData('gear_assignments', 'insert', {
              gear_id: gearId,
              location_id: Number(locationId),
              assigned_amount: newAmount
            })
          }
        }

        // Delete assignments that are no longer in assignments
        for (const locationId of allLocationIds) {
          const locationIdStr = String(locationId)
          if (!(locationIdStr in assignments)) {
            const existing = await fetchTableData('gear_assignments', {
              eq: { gear_id: gearId, location_id: locationId }
            })
            if (existing.length > 0) {
              await mutateTableData('gear_assignments', 'delete', { id: existing[0].id })
            }
          }
        }
      }

      await fetchGearList()
      return true
    } catch (err) {
      toast.error(err.message)
      return false
    } finally {
      loading.value = false
    }
  }

  async function saveReorder(newOrder) {
    loading.value = true
    try {
      await Promise.all(
        newOrder.map((g, i) =>
          mutateTableData('gear_table', 'update', { id: g.id, sort_order: i + 1 })
        )
      )
      toast.success('Order updated')
      await fetchGearList()
      return true
    } catch (err) {
      toast.error(err.message)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    gearList,
    locationsList,
    fetchLocations,
    fetchGearList,
    addGear,
    deleteGear,
    updateGear,
    saveReorder
  }
}

