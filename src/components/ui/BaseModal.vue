<!--
  src/components/ui/BaseModal.vue

  Canonical modal/dialog primitive for the app. Handles the outer chrome
  (overlay, focus trap, ESC, scroll lock, ARIA wiring, fade+scale transition)
  so feature modals can focus on body markup via slots.

  Usage:
    <BaseModal v-model:open="state" title="Confirm" size="md" @close="cleanup">
      <p>Body content</p>
      <template #footer>
        <button @click="state = false">Close</button>
      </template>
    </BaseModal>
-->
<template>
  <Teleport to="body">
    <Transition name="basemodal">
      <div
        v-if="open"
        class="basemodal-overlay"
        @click.self="handleBackdropClick"
      >
        <div
          ref="dialogRef"
          class="basemodal-dialog"
          :class="sizeClass"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-label="!title ? ariaLabel : undefined"
          tabindex="-1"
        >
          <header v-if="$slots.header || title" class="basemodal-header">
            <slot name="header">
              <h3 :id="titleId" class="basemodal-title">{{ title }}</h3>
              <button
                type="button"
                class="basemodal-close"
                :aria-label="$slots.header ? 'Close dialog' : `Close ${title}`"
                @click="close"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </slot>
          </header>

          <div class="basemodal-body">
            <slot />
          </div>

          <footer
            v-if="$slots.footer || $slots.actions"
            class="basemodal-footer"
          >
            <slot name="footer">
              <slot name="actions" />
            </slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useFocusTrap } from '@/composables/ui/useFocusTrap'

let modalCount = 0

export default {
  name: 'BaseModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    size: {
      type: String,
      default: 'md',
      validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v),
    },
    closeOnBackdrop: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true },
    ariaLabel: { type: String, default: '' },
  },
  emits: ['update:open', 'close'],
  setup(props, { emit }) {
    const dialogRef = ref(null)
    const titleId = `basemodal-title-${++modalCount}`
    const { activate, deactivate } = useFocusTrap(dialogRef)

    const sizeClass = computed(() => `basemodal-size-${props.size}`)

    const close = () => {
      emit('update:open', false)
      emit('close')
    }

    const handleBackdropClick = () => {
      if (props.closeOnBackdrop) close()
    }

    let escHandler = null
    const bindEsc = () => {
      escHandler = (e) => {
        if (e.key === 'Escape' && props.closeOnEsc) {
          e.stopPropagation()
          close()
        }
      }
      document.addEventListener('keydown', escHandler)
    }
    const unbindEsc = () => {
      if (escHandler) {
        document.removeEventListener('keydown', escHandler)
        escHandler = null
      }
    }

    // Body scroll lock — count active modals so nested/sibling modals don't
    // unlock the body prematurely.
    const lockScroll = () => {
      const count = Number(document.body.dataset.basemodalOpen || 0) + 1
      document.body.dataset.basemodalOpen = String(count)
      if (count === 1) {
        document.body.style.overflow = 'hidden'
      }
    }
    const unlockScroll = () => {
      const count = Math.max(0, Number(document.body.dataset.basemodalOpen || 0) - 1)
      if (count === 0) {
        delete document.body.dataset.basemodalOpen
        document.body.style.overflow = ''
      } else {
        document.body.dataset.basemodalOpen = String(count)
      }
    }

    let isOpen = false
    const onOpen = async () => {
      if (isOpen) return
      isOpen = true
      lockScroll()
      bindEsc()
      await nextTick()
      activate()
    }
    const onClose = () => {
      if (!isOpen) return
      isOpen = false
      unbindEsc()
      deactivate()
      unlockScroll()
    }

    watch(
      () => props.open,
      (val) => {
        if (val) onOpen()
        else onClose()
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      // Safety: ensure listeners/scroll lock are released even if the host
      // component is destroyed while the modal is still open.
      onClose()
    })

    return { dialogRef, titleId, sizeClass, close, handleBackdropClick }
  },
}
</script>

<style scoped>
.basemodal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 16px);
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.basemodal-dialog {
  position: relative;
  width: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-xl, 0 16px 48px rgba(0, 0, 0, 0.15));
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  outline: none;
}

.basemodal-size-sm { max-width: 400px; }
.basemodal-size-md { max-width: 560px; }
.basemodal-size-lg { max-width: 768px; }
.basemodal-size-xl { max-width: 1024px; }

.basemodal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  border-bottom: 1px solid var(--border-light);
}

.basemodal-title {
  margin: 0;
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-semibold, 600);
  color: var(--text-heading, var(--text-primary));
  line-height: 1.3;
}

.basemodal-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: var(--text-secondary);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.basemodal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.basemodal-close:focus-visible {
  outline: 2px solid var(--color-primary-500, #0ea5e9);
  outline-offset: 2px;
}

.basemodal-body {
  padding: var(--space-6, 24px);
  overflow-y: auto;
  flex: 1 1 auto;
}

.basemodal-footer {
  display: flex;
  gap: var(--space-3, 12px);
  justify-content: flex-end;
  padding: var(--space-5, 20px) var(--space-6, 24px);
  border-top: 1px solid var(--border-light);
  flex-wrap: wrap;
}

/* Fade + scale transition */
.basemodal-enter-active,
.basemodal-leave-active {
  transition: opacity 0.2s ease;
}

.basemodal-enter-active .basemodal-dialog,
.basemodal-leave-active .basemodal-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.basemodal-enter-from,
.basemodal-leave-to {
  opacity: 0;
}

.basemodal-enter-from .basemodal-dialog,
.basemodal-leave-to .basemodal-dialog {
  transform: scale(0.96);
  opacity: 0;
}

@media (max-width: 640px) {
  .basemodal-overlay {
    padding: var(--space-2, 8px);
  }
  .basemodal-header,
  .basemodal-footer {
    padding: var(--space-4, 16px) var(--space-4, 16px);
  }
  .basemodal-body {
    padding: var(--space-4, 16px);
  }
  .basemodal-footer {
    flex-direction: column-reverse;
  }
  .basemodal-footer > * {
    width: 100%;
  }
}
</style>
