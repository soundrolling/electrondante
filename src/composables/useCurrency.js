// src/composables/useCurrency.js

import { ref } from 'vue'

// Default currency used when a user/expense has no currency set.
export const DEFAULT_CURRENCY = 'GBP'

// Common travel currencies offered in the pickers. `code` is what we store;
// `symbol` is a short label for compact dropdowns.
export const CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
]

// Module-level state (singleton pattern) - shared across all component instances
const preferredCurrency = ref(DEFAULT_CURRENCY)

// Initialize from localStorage on module load (fast, offline-friendly default)
const stored = localStorage.getItem('preferredCurrency')
if (stored) preferredCurrency.value = stored

// Look up the short symbol for a currency code.
export function currencySymbol(code) {
  const c = CURRENCIES.find(x => x.code === code)
  return c ? c.symbol : (code || '')
}

// Format an amount with the correct currency symbol/placement.
// Uses Intl when possible, falling back to "<symbol><amount>" for unknown codes.
export function formatCurrency(amount, code = DEFAULT_CURRENCY) {
  const num = Number(amount) || 0
  const currency = code || DEFAULT_CURRENCY
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(num)
  } catch {
    return `${currencySymbol(currency)}${num.toFixed(2)}`
  }
}

export function useCurrency() {
  // Initialize from profile (called by userStore after fetching profile)
  function initFromProfile(profile) {
    if (profile?.preferred_currency) {
      preferredCurrency.value = profile.preferred_currency
      localStorage.setItem('preferredCurrency', profile.preferred_currency)
    }
  }

  // Set and persist to localStorage (caller saves to Supabase separately)
  function setPreferredCurrency(code) {
    if (!code) return
    preferredCurrency.value = code
    localStorage.setItem('preferredCurrency', code)
  }

  return {
    preferredCurrency,
    currencies: CURRENCIES,
    initFromProfile,
    setPreferredCurrency,
    currencySymbol,
    formatCurrency,
  }
}
