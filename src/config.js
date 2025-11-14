// src/config.js
// Environment variable configuration with fallbacks and validation

const getEnvVar = (key, fallback = null) => {
  // Try multiple ways to get environment variables
  // Vite uses import.meta.env, Vue CLI uses process.env
  let value = null
  
  // Try Vite env vars first (import.meta.env.VITE_*)
  // In Vite, import.meta.env is always available at build time
  // Access it directly - Vite will replace it at build time
  // @ts-ignore
  const viteEnv = import.meta?.env
  if (viteEnv) {
    value = viteEnv[`VITE_${key}`] || 
            viteEnv[`VUE_APP_${key}`] ||
            viteEnv[key] ||
            null
  }
  
  // Fallback to process.env (Vue CLI legacy or Node.js)
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

export const config = {
  supabase: {
    url: getEnvVar('SUPABASE_URL') || getEnvVar('VUE_APP_SUPABASE_URL'),
    anonKey: getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('VUE_APP_SUPABASE_ANON_KEY'),
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VUE_APP_SUPABASE_SERVICE_ROLE_KEY'),
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
