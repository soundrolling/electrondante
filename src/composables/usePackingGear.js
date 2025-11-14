import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { fetchTableData } from '@/services/dataService'
import { supabase } from '@/supabase'

export function usePackingGear(userId, effectiveProjectId, gearAssignedCounts) {
  const toast = useToast()
  const availableProjectGear = ref([])
  const availableUserGear = ref([])

  async function loadAvailableGear() {
    try {
      const projectId = effectiveProjectId.value
      if (projectId && projectId.trim() !== '' && userId.value) {
        // Get all project gear
        const allProjectGear = await fetchTableData('gear_table', {
          eq: { project_id: projectId },
          order: [{ column: 'gear_name', ascending: true }]
        })

        // Filter to only user gear
        const userGearItems = allProjectGear.filter(g => {
          const isUserGear = g.is_user_gear === true || g.is_user_gear === 1 || g.is_user_gear === 'true'
          const hasUserGearId = !!g.user_gear_id
          const hasAmount = (g.gear_amount || 0) > 0
          return isUserGear && hasUserGearId && hasAmount
        })

        if (userGearItems.length > 0) {
          const userGearIds = userGearItems.map(g => g.user_gear_id).filter(Boolean)

          // Fetch user_gear records to check ownership
          const { data: userGearData, error } = await supabase
            .from('user_gear')
            .select('id, user_id')
            .in('id', userGearIds)

          if (!error && userGearData) {
            const userGearOwnershipMap = {}
            userGearData.forEach(ug => {
              userGearOwnershipMap[ug.id] = ug.user_id
            })

            // Filter to only gear owned by the current user
            const currentUserIdStr = String(userId.value)
            const ownedGear = userGearItems.filter(g => {
              const gearUserId = userGearOwnershipMap[g.user_gear_id]
              const gearUserIdStr = gearUserId ? String(gearUserId) : null
              return gearUserIdStr === currentUserIdStr
            })

            // Fetch weight from user_gear table
            const userGearIdsForWeight = ownedGear.map(g => g.user_gear_id).filter(Boolean)
            let weightMap = {}
            if (userGearIdsForWeight.length > 0) {
              const { data: userGearWeightData, error: weightError } = await supabase
                .from('user_gear')
                .select('id, weight_kg')
                .in('id', userGearIdsForWeight)

              if (!weightError && userGearWeightData) {
                userGearWeightData.forEach(ug => {
                  weightMap[ug.id] = ug.weight_kg
                })
              }
            }

            // Map weights to gear items
            availableProjectGear.value = ownedGear.map(g => ({
              ...g,
              weight_kg: weightMap[g.user_gear_id] || null
            }))
          } else {
            availableProjectGear.value = []
          }
        } else {
          availableProjectGear.value = []
        }
      } else {
        availableProjectGear.value = []
      }
    } catch (err) {
      console.error('[PackingTab] Error loading gear:', err)
      toast.error('Failed to load available gear')
      availableProjectGear.value = []
    }
  }

  async function updateGearAssignedCounts(bags) {
    try {
      if (!userId.value) return

      const allBagIds = bags.value.map(b => b.id)
      if (allBagIds.length === 0) {
        gearAssignedCounts.value = {}
        return
      }

      const { data: allItems, error } = await supabase
        .from('gear_bag_items')
        .select('gear_id, quantity')
        .in('bag_id', allBagIds)
        .not('gear_id', 'is', null)

      if (error) {
        console.error('[PackingTab] Error loading assigned counts:', error)
        gearAssignedCounts.value = {}
        return
      }

      const counts = {}
      if (allItems) {
        allItems.forEach(item => {
          if (item.gear_id) {
            counts[item.gear_id] = (counts[item.gear_id] || 0) + (item.quantity || 0)
          }
        })
      }
      gearAssignedCounts.value = counts
    } catch (err) {
      console.error('[PackingTab] Failed to update assigned counts:', err)
      gearAssignedCounts.value = {}
    }
  }

  function getGearInBags(gearId) {
    return gearAssignedCounts.value[gearId] || 0
  }

  function getGearAvailable(gearId) {
    const gear = availableProjectGear.value.find(g => g.id === gearId)
    if (!gear) return 0
    const total = gear.gear_amount || 0
    const inBags = getGearInBags(gearId)
    return Math.max(0, total - inBags)
  }

  function getMaxQuantityForSelectedGear(selectedGearToAdd) {
    if (!selectedGearToAdd.value) return 1
    try {
      const selection = JSON.parse(selectedGearToAdd.value)
      const gear = selection.gear
      const available = getGearAvailable(gear.id)
      return Math.max(1, available)
    } catch (err) {
      return 1
    }
  }

  return {
    availableProjectGear,
    availableUserGear,
    loadAvailableGear,
    updateGearAssignedCounts,
    getGearInBags,
    getGearAvailable,
    getMaxQuantityForSelectedGear
  }
}

