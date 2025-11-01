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
 * Format weight in human-readable format (kg + g or lbs + oz)
 * @param {number} weightKg - Weight in kg
 * @param {boolean} isPrimary - If true, this is the primary unit; if false, show as conversion
 * @returns {string} Formatted string like "1 kg + 200g" or "2 lbs + 3.2 oz"
 */
function formatWeightSmart(weightKg, isPrimary = true) {
  if (!weightKg || weightKg === 0 || isNaN(weightKg)) {
    return isPrimary ? '0g' : '0 oz'
  }
  
  const weight = Number(weightKg)
  
  if (isPrimary) {
    // Format in metric (kg + g)
    const kgPart = Math.floor(weight)
    const gPart = Math.round((weight - kgPart) * 1000)
    
    if (kgPart === 0 && gPart === 0) {
      return '0g'
    } else if (kgPart === 0) {
      return `${gPart}g`
    } else if (gPart === 0) {
      return `${kgPart} kg`
    } else {
      return `${kgPart} kg + ${gPart}g`
    }
  } else {
    // Format in imperial (lbs + oz)
    const weightLbs = kgToLbs(weight)
    const lbsPart = Math.floor(weightLbs)
    const ozPart = (weightLbs - lbsPart) * 16
    
    if (lbsPart === 0 && ozPart < 0.1) {
      return '0 oz'
    } else if (lbsPart === 0) {
      return `${ozPart.toFixed(1)} oz`
    } else if (ozPart < 0.1) {
      return `${lbsPart} lb`
    } else {
      return `${lbsPart} lb + ${ozPart.toFixed(1)} oz`
    }
  }
}

/**
 * Format weight with conversion
 * @param {number} weightKg - Weight in kg (from database)
 * @param {string} primaryUnit - 'kg' or 'lbs'
 * @returns {string} Formatted weight string like "1 kg + 200g (2 lb + 3.2 oz)"
 */
export function formatWeight(weightKg, primaryUnit = 'kg') {
  if (!weightKg || weightKg === 0 || isNaN(weightKg)) {
    if (primaryUnit === 'lbs') {
      return '0 oz (0g)'
    } else {
      return '0g (0 oz)'
    }
  }
  
  const weight = Number(weightKg)
  
  if (primaryUnit === 'lbs') {
    const primary = formatWeightSmart(weight, false) // Format in lbs/oz
    const secondary = formatWeightSmart(weight, true) // Format in kg/g
    return `${primary} (${secondary})`
  } else {
    const primary = formatWeightSmart(weight, true) // Format in kg/g
    const secondary = formatWeightSmart(weight, false) // Format in lbs/oz
    return `${primary} (${secondary})`
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

