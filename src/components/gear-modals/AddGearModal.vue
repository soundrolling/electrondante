<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">Add New Gear</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="form-grid">
          <div class="form-group">
            <label for="gearName" class="form-label">Gear Name<span class="required">*</span></label>
            <input 
              id="gearName"
              v-model="form.gearName" 
              required 
              placeholder="Enter Gear Name" 
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="gearType" class="form-label">Type<span class="required">*</span></label>
            <select id="gearType" v-model="form.gearType" required class="form-select">
              <option disabled value="">Select type</option>
              <option value="source">Source (Microphones)</option>
              <option value="transformer">Transformer</option>
              <option value="recorder">Recorder</option>
              <option value="accessories_cables">Accessories + Cables</option>
            </select>
          </div>
          <div class="form-group">
            <label for="gearAmount" class="form-label">Amount<span class="required">*</span></label>
            <input 
              id="gearAmount"
              v-model.number="form.gearAmount" 
              type="number" 
              min="1" 
              required 
              placeholder="1" 
              class="form-input"
            />
          </div>
          <!-- Optional IO fields (hidden for sources and accessories_cables) -->
          <div v-if="form.gearType !== 'source' && form.gearType !== 'accessories_cables'" class="form-group">
            <label for="gearNumInputs" class="form-label">Inputs</label>
            <input 
              id="gearNumInputs"
              v-model.number="form.gearNumInputs" 
              type="number" 
              min="0" 
              class="form-input"
            />
          </div>
          <div v-if="form.gearType !== 'source' && form.gearType !== 'accessories_cables'" class="form-group">
            <label for="gearNumOutputs" class="form-label">Outputs</label>
            <input 
              id="gearNumOutputs"
              v-model.number="form.gearNumOutputs" 
              type="number" 
              min="0" 
              class="form-input"
            />
          </div>
          <!-- Tracks for recorders -->
          <div v-if="form.gearType === 'recorder'" class="form-group">
            <label for="gearNumRecords" class="form-label">Tracks</label>
            <input 
              id="gearNumRecords"
              v-model.number="form.gearNumRecords" 
              type="number" 
              min="1" 
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="gearVendor" class="form-label">Vendor</label>
            <input 
              id="gearVendor"
              v-model="form.vendor" 
              placeholder="Vendor name (optional)" 
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="gearIsRented" class="form-label">Rented?</label>
            <input 
              id="gearIsRented"
              v-model="form.isRented" 
              type="checkbox"
              style="width:auto; min-height:unset;"
            />
          </div>
          <!-- Default color for source gear -->
          <div v-if="form.gearType === 'source'" class="form-group">
            <label for="gearDefaultColor" class="form-label">Default Color</label>
            <select 
              id="gearDefaultColor"
              v-model="form.gearDefaultColor" 
              class="form-input"
            >
              <option v-for="color in gearColorOptions" :key="color.value" :value="color.value">
                {{ color.label }}
              </option>
            </select>
            <small style="color: var(--text-secondary); font-size: 12px; margin-top: 4px; display: block;">
              This color will be used when placing this microphone in mic placement view
            </small>
          </div>
          <!-- Multi-stage assignment section -->
          <div class="form-group" style="grid-column: 1 / -1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <label class="form-label" style="margin: 0;">Assign to Stages (Optional)</label>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                @click="addNewAssignment"
                :disabled="remainingAvailable <= 0 || !hasUnassignedStages"
                style="padding: 6px 12px; font-size: 14px; min-height: 32px;"
              >
                <span class="btn-icon">➕</span>
                <span class="btn-text">Add Stage</span>
              </button>
            </div>
            
            <div v-if="assignments.length > 0" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;">
              <div 
                v-for="(assignment, index) in assignments" 
                :key="assignment.key"
                style="display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: start; padding: 12px; background: var(--bg-secondary); border: 1px solid #e9ecef; border-radius: 8px;"
              >
                <div>
                  <select 
                    v-model="assignment.locationId" 
                    class="form-select"
                    @change="onStageChange(assignment)"
                    style="width: 100%;"
                  >
                    <option :value="null">Select stage</option>
                    <option
                      v-for="location in availableLocations(assignment.locationId)"
                      :key="location.id"
                      :value="location.id"
                    >
                      {{ location.stage_name }} ({{ location.venue_name }})
                    </option>
                  </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; min-width: 100px;">
                  <input 
                    v-model.number="assignment.amount" 
                    type="number" 
                    min="0"
                    :max="getMaxForAssignment(assignment)"
                    class="form-input"
                    @input="validateAmount(assignment)"
                    style="text-align: center;"
                  />
                  <small style="color: var(--text-secondary); font-size: 11px; text-align: center;">
                    Max: {{ getMaxForAssignment(assignment) }}
                  </small>
                </div>
                <div style="display: flex; align-items: center;">
                  <button 
                    type="button"
                    class="btn btn-danger btn-sm btn-icon-only"
                    @click="removeAssignment(index)"
                    title="Remove assignment"
                    style="padding: 8px; min-width: 44px; min-height: 44px;"
                  >
                    <span class="btn-icon">🗑️</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div v-if="assignments.length === 0" style="text-align: center; padding: 16px; color: var(--text-secondary); font-size: 14px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid #e9ecef;">
              No assignments yet. Click "Add Stage" to assign gear to a stage.
            </div>
            
            <div v-if="assignments.length > 0" style="margin-top: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid #e9ecef;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                <span style="color: var(--text-secondary); font-size: 14px;">
                  Total: {{ form.gearAmount }}
                </span>
                <span 
                  style="font-size: 14px; font-weight: 500;"
                  :style="{ color: remainingAvailable < 0 ? '#dc2626' : '#047857' }"
                >
                  Available: {{ remainingAvailable }}
                </span>
                <span style="color: var(--text-secondary); font-size: 14px;">
                  Assigned: {{ totalAssigned }}
                </span>
              </div>
              <div v-if="remainingAvailable < 0" style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px; color: #dc2626; font-size: 12px; font-weight: 500;">
                ⚠️ Total assigned ({{ totalAssigned }}) exceeds total gear ({{ form.gearAmount }})
              </div>
            </div>
          </div>
        </div>
        <div v-if="error" class="form-error">{{ error }}</div>
        <div class="form-actions">
          <button type="submit" class="btn btn-positive" :disabled="loading">Add Gear</button>
          <button type="button" @click="$emit('close')" class="btn btn-warning">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  locationsList: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'submit'])

const gearColorOptions = [
  { value: '#1890ff', label: 'Blue' },
  { value: '#dc2626', label: 'Red' },
  { value: '#047857', label: 'Green' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#6366f1', label: 'Indigo' }
]

const form = ref({
  gearName: '',
  gearType: 'transformer',
  gearNumInputs: 1,
  gearNumOutputs: 1,
  gearNumRecords: 1,
  gearAmount: 1,
  isRented: false,
  vendor: '',
  gearDefaultColor: '#1890ff'
})

const assignments = ref([])
let assignmentKeyCounter = 0
const error = ref(null)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm()
  }
})

watch(() => form.value.gearType, (newType) => {
  if (newType === 'source') {
    form.value.gearNumInputs = 0
    form.value.gearNumOutputs = 1
  } else if (newType === 'accessories_cables') {
    form.value.gearNumInputs = null
    form.value.gearNumOutputs = null
    form.value.gearNumRecords = null
  }
})

const totalAssigned = computed(() => {
  return assignments.value.reduce((sum, a) => {
    if (!a.locationId || a.amount <= 0) return sum
    return sum + (Number(a.amount) || 0)
  }, 0)
})

const remainingAvailable = computed(() => {
  return form.value.gearAmount - totalAssigned.value
})

const hasUnassignedStages = computed(() => {
  const assignedLocationIds = new Set(
    assignments.value
      .filter(a => a.locationId)
      .map(a => a.locationId)
  )
  return props.locationsList.some(loc => !assignedLocationIds.has(loc.id))
})

function resetForm() {
  form.value = {
    gearName: '',
    gearType: 'transformer',
    gearNumInputs: 1,
    gearNumOutputs: 1,
    gearNumRecords: 1,
    gearAmount: 1,
    isRented: false,
    vendor: '',
    gearDefaultColor: '#1890ff'
  }
  assignments.value = []
  assignmentKeyCounter = 0
  error.value = null
}

function addNewAssignment() {
  assignments.value.push({
    key: `new-${assignmentKeyCounter++}`,
    locationId: null,
    amount: 0,
    isNew: true
  })
}

function removeAssignment(index) {
  assignments.value.splice(index, 1)
}

function availableLocations(currentLocationId) {
  const assignedIds = new Set(
    assignments.value
      .filter(a => a.locationId && a.locationId !== currentLocationId)
      .map(a => a.locationId)
  )
  return props.locationsList.filter(loc => !assignedIds.has(loc.id))
}

function getMaxForAssignment(assignment) {
  if (!assignment.locationId) {
    return form.value.gearAmount || 0
  }
  
  const assignedToOthers = assignments.value.reduce((sum, a) => {
    if (a.key === assignment.key || !a.locationId || a.amount <= 0) return sum
    return sum + (Number(a.amount) || 0)
  }, 0)
  
  return Math.max(0, form.value.gearAmount - assignedToOthers)
}

function validateAmount(assignment) {
  const max = getMaxForAssignment(assignment)
  if (assignment.amount > max) {
    assignment.amount = max
  }
  if (assignment.amount < 0) {
    assignment.amount = 0
  }
}

function onStageChange(assignment) {
  if (assignment.locationId) {
    const max = getMaxForAssignment(assignment)
    assignment.amount = Math.min(1, max)
  } else {
    assignment.amount = 0
  }
}

function handleSubmit() {
  error.value = null
  if (!form.value.gearName || form.value.gearAmount < 1) {
    error.value = 'Please fill required fields.'
    return
  }
  
  if (totalAssigned.value > form.value.gearAmount) {
    error.value = `Total assigned (${totalAssigned.value}) cannot exceed total gear amount (${form.value.gearAmount}).`
    return
  }
  
  const validAssignments = assignments.value.filter(a => 
    a.locationId && a.amount > 0
  )
  
  emit('submit', {
    ...form.value,
    assignments: validAssignments
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal {
  width: 100%;
  max-width: 700px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-form {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-heading);
}

.required {
  color: var(--color-error-500);
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary-500);
}

.form-error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
  margin-bottom: 16px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
</style>

