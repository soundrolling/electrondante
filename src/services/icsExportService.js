/**
 * icsExportService.js
 *
 * Builds a standards-compliant iCalendar (RFC 5545) file from the
 * project's calendar_events + synthetic build/travel events so crew can
 * download a one-shot .ics or import into any calendar app.
 *
 * Timezones: the app stores event_date + HH:MM without an explicit
 * timezone, so we emit "floating time" (no TZID, no Z suffix). Every
 * major calendar client interprets that as local time on the viewer's
 * device — matches how tour schedules are typically read.
 */

const PRODID = '-//Soundrolling//Spatial Notes//EN'
const CRLF = '\r\n'

function escapeText(s) {
  if (s == null) return ''
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// "2025-12-11" -> "20251211"
function toDateStamp(ymd) {
  return String(ymd || '').replace(/-/g, '').slice(0, 8)
}

// "2025-12-11" + "09:30" -> "20251211T093000"
function toLocalDateTime(ymd, hhmm) {
  const date = toDateStamp(ymd)
  const t = String(hhmm || '00:00').replace(/:/g, '').slice(0, 4).padEnd(4, '0')
  return `${date}T${t}00`
}

// Add N days to a yyyy-mm-dd string
function addDays(ymd, days) {
  const d = new Date(ymd + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function nowStampUTC() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

// RFC 5545 says folded lines must be ≤75 octets. Good clients ignore this,
// but doing it right means the file validates and imports cleanly everywhere.
function foldLine(line) {
  if (line.length <= 75) return line
  const parts = []
  let i = 0
  parts.push(line.slice(0, 75))
  i = 75
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return parts.join(CRLF)
}

function isAllDay(ev) {
  const st = (ev.start_time || '').slice(0, 5)
  const et = (ev.end_time || '').slice(0, 5)
  if (!st && !et) return true
  if (st === '00:00' && (et === '23:59' || et === '00:00' || !et)) return true
  return false
}

function sameDate(a, b) {
  return (a || '').slice(0, 10) === (b || '').slice(0, 10)
}

function buildEventBlock(ev, { projectId, locationLabelById = {}, now }) {
  const lines = []
  const push = (s) => lines.push(foldLine(s))

  push('BEGIN:VEVENT')
  push(`UID:spn-${projectId || 'project'}-${ev.id}@soundrolling`)
  push(`DTSTAMP:${now}`)

  const startYmd = (ev.event_date || '').slice(0, 10)
  const endYmd = (ev.end_date || ev.event_date || '').slice(0, 10)

  if (isAllDay(ev)) {
    // RFC 5545 requires DTEND to be the day AFTER the last included day
    // for all-day events.
    const exclusiveEnd = addDays(endYmd || startYmd, 1)
    push(`DTSTART;VALUE=DATE:${toDateStamp(startYmd)}`)
    push(`DTEND;VALUE=DATE:${toDateStamp(exclusiveEnd)}`)
  } else {
    push(`DTSTART:${toLocalDateTime(startYmd, ev.start_time)}`)
    const eEnd = ev.end_time || ev.start_time
    // If end_date is missing and the event crosses midnight, fall back to start date
    const effectiveEndYmd = endYmd || startYmd
    push(`DTEND:${toLocalDateTime(effectiveEndYmd, eEnd)}`)
  }

  if (ev.title) push(`SUMMARY:${escapeText(ev.title)}`)
  if (ev.category) push(`CATEGORIES:${escapeText(ev.category)}`)
  const loc = ev.location_id ? locationLabelById[ev.location_id] : null
  if (loc) push(`LOCATION:${escapeText(loc)}`)

  const desc = []
  if (ev.notes) desc.push(ev.notes)
  if (ev.isSynthetic) desc.push('(auto-generated)')
  if (desc.length) push(`DESCRIPTION:${escapeText(desc.join('\n'))}`)

  // Synthetic events shouldn't be editable on the subscriber's side
  if (ev.isSynthetic) push('STATUS:CONFIRMED')

  push('END:VEVENT')
  return lines.join(CRLF)
}

/**
 * @param {Object} opts
 * @param {string} opts.calName        Calendar name shown in the client (e.g. "SOUND STORM 2025 · TUNNEL")
 * @param {string} opts.projectId      Used for stable UIDs
 * @param {Array}  opts.events         Array of calendar events (including synthetic)
 * @param {Array}  [opts.locations]    Array of { id, venue_name, stage_name } for LOCATION lookup
 *
 * @returns {string}  Full ICS text ready to write to a .ics file.
 */
export function buildCalendarICS({ calName, projectId, events = [], locations = [] }) {
  const locationLabelById = {}
  for (const l of locations) {
    if (!l || !l.id) continue
    const parts = [l.venue_name, l.stage_name].filter(Boolean)
    locationLabelById[l.id] = parts.join(' · ')
  }

  const now = nowStampUTC()
  const out = []
  const push = (s) => out.push(foldLine(s))

  push('BEGIN:VCALENDAR')
  push(`PRODID:${PRODID}`)
  push('VERSION:2.0')
  push('CALSCALE:GREGORIAN')
  push('METHOD:PUBLISH')
  if (calName) push(`X-WR-CALNAME:${escapeText(calName)}`)
  push(`X-WR-CALDESC:${escapeText('Soundrolling production schedule')}`)

  for (const ev of events) {
    if (!ev || !ev.event_date) continue
    out.push(buildEventBlock(ev, { projectId, locationLabelById, now }))
  }

  push('END:VCALENDAR')
  return out.join(CRLF) + CRLF
}

function safeFilename(stem) {
  return (
    String(stem || 'calendar')
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'calendar'
  ) + '.ics'
}

/**
 * One-shot download from the browser.
 */
export function downloadCalendarICS(opts) {
  const ics = buildCalendarICS(opts)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const fname = safeFilename(opts.calName || 'show-calendar')
  const a = document.createElement('a')
  a.href = url
  a.download = fname
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { filename: fname, bytes: ics.length }
}
