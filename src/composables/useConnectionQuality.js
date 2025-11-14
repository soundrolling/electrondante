// Connection Quality Monitor
// Tracks latency, packet loss, jitter, and overall connection quality

import { ref, computed } from 'vue';

export function useConnectionQuality() {
  const latency = ref(0);
  const packetLoss = ref(0);
  const jitter = ref(0);
  const packetsReceived = ref(0);
  const packetsDropped = ref(0);
  const lastPingTime = ref(0);
  const pingHistory = ref([]);
  const maxPingHistory = 20;

  // Calculate quality score (0-100)
  const qualityScore = computed(() => {
    let score = 100;

    // Penalize high latency
    if (latency.value > 200) score -= 30;
    else if (latency.value > 100) score -= 15;
    else if (latency.value > 50) score -= 5;

    // Penalize packet loss
    if (packetLoss.value > 5) score -= 40;
    else if (packetLoss.value > 2) score -= 20;
    else if (packetLoss.value > 1) score -= 10;

    // Penalize high jitter
    if (jitter.value > 50) score -= 20;
    else if (jitter.value > 25) score -= 10;
    else if (jitter.value > 10) score -= 5;

    return Math.max(0, Math.min(100, score));
  });

  // Quality level (excellent, good, fair, poor)
  const qualityLevel = computed(() => {
    const score = qualityScore.value;
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  });

  // Quality color for UI
  const qualityColor = computed(() => {
    const level = qualityLevel.value;
    switch (level) {
      case 'excellent': return '#10b981'; // green
      case 'good': return '#3b82f6'; // blue
      case 'fair': return '#f59e0b'; // yellow
      case 'poor': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  });

  const updateLatency = (newLatency) => {
    latency.value = newLatency;
    pingHistory.value.push(newLatency);
    if (pingHistory.value.length > maxPingHistory) {
      pingHistory.value.shift();
    }
  };

  const updatePacketLoss = (loss) => {
    packetLoss.value = loss;
  };

  const updateJitter = (newJitter) => {
    jitter.value = newJitter;
  };

  const updateStats = (stats) => {
    if (stats.latency !== undefined) updateLatency(stats.latency);
    if (stats.packetLoss !== undefined) updatePacketLoss(stats.packetLoss);
    if (stats.jitter !== undefined) updateJitter(stats.jitter);
    if (stats.packetsReceived !== undefined) packetsReceived.value = stats.packetsReceived;
    if (stats.packetsDropped !== undefined) packetsDropped.value = stats.packetsDropped;
  };

  const startPing = () => {
    lastPingTime.value = Date.now();
  };

  const recordPong = () => {
    if (lastPingTime.value > 0) {
      const roundTripTime = Date.now() - lastPingTime.value;
      updateLatency(roundTripTime / 2); // Divide by 2 for one-way latency estimate
      lastPingTime.value = 0;
    }
  };

  const reset = () => {
    latency.value = 0;
    packetLoss.value = 0;
    jitter.value = 0;
    packetsReceived.value = 0;
    packetsDropped.value = 0;
    pingHistory.value = [];
    lastPingTime.value = 0;
  };

  // Get average latency from history
  const averageLatency = computed(() => {
    if (pingHistory.value.length === 0) return 0;
    const sum = pingHistory.value.reduce((a, b) => a + b, 0);
    return Math.round(sum / pingHistory.value.length);
  });

  return {
    latency,
    packetLoss,
    jitter,
    packetsReceived,
    packetsDropped,
    qualityScore,
    qualityLevel,
    qualityColor,
    averageLatency,
    updateLatency,
    updatePacketLoss,
    updateJitter,
    updateStats,
    startPing,
    recordPong,
    reset,
  };
}

