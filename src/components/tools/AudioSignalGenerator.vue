<template>
  <div class="audio-signal-generator">
    <div class="generator-container">
      <!-- Info Section -->
      <div class="info-section">
        <h3>Audio Signal Generator</h3>
        <p>
          Generate various audio signals for testing, calibration, and analysis. 
          This tool uses the Web Audio API to produce high-quality audio signals including 
          sine waves and different types of noise.
        </p>
        <p class="warning-note">
          ⚠️ Please ensure your volume is at a reasonable level before starting playback.
        </p>
      </div>

      <!-- Controls Section -->
      <div class="controls-section">
        <h3>Signal Parameters</h3>
        
        <div class="input-group">
          <label>Signal Type</label>
          <div class="signal-type-tiles">
            <button
              v-for="type in signalTypes"
              :key="type.value"
              type="button"
              class="signal-tile"
              :class="{ active: signalType === type.value }"
              :disabled="isPlaying"
              @click="selectSignalType(type.value)"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <div v-if="signalType === 'sine'" class="input-group">
          <label for="frequency">Frequency (Hz)</label>
          <input
            id="frequency"
            v-model.number="frequency"
            type="number"
            min="20"
            max="20000"
            step="1"
            :disabled="isPlaying"
            placeholder="Enter frequency"
            class="form-input"
          />
          <div class="frequency-presets">
            <button
              v-for="preset in frequencyPresets"
              :key="preset.value"
              type="button"
              class="preset-btn"
              :disabled="isPlaying"
              @click="frequency = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div v-if="signalType === 'sweep'" class="input-group">
          <label for="sweepStart">Start Frequency (Hz)</label>
          <input
            id="sweepStart"
            v-model.number="sweepStart"
            type="number"
            min="20"
            max="20000"
            step="1"
            :disabled="isPlaying"
            placeholder="Start frequency"
            class="form-input"
          />
        </div>

        <div v-if="signalType === 'sweep'" class="input-group">
          <label for="sweepEnd">End Frequency (Hz)</label>
          <input
            id="sweepEnd"
            v-model.number="sweepEnd"
            type="number"
            min="20"
            max="20000"
            step="1"
            :disabled="isPlaying"
            placeholder="End frequency"
            class="form-input"
          />
        </div>

        <div v-if="signalType === 'sweep'" class="input-group">
          <label for="sweepDuration">Sweep Duration (seconds)</label>
          <input
            id="sweepDuration"
            v-model.number="sweepDuration"
            type="number"
            min="0.5"
            max="30"
            step="0.1"
            :disabled="isPlaying"
            placeholder="Sweep duration"
            class="form-input"
          />
        </div>

        <div v-if="signalType === 'pulse'" class="input-group">
          <label for="pulsePeriod">Pulse Period (seconds)</label>
          <input
            id="pulsePeriod"
            v-model.number="pulsePeriod"
            type="number"
            min="0.5"
            max="10"
            step="0.1"
            :disabled="isPlaying"
            placeholder="Time for full pulse cycle"
            class="form-input"
          />
        </div>

        <div v-if="signalType !== 'sweep' && signalType !== 'pulse'" class="input-group">
          <label for="duration">Duration (seconds)</label>
          <input
            id="duration"
            v-model.number="duration"
            type="number"
            min="0.1"
            max="30"
            step="0.1"
            :disabled="isPlaying"
            placeholder="Enter duration"
            class="form-input"
          />
        </div>

        <div class="control-buttons">
          <button
            type="button"
            class="btn btn-primary btn-large"
            :disabled="!isReady"
            @click="toggleStartStop"
          >
            {{ isPlaying ? 'Stop' : 'Start' }}
          </button>
        </div>

        <!-- Progress Bar -->
        <div v-if="isPlaying" class="progress-container">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <!-- Status -->
        <div class="status-label" :class="{ playing: isPlaying }">
          {{ statusMessage }}
        </div>
      </div>

      <!-- Signal Info -->
      <div v-if="signalType !== 'sine' && signalType !== 'sweep' && signalType !== 'pulse'" class="info-box">
        <h4>About {{ getSignalTypeName() }}</h4>
        <p>{{ getSignalTypeDescription() }}</p>
      </div>

      <div v-if="signalType === 'sweep'" class="info-box">
        <h4>About Frequency Sweep</h4>
        <p>Continuously sweeps from the start frequency to the end frequency, then plays a 1 kHz beep before repeating. Useful for frequency response testing and identifying resonances.</p>
      </div>

      <div v-if="signalType === 'pulse'" class="info-box">
        <h4>About White Noise Pulse</h4>
        <p>Continuous white noise with volume that pulses from 1% to 100% and back to 1% in a repeating cycle. Useful for testing dynamic response and gain staging.</p>
      </div>

      <div class="footer-note">
        <div class="offline-badge">
          <span class="badge-icon">✓</span>
          <span class="badge-text">Works Offline</span>
        </div>
        <p>Version 2.39 by SoundRolling (Mobile Optimized)</p>
        <p class="note">Note: This tool requires a modern browser with Web Audio API support.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useOnline } from '@/composables/useOnline'
import { saveToolSettings, getToolSettings } from '@/services/toolSettingsService'
import { supabase } from '@/supabase'

const { isAuthenticated } = useAuth()
const { isOnline } = useOnline()

// Use route-based ID that works even when tool ID isn't available
const TOOL_ROUTE = '/tools/audio-signal-generator'

const signalType = ref('white')
const frequency = ref(440)
const duration = ref(3)
const isPlaying = ref(false)
const progressPercent = ref(0)
const sweepStart = ref(20)
const sweepEnd = ref(20000)
const sweepDuration = ref(5)
const pulsePeriod = ref(2)

// Settings that should be persisted
const settingsKeys = ['signalType', 'frequency', 'duration', 'sweepStart', 'sweepEnd', 'sweepDuration', 'pulsePeriod']

// Load settings from IndexedDB
const loadSettings = async () => {
  if (!isAuthenticated.value) return
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const savedSettings = await getToolSettings(TOOL_ROUTE, user.id)
    if (savedSettings && savedSettings.settings) {
      const settings = savedSettings.settings
      if (settings.signalType) signalType.value = settings.signalType
      if (settings.frequency !== undefined) frequency.value = settings.frequency
      if (settings.duration !== undefined) duration.value = settings.duration
      if (settings.sweepStart !== undefined) sweepStart.value = settings.sweepStart
      if (settings.sweepEnd !== undefined) sweepEnd.value = settings.sweepEnd
      if (settings.sweepDuration !== undefined) sweepDuration.value = settings.sweepDuration
      if (settings.pulsePeriod !== undefined) pulsePeriod.value = settings.pulsePeriod
    }
  } catch (error) {
    console.warn('Error loading settings from cache:', error)
  }
}

// Save settings to IndexedDB
const saveSettings = async () => {
  if (!isAuthenticated.value) return
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const settings = {
      signalType: signalType.value,
      frequency: frequency.value,
      duration: duration.value,
      sweepStart: sweepStart.value,
      sweepEnd: sweepEnd.value,
      sweepDuration: sweepDuration.value,
      pulsePeriod: pulsePeriod.value
    }

    await saveToolSettings(TOOL_ROUTE, user.id, settings)
  } catch (error) {
    console.warn('Error saving settings to cache:', error)
  }
}

// Watch for settings changes and save (debounced)
let saveTimeout = null
const debouncedSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = window.setTimeout(() => {
    saveSettings()
  }, 1000) // Save 1 second after last change
}

// Watch settings changes
watch([signalType, frequency, duration, sweepStart, sweepEnd, sweepDuration, pulsePeriod], () => {
  if (isAuthenticated.value) {
    debouncedSave()
  }
})

let audioContext = null
let oscillator = null
let noiseSource = null
let gainNode = null
let progressInterval = null
let stopTimeout = null
let startTime = 0

// Sweep-specific variables
let sweepOscillator = null
let sweepGainNode = null
let sweepSchedulerInterval = null
let nextSweepTime = 0

// Pulse-specific variables
let pulseNoiseSource = null
let pulseLFO = null
let pulseLFOGain = null
let pulseGainNode = null
let pulseNoiseBuffer = null

const frequencyPresets = [
  { label: '20 Hz', value: 20 },
  { label: '100 Hz', value: 100 },
  { label: '440 Hz (A4)', value: 440 },
  { label: '1 kHz', value: 1000 },
  { label: '10 kHz', value: 10000 }
]

const signalTypes = [
  { label: 'White Noise', value: 'white' },
  { label: 'Sine Wave', value: 'sine' },
  { label: 'Pink Noise', value: 'pink' },
  { label: 'Brown Noise', value: 'brown' },
  { label: 'Frequency Sweep', value: 'sweep' },
  { label: 'White Noise Pulse', value: 'pulse' }
]

const isReady = computed(() => {
  if (signalType.value === 'sine') {
    return frequency.value >= 20 && frequency.value <= 20000 && duration.value > 0
  }
  if (signalType.value === 'sweep') {
    return sweepStart.value >= 20 && sweepEnd.value >= 20 && 
           sweepStart.value <= 20000 && sweepEnd.value <= 20000 &&
           sweepStart.value < sweepEnd.value && sweepDuration.value > 0
  }
  if (signalType.value === 'pulse') {
    return pulsePeriod.value > 0
  }
  return duration.value > 0
})

const statusMessage = computed(() => {
  if (isPlaying.value) {
    return `Playing ${getSignalTypeName()}...`
  }
  return 'Ready to play sound.'
})

const selectSignalType = (type) => {
  if (isPlaying.value) {
    stopSignal()
  }
  signalType.value = type
}

const toggleStartStop = () => {
  if (isPlaying.value) {
    stopSignal()
  } else {
    startSignal()
  }
}

const initializeAudioContext = async () => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()
  }
  
  // CRITICAL: Resume audio context if suspended (required for mobile)
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume()
      console.log('AudioContext resumed, state:', audioContext.state)
    } catch (e) {
      console.error('Failed to resume AudioContext:', e)
    }
  }
  
  // Pre-generate noise buffer for pulse mode (avoid ScriptProcessorNode)
  if (!pulseNoiseBuffer && audioContext) {
    pulseNoiseBuffer = generateNoiseBuffer(audioContext, 2) // 2 seconds of noise
  }
}

// Generate a reusable noise buffer
const generateNoiseBuffer = (ctx, duration) => {
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  
  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  
  return buffer
}

const startSignal = async () => {
  if (!isReady.value) return
  
  await initializeAudioContext()
  
  if (!audioContext) return

  if (signalType.value === 'sweep') {
    startSweep()
  } else if (signalType.value === 'pulse') {
    startPulse()
  } else {
    startBasicSignal()
  }

  isPlaying.value = true
}

const startBasicSignal = () => {
  if (!audioContext) return
  
  const dur = duration.value
  gainNode = audioContext.createGain()
  
  // Set gain (quieter for pink noise)
  gainNode.gain.value = signalType.value === 'pink' ? 0.3 : 1
  gainNode.connect(audioContext.destination)

  if (signalType.value === 'sine') {
    oscillator = audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency.value
    oscillator.connect(gainNode)
    oscillator.start()
  } else {
    // Generate noise buffer
    noiseSource = audioContext.createBufferSource()
    const buffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * dur,
      audioContext.sampleRate
    )
    const data = buffer.getChannelData(0)

    if (signalType.value === 'white') {
      for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (signalType.value === 'pink') {
      generatePinkNoise(data)
    } else if (signalType.value === 'brown') {
      generateBrownNoise(data)
    }

    noiseSource.buffer = buffer
    noiseSource.connect(gainNode)
    noiseSource.start()
  }

  // Start progress bar
  startProgressBar(dur)

  // Automatically stop after duration
  stopTimeout = window.setTimeout(() => {
    stopSignal()
  }, dur * 1000)
}

const generatePinkNoise = (data) => {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    data[i] *= 0.11
    b6 = white * 0.115926
  }
}

const generateBrownNoise = (data) => {
  let lastOut = 0.0
  
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + 0.02 * white) / 1.02
    lastOut = data[i]
    data[i] *= 3.5
  }
}

// FIXED SWEEP: Uses native Web Audio scheduling
const startSweep = () => {
  if (!audioContext) return

  sweepGainNode = audioContext.createGain()
  sweepGainNode.connect(audioContext.destination)
  
  // Schedule the first sweep immediately
  nextSweepTime = audioContext.currentTime
  scheduleSweep()
  
  // Set up scheduler to keep sweeps going
  sweepSchedulerInterval = window.setInterval(() => {
    // Schedule next sweep if we're getting close to the end
    const now = audioContext.currentTime
    if (nextSweepTime - now < 1.0) {
      scheduleSweep()
    }
  }, 100)
}

const scheduleSweep = () => {
  if (!audioContext || !sweepGainNode) return
  
  const startFreq = sweepStart.value
  const endFreq = sweepEnd.value
  const sweepTime = sweepDuration.value
  const beepDuration = 0.2
  const gapDuration = 0.1
  
  // Create oscillator for this sweep
  const osc = audioContext.createOscillator()
  osc.type = 'sine'
  osc.connect(sweepGainNode)
  
  // Schedule frequency ramp
  osc.frequency.setValueAtTime(startFreq, nextSweepTime)
  osc.frequency.linearRampToValueAtTime(endFreq, nextSweepTime + sweepTime)
  
  // Add envelope to prevent clicks
  sweepGainNode.gain.setValueAtTime(0, nextSweepTime)
  sweepGainNode.gain.linearRampToValueAtTime(0.3, nextSweepTime + 0.01)
  sweepGainNode.gain.setValueAtTime(0.3, nextSweepTime + sweepTime - 0.01)
  sweepGainNode.gain.linearRampToValueAtTime(0, nextSweepTime + sweepTime)
  
  osc.start(nextSweepTime)
  osc.stop(nextSweepTime + sweepTime)
  
  // Schedule beep
  const beepStart = nextSweepTime + sweepTime + gapDuration
  const beepOsc = audioContext.createOscillator()
  beepOsc.type = 'sine'
  beepOsc.frequency.value = 1000
  beepOsc.connect(sweepGainNode)
  
  // Beep envelope
  sweepGainNode.gain.setValueAtTime(0, beepStart)
  sweepGainNode.gain.linearRampToValueAtTime(0.3, beepStart + 0.01)
  sweepGainNode.gain.setValueAtTime(0.3, beepStart + beepDuration - 0.01)
  sweepGainNode.gain.linearRampToValueAtTime(0, beepStart + beepDuration)
  
  beepOsc.start(beepStart)
  beepOsc.stop(beepStart + beepDuration)
  
  // Update next sweep time
  nextSweepTime = beepStart + beepDuration + gapDuration
}

// FIXED PULSE: Uses LFO (Low Frequency Oscillator) instead of ScriptProcessorNode
const startPulse = () => {
  if (!audioContext || !pulseNoiseBuffer) return
  
  // Create noise source with looping
  pulseNoiseSource = audioContext.createBufferSource()
  pulseNoiseSource.buffer = pulseNoiseBuffer
  pulseNoiseSource.loop = true // Seamless looping
  
  // Create LFO for pulsing effect
  pulseLFO = audioContext.createOscillator()
  pulseLFO.type = 'sine'
  pulseLFO.frequency.value = 1 / pulsePeriod.value // Convert period to frequency
  
  // Create gain node for main audio
  pulseGainNode = audioContext.createGain()
  pulseGainNode.gain.value = 0.505 // Offset (50.5% baseline)
  
  // Create gain node for LFO modulation depth
  pulseLFOGain = audioContext.createGain()
  pulseLFOGain.gain.value = 0.495 // Modulation depth (49.5%)
  // This gives us a range of 0.01 (1%) to 1.0 (100%)
  
  // Connect LFO to control gain
  pulseLFO.connect(pulseLFOGain)
  pulseLFOGain.connect(pulseGainNode.gain)
  
  // Connect noise source through gain to destination
  pulseNoiseSource.connect(pulseGainNode)
  pulseGainNode.connect(audioContext.destination)
  
  // Start everything
  pulseNoiseSource.start(0)
  pulseLFO.start(0)
}

const stopSignal = () => {
  // Stop basic signals
  if (oscillator) {
    try {
      oscillator.stop()
      oscillator.disconnect()
    } catch (e) {
      // Already stopped
    }
    oscillator = null
  }

  if (noiseSource) {
    try {
      noiseSource.stop()
      noiseSource.disconnect()
    } catch (e) {
      // Already stopped
    }
    noiseSource = null
  }

  if (gainNode) {
    gainNode.disconnect()
    gainNode = null
  }

  // Stop sweep
  if (sweepSchedulerInterval) {
    clearInterval(sweepSchedulerInterval)
    sweepSchedulerInterval = null
  }
  
  if (sweepGainNode) {
    sweepGainNode.disconnect()
    sweepGainNode = null
  }
  
  // Stop pulse
  if (pulseNoiseSource) {
    try {
      pulseNoiseSource.stop()
      pulseNoiseSource.disconnect()
    } catch (e) {
      // Already stopped
    }
    pulseNoiseSource = null
  }
  
  if (pulseLFO) {
    try {
      pulseLFO.stop()
      pulseLFO.disconnect()
    } catch (e) {
      // Already stopped
    }
    pulseLFO = null
  }
  
  if (pulseLFOGain) {
    pulseLFOGain.disconnect()
    pulseLFOGain = null
  }
  
  if (pulseGainNode) {
    pulseGainNode.disconnect()
    pulseGainNode = null
  }

  stopProgressBar()

  if (stopTimeout) {
    clearTimeout(stopTimeout)
    stopTimeout = null
  }

  isPlaying.value = false
  progressPercent.value = 0
}

const startProgressBar = (dur) => {
  progressPercent.value = 0
  startTime = Date.now()

  progressInterval = window.setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000
    const progress = Math.min((elapsed / dur) * 100, 100)
    progressPercent.value = progress

    if (progress >= 100) {
      stopProgressBar()
    }
  }, 100)
}

const stopProgressBar = () => {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
}

const getSignalTypeName = () => {
  const names = {
    white: 'White Noise',
    sine: 'Sine Wave',
    pink: 'Pink Noise',
    brown: 'Brown Noise',
    sweep: 'Frequency Sweep',
    pulse: 'White Noise Pulse'
  }
  return names[signalType.value] || signalType.value
}

const getSignalTypeDescription = () => {
  const descriptions = {
    white: 'White noise has equal energy at all frequencies, creating a flat frequency spectrum. Useful for frequency response testing.',
    pink: 'Pink noise has equal energy per octave, with decreasing power as frequency increases. Commonly used in audio testing.',
    brown: 'Brown noise (Brownian noise) has even more energy at lower frequencies. Produces a deeper, rumbling sound.'
  }
  return descriptions[signalType.value] || ''
}

onMounted(async () => {
  // Initialize audio context on mount
  initializeAudioContext()
  // Load saved settings
  await loadSettings()
})

onBeforeUnmount(() => {
  // Clean up audio resources
  stopSignal()
  if (audioContext) {
    audioContext.close()
  }
})
</script>

<style scoped>
.audio-signal-generator {
  width: 100%;
}

.generator-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-section,
.controls-section {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-light, #e0e0e0);
}

.info-section h3,
.controls-section h3 {
  margin-bottom: 1rem;
  color: var(--text-heading, #333);
  font-size: 1.3rem;
}

.info-section p {
  color: var(--text-secondary, #666);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.warning-note {
  color: #d9534f;
  font-weight: 600;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group:last-of-type {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary, #555);
  font-size: 0.95rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-light, #ddd);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #333);
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: var(--bg-tertiary, #f0f0f0);
  cursor: not-allowed;
  opacity: 0.6;
}

.frequency-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.preset-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-primary, #ffffff);
  border: 2px solid var(--border-light, #ddd);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary, #666);
  transition: all 0.2s ease;
}

.preset-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.preset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.signal-type-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.signal-tile {
  padding: 1rem;
  background: var(--bg-primary, #ffffff);
  border: 2px solid var(--border-light, #ddd);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary, #666);
  transition: all 0.2s ease;
  text-align: center;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.signal-tile:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.15);
}

.signal-tile.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.signal-tile.active:hover:not(:disabled) {
  background: #5568d3;
  border-color: #5568d3;
  transform: translateY(-2px);
}

.signal-tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-buttons {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-large {
  padding: 1rem 3rem;
  font-size: 1.1rem;
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.progress-container {
  width: 100%;
  background: var(--bg-tertiary, #e0e0e0);
  border-radius: 4px;
  height: 24px;
  margin: 1.5rem 0;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #5568d3 100%);
  transition: width 0.1s linear;
  border-radius: 4px;
}

.status-label {
  text-align: center;
  font-size: 1rem;
  color: var(--text-secondary, #666);
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary, #ffffff);
  border-radius: 6px;
  border: 1px solid var(--border-light, #e0e0e0);
}

.status-label.playing {
  color: #28a745;
  font-weight: 600;
  border-color: #28a745;
}

.info-box {
  background: var(--bg-primary, #ffffff);
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--border-light, #e0e0e0);
}

.info-box h4 {
  margin-bottom: 0.75rem;
  color: var(--text-heading, #333);
  font-size: 1.1rem;
}

.info-box p {
  color: var(--text-secondary, #666);
  line-height: 1.6;
  margin: 0;
}

.footer-note {
  text-align: center;
  padding: 1rem;
  color: var(--text-muted, #999);
  font-size: 0.85rem;
}

.footer-note p {
  margin: 0.25rem 0;
}

.footer-note .note {
  font-size: 0.8rem;
  color: var(--text-quaternary, #bbb);
  font-style: italic;
}

.offline-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #28a745;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.badge-icon {
  font-size: 1rem;
}

.badge-text {
  display: inline-block;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .info-section,
  .controls-section {
    padding: 1rem;
  }

  .frequency-presets {
    grid-template-columns: repeat(2, 1fr);
  }

  .preset-btn {
    flex: 1;
    min-width: 80px;
  }

  .signal-type-tiles {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .signal-tile {
    padding: 0.875rem 0.5rem;
    font-size: 0.85rem;
    min-height: 50px;
  }

  .btn-large {
    padding: 0.875rem 2rem;
    font-size: 1rem;
  }
}
</style>

