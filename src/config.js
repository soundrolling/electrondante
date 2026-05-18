// src/config.js
// Environment variable configuration with fallbacks and validation

const getEnvVar = (key, fallback = null) => {
  // Try multiple ways to get environment variables
  // Vite uses import.meta.env, Vue CLI uses process.env
  let value = null
  
  // Try Vite env vars first (import.meta.env.VITE_* or VUE_APP_*)
  // In Vite, import.meta.env is always available at build time
  // Vite config now exposes VUE_APP_* through import.meta.env
  // @ts-ignore
  const viteEnv = import.meta?.env
  if (viteEnv) {
    // Try VITE_ prefix first, then VUE_APP_ prefix (exposed via vite.config.js define)
    value = viteEnv[`VITE_${key}`] || 
            viteEnv[`VUE_APP_${key}`] ||
            viteEnv[key] ||
            null
  }
  
  // Fallback to process.env (Vue CLI legacy or Node.js)
  // process.env is also defined in vite.config.js for compatibility
  if (!value) {
    value = process.env[`VITE_${key}`] || 
            process.env[`VUE_APP_${key}`] || 
            process.env[key] || 
            (typeof window !== 'undefined' && window.__ENV__?.[key]) || 
            fallback
  }
  
  if (!value && key.includes('SUPABASE')) {
    console.warn(`⚠️ Environment variable ${key} not found. This may cause authentication issues.`)
  }
  
  return value
}

// NOTE: serviceRoleKey is intentionally not exposed here. The service-role key
// bypasses RLS and must never reach the browser. Privileged operations go
// through supabase/functions edge functions, which read the key from their
// own environment.
export const config = {
  supabase: {
    url: getEnvVar('SUPABASE_URL') || getEnvVar('VUE_APP_SUPABASE_URL'),
    anonKey: getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('VUE_APP_SUPABASE_ANON_KEY'),
  }
}

// Validate required configuration
export const validateConfig = () => {
  const { url, anonKey } = config.supabase
  
  if (!url || !anonKey) {
    console.error('❌ Missing required Supabase configuration:')
    console.error('   URL:', url ? '✅' : '❌')
    console.error('   ANON_KEY:', anonKey ? '✅' : '❌')
    return false
  }
  
  console.log('✅ Supabase configuration validated')
  return true
}

export default config
