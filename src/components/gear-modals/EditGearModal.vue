<template>
  <div v-if="visible && gear" class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">Edit Gear</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="handleSubmit" class="edit-form-content">
          <div class="form-grid">
            <div class="form-group">
              <label for="editGearName" class="form-label">Gear Name<span class="required">*</span></label>
              <input 
                id="editGearName"
                v-model="form.gearName" 
                required 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="editGearType" class="form-label">Type<span class="required">*</span></label>
              <select id="editGearType" v-model="form.gearType" required class="form-select">
                <option value="source">Source (Microphones)</option>
                <option value="transformer">Transformer</option>
                <option value="recorder">Recorder</option>
                <option value="accessories_cables">Accessories + Cables</option>
              </select>
            </div>
            <div class="form-group">
              <label for="editGearAmount" class="form-label">Amount<span class="required">*</span></label>
              <input 
                id="editGearAmount"
                v-model.number="form.gearAmount" 
                type="number" 
                min="1" 
                required 
                class="form-input"
              />
            </div>
            <!-- Inputs/Outputs (hidden for sources) -->
            <div v-if="form.gearType !== 'source'" class="form-group">
              <label for="editNumInputs" class="form-label">Inputs</label>
              <input 
                id="editNumInputs"
                v-model.number="form.numInputs"
                type="number"
                min="0"
                class="form-input"
              />
            </div>
            <div v-if="form.gearType !== 'source'" class="form-group">
              <label for="editNumOutputs" class="form-label">Outputs</label>
              <input 
                id="editNumOutputs"
                v-model.number="form.numOutputs"
                type="number"
                min="0"
                class="form-input"
              />
            </div>
            <!-- Tracks (for recorders) -->
            <div v-if="form.gearType === 'recorder'" class="form-group">
              <label for="editNumRecords" class="form-label">Tracks</label>
              <input 
                id="editNumRecords"
                v-model.number="form.numRecords"
                type="number"
                min="1"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="editGearVendor" class="form-label">Vendor</label>
              <input 
                id="editGearVendor"
                v-model="form.vendor" 
                class="form-input"
              />
            </div>
            <!-- Default color for source gear -->
            <div v-if="form.gearType === 'source'" class="form-group">
              <label for="editGearDefaultColor" class="form-label">Default Color</label>
              <select 
                id="editGearDefaultColor"
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
            <div class="form-group">
              <label for="editIsRented" class="form-label">Rented?</label>
              <input 
                id="editIsRented"
                v-model="form.isRented" 
                type="checkbox"
                style="width:auto; min-height:unset;"
              />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-positive" :disabled="loading">Save Changes</button>
            <button type="button" @click="$emit('close')" class="btn btn-warning">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  gear: {
    type: Object,
    default: null
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

const normalizeGearColor = (color) => {
  if (!color) return '#1890ff'
  const validColor = gearColorOptions.find(opt => opt.value === color)
  return validColor ? validColor.value : '#1890ff'
}

const form = ref({
  gearName: '',
  gearType: 'transformer',
  numInputs: 1,
  numOutputs: 1,
  numRecords: 1,
  gearAmount: 1,
  isRented: false,
  vendor: '',
  gearDefaultColor: '#1890ff'
})

watch(() => props.visible, (newVal) => {
  if (newVal && props.gear) {
    form.value = {
      gearName: props.gear.gear_name || '',
      gearType: props.gear.gear_type || 'transformer',
      numInputs: props.gear.num_inputs ?? 1,
      numOutputs: props.gear.num_outputs ?? 1,
      numRecords: props.gear.num_records || 1,
      gearAmount: props.gear.gear_amount || 1,
      isRented: props.gear.is_rented || false,
      vendor: props.gear.vendor || '',
      gearDefaultColor: normalizeGearColor(props.gear.default_color)
    }
  }
})

watch(() => form.value.gearType, (newType) => {
  if (newType === 'source') {
    form.value.numInputs = 0
    form.value.numOutputs = 1
  } else if (newType === 'accessories_cables') {
    form.value.numInputs = null
    form.value.numOutputs = null
    form.value.numRecords = null
  }
})

function handleSubmit() {
  emit('submit', {
    id: props.gear.id,
    ...form.value
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

.edit-form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
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

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
</style>

