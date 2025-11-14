import { useToast } from 'vue-toastification'
import PackingService from '@/services/packingService'

export function usePackingBagItems() {
  const toast = useToast()

  async function addItemToBag(bagId, gear, quantity, available) {
    if (quantity > available) {
      toast.error(`Cannot add more than ${available} ${gear.gear_name}. Only ${available} available.`)
      return false
    }

    try {
      await PackingService.addItemToBag(bagId, {
        gear_id: gear.id,
        gear_name: gear.gear_name,
        quantity: quantity
      })
      toast.success(`Added ${quantity} × ${gear.gear_name} to bag`)
      return true
    } catch (err) {
      console.error('Failed to add item:', err)
      toast.error(err.message || 'Failed to add item')
      return false
    }
  }

  async function removeItemFromBag(itemId) {
    if (!confirm('Remove this item from the bag?')) return false

    try {
      await PackingService.removeItemFromBag(itemId)
      toast.success('Item removed')
      return true
    } catch (err) {
      console.error('Failed to remove item:', err)
      toast.error(err.message || 'Failed to remove item')
      return false
    }
  }

  async function moveItemToBag(itemId, destinationBagId) {
    try {
      await PackingService.moveItemToBag(itemId, destinationBagId)
      toast.success('Item moved to bag')
      return true
    } catch (err) {
      console.error('Failed to move item:', err)
      toast.error(err.message || 'Failed to move item')
      return false
    }
  }

  async function updateItemQuantity(itemId, newQuantity) {
    try {
      await PackingService.updateItemQuantity(itemId, newQuantity)
      toast.success('Quantity updated')
      return true
    } catch (err) {
      console.error('Failed to update quantity:', err)
      toast.error(err.message || 'Failed to update quantity')
      return false
    }
  }

  return {
    addItemToBag,
    removeItemFromBag,
    moveItemToBag,
    updateItemQuantity
  }
}

