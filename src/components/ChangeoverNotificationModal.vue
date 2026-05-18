<!--
  src/components/ChangeoverNotificationModal.vue

  Migrated to use BaseModal for overlay/focus/ESC chrome (#10). The yellow
  warning-styled dialog body is preserved; only the outer chrome is delegated.
  We disable the default BaseModal header (using the named #header slot
  with a custom header) so the icon + title layout stays intact.
-->
<template>
  <BaseModal
    :open="visible"
    aria-label="Changeover Alert"
    size="md"
    class="changeover-modal-wrapper"
    @close="close"
  >
    <template #header>
      <div class="changeover-modal-header">
        <div class="changeover-icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" class="changeover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 10L10 12L8 14" />
            <path d="M16 10L14 12L16 14" />
            <path d="M10 12H14" />
          </svg>
        </div>
        <h2 class="changeover-title">Changeover Alert</h2>
      </div>
    </template>

    <div class="changeover-modal-body">
      <p class="changeover-message">
        <strong>{{ artistName }}</strong> Starting In <strong>{{ minutesRemaining }} Minute{{ minutesRemaining !== 1 ? 's' : '' }}</strong>
      </p>
      <p v-if="startTime" class="changeover-time">
        Scheduled start: {{ startTime }}
      </p>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="close"
      >
        Close
      </button>
      <button
        v-if="locationId"
        type="button"
        class="btn btn-primary"
        @click="goToArtistSchedule"
      >
        Go To Artist Schedule
      </button>
    </template>
  </BaseModal>
</template>

<script>
import { useRouter } from 'vue-router'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'ChangeoverNotificationModal',
  components: { BaseModal },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    artistName: {
      type: String,
      required: true,
    },
    minutesRemaining: {
      type: Number,
      required: true,
    },
    startTime: {
      type: String,
      default: '',
    },
    locationId: {
      type: [String, Number],
      default: null,
    },
    projectId: {
      type: [String, Number],
      default: null,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const router = useRouter()

    const close = () => {
      emit('close')
    }

    const goToArtistSchedule = () => {
      if (props.locationId && props.projectId) {
        router.push({
          name: 'LocationNotes',
          params: {
            id: props.projectId,
            locationId: props.locationId,
          },
          query: {
            tab: 'schedule',
          },
        })
      }
      close()
    }

    return {
      close,
      goToArtistSchedule,
    }
  },
}
</script>

<style scoped>
/* Override BaseModal chrome to keep the yellow warning palette.
   Selectors target the BaseModal internals via :deep() so the warning style
   only applies inside this component. */
:deep(.basemodal-dialog) {
  background: var(--color-warning-400);
  border: 3px solid #fbc02d;
  border-radius: 16px;
  color: #000000;
}

:deep(.basemodal-header),
:deep(.basemodal-footer) {
  border-color: rgba(0, 0, 0, 0.15);
}

:deep(.basemodal-body) {
  color: #000000;
}

.changeover-modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.changeover-icon-container {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 50%;
}

.changeover-icon {
  width: 32px;
  height: 32px;
  color: #000000;
}

.changeover-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #000000;
}

.changeover-modal-body {
  padding: 8px 0;
}

.changeover-message {
  font-size: 1.5rem;
  font-weight: 600;
  color: #000000;
  margin-bottom: 12px;
  line-height: 1.4;
}

.changeover-message strong {
  font-weight: 700;
  color: #000000;
}

.changeover-time {
  font-size: 1rem;
  color: #333333;
  margin: 0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: rgba(0, 0, 0, 0.1);
  color: #000000;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.btn-secondary:hover {
  background-color: rgba(0, 0, 0, 0.15);
  border-color: rgba(0, 0, 0, 0.3);
}

.btn-primary {
  background-color: var(--color-primary-600);
  color: #ffffff;
  border: 1px solid var(--color-primary-700);
}

.btn-primary:hover {
  background-color: var(--color-primary-700);
  border-color: var(--color-primary-800);
}
</style>
