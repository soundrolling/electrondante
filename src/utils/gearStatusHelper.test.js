import { describe, it, expect } from 'vitest'
import { statusBadgeForGear, formatHumanDate, computeUserGearStatus } from './gearStatusHelper'

describe('statusBadgeForGear', () => {
  it('maps every known status to a label/tone', () => {
    const cases = ['archived', 'maintenance', 'unavailable', 'conflict', 'in_use', 'partial', 'reserved', 'available']
    for (const status of cases) {
      const badge = statusBadgeForGear({ status })
      expect(badge.label).toBeTruthy()
      expect(['muted', 'warning', 'danger', 'info', 'accent', 'success']).toContain(badge.tone)
    }
  })

  it('falls back to "Available" for unknown / missing status', () => {
    expect(statusBadgeForGear(undefined).label).toBe('Available')
    expect(statusBadgeForGear({}).label).toBe('Available')
    expect(statusBadgeForGear({ status: 'totally-bogus' }).label).toBe('Available')
  })

  it('keeps an icon glyph for every status', () => {
    expect(statusBadgeForGear({ status: 'archived' }).icon).toBeTruthy()
    expect(statusBadgeForGear({ status: 'in_use' }).icon).toBeTruthy()
  })
})

describe('formatHumanDate', () => {
  it('returns an empty string for falsy input', () => {
    expect(formatHumanDate(null)).toBe('')
    expect(formatHumanDate('')).toBe('')
    expect(formatHumanDate(undefined)).toBe('')
  })

  it('renders an ISO date as a human string', () => {
    const out = formatHumanDate('2026-05-22')
    // Don't pin a specific locale — just check it contains the year and isn't the raw ISO.
    expect(out).toMatch(/2026/)
    expect(out).not.toBe('2026-05-22')
  })

  it('echoes back an unparseable input', () => {
    expect(formatHumanDate('not-a-date')).toBe('not-a-date')
  })
})

describe('computeUserGearStatus', () => {
  it('returns an empty map for an empty list', async () => {
    // No supabase calls happen when the gear list is empty.
    const result = await computeUserGearStatus([], { supabase: null })
    expect(result).toEqual({})
  })

  it('returns an empty map when gearList is not an array', async () => {
    const result = await computeUserGearStatus(null, { supabase: null })
    expect(result).toEqual({})
  })
})
