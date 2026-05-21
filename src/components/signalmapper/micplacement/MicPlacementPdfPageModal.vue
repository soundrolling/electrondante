<template>
  <div v-if="show" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Choose PDF page</h3>
        <button @click="$emit('cancel')" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <p class="pdf-info">This PDF has {{ pageCount }} pages. Which page should be used as the background?</p>
        <div class="page-input-row">
          <label for="pdf-page-input">Page</label>
          <input
            id="pdf-page-input"
            type="number"
            min="1"
            :max="pageCount"
            :value="pageNumber"
            @input="$emit('update:page-number', clamp($event.target.value))"
            class="page-input"
            @keyup.enter="$emit('confirm')"
          />
          <span class="pdf-info">of {{ pageCount }}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('cancel')" class="btn btn-secondary">Cancel</button>
        <button @click="$emit('confirm')" class="btn btn-primary" :disabled="busy">
          {{ busy ? 'Rendering…' : 'Use this page' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: { type: Boolean, default: false },
  pageCount: { type: Number, default: 1 },
  pageNumber: { type: Number, default: 1 },
  busy: { type: Boolean, default: false }
})

defineEmits(['cancel', 'confirm', 'update:page-number'])

function clamp(v) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(1, n), props.pageCount)
}
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
  max-width: 420px;
  width: 100%;
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
.modal-body { padding: 20px; background: var(--bg-primary); }
.pdf-info { margin: 0; font-size: 14px; color: var(--text-secondary); }
.page-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
.page-input-row label { font-weight: 500; font-size: 14px; color: var(--text-primary); }
.page-input {
  width: 90px;
  padding: 8px 10px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.page-input:focus { outline: none; border-color: var(--color-primary-500); }
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-600);
}
.btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
  border-color: var(--color-secondary-600);
}
.btn-secondary:hover { background: var(--color-secondary-600); }
</style>
