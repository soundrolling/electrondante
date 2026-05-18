<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content color-button-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ editingColorButton !== null ? 'Edit' : 'Add' }} Colour Legend Entry</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label>Name*</label>
          <input
            :value="form.name"
            @input="updateForm('name', $event.target.value)"
            placeholder="e.g. Vocals, Drums, Stage Left, etc."
            required
            class="context-menu-input"
          />
          <p class="field-hint">This name will appear in the legend on exported images</p>
        </div>
        <div class="form-field">
          <label>Colour*</label>
          <select
            :value="form.color"
            @change="updateForm('color', $event.target.value)"
            required
            class="context-menu-input"
          >
            <option disabled value="">Select a colour</option>
            <option v-for="c in colorOptions" :key="c.value" :value="c.value">
              {{ c.name }}
            </option>
          </select>
          <div v-if="form.color" class="color-preview-box">
            <div class="preview-label">Preview:</div>
            <div class="preview-mic-sample">
              <div class="preview-circle" :style="{ borderColor: form.color }">
                <div class="preview-arrow"></div>
              </div>
              <div class="preview-label-box" :style="{ backgroundColor: form.color, color: getContrastColor(form.color) }">
                Sample Label
              </div>
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>Description</label>
          <input
            :value="form.description"
            @input="updateForm('description', $event.target.value)"
            placeholder="Optional description (e.g., 'Used for vocal microphones')"
            class="context-menu-input"
          />
          <p class="field-hint">Optional note about what this colour represents</p>
        </div>
        <p v-if="form.error" class="error-text">{{ form.error }}</p>
      </div>
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">Cancel</button>
        <button @click="$emit('save')" class="btn btn-primary" :disabled="busy || !form.name || !form.color">
          {{ busy ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getContrastColor, COLOR_OPTIONS } from '@/composables/micPlacement/colorHelpers'

const props = defineProps({
  show: { type: Boolean, default: false },
  editingColorButton: { type: Number, default: null },
  form: {
    type: Object,
    default: () => ({ name: '', color: '', description: '', error: null })
  },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'save', 'update:form'])

const colorOptions = COLOR_OPTIONS

function updateForm(field, value) {
  emit('update:form', { ...props.form, [field]: value })
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
  animation: mp-fade 140ms ease-out;
}
@keyframes mp-fade { from { opacity: 0; } to { opacity: 1; } }
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 480px;
  width: 85%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  animation: mp-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes mp-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 20px 0;
  border-bottom: 1px solid var(--border-light);
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
.modal-body {
  padding: 16px 0;
  flex: 1;
  max-height: 60vh;
  overflow-y: auto;
}
.modal-footer {
  padding: 16px 0 0 0;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.form-field { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-weight: 500; font-size: 13px; color: var(--text-primary); }
.field-hint { font-size: 11px; color: var(--text-tertiary); margin: 0; }
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
.color-preview-box {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.preview-label { font-size: 12px; color: var(--text-secondary); }
.preview-mic-sample { display: flex; align-items: center; gap: 8px; }
.preview-circle {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 3px solid currentColor;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
}
.preview-arrow {
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 10px solid #495057;
}
.preview-label-box {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.error-text {
  color: var(--color-error-500);
  font-size: 13px;
  margin: 0;
}
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

@media (prefers-reduced-motion: reduce) {
  .modal-content, .modal-overlay { animation: none; }
}
</style>
