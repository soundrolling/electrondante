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

// --- Approximate currency conversion --------------------------------------
// Rates are expressed as "units of <code> per 1 USD". Conversion between any
// two currencies is a simple cross-rate. These are rough, for at-a-glance use.

// Bundled fallback so conversions work offline / before the first fetch.
const FALLBACK_USD_RATES = {
  USD: 1, GBP: 0.74, EUR: 0.86, CAD: 1.38, AUD: 1.40, NZD: 1.69,
  CHF: 0.79, JPY: 159, CNY: 6.79, INR: 95.8, SEK: 9.28, NOK: 9.26,
  DKK: 6.41, ZAR: 16.25, AED: 3.67,
}

const RATES_CACHE_KEY = 'currencyRatesUSD'
const RATES_TS_KEY = 'currencyRatesUpdatedAt'
const RATES_MAX_AGE_MS = 24 * 60 * 60 * 1000 // refresh at most once a day

const usdRates = ref({ ...FALLBACK_USD_RATES })
const ratesUpdatedAt = ref(null)

// Hydrate cached rates from a previous session (survives offline reloads).
try {
  const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY) || 'null')
  if (cached && typeof cached === 'object') {
    usdRates.value = { ...FALLBACK_USD_RATES, ...cached }
  }
  const ts = Number(localStorage.getItem(RATES_TS_KEY))
  if (ts) ratesUpdatedAt.value = ts
} catch { /* ignore corrupt cache */ }

let refreshInFlight = null

// Fetch fresh rates (keyless, CORS-open). Throttled to once a day unless forced;
// silently keeps existing/fallback rates if offline or the request fails.
export function refreshRates(force = false) {
  if (!force && ratesUpdatedAt.value && (Date.now() - ratesUpdatedAt.value) < RATES_MAX_AGE_MS) {
    return Promise.resolve()
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve()
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = fetch('https://open.er-api.com/v6/latest/USD')
    .then(res => res.json())
    .then(data => {
      if (data && data.result === 'success' && data.rates) {
        usdRates.value = { ...FALLBACK_USD_RATES, ...data.rates }
        ratesUpdatedAt.value = Date.now()
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(usdRates.value))
        localStorage.setItem(RATES_TS_KEY, String(ratesUpdatedAt.value))
      }
    })
    .catch(() => { /* keep existing/fallback rates */ })
    .finally(() => { refreshInFlight = null })

  return refreshInFlight
}

// Convert an amount between two currency codes. Returns null if either rate is
// unknown (caller should then just show the original amount).
export function convert(amount, from, to) {
  const a = Number(amount)
  if (!isFinite(a)) return null
  if (from === to) return a
  const f = usdRates.value[from]
  const t = usdRates.value[to]
  if (!f || !t) return null
  return a * (t / f)
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

  // Convert an amount into the user's preferred (view) currency.
  function convertToPreferred(amount, from) {
    return convert(amount, from, preferredCurrency.value)
  }

  // "≈ £85.00" style string in `to`, or '' if same currency / no rate available.
  function formatConverted(amount, from, to = preferredCurrency.value) {
    if (from === to) return ''
    const v = convert(amount, from, to)
    if (v == null) return ''
    return `≈ ${formatCurrency(v, to)}`
  }

  return {
    preferredCurrency,
    currencies: CURRENCIES,
    initFromProfile,
    setPreferredCurrency,
    currencySymbol,
    formatCurrency,
    // conversion
    usdRates,
    ratesUpdatedAt,
    refreshRates,
    convert,
    convertToPreferred,
    formatConverted,
  }
}
