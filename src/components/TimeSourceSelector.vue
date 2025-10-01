<template>
  <div class="time-source-selector">
    <label for="timeSource">Select Time Source:</label>
    <select id="timeSource" v-model="selectedSource" @change="onSourceChange">
      <option value="device">Device Time</option>
      <option value="custom">Custom Timecode</option>
      <option value="world">World Time (GMT)</option>
    </select>

    <!-- Custom Timecode Input -->
    <div v-if="selectedSource === 'custom'" class="custom-timecode-input">
      <label for="customTime">Initial Time (HH:MM:SS):</label>
      <input
        type="text"
        id="customTime"
        v-model="customTime"
        placeholder="00:00:00"
        pattern="^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$"
        title="Please enter time in HH:MM:SS format."
      />
      <button @click="setCustomTime" :disabled="!isValidCustomTime">
        Set Custom Timecode
      </button>
    </div>

    <!-- World Time Offset Input -->
    <div v-if="selectedSource === 'world'" class="world-time-offset-input">
      <label for="gmtOffset">GMT Offset (hours):</label>
      <input
        type="number"
        id="gmtOffset"
        v-model.number="gmtOffset"
        placeholder="e.g., +2 or -5"
      />
      <button @click="setWorldTime">
        Set World Time (GMT)
      </button>
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
margin-top: 20px;
display: flex;
flex-direction: column;
align-items: center;
}

.time-source-selector label {
margin-right: 10px;
font-weight: bold;
}

.time-source-selector select {
padding: 5px;
border-radius: 4px;
margin-bottom: 10px;
}

.custom-timecode-input,
.world-time-offset-input {
margin-top: 10px;
display: flex;
flex-direction: column;
align-items: center;
}

.custom-timecode-input label,
.world-time-offset-input label {
margin-bottom: 5px;
font-weight: bold;
}

.custom-timecode-input input,
.world-time-offset-input input {
padding: 5px;
border-radius: 4px;
width: 150px;
margin-bottom: 5px;
text-align: center;
}

.custom-timecode-input button,
.world-time-offset-input button {
padding: 5px 10px;
border: none;
border-radius: 4px;
background-color: #28a745;
color: white;
cursor: pointer;
}

.custom-timecode-input button:disabled {
background-color: #6c757d;
cursor: not-allowed;
}

.custom-timecode-input button:hover:not(:disabled),
.world-time-offset-input button:hover {
background-color: #218838;
}
</style>
