<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Name Your Export</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="filename-input-section">
          <label for="filename-input">Filename:</label>
          <input
            id="filename-input"
            type="text"
            :value="filename"
            @input="$emit('update:filename', $event.target.value)"
            placeholder="mic-placement"
            class="filename-input-field"
            @keyup.enter="$emit('confirm')"
          />
          <p class="filename-hint">.png</p>
        </div>
        <div class="filename-actions">
          <button @click="$emit('confirm')" class="btn btn-primary">Export</button>
          <button @click="$emit('close')" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  filename: { type: String, default: '' }
})

defineEmits(['close', 'confirm', 'update:filename'])
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
  max-width: 480px;
  width: 100%;
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
.modal-body { padding: 20px; background: var(--bg-primary); }
.filename-input-section { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.filename-input-section label { font-weight: 500; color: var(--text-primary); font-size: 14px; }
.filename-input-field {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}
.filename-input-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
}
.filename-hint { margin: 0; font-size: 12px; color: var(--text-tertiary); }
.filename-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-600);
}
.btn-primary:hover { background: var(--color-primary-600); }
.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
  border-color: var(--color-secondary-600);
}
.btn-secondary:hover { background: var(--color-secondary-600); }
</style>
