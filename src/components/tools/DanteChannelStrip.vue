<template>
  <div 
    class="channel-strip"
    :class="{ 
      'muted': channel.muted, 
      'solo': channel.solo 
    }"
  >
    <div class="channel-label">{{ channel.name }}</div>
    
    <!-- Peak Level Meter -->
    <div class="meter-container">
      <div class="meter-bar">
        <div 
          class="meter-fill"
          :style="meterStyle"
        ></div>
        <div 
          v-if="peakHold > -60"
          class="meter-hold"
          :style="holdStyle"
        ></div>
      </div>
      <div class="meter-value">{{ peakLevel.toFixed(1) }} dB</div>
    </div>

    <!-- Fader -->
    <div class="fader-container">
      <input
        type="range"
        class="fader"
        min="0"
        max="1"
        step="0.01"
        :value="localGain"
        @input="handleFaderMove"
        orient="vertical"
      />
      <div class="fader-value">{{ dbValue.toFixed(1) }} dB</div>
    </div>

    <!-- Pan Control -->
    <div class="pan-container">
      <label class="pan-label">Pan</label>
      <input
        type="range"
        class="pan"
        min="-1"
        max="1"
        step="0.01"
        :value="localPan"
        @input="handlePanMove"
      />
      <div class="pan-value">
        {{ localPan < 0 ? 'L' : localPan > 0 ? 'R' : 'C' }}
      </div>
    </div>

    <!-- Mute/Solo Buttons -->
    <div class="channel-buttons">
      <button 
        class="mute-btn"
        :class="{ 'active': channel.muted }"
        @click="$emit('mute-toggle')"
      >
        M
      </button>
      <button 
        class="solo-btn"
        :class="{ 'active': channel.solo }"
        @click="$emit('solo-toggle')"
      >
        S
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  channel: {
    type: Object,
    required: true,
  },
  peakLevel: {
    type: Number,
    default: -60,
  },
  peakHold: {
    type: Number,
    default: -60,
  },
});

const emit = defineEmits(['fader-change', 'pan-change', 'mute-toggle', 'solo-toggle']);

const localGain = ref(props.channel.gain);
const localPan = ref(props.channel.pan);

watch(() => props.channel.gain, (newVal) => {
  localGain.value = newVal;
});

watch(() => props.channel.pan, (newVal) => {
  localPan.value = newVal;
});

const dbValue = computed(() => {
  return 20 * Math.log10(localGain.value || 0.001);
});

const handleFaderMove = (e) => {
  const value = parseFloat(e.target.value);
  localGain.value = value;
  emit('fader-change', value);
};

const handlePanMove = (e) => {
  const value = parseFloat(e.target.value);
  localPan.value = value;
  emit('pan-change', value);
};

// Meter styling
const meterStyle = computed(() => {
  // Calculate height: -60dB = 0%, 0dB = 100%
  const height = Math.max(0, Math.min(100, ((props.peakLevel + 60) / 60) * 100));
  let color = '#10b981'; // green
  
  if (props.peakLevel > -6) {
    color = '#ef4444'; // red
  } else if (props.peakLevel > -18) {
    color = '#f59e0b'; // yellow
  }
  
  // Ensure minimum 1% height so meter is always visible (even at -60dB)
  const minHeight = props.peakLevel <= -60 ? 1 : height;
  
  return {
    height: `${minHeight}%`,
    backgroundColor: color,
    opacity: props.peakLevel <= -60 ? 0.3 : 1, // Dim when no signal
  };
});

const holdStyle = computed(() => {
  const height = Math.max(0, Math.min(100, ((props.peakHold + 60) / 60) * 100));
  return {
    bottom: `${height}%`,
  };
});
</script>

<style scoped>
.channel-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
  min-width: 80px;
  gap: 0.75rem;
  transition: all 0.2s;
}

.channel-strip.muted {
  opacity: 0.5;
}

.channel-strip.solo {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.channel-label {
  font-weight: 600;
  font-size: 0.875rem;
  text-align: center;
  color: var(--text-primary, #1f2937);
}

.meter-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.meter-bar {
  width: 8px;
  height: 120px;
  background: #1f2937;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.meter-fill {
  position: absolute;
  bottom: 0;
  width: 100%;
  transition: height 0.05s linear, background-color 0.1s;
  border-radius: 0 0 4px 4px;
}

.meter-hold {
  position: absolute;
  width: 100%;
  height: 2px;
  background: white;
  opacity: 0.8;
  transition: bottom 0.1s;
}

.meter-value {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.fader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.fader {
  width: 100%;
  height: 200px;
  -webkit-appearance: slider-vertical;
  writing-mode: bt-lr;
  direction: rtl;
  background: #1f2937;
  border-radius: 4px;
  outline: none;
}

.fader::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.fader::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.fader-value {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
}

.pan-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
}

.pan-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.pan {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}

.pan::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.pan::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.pan-value {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  min-width: 1rem;
  text-align: center;
}

.channel-buttons {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.mute-btn,
.solo-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 4px;
  background: white;
  color: var(--text-primary, #1f2937);
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mute-btn:hover,
.solo-btn:hover {
  background: #f3f4f6;
}

.mute-btn.active {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.solo-btn.active {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

@media (max-width: 768px) {
  .channel-strip {
    min-width: 70px;
    padding: 0.75rem;
  }
  
  .meter-bar {
    height: 100px;
  }
  
  .fader {
    height: 150px;
  }
}
</style>

