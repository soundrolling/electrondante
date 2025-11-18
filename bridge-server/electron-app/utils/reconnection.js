// Exponential backoff reconnection utility

class ReconnectionManager {
  constructor(options = {}) {
    this.minDelay = options.minDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.maxAttempts = options.maxAttempts || Infinity;
    this.currentDelay = this.minDelay;
    this.attempts = 0;
    this.reconnectTimer = null;
    this.onReconnect = options.onReconnect || null;
    this.onMaxAttempts = options.onMaxAttempts || null;
  }
  
  // Start reconnection attempts
  start() {
    if (this.reconnectTimer) {
      return; // Already reconnecting
    }
    
    this.attempts = 0;
    this.currentDelay = this.minDelay;
    this.scheduleReconnect();
  }
  
  // Stop reconnection attempts
  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.attempts = 0;
    this.currentDelay = this.minDelay;
  }
  
  // Reset delay to minimum (successful connection)
  reset() {
    this.currentDelay = this.minDelay;
    this.attempts = 0;
    this.stop();
  }
  
  // Schedule next reconnection attempt
  scheduleReconnect() {
    if (this.attempts >= this.maxAttempts) {
      if (this.onMaxAttempts) {
        this.onMaxAttempts();
      }
      return;
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.attempts++;
      
      if (this.onReconnect) {
        this.onReconnect(this.attempts, this.currentDelay);
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
      this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
      
      // Schedule next attempt if needed
      if (this.attempts < this.maxAttempts) {
        this.scheduleReconnect();
      }
    }, this.currentDelay);
  }
  
  // Get current state
  getState() {
    return {
      attempts: this.attempts,
      currentDelay: this.currentDelay,
      isReconnecting: !!this.reconnectTimer,
    };
  }
}

module.exports = ReconnectionManager;

