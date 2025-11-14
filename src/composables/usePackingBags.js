import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import PackingService from '@/services/packingService'

export function usePackingBags(userId, effectiveProjectId) {
  const toast = useToast()
  const loading = ref(false)
  const saving = ref(false)
  const bags = ref([])
  const bagItems = ref([])

  async function loadBags() {
    if (!userId.value) return
    loading.value = true
    try {
      const projectId = effectiveProjectId.value
      bags.value = await PackingService.getUserBags(userId.value, projectId || null)
      // Load items for all bags to show accurate counts
      if (bags.value.length > 0) {
        const allBagIds = bags.value.map(b => b.id)
        const allItems = await Promise.all(
          allBagIds.map(bagId => PackingService.getBagItems(bagId))
        )
        // Flatten all items into a single array
        bagItems.value = allItems.flat()
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load bags')
    } finally {
      loading.value = false
    }
  }

  async function loadBagItems(bagId) {
    try {
      bagItems.value = await PackingService.getBagItems(bagId)
    } catch (err) {
      toast.error(err.message || 'Failed to load bag items')
    }
  }

  async function saveBag(bagForm, isEditingBag, currentBag) {
    if (!bagForm.name.trim()) {
      toast.error('Please enter a bag name')
      return false
    }
    if (!userId.value) {
      toast.error('User not authenticated')
      return false
    }

    saving.value = true
    try {
      const bagData = {
        name: bagForm.name.trim(),
        description: bagForm.description?.trim() || null,
        weight_kg: bagForm.weight_kg,
        empty_bag_weight_kg: bagForm.empty_bag_weight_kg,
        imageFile: bagForm.imageFile
      }

      if (isEditingBag && currentBag) {
        await PackingService.updateBag(currentBag.id, bagData)
        toast.success('Bag updated')
      } else {
        await PackingService.createBag(userId.value, bagData)
        toast.success('Bag created')
      }
      
      await loadBags()
      return true
    } catch (err) {
      toast.error(err.message || 'Failed to save bag')
      return false
    } finally {
      saving.value = false
    }
  }

  async function deleteBag(bagId) {
    if (!confirm('Delete this bag? All items will be removed.')) return false
    
    try {
      await PackingService.deleteBag(bagId)
      toast.success('Bag deleted')
      await loadBags()
      return true
    } catch (err) {
      toast.error(err.message || 'Failed to delete bag')
      return false
    }
  }

  const totalBagQuantity = computed(() => {
    return bagItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0)
  })

  function getBagTotalQuantity(bagId) {
    return bagItems.value
      .filter(item => item.bag_id === bagId)
      .reduce((sum, item) => sum + (item.quantity || 0), 0)
  }

  return {
    loading,
    saving,
    bags,
    bagItems,
    loadBags,
    loadBagItems,
    saveBag,
    deleteBag,
    totalBagQuantity,
    getBagTotalQuantity
  }
}

