<!--
  Shown after the user draws a two-point reference line on the floor plan.
  Captures the real-world length of that line + its unit, which calibrates the
  whole stage so cable runs can be measured.
-->
<template>
  <div v-if="show" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Set the real length</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>
      <div class="modal-body">
        <p class="field-hint">
          You drew a reference line on the floor plan. Enter how long that line is in real life —
          every cable run is then measured from this scale.
        </p>
        <div class="length-row">
          <div class="form-field grow">
            <label>Real length*</label>
            <input
              ref="lengthInput"
              v-model="length"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              placeholder="e.g. 12"
              class="context-menu-input"
              @keyup.enter="confirm"
            />
          </div>
          <div class="form-field unit-field">
            <label>Unit</label>
            <div class="unit-toggle">
              <button
                type="button"
                :class="['unit-btn', { active: unit === 'm' }]"
                @click="unit = 'm'"
              >metres</button>
              <button
                type="button"
                :class="['unit-btn', { active: unit === 'ft' }]"
                @click="unit = 'ft'"
              >feet</button>
            </div>
          </div>
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy || !isValid" @click="confirm">
          {{ busy ? 'Saving…' : 'Save scale' }}
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
  defaultUnit: { type: String, default: 'm' },
})

const emit = defineEmits(['confirm', 'cancel'])

const length = ref('')
const unit = ref(props.defaultUnit === 'ft' ? 'ft' : 'm')
const error = ref('')
const lengthInput = ref(null)

const isValid = computed(() => Number(length.value) > 0)

watch(() => props.show, (open) => {
  if (open) {
    length.value = ''
    unit.value = props.defaultUnit === 'ft' ? 'ft' : 'm'
    error.value = ''
    nextTick(() => lengthInput.value?.focus())
  }
})

function confirm() {
  if (!isValid.value) {
    error.value = 'Enter a length greater than zero.'
    return
  }
  emit('confirm', Number(length.value), unit.value)
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
  max-width: 440px;
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
  justify-content: flex-end;
}
.field-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0; line-height: 1.4; }
.length-row { display: flex; gap: 12px; align-items: flex-end; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field.grow { flex: 1; }
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
.unit-toggle { display: flex; gap: 0; }
.unit-btn {
  padding: 10px 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  min-height: 40px;
}
.unit-btn:first-child { border-radius: var(--radius-md) 0 0 var(--radius-md); }
.unit-btn:last-child { border-radius: 0 var(--radius-md) var(--radius-md) 0; border-left: none; }
.unit-btn.active {
  background: var(--color-primary-500);
  color: #fff;
  border-color: var(--color-primary-600);
}
.error-text { color: var(--color-error-500); font-size: 13px; margin: 12px 0 0 0; }
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
.btn-primary:disabled { background: var(--color-secondary-400); cursor: not-allowed; opacity: 0.6; }
.btn-secondary { background: var(--color-secondary-500); color: #fff; border-color: var(--color-secondary-600); }
.btn-secondary:hover { background: var(--color-secondary-600); }
@media (prefers-reduced-motion: reduce) {
  .modal-content, .modal-overlay { animation: none; }
}
</style>
