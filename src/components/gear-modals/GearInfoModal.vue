<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">Gear Information</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="gearInfo && Object.keys(gearInfo).length" class="gear-info">
          <div class="info-section">
            <h4 class="info-title">Basic Details</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">{{ gearInfo.gear_name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Type:</span>
                <span class="info-value">{{ gearInfo.gear_type || 'No type' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Amount:</span>
                <span class="info-value">{{ gearInfo.gear_amount }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Available:</span>
                <span class="info-value">{{ gearInfo.unassigned_amount }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Assigned:</span>
                <span class="info-value">{{ gearInfo.total_assigned }}</span>
              </div>
              <div v-if="gearInfo.vendor" class="info-item">
                <span class="info-label">Vendor:</span>
                <span class="info-value">{{ gearInfo.vendor }}</span>
              </div>
            </div>
          </div>

          <div v-if="assignmentsList.length" class="info-section">
            <h4 class="info-title">Current Assignments</h4>
            <div class="assignments-list">
              <div 
                v-for="assignment in assignmentsList" 
                :key="assignment.location_id"
                class="assignment-item"
              >
                <div class="assignment-header">
                  <span class="assignment-stage">{{ assignment.stage_name }}</span>
                  <span class="assignment-amount">{{ assignment.amount }}</span>
                </div>
                <div class="assignment-details">
                  <span class="assignment-venue">{{ assignment.venue_name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  gearInfo: {
    type: Object,
    default: () => ({})
  },
  assignmentsList: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close'])
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
  max-width: 600px;
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

.gear-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-heading);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.assignments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assignment-item {
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.assignment-stage {
  font-weight: 600;
  color: var(--text-primary);
}

.assignment-amount {
  font-weight: 600;
  color: var(--color-primary-500);
}

.assignment-details {
  font-size: 12px;
  color: var(--text-secondary);
}

.assignment-venue {
  color: var(--text-secondary);
}
</style>

