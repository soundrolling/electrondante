import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { fetchTableData, mutateTableData } from '@/services/dataService'

export function useGearAssignments() {
  const toast = useToast()

  async function saveAssignments(gearId, assignments) {
    const validAssignments = assignments || []

    try {
      // Get all existing assignments for this gear
      const existingAssignments = await fetchTableData('gear_assignments', {
        eq: { gear_id: gearId }
      })

      const existingMap = new Map()
      existingAssignments.forEach(a => {
        existingMap.set(a.location_id, a)
      })

      // Process each assignment
      const locationIdsToKeep = new Set()

      for (const assignment of validAssignments) {
        const locationId = Number(assignment.locationId)
        const amount = Number(assignment.amount)
        locationIdsToKeep.add(locationId)

        if (existingMap.has(locationId)) {
          // Update existing assignment
          const existing = existingMap.get(locationId)
          await mutateTableData('gear_assignments', 'update', {
            id: existing.id,
            assigned_amount: amount
          })
        } else {
          // Create new assignment
          await mutateTableData('gear_assignments', 'insert', {
            gear_id: gearId,
            location_id: locationId,
            assigned_amount: amount
          })
        }
      }

      // Delete assignments that are no longer in the list
      for (const existing of existingAssignments) {
        if (!locationIdsToKeep.has(existing.location_id)) {
          await mutateTableData('gear_assignments', 'delete', {
            id: existing.id
          })
        }
      }

      toast.success('All assignments saved successfully')
      return true
    } catch (err) {
      console.error('Error saving assignments:', err)
      toast.error(err.message || 'Failed to save assignments')
      return false
    }
  }

  function calculateProportionalAssignments(currentAssignments, currentTotal, newTotal) {
    if (newTotal >= currentTotal) {
      return null // No reduction needed
    }

    const reductionRatio = newTotal / currentTotal
    const newAssignments = {}
    const assignmentEntries = Object.entries(currentAssignments).filter(([, amount]) => amount > 0)
    let totalNewAssigned = 0

    // Special case: if new amount is less than number of assignments
    if (newTotal < assignmentEntries.length) {
      const sortedByAmount = assignmentEntries
        .sort(([, a], [, b]) => b - a)
        .slice(0, newTotal)

      for (const [locationId] of sortedByAmount) {
        newAssignments[locationId] = 1
        totalNewAssigned++
      }
    } else {
      // First pass: calculate proportional amounts
      for (const [locationId, currentAmount] of assignmentEntries) {
        const proportionalAmount = currentAmount * reductionRatio
        const newAmount = Math.floor(proportionalAmount)
        newAssignments[locationId] = Math.max(1, newAmount)
        totalNewAssigned += newAssignments[locationId]
      }

      // Second pass: distribute any remaining amount
      let remaining = newTotal - totalNewAssigned
      if (remaining > 0) {
        const sortedByFraction = assignmentEntries
          .map(([locationId, currentAmount]) => ({
            locationId,
            currentAmount,
            fractional: (currentAmount * reductionRatio) % 1
          }))
          .sort((a, b) => b.fractional - a.fractional)

        for (const { locationId } of sortedByFraction) {
          if (remaining <= 0) break
          newAssignments[locationId]++
          remaining--
          totalNewAssigned++
        }
      } else if (remaining < 0) {
        const sortedByAmount = Object.entries(newAssignments)
          .sort(([, a], [, b]) => b - a)

        for (const [locationId] of sortedByAmount) {
          if (remaining >= 0) break
          if (newAssignments[locationId] > 1) {
            newAssignments[locationId]--
            remaining++
            totalNewAssigned--
          }
        }
      }
    }

    return newAssignments
  }

  return {
    saveAssignments,
    calculateProportionalAssignments
  }
}

