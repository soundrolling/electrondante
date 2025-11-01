// src/stores/themeStore.js

import { defineStore } from 'pinia';

const THEME_STORAGE_KEY = 'app-theme';

/**
 * Detect system color scheme preference
 */
const getSystemPreference = () => {
  if (typeof window === 'undefined') return 'light';
  
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch (e) {
    return 'light';
  }
};

/**
 * Get initial theme from localStorage or system preference
 */
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    // No stored preference, use system preference
    return getSystemPreference();
  } catch (e) {
    console.warn('Failed to read theme from localStorage:', e);
    return getSystemPreference();
  }
};

/**
 * Apply theme class to document element
 */
const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
};

export const useThemeStore = defineStore('themeStore', {
  state: () => ({
    theme: getInitialTheme(), // 'light' or 'dark'
    isSystemPreference: !localStorage.getItem(THEME_STORAGE_KEY), // true if no manual override
  }),

  getters: {
    isDark: (state) => state.theme === 'dark',
    isLight: (state) => state.theme === 'light',
  },

  actions: {
    /**
     * Initialize theme on app load
     */
    initialize() {
      const initialTheme = getInitialTheme();
      this.theme = initialTheme;
      this.isSystemPreference = !localStorage.getItem(THEME_STORAGE_KEY);
      applyTheme(initialTheme);
    },

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.isSystemPreference = false; // Manual override
      applyTheme(this.theme);
      
      // Persist to localStorage
      try {
        localStorage.setItem(THEME_STORAGE_KEY, this.theme);
      } catch (e) {
        console.warn('Failed to save theme to localStorage:', e);
      }
    },

    /**
     * Set theme explicitly
     */
    setTheme(theme) {
      if (theme !== 'light' && theme !== 'dark') {
        console.warn(`Invalid theme: ${theme}. Must be 'light' or 'dark'.`);
        return;
      }
      
      this.theme = theme;
      this.isSystemPreference = false; // Manual override
      applyTheme(this.theme);
      
      // Persist to localStorage
      try {
        localStorage.setItem(THEME_STORAGE_KEY, this.theme);
      } catch (e) {
        console.warn('Failed to save theme to localStorage:', e);
      }
    },

    /**
     * Reset to system preference
     */
    resetToSystemPreference() {
      const systemTheme = getSystemPreference();
      this.theme = systemTheme;
      this.isSystemPreference = true;
      applyTheme(this.theme);
      
      // Clear localStorage to allow system preference to control
      try {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear theme from localStorage:', e);
      }
    },
  },
});

