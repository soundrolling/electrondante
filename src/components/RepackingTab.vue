<template>
  <div class="repacking-tab">
    <div class="repacking-header">
      <h2 class="section-title">Repacking Checklist</h2>
      <div class="header-actions">
        <button class="btn btn-info" @click="clearAllChecks">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">Clear All Checks</span>
        </button>
        <button class="btn btn-positive" @click="checkAll">
          <span class="btn-icon">✅</span>
          <span class="btn-text">Check All</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading gear...</p>
    </div>

    <div v-else-if="repackingList.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>No gear to repack</h3>
      <p>Add gear to your bags to see the repacking checklist</p>
    </div>

    <div v-else class="repacking-table-container">
      <table class="repacking-table">
        <thead>
          <tr>
            <th class="check-column">
              <input 
                type="checkbox" 
                :checked="allChecked" 
                @change="toggleAllChecks"
                title="Check/Uncheck All"
              />
            </th>
            <th>Gear Name</th>
            <th>Type</th>
            <th>Bag</th>
            <th>Total Brought</th>
            <th>Quantity</th>
            <th>Unpacked</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in repackingList" 
            :key="item.bag_id ? `${item.gear_id}-${item.bag_id}` : `${item.gear_id}-unpacked`"
            :class="{ 'checked': isCheckedForItem(item) }"
          >
            <td class="check-column">
              <input 
                type="checkbox" 
                :checked="isCheckedForItem(item)"
                @change="toggleCheck(item)"
              />
            </td>
            <td class="gear-name">{{ item.gear_name }}</td>
            <td class="gear-type">{{ item.gear_type }}</td>
            <td class="bag-name">{{ item.bag_name || 'Unpacked' }}</td>
            <td class="total-brought">{{ item.total_brought }}</td>
            <td class="in-bags">{{ item.in_bags }} in {{ item.bag_name || 'Unpacked' }}</td>
            <td class="unpacked">{{ item.unpacked }}</td>
            <td class="status">
              <span 
                v-if="isAllGearChecked(item.gear_id)"
                class="status-badge status-checked"
                title="All instances checked"
              >
                ✓ Checked
              </span>
              <span 
                v-else
                :class="['status-badge', getStatusClass(item)]"
                :title="getStatusText(item)"
              >
                {{ getStatusText(item) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="repackingList.length > 0" class="summary-section">
      <div class="summary-card">
        <h3>Summary</h3>
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-label">Total Items:</span>
            <span class="stat-value">{{ totalItems }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Checked:</span>
            <span class="stat-value checked">{{ checkedCount }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Remaining:</span>
            <span class="stat-value remaining">{{ totalItems - checkedCount }}</span>
          </div>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${(checkedCount / totalItems) * 100}%` }"
          ></div>
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
const bags = ref([])
const bagItems = ref([])
const projectGear = ref([])
const checkedItems = ref(new Set())

const userId = computed(() => userStore.user?.id)
const currentProject = computed(() => userStore.getCurrentProject)

const effectiveProjectId = computed(() => {
  if (route.params.id) {
    return String(route.params.id)
  }
  if (props.projectId && props.projectId.trim() !== '') {
    return props.projectId
  }
  if (currentProject.value?.id) {
    return String(currentProject.value.id)
  }
  return ''
})

const repackingList = computed(() => {
  const list = []
  const gearMap = new Map()

  // First, build a map of all gear with their totals
  // projectGear.value is already filtered by ownership in loadProjectGear()
  projectGear.value.forEach(gear => {
    gearMap.set(gear.id, {
      gear_id: gear.id,
      gear_name: gear.gear_name,
      gear_type: gear.gear_type || 'N/A',
      total_brought: gear.gear_amount || 0
    })
  })

  // Group bag items by gear_id and bag_id to create separate line items per bag
  const bagItemsByGearAndBag = new Map()
  
  bagItems.value.forEach(item => {
    if (!item.gear_id || !item.bag_id) return
    
    const gearItem = gearMap.get(item.gear_id)
    if (!gearItem) return

    const quantity = item.quantity || 0
    const key = `${item.gear_id}-${item.bag_id}`
    
    // Find bag name
    const bag = bags.value.find(b => b.id === item.bag_id)
    const bagName = bag ? bag.name : 'Unknown'

    if (bagItemsByGearAndBag.has(key)) {
      // Update existing entry
      const existing = bagItemsByGearAndBag.get(key)
      existing.in_bags += quantity
      existing.bag_distribution[0].quantity += quantity
    } else {
      // Create new entry for this gear-bag combination
      bagItemsByGearAndBag.set(key, {
        gear_id: item.gear_id,
        gear_name: gearItem.gear_name,
        gear_type: gearItem.gear_type,
        total_brought: gearItem.total_brought,
        in_bags: quantity,
        bag_id: item.bag_id,
        bag_name: bagName,
        bag_distribution: [{
          bag_id: item.bag_id,
          bag_name: bagName,
          quantity: quantity
        }]
      })
    }
  })

  // Calculate unpacked amounts and create entries for unpacked gear
  const processedGearIds = new Set(Array.from(bagItemsByGearAndBag.values()).map(item => item.gear_id))
  
  // Add unpacked gear items (gear that hasn't been added to any bag)
  gearMap.forEach((gearItem, gearId) => {
    const totalInBags = Array.from(bagItemsByGearAndBag.values())
      .filter(item => item.gear_id === gearId)
      .reduce((sum, item) => sum + item.in_bags, 0)
    
    const unpacked = gearItem.total_brought - totalInBags
    
    if (unpacked > 0) {
      // Create an entry for unpacked gear
      const unpackedKey = `${gearId}-unpacked`
      bagItemsByGearAndBag.set(unpackedKey, {
        gear_id: gearId,
        gear_name: gearItem.gear_name,
        gear_type: gearItem.gear_type,
        total_brought: gearItem.total_brought,
        in_bags: 0,
        unpacked: unpacked,
        bag_id: null,
        bag_name: 'Unpacked',
        bag_distribution: []
      })
    }
  })

  // Calculate unpacked for items in bags
  bagItemsByGearAndBag.forEach(item => {
    const totalInAllBags = Array.from(bagItemsByGearAndBag.values())
      .filter(i => i.gear_id === item.gear_id)
      .reduce((sum, i) => sum + i.in_bags, 0)
    item.unpacked = item.total_brought - totalInAllBags
  })

  // Convert to array and sort
  return Array.from(bagItemsByGearAndBag.values())
    .filter(item => item.total_brought > 0)
    .sort((a, b) => {
      // Sort by gear name first, then by bag name
      const gearCompare = a.gear_name.localeCompare(b.gear_name)
      if (gearCompare !== 0) return gearCompare
      return (a.bag_name || '').localeCompare(b.bag_name || '')
    })
})

const totalItems = computed(() => repackingList.value.length)
const checkedCount = computed(() => checkedItems.value.size)
const allChecked = computed(() => {
  return totalItems.value > 0 && checkedItems.value.size === totalItems.value
})

function isAllGearChecked(gearId) {
  // Check if all instances of this gear across all bags are checked
  const allInstances = repackingList.value.filter(i => i.gear_id === gearId)
  if (allInstances.length === 0) return false
  
  return allInstances.every(instance => {
    const key = instance.bag_id ? `${instance.gear_id}-${instance.bag_id}` : `${instance.gear_id}-unpacked`
    return checkedItems.value.has(key)
  })
}

function getStatusClass(item) {
  // If all instances of this gear are checked, show checked status (handled in template)
  if (isAllGearChecked(item.gear_id)) {
    return 'status-checked'
  }
  if (item.unpacked > 0) {
    return 'status-warning' // Some items not in bags
  }
  if (item.in_bags === item.total_brought) {
    return 'status-success' // All items in bags
  }
  return 'status-info'
}

function getStatusText(item) {
  if (item.unpacked > 0) {
    return `${item.unpacked} unpacked`
  }
  if (item.in_bags === item.total_brought) {
    return 'All packed'
  }
  return 'Partial'
}

function isChecked(gearId) {
  return checkedItems.value.has(gearId)
}

function isCheckedForItem(item) {
  const key = item.bag_id ? `${item.gear_id}-${item.bag_id}` : `${item.gear_id}-unpacked`
  return checkedItems.value.has(key)
}

function toggleCheck(item) {
  // Use a composite key of gear_id and bag_id (or 'unpacked') for unique identification
  const key = item.bag_id ? `${item.gear_id}-${item.bag_id}` : `${item.gear_id}-unpacked`
  if (checkedItems.value.has(key)) {
    checkedItems.value.delete(key)
  } else {
    checkedItems.value.add(key)
  }
  saveCheckedItems()
}

function toggleAllChecks(event) {
  if (event.target.checked) {
    repackingList.value.forEach(item => {
      const key = item.bag_id ? `${item.gear_id}-${item.bag_id}` : `${item.gear_id}-unpacked`
      checkedItems.value.add(key)
    })
  } else {
    checkedItems.value.clear()
  }
  saveCheckedItems()
}

function checkAll() {
  repackingList.value.forEach(item => {
    const key = item.bag_id ? `${item.gear_id}-${item.bag_id}` : `${item.gear_id}-unpacked`
    checkedItems.value.add(key)
  })
  saveCheckedItems()
  toast.success('All items checked')
}

function clearAllChecks() {
  if (confirm('Clear all check marks?')) {
    checkedItems.value.clear()
    saveCheckedItems()
    toast.success('All checks cleared')
  }
}

function saveCheckedItems() {
  const storageKey = `repacking_checked_${effectiveProjectId.value}_${userId.value}`
  const checkedArray = Array.from(checkedItems.value)
  localStorage.setItem(storageKey, JSON.stringify(checkedArray))
}

function loadCheckedItems() {
  const storageKey = `repacking_checked_${effectiveProjectId.value}_${userId.value}`
  const saved = localStorage.getItem(storageKey)
  if (saved) {
    try {
      const checkedArray = JSON.parse(saved)
      checkedItems.value = new Set(checkedArray)
    } catch (err) {
      console.error('Failed to load checked items:', err)
    }
  }
}

async function loadBags() {
  if (!userId.value) return
  try {
    bags.value = await PackingService.getUserBags(userId.value)
    if (bags.value.length > 0) {
      const allBagIds = bags.value.map(b => b.id)
      const allItems = await Promise.all(
        allBagIds.map(bagId => PackingService.getBagItems(bagId))
      )
      bagItems.value = allItems.flat()
    }
  } catch (err) {
    console.error('Failed to load bags:', err)
    toast.error(err.message || 'Failed to load bags')
  }
}

async function loadProjectGear() {
  const projectId = effectiveProjectId.value
  if (!projectId || projectId.trim() === '' || !userId.value) {
    projectGear.value = []
    return
  }

  try {
    // Load all project gear
    const allProjectGear = await fetchTableData('gear_table', {
      eq: { project_id: projectId },
      order: [{ column: 'gear_name', ascending: true }]
    })

    // Filter to only user gear
    const userGearItems = allProjectGear.filter(g => {
      const isUserGear = g.is_user_gear === true || g.is_user_gear === 1 || g.is_user_gear === 'true'
      return isUserGear && !!g.user_gear_id && (g.gear_amount || 0) > 0
    })

    if (userGearItems.length > 0) {
      // Verify ownership via user_gear table
      const userGearIds = userGearItems.map(g => g.user_gear_id).filter(Boolean)
      const { data: userGearData, error } = await supabase
        .from('user_gear')
        .select('id, user_id')
        .in('id', userGearIds)

      if (!error && userGearData) {
        const ownershipMap = {}
        userGearData.forEach(ug => {
          ownershipMap[ug.id] = ug.user_id
        })

        const currentUserIdStr = String(userId.value)
        const ownedGear = userGearItems.filter(g => {
          const gearUserId = ownershipMap[g.user_gear_id]
          return gearUserId ? String(gearUserId) === currentUserIdStr : false
        })

        projectGear.value = ownedGear
      } else {
        projectGear.value = []
      }
    } else {
      projectGear.value = []
    }
  } catch (err) {
    console.error('Failed to load project gear:', err)
    projectGear.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    await Promise.all([
      loadBags(),
      loadProjectGear()
    ])
    loadCheckedItems()
  } finally {
    loading.value = false
  }
}

watch(() => effectiveProjectId.value, async (newProjectId) => {
  if (newProjectId && newProjectId.trim() !== '') {
    await loadData()
  }
}, { immediate: true })

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.repacking-tab {
  padding: 16px;
}

.repacking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
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
  padding: 48px 24px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.repacking-table-container {
  overflow-x: auto;
  margin-bottom: 24px;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.repacking-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

.repacking-table thead {
  background: var(--bg-secondary);
  border-bottom: 2px solid #dee2e6;
}

.repacking-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.repacking-table tbody tr {
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.2s;
}

.repacking-table tbody tr:hover {
  background: var(--bg-secondary);
}

.repacking-table tbody tr.checked {
  background: rgba(34, 197, 94, 0.15);
}

.repacking-table tbody tr.checked:hover {
  background: rgba(34, 197, 94, 0.2);
}

.repacking-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-primary);
  vertical-align: middle;
}

.check-column {
  width: 50px;
  text-align: center;
}

.check-column input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.gear-name {
  font-weight: 600;
  color: var(--text-primary);
}

.gear-type {
  color: var(--text-secondary);
  font-size: 13px;
}

.total-brought,
.in-bags,
.unpacked {
  text-align: center;
  font-weight: 600;
}

.unpacked {
  color: var(--color-warning-500);
}

.bags-list {
  max-width: 300px;
}

.bag-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bag-tag {
  display: inline-block;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.no-bags {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 13px;
}

.status {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-success {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-700);
}

.status-warning {
  background: rgba(251, 191, 36, 0.15);
  color: var(--color-warning-700);
}

.status-info {
  background: rgba(59, 130, 246, 0.15);
  color: var(--color-primary-700);
}

.status-checked {
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success-700);
  font-weight: 600;
}

.summary-section {
  margin-top: 24px;
}

.summary-card {
  background: var(--bg-secondary);
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
}

.summary-card h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.checked {
  color: #047857;
}

.stat-value.remaining {
  color: #dc2626;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #047857;
  transition: width 0.3s ease;
}

/* Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.btn-positive {
  background-color: #047857;
  color: #ffffff !important;
  border-color: #065f46;
}

.btn-positive:hover {
  background-color: #065f46;
  border-color: #047857;
}

.btn-positive .btn-text,
.btn-positive .btn-icon {
  color: #ffffff !important;
}

.btn-info {
  background-color: #1e40af;
  color: #ffffff !important;
  border-color: #1e3a8a;
}

.btn-info:hover {
  background-color: #1e3a8a;
  border-color: #1e40af;
}

.btn-info .btn-text,
.btn-info .btn-icon {
  color: #ffffff !important;
}

@media (max-width: 768px) {
  .repacking-table {
    font-size: 12px;
  }
  
  .repacking-table th,
  .repacking-table td {
    padding: 8px 12px;
  }
  
  .summary-stats {
    flex-direction: column;
    gap: 16px;
  }
}
</style>

