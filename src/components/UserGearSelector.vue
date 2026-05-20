<template>
  <div class="user-gear-selector">
    <header class="selector-header">
      <h3 class="selector-title">Add Team Gear</h3>
      <p class="selector-subtitle">
        Pick gear from project members' personal inventories. Items in use on other projects with
        overlapping dates are flagged so nothing gets double-booked.
      </p>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading gear from project members…</p>
    </div>

    <UserGearLibrary
      v-else
      ref="libraryRef"
      mode="select"
      :team-user-ids="teamUserIds"
      :project-id="String(props.projectId || '')"
      :show-stats="false"
      :show-owner-filter="true"
      @selection-change="onSelectionChange"
    />

    <div v-if="selectedItems.length" class="selection-bar">
      <div class="selection-top">
        <strong>{{ selectedItems.length }} selected</strong>
        <button class="link-btn" @click="clearSelection">Clear</button>
      </div>

      <div class="qty-rows">
        <div
          v-for="item in selectedItems"
          :key="item.gear.id"
          class="qty-row"
        >
          <span class="qty-row-name">{{ item.gear.gear_name }}</span>
          <label class="qty-row-input">
            <span class="qty-row-label">Qty</span>
            <input
              type="number"
              :value="item.quantity"
              :min="1"
              :max="item.gear.quantity || 1"
              @input="onQuantityChange(item.gear.id, $event.target.value)"
            />
            <span class="qty-row-of">of {{ item.gear.quantity || 1 }}</span>
          </label>
        </div>
      </div>

      <div v-if="locationsList?.length" class="stage-assignment">
        <label class="stage-lbl">Optional — assign all selected items to this stage:</label>
        <select v-model="selectedStageId" class="stage-pick">
          <option value="">No stage assignment</option>
          <option
            v-for="loc in locationsList"
            :key="loc.id"
            :value="String(loc.id)"
          >
            {{ loc.stage_name }} ({{ loc.venue_name }})
          </option>
        </select>
      </div>

      <div v-if="selectedStageId" class="assigned-rows">
        <div
          v-for="item in selectedItems"
          :key="item.gear.id"
          class="assigned-row"
        >
          <span class="assigned-name">{{ item.gear.gear_name }}</span>
          <span class="assigned-meta">Qty {{ item.quantity }}</span>
          <label class="assigned-amount">
            <span>Assign to stage</span>
            <input
              type="number"
              :value="stageAmounts[item.gear.id] ?? 0"
              :min="0"
              :max="item.quantity"
              @input="onStageAmountChange(item.gear.id, $event.target.value, item.quantity)"
            />
          </label>
        </div>
      </div>

      <div class="selection-actions">
        <button class="btn btn-positive" :disabled="adding" @click="addSelectedToProject">
          {{ adding ? 'Adding…' : 'Add gear to project' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import { useUserStore } from '../stores/userStore'
import { useToast } from 'vue-toastification'
import UserGearLibrary from './UserGearLibrary.vue'

const props = defineProps({
  projectId: { type: String, default: '' },
  locationsList: { type: Array, default: () => [] }
})

const emit = defineEmits(['gear-selected', 'gear-added'])

const userStore = useUserStore()
const toast = useToast()

const loading = ref(false)
const teamUserIds = ref([])
const libraryRef = ref(null)

// Current selection { gear, quantity }
const selectedItems = ref([])
const selectedStageId = ref('')
const stageAmounts = ref({})
const adding = ref(false)

async function loadTeamMembers() {
  loading.value = true
  try {
    const projectId = props.projectId || userStore.currentProject?.id
    if (!projectId) {
      teamUserIds.value = []
      return
    }
    const ids = new Set()
    if (userStore.user?.id) ids.add(userStore.user.id)

    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single()
    if (project?.user_id) ids.add(project.user_id)

    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
    for (const m of members || []) {
      if (m.user_id) ids.add(m.user_id)
    }
    teamUserIds.value = [...ids]
  } catch (err) {
    console.error('[UserGearSelector] Failed to load team members', err)
    teamUserIds.value = []
  } finally {
    loading.value = false
  }
}

function onSelectionChange(items) {
  selectedItems.value = items
  // Drop stale stage amounts when items are removed
  const ids = new Set(items.map(i => i.gear.id))
  Object.keys(stageAmounts.value).forEach(id => {
    if (!ids.has(id)) delete stageAmounts.value[id]
  })
  emit('gear-selected', items.map(({ gear, quantity }) => ({
    ...gear,
    selectedQuantity: quantity
  })))
}

function onStageAmountChange(id, value, maxQty) {
  const num = Math.max(0, Math.min(maxQty, Number(value) || 0))
  stageAmounts.value[id] = num
}

function onQuantityChange(id, value) {
  libraryRef.value?.setQuantity(id, value)
  const item = selectedItems.value.find(i => i.gear.id === id)
  const stageCap = item ? Math.min(stageAmounts.value[id] ?? 0, Number(value) || 0) : 0
  if (stageAmounts.value[id] != null) stageAmounts.value[id] = Math.max(0, stageCap)
}

function clearSelection() {
  selectedItems.value = []
  selectedStageId.value = ''
  stageAmounts.value = {}
  emit('gear-selected', [])
}

async function addSelectedToProject() {
  if (!selectedItems.value.length) return
  adding.value = true
  try {
    const payload = selectedItems.value.map(({ gear, quantity }) => ({
      userGear: gear,
      quantity,
      locationId: selectedStageId.value || null,
      assignedAmount: selectedStageId.value ? (stageAmounts.value[gear.id] || 0) : 0
    }))
    emit('gear-added', payload)
    clearSelection()
  } catch (err) {
    console.error('[UserGearSelector] Failed to add gear:', err)
    toast.error(err.message || 'Failed to add gear to project')
  } finally {
    adding.value = false
  }
}

onMounted(loadTeamMembers)
watch(() => props.projectId, loadTeamMembers)
</script>

<style scoped>
.user-gear-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--text-primary);
}

.selector-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.selector-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-heading);
}
.selector-subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.35;
}

.loading-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-secondary);
}
.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2.5px solid var(--border-medium);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 0.5rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.selection-bar {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 0.6rem;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  position: sticky;
  bottom: 0;
}
.selection-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  color: var(--text-primary);
}
.link-btn {
  background: none;
  border: none;
  color: var(--color-primary-600);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
}

.qty-rows { display: flex; flex-direction: column; gap: 0.35rem; }
.qty-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.45rem 0.6rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 0.4rem;
  font-size: 0.85rem;
}
.qty-row-name { font-weight: 600; color: var(--text-heading); }
.qty-row-input {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.qty-row-input input {
  width: 4rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.35rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: center;
}
.qty-row-label { text-transform: uppercase; font-size: 0.7rem; }
.qty-row-of { font-size: 0.72rem; }

.stage-assignment { display: flex; flex-direction: column; gap: 0.3rem; }
.stage-lbl { font-size: 0.8rem; color: var(--text-secondary); }
.stage-pick {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.45rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.88rem;
}

.assigned-rows { display: flex; flex-direction: column; gap: 0.35rem; }
.assigned-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.45rem 0.6rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 0.4rem;
  font-size: 0.85rem;
}
.assigned-name { font-weight: 600; color: var(--text-heading); }
.assigned-meta { color: var(--text-secondary); font-size: 0.78rem; }
.assigned-amount {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.assigned-amount input {
  width: 4rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.35rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  text-align: center;
}

.selection-actions {
  display: flex;
  justify-content: flex-end;
}
.btn.btn-positive {
  background: var(--color-primary-500);
  color: #fff;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 0.45rem;
  font-weight: 600;
  cursor: pointer;
}
.btn.btn-positive:hover:not(:disabled) { background: var(--color-primary-600); }
.btn.btn-positive:disabled { opacity: 0.6; cursor: progress; }
</style>
