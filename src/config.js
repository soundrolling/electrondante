// src/config.js
// Environment variable configuration with fallbacks and validation

const getEnvVar = (key, fallback = null) => {
  // Try multiple ways to get environment variables
  const value = process.env[key] || 
                process.env[`VUE_APP_${key}`] || 
                window.__ENV__?.[key] || 
                fallback
  
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
