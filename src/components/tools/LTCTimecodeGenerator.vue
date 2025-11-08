<template>
  <div class="ltc-timecode-generator">
    <div class="generator-container">
      <!-- Header -->
      <div class="header-section">
        <h2 class="title">LTC Timecode Generator</h2>
        <p class="subtitle">Pick a frame rate and time source. Use <b>Test Tone</b> to verify your audio path.</p>
      </div>

      <!-- Timecode Display -->
      <div class="tc-display">
        <div id="tcVal" class="tc-value">{{ displayTimecode }}</div>
        <div class="tc-meta">
          <span :class="['led', { on: isRunning || toneOn }]"></span>
          <span id="state">{{ stateText }}</span> · <span id="env">{{ envText }}</span>
        </div>
        <div class="tc-meta">
          <small id="rmsInfo">{{ rmsInfo }}</small>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-section">
        <div class="control-grid">
          <div class="control-item">
            <label class="control-label">Frame Rate</label>
            <select
              id="fps"
              v-model="frameRate"
              :disabled="isRunning"
              class="form-input"
              @change="handleFrameRateChange"
            >
              <option value="23.976">23.976</option>
              <option value="24">24</option>
              <option value="25">25</option>
              <option value="29.97">29.97</option>
              <option value="29.97DF">29.97 DF</option>
              <option value="30">30</option>
            </select>
          </div>

          <div class="control-item full-width">
            <label class="control-label">Time Source</label>
            <div class="time-source">
              <label class="radio-option">
                <input
                  id="srcDev"
                  v-model="timeSource"
                  type="radio"
                  value="device"
                  :disabled="isRunning"
                />
                Device time
              </label>
              <label class="radio-option">
                <input
                  id="srcCustom"
                  v-model="timeSource"
                  type="radio"
                  value="custom"
                  :disabled="isRunning"
                />
                Custom start
              </label>
              <div v-if="timeSource === 'custom'" class="tc-inputs">
                <input
                  id="hh"
                  v-model.number="customTime.h"
                  type="number"
                  min="0"
                  max="23"
                  :disabled="isRunning"
                  class="tc-input"
                />
                <span class="tc-sep">{{ dropFrameComputed ? ';' : ':' }}</span>
                <input
                  id="mm"
                  v-model.number="customTime.m"
                  type="number"
                  min="0"
                  max="59"
                  :disabled="isRunning"
                  class="tc-input"
                />
                <span class="tc-sep">:</span>
                <input
                  id="ss"
                  v-model.number="customTime.s"
                  type="number"
                  min="0"
                  max="59"
                  :disabled="isRunning"
                  class="tc-input"
                />
                <span :id="frameSep" class="tc-sep">{{ dropFrameComputed ? ';' : ':' }}</span>
                <input
                  id="ff"
                  v-model.number="customTime.f"
                  type="number"
                  :min="0"
                  :max="maxFrame"
                  :disabled="isRunning"
                  class="tc-input"
                />
              </div>
            </div>
            <div class="help-text">
              In DF mode the display uses a semicolon (e.g., 01:23:45;<span style="text-decoration:overline">12</span>).
            </div>
          </div>

          <div class="control-item full-width">
            <div class="button-row">
              <button
                id="start"
                class="btn btn-start"
                :disabled="isRunning"
                @click="startLTC"
              >
                Start LTC
              </button>
              <button
                id="stop"
                class="btn btn-stop"
                :disabled="!isRunning"
                @click="stopLTC"
              >
                Stop
              </button>
              <button
                id="tone"
                class="btn btn-tone"
                @click="toggleTone"
              >
                Test Tone (1 kHz)
              </button>
              <button
                id="advBtn"
                class="btn btn-ghost"
                title="Show advanced settings"
                @click="showAdvanced = true"
              >
                Advanced…
              </button>
            </div>
          </div>

          <!-- Presets Section -->
          <div class="control-item full-width">
            <label class="control-label">Presets</label>
            <div class="presets-section">
              <div class="presets-list">
                <button
                  v-for="(preset, index) in presets"
                  :key="index"
                  class="preset-btn"
                  :class="{ active: selectedPresetIndex === index, empty: !preset.name }"
                  :disabled="isRunning"
                  @click="preset.name ? loadPreset(index) : (presetSlotInput = index, showSavePresetModal = true)"
                >
                  {{ preset.name || `Slot ${index + 1} (Empty)` }}
                </button>
              </div>
              <div class="preset-actions">
                <button
                  class="btn btn-sm btn-save-current"
                  :disabled="isRunning"
                  @click="showSavePresetModal = true"
                >
                  Save Current
                </button>
                <button
                  v-if="selectedPresetIndex !== null && presets[selectedPresetIndex]?.name"
                  class="btn btn-sm btn-danger"
                  :disabled="isRunning"
                  @click="deletePreset(selectedPresetIndex)"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        </div>

        <p class="footnote">
          Advanced defaults are tuned for Deity TC‑1 (Line‑in, TRS, timecode on left channel). 
          Changing them may stop lock; use <b>Reset to Recommended</b> if needed.
        </p>
      </div>

      <!-- Save Preset Modal -->
      <div v-if="showSavePresetModal" class="modal-backdrop" @click.self="showSavePresetModal = false">
        <div class="modal modal-small">
          <div class="modal-header">
            <h3 class="modal-title">
              {{ selectedPresetIndex !== null ? 'Save Preset' : 'Save New Preset' }}
            </h3>
            <button class="btn btn-secondary" @click="showSavePresetModal = false">Cancel</button>
          </div>
          <div class="modal-body">
            <div class="modal-item full-width">
              <label class="control-label">Preset Name</label>
              <input
                v-model="presetNameInput"
                type="text"
                placeholder="Enter preset name (e.g., Deity TC-1, Zoom F8, etc.)"
                class="form-input"
                maxlength="50"
                @keyup.enter="saveCurrentAsPreset"
              />
            </div>
            <div class="modal-item full-width">
              <label class="control-label">Preset Slot</label>
              <select v-model="presetSlotInput" class="form-input">
                <option v-for="i in 6" :key="i" :value="i - 1">
                  Slot {{ i }}{{ presets[i - 1] ? ` (${presets[i - 1].name})` : ' (Empty)' }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showSavePresetModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveCurrentAsPreset">Save</button>
          </div>
        </div>
      </div>

      <!-- Manage Presets Modal -->
      <div v-if="showManagePresets" class="modal-backdrop" @click.self="showManagePresets = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Manage Presets</h3>
            <button class="btn btn-secondary" @click="showManagePresets = false">Close</button>
          </div>
          <div class="modal-body">
            <div class="presets-management">
              <div
                v-for="(preset, index) in presets"
                :key="index"
                class="preset-item"
              >
                <div class="preset-info">
                  <strong>Slot {{ index + 1 }}: {{ preset.name || `Preset ${index + 1}` }}</strong>
                  <div class="preset-details">
                    Frame Rate: {{ preset.frameRate }}, 
                    Channel: {{ preset.advancedSettings.channel }}, 
                    Level: {{ Math.round(preset.advancedSettings.gain * 100) }}%
                  </div>
                </div>
                <div class="preset-item-actions">
                  <button class="btn btn-sm btn-secondary" @click="loadPreset(index)">Load</button>
                  <button class="btn btn-sm btn-secondary" @click="renamePreset(index)">Rename</button>
                  <button class="btn btn-sm btn-danger" @click="deletePreset(index)">Delete</button>
                </div>
              </div>
              <div v-if="presets.length === 0" class="empty-presets">
                <p>No presets saved yet. Click "Add Preset" to save your first preset.</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showManagePresets = false">Close</button>
          </div>
        </div>
      </div>

      <!-- Advanced Settings Modal -->
      <div v-if="showAdvanced" class="modal-backdrop" @click.self="showAdvanced = false">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Advanced settings (hardware troubleshooting)</h3>
            <button class="btn btn-secondary" @click="showAdvanced = false">Close</button>
          </div>
          <div class="modal-body">
            <div class="modal-warning">
              Changing these may stop some devices from detecting LTC. If your device stops locking, use <b>Reset to Recommended</b>.
            </div>
            <div class="modal-grid">
              <div class="modal-item full-width">
                <label class="control-label">Audio Output (device)</label>
                <select
                  id="sinkSelect"
                  v-model="advancedSettings.sinkId"
                  class="form-input"
                >
                  <option value="">Default output</option>
                  <option
                    v-for="device in audioOutputs"
                    :key="device.deviceId"
                    :value="device.deviceId"
                  >
                    {{ device.label || `Device ${device.deviceId}` }}
                  </option>
                </select>
                <div class="help-text">{{ sinkHint }}</div>
              </div>
              <div class="modal-item">
                <label class="control-label">
                  Start Polarity <span class="small">(applies on next Start)</span>
                </label>
                <select
                  id="polarity"
                  v-model="advancedSettings.polarity"
                  class="form-input"
                >
                  <option value="positive">Start Positive</option>
                  <option value="negative">Start Negative</option>
                </select>
              </div>
              <div class="modal-item">
                <label class="control-label">Output Channel</label>
                <select
                  id="channel"
                  v-model="advancedSettings.channel"
                  class="form-input"
                >
                  <option value="left">Left (Tip)</option>
                  <option value="both">Both</option>
                  <option value="right">Right (Ring)</option>
                </select>
              </div>
              <div class="modal-item">
                <label class="control-label">Output Level</label>
                <div class="range-control">
                  <input
                    type="range"
                    id="gain"
                    v-model.number="advancedSettings.gain"
                    min="0"
                    max="1"
                    step="0.01"
                    class="range-input"
                  />
                  <strong id="gainVal">{{ Math.round(advancedSettings.gain * 100) }}%</strong>
                </div>
              </div>
              <div class="modal-item">
                <label class="control-label">Edge smoothing (μs)</label>
                <div class="range-control">
                  <input
                    type="range"
                    id="smoothing"
                    v-model.number="advancedSettings.smoothingUs"
                    min="0"
                    max="40"
                    step="1"
                    class="range-input"
                  />
                  <strong id="smoothVal">{{ smoothingLabel }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="resetAdvancedSettings">
              Reset to Recommended
            </button>
            <button class="btn btn-primary" @click="applyAdvancedSettings">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>

    <audio id="out" ref="audioElementRef" autoplay></audio>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

// State
const frameRate = ref('25')
const timeSource = ref('device')
const customTime = ref({ h: 0, m: 0, s: 0, f: 0 })
const isRunning = ref(false)
const toneOn = ref(false)
const showAdvanced = ref(false)
const showSavePresetModal = ref(false)
const showManagePresets = ref(false)
const selectedPresetIndex = ref(null)
const presetNameInput = ref('')
const presetSlotInput = ref(0)

const stateText = ref('Stopped')
const envText = ref('Ready – choose frame rate & time source, then Start')
const rmsInfo = ref('RMS: —')

// Advanced settings
const advancedSettings = ref({
  sinkId: '',
  polarity: 'positive',
  channel: 'left',
  gain: 0.8,
  smoothingUs: 7
})

const audioOutputs = ref([])
const sinkHint = ref('')

// Presets
const presets = ref([])
const PRESETS_STORAGE_KEY = 'ltc-timecode-presets'
const MAX_PRESETS = 6

// Audio context
let audioContext = null
let masterGain = null
let panner = null
let lpf = null
let analyser = null
let streamDest = null
const audioElementRef = ref(null)

// LTC state
let scheduleTimer = null
let nextFrameTime = 0
let osc = null
let frameRateExact = 25.0
let dropFrame = false
let useDeviceTime = true
let tc = { h: 0, m: 0, s: 0, f: 0 }
let streamLevel = 1
let sampleAccTotal = 0
let samplesEmitted = 0
let ctx0 = 0
let date0ms = 0

const dropFrameComputed = computed(() => frameRate.value === '29.97DF')

const maxFrame = computed(() => {
  const v = frameRate.value
  if (v === '23.976') return 23
  if (v === '29.97' || v === '29.97DF') return 29
  return parseInt(v, 10) - 1
})

const displayTimecode = computed(() => {
  const sep = dropFrameComputed.value ? ';' : ':'
  const t = timeSource.value === 'device' && isRunning.value && audioContext
    ? getTCFromSystemMs(date0ms + (audioContext.currentTime - ctx0) * 1000)
    : customTime.value
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}:${String(t.s).padStart(2, '0')}${sep}${String(t.f).padStart(2, '0')}`
})

const smoothingLabel = computed(() => {
  const us = advancedSettings.value.smoothingUs
  if (!us || us <= 0) return 'Off'
  const tau = us / 2.2 * 1e-6
  const fc = us ? Math.round(1 / (2 * Math.PI * tau)) : '∞'
  return `${us} μs (~${fc} Hz)`
})

const handleFrameRateChange = () => {
  setRateFromUI()
  if (customTime.value.f > maxFrame.value) {
    customTime.value.f = maxFrame.value
  }
}

const setRateFromUI = () => {
  const v = frameRate.value
  dropFrame = (v === '29.97DF')
  if (v === '23.976') frameRateExact = 24000 / 1001
  else if (v === '29.97' || v === '29.97DF') frameRateExact = 30000 / 1001
  else frameRateExact = parseFloat(v)
}

const bcd4LSB = (n) => {
  return [(n >> 0) & 1, (n >> 1) & 1, (n >> 2) & 1, (n >> 3) & 1]
}

const buildFrameBits = (time) => {
  const b = new Uint8Array(80)
  const fU = time.f % 10, fT = Math.floor(time.f / 10)
  const sU = time.s % 10, sT = Math.floor(time.s / 10)
  const mU = time.m % 10, mT = Math.floor(time.m / 10)
  const hU = time.h % 10, hT = Math.floor(time.h / 10)

  const fUb = bcd4LSB(fU)
  b[0] = fUb[0]; b[1] = fUb[1]; b[2] = fUb[2]; b[3] = fUb[3]
  b[8] = (fT >> 0) & 1; b[9] = (fT >> 1) & 1
  b[10] = dropFrame ? 1 : 0; b[11] = 0

  const sUb = bcd4LSB(sU)
  b[16] = sUb[0]; b[17] = sUb[1]; b[18] = sUb[2]; b[19] = sUb[3]
  b[24] = (sT >> 0) & 1; b[25] = (sT >> 1) & 1; b[26] = (sT >> 2) & 1

  const corr = (Math.round(frameRateExact) === 25) ? 59 : 27
  let ones = 0
  for (let i = 0; i < 64; i++) {
    if (i === corr) continue
    ones += b[i] ? 1 : 0
  }
  b[corr] = (ones & 1) ? 1 : 0 // even parity

  const mUb = bcd4LSB(mU)
  b[32] = mUb[0]; b[33] = mUb[1]; b[34] = mUb[2]; b[35] = mUb[3]
  b[40] = (mT >> 0) & 1; b[41] = (mT >> 1) & 1; b[42] = (mT >> 2) & 1
  b[43] = 0
  const hUb = bcd4LSB(hU)
  b[48] = hUb[0]; b[49] = hUb[1]; b[50] = hUb[2]; b[51] = hUb[3]
  b[56] = (hT >> 0) & 1; b[57] = (hT >> 1) & 1

  const sync = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1] // 0x3FFD LSB-first
  for (let i = 0; i < 16; i++) b[64 + i] = sync[i]
  return b
}

const incTC = () => {
  if (!dropFrame) {
    tc.f++
    if (tc.f >= Math.round(frameRateExact)) {
      tc.f = 0
      tc.s++
      if (tc.s >= 60) {
        tc.s = 0
        tc.m++
        if (tc.m >= 60) {
          tc.m = 0
          tc.h = (tc.h + 1) % 24
        }
      }
    }
    return
  }

  const fpsNominal = 30
  tc.f++
  if (tc.f >= fpsNominal) {
    tc.f = 0
    tc.s++
    if (tc.s >= 60) {
      tc.s = 0
      tc.m++
      if (tc.m >= 60) {
        tc.m = 0
        tc.h = (tc.h + 1) % 24
      }
    }
  }
  if (tc.s === 0 && tc.f === 0 && (tc.m % 10) !== 0) tc.f = 2
}

const getTCFromSystemMs = (ms) => {
  const d = new Date(ms)
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds()
  const frac = (ms / 1000) - Math.floor(ms / 1000)
  let f

  if (dropFrame) {
    if (s === 0 && (m % 10) !== 0) f = Math.floor(frac * 28) + 2
    else f = Math.floor(frac * 30)
    if (f > 29) f = 29
  } else {
    const nominal = (Math.abs(frameRateExact - 23.976) < 0.001) ? 24
      : (Math.abs(frameRateExact - 29.97) < 0.01) ? 30
      : Math.round(frameRateExact)
    f = Math.floor(frac * nominal)
    if (f > nominal - 1) f = nominal - 1
  }

  return { h, m, s, f }
}

const genWaveform80 = (bits, totalSamples, levelIn) => {
  const out = new Float32Array(totalSamples)
  const spp = totalSamples / 80
  let carry = 0, idx = 0, level = levelIn

  for (let i = 0; i < 80; i++) {
    let len = Math.floor(spp + carry)
    carry = (carry + spp) - len

    if (bits[i] === 1) {
      const a = Math.floor(len / 2), b = len - a
      for (let s = 0; s < a; s++) out[idx++] = level
      level = -level
      for (let s = 0; s < b; s++) out[idx++] = level
    } else {
      for (let s = 0; s < len; s++) out[idx++] = level
    }
    level = -level
  }

  while (idx < totalSamples) out[idx++] = level
  return { data: out, levelOut: level }
}

const mapChannel = () => {
  if (!panner || !audioContext) return
  const pan = (advancedSettings.value.channel === 'left') ? -1
    : (advancedSettings.value.channel === 'right') ? 1
    : 0
  panner.pan.setValueAtTime(pan, audioContext.currentTime)
}

const applySmoothing = (us) => {
  if (!lpf || !audioContext) return
  if (!us || us <= 0) {
    lpf.frequency.setValueAtTime(audioContext.sampleRate / 2, audioContext.currentTime)
    return
  }
  const tau = us / 2.2 * 1e-6
  const fc = 1 / (2 * Math.PI * tau)
  lpf.frequency.setValueAtTime(Math.min(fc, audioContext.sampleRate / 2), audioContext.currentTime)
}

const readRMS = () => {
  if (!analyser) return
  const arr = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(arr)
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    const x = (arr[i] - 128) / 128
    sum += x * x
  }
  const rms = Math.sqrt(sum / arr.length)
  rmsInfo.value = `RMS: ${(rms * 100).toFixed(1)}%`
}

const schedule = () => {
  if (!isRunning.value || !audioContext) return

  const now = audioContext.currentTime
  const sr = audioContext.sampleRate

  while (nextFrameTime < now + 0.100) {
    sampleAccTotal += sr / frameRateExact
    const totalSamples = Math.max(1, Math.round(sampleAccTotal) - samplesEmitted)
    samplesEmitted += totalSamples

    const tForFrame = useDeviceTime
      ? getTCFromSystemMs(date0ms + (nextFrameTime - ctx0) * 1000)
      : { ...tc }

    const bits = buildFrameBits(tForFrame)
    const wav = genWaveform80(bits, totalSamples, streamLevel)
    streamLevel = wav.levelOut

    const buf = audioContext.createBuffer(1, totalSamples, sr)
    buf.copyToChannel(wav.data, 0)
    const src = audioContext.createBufferSource()
    src.buffer = buf
    src.connect(masterGain)
    src.start(nextFrameTime)

    nextFrameTime += totalSamples / sr
    if (!useDeviceTime) incTC()
  }

  readRMS()
  scheduleTimer = window.setTimeout(() => schedule(), 25)
}

const applySink = async () => {
  const audioEl = audioElementRef.value
  if (!audioEl || typeof audioEl.setSinkId !== 'function') return
  try {
    await audioEl.setSinkId(advancedSettings.value.sinkId || '')
    await audioEl.play().catch(() => {})
  } catch (e) {
    console.warn('setSinkId failed', e)
  }
}

const startLTC = async () => {
  if (toneOn.value) await toggleTone(true)
  if (isRunning.value) return

  useDeviceTime = timeSource.value === 'device'
  setRateFromUI()

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  audioContext = new AudioContextClass({ latencyHint: 'interactive' })
  await audioContext.resume()

  masterGain = audioContext.createGain()
  panner = audioContext.createStereoPanner()
  lpf = audioContext.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.Q.value = 0.707
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256

  masterGain.gain.setValueAtTime(0, audioContext.currentTime)

  const audioEl = audioElementRef.value
  if (audioEl && typeof audioEl.setSinkId === 'function') {
    streamDest = audioContext.createMediaStreamDestination()
    masterGain.connect(lpf)
    lpf.connect(panner)
    panner.connect(streamDest)
    panner.connect(analyser)
    audioEl.srcObject = streamDest.stream
    await applySink()
    await audioEl.play().catch(() => {})
  } else {
    masterGain.connect(lpf)
    lpf.connect(panner)
    panner.connect(audioContext.destination)
    panner.connect(analyser)
  }

  masterGain.gain.linearRampToValueAtTime(advancedSettings.value.gain, audioContext.currentTime + 0.010)
  mapChannel()
  applySmoothing(advancedSettings.value.smoothingUs)
  streamLevel = (advancedSettings.value.polarity === 'negative') ? -1 : 1

  ctx0 = audioContext.currentTime
  date0ms = Date.now()

  if (!useDeviceTime) {
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)))
    tc.h = clamp(customTime.value.h || 0, 0, 23)
    tc.m = clamp(customTime.value.m || 0, 0, 59)
    tc.s = clamp(customTime.value.s || 0, 0, 59)
    tc.f = clamp(customTime.value.f || 0, 0, maxFrame.value)
  }

  samplesEmitted = 0
  sampleAccTotal = 0
  nextFrameTime = audioContext.currentTime + 0.05

  isRunning.value = true
  schedule()

  stateText.value = 'Generating LTC'
  envText.value = `sr=${audioContext.sampleRate}Hz · ${useDeviceTime ? 'Device time' : 'Custom start'}`
}

const stopLTC = async () => {
  if (!audioContext) return
  isRunning.value = false
  if (scheduleTimer) {
    clearTimeout(scheduleTimer)
    scheduleTimer = null
  }
  if (masterGain) {
    masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01)
  }
  setTimeout(async () => {
    try {
      await audioContext.close()
    } catch {}
    audioContext = null
  }, 40)

  stateText.value = 'Stopped'
  rmsInfo.value = 'RMS: —'
  envText.value = '—'
}

const toggleTone = async (forceOff) => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()
  }

  const wantOff = (forceOff === true) || toneOn.value
  if (wantOff) {
    toneOn.value = false
    if (osc) {
      try {
        osc.stop()
      } catch {}
      osc.disconnect()
      osc = null
    }
    stateText.value = isRunning.value ? 'Generating LTC' : 'Stopped'
    return
  }

  if (isRunning.value) await stopLTC()
  toneOn.value = true

  masterGain = audioContext.createGain()
  masterGain.gain.value = advancedSettings.value.gain
  panner = audioContext.createStereoPanner()
  lpf = audioContext.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.Q.value = 0.707
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256

  const audioEl = audioElementRef.value
  if (audioEl && typeof audioEl.setSinkId === 'function') {
    streamDest = audioContext.createMediaStreamDestination()
    masterGain.connect(lpf)
    lpf.connect(panner)
    panner.connect(streamDest)
    panner.connect(analyser)
    audioEl.srcObject = streamDest.stream
    await applySink()
    await audioEl.play().catch(() => {})
  } else {
    masterGain.connect(lpf)
    lpf.connect(panner)
    panner.connect(audioContext.destination)
    panner.connect(analyser)
  }

  mapChannel()
  applySmoothing(advancedSettings.value.smoothingUs)

  osc = audioContext.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 1000
  osc.connect(masterGain)
  osc.start()

  stateText.value = 'Test Tone (1 kHz)'
}

const populateSinkList = async () => {
  const audioEl = audioElementRef.value
  if (!audioEl || typeof audioEl.setSinkId !== 'function') {
    sinkHint.value = 'Output selection needs Chrome/Edge over HTTPS. Using default output.'
    return
  }

  sinkHint.value = 'Choose the interface feeding your TC device.'

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {}

  const devs = await navigator.mediaDevices.enumerateDevices()
  const outs = devs.filter(d => d.kind === 'audiooutput')
  audioOutputs.value = outs
}

const resetAdvancedSettings = () => {
  advancedSettings.value = {
    sinkId: '',
    polarity: 'positive',
    channel: 'left',
    gain: 0.8,
    smoothingUs: 7
  }
}

const applyAdvancedSettings = () => {
  if (isRunning.value && audioContext) {
    if (masterGain) {
      masterGain.gain.setTargetAtTime(advancedSettings.value.gain, audioContext.currentTime, 0.01)
    }
    mapChannel()
    applySmoothing(advancedSettings.value.smoothingUs)
    applySink()
  }
  showAdvanced.value = false
}

// Preset management functions
const loadPresets = () => {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (stored) {
      presets.value = JSON.parse(stored)
      // Ensure we don't exceed max presets
      if (presets.value.length > MAX_PRESETS) {
        presets.value = presets.value.slice(0, MAX_PRESETS)
        savePresets()
      }
      // Pad with empty slots up to max
      while (presets.value.length < MAX_PRESETS) {
        presets.value.push(createEmptyPreset())
      }
    } else {
      // Initialize with empty presets
      presets.value = Array(MAX_PRESETS).fill(null).map(() => createEmptyPreset())
    }
  } catch (e) {
    console.error('Failed to load presets:', e)
    presets.value = Array(MAX_PRESETS).fill(null).map(() => createEmptyPreset())
  }
}

const createEmptyPreset = () => ({
  name: '',
  frameRate: '25',
  timeSource: 'device',
  customTime: { h: 0, m: 0, s: 0, f: 0 },
  advancedSettings: {
    sinkId: '',
    polarity: 'positive',
    channel: 'left',
    gain: 0.8,
    smoothingUs: 7
  }
})

const savePresets = () => {
  try {
    // Only save non-empty presets
    const toSave = presets.value.filter(p => p.name.trim() !== '')
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(toSave))
    // Reload to get proper structure
    loadPresets()
  } catch (e) {
    console.error('Failed to save presets:', e)
  }
}

const saveCurrentAsPreset = () => {
  if (!presetNameInput.value.trim()) {
    alert('Please enter a preset name')
    return
  }

  const slot = presetSlotInput.value
  if (slot < 0 || slot >= MAX_PRESETS) {
    alert('Invalid preset slot')
    return
  }

  const preset = {
    name: presetNameInput.value.trim(),
    frameRate: frameRate.value,
    timeSource: timeSource.value,
    customTime: { ...customTime.value },
    advancedSettings: {
      sinkId: advancedSettings.value.sinkId,
      polarity: advancedSettings.value.polarity,
      channel: advancedSettings.value.channel,
      gain: advancedSettings.value.gain,
      smoothingUs: advancedSettings.value.smoothingUs
    }
  }

  presets.value[slot] = preset
  savePresets()
  selectedPresetIndex.value = slot
  presetNameInput.value = ''
  presetSlotInput.value = slot < MAX_PRESETS - 1 ? slot + 1 : 0
  showSavePresetModal.value = false
}

const loadPreset = (index) => {
  if (isRunning.value) {
    alert('Please stop the LTC generator before loading a preset')
    return
  }

  if (index < 0 || index >= presets.value.length || !presets.value[index] || !presets.value[index].name) {
    alert('This preset slot is empty')
    return
  }

  const preset = presets.value[index]
  
  frameRate.value = preset.frameRate
  timeSource.value = preset.timeSource
  customTime.value = { ...preset.customTime }
  advancedSettings.value = {
    sinkId: preset.advancedSettings.sinkId,
    polarity: preset.advancedSettings.polarity,
    channel: preset.advancedSettings.channel,
    gain: preset.advancedSettings.gain,
    smoothingUs: preset.advancedSettings.smoothingUs
  }

  setRateFromUI()
  selectedPresetIndex.value = index
  
  // Update audio outputs if available
  populateSinkList()
}

const deletePreset = (index) => {
  if (!confirm(`Delete preset "${presets.value[index]?.name || `Preset ${index + 1}`}"?`)) {
    return
  }

  presets.value[index] = createEmptyPreset()
  savePresets()
  
  if (selectedPresetIndex.value === index) {
    selectedPresetIndex.value = null
  }
}

const renamePreset = (index) => {
  const currentName = presets.value[index]?.name || ''
  const newName = prompt('Enter new preset name:', currentName)
  if (newName && newName.trim()) {
    if (presets.value[index] && presets.value[index].name) {
      presets.value[index].name = newName.trim()
      savePresets()
    }
  }
}

onMounted(() => {
  setRateFromUI()
  populateSinkList()
  loadPresets()
})

onBeforeUnmount(() => {
  stopLTC()
  if (toneOn.value) toggleTone(true)
  if (audioContext) {
    audioContext.close()
  }
})

watch(dropFrameComputed, (newVal) => {
  dropFrame = newVal
})
</script>

<style scoped>
.ltc-timecode-generator {
  width: 100%;
}

.generator-container {
  max-width: 720px;
  margin: 0 auto;
}

.header-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.title {
  margin: 0 0 6px;
  font-size: 1.75rem;
  color: var(--text-heading, #1a202c);
}

.subtitle {
  margin: 0 0 16px;
  color: var(--text-secondary, #718096);
  font-size: 0.95rem;
}

.tc-display {
  background: #1a202c;
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  margin-bottom: 1.5rem;
}

.tc-value {
  font-family: 'Courier New', monospace;
  color: #48bb78;
  font-weight: 700;
  font-size: 2.5rem;
  letter-spacing: 2px;
  text-shadow: 0 0 8px rgba(72, 187, 120, 0.5);
  margin-bottom: 0.5rem;
}

.tc-meta {
  color: var(--text-tertiary, #a0aec0);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  background: #cbd5e0;
}

.led.on {
  background: #48bb78;
  box-shadow: 0 0 10px rgba(72, 187, 120, 0.6);
}

.controls-section {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid var(--border-light, #e0e0e0);
}

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.control-item {
  display: flex;
  flex-direction: column;
}

.control-item.full-width {
  grid-column: 1 / -1;
}

.control-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary, #4a5568);
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-light, #e2e8f0);
  border-radius: 8px;
  font-size: 0.95rem;
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

.time-source {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--text-primary, #2d3748);
  cursor: pointer;
}

.tc-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.tc-input {
  width: 56px;
  padding: 0.625rem 0.5rem;
  border: 2px solid var(--border-light, #e2e8f0);
  border-radius: 8px;
  font-size: 1rem;
  font-family: 'Courier New', monospace;
  text-align: center;
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #333);
}

.tc-sep {
  font-size: 1.125rem;
  color: var(--text-secondary, #4a5568);
}

.help-text {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #718096);
}

.button-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  flex: 1;
  min-width: 140px;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-start {
  background: linear-gradient(135deg, #48bb78, #38a169);
}

.btn-stop {
  background: linear-gradient(135deg, #f56565, #e53e3e);
}

.btn-tone {
  background: linear-gradient(135deg, #4299e1, #3182ce);
}

.btn-ghost {
  flex: 0 0 auto;
  background: transparent;
  color: var(--text-secondary, #4a5568);
  border: 2px solid var(--border-light, #e2e8f0);
}

.btn-ghost:hover {
  border-color: #805ad5;
  color: #805ad5;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4c51bf;
  color: white;
}

.btn-secondary {
  background: #edf2f7;
  color: #2d3748;
}

.btn-save-current {
  background: #15803d;
  color: #ffffff;
  border: 2px solid #15803d;
}

.btn-save-current:hover:not(:disabled) {
  background: #166534;
  border-color: #166534;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(21, 128, 61, 0.3);
}

.btn-save-current:disabled {
  background: #6b7280;
  border-color: #6b7280;
  cursor: not-allowed;
  opacity: 0.6;
}

.footnote {
  color: var(--text-tertiary, #718096);
  font-size: 0.75rem;
  margin-top: 1rem;
  text-align: center;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2147483647;
}

.modal {
  width: 100%;
  max-width: 760px;
  background: var(--bg-primary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.modal-header {
  padding: 1rem 1.25rem;
  background: var(--bg-elevated, #1a202c);
  color: var(--text-primary, #ffffff);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.modal-body {
  padding: 1.125rem 1.25rem;
}

.modal-warning {
  border: 2px solid #fed7d7;
  background: var(--bg-secondary, #fff5f5);
  color: #c53030;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 0.75rem;
}

.modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.875rem;
}

.modal-item {
  display: flex;
  flex-direction: column;
}

.modal-item.full-width {
  grid-column: 1 / -1;
}

.small {
  font-size: 0.75rem;
  color: var(--text-secondary, #4a5568);
}

.range-control {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.range-input {
  width: 100%;
}

.modal-footer {
  padding: 1rem 1.25rem;
  display: flex;
  gap: 0.625rem;
  justify-content: flex-end;
  background: var(--bg-secondary, #f7fafc);
}

.modal-small {
  max-width: 500px;
}

.presets-section {
  margin-top: 0.5rem;
}

.presets-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.preset-btn {
  padding: 0.625rem 0.75rem;
  border: 2px solid var(--border-light, #e2e8f0);
  border-radius: 8px;
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #4a5568);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
  background: #f8f9ff;
}

.preset-btn.active {
  border-color: #667eea;
  background: #667eea;
  color: white;
}

.preset-btn.empty {
  opacity: 0.6;
  font-style: italic;
}

.preset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.btn-danger {
  background: #f56565;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #e53e3e;
}

.presets-management {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
}

.preset-info {
  flex: 1;
}

.preset-info strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-primary, #2d3748);
}

.preset-details {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #718096);
}

.preset-item-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-presets {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #718096);
}

@media (max-width: 768px) {
  .presets-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .preset-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .preset-item-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .control-grid {
    grid-template-columns: 1fr;
  }

  .button-row {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .modal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
