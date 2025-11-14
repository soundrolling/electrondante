// Jitter Buffer for Audio Streaming
// Manages packet ordering and buffering to handle network jitter

export class JitterBuffer {
  constructor(maxBufferSize = 10, targetLatency = 100) {
    this.maxBufferSize = maxBufferSize; // Maximum packets to buffer
    this.targetLatency = targetLatency; // Target latency in ms
    this.buffer = new Map(); // Map of sequence -> packet
    this.expectedSequence = 0;
    this.lastSequence = -1;
    this.stats = {
      packetsReceived: 0,
      packetsOutOfOrder: 0,
      packetsDropped: 0,
      packetsDuplicated: 0,
      jitter: 0, // Variation in packet arrival times
      latency: 0,
    };
    this.packetTimestamps = []; // For jitter calculation
    this.maxTimestampHistory = 50;
  }

  addPacket(sequence, data, timestamp) {
    this.stats.packetsReceived++;
    
    // Track packet arrival times for jitter calculation
    const now = Date.now();
    if (this.packetTimestamps.length > 0) {
      const lastArrival = this.packetTimestamps[this.packetTimestamps.length - 1];
      const interArrivalTime = now - lastArrival.time;
      const expectedInterval = timestamp - lastArrival.timestamp;
      const jitter = Math.abs(interArrivalTime - expectedInterval);
      
      // Exponential moving average for jitter
      this.stats.jitter = this.stats.jitter * 0.9 + jitter * 0.1;
    }
    
    this.packetTimestamps.push({ time: now, timestamp });
    if (this.packetTimestamps.length > this.maxTimestampHistory) {
      this.packetTimestamps.shift();
    }

    // Check for duplicates
    if (this.buffer.has(sequence)) {
      this.stats.packetsDuplicated++;
      return false; // Duplicate packet
    }

    // Check if packet is too old (more than maxBufferSize behind)
    if (sequence < this.expectedSequence - this.maxBufferSize) {
      this.stats.packetsDropped++;
      return false; // Too old, drop it
    }

    // Add packet to buffer
    this.buffer.set(sequence, { data, timestamp, receivedAt: now });
    this.lastSequence = Math.max(this.lastSequence, sequence);

    // Check if out of order
    if (sequence !== this.expectedSequence) {
      this.stats.packetsOutOfOrder++;
    }

    return true;
  }

  getNextPacket() {
    // Check if we have the expected packet
    if (this.buffer.has(this.expectedSequence)) {
      const packet = this.buffer.get(this.expectedSequence);
      this.buffer.delete(this.expectedSequence);
      this.expectedSequence++;
      
      // Calculate latency
      if (packet.receivedAt && packet.timestamp) {
        const latency = Date.now() - packet.receivedAt;
        this.stats.latency = this.stats.latency * 0.9 + latency * 0.1;
      }
      
      return packet.data;
    }

    // If we don't have the expected packet, check if we should wait or skip
    if (this.buffer.size === 0) {
      return null; // No packets available
    }

    // Check if we have packets ahead (out of order)
    const nextAvailable = Math.min(...Array.from(this.buffer.keys()));
    if (nextAvailable > this.expectedSequence) {
      // We're missing packets - decide whether to wait or skip
      const gap = nextAvailable - this.expectedSequence;
      
      // If gap is small, wait a bit
      if (gap <= 2) {
        return null; // Wait for missing packets
      }
      
      // If gap is large, skip ahead (packets are likely lost)
      this.stats.packetsDropped += gap;
      this.expectedSequence = nextAvailable;
      const packet = this.buffer.get(nextAvailable);
      this.buffer.delete(nextAvailable);
      this.expectedSequence++;
      return packet.data;
    }

    return null;
  }

  getStats() {
    const packetLoss = this.stats.packetsReceived > 0
      ? (this.stats.packetsDropped / this.stats.packetsReceived) * 100
      : 0;

    return {
      ...this.stats,
      packetLoss: packetLoss.toFixed(1),
      bufferSize: this.buffer.size,
      bufferUtilization: (this.buffer.size / this.maxBufferSize) * 100,
    };
  }

  reset() {
    this.buffer.clear();
    this.expectedSequence = 0;
    this.lastSequence = -1;
    this.packetTimestamps = [];
    this.stats = {
      packetsReceived: 0,
      packetsOutOfOrder: 0,
      packetsDropped: 0,
      packetsDuplicated: 0,
      jitter: 0,
      latency: 0,
    };
  }

  adjustBufferSize(networkConditions) {
    // Dynamically adjust buffer size based on network conditions
    if (networkConditions.jitter > 50) {
      // High jitter - increase buffer
      this.maxBufferSize = Math.min(this.maxBufferSize + 2, 20);
    } else if (networkConditions.jitter < 10 && this.maxBufferSize > 5) {
      // Low jitter - decrease buffer for lower latency
      this.maxBufferSize = Math.max(this.maxBufferSize - 1, 5);
    }
  }
}

