<template>
  <div class="packing-tab">
    <div class="packing-header">
      <h2 class="section-title">My Packing Bags</h2>
      <div class="header-actions">
        <button class="btn btn-info print-my-gear-btn" @click="printMyGearInventory">
          <span class="btn-icon">🖨️</span>
          <span class="btn-text">Print My Gear</span>
        </button>
        <button class="btn btn-positive" @click="openCreateBagModal">
          <span class="btn-icon">➕</span>
          <span class="btn-text">Create Bag</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading bags...</p>
    </div>

    <div v-else-if="bags.length === 0" class="empty-state">
      <div class="empty-icon">🎒</div>
      <h3>No bags yet</h3>
      <p>Create your first packing bag to organize your gear</p>
      <button class="btn btn-positive" @click="openCreateBagModal">Create Your First Bag</button>
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
            <span class="count-label">Total Items:</span>
            <span class="count-value">{{ getBagTotalQuantity(bag.id) }}</span>
          </div>

          <div class="bag-actions">
            <button class="btn btn-primary btn-sm" @click="viewBag(bag)" title="View">
              <span class="btn-icon">👁️</span>
              <span class="btn-text">View</span>
            </button>
            <button class="btn btn-warning btn-sm" @click="editBag(bag)" title="Edit">
              <span class="btn-icon">✏️</span>
              <span class="btn-text">Edit</span>
            </button>
            <button class="btn btn-primary btn-sm" @click="printBagInventory(bag)" title="Print">
              <span class="btn-icon">🖨️</span>
              <span class="btn-text">Print</span>
            </button>
            <button class="btn btn-danger btn-sm" @click="confirmDeleteBag(bag)" title="Delete">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Bag Modal -->
    <div v-if="showBagModal" class="modal-overlay" @click="closeBagModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>{{ isEditingBag ? 'Edit Bag' : 'Create Bag' }}</h3>
          <button class="modal-close" @click="closeBagModal">✕</button>
        </div>
        <form @submit.prevent="saveBag" class="modal-form">
          <div class="form-group">
            <label class="form-label">Bag Name *</label>
            <input 
              v-model="bagForm.name" 
              required
              class="form-input"
              placeholder="e.g., Main Equipment Bag"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea 
              v-model="bagForm.description" 
              class="form-textarea"
              placeholder="Optional description"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Bag Image</label>
            <input 
              ref="imageInput"
              type="file"
              accept="image/*"
              @change="onImageSelect"
              class="form-input"
            />
            <div v-if="bagForm.imagePreview" class="image-preview-container">
              <img :src="bagForm.imagePreview" alt="Preview" class="image-preview" />
              <button type="button" class="btn btn-warning btn-sm" @click="clearImagePreview">
                Remove Image
              </button>
            </div>
            <div v-if="currentBag?.imageUrl && !bagForm.imageFile" class="current-image-container">
              <p class="image-note">Current image:</p>
              <img :src="currentBag.imageUrl" alt="Current" class="image-preview" />
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeBagModal">Cancel</button>
            <button type="submit" class="btn btn-positive" :disabled="saving">
              {{ saving ? 'Saving...' : (isEditingBag ? 'Update Bag' : 'Create Bag') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- View/Manage Bag Items Modal -->
    <div v-if="showBagItemsModal" class="modal-overlay" @click="closeBagItemsModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h3>{{ currentBag?.name }} - Items</h3>
          <button class="modal-close" @click="closeBagItemsModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="bag-items-section">
            <div class="add-item-section">
              <h4>Add Gear to Bag</h4>
              <div class="gear-selector">
                <select v-model="selectedGearToAdd" class="form-select">
                  <option value="">Select gear to add...</option>
                  <option 
                    v-for="gear in availableProjectGear" 
                    :key="'pg-' + gear.id"
                    :value="JSON.stringify({ type: 'gear', gear })"
                  >
                    {{ gear.gear_name }} ({{ gear.gear_type }}) - Total: {{ gear.gear_amount || 0 }}
                  </option>
                </select>
                <input 
                  v-model.number="gearQuantityToAdd" 
                  type="number"
                  min="1"
                  class="form-input"
                  placeholder="Quantity"
                  style="max-width: 120px;"
                />
                <button 
                  class="btn btn-positive btn-sm" 
                  @click="addItemToBag"
                  :disabled="!selectedGearToAdd || !gearQuantityToAdd"
                >
                  Add
                </button>
              </div>
            </div>

            <div class="items-list">
              <h4>Items in Bag ({{ totalBagQuantity }})</h4>
              <div v-if="bagItems.length === 0" class="empty-items">
                <p>No items in this bag yet. Add gear above.</p>
              </div>
              <div v-else class="items-grid">
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
                  <button 
                    class="btn btn-danger btn-sm" 
                    @click="removeItemFromBag(item.id)"
                    title="Remove"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeBagItemsModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useUserStore } from '../stores/userStore'
import { supabase } from '../supabase'
import { fetchTableData } from '../services/dataService'
import PackingService from '../services/packingService'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const props = defineProps({
  projectId: {
    type: String,
    required: false,
    default: ''
  }
})

const toast = useToast()
const userStore = useUserStore()

const loading = ref(false)
const saving = ref(false)
const bags = ref([])
const bagItems = ref([])
const showBagModal = ref(false)
const showBagItemsModal = ref(false)
const isEditingBag = ref(false)
const currentBag = ref(null)
const imageInput = ref(null)

const bagForm = ref({
  name: '',
  description: '',
  imageFile: null,
  imagePreview: null
})

const selectedGearToAdd = ref('')
const gearQuantityToAdd = ref(1)
const availableProjectGear = ref([])
const availableUserGear = ref([])
const locationsList = ref([])

const userId = computed(() => userStore.user?.id)
const currentProject = computed(() => userStore.getCurrentProject)

const totalBagQuantity = computed(() => {
  return bagItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0)
})

function getBagTotalQuantity(bagId) {
  return bagItems.value
    .filter(item => item.bag_id === bagId)
    .reduce((sum, item) => sum + (item.quantity || 0), 0)
}

async function loadBags() {
  if (!userId.value) return
  loading.value = true
  try {
    bags.value = await PackingService.getUserBags(userId.value)
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

async function loadAvailableGear() {
  try {
    // Load gear from the project that belongs to the current user - only if projectId is valid
    // Note: We use gear_amount (total) regardless of stage assignments since packing happens separately
    if (props.projectId && props.projectId.trim() !== '' && userId.value) {
      console.log('[PackingTab] Loading gear for project:', props.projectId, 'user:', userId.value)
      
      // First, get all project gear - we don't need to check assignments, just get gear_amount
      const allProjectGear = await fetchTableData('gear_table', {
        eq: { project_id: props.projectId },
        order: [{ column: 'gear_name', ascending: true }]
      })
      
      console.log('[PackingTab] All project gear:', allProjectGear.length, allProjectGear)
      
      // Filter to only user gear (is_user_gear = true) and ensure gear_amount exists
      // Note: Check for both boolean true and truthy values since database might return different formats
      const userGearItems = allProjectGear.filter(g => {
        const isUserGear = g.is_user_gear === true || g.is_user_gear === 1 || g.is_user_gear === 'true'
        const hasUserGearId = !!g.user_gear_id
        const hasAmount = (g.gear_amount || 0) > 0
        console.log('[PackingTab] Gear filter check:', g.gear_name, {
          isUserGear,
          is_user_gear_value: g.is_user_gear,
          hasUserGearId,
          hasAmount,
          gear_amount: g.gear_amount,
          user_gear_id: g.user_gear_id
        })
        return isUserGear && hasUserGearId && hasAmount
      })
      
      console.log('[PackingTab] User gear items after filter:', userGearItems.length, userGearItems)
      
      if (userGearItems.length > 0) {
        // Get the user_gear_ids
        const userGearIds = userGearItems.map(g => g.user_gear_id).filter(Boolean)
        console.log('[PackingTab] User gear IDs:', userGearIds)
        
        // Fetch user_gear records to check ownership
        const { data: userGearData, error } = await supabase
          .from('user_gear')
          .select('id, user_id')
          .in('id', userGearIds)
        
        console.log('[PackingTab] User gear data:', userGearData, 'error:', error)
        
        if (!error && userGearData) {
          // Create a map of user_gear_id to user_id
          const userGearOwnershipMap = {}
          userGearData.forEach(ug => {
            userGearOwnershipMap[ug.id] = ug.user_id
          })
          
          console.log('[PackingTab] Ownership map:', userGearOwnershipMap)
          console.log('[PackingTab] Current user ID:', userId.value)
          
          // Filter to only gear owned by the current user
          // Use gear_amount (total) - don't worry about assignments
          // Convert both IDs to strings to ensure proper comparison
          const currentUserIdStr = String(userId.value)
          const ownedGear = userGearItems.filter(g => {
            const gearUserId = userGearOwnershipMap[g.user_gear_id]
            const gearUserIdStr = gearUserId ? String(gearUserId) : null
            const matches = gearUserIdStr === currentUserIdStr
            console.log('[PackingTab] Ownership check:', g.gear_name, {
              gearUserId,
              gearUserIdStr,
              currentUserId: userId.value,
              currentUserIdStr,
              matches,
              user_gear_id: g.user_gear_id
            })
            return matches
          })
          
          console.log('[PackingTab] Owned gear:', ownedGear.length, ownedGear)
          
          availableProjectGear.value = ownedGear.map(g => ({
            ...g,
            // Ensure gear_amount is always available, default to 0 if missing
            gear_amount: g.gear_amount || 0
          }))
        } else {
          console.error('[PackingTab] Error fetching user_gear or no data:', error)
          availableProjectGear.value = []
        }
      } else {
        console.log('[PackingTab] No user gear items found')
        availableProjectGear.value = []
      }
      
      // Also get owner_name from user_gear_view for display
      if (availableProjectGear.value.length > 0) {
        const gearIds = availableProjectGear.value.map(g => g.user_gear_id).filter(Boolean)
        if (gearIds.length > 0) {
          const { data: userGearInfo, error: infoError } = await supabase
            .from('user_gear_view')
            .select('id, owner_name')
            .in('id', gearIds)
          
          if (!infoError && userGearInfo) {
            const ownerMap = {}
            userGearInfo.forEach(ug => {
              ownerMap[ug.id] = ug.owner_name
            })
            
            // Add owner_name to gear items
            availableProjectGear.value = availableProjectGear.value.map(g => ({
              ...g,
              owner_name: ownerMap[g.user_gear_id] || 'Unknown',
              gear_amount: g.gear_amount || 0 // Ensure gear_amount is always set
            }))
          }
        }
      }
      
      console.log('[PackingTab] Final available gear:', availableProjectGear.value.length, availableProjectGear.value)
    } else {
      console.log('[PackingTab] Missing projectId or userId:', { projectId: props.projectId, userId: userId.value })
      availableProjectGear.value = []
    }
    
    // Don't load user's personal gear - only show project gear
    availableUserGear.value = []
  } catch (err) {
    console.error('[PackingTab] Failed to load available gear:', err)
    availableProjectGear.value = []
    availableUserGear.value = []
  }
}

function openCreateBagModal() {
  isEditingBag.value = false
  currentBag.value = null
  bagForm.value = {
    name: '',
    description: '',
    imageFile: null,
    imagePreview: null
  }
  showBagModal.value = true
}

function editBag(bag) {
  isEditingBag.value = true
  currentBag.value = bag
  bagForm.value = {
    name: bag.name,
    description: bag.description || '',
    imageFile: null,
    imagePreview: null
  }
  showBagModal.value = true
}

function closeBagModal() {
  showBagModal.value = false
  bagForm.value = {
    name: '',
    description: '',
    imageFile: null,
    imagePreview: null
  }
  if (imageInput.value) imageInput.value.value = ''
}

function onImageSelect(event) {
  const file = event.target.files?.[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB')
      return
    }
    bagForm.value.imageFile = file
    bagForm.value.imagePreview = URL.createObjectURL(file)
  }
}

function clearImagePreview() {
  bagForm.value.imageFile = null
  bagForm.value.imagePreview = null
  if (imageInput.value) imageInput.value.value = ''
}

async function saveBag() {
  if (!bagForm.value.name.trim()) {
    toast.error('Please enter a bag name')
    return
  }
  if (!userId.value) {
    toast.error('User not authenticated')
    return
  }

  saving.value = true
  try {
    const bagData = {
      name: bagForm.value.name.trim(),
      description: bagForm.value.description?.trim() || null,
      imageFile: bagForm.value.imageFile
    }

    if (isEditingBag.value && currentBag.value) {
      await PackingService.updateBag(currentBag.value.id, bagData)
      toast.success('Bag updated')
    } else {
      await PackingService.createBag(userId.value, bagData)
      toast.success('Bag created')
    }
    
    closeBagModal()
    await loadBags()
  } catch (err) {
    toast.error(err.message || 'Failed to save bag')
  } finally {
    saving.value = false
  }
}

async function confirmDeleteBag(bag) {
  if (!confirm(`Delete "${bag.name}"? This will also remove all items in the bag.`)) return
  
  try {
    await PackingService.deleteBag(bag.id)
    toast.success('Bag deleted')
    await loadBags()
  } catch (err) {
    toast.error(err.message || 'Failed to delete bag')
  }
}

function viewBag(bag) {
  currentBag.value = bag
  loadBagItems(bag.id)
  loadAvailableGear()
  showBagItemsModal.value = true
}

function closeBagItemsModal() {
  showBagItemsModal.value = false
  currentBag.value = null
  bagItems.value = []
  selectedGearToAdd.value = ''
  gearQuantityToAdd.value = 1
}

async function addItemToBag() {
  if (!selectedGearToAdd.value || !gearQuantityToAdd.value || !currentBag.value) return

  try {
    const selection = JSON.parse(selectedGearToAdd.value)
    const gear = selection.gear
    const gearName = gear.gear_name
    
    // Only use gear_id since we're only showing project gear now
    await PackingService.addItemToBag(currentBag.value.id, {
      gear_id: gear.id,
      gear_name: gearName,
      quantity: gearQuantityToAdd.value
    })

    toast.success(`Added ${gearQuantityToAdd.value} × ${gearName}`)
    selectedGearToAdd.value = ''
    gearQuantityToAdd.value = 1
    await loadBagItems(currentBag.value.id)
  } catch (err) {
    toast.error(err.message || 'Failed to add item')
  }
}

async function removeItemFromBag(itemId) {
  try {
    await PackingService.removeItemFromBag(itemId)
    toast.success('Item removed')
    if (currentBag.value) {
      await loadBagItems(currentBag.value.id)
    }
  } catch (err) {
    toast.error(err.message || 'Failed to remove item')
  }
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

async function fetchLocations() {
  if (!props.projectId || props.projectId.trim() === '') return
  try {
    locationsList.value = await fetchTableData('locations', {
      eq: { project_id: props.projectId },
      order: [{ column: 'order', ascending: true }]
    })
  } catch (err) {
    console.error('Failed to fetch locations:', err)
  }
}

async function printMyGearInventory() {
  if (!userId.value) {
    toast.error('User not authenticated')
    return
  }
  
  if (!props.projectId || props.projectId.trim() === '') {
    toast.error('No project selected')
    return
  }

  try {
    // Fetch user's gear from project
    const myGear = await fetchTableData('gear_table', {
      eq: { project_id: props.projectId, is_user_gear: true }
    })
    
    // Fetch gear assignments
    const gearIds = myGear.map(g => g.id)
    let assignments = {}
    if (gearIds.length > 0) {
      const { data: assignmentData, error } = await supabase
        .from('gear_assignments')
        .select('gear_id, location_id, assigned_amount')
        .in('gear_id', gearIds)
      
      if (!error && assignmentData) {
        assignments = assignmentData.reduce((acc, a) => {
          if (!acc[a.gear_id]) acc[a.gear_id] = {}
          acc[a.gear_id][a.location_id] = a.assigned_amount
          return acc
        }, {})
      }
    }
    
    // Fetch locations if not already loaded
    if (locationsList.value.length === 0) {
      await fetchLocations()
    }
    
    if (myGear.length === 0) {
      toast.info('No gear found to print')
      return
    }
    
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text('My Gear Inventory', 10, 20)
    doc.setFontSize(12)
    doc.text(`Project: ${currentProject.value?.project_name || 'Current Project'}`, 10, 30)
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 38)
    
    const data = myGear.map(g => {
      // Get assignment locations
      const assignmentStrs = []
      if (assignments[g.id]) {
        Object.entries(assignments[g.id]).forEach(([locId, amount]) => {
          if (amount > 0) {
            const loc = locationsList.value.find(l => l.id === Number(locId))
            if (loc) {
              assignmentStrs.push(`${loc.stage_name} (${amount})`)
            }
          }
        })
      }
      const assignmentText = assignmentStrs.join(', ') || 'Unassigned'
      
      return [
        g.gear_name,
        g.gear_type || 'N/A',
        g.gear_amount?.toString() || '0',
        (g.gear_amount - (Object.values(assignments[g.id] || {}).reduce((sum, amt) => sum + amt, 0))).toString(),
        assignmentText,
        g.vendor || ''
      ]
    })
    
    autoTable(doc, {
      startY: 45,
      head: [['Gear Name', 'Type', 'Total', 'Available', 'Assignments', 'Vendor']],
      body: data
    })
    
    doc.save(`my_gear_inventory_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('Inventory printed')
  } catch (err) {
    console.error('Failed to print my gear inventory:', err)
    toast.error(err.message || 'Failed to print inventory')
  }
}

onMounted(async () => {
  await loadBags()
  await loadAvailableGear()
  if (props.projectId && props.projectId.trim() !== '') {
    await fetchLocations()
  }
})
</script>

<style scoped>
.packing-tab {
  padding: 16px;
}

.packing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.print-my-gear-btn {
  color: white !important;
}

.print-my-gear-btn .btn-text {
  color: white !important;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
  position: relative;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-large {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0 24px;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #1a1a1a;
}

.modal-form {
  padding: 24px;
}

.modal-body {
  padding: 24px;
  max-height: calc(90vh - 200px);
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px 24px 24px;
  border-top: 1px solid #e9ecef;
  margin-top: 0;
}

/* Form Elements */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
  font-size: 14px;
}

.form-label .required {
  color: #dc2626;
  margin-left: 2px;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  transition: all 0.2s ease;
  background: #ffffff;
  color: #1a1a1a;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #047857;
  box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.form-input[type="file"] {
  padding: 10px;
  cursor: pointer;
}

.form-input[type="file"]::file-selector-button {
  padding: 8px 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  color: #1a1a1a;
  cursor: pointer;
  font-weight: 500;
  margin-right: 12px;
  transition: all 0.2s ease;
}

.form-input[type="file"]::file-selector-button:hover {
  background: #e9ecef;
  border-color: #dee2e6;
}

/* Button Styles with Proper Contrast */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  border: 2px solid transparent;
  box-sizing: border-box;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-positive {
  background-color: #047857;
  color: #ffffff !important;
  border-color: #065f46;
}

.btn-positive:hover {
  background-color: #065f46;
  border-color: #065f46;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(4, 120, 87, 0.3);
}

.btn-positive .btn-text,
.btn-positive .btn-icon {
  color: #ffffff !important;
}

.btn-warning {
  background-color: #f59e0b;
  color: #111827 !important;
  border-color: #d97706;
}

.btn-warning:hover {
  background-color: #d97706;
  border-color: #b45309;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-warning .btn-text,
.btn-warning .btn-icon {
  color: #111827 !important;
}

.btn-danger {
  background-color: #dc2626;
  color: #ffffff !important;
  border-color: #b91c1c;
}

.btn-danger:hover {
  background-color: #b91c1c;
  border-color: #991b1b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-danger .btn-text,
.btn-danger .btn-icon {
  color: #ffffff !important;
}

.btn-primary {
  background-color: #1d4ed8;
  color: #ffffff !important;
  border-color: #1e40af;
}

.btn-primary:hover {
  background-color: #1e40af;
  border-color: #1e3a8a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);
}

.btn-primary .btn-text,
.btn-primary .btn-icon {
  color: #ffffff !important;
}

.btn-info {
  background-color: #17a2b8;
  color: #ffffff !important;
  border-color: #138496;
}

.btn-info:hover {
  background-color: #138496;
  border-color: #117a8b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
}

.btn-info .btn-text,
.btn-info .btn-icon {
  color: #ffffff !important;
}

.btn-secondary {
  background-color: #ffffff;
  color: #1a1a1a !important;
  border-color: #e9ecef;
}

.btn-secondary:hover {
  background-color: #f8f9fa;
  border-color: #dee2e6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-secondary .btn-text,
.btn-secondary .btn-icon {
  color: #1a1a1a !important;
}

.image-preview-container,
.current-image-container {
  margin-top: 12px;
}

.image-preview {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  margin-top: 8px;
}

.image-note {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
}

.gear-selector {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.items-list h4 {
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

