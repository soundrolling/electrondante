<!--
  Set a node's elevation above the floor (e.g. a mic up a tower). The value is
  entered in the current display unit; the parent converts to metres on save.
  Adds a vertical run to that node's cable length.
-->
<template>
  <div v-if="show" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Height — {{ label || 'node' }}</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      <div class="modal-body">
        <p class="field-hint">
          How high is this above the floor? Used for mics up towers / rigging — the
          height is added as a vertical cable run on top of the floor distance.
        </p>
        <div class="form-field">
          <label>Height ({{ unit }})</label>
          <input
            ref="heightInput"
            v-model="value"
            type="number"
            min="0"
            step="0.1"
            inputmode="decimal"
            placeholder="0"
            class="context-menu-input"
            @keyup.enter="confirm"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button v-if="hasExisting" class="btn btn-ghost" @click="$emit('clear')">Clear</button>
        <span class="spacer" />
        <button class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy || !isValid" @click="confirm">
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  label: { type: String, default: '' },
  unit: { type: String, default: 'm' },
  currentValue: { type: Number, default: null },
})

const emit = defineEmits(['confirm', 'clear', 'cancel'])

const value = ref('')
const heightInput = ref(null)

const isValid = computed(() => value.value !== '' && Number(value.value) >= 0)
const hasExisting = computed(() => props.currentValue != null && props.currentValue > 0)

watch(() => props.show, (open) => {
  if (open) {
    value.value = props.currentValue != null ? String(props.currentValue) : ''
    nextTick(() => heightInput.value?.focus())
  }
})

function confirm() {
  if (!isValid.value) return
  emit('confirm', Number(value.value))
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
  animation: ce-fade 140ms ease-out;
}
@keyframes ce-fade { from { opacity: 0; } to { opacity: 1; } }
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: 90%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  animation: ce-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes ce-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 16px 0;
  border-bottom: 1px solid var(--border-light);
}
.modal-header h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
.close-btn {
  background: none; border: none;
  font-size: 24px; cursor: pointer;
  color: var(--text-secondary);
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.close-btn:hover { background: var(--bg-secondary); }
.modal-body { padding: 16px 0; }
.modal-footer {
  padding: 16px 0 0 0;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  align-items: center;
}
.spacer { flex: 1; }
.field-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0; line-height: 1.4; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-weight: 500; font-size: 13px; color: var(--text-primary); }
.context-menu-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--surface-card);
  color: var(--text-primary);
  min-height: 40px;
  font-family: inherit;
}
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
.btn-primary:disabled { background: var(--color-secondary-400); cursor: not-allowed; opacity: 0.6; }
.btn-secondary { background: var(--color-secondary-500); color: #fff; border-color: var(--color-secondary-600); }
.btn-secondary:hover { background: var(--color-secondary-600); }
.btn-ghost { background: transparent; color: var(--color-error-500); border-color: transparent; }
.btn-ghost:hover { background: var(--bg-secondary); }
@media (prefers-reduced-motion: reduce) {
  .modal-content, .modal-overlay { animation: none; }
}
</style>
