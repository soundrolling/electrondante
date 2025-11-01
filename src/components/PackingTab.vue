<template>
  <div class="packing-tab">
    <div class="packing-header">
      <h2 class="section-title">My Packing Bags</h2>
      <div class="header-actions">
        <button class="btn btn-info print-my-gear-btn" @click="printMyGearInventory">
          <span class="btn-icon">🖨️</span>
          <span class="btn-text">Print All Gear Bags</span>
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
          
          <div class="bag-weight-info">
            <span class="weight-label">Total Weight:</span>
            <span class="weight-value">{{ formatBagWeight(bag.id) }}</span>
            <div v-if="getBagWeightBreakdown(bag.id)" class="weight-breakdown">
              {{ getBagWeightBreakdown(bag.id) }}
            </div>
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
      <div class="modal bag-modal" @click.stop>
        <button class="modal-close-top-right" @click="closeBagModal" aria-label="Close">✕</button>
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
            <label class="form-label">Bag Weight Option</label>
            <div class="weight-option-selector">
              <label class="radio-option">
                <input 
                  type="radio" 
                  v-model="bagForm.weightMode" 
                  value="override"
                  class="radio-input"
                />
                <span class="radio-label">Override Total Weight</span>
              </label>
              <label class="radio-option">
                <input 
                  type="radio" 
                  v-model="bagForm.weightMode" 
                  value="empty_bag"
                  class="radio-input"
                />
                <span class="radio-label">Empty Bag Weight + Items</span>
              </label>
            </div>
            
            <div v-if="bagForm.weightMode === 'override'" class="weight-input-section">
              <label class="form-label">Total Bag Weight (Override)</label>
              <div class="weight-input-group">
                <input 
                  v-model.number="bagForm.weightInput" 
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input weight-input"
                  placeholder="Enter total bag weight"
                />
                <select 
                  v-model="bagForm.weightInputUnit"
                  class="weight-unit-select"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <p v-if="bagForm.weightInput" class="form-hint">
                {{ formatWeight(convertInputToKg(bagForm.weightInput, bagForm.weightInputUnit) || 0, bagForm.weightInputUnit) }} total
              </p>
              <p v-else class="form-hint">Override the total bag weight (ignores item weights)</p>
            </div>
            
            <div v-if="bagForm.weightMode === 'empty_bag'" class="weight-input-section">
              <label class="form-label">Empty Bag Weight</label>
              <div class="weight-input-group">
                <input 
                  v-model.number="bagForm.emptyBagWeightInput" 
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-input weight-input"
                  placeholder="Enter empty bag weight"
                />
                <select 
                  v-model="bagForm.emptyBagWeightUnit"
                  class="weight-unit-select"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <p v-if="bagForm.emptyBagWeightInput" class="form-hint">
                Empty bag: {{ formatWeight(convertInputToKg(bagForm.emptyBagWeightInput, bagForm.emptyBagWeightUnit) || 0, bagForm.emptyBagWeightUnit) }}
                <br>
                <span class="calculated-items-hint">+ Items weight (calculated from gear)</span>
              </p>
              <p v-else class="form-hint">Empty bag weight will be added to calculated items weight</p>
            </div>
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
                    :disabled="getGearAvailable(gear.id) <= 0"
                  >
                    {{ gear.gear_name }} ({{ gear.gear_type }}) - Total: {{ gear.gear_amount || 0 }}, In Bags: {{ getGearInBags(gear.id) }}, Available: {{ getGearAvailable(gear.id) }}
                  </option>
                </select>
                <input 
                  v-model.number="gearQuantityToAdd" 
                  type="number"
                  :min="1"
                  :max="getMaxQuantityForSelectedGear()"
                  class="form-input"
                  placeholder="Quantity"
                  style="max-width: 120px;"
                  @input="enforceMaxQuantity"
                />
                <button 
                  class="btn btn-positive btn-sm" 
                  @click="addItemToBag"
                  :disabled="!selectedGearToAdd || !gearQuantityToAdd || gearQuantityToAdd > getMaxQuantityForSelectedGear()"
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
                  <div class="item-actions">
                    <button 
                      class="btn btn-info btn-sm" 
                      @click="openChangeBagModal(item)"
                      title="Change Bag"
                    >
                      <span class="btn-icon">🔄</span>
                    </button>
                    <button 
                      class="btn btn-danger btn-sm remove-btn" 
                      @click="removeItemFromBag(item.id)"
                      title="Remove"
                    >
                      <span class="remove-icon">🗑️</span>
                    </button>
                  </div>
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

    <!-- Change Bag Modal -->
    <div v-if="showChangeBagModal" class="modal-overlay" @click="closeChangeBagModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Move Item to Another Bag</h3>
          <button class="modal-close" @click="closeChangeBagModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="itemToMove" class="item-preview">
            <p><strong>{{ itemToMove.gear_name }}</strong></p>
            <p>Current Quantity: {{ itemToMove.quantity }}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Select Destination Bag</label>
            <select v-model="selectedDestinationBag" class="form-select">
              <option value="">Choose a bag...</option>
              <option 
                v-for="bag in availableBagsForMove" 
                :key="bag.id"
                :value="bag.id"
              >
                {{ bag.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeChangeBagModal">Cancel</button>
          <button 
            class="btn btn-positive" 
            @click="moveItemToBag"
            :disabled="!selectedDestinationBag"
          >
            Move Item
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useUserStore } from '../stores/userStore'
import { supabase } from '../supabase'
import { fetchTableData } from '../services/dataService'
import PackingService from '../services/packingService'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatWeight, getWeightUnit, convertInputToKg, kgToLbs, lbsToKg } from '../utils/weightUtils'

const props = defineProps({
  projectId: {
    type: String,
    required: false,
    default: ''
  }
})

const route = useRoute()

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
  weight_kg: null,
  weightInput: null,
  weightInputUnit: 'kg',
  imageFile: null,
  imagePreview: null
})

const selectedGearToAdd = ref('')
const gearQuantityToAdd = ref(1)
const availableProjectGear = ref([])
const availableUserGear = ref([])
const locationsList = ref([])
const gearAssignedCounts = ref({}) // Map of gear_id -> total quantity assigned to bags
const showChangeBagModal = ref(false)
const itemToMove = ref(null)
const selectedDestinationBag = ref('')

const availableBagsForMove = computed(() => {
  if (!itemToMove.value || !currentBag.value) return []
  // Return all bags except the current one
  return bags.value.filter(bag => bag.id !== currentBag.value.id)
})

const userId = computed(() => userStore.user?.id)
const currentProject = computed(() => userStore.getCurrentProject)

// Get project ID from prop or route params - route params is most reliable
const effectiveProjectId = computed(() => {
  // Prefer route params since we're in a project route
  if (route.params.id) {
    return String(route.params.id)
  }
  // Fallback to prop
  if (props.projectId && props.projectId.trim() !== '') {
    return props.projectId
  }
  // Last resort: currentProject from store
  if (currentProject.value?.id) {
    return String(currentProject.value.id)
  }
  return ''
})

const totalBagQuantity = computed(() => {
  return bagItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0)
})

function getBagTotalQuantity(bagId) {
  return bagItems.value
    .filter(item => item.bag_id === bagId)
    .reduce((sum, item) => sum + (item.quantity || 0), 0)
}

const weightUnit = ref(getWeightUnit())

function getBagItemsWeight(bagId) {
  const itemsInBag = bagItems.value.filter(item => item.bag_id === bagId)
  let itemsWeight = 0
  
  itemsInBag.forEach(item => {
    if (item.gear_id) {
      // Find gear in availableProjectGear to get its weight
      const gear = availableProjectGear.value.find(g => g.id === item.gear_id)
      if (gear && gear.weight_kg) {
        itemsWeight += (Number(gear.weight_kg) || 0) * (item.quantity || 0)
      }
    }
  })
  
  return itemsWeight
}

function getBagTotalWeight(bagId) {
  const bag = bags.value.find(b => b.id === bagId)
  if (!bag) return 0
  
  // Option 1: If override weight is set, use that
  if (bag.weight_kg) {
    return Number(bag.weight_kg)
  }
  
  // Option 2: Empty bag weight + items weight
  const emptyBagWeight = bag.empty_bag_weight_kg ? Number(bag.empty_bag_weight_kg) : 0
  const itemsWeight = getBagItemsWeight(bagId)
  
  return emptyBagWeight + itemsWeight
}

function getBagWeightBreakdown(bagId) {
  const bag = bags.value.find(b => b.id === bagId)
  if (!bag) return null
  
  // If override weight, no breakdown needed
  if (bag.weight_kg) {
    return null
  }
  
  const emptyBagWeight = bag.empty_bag_weight_kg ? Number(bag.empty_bag_weight_kg) : 0
  const itemsWeight = getBagItemsWeight(bagId)
  
  if (emptyBagWeight > 0 && itemsWeight > 0) {
    return `Bag: ${formatWeight(emptyBagWeight, weightUnit.value)} + Items: ${formatWeight(itemsWeight, weightUnit.value)}`
  } else if (emptyBagWeight > 0) {
    return `Bag: ${formatWeight(emptyBagWeight, weightUnit.value)} (no items yet)`
  } else if (itemsWeight > 0) {
    return `Items: ${formatWeight(itemsWeight, weightUnit.value)} (empty bag weight not set)`
  }
  
  return null
}

function formatBagWeight(bagId) {
  const weightKg = getBagTotalWeight(bagId)
  return formatWeight(weightKg, weightUnit.value)
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
    // Reload assigned counts when viewing a bag
    await updateGearAssignedCounts()
  } catch (err) {
    toast.error(err.message || 'Failed to load bag items')
  }
}

async function updateGearAssignedCounts() {
  try {
    if (!userId.value) return
    
    // Get all bag items for this user's bags
    const allBagIds = bags.value.map(b => b.id)
    if (allBagIds.length === 0) {
      gearAssignedCounts.value = {}
      return
    }
    
    // Query all gear_bag_items for this user's bags
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
    
    // Sum quantities per gear_id
    const counts = {}
    if (allItems) {
      allItems.forEach(item => {
        if (item.gear_id) {
          counts[item.gear_id] = (counts[item.gear_id] || 0) + (item.quantity || 0)
        }
      })
    }
    gearAssignedCounts.value = counts
    console.log('[PackingTab] Gear assigned counts:', counts)
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

function getMaxQuantityForSelectedGear() {
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

function enforceMaxQuantity() {
  const maxQuantity = getMaxQuantityForSelectedGear()
  if (gearQuantityToAdd.value > maxQuantity) {
    gearQuantityToAdd.value = maxQuantity
    toast.warning(`Maximum available quantity is ${maxQuantity}`)
  }
  if (gearQuantityToAdd.value < 1) {
    gearQuantityToAdd.value = 1
  }
}

async function loadAvailableGear() {
  try {
    // Load gear from the project that belongs to the current user - only if projectId is valid
    // Note: We use gear_amount (total) regardless of stage assignments since packing happens separately
    const projectId = effectiveProjectId.value
    if (projectId && projectId.trim() !== '' && userId.value) {
      console.log('[PackingTab] Loading gear for project:', projectId, 'user:', userId.value)
      
      // First, get all project gear - we don't need to check assignments, just get gear_amount
      const allProjectGear = await fetchTableData('gear_table', {
        eq: { project_id: projectId },
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
          
          availableProjectGear.value = ownedGear.map(g => ({
            ...g,
            // Ensure gear_amount is always available, default to 0 if missing
            gear_amount: g.gear_amount || 0,
            // Add weight from user_gear
            weight_kg: weightMap[g.user_gear_id] || null
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
      console.log('[PackingTab] Missing projectId or userId:', { 
        projectId: projectId, 
        effectiveProjectId: effectiveProjectId.value,
        routeParamsId: route.params.id,
        currentProjectId: currentProject.value?.id,
        userId: userId.value 
      })
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
    weight_kg: null,
    empty_bag_weight_kg: null,
    weightMode: 'empty_bag',
    weightInput: null,
    weightInputUnit: weightUnit.value,
    emptyBagWeightInput: null,
    emptyBagWeightUnit: weightUnit.value,
    imageFile: null,
    imagePreview: null
  }
  showBagModal.value = true
}

function editBag(bag) {
  isEditingBag.value = true
  currentBag.value = bag
  const currentUnit = weightUnit.value
  
  // Determine weight mode based on what's set
  const weightMode = bag.weight_kg ? 'override' : 'empty_bag'
  const weightKg = bag.weight_kg || null
  const emptyBagWeightKg = bag.empty_bag_weight_kg || null
  
  bagForm.value = {
    name: bag.name,
    description: bag.description || '',
    weight_kg: weightKg,
    empty_bag_weight_kg: emptyBagWeightKg,
    weightMode: weightMode,
    weightInput: weightKg ? (currentUnit === 'lbs' ? kgToLbs(weightKg) : weightKg) : null,
    weightInputUnit: currentUnit,
    emptyBagWeightInput: emptyBagWeightKg ? (currentUnit === 'lbs' ? kgToLbs(emptyBagWeightKg) : emptyBagWeightKg) : null,
    emptyBagWeightUnit: currentUnit,
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
    weight_kg: null,
    empty_bag_weight_kg: null,
    weightMode: 'empty_bag',
    weightInput: null,
    weightInputUnit: weightUnit.value,
    emptyBagWeightInput: null,
    emptyBagWeightUnit: weightUnit.value,
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
    // Handle weight based on mode
    let weight_kg = null
    let empty_bag_weight_kg = null
    
    if (bagForm.value.weightMode === 'override') {
      // Override mode: set total weight, clear empty bag weight
      weight_kg = bagForm.value.weightInput 
        ? convertInputToKg(bagForm.value.weightInput, bagForm.value.weightInputUnit)
        : null
      empty_bag_weight_kg = null
    } else {
      // Empty bag mode: set empty bag weight, clear override
      empty_bag_weight_kg = bagForm.value.emptyBagWeightInput 
        ? convertInputToKg(bagForm.value.emptyBagWeightInput, bagForm.value.emptyBagWeightUnit)
        : null
      weight_kg = null
    }
    
    const bagData = {
      name: bagForm.value.name.trim(),
      description: bagForm.value.description?.trim() || null,
      weight_kg: weight_kg,
      empty_bag_weight_kg: empty_bag_weight_kg,
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
  updateGearAssignedCounts()
  showBagItemsModal.value = true
}

function openChangeBagModal(item) {
  itemToMove.value = item
  selectedDestinationBag.value = ''
  showChangeBagModal.value = true
}

function closeChangeBagModal() {
  showChangeBagModal.value = false
  itemToMove.value = null
  selectedDestinationBag.value = ''
}

async function moveItemToBag() {
  if (!itemToMove.value || !selectedDestinationBag.value || !currentBag.value) return
  
  try {
    // Get the destination bag
    const destBag = bags.value.find(b => b.id === selectedDestinationBag.value)
    if (!destBag) {
      toast.error('Destination bag not found')
      return
    }
    
    // Check if item already exists in destination bag
    const existingItems = await PackingService.getBagItems(selectedDestinationBag.value)
    const existingItem = existingItems.find(item => item.gear_id === itemToMove.value.gear_id)
    
    if (existingItem) {
      // Update quantity in destination bag
      await PackingService.updateBagItem(existingItem.id, {
        quantity: (existingItem.quantity || 0) + (itemToMove.value.quantity || 0)
      })
      // Remove from source bag
      await PackingService.removeItemFromBag(itemToMove.value.id)
      toast.success(`Item moved and merged with existing item in "${destBag.name}"`)
    } else {
      // Update the bag_id of the item
      await PackingService.updateBagItem(itemToMove.value.id, {
        bag_id: selectedDestinationBag.value
      })
      toast.success(`Item moved to "${destBag.name}"`)
    }
    
    // Reload items for current bag
    await loadBagItems(currentBag.value.id)
    // Reload all bags to refresh total counts on bag cards
    await loadBags()
    await updateGearAssignedCounts()
    await loadAvailableGear()
    closeChangeBagModal()
  } catch (err) {
    console.error('Failed to move item:', err)
    toast.error(err.message || 'Failed to move item')
  }
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
    const available = getGearAvailable(gear.id)
    
    // Validate quantity doesn't exceed available
    if (gearQuantityToAdd.value > available) {
      toast.error(`Cannot add more than ${available} ${gearName}. Only ${available} available.`)
      gearQuantityToAdd.value = Math.max(1, available)
      return
    }
    
    // Only use gear_id since we're only showing project gear now
    await PackingService.addItemToBag(currentBag.value.id, {
      gear_id: gear.id,
      gear_name: gearName,
      quantity: gearQuantityToAdd.value
    })

    const quantity = gearQuantityToAdd.value
    selectedGearToAdd.value = ''
    gearQuantityToAdd.value = 1
    await loadBagItems(currentBag.value.id)
    await updateGearAssignedCounts()
    toast.success(`Added ${quantity} × ${gearName} to bag`)
  } catch (err) {
    console.error('Failed to add item:', err)
    toast.error(err.message || 'Failed to add item')
  }
}

async function removeItemFromBag(itemId) {
  if (!confirm('Remove this item from the bag?')) return
  
  try {
    await PackingService.removeItemFromBag(itemId)
    if (currentBag.value) {
      await loadBagItems(currentBag.value.id)
    }
    await updateGearAssignedCounts()
    await loadAvailableGear()
    toast.success('Item removed')
  } catch (err) {
    console.error('Failed to remove item:', err)
    toast.error(err.message || 'Failed to remove item')
  }
}

async function printBagInventory(bag) {
  try {
    const inventory = await PackingService.getBagInventoryForPrint(bag.id)
    const items = await PackingService.getBagItems(bag.id)
    
    const doc = new jsPDF()
    let yPosition = 20
    
    // Project name
    doc.setFontSize(14)
    doc.text(`Project: ${currentProject.value?.project_name || 'Current Project'}`, 10, yPosition)
    yPosition += 10
    
    // Bag title
    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text(`Bag Inventory: ${inventory.name}`, 10, yPosition)
    yPosition += 10
    
    // Bag image if available
    if (bag.imageUrl) {
      try {
        // Fetch the image as a blob
        const response = await fetch(bag.imageUrl)
        const blob = await response.blob()
        const imageDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        
        // Create an image element to get actual dimensions
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageDataUrl
        })
        
        // Calculate dimensions (max width 80mm, maintain aspect ratio)
        // jsPDF uses mm as units, so we need to convert from pixels
        // Standard DPI is 96, so 1 mm ≈ 3.779527559 pixels
        const maxWidth = 80 // mm
        const aspectRatio = img.height / img.width
        const imgWidthMm = Math.min(maxWidth, img.width / 3.779527559) // Convert px to mm
        const imgHeightMm = imgWidthMm * aspectRatio
        
        // Determine image format from data URL or blob type
        const imageFormat = blob.type.includes('png') ? 'PNG' : 'JPEG'
        doc.addImage(imageDataUrl, imageFormat, 10, yPosition, imgWidthMm, imgHeightMm)
        yPosition += imgHeightMm + 10
      } catch (imgErr) {
        console.warn('Could not add bag image to PDF:', imgErr)
        // Continue without image
      }
    }
    
    // Bag description if exists
    if (inventory.description) {
      doc.setFontSize(12)
      doc.setFont(undefined, 'normal')
      doc.text(`Description: ${inventory.description}`, 10, yPosition)
      yPosition += 8
    }

    // Items table
    if (items.length > 0) {
      const data = items.map(item => [
        item.gear_name || 'Unknown',
        (item.quantity || 0).toString(),
        item.notes || ''
      ])
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Gear Name', 'Quantity', 'Notes']],
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [23, 162, 184], textColor: [255, 255, 255] }
      })
    } else {
      doc.setFontSize(12)
      doc.setFont(undefined, 'normal')
      doc.text('No items in this bag.', 10, yPosition)
    }

    doc.save(`bag_inventory_${bag.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('Inventory printed')
  } catch (err) {
    console.error('Failed to print bag inventory:', err)
    toast.error(err.message || 'Failed to print inventory')
  }
}

async function fetchLocations() {
  const projectId = effectiveProjectId.value
  if (!projectId || projectId.trim() === '') return
  try {
    locationsList.value = await fetchTableData('locations', {
      eq: { project_id: projectId },
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
  
  const projectId = effectiveProjectId.value
  if (!projectId || projectId.trim() === '') {
    toast.error('No project selected')
    return
  }

  try {
    // Ensure gear is loaded for weight calculations
    if (availableProjectGear.value.length === 0) {
      await loadAvailableGear()
    }
    
    // Get all bags for the user
    const userBags = await PackingService.getUserBags(userId.value)
    
    if (userBags.length === 0) {
      toast.info('No bags found to print')
      return
    }
    
    const doc = new jsPDF()
    let yPosition = 20
    
    // Header
    doc.setFontSize(18)
    doc.text('All Gear Bags', 10, yPosition)
    yPosition += 10
    
    doc.setFontSize(12)
    doc.text(`Project: ${currentProject.value?.project_name || 'Current Project'}`, 10, yPosition)
    yPosition += 8
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, yPosition)
    yPosition += 15
    
    // Process each bag
    for (let i = 0; i < userBags.length; i++) {
      const bag = userBags[i]
      
      // Check if we need a new page (leave space for header + at least one item)
      if (yPosition > 250) {
        doc.addPage()
        yPosition = 20
      }
      
      // Bag header
      doc.setFontSize(16)
      doc.setFont(undefined, 'bold')
      doc.text(`${i + 1}. ${bag.name}`, 10, yPosition)
      yPosition += 10
      
      // Bag description if exists
      if (bag.description) {
        doc.setFontSize(11)
        doc.setFont(undefined, 'normal')
        doc.text(bag.description, 10, yPosition)
        yPosition += 7
      }
      
      // Get bag items
      const items = await PackingService.getBagItems(bag.id)
      
      // Calculate bag weight
      let bagWeight = 0
      // Option 1: If override weight is set, use that
      if (bag.weight_kg) {
        bagWeight = Number(bag.weight_kg)
      } else {
        // Option 2: Empty bag weight + items weight
        const emptyBagWeight = bag.empty_bag_weight_kg ? Number(bag.empty_bag_weight_kg) : 0
        let itemsWeight = 0
        
        // Calculate items weight from gear
        items.forEach(item => {
          if (item.gear_id) {
            const gear = availableProjectGear.value.find(g => g.id === item.gear_id)
            if (gear && gear.weight_kg) {
              itemsWeight += (Number(gear.weight_kg) || 0) * (item.quantity || 0)
            }
          }
        })
        
        bagWeight = emptyBagWeight + itemsWeight
      }
      
      const weightText = bagWeight > 0 ? formatWeight(bagWeight, weightUnit.value) : 'Weight not calculated'
      
      // Bag weight info
      doc.setFontSize(11)
      doc.setFont(undefined, 'bold')
      doc.text(`Weight: ${weightText}`, 10, yPosition)
      yPosition += 8
      
      // Items table
      if (items.length > 0) {
        const itemData = items.map(item => [
          item.gear_name || 'Unknown',
          (item.quantity || 0).toString(),
          item.notes || ''
        ])
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Gear Name', 'Quantity', 'Notes']],
          body: itemData,
          theme: 'grid',
          headStyles: { fillColor: [23, 162, 184], textColor: [255, 255, 255] },
          margin: { left: 10, right: 10 }
        })
        
        // Get the final Y position after the table
        yPosition = doc.lastAutoTable.finalY + 10
      } else {
        doc.setFontSize(10)
        doc.setFont(undefined, 'italic')
        doc.text('No items in this bag.', 10, yPosition)
        yPosition += 10
      }
      
      // Add spacing between bags
      yPosition += 5
    }
    
    doc.save(`all_gear_bags_${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('All gear bags printed')
  } catch (err) {
    console.error('Failed to print all gear bags:', err)
    toast.error(err.message || 'Failed to print bags')
  }
}

// Watch for projectId changes and reload gear when it becomes available
watch(() => effectiveProjectId.value, async (newProjectId) => {
  if (newProjectId && newProjectId.trim() !== '') {
    console.log('[PackingTab] ProjectId changed, reloading gear:', newProjectId)
    await loadAvailableGear()
    await updateGearAssignedCounts()
    await fetchLocations()
  }
}, { immediate: true })

// Watch for gear selection changes and adjust quantity if needed
watch(() => selectedGearToAdd.value, (newSelection) => {
  if (newSelection) {
    const maxQuantity = getMaxQuantityForSelectedGear()
    if (gearQuantityToAdd.value > maxQuantity) {
      gearQuantityToAdd.value = Math.max(1, maxQuantity)
    }
  } else {
    // Reset to 1 when no gear is selected
    gearQuantityToAdd.value = 1
  }
})

onMounted(async () => {
  await loadBags()
  const projectId = effectiveProjectId.value
  if (projectId && projectId.trim() !== '') {
    console.log('[PackingTab] ProjectId available on mount:', projectId)
    await loadAvailableGear()
    await updateGearAssignedCounts()
    await fetchLocations()
  } else {
    console.log('[PackingTab] No projectId on mount, will wait for prop/route update')
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
  color: var(--text-primary);
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
  background: var(--bg-primary);
  border: 1px solid #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.bag-image-container {
  width: 100%;
  height: 200px;
  background: var(--bg-secondary);
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
  color: var(--text-secondary);
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
  color: var(--text-primary);
}

.bag-description {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 12px 0;
}

.bag-items-count {
  margin-bottom: 12px;
  font-size: 14px;
}

.count-label {
  color: var(--text-secondary);
}

.count-value {
  font-weight: 600;
  color: var(--text-primary);
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
  background: var(--bg-primary);
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
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 0;
}

/* Hide header for bag modal */
.bag-modal .modal-header {
  display: none;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-form {
  padding: 24px;
}

/* Create Bag Modal - hide header, add padding */
.bag-modal {
  padding: 24px;
  position: relative;
}

.bag-modal .modal-form {
  padding: 0;
}

.modal-close-top-right {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-medium);
  color: var(--text-primary);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 20px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.2s ease;
}

.modal-close-top-right:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-primary-500);
  color: var(--text-primary);
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
  color: var(--text-primary);
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
  border: 2px solid var(--border-medium);
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  transition: all 0.2s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
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
  background: var(--bg-secondary);
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 500;
  margin-right: 12px;
  transition: all 0.2s ease;
}

.form-input[type="file"]::file-selector-button:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-medium);
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
  color: var(--text-secondary);
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
  background: var(--bg-secondary);
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
  color: var(--text-secondary);
  margin: 0;
}

.empty-items {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
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

/* Item Actions */
.item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.remove-btn .remove-icon {
  filter: brightness(0) invert(1);
  font-size: 16px;
}

.item-preview {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.item-preview p {
  margin: 4px 0;
  color: var(--text-primary);
}

.item-preview strong {
  font-size: 16px;
}

/* Weight Display */
.bag-weight-info {
  margin-top: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.weight-label {
  color: var(--text-secondary);
}

.weight-value {
  font-weight: 600;
  color: var(--text-primary);
}

.weight-custom {
  color: #047857;
  font-size: 12px;
  font-style: italic;
}

.weight-breakdown {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.calculated-items-hint {
  color: var(--text-tertiary);
  font-size: 11px;
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
  font-style: italic;
}

/* Weight Input Group */
.weight-input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.weight-input {
  flex: 1;
  min-width: 120px; /* Ensures enough space for 4 digits and decimal point */
}

.weight-unit-select {
  min-width: 80px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: var(--bg-primary);
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.weight-unit-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Weight Option Selector */
.weight-option-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid var(--border-medium);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-secondary);
}

.radio-option:hover {
  border-color: var(--color-primary-500);
  background: var(--bg-tertiary);
}

.radio-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary-500);
}

.radio-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
}

.radio-option:has(.radio-input:checked) {
  border-color: var(--color-primary-500);
  background: rgba(59, 130, 246, 0.15);
}

/* Dark mode styling for radio options */
.dark .radio-option {
  background: var(--bg-secondary);
  border-color: var(--border-medium);
}

.dark .radio-option:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-primary-500);
}

.dark .radio-option:has(.radio-input:checked) {
  background: rgba(59, 130, 246, 0.2);
  border-color: var(--color-primary-500);
}

.weight-input-section {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}
</style>

