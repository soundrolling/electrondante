/**
 * calendarShareService.js
 *
 * Manages the per-project token used by the calendar-ics edge function
 * to serve a public iCal subscribe URL.
 *
 * Rows live in the `project_calendar_shares` table. RLS lets the
 * project owner list / insert / update their own rows; the edge function
 * uses the service role to look up tokens from anonymous requests.
 */

import { supabase } from '@/supabase'
import { createLogger } from '@/utils/log'

const log = createLogger('calendarShareService')

function generateToken() {
  const bytes = new Uint8Array(24)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // base64url (no padding) — 32 chars
  let b64 = btoa(String.fromCharCode(...bytes))
  b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64
}

function envSupabaseBaseUrl() {
  // Use the same origin the supabase client was configured with.
  try {
    const url = supabase?.supabaseUrl || ''
    return url.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function buildSubscribeUrl(token) {
  const base = envSupabaseBaseUrl()
  if (!base || !token) return ''
  return `${base}/functions/v1/calendar-ics?token=${encodeURIComponent(token)}`
}

/**
 * Fetch the current active share row for a project (non-revoked).
 * Returns null if none exists.
 */
export async function getActiveShare(projectId) {
  if (!projectId) return null
  const { data, error } = await supabase
    .from('project_calendar_shares')
    .select('id, token, revoked, created_at')
    .eq('project_id', projectId)
    .eq('revoked', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    log.error('[calendarShareService] getActiveShare', error)
    return null
  }
  return data || null
}

/**
 * Create a brand new token, revoking any prior active one so a given
 * project only ever has a single live subscribe URL.
 */
export async function createShare(projectId, userId = null) {
  if (!projectId) throw new Error('projectId required')

  // Soft-revoke any existing non-revoked tokens for this project
  await supabase
    .from('project_calendar_shares')
    .update({ revoked: true })
    .eq('project_id', projectId)
    .eq('revoked', false)

  const token = generateToken()
  const { data, error } = await supabase
    .from('project_calendar_shares')
    .insert({ project_id: projectId, token, created_by: userId || null })
    .select('id, token, revoked, created_at')
    .single()
  if (error) throw error
  return data
}

/**
 * Revoke the currently active token. Subscribers 404 on the next poll.
 */
export async function revokeActiveShare(projectId) {
  if (!projectId) return false
  const { error } = await supabase
    .from('project_calendar_shares')
    .update({ revoked: true })
    .eq('project_id', projectId)
    .eq('revoked', false)
  if (error) {
    log.error('[calendarShareService] revokeActiveShare', error)
    return false
  }
  return true
}

/**
 * Calendar apps accept `webcal://` links as an auto-detected subscribe
 * scheme. Same URL, different prefix.
 */
export function toWebcalUrl(httpsUrl) {
  if (!httpsUrl) return ''
  return httpsUrl.replace(/^https?:\/\//, 'webcal://')
}
