<template>
  <Teleport to="body">
    <div v-if="show && entries.length > 0" class="mp-mobile-legend-overlay" @click.self="$emit('close')">
      <div class="mp-mobile-legend-sheet">
        <div class="mp-mobile-legend-header">
          <h4>{{ stageName || 'Color Legend' }}</h4>
          <button @click="$emit('close')" class="legend-close-btn">×</button>
        </div>
        <div class="mp-mobile-legend-items">
          <div v-for="entry in entries" :key="entry.key" class="legend-item">
            <div class="legend-color-swatch" :style="{ backgroundColor: entry.color || '#ccc' }"></div>
            <div class="legend-item-text">
              <span class="legend-label-text">{{ entry.gearName }}</span>
              <span class="legend-gear-count">x{{ entry.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  entries: { type: Array, default: () => [] },
  stageName: { type: String, default: '' }
})

defineEmits(['close'])
</script>

<style scoped>
.mp-mobile-legend-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-end;
}
.mp-mobile-legend-sheet {
  width: 100%;
  background: var(--surface-card, var(--bg-primary));
  border-radius: var(--radius-xl, 16px) var(--radius-xl, 16px) 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  padding: var(--space-4, 16px);
  max-height: 60vh;
  overflow-y: auto;
  animation: mp-sheet 200ms cubic-bezier(0.25, 0.8, 0.35, 1);
  padding-bottom: max(var(--space-4, 16px), env(safe-area-inset-bottom, 0px));
}
@keyframes mp-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
.mp-mobile-legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3, 12px);
}
.mp-mobile-legend-header h4 {
  margin: 0;
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-semibold, 600);
  color: var(--text-primary);
}
.legend-close-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  font-size: 18px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.legend-close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.mp-mobile-legend-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}
.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 4px;
}
.legend-color-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  flex-shrink: 0;
  margin-top: 3px;
}
.legend-item-text {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.legend-label-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.legend-gear-count {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .mp-mobile-legend-sheet { animation: none; }
}
</style>
