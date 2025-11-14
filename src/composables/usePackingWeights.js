import { ref } from 'vue'
import { formatWeight, getWeightUnit, convertInputToKg } from '@/utils/weightUtils'

export function usePackingWeights() {
  const weightUnit = ref(getWeightUnit())

  function formatBagWeight(bagId, bags, bagItems, availableProjectGear) {
    const weightKg = getBagTotalWeight(bagId, bags, bagItems, availableProjectGear)
    return formatWeight(weightKg, weightUnit.value)
  }

  function getBagItemsWeight(bagId, bagItems, availableProjectGear) {
    const itemsInBag = bagItems.value.filter(item => item.bag_id === bagId)
    let itemsWeight = 0

    itemsInBag.forEach(item => {
      if (item.gear_id) {
        const gear = availableProjectGear.value.find(g => g.id === item.gear_id)
        if (gear && gear.weight_kg) {
          itemsWeight += (Number(gear.weight_kg) || 0) * (item.quantity || 0)
        }
      }
    })

    return itemsWeight
  }

  function getBagTotalWeight(bagId, bags, bagItems, availableProjectGear) {
    const bag = bags.value.find(b => b.id === bagId)
    if (!bag) return 0

    // Option 1: If override weight is set, use that
    if (bag.weight_kg) {
      return Number(bag.weight_kg)
    }

    // Option 2: Empty bag weight + items weight
    const emptyBagWeight = bag.empty_bag_weight_kg ? Number(bag.empty_bag_weight_kg) : 0
    const itemsWeight = getBagItemsWeight(bagId, bagItems, availableProjectGear)

    return emptyBagWeight + itemsWeight
  }

  function getBagWeightBreakdown(bagId, bags, bagItems, availableProjectGear) {
    const bag = bags.value.find(b => b.id === bagId)
    if (!bag) return null

    // If override weight, no breakdown needed
    if (bag.weight_kg) {
      return null
    }

    const emptyBagWeight = bag.empty_bag_weight_kg ? Number(bag.empty_bag_weight_kg) : 0
    const itemsWeight = getBagItemsWeight(bagId, bagItems, availableProjectGear)

    if (emptyBagWeight > 0 && itemsWeight > 0) {
      return `Bag: ${formatWeight(emptyBagWeight, weightUnit.value)} + Items: ${formatWeight(itemsWeight, weightUnit.value)}`
    } else if (emptyBagWeight > 0) {
      return `Bag: ${formatWeight(emptyBagWeight, weightUnit.value)} (no items yet)`
    } else if (itemsWeight > 0) {
      return `Items: ${formatWeight(itemsWeight, weightUnit.value)} (empty bag weight not set)`
    }

    return null
  }

  function formatBagWeight(bagId, bags, bagItems, availableProjectGear) {
    const weightKg = getBagTotalWeight(bagId, bags, bagItems, availableProjectGear)
    return formatWeight(weightKg, weightUnit.value)
  }

  function convertBagFormWeight(bagForm) {
    // Handle weight based on mode
    let weight_kg = null
    let empty_bag_weight_kg = null

    if (bagForm.weightMode === 'override') {
      weight_kg = bagForm.weightInput
        ? convertInputToKg(bagForm.weightInput, bagForm.weightInputUnit)
        : null
      empty_bag_weight_kg = null
    } else {
      empty_bag_weight_kg = bagForm.emptyBagWeightInput
        ? convertInputToKg(bagForm.emptyBagWeightInput, bagForm.emptyBagWeightUnit)
        : null
      weight_kg = null
    }

    return { weight_kg, empty_bag_weight_kg }
  }

  return {
    weightUnit,
    getBagItemsWeight,
    getBagTotalWeight,
    getBagWeightBreakdown,
    formatBagWeight,
    convertBagFormWeight
  }
}

