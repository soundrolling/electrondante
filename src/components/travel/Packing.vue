<template>
  <div class="travel-packing">
    <div class="packing-header">
      <h2 class="section-title">Packing Bags</h2>
      <button class="btn btn-positive" @click="refreshBags">
        <span class="btn-icon">🔄</span>
        <span class="btn-text">Refresh</span>
      </button>
    </div>

    <p class="packing-description">
      View and manage your packing bags for this trip. Print inventory lists for reference at airports or in case of loss.
    </p>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading bags...</p>
    </div>

    <div v-else-if="bags.length === 0" class="empty-state">
      <div class="empty-icon">🎒</div>
      <h3>No bags yet</h3>
      <p>Create packing bags in the Project Gear section to see them here</p>
    </div>

    <div v-else class="bags-grid">
      <div 
        v-for="bag in bags" 
        :key="bag.id"
        class="bag-card"
      >
        <div class="bag-image-container">
          <img 
            v-if="bag.imageUrl" 
            :src="bag.imageUrl" 
            :alt="bag.name"
            class="bag-image"
          />
          <div v-else class="bag-image-placeholder">
            <span class="placeholder-icon">📷</span>
            <span class="placeholder-text">No image</span>
          </div>
        </div>
        
        <div class="bag-content">
          <h3 class="bag-name">{{ bag.name }}</h3>
          <p v-if="bag.description" class="bag-description">{{ bag.description }}</p>
          
          <div class="bag-items-count">
            <span class="count-label">Items:</span>
            <span class="count-value">{{ getBagItemCount(bag.id) }}</span>
          </div>

          <div class="bag-actions">
            <button class="btn btn-primary btn-sm" @click="viewBagInventory(bag)" title="View Inventory">
              <span class="btn-icon">👁️</span>
              <span class="btn-text">View</span>
            </button>
            <button class="btn btn-primary btn-sm" @click="printBagInventory(bag)" title="Print Inventory">
              <span class="btn-icon">🖨️</span>
              <span class="btn-text">Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Bag Inventory Modal -->
    <div v-if="showInventoryModal" class="modal-overlay" @click="closeInventoryModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h3>{{ currentBag?.name }} - Inventory</h3>
          <button class="modal-close" @click="closeInventoryModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="loadingItems" class="loading-state">
            <div class="spinner"></div>
            <p>Loading items...</p>
          </div>
          <div v-else-if="bagItems.length === 0" class="empty-items">
            <p>No items in this bag yet.</p>
          </div>
          <div v-else class="items-list">
            <div class="items-grid">
              <div 
                v-for="item in bagItems" 
                :key="item.id"
                class="item-card"
              >
                <div class="item-info">
                  <h5 class="item-name">{{ item.gear_name }}</h5>
                  <p class="item-quantity">Quantity: {{ item.quantity }}</p>
                  <p v-if="item.notes" class="item-notes">{{ item.notes }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="printBagInventory(currentBag)">
            <span class="btn-icon">🖨️</span>
            Print Inventory
          </button>
          <button class="btn btn-warning" @click="closeInventoryModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useUserStore } from '../../stores/userStore'
import PackingService from '../../services/packingService'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const props = defineProps({
  tripId: {
    type: [String, Number],
    required: true
  },
  id: {
    type: [String, Number],
    required: true
  }
})

const toast = useToast()
const userStore = useUserStore()

const loading = ref(false)
const loadingItems = ref(false)
const bags = ref([])
const bagItems = ref([])
const showInventoryModal = ref(false)
const currentBag = ref(null)

const userId = computed(() => userStore.user?.id)

function getBagItemCount(bagId) {
  return bagItems.value.filter(item => item.bag_id === bagId).length
}

async function loadBags() {
  if (!userId.value) return
  loading.value = true
  try {
    bags.value = await PackingService.getUserBags(userId.value)
  } catch (err) {
    toast.error(err.message || 'Failed to load bags')
  } finally {
    loading.value = false
  }
}

async function loadBagItems(bagId) {
  loadingItems.value = true
  try {
    bagItems.value = await PackingService.getBagItems(bagId)
  } catch (err) {
    toast.error(err.message || 'Failed to load bag items')
  } finally {
    loadingItems.value = false
  }
}

async function refreshBags() {
  await loadBags()
  toast.success('Bags refreshed')
}

function viewBagInventory(bag) {
  currentBag.value = bag
  loadBagItems(bag.id)
  showInventoryModal.value = true
}

function closeInventoryModal() {
  showInventoryModal.value = false
  currentBag.value = null
  bagItems.value = []
}

async function printBagInventory(bag) {
  try {
    const inventory = await PackingService.getBagInventoryForPrint(bag.id)
    const items = await PackingService.getBagItems(bag.id)
    
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`Bag Inventory: ${inventory.name}`, 10, 20)
    
    if (inventory.description) {
      doc.setFontSize(12)
      doc.text(`Description: ${inventory.description}`, 10, 30)
    }

    if (items.length > 0) {
      const data = items.map(item => [
        item.gear_name,
        item.quantity,
        item.notes || ''
      ])
      
      autoTable(doc, {
        startY: inventory.description ? 40 : 30,
        head: [['Gear Name', 'Quantity', 'Notes']],
        body: data
      })
    } else {
      doc.setFontSize(12)
      doc.text('No items in this bag.', 10, inventory.description ? 40 : 30)
    }

    doc.save(`bag_inventory_${bag.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('Inventory printed')
  } catch (err) {
    toast.error(err.message || 'Failed to print inventory')
  }
}

onMounted(async () => {
  await loadBags()
})
</script>

<style scoped>
.travel-packing {
  padding: 16px;
}

.packing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
}

.packing-description {
  color: #6c757d;
  font-size: 14px;
  margin-bottom: 24px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.bags-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.bag-card {
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.bag-image-container {
  width: 100%;
  height: 200px;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.bag-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bag-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #6c757d;
}

.placeholder-icon {
  font-size: 48px;
}

.bag-content {
  padding: 16px;
}

.bag-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #1a1a1a;
}

.bag-description {
  color: #6c757d;
  font-size: 14px;
  margin: 0 0 12px 0;
}

.bag-items-count {
  margin-bottom: 12px;
  font-size: 14px;
}

.count-label {
  color: #6c757d;
}

.count-value {
  font-weight: 600;
  color: #1a1a1a;
}

.bag-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 14px;
  min-height: 32px;
}

.modal-large {
  max-width: 800px;
}

.items-list {
  max-height: 400px;
  overflow-y: auto;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.item-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.item-quantity,
.item-notes {
  font-size: 12px;
  color: #6c757d;
  margin: 0;
}

.empty-items {
  text-align: center;
  padding: 24px;
  color: #6c757d;
}

@media (min-width: 768px) {
  .bags-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .bags-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>

