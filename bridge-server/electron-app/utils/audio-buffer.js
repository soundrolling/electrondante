// Advanced adaptive jitter buffer for audio playback

class JitterBuffer {
  constructor(options = {}) {
    // Buffer size limits (in packets)
    this.maxSize = options.maxSize || 100; // Max packets in buffer
    this.minSize = options.minSize || 5; // Min packets before starting playback
    this.targetSize = options.targetSize || 20; // Target buffer size
    this.maxLatency = options.maxLatency || 500; // Max latency in ms
    this.adaptive = options.adaptive !== false; // Enable adaptive buffering
    
    // Adaptive sizing parameters
    this.adaptiveMinSize = this.minSize;
    this.adaptiveTargetSize = this.targetSize;
    this.adaptiveMaxSize = this.maxSize;
    
    // Network quality metrics
    this.buffer = []; // Array of { data, timestamp, sequence, encoding }
    this.expectedSequence = 0;
    this.lastPacketTime = null;
    this.lastPacketTimestamp = null;
    this.networkJitter = 0; // Jitter in ms
    this.packetLossCount = 0;
    this.totalPackets = 0;
    this.latencyHistory = []; // Recent latency measurements
    this.jitterHistory = []; // Recent jitter measurements
    
    // Playback state
    this.isBuffering = true;
    this.bufferStartTime = null;
    
    // Adaptive adjustment parameters
    this.qualityCheckInterval = 50; // Check quality every N packets
    this.packetCount = 0;
    
    // Quality thresholds
    this.qualityThresholds = {
      excellent: { jitter: 20, latency: 100, loss: 0.01 },
      good: { jitter: 50, latency: 200, loss: 0.05 },
      fair: { jitter: 100, latency: 400, loss: 0.10 },
    };
  }
  
  // Add packet to buffer
  addPacket(packet) {
    const { data, timestamp, sequence, encoding } = packet;
    const now = Date.now();
    
    this.totalPackets++;
    this.packetCount++;
    
    // Calculate latency (if timestamp is provided)
    if (timestamp && this.lastPacketTimestamp) {
      const packetLatency = now - timestamp;
      this.latencyHistory.push(packetLatency);
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift();
      }
    }
    this.lastPacketTimestamp = timestamp;
    
    // Update network jitter estimation
    if (this.lastPacketTime && timestamp) {
      const packetInterval = timestamp - this.lastPacketTime;
      const expectedInterval = 341; // ~341ms per packet (based on batch size)
      const jitter = Math.abs(packetInterval - expectedInterval);
      this.jitterHistory.push(jitter);
      if (this.jitterHistory.length > 100) {
        this.jitterHistory.shift();
      }
      // Exponential moving average for jitter
      this.networkJitter = this.networkJitter * 0.9 + jitter * 0.1;
    }
    this.lastPacketTime = timestamp;
    
    // Check for missing packets (packet loss detection)
    if (sequence > this.expectedSequence + 1) {
      const lostPackets = sequence - this.expectedSequence - 1;
      this.packetLossCount += lostPackets;
      this.expectedSequence = sequence;
    } else if (sequence === this.expectedSequence + 1) {
      this.expectedSequence = sequence;
    } else if (sequence < this.expectedSequence) {
      // Out of order or duplicate - remove if duplicate
      const existing = this.buffer.find(p => p.sequence === sequence);
      if (existing) {
        const index = this.buffer.indexOf(existing);
        if (index !== -1) {
          this.buffer.splice(index, 1);
        }
      }
      // Don't update expectedSequence for out-of-order packets
    }
    
    // Insert packet in sequence order
    const insertIndex = this.buffer.findIndex(p => p.sequence > sequence);
    if (insertIndex === -1) {
      this.buffer.push({ data, timestamp, sequence, encoding });
    } else {
      this.buffer.splice(insertIndex, 0, { data, timestamp, sequence, encoding });
    }
    
    // Adaptive buffer sizing based on network conditions
    if (this.adaptive && this.packetCount >= this.qualityCheckInterval) {
      this._adjustBufferSize();
      this.packetCount = 0;
    }
    
    // Check if buffer is ready
    if (this.isBuffering) {
      if (!this.bufferStartTime) {
        this.bufferStartTime = now;
      }
      if (this.buffer.length >= this.adaptiveMinSize) {
        this.isBuffering = false;
        const bufferingDuration = now - this.bufferStartTime;
        console.log(`JitterBuffer: Buffering complete after ${bufferingDuration}ms`);
      }
    }
    
    // Prevent buffer overflow
    if (this.buffer.length > this.adaptiveMaxSize) {
      // Remove oldest packets
      const removed = this.buffer.shift();
      if (removed.sequence >= this.expectedSequence) {
        this.expectedSequence = removed.sequence + 1;
      }
    }
  }
  
  // Adjust buffer size based on network quality
  _adjustBufferSize() {
    const avgLatency = this.getAverageLatency();
    const avgJitter = this.getAverageJitter();
    const packetLossRate = this.getPacketLossRate();
    
    // Determine network quality
    let quality = 'poor';
    if (avgJitter <= this.qualityThresholds.excellent.jitter && 
        avgLatency <= this.qualityThresholds.excellent.latency &&
        packetLossRate <= this.qualityThresholds.excellent.loss) {
      quality = 'excellent';
    } else if (avgJitter <= this.qualityThresholds.good.jitter && 
               avgLatency <= this.qualityThresholds.good.latency &&
               packetLossRate <= this.qualityThresholds.good.loss) {
      quality = 'good';
    } else if (avgJitter <= this.qualityThresholds.fair.jitter && 
               avgLatency <= this.qualityThresholds.fair.latency &&
               packetLossRate <= this.qualityThresholds.fair.loss) {
      quality = 'fair';
    }
    
    // Adjust buffer sizes based on quality
    switch (quality) {
      case 'excellent':
        // Low jitter, low latency - can use smaller buffer
        this.adaptiveMinSize = Math.max(3, Math.floor(this.minSize * 0.6));
        this.adaptiveTargetSize = Math.max(5, Math.floor(this.targetSize * 0.7));
        this.adaptiveMaxSize = Math.max(20, Math.floor(this.maxSize * 0.8));
        break;
      case 'good':
        // Moderate conditions - use standard buffer
        this.adaptiveMinSize = this.minSize;
        this.adaptiveTargetSize = this.targetSize;
        this.adaptiveMaxSize = this.maxSize;
        break;
      case 'fair':
        // Higher jitter/latency - increase buffer
        this.adaptiveMinSize = Math.min(15, Math.ceil(this.minSize * 1.5));
        this.adaptiveTargetSize = Math.min(40, Math.ceil(this.targetSize * 1.5));
        this.adaptiveMaxSize = Math.min(150, Math.ceil(this.maxSize * 1.5));
        break;
      case 'poor':
        // Poor conditions - significantly increase buffer
        this.adaptiveMinSize = Math.min(20, Math.ceil(this.minSize * 2));
        this.adaptiveTargetSize = Math.min(60, Math.ceil(this.targetSize * 2));
        this.adaptiveMaxSize = Math.min(200, Math.ceil(this.maxSize * 2));
        break;
    }
    
    // If currently buffering and we've increased minSize, may need to continue buffering
    if (this.isBuffering && this.buffer.length < this.adaptiveMinSize) {
      // Continue buffering
    }
  }
  
  // Get average latency
  getAverageLatency() {
    if (this.latencyHistory.length === 0) return 0;
    return this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
  }
  
  // Get average jitter
  getAverageJitter() {
    if (this.jitterHistory.length === 0) return 0;
    return this.jitterHistory.reduce((a, b) => a + b, 0) / this.jitterHistory.length;
  }
  
  // Get packet loss rate
  getPacketLossRate() {
    if (this.totalPackets === 0) return 0;
    return this.packetLossCount / this.totalPackets;
  }
  
  // Get next packet for playback (FIFO)
  getNextPacket() {
    if (this.buffer.length === 0) {
      return null;
    }
    
    // Wait for buffer to fill if buffering
    if (this.isBuffering && this.buffer.length < this.adaptiveMinSize) {
      return null;
    }
    
    // If buffer is getting low, enter buffering mode again
    if (!this.isBuffering && this.buffer.length < this.adaptiveMinSize) {
      this.isBuffering = true;
      this.bufferStartTime = Date.now();
      return null;
    }
    
    return this.buffer.shift();
  }
  
  // Check if buffer has enough data
  hasEnoughData() {
    return !this.isBuffering && this.buffer.length >= this.adaptiveMinSize;
  }
  
  // Get buffer status
  getStatus() {
    return {
      size: this.buffer.length,
      minSize: this.adaptiveMinSize,
      targetSize: this.adaptiveTargetSize,
      maxSize: this.adaptiveMaxSize,
      isBuffering: this.isBuffering,
      networkJitter: Math.round(this.networkJitter),
      averageJitter: Math.round(this.getAverageJitter()),
      averageLatency: Math.round(this.getAverageLatency()),
      packetLossRate: this.getPacketLossRate(),
      packetLossCount: this.packetLossCount,
      totalPackets: this.totalPackets,
      expectedSequence: this.expectedSequence,
    };
  }
  
  // Clear buffer
  clear() {
    this.buffer = [];
    this.expectedSequence = 0;
    this.lastPacketTime = null;
    this.lastPacketTimestamp = null;
    this.networkJitter = 0;
    this.packetLossCount = 0;
    this.totalPackets = 0;
    this.latencyHistory = [];
    this.jitterHistory = [];
    this.isBuffering = true;
    this.bufferStartTime = null;
    this.packetCount = 0;
    
    // Reset adaptive sizes to defaults
    this.adaptiveMinSize = this.minSize;
    this.adaptiveTargetSize = this.targetSize;
    this.adaptiveMaxSize = this.maxSize;
  }
  
  // Reset buffering state
  resetBuffering() {
    this.isBuffering = true;
    this.bufferStartTime = Date.now();
  }
}

// Export for Node.js or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JitterBuffer;
} else if (typeof window !== 'undefined') {
  // Only attach to window if we're in a browser context
  window.JitterBuffer = JitterBuffer;
}

