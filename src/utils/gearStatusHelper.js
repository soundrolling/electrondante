/**
 * Gear status / availability helper
 *
 * Given a set of user_gear items, computes per-item status across all the
 * projects that have ever requested the gear: where it's being used right
 * now, when it auto-releases, and whether any overlapping projects conflict.
 */

import { getAllProjectDates, datesOverlap } from './gearConflictHelper'
import { createLogger } from '@/utils/log'

const log = createLogger('gearStatusHelper')

const PROJECT_DATE_FIELDS = 'id, project_name, build_days, main_show_days'

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function compareIsoDates(a, b) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

function minDate(dates) {
  return dates.reduce((acc, d) => (acc === null || d < acc ? d : acc), null)
}

function maxDate(dates) {
  return dates.reduce((acc, d) => (acc === null || d > acc ? d : acc), null)
}

function addDays(isoDate, n) {
  if (!isoDate) return null
  const dt = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return null
  dt.setDate(dt.getDate() + n)
  return toIsoDate(dt)
}

/**
 * Determine whether a project is currently active (today falls within its dates).
 */
function projectActiveOn(project, todayIso) {
  const dates = getAllProjectDates(project)
  if (!dates.length) return false
  return dates.includes(todayIso)
}

/**
 * Build a usage record for a project-gear assignment.
 */
function buildUsage(project, assignedAmount, todayIso, stages = [], totalGearAmount = 0) {
  const dates = getAllProjectDates(project).sort()
  const firstDate = minDate(dates)
  const lastDate = maxDate(dates)
  const isActiveNow = !!todayIso && dates.includes(todayIso)
  const isUpcoming = !!firstDate && !!todayIso && firstDate > todayIso
  const isPast = !!lastDate && !!todayIso && lastDate < todayIso
  return {
    project_id: project.id,
    project_name: project.project_name || 'Untitled project',
    dates,
    first_date: firstDate,
    last_date: lastDate,
    auto_release_date: addDays(lastDate, 1),
    assigned_amount: assignedAmount,
    total_amount: totalGearAmount,
    stages, // [{ location_id, stage_name, venue_name, amount }]
    is_active_now: isActiveNow,
    is_upcoming: isUpcoming,
    is_past: isPast
  }
}

/**
 * Compute conflicts between concurrent project usages.
 * Two usages conflict when their date sets overlap on any day.
 */
function computeConflicts(usages) {
  const conflicts = []
  for (let i = 0; i < usages.length; i += 1) {
    for (let j = i + 1; j < usages.length; j += 1) {
      const a = usages[i]
      const b = usages[j]
      if (datesOverlap(a.dates, b.dates)) {
        const overlapping = a.dates.filter(d => b.dates.includes(d))
        conflicts.push({
          project_a: { id: a.project_id, name: a.project_name },
          project_b: { id: b.project_id, name: b.project_name },
          overlapping_dates: overlapping
        })
      }
    }
  }
  return conflicts
}

/**
 * Fetch all usages (gear_table rows + their parent projects + assignments) for
 * the given user_gear ids in a single round trip.
 *
 * Returns a map: { [userGearId]: Array<{ project, gearTableId, assignedAmount }> }
 */
async function fetchUsagesByUserGear(userGearIds, supabase) {
  if (!userGearIds.length) return {}

  const { data: gearRows, error: gearError } = await supabase
    .from('gear_table')
    .select('id, user_gear_id, project_id, gear_amount')
    .in('user_gear_id', userGearIds)
    .not('user_gear_id', 'is', null)

  if (gearError) {
    log.warn('[gearStatusHelper] Failed to fetch gear_table usage rows:', gearError)
    return {}
  }
  if (!gearRows?.length) return {}

  const projectIds = [...new Set(gearRows.map(g => g.project_id).filter(Boolean))]
  const gearTableIds = gearRows.map(g => g.id)

  const [projectsRes, assignmentsRes] = await Promise.all([
    supabase.from('projects').select(PROJECT_DATE_FIELDS).in('id', projectIds),
    supabase
      .from('gear_assignments')
      .select('gear_id, assigned_amount, location_id')
      .in('gear_id', gearTableIds)
  ])

  if (projectsRes.error) {
    log.warn('[gearStatusHelper] Failed to fetch projects for usage:', projectsRes.error)
  }
  if (assignmentsRes.error) {
    log.warn('[gearStatusHelper] Failed to fetch assignments for usage:', assignmentsRes.error)
  }

  // Resolve stage/venue names for the locations referenced by the
  // assignment rows so the tile pill can show "Main stage (10)".
  const locationIds = [
    ...new Set((assignmentsRes.data || [])
      .map(a => a.location_id)
      .filter(Boolean))
  ]
  let locationById = {}
  if (locationIds.length) {
    const { data: locations, error: locErr } = await supabase
      .from('locations')
      .select('id, stage_name, venue_name')
      .in('id', locationIds)
    if (locErr) {
      log.warn('[gearStatusHelper] Failed to fetch locations for assignments:', locErr)
    } else {
      for (const l of locations || []) locationById[l.id] = l
    }
  }

  const projectById = {}
  for (const p of projectsRes.data || []) projectById[p.id] = p

  const assignedByGearTable = {}
  const stagesByGearTable = {}
  for (const a of assignmentsRes.data || []) {
    const amt = Number(a.assigned_amount) || 0
    assignedByGearTable[a.gear_id] = (assignedByGearTable[a.gear_id] || 0) + amt
    if (!stagesByGearTable[a.gear_id]) stagesByGearTable[a.gear_id] = []
    const loc = a.location_id ? locationById[a.location_id] : null
    stagesByGearTable[a.gear_id].push({
      location_id: a.location_id || null,
      stage_name: loc?.stage_name || null,
      venue_name: loc?.venue_name || null,
      amount: amt
    })
  }

  const result = {}
  for (const row of gearRows) {
    if (!row.user_gear_id) continue
    const project = projectById[row.project_id]
    if (!project) continue
    const list = result[row.user_gear_id] || []
    list.push({
      project,
      gearTableId: row.id,
      assignedAmount: assignedByGearTable[row.id] ?? row.gear_amount ?? 0,
      stages: stagesByGearTable[row.id] || [],
      totalAmount: Number(row.gear_amount) || 0
    })
    result[row.user_gear_id] = list
  }

  return result
}

/**
 * Public API: compute per-gear status for a list of user_gear items.
 *
 * @param {Array} gearList - user_gear rows (must include id, quantity)
 * @param {Object} options
 * @param {Object} options.supabase - Supabase client
 * @param {Object} [options.currentProject] - When in project context: highlight
 *   conflicts vs this project's dates.
 * @param {Date}   [options.today=new Date()]
 * @returns {Promise<Object>} map keyed by user_gear id
 */
export async function computeUserGearStatus(gearList, { supabase, currentProject = null, today = new Date() } = {}) {
  const out = {}
  if (!Array.isArray(gearList) || gearList.length === 0) return out

  const todayIso = toIsoDate(today)
  const currentProjectDates = currentProject ? getAllProjectDates(currentProject) : []

  const userGearIds = gearList.map(g => g.id).filter(Boolean)
  const usagesByGear = await fetchUsagesByUserGear(userGearIds, supabase)

  for (const item of gearList) {
    const rawUsages = usagesByGear[item.id] || []
    const usages = rawUsages
      .map(u => buildUsage(u.project, u.assignedAmount, todayIso, u.stages, u.totalAmount))
      .filter(u => u.dates.length > 0 || u.assigned_amount > 0 || u.total_amount > 0)
      .sort((a, b) => compareIsoDates(a.first_date, b.first_date))

    const currentUsages = usages.filter(u => u.is_active_now)
    const upcomingUsages = usages.filter(u => u.is_upcoming)
    const totalAssigned = usages.reduce((sum, u) => sum + (u.assigned_amount || 0), 0)
    const currentlyAssigned = currentUsages.reduce((sum, u) => sum + (u.assigned_amount || 0), 0)

    // Auto-release = earliest "free again" date among currently-active usages
    const autoReleaseDate = currentUsages.length
      ? currentUsages
          .map(u => u.auto_release_date)
          .filter(Boolean)
          .sort()
          .shift() || null
      : null

    // Next available date if currently in use:
    //  - the date right after every current usage ends
    const nextAvailableDate = currentUsages.length
      ? (() => {
          const releases = currentUsages.map(u => u.auto_release_date).filter(Boolean).sort()
          return releases.length ? releases[releases.length - 1] : null
        })()
      : null

    const conflicts = computeConflicts(usages)

    // Conflict vs the project we are currently viewing (the "Mine / Team Gear" case).
    // We also track how many units are tied up during the overlap so the qty
    // picker can cap at (total - reserved-during-overlap) instead of letting
    // the user double-book.
    let conflictWithCurrent = null
    let reservedDuringCurrent = 0
    if (currentProject && currentProjectDates.length) {
      const overlapping = usages.filter(u =>
        u.project_id !== currentProject.id && datesOverlap(currentProjectDates, u.dates)
      )
      if (overlapping.length) {
        conflictWithCurrent = overlapping.map(u => ({
          project_id: u.project_id,
          project_name: u.project_name,
          overlapping_dates: currentProjectDates.filter(d => u.dates.includes(d)),
          auto_release_date: u.auto_release_date,
          last_date: u.last_date,
          assigned_amount: u.assigned_amount,
          total_amount: u.total_amount,
          stages: u.stages
        }))
        reservedDuringCurrent = overlapping.reduce(
          (sum, u) => sum + (Number(u.total_amount) || Number(u.assigned_amount) || 0),
          0
        )
      }
    }

    const totalQty = item.quantity || 0
    const availableNow = Math.max(0, totalQty - currentlyAssigned)
    const availableForCurrent = currentProject
      ? Math.max(0, totalQty - reservedDuringCurrent)
      : totalQty

    // Status priority:
    //   1. Archived (soft-deleted) — explicit user action, overrides everything.
    //   2. Maintenance — explicit user state, set in the gear form.
    //   3. Conflict / in_use / partial / reserved — computed from project usage.
    //   4. Available — default.
    //
    // We intentionally ignore the legacy `availability === 'unavailable'` value
    // here: it used to be auto-set by old code paths when assigned_quantity hit
    // total quantity, but it was never auto-reset when projects ended, so it
    // would stick around indefinitely and lie about real availability. The
    // archived_at column now covers the "I don't own this anymore" case.
    let statusLabel = 'available'
    if (item.archived_at) statusLabel = 'archived'
    else if (item.availability === 'maintenance') statusLabel = 'maintenance'
    else if (conflicts.length > 0) statusLabel = 'conflict'
    else if (currentUsages.length > 0 && availableNow === 0) statusLabel = 'in_use'
    else if (currentUsages.length > 0) statusLabel = 'partial'
    else if (upcomingUsages.length > 0) statusLabel = 'reserved'

    out[item.id] = {
      total_quantity: totalQty,
      currently_assigned: currentlyAssigned,
      total_assigned: totalAssigned,
      available_now: availableNow,
      available_for_current: availableForCurrent,
      reserved_during_current: reservedDuringCurrent,
      usages,
      current_usages: currentUsages,
      upcoming_usages: upcomingUsages,
      conflicts,
      conflict_with_current: conflictWithCurrent,
      auto_release_date: autoReleaseDate,
      next_available_date: nextAvailableDate,
      status: statusLabel
    }
  }

  return out
}

/**
 * Format a status label for display, with a human-friendly badge config.
 */
export function statusBadgeForGear(status) {
  switch (status?.status) {
    case 'archived':
      return { label: 'Archived', tone: 'muted', icon: '📦' }
    case 'maintenance':
      return { label: 'Maintenance', tone: 'warning', icon: '🛠️' }
    case 'unavailable':
      // Retained for backwards compatibility (legacy stored values) but should
      // not be produced by computeUserGearStatus going forward.
      return { label: 'Unavailable', tone: 'muted', icon: '⛔' }
    case 'conflict':
      return { label: 'Conflict', tone: 'danger', icon: '⚠️' }
    case 'in_use':
      return { label: 'In use', tone: 'info', icon: '🔒' }
    case 'partial':
      return { label: 'Partly in use', tone: 'info', icon: '◐' }
    case 'reserved':
      return { label: 'Reserved', tone: 'accent', icon: '📅' }
    case 'available':
    default:
      return { label: 'Available', tone: 'success', icon: '✓' }
  }
}

/**
 * Short, friendly human date (e.g. "May 22, 2026").
 */
export function formatHumanDate(iso) {
  if (!iso) return ''
  const dt = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
