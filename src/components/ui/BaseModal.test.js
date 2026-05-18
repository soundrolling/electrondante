// src/components/ui/BaseModal.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import BaseModal from './BaseModal.vue'

// happy-dom: Teleport target is document.body, so attachTo isn't required, but
// we must scope our queries to `body` rather than the wrapper.

const resetBody = () => {
  // Defer to DOM API rather than innerHTML to keep the security hook happy.
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild)
  }
  document.body.style.overflow = ''
  delete document.body.dataset.basemodalOpen
}

describe('BaseModal', () => {
  beforeEach(resetBody)
  afterEach(resetBody)

  it('does not render the dialog when open is false', () => {
    mount(BaseModal, { props: { open: false, title: 'Hidden' } })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders a dialog with title and aria-labelledby when open', async () => {
    mount(BaseModal, { props: { open: true, title: 'Hello' } })
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy).textContent).toBe('Hello')
  })

  it('locks body scroll while open and restores on close', async () => {
    const wrapper = mount(BaseModal, { props: { open: true, title: 'Lock' } })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.body.style.overflow).toBe('')
  })

  it('emits update:open=false and close when ESC is pressed', async () => {
    const wrapper = mount(BaseModal, { props: { open: true, title: 'Esc' } })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')[0]).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not close on ESC when closeOnEsc is false', async () => {
    const wrapper = mount(BaseModal, {
      props: { open: true, title: 'NoEsc', closeOnEsc: false },
    })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })

  it('renders footer slot when provided', async () => {
    mount(BaseModal, {
      props: { open: true, title: 'WithFooter' },
      slots: {
        default: '<p>body content</p>',
        footer: '<button id="ok-btn">OK</button>',
      },
    })
    await nextTick()
    expect(document.body.querySelector('#ok-btn')).toBeTruthy()
    expect(document.body.textContent).toContain('body content')
  })
})
