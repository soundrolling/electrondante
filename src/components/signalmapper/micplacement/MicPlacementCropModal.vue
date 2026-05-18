<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content crop-modal" @click.stop>
      <div class="modal-header">
        <h3>Crop Background Image</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="crop-container">
          <canvas
            ref="cropCanvasRef"
            class="crop-canvas"
            @mousedown="$emit('mouse-down', $event)"
            @mousemove="$emit('mouse-move', $event)"
            @mouseup="$emit('mouse-up', $event)"
            @mouseleave="$emit('mouse-up', $event)"
          ></canvas>
          <div class="crop-instructions">
            <p>Drag the corners or edges of the crop box to adjust the selection</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">Cancel</button>
        <button @click="$emit('apply')" class="btn btn-primary" :disabled="busy">Apply Crop</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  show: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
})

defineEmits(['close', 'apply', 'mouse-down', 'mouse-move', 'mouse-up'])

const cropCanvasRef = ref(null)

defineExpose({ cropCanvasRef })
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
}
.modal-header h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
.close-btn {
  background: none; border: none;
  font-size: 24px; cursor: pointer;
  color: var(--text-secondary);
  padding: 0; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.close-btn:hover { background: var(--bg-secondary); }
.modal-body { padding: 20px; flex: 1; overflow-y: auto; background: var(--bg-primary); }
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
  display: flex; gap: 12px; justify-content: flex-end;
}
.crop-container { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.crop-canvas {
  display: block;
  cursor: default;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  max-width: 100%;
}
.crop-instructions {
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}
.crop-instructions p { margin: 0; }
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-600);
}
.btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
.btn-primary:disabled {
  background: var(--color-secondary-400);
  cursor: not-allowed;
  opacity: 0.6;
}
.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
  border-color: var(--color-secondary-600);
}
.btn-secondary:hover { background: var(--color-secondary-600); }
</style>
