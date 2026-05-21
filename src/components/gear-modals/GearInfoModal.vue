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
            <h4 class="info-title">In this project</h4>
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

          <div v-if="loadingStatus" class="info-section info-loading">
            <span class="status-spinner"></span>
            Checking reservations on other projects…
          </div>

          <div v-if="otherProjectUsages.length" class="info-section">
            <h4 class="info-title">Reserved on other projects</h4>
            <p class="info-sub">
              This gear is the same physical item owned by
              <strong>{{ gearInfo.owner_name || 'a team member' }}</strong>.
              It's been added to the projects below.
            </p>
            <div class="assignments-list">
              <div
                v-for="usage in otherProjectUsages"
                :key="usage.project_id"
                class="assignment-item"
                :class="{ 'usage-conflict': usage.conflicts_with_current }"
              >
                <div class="assignment-header">
                  <span class="assignment-stage">
                    <span
                      v-if="usage.conflicts_with_current"
                      class="conflict-flag"
                      title="Overlaps with this project's dates"
                    >⚠️</span>
                    {{ usage.project_name }}
                  </span>
                  <span class="assignment-amount">{{ usage.assigned_amount || 0 }}</span>
                </div>
                <div class="assignment-details">
                  <span v-if="usage.first_date">
                    {{ formatDate(usage.first_date) }}
                    <template v-if="usage.last_date && usage.last_date !== usage.first_date">
                      – {{ formatDate(usage.last_date) }}
                    </template>
                  </span>
                  <span v-else>No dates set</span>
                  <template v-if="usage.is_active_now"> · in use now</template>
                  <template v-else-if="usage.is_upcoming"> · upcoming</template>
                  <template v-else-if="usage.is_past"> · finished</template>
                </div>
              </div>
            </div>
          </div>

          <div v-if="dateConflicts.length" class="info-section">
            <h4 class="info-title conflict-title">Date conflicts</h4>
            <p class="info-sub">
              These projects share the same gear on overlapping days. Resolve by
              adjusting dates or swapping in a different item.
            </p>
            <div class="assignments-list">
              <div
                v-for="(conflict, idx) in dateConflicts"
                :key="idx"
                class="assignment-item conflict-item"
              >
                <div class="assignment-header">
                  <span class="assignment-stage">
                    {{ conflict.project_a.name }}
                    <span class="conflict-vs">↔</span>
                    {{ conflict.project_b.name }}
                  </span>
                  <span class="assignment-amount conflict-count">
                    {{ conflict.overlapping_dates.length }}d
                  </span>
                </div>
                <div class="assignment-details">
                  Overlaps on
                  {{ formatDate(conflict.overlapping_dates[0]) }}
                  <template v-if="conflict.overlapping_dates.length > 1">
                    – {{ formatDate(conflict.overlapping_dates[conflict.overlapping_dates.length - 1]) }}
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="gearInfo.is_user_gear && !loadingStatus && !otherProjectUsages.length"
            class="info-section info-empty"
          >
            <span class="empty-ico">✓</span>
            Not reserved on any other project.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatHumanDate } from '../../utils/gearStatusHelper'

const props = defineProps({
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
  },
  /**
   * Cross-project status for this gear (from computeUserGearStatus).
   * Optional — only populated for personal gear. Shape:
   * { usages, conflicts, conflict_with_current, ... }
   */
  gearStatus: {
    type: Object,
    default: null
  },
  loadingStatus: {
    type: Boolean,
    default: false
  },
  /** Project id we're currently viewing — used to filter out self-usages. */
  currentProjectId: {
    type: [String, Number],
    default: null
  }
})

defineEmits(['close'])

const otherProjectUsages = computed(() => {
  const usages = props.gearStatus?.usages || []
  const conflictIds = new Set(
    (props.gearStatus?.conflict_with_current || []).map(c => c.project_id)
  )
  return usages
    .filter(u => String(u.project_id) !== String(props.currentProjectId))
    .map(u => ({
      ...u,
      conflicts_with_current: conflictIds.has(u.project_id)
    }))
})

const dateConflicts = computed(() => props.gearStatus?.conflicts || [])

function formatDate(iso) {
  return formatHumanDate(iso)
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

.info-sub {
  margin: -4px 0 4px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.info-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
.status-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: gear-info-spin 0.8s linear infinite;
}
@keyframes gear-info-spin { to { transform: rotate(360deg); } }

.info-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.22);
  padding: 10px 12px;
  border-radius: 8px;
}
.empty-ico {
  color: #15803d;
  font-weight: 700;
}

.usage-conflict {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
}
.conflict-flag {
  margin-right: 4px;
}

.conflict-title {
  color: #b91c1c;
}
.conflict-item {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.06);
}
.conflict-vs {
  margin: 0 4px;
  color: var(--text-secondary);
}
.conflict-count {
  color: #b91c1c !important;
}
</style>

