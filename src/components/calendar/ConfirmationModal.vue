<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p v-if="message">{{ message }}</p>
      <div class="modal-actions">
        <button class="btn btn-danger confirm-button" @click="$emit('confirm')">
          {{ confirmText }}
        </button>
        <button class="btn btn-warning cancel-button" @click="$emit('cancel')">
          {{ cancelText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmationModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Confirm Action'
    },
    message: {
      type: String,
      default: ''
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    }
  },
  emits: ['confirm', 'cancel']
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}
.modal {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.modal h3 {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  color: var(--text-heading);
  font-weight: 600;
}
.modal p {
  margin: 0 0 1.5rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.confirm-button {
  background: var(--color-error-500);
  color: var(--text-inverse) !important;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}
.confirm-button:hover {
  background: var(--color-error-600);
}
.cancel-button {
  background: var(--color-secondary-400);
  color: var(--text-inverse) !important;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}
.cancel-button:hover {
  background: var(--color-secondary-500);
}
</style>

