<template>
  <div v-if="visible" class="modal-backdrop" @click.self="handleClose">
    <div class="modal-content export-success-modal">
      <div class="modal-header">
        <h3>Export Saved Successfully</h3>
        <button class="modal-close" @click="handleClose">×</button>
      </div>
      <div class="modal-body">
        <div class="success-icon">✓</div>
        <p class="success-message">Your file has been saved to Data Management</p>
        <p class="filename">{{ filename }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">
          Close
        </button>
        <button class="btn btn-primary" @click="handleDownload">
          <span>⬇️</span>
          <span>Download to Device</span>
        </button>
        <button class="btn btn-primary" @click="handleNavigate">
          <span>📁</span>
          <span>View in Data Management</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

export default {
  name: 'ExportSuccessModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    filename: {
      type: String,
      default: ''
    },
    result: {
      type: Object,
      default: null
    }
  },
  emits: ['download', 'navigate', 'close'],
  setup(props, { emit }) {
    const router = useRouter()
    const userStore = useUserStore()

    const handleDownload = () => {
      emit('download')
    }

    const handleNavigate = () => {
      // Navigate to Data Management
      const projectId = props.result?.projectId || userStore.getCurrentProject?.id
      if (projectId) {
        router.push({ name: 'DataManagement', params: { id: projectId } })
      }
      emit('navigate')
      handleClose()
    }

    const handleClose = () => {
      emit('close')
    }

    return {
      handleDownload,
      handleNavigate,
      handleClose
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.export-success-modal {
  width: 100%;
  max-width: 500px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-heading);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.modal-close:hover {
  background: var(--bg-secondary);
}

.modal-body {
  padding: 32px 20px;
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-success-100);
  color: var(--color-success-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  margin: 0 auto 16px;
}

.success-message {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  font-weight: 500;
}

.filename {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  word-break: break-all;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary-500);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-secondary);
}

@media (max-width: 768px) {
  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>

