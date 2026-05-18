import { describe, it, expect, beforeEach } from 'vitest'
import {
  kgToLbs,
  lbsToKg,
  formatWeight,
  convertInputToKg,
  getWeightUnit,
  setWeightUnit,
} from './weightUtils'

describe('weightUtils', () => {
  describe('kgToLbs', () => {
    it('converts whole kg to lbs and rounds to 2dp', () => {
      expect(kgToLbs(1)).toBe(2.2)
      expect(kgToLbs(10)).toBe(22.05)
    })

    it('returns null for invalid input', () => {
      expect(kgToLbs(null)).toBeNull()
      expect(kgToLbs(undefined)).toBeNull()
      expect(kgToLbs(0)).toBeNull()
      expect(kgToLbs('not a number')).toBeNull()
    })
  })

  describe('lbsToKg', () => {
    it('round-trips approximately back to kg', () => {
      const kg = 5
      const lbs = kgToLbs(kg)
      const back = lbsToKg(lbs)
      expect(back).toBeCloseTo(kg, 1)
    })

    it('returns null for null or NaN input', () => {
      expect(lbsToKg(null)).toBeNull()
      expect(lbsToKg(NaN)).toBeNull()
    })
  })

  describe('convertInputToKg', () => {
    it('passes kg through as a Number', () => {
      expect(convertInputToKg('3', 'kg')).toBe(3)
    })

    it('converts lbs input to kg', () => {
      expect(convertInputToKg(10, 'lbs')).toBeCloseTo(4.54, 2)
    })

    it('returns null for empty / invalid input', () => {
      expect(convertInputToKg(null, 'kg')).toBeNull()
      expect(convertInputToKg('', 'kg')).toBeNull()
    })
  })

  describe('formatWeight', () => {
    it('shows kg primary with lbs in parentheses by default', () => {
      const result = formatWeight(1)
      expect(result).toMatch(/kg/)
      expect(result).toMatch(/\(.*(lb|oz).*\)/)
    })

    it('respects lbs primary unit', () => {
      const result = formatWeight(1, 'lbs')
      expect(result).toMatch(/^[0-9]/)
      expect(result).toMatch(/\(.*kg/)
    })

    it('returns a zero-with-conversion string for 0/null', () => {
      expect(formatWeight(0)).toMatch(/0g/)
      expect(formatWeight(null)).toMatch(/0g/)
      expect(formatWeight(0, 'lbs')).toMatch(/0 oz/)
    })
  })

  describe('getWeightUnit / setWeightUnit', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('defaults to kg when nothing stored', () => {
      expect(getWeightUnit()).toBe('kg')
    })

    it('round-trips lbs through localStorage', () => {
      setWeightUnit('lbs')
      expect(getWeightUnit()).toBe('lbs')
    })

    it('coerces invalid units to kg', () => {
      setWeightUnit('garbage')
      expect(getWeightUnit()).toBe('kg')
    })
  })
})
