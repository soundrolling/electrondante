<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p v-if="message" class="modal-message">{{ message }}</p>
      <div class="input-field">
        <label v-if="label">{{ label }}</label>
        <input
          ref="inputRef"
          type="text"
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
          @keyup.enter="handleConfirm"
          @keyup.esc="$emit('cancel')"
          :placeholder="placeholder"
          class="modal-input"
        />
      </div>
      <div class="modal-actions">
        <button class="btn btn-positive confirm-button" @click="handleConfirm">
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
import { watch, nextTick, ref } from 'vue'

export default {
  name: 'InputModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Enter Value'
    },
    message: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
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
  emits: ['update:modelValue', 'confirm', 'cancel'],
  setup(props, { emit }) {
    const inputRef = ref(null)

    // Auto-focus input when modal opens
    watch(() => props.show, (newVal) => {
      if (newVal) {
        nextTick(() => {
          if (inputRef.value) {
            inputRef.value.focus()
            inputRef.value.select()
          }
        })
      }
    })

    function handleConfirm() {
      if (props.modelValue.trim()) {
        emit('confirm', props.modelValue)
      }
    }

    return {
      inputRef,
      handleConfirm
    }
  }
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
.modal-message {
  margin: 0 0 1rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
}
.input-field {
  margin-bottom: 1.5rem;
}
.input-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.modal-input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}
.modal-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.confirm-button {
  background: var(--color-success-500);
  color: var(--text-inverse) !important;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}
.confirm-button:hover {
  background: var(--color-success-600);
}
.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

