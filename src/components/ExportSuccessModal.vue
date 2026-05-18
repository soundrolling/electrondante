<!--
  src/components/ExportSuccessModal.vue

  Migrated to use BaseModal for overlay/focus/ESC chrome (#10). The body
  markup matches the old design; only the outer chrome is delegated.
  Props/emits are preserved exactly so App.vue / exportStorageService do
  not need to change.
-->
<template>
  <BaseModal
    :open="visible"
    title="Export Saved Successfully"
    size="md"
    @close="handleClose"
  >
    <div class="success-body">
      <div class="success-icon">✓</div>
      <p class="success-message">Your file has been saved to Documents</p>
      <p class="filename">{{ filename }}</p>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleClose">
        Close
      </button>
      <button type="button" class="btn btn-primary" @click="handleDownload">
        <span>⬇️</span>
        <span>Download to Device</span>
      </button>
      <button type="button" class="btn btn-primary" @click="handleNavigate">
        <span>📁</span>
        <span>View Documents</span>
      </button>
    </template>
  </BaseModal>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'ExportSuccessModal',
  components: { BaseModal },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    filename: {
      type: String,
      default: '',
    },
    result: {
      type: Object,
      default: null,
    },
  },
  emits: ['download', 'navigate', 'close'],
  setup(props, { emit }) {
    const router = useRouter()
    const userStore = useUserStore()

    const handleDownload = () => {
      emit('download')
    }

    const handleClose = () => {
      emit('close')
    }

    const handleNavigate = () => {
      const projectId = props.result?.projectId || userStore.getCurrentProject?.id
      if (projectId) {
        router.push({ name: 'ProjectDocs', params: { id: projectId } })
      }
      emit('navigate')
      handleClose()
    }

    return {
      handleDownload,
      handleNavigate,
      handleClose,
    }
  },
}
</script>

<style scoped>
.success-body {
  padding: 12px 0;
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
</style>
