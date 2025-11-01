/**
 * Weight conversion utilities
 * Database stores weight in kg, but UI can display/input in kg or lbs
 */

// Conversion constants
const KG_TO_LBS = 2.20462
const LBS_TO_KG = 0.453592

/**
 * Convert kg to lbs
 */
export function kgToLbs(kg) {
  if (!kg || isNaN(kg)) return null
  return Number((Number(kg) * KG_TO_LBS).toFixed(2))
}

/**
 * Convert lbs to kg
 */
export function lbsToKg(lbs) {
  if (!lbs || isNaN(lbs)) return null
  return Number((Number(lbs) * LBS_TO_KG).toFixed(2))
}

/**
 * Format weight with conversion
 * @param {number} weightKg - Weight in kg (from database)
 * @param {string} primaryUnit - 'kg' or 'lbs'
 * @returns {string} Formatted weight string like "1.00 kg (2.20 lbs)"
 */
export function formatWeight(weightKg, primaryUnit = 'kg') {
  if (!weightKg || weightKg === 0 || isNaN(weightKg)) return '0.00 kg (0.00 lbs)'
  
  const weight = Number(weightKg)
  
  if (primaryUnit === 'lbs') {
    const lbs = kgToLbs(weight)
    return `${lbs} lbs (${weight.toFixed(2)} kg)`
  } else {
    const lbs = kgToLbs(weight)
    return `${weight.toFixed(2)} kg (${lbs} lbs)`
  }
}

/**
 * Get weight unit preference from localStorage
 * @returns {string} 'kg' or 'lbs'
 */
export function getWeightUnit() {
  const stored = localStorage.getItem('weightUnit')
  return stored === 'lbs' ? 'lbs' : 'kg'
}

/**
 * Set weight unit preference in localStorage
 * @param {string} unit - 'kg' or 'lbs'
 */
export function setWeightUnit(unit) {
  localStorage.setItem('weightUnit', unit === 'lbs' ? 'lbs' : 'kg')
}

/**
 * Convert input value to kg based on unit
 * @param {number} value - Input value
 * @param {string} unit - 'kg' or 'lbs'
 * @returns {number} Weight in kg
 */
export function convertInputToKg(value, unit) {
  if (!value || isNaN(value)) return null
  return unit === 'lbs' ? lbsToKg(value) : Number(value)
}

