// Configuration constants

// Get default URL from environment (Node.js) or empty string (browser)
const getDefaultRailwayUrl = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.RAILWAY_WS_URL || process.env.RAILWAY_URL || '';
  }
  return '';
};

// Get Supabase configuration from environment
// These should be set in GitHub Actions for builds or hardcoded here
const getSupabaseUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }
  // Fallback: Replace with your actual Supabase URL from pro.soundrolling.com
  // This is safe to hardcode - it's the public project URL
  return 'https://your-project-ref.supabase.co';
};

const getSupabaseAnonKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) {
    return process.env.SUPABASE_ANON_KEY;
  }
  // Fallback: Replace with your actual anon key
  // The anon key is safe to embed - it only allows RLS-protected operations
  return 'your-anon-key-here';
};

module.exports = {
  // WebSocket URLs (override with environment variable or user input)
  DEFAULT_RAILWAY_URL: getDefaultRailwayUrl(),
  
  // Supabase configuration (pro.soundrolling.com)
  SUPABASE_URL: getSupabaseUrl(),
  SUPABASE_ANON_KEY: getSupabaseAnonKey(),
  
  // Reconnection settings
  RECONNECT_MIN_DELAY: 1000, // 1 second
  RECONNECT_MAX_DELAY: 30000, // 30 seconds
  RECONNECT_MAX_ATTEMPTS: Infinity,
  
  // Audio settings
  DEFAULT_SAMPLE_RATE: 48000,
  DEFAULT_CHANNELS: 16,
  DEFAULT_BUFFER_SIZE: 4096,
  DEFAULT_BATCH_SIZE: 4,
  
  // Jitter buffer settings (configured for ~400ms target latency)
  // Each packet is ~85ms (4096 samples * 4 batches / 48000 Hz)
  JITTER_BUFFER_MIN_SIZE: 3,      // ~255ms minimum before playback
  JITTER_BUFFER_TARGET_SIZE: 5,   // ~425ms target (close to 400ms goal)
  JITTER_BUFFER_MAX_SIZE: 50,     // ~4.25s maximum
  JITTER_BUFFER_MAX_LATENCY: 1000, // ms - drop packets older than this
  
  // Heartbeat settings
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  HEARTBEAT_TIMEOUT: 60000, // 60 seconds
  
  // Token refresh
  TOKEN_REFRESH_BEFORE_EXPIRY: 5 * 60 * 1000, // 5 minutes before expiry
};

