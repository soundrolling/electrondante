<template>
  <div v-if="show" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content delete-confirm-modal" @click.stop>
      <div class="modal-header">
        <h3>🗑️ Confirm Delete</h3>
        <button @click="$emit('cancel')" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="delete-confirm-content">
          <p class="delete-confirm-message">{{ message }}</p>
          <p v-if="warning" class="delete-confirm-warning">{{ warning }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="$emit('cancel')" class="btn btn-secondary">Cancel</button>
        <button @click="$emit('confirm')" class="btn btn-danger">Delete</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  message: { type: String, default: '' },
  warning: { type: String, default: '' }
})

defineEmits(['cancel', 'confirm'])
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
.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.delete-confirm-message { font-size: 15px; color: var(--text-primary); margin: 0 0 12px 0; }
.delete-confirm-warning {
  font-size: 13px;
  color: var(--color-warning-800, #856404);
  background: var(--color-warning-50, #fff3cd);
  padding: 10px;
  border-radius: 6px;
  margin: 0;
}
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
  border-color: var(--color-secondary-600);
}
.btn-secondary:hover { background: var(--color-secondary-600); }
.btn-danger {
  background: var(--color-error-500);
  color: white;
  border-color: var(--color-error-600);
}
.btn-danger:hover { background: var(--color-error-600); }
</style>
