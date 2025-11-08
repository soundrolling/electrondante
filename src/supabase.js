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
// NOTE: This is not used in the frontend - user invitations are handled via Edge Functions
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
 *  • parse invite (type=invite) or recovery (type=recovery) tokens,
 *    or PKCE/reset tokens in hash,
 *  • restore the session,
 *  • then (for invites/recovery) redirect into your set-password page.
 */
export async function restoreSessionFromUrl() {
  const { hash, search, pathname } = window.location
  const qs = new URLSearchParams(search)

  // Invite or Recovery (password reset) flow
  const tokenHash = qs.get('token_hash')
  const type      = qs.get('type')  // 'recovery' or 'invite'
  if (tokenHash && (type === 'invite' || type === 'recovery')) {
    console.log('🔍 Found token_hash in URL, verifying OTP...', { type, hasTokenHash: !!tokenHash })
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type, // pass through 'invite' or 'recovery'
    })
    if (error) {
      console.error('❌ verifyOtp error:', error.message)
      console.error('❌ Error details:', error)
      // Don't continue if verification fails - let SetPassword.vue handle it
      return
    }
    
    // Verify session was established
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr || !sessionData?.session) {
      console.error('❌ Session not established after verifyOtp')
      return
    }
    
    console.log('✅ Token verified and session established')
    
    // After verifying invite or recovery, session is now established
    // Only redirect if we're not already on the set-password page
    const isOnSetPasswordPage = pathname === '/auth/set-password'
    if (!isOnSetPasswordPage) {
      // Redirect to set-password page (session will be available there)
      console.log('🔄 Redirecting to set-password page')
      window.location.href = window.location.origin + '/auth/set-password'
      return
    }
    // If already on set-password page, just clean up the URL
    // The session is established, SetPassword.vue will detect it
    console.log('✅ Already on set-password page, cleaning up URL')
    window.history.replaceState({}, '', '/auth/set-password')
  }
  // Implicit/PKCE or password-reset flow (access_token in hash)
  else if (hash.startsWith('#')) {
    const params        = new URLSearchParams(hash.substring(1))
    
    // Check for Supabase error parameters
    const error = params.get('error')
    const errorCode = params.get('error_code')
    if (error || errorCode) {
      console.error('❌ Supabase error in URL hash:', {
        error,
        errorCode,
        errorDescription: params.get('error_description')
      })
      // Don't process further - let SetPassword.vue handle the error display
      return
    }
    
    const access_token  = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (sessionError) console.error('setSession error:', sessionError.message)
    }
  }

  // Only remove tokens from URL if we haven't already handled them above
  // (token_hash handling already cleans up the URL)
  if (!tokenHash || (tokenHash && pathname !== '/auth/set-password')) {
    window.history.replaceState({}, '', pathname)
  }
}