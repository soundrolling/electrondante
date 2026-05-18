import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from './themeStore'

describe('themeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('initializes to a known theme and applies the matching <html> class', () => {
    const store = useThemeStore()
    store.initialize()
    expect(['light', 'dark']).toContain(store.theme)
    if (store.theme === 'dark') {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    } else {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    }
  })

  it('toggleTheme flips between light and dark and persists to localStorage', () => {
    const store = useThemeStore()
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    store.toggleTheme()
    expect(store.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('app-theme')).toBe('dark')

    store.toggleTheme()
    expect(store.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('app-theme')).toBe('light')
  })

  it('setTheme rejects invalid values', () => {
    const store = useThemeStore()
    store.setTheme('light')
    store.setTheme('rainbow')
    expect(store.theme).toBe('light')
  })

  it('isDark / isLight getters track the theme state', () => {
    const store = useThemeStore()
    store.setTheme('dark')
    expect(store.isDark).toBe(true)
    expect(store.isLight).toBe(false)

    store.setTheme('light')
    expect(store.isDark).toBe(false)
    expect(store.isLight).toBe(true)
  })

  it('resetToSystemPreference clears the manual override flag', () => {
    const store = useThemeStore()
    store.setTheme('dark')
    expect(store.isSystemPreference).toBe(false)

    store.resetToSystemPreference()
    expect(store.isSystemPreference).toBe(true)
    expect(localStorage.getItem('app-theme')).toBeNull()
  })
})
