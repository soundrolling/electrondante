<template>
  <div v-if="visible && gear" class="modal-overlay" @click="$emit('close')">
    <div class="modal assignment-modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">Assign & Unassign Gear</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="assignment-form">
          <div class="gear-summary">
            <h4 class="gear-summary-title">{{ gear.gear_name }}</h4>
            <div class="gear-summary-details">
              <span class="summary-item">Total: {{ gear.gear_amount }}</span>
              <span class="summary-item" :class="{ 'summary-warning': remainingAvailable < 0, 'summary-success': remainingAvailable >= 0 }">
                Available: {{ remainingAvailable }}
              </span>
              <span class="summary-item">Assigned: {{ totalAssigned }}</span>
            </div>
            <div v-if="remainingAvailable < 0" class="summary-error">
              ⚠️ Total assigned ({{ totalAssigned }}) exceeds total gear ({{ gear.gear_amount }})
            </div>
          </div>

          <div class="assignments-editor">
            <div class="assignments-header">
              <h4 class="assignments-title">Current Assignments</h4>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                @click="addNewAssignment"
                :disabled="remainingAvailable <= 0 || !hasUnassignedStages"
              >
                <span class="btn-icon">➕</span>
                <span class="btn-text">Add Stage</span>
              </button>
            </div>

            <div class="assignments-list-editor">
              <div 
                v-for="(assignment, index) in assignments" 
                :key="assignment.key"
                class="assignment-editor-item"
              >
                <div class="assignment-editor-stage">
                  <select 
                    v-model="assignment.locationId" 
                    class="form-select assignment-select"
                    @change="onStageChange(assignment, index)"
                  >
                    <option value="">Select stage</option>
                    <option
                      v-for="location in availableLocations(assignment.locationId)"
                      :key="location.id"
                      :value="location.id"
                    >
                      {{ location.stage_name }} ({{ location.venue_name }})
                    </option>
                  </select>
                </div>
                <div class="assignment-editor-amount">
                  <input 
                    v-model.number="assignment.amount" 
                    type="number" 
                    min="0"
                    :max="getMaxForAssignment(assignment)"
                    class="form-input assignment-input"
                    @input="validateAmount(assignment)"
                  />
                  <small class="assignment-hint">
                    Max: {{ getMaxForAssignment(assignment) }}
                  </small>
                </div>
                <div class="assignment-editor-actions">
                  <button 
                    type="button"
                    class="btn btn-danger btn-sm btn-icon-only"
                    @click="removeAssignment(index)"
                    title="Remove assignment"
                  >
                    <span class="btn-icon">🗑️</span>
                  </button>
                </div>
              </div>

              <div v-if="assignments.length === 0" class="empty-assignments">
                <p>No assignments yet. Click "Add Stage" to assign gear to a stage.</p>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-positive" 
              @click="handleSave"
              :disabled="remainingAvailable < 0 || loading"
            >
              <span class="btn-icon">💾</span>
              <span class="btn-text">Save All Changes</span>
            </button>
            <button type="button" @click="$emit('close')" class="btn btn-warning">
              <span class="btn-icon">✕</span>
              <span class="btn-text">Cancel</span>
            </button>
          </div>
        </div>
      </div>
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
  gear: {
    type: Object,
    default: null
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

const emit = defineEmits(['close', 'save'])

const assignments = ref([])
let assignmentKeyCounter = 0

watch(() => props.visible, (newVal) => {
  if (newVal && props.gear) {
    // Initialize editable assignments from current assignments
    assignments.value = []
    assignmentKeyCounter = 0
    
    // Add existing assignments
    if (props.gear.assignments) {
      Object.entries(props.gear.assignments).forEach(([locationId, amount]) => {
        if (amount > 0) {
          assignments.value.push({
            key: `existing-${assignmentKeyCounter++}`,
            locationId: Number(locationId),
            amount: amount,
            isNew: false
          })
        }
      })
    }
    
    // If no assignments exist, add one empty row
    if (assignments.value.length === 0) {
      addNewAssignment()
    }
  }
})

const totalAssigned = computed(() => {
  return assignments.value.reduce((sum, a) => {
    if (!a.locationId || a.amount <= 0) return sum
    return sum + (Number(a.amount) || 0)
  }, 0)
})

const remainingAvailable = computed(() => {
  if (!props.gear) return 0
  return props.gear.gear_amount - totalAssigned.value
})

const hasUnassignedStages = computed(() => {
  const assignedLocationIds = new Set(
    assignments.value
      .filter(a => a.locationId)
      .map(a => a.locationId)
  )
  return props.locationsList.some(loc => !assignedLocationIds.has(loc.id))
})

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
  // If no assignments left, add one empty row
  if (assignments.value.length === 0) {
    addNewAssignment()
  }
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
  if (!props.gear || !assignment.locationId) {
    return props.gear?.gear_amount || 0
  }
  
  // Calculate what's assigned to other locations
  const assignedToOthers = assignments.value.reduce((sum, a) => {
    if (a.key === assignment.key || !a.locationId || a.amount <= 0) return sum
    return sum + (Number(a.amount) || 0)
  }, 0)
  
  // Max is: total gear - assigned to others
  return Math.max(0, props.gear.gear_amount - assignedToOthers)
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

function onStageChange(assignment, index) {
  // When stage changes, reset amount to 0 or 1 if available
  if (assignment.locationId) {
    const max = getMaxForAssignment(assignment)
    assignment.amount = Math.min(1, max)
  } else {
    assignment.amount = 0
  }
}

function handleSave() {
  const validAssignments = assignments.value.filter(a => 
    a.locationId && a.amount > 0
  )
  
  emit('save', {
    gearId: props.gear.id,
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

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.assignment-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gear-summary {
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.gear-summary-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-heading);
}

.gear-summary-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.summary-item {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-item.summary-success {
  color: #047857;
  font-weight: 500;
}

.summary-item.summary-warning {
  color: #dc2626;
  font-weight: 500;
}

.summary-error {
  padding: 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 6px;
  color: #dc2626;
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

.assignments-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assignments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assignments-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-heading);
}

.assignments-list-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assignment-editor-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: start;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.assignment-editor-stage {
  flex: 1;
}

.assignment-select {
  width: 100%;
}

.assignment-editor-amount {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 100px;
}

.assignment-input {
  text-align: center;
}

.assignment-hint {
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
}

.assignment-editor-actions {
  display: flex;
  align-items: center;
}

.empty-assignments {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
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

