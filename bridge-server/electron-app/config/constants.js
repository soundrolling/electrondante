// Configuration constants

module.exports = {
  // WebSocket URLs
  DEFAULT_RAILWAY_URL: 'wss://proapp2149-production.up.railway.app',
  
  // Reconnection settings
  RECONNECT_MIN_DELAY: 1000, // 1 second
  RECONNECT_MAX_DELAY: 30000, // 30 seconds
  RECONNECT_MAX_ATTEMPTS: Infinity,
  
  // Audio settings
  DEFAULT_SAMPLE_RATE: 48000,
  DEFAULT_CHANNELS: 16,
  DEFAULT_BUFFER_SIZE: 4096,
  DEFAULT_BATCH_SIZE: 4,
  
  // Jitter buffer settings
  JITTER_BUFFER_MIN_SIZE: 5,
  JITTER_BUFFER_TARGET_SIZE: 20,
  JITTER_BUFFER_MAX_SIZE: 100,
  JITTER_BUFFER_MAX_LATENCY: 500, // ms
  
  // Heartbeat settings
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  HEARTBEAT_TIMEOUT: 60000, // 60 seconds
  
  // Token refresh
  TOKEN_REFRESH_BEFORE_EXPIRY: 5 * 60 * 1000, // 5 minutes before expiry
};

