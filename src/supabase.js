// src/supabase.js
import { createClient } from '@supabase/supabase-js'
import { config, validateConfig } from './config'

const URL              = config.supabase.url
const ANON_KEY         = config.supabase.anonKey
const SERVICE_ROLE_KEY = config.supabase.serviceRoleKey

// Validate configuration before proceeding
if (!validateConfig()) {
  throw new Error('Supabase configuration validation failed. Check your environment variables.')
}

// Debug: verify env-vars in the browser console
console.log('✅ URL:', URL)
console.log('✅ ANON_KEY loaded?', !!ANON_KEY)
console.log('✅ ANON_KEY length:', ANON_KEY ? ANON_KEY.length : 0)
// Avoid leaking service role info in the browser
if (typeof window === 'undefined') {
  console.log('✅ SERVICE_ROLE_KEY loaded?', !!SERVICE_ROLE_KEY)
}

// Public (anon) client
export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // we handle URL tokens manually
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
  global: {
    headers: { 'X-Client-Info': 'supabase-js/2.x' },
    timeout: 20000,
  },
})

// Admin (service-role) client for RLS-bypassing operations
// Only instantiate admin client in server environments (never in the browser)
export const adminClient = (typeof window === 'undefined' && SERVICE_ROLE_KEY)
  ? createClient(URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'X-Client-Info': 'supabase-js/2.x (admin)' },
        timeout: 20000,
      },
    })
  : null

if (typeof window === 'undefined') {
  console.log('→ adminClient ready?', !!adminClient)
}

// Clean up localStorage and redirect on sign-out
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    window.localStorage.removeItem('supabase.auth.token')
    window.location.href = '/'
  }
})

/**
 * Call this from main.js before mounting to:
 *  • parse magic-link (type=email) or invite (type=invite) tokens,
 *    or PKCE/reset tokens in hash,
 *  • restore the session,
 *  • then (for invites) redirect into your set-password page.
 */
export async function restoreSessionFromUrl() {
  const { hash, search, pathname } = window.location
  const qs = new URLSearchParams(search)

  // Magic-link (email) or Invite flow
  const tokenHash = qs.get('token_hash')
  const type      = qs.get('type')  // 'email', 'recovery', or 'invite'
  if (tokenHash && (type === 'email' || type === 'invite')) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type, // pass through 'email' or 'invite'
    })
    if (error) {
      console.error('verifyOtp error:', error.message)
    } else if (type === 'invite') {
      // After verifying invite, send user to set-password page
      window.location.href = window.location.origin + '/auth/set-password'
      return
    }
  }
  // Implicit/PKCE or password-reset flow (access_token in hash)
  else if (hash.startsWith('#')) {
    const params        = new URLSearchParams(hash.substring(1))
    const access_token  = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (error) console.error('setSession error:', error.message)
    }
  }

  // Remove tokens from URL so they don’t get processed again
  window.history.replaceState({}, '', pathname)
}