<template>
  <div class="canvas-wrapper" ref="canvasWrapperRef">
    <canvas
      ref="canvasRef"
      :width="canvasWidth * dpr"
      :height="canvasHeight * dpr"
      :style="canvasStyle"
      @pointerdown="$emit('pointer-down', $event)"
      @pointermove="$emit('pointer-move', $event)"
      @pointerup="$emit('pointer-up', $event)"
      @pointerleave="$emit('pointer-up', $event)"
      @wheel="$emit('wheel', $event)"
      @dblclick="$emit('double-click', $event)"
    />
    <!-- Color Legend (desktop only) -->
    <div
      v-if="showLegend && !isMobile"
      ref="legendElRef"
      class="color-legend"
      :class="{ 'legend-dragging': legendDragging }"
      :style="legendStyle"
      draggable="false"
      @pointerdown="$emit('legend-drag-start', $event)"
      @dragstart.prevent.stop
      @drag.prevent.stop
      @dragend.prevent.stop
      @mousedown.prevent.stop
    >
      <div class="legend-header" draggable="false" @dragstart.prevent.stop>
        <h4 draggable="false">{{ stageName || 'Color Legend' }}</h4>
        <div class="legend-header-actions">
          <button @click="$emit('close-legend')" class="legend-close-btn" draggable="false">×</button>
        </div>
      </div>
      <div class="legend-items" draggable="false" @dragstart.prevent.stop>
        <div
          v-for="entry in legendEntriesByMic"
          :key="entry.key"
          class="legend-item"
          draggable="false"
          @dragstart.prevent.stop
        >
          <div
            class="legend-color-swatch"
            :style="{ backgroundColor: entry.color || '#ccc' }"
            draggable="false"
          ></div>
          <div class="legend-item-text" draggable="false">
            <span class="legend-label-text" draggable="false">{{ entry.gearName }}</span>
            <span class="legend-gear-count" draggable="false">x{{ entry.count }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  canvasWidth: { type: Number, required: true },
  canvasHeight: { type: Number, required: true },
  dpr: { type: Number, required: true },
  canvasStyle: { type: String, default: '' },
  showLegend: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  legendDragging: { type: Boolean, default: false },
  legendStyle: { type: Object, default: () => ({}) },
  legendEntriesByMic: { type: Array, default: () => [] },
  stageName: { type: String, default: '' }
})

defineEmits([
  'pointer-down',
  'pointer-move',
  'pointer-up',
  'wheel',
  'double-click',
  'legend-drag-start',
  'close-legend'
])

const canvasWrapperRef = ref(null)
const canvasRef = ref(null)
const legendElRef = ref(null)

defineExpose({ canvasWrapperRef, canvasRef, legendElRef })
</script>

<style scoped>
.canvas-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  position: relative;
}

/* Floating colour legend */
.color-legend {
  position: absolute;
  z-index: 10;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 12px 14px;
  min-width: 200px;
  max-width: 280px;
  user-select: none;
}
.color-legend.legend-dragging {
  box-shadow: var(--shadow-xl);
  opacity: 0.95;
}
.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  cursor: grab;
}
.color-legend.legend-dragging .legend-header { cursor: grabbing; }
.legend-header h4 {
  margin: 0;
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.legend-header-actions { display: inline-flex; gap: 4px; }
.legend-close-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  font-size: 18px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background var(--transition-normal), color var(--transition-normal);
}
.legend-close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.legend-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  font-size: var(--text-sm);
  color: var(--text-primary);
}
.legend-color-swatch {
  width: 12px;
  height: 12px;
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
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.legend-gear-count {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .canvas-wrapper { margin: 0 var(--space-3) var(--space-3); padding: var(--space-2); }
}
</style>
