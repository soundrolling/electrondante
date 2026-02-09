<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ editingHour ? 'Edit Stage Hours' : 'Add Stage Hours' }}</h2>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="handleSave">
          <div class="form-field">
            <label>Stage</label>
            <select v-model="formData.stage_id" required :disabled="!!editingHour">
              <option :value="null">Select a stage</option>
              <option v-for="stage in stages" :key="stage.id" :value="stage.id">
                {{ stage.venue_name }} - {{ stage.stage_name }}
              </option>
            </select>
          </div>
          
          <div class="form-field">
            <label>Start Date & Time</label>
            <input 
              v-model="formData.start_date" 
              type="date" 
              required
              @change="updateStartDateTime"
            />
            <input 
              v-model="formData.start_time" 
              type="time" 
              required
              @change="updateStartDateTime"
              style="margin-top: 0.5rem;"
            />
          </div>
          
          <div class="form-field">
            <label>End Date & Time</label>
            <input 
              v-model="formData.end_date" 
              type="date" 
              required
              @change="updateEndDateTime"
            />
            <input 
              v-model="formData.end_time" 
              type="time" 
              required
              @change="updateEndDateTime"
              style="margin-top: 0.5rem;"
            />
          </div>
          
          <div class="form-field">
            <label>Notes (e.g., "Day 1", "Day 2")</label>
            <input 
              v-model="formData.notes" 
              type="text" 
              placeholder="Optional: Day identifier"
            />
          </div>
          
          <div v-if="error" class="error-message">{{ error }}</div>
          
          <div class="modal-actions">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-secondary" @click="$emit('close')">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StageHoursModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    stages: {
      type: Array,
      required: true
    },
    editingHour: {
      type: Object,
      default: null
    },
    selectedStage: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'save'],
  data() {
    return {
      formData: {
        stage_id: null,
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        notes: ''
      },
      error: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.resetForm();
        if (this.editingHour) {
          // Parse datetime strings directly to avoid timezone conversion issues
          // Datetime strings from DB are like "2024-02-15T09:00:00"
          this.formData = {
            stage_id: this.editingHour.stage_id,
            start_date: this.extractDate(this.editingHour.start_datetime),
            start_time: this.extractTime(this.editingHour.start_datetime),
            end_date: this.extractDate(this.editingHour.end_datetime),
            end_time: this.extractTime(this.editingHour.end_datetime),
            notes: this.editingHour.notes || ''
          };
        } else if (this.selectedStage) {
          // Pre-select the stage if provided
          this.formData.stage_id = this.selectedStage.id;
        }
      }
    },
    editingHour: {
      handler(newVal) {
        if (newVal && this.show) {
          this.formData = {
            stage_id: newVal.stage_id,
            start_date: this.extractDate(newVal.start_datetime),
            start_time: this.extractTime(newVal.start_datetime),
            end_date: this.extractDate(newVal.end_datetime),
            end_time: this.extractTime(newVal.end_datetime),
            notes: newVal.notes || ''
          };
        }
      },
      immediate: true
    }
  },
  methods: {
    // Extract date (YYYY-MM-DD) from ISO/datetime string without timezone conversion
    extractDate(datetimeStr) {
      if (!datetimeStr) return '';
      // Handle "YYYY-MM-DDTHH:mm:ss" format directly
      return datetimeStr.slice(0, 10);
    },
    // Extract time (HH:mm) from ISO/datetime string without timezone conversion
    extractTime(datetimeStr) {
      if (!datetimeStr) return '';
      // Handle "YYYY-MM-DDTHH:mm:ss" format directly
      const timePart = datetimeStr.slice(11, 16);
      return timePart || '';
    },
    resetForm() {
      this.formData = {
        stage_id: this.selectedStage?.id || null,
        start_date: '',
        start_time: '',
        end_date: '',
        end_time: '',
        notes: ''
      };
      this.error = '';
    },
    updateStartDateTime() {
      // Auto-set end date/time if not set
      if (!this.formData.end_date) {
        this.formData.end_date = this.formData.start_date;
      }
      if (!this.formData.end_time) {
        // Default to 1 hour after start
        const [hours, minutes] = this.formData.start_time.split(':').map(Number);
        const endHours = (hours + 1) % 24;
        this.formData.end_time = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    },
    updateEndDateTime() {
      // Validate that end is after start
      const start = new Date(`${this.formData.start_date}T${this.formData.start_time}`);
      const end = new Date(`${this.formData.end_date}T${this.formData.end_time}`);
      
      if (end <= start) {
        this.error = 'End date/time must be after start date/time';
      } else {
        this.error = '';
      }
    },
    handleSave() {
      // Validate form
      if (!this.formData.stage_id) {
        this.error = 'Please select a stage';
        return;
      }
      
      if (!this.formData.start_date || !this.formData.start_time) {
        this.error = 'Please enter start date and time';
        return;
      }
      
      if (!this.formData.end_date || !this.formData.end_time) {
        this.error = 'Please enter end date and time';
        return;
      }
      
      // Validate end is after start
      const start = new Date(`${this.formData.start_date}T${this.formData.start_time}`);
      const end = new Date(`${this.formData.end_date}T${this.formData.end_time}`);
      
      if (end <= start) {
        this.error = 'End date/time must be after start date/time';
        return;
      }
      
      // Create ISO datetime strings
      const startDatetime = `${this.formData.start_date}T${this.formData.start_time}:00`;
      const endDatetime = `${this.formData.end_date}T${this.formData.end_time}:00`;
      
      const payload = {
        stage_id: this.formData.stage_id,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        notes: this.formData.notes || null
      };
      
      if (this.editingHour) {
        payload.id = this.editingHour.id;
      }
      
      this.$emit('save', payload);
      this.resetForm();
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-heading);
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
}

.form-field label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.form-field input,
.form-field select {
  padding: 0.5rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-field input:disabled,
.form-field select:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  color: var(--color-error-500);
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  border: 1px solid var(--color-error-500);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-positive {
  background: var(--color-success-500);
  color: var(--text-inverse);
}

.btn-positive:hover {
  background: var(--color-success-600);
}

.btn-warning {
  background: var(--color-secondary-400);
  color: var(--text-inverse);
}

.btn-warning:hover {
  background: var(--color-secondary-500);
}
</style>

