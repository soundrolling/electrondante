// Helper functions for schedule components

export function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function niceDate(d) {
  return d ? new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : ''
}

export function t5(t) {
  return t ? t.slice(0, 5) : ''
}

export function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function toDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  return new Date(`${dateStr}T${timeStr}`)
}

export function getTodayTime(timeStr) {
  if (!timeStr) return null
  const [h, m, s] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, s || 0, 0)
  return d
}

export function getDateTimeISO(date, time) {
  if (!date || !time) return ''
  return date + 'T' + time
}

export function pad2(n) {
  return n.toString().padStart(2, '0')
}

