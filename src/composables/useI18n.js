// src/composables/useI18n.js
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18nStore } from '@/stores/i18nStore';

/**
 * Reactive translation helper.
 *
 * Usage in setup:
 *   const { t, locale } = useI18n()
 *   // template: {{ t('header.allProjects') }}
 */
export function useI18n() {
  const store = useI18nStore();
  const { locale } = storeToRefs(store);

  // Re-evaluates when locale changes because we read store.t (a getter that depends on state.locale).
  const t = (key, params) => store.t(key, params);

  return {
    t,
    locale,
    isEnglish: computed(() => locale.value === 'en'),
    isSpanish: computed(() => locale.value === 'es'),
    setLocale: (code) => store.setLocale(code),
    toggleLocale: () => store.toggleLocale(),
  };
}
