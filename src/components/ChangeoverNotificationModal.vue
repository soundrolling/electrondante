<!-- src/components/ChangeoverNotificationModal.vue -->
<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="isVisible" class="changeover-modal-overlay" @click.self="close">
        <div class="changeover-modal">
          <div class="changeover-modal-header">
            <div class="changeover-icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" class="changeover-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 10L10 12L8 14"/>
                <path d="M16 10L14 12L16 14"/>
                <path d="M10 12H14"/>
              </svg>
            </div>
            <h2 class="changeover-title">Changeover Alert</h2>
          </div>
          
          <div class="changeover-modal-body">
            <p class="changeover-message">
              <strong>{{ artistName }}</strong> Starting In <strong>{{ minutesRemaining }} Minute{{ minutesRemaining !== 1 ? 's' : '' }}</strong>
            </p>
            <p v-if="startTime" class="changeover-time">
              Scheduled start: {{ startTime }}
            </p>
          </div>
          
          <div class="changeover-modal-footer">
            <button 
              class="btn btn-secondary" 
              @click="close"
            >
              Close
            </button>
            <button 
              class="btn btn-primary" 
              @click="goToArtistSchedule"
              v-if="locationId"
            >
              Go To Artist Schedule
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'ChangeoverNotificationModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    artistName: {
      type: String,
      required: true
    },
    minutesRemaining: {
      type: Number,
      required: true
    },
    startTime: {
      type: String,
      default: ''
    },
    locationId: {
      type: [String, Number],
      default: null
    },
    projectId: {
      type: [String, Number],
      default: null
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const router = useRouter()
    const isVisible = ref(props.visible)

    watch(() => props.visible, (newVal) => {
      isVisible.value = newVal
    })

    const close = () => {
      isVisible.value = false
      emit('close')
    }

    const goToArtistSchedule = () => {
      if (props.locationId && props.projectId) {
        router.push({
          name: 'LocationNotes',
          params: {
            id: props.projectId,
            locationId: props.locationId
          },
          query: {
            tab: 'schedule'
          }
        })
      }
      close()
    }

    return {
      isVisible,
      close,
      goToArtistSchedule
    }
  }
}
</script>

<style scoped>
.changeover-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.changeover-modal {
  background: var(--color-warning-400);
  border: 3px solid #fbc02d;
  border-radius: 16px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  color: #000000; /* Dark text for light background */
}

.changeover-modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
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
  color: #000000; /* Dark icon for light background */
}

.changeover-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #000000; /* Dark text for light background */
}

.changeover-modal-body {
  margin-bottom: 32px;
}

.changeover-message {
  font-size: 1.5rem;
  font-weight: 600;
  color: #000000; /* Dark text for light background */
  margin-bottom: 12px;
  line-height: 1.4;
}

.changeover-message strong {
  font-weight: 700;
  color: #000000; /* Dark text for light background */
}

.changeover-time {
  font-size: 1rem;
  color: #333333; /* Dark gray for light background */
  margin: 0;
}

.changeover-modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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
  color: #000000; /* Dark text for light background */
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.btn-secondary:hover {
  background-color: rgba(0, 0, 0, 0.15);
  border-color: rgba(0, 0, 0, 0.3);
}

.btn-primary {
  background-color: var(--color-primary-600);
  color: #ffffff; /* White text for dark button */
  border: 1px solid var(--color-primary-700);
}

.btn-primary:hover {
  background-color: var(--color-primary-700);
  border-color: var(--color-primary-800);
}

/* Modal fade transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .changeover-modal,
.modal-fade-leave-active .changeover-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-fade-enter-from .changeover-modal,
.modal-fade-leave-to .changeover-modal {
  transform: scale(0.9);
  opacity: 0;
}
</style>
