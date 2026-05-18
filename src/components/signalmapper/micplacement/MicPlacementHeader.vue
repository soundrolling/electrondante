<template>
  <header class="mp-head">
    <div class="mp-head-title">
      <h2 class="mp-title">Mic Placement</h2>
      <p class="mp-subtitle">Place mics on the floor plan, assign track names, tap to edit</p>
    </div>
    <div class="mp-counts">
      <span class="mp-count">
        <span class="mp-count-value">{{ nodeCount }}</span>
        <span class="mp-count-label">placed</span>
      </span>
      <span v-if="selectedCount > 0" class="mp-count active">
        <span class="mp-count-value">{{ selectedCount }}</span>
        <span class="mp-count-label">selected</span>
      </span>
    </div>
  </header>
  <div v-if="isMobile" class="mp-mobile-tip">
    <Smartphone :size="14" :stroke-width="2" />
    <span>Tap + hold to move mics. For dense placements, a tablet or desktop works better.</span>
  </div>
</template>

<script setup>
import { Smartphone } from 'lucide-vue-next'

defineProps({
  nodeCount: { type: Number, default: 0 },
  selectedCount: { type: Number, default: 0 },
  isMobile: { type: Boolean, default: false }
})
</script>

<style scoped>
.mp-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-3);
  flex-wrap: wrap;
}
.mp-head-title { min-width: 0; }
.mp-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  margin: 0;
  letter-spacing: -0.02em;
}
.mp-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0 0;
}
.mp-counts { display: flex; gap: var(--space-3); flex-shrink: 0; }
.mp-count {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1;
}
.mp-count-value {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}
.mp-count.active .mp-count-value { color: var(--color-primary-600); }
.mp-count-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-weight: var(--font-medium);
}

.mp-mobile-tip {
  margin: 0 var(--space-4) var(--space-3);
  padding: 8px 10px;
  background: var(--color-warning-50);
  border: 1px solid var(--color-warning-200);
  border-radius: var(--radius-md);
  color: var(--color-warning-800);
  font-size: var(--text-xs);
  display: flex;
  align-items: center;
  gap: 8px;
}
.mp-mobile-tip svg { flex-shrink: 0; color: var(--color-warning-700); }
:deep(.dark) .mp-mobile-tip {
  background: rgba(120, 53, 15, 0.25);
  border-color: var(--color-warning-700);
  color: var(--color-warning-200);
}

@media (max-width: 600px) {
  .mp-head {
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-3) var(--space-3) var(--space-2);
    gap: var(--space-2);
  }
  .mp-counts { justify-content: flex-start; gap: var(--space-4); }
  .mp-count { align-items: flex-start; }
  .mp-mobile-tip { margin: 0 var(--space-3) var(--space-2); }
}
</style>
