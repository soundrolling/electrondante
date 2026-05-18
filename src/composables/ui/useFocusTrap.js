// src/composables/ui/useFocusTrap.js
//
// Tiny focus-trap helper used by BaseModal. Given a ref to a containing
// element, traps Tab / Shift+Tab cycling between the first and last focusable
// descendants and restores focus to whatever was active before the trap was
// activated. Activate / deactivate are imperative so callers can wire them to
// modal open/close lifecycles without owning the listener registration.

import { ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function useFocusTrap(containerRef) {
  const previouslyFocused = ref(null)
  let keydownHandler = null

  const getFocusable = () => {
    const root = containerRef.value
    if (!root) return []
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    )
  }

  const focusFirst = () => {
    const focusable = getFocusable()
    const target = focusable[0] || containerRef.value
    if (target && typeof target.focus === 'function') {
      target.focus()
    }
  }

  const activate = () => {
    previouslyFocused.value =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    keydownHandler = (e) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === first || !containerRef.value?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', keydownHandler)
    // Defer initial focus until the DOM is painted — covers v-if mount race.
    setTimeout(focusFirst, 0)
  }

  const deactivate = () => {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler)
      keydownHandler = null
    }
    const target = previouslyFocused.value
    if (target && typeof target.focus === 'function' && document.contains(target)) {
      target.focus()
    }
    previouslyFocused.value = null
  }

  return { activate, deactivate, focusFirst, getFocusable }
}
