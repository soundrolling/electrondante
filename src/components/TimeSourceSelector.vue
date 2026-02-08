<template>
  <div class="time-source-selector">
    <div class="source-select-wrapper">
      <select id="timeSource" v-model="selectedSource" @change="onSourceChange" aria-label="Time source">
        <option value="device">Device Time</option>
        <option value="custom">Custom Timecode</option>
        <option value="world">World Time (GMT)</option>
      </select>
      <svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>

    <!-- Custom Timecode Input -->
    <div v-if="selectedSource === 'custom'" class="source-options">
      <label for="customTime" class="option-label">Set time (HH:MM:SS)</label>
      <div class="option-row">
        <input
          type="text"
          id="customTime"
          v-model="customTime"
          class="option-input"
          placeholder="00:00:00"
          pattern="^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$"
          title="Please enter time in HH:MM:SS format."
        />
        <button class="option-btn" @click="setCustomTime" :disabled="!isValidCustomTime">
          Set
        </button>
      </div>
    </div>

    <!-- World Time Offset Input -->
    <div v-if="selectedSource === 'world'" class="source-options">
      <label for="gmtOffset" class="option-label">GMT offset (hours)</label>
      <div class="option-row">
        <input
          type="number"
          id="gmtOffset"
          v-model.number="gmtOffset"
          class="option-input"
          placeholder="0"
        />
        <button class="option-btn" @click="setWorldTime">
          Set
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '../stores/userStore';

export default {
setup() {
  const userStore = useUserStore();
  const selectedSource = ref(localStorage.getItem('currentTimeSource') || 'device');
  const customTime = ref('00:00:00');
  const gmtOffset = ref(0);
  // Store the effective GMT offset for world time updates.
  const worldOffsetUsed = ref(0);
  let intervalId = null;

  // Validation for custom timecode input
  const isValidCustomTime = computed(() => {
    const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    return timeRegex.test(customTime.value);
  });

  // Update device time using local time.
  const updateDeviceTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    userStore.setLiveTimecode(`${hours}:${minutes}:${seconds}`);
  };

  const startDeviceTime = () => {
    updateDeviceTime(); // Update immediately
    intervalId = setInterval(updateDeviceTime, 1000);
  };

  // Update world time based on UTC time plus the stored GMT offset.
  const updateWorldTime = () => {
    const now = new Date();
    let hours = now.getUTCHours() + worldOffsetUsed.value;
    // Adjust hours for wrapping
    if (hours < 0) hours = (hours % 24) + 24;
    else if (hours >= 24) hours = hours % 24;
    const minutes = now.getUTCMinutes();
    const seconds = now.getUTCSeconds();
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    userStore.setLiveTimecode(`${hStr}:${mStr}:${sStr}`);
  };

  const startWorldTime = () => {
    updateWorldTime(); // Update immediately with current offset
    intervalId = setInterval(updateWorldTime, 1000);
  };

  // Stop any active time interval
  const stopInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const onSourceChange = () => {
    stopInterval();
    localStorage.setItem('currentTimeSource', selectedSource.value);
    userStore.setCurrentTimeSource(selectedSource.value);
    if (selectedSource.value === 'device') {
      startDeviceTime();
    } else if (selectedSource.value === 'world') {
      startWorldTime();
    }
    // For 'custom', no automatic update is needed.
  };

  const setCustomTime = () => {
    if (!isValidCustomTime.value) {
      alert('Please enter a valid time in HH:MM:SS format.');
      return;
    }
    userStore.setLiveTimecode(customTime.value);
    customTime.value = '';
  };

  const setWorldTime = () => {
    // Store the user-provided offset and update immediately.
    worldOffsetUsed.value = gmtOffset.value;
    updateWorldTime();
    // Optionally, reset the input.
    gmtOffset.value = 0;
  };

  onMounted(() => {
    if (selectedSource.value === 'device') {
      startDeviceTime();
    } else if (selectedSource.value === 'world') {
      startWorldTime();
    }
  });

  onUnmounted(() => {
    stopInterval();
  });

  return {
    selectedSource,
    customTime,
    gmtOffset,
    onSourceChange,
    setCustomTime,
    setWorldTime,
    isValidCustomTime,
  };
},
};
</script>

<style scoped>
.time-source-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

/* Custom select wrapper */
.source-select-wrapper {
  position: relative;
  width: 100%;
}

.source-select-wrapper select {
  width: 100%;
  padding: var(--space-2-5) var(--space-8) var(--space-2-5) var(--space-3);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  background: var(--bg-secondary);
  color: var(--text-primary);
  appearance: none;
  cursor: pointer;
  transition: var(--transition-fast);
  min-height: 40px;
}

.source-select-wrapper select:hover {
  border-color: var(--color-primary-400);
}

.source-select-wrapper select:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.select-chevron {
  position: absolute;
  right: var(--space-2-5);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  pointer-events: none;
}

/* Conditional option sections */
.source-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  padding-top: var(--space-1);
}

.option-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
}

.option-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.option-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: var(--font-family-mono);
  background: var(--bg-secondary);
  color: var(--text-primary);
  text-align: center;
  min-height: 36px;
}

.option-input:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.option-btn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-primary-500);
  border-radius: var(--radius-md);
  background: var(--color-primary-500);
  color: var(--text-inverse);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-fast);
  min-height: 36px;
  white-space: nowrap;
}

.option-btn:hover:not(:disabled) {
  background: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

.option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
