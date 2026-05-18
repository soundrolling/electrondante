// src/stores/i18nStore.js

import { defineStore } from 'pinia';
import en from '@/locales/en';
import es from '@/locales/es';
import { createLogger } from '@/utils/log'

const log = createLogger('i18nStore')

const LOCALE_STORAGE_KEY = 'app-locale';
const SUPPORTED = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

const messages = { en, es };

const getInitialLocale = () => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch (e) {
    // ignore
  }
  return DEFAULT_LOCALE;
};

const applyLocaleAttr = (locale) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('lang', locale);
};

export const useI18nStore = defineStore('i18nStore', {
  state: () => ({
    locale: getInitialLocale(),
    supportedLocales: SUPPORTED.slice(),
  }),

  getters: {
    isEnglish: (state) => state.locale === 'en',
    isSpanish: (state) => state.locale === 'es',
    /**
     * Translation getter — returns a function so callers do `t('key', { n: 5 })`.
     * Supports {placeholder} interpolation. Falls back to English if the key is
     * missing in the active locale, then to the key itself if also missing in English.
     */
    t: (state) => (key, params) => {
      if (!key) return '';
      const dict = messages[state.locale] || messages[DEFAULT_LOCALE];
      let raw;
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        raw = dict[key];
      } else {
        const fallback = messages[DEFAULT_LOCALE];
        raw = fallback && Object.prototype.hasOwnProperty.call(fallback, key)
          ? fallback[key]
          : key;
      }
      if (params && typeof raw === 'string') {
        return raw.replace(/\{(\w+)\}/g, (match, name) =>
          Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
        );
      }
      return raw;
    },
  },

  actions: {
    initialize() {
      const initial = getInitialLocale();
      this.locale = initial;
      applyLocaleAttr(initial);
    },

    setLocale(locale) {
      if (!SUPPORTED.includes(locale)) {
        log.warn(`Unsupported locale "${locale}". Supported: ${SUPPORTED.join(', ')}`);
        return;
      }
      this.locale = locale;
      applyLocaleAttr(locale);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch (e) {
        log.warn('Failed to persist locale:', e);
      }
    },

    toggleLocale() {
      this.setLocale(this.locale === 'en' ? 'es' : 'en');
    },
  },
});
