// Dante Personal Monitor Mixer - Audio Engine Composable
// Manages Web Audio API nodes and peak level meters

import { ref, onMounted, onBeforeUnmount } from 'vue';
import { OpusDecoderManager } from './useOpusDecoder';

export class AudioMixerEngine {
  constructor(channelCount, sampleRate) {
    this.channelCount = channelCount;
    this.sampleRate = sampleRate;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: sampleRate,
    });
    
    // Create Web Audio nodes for each input channel
    this.gainNodes = [];
    this.panNodes = [];
    this.analyserNodes = [];
    this.peakLevels = new Array(channelCount).fill(-60); // Initialize to -60dB
    this.peakHolds = new Array(channelCount).fill(-60);
    this.peakHoldTimers = new Array(channelCount).fill(null);
    
    // Create audio processing chain for each channel
    for (let i = 0; i < channelCount; i++) {
      const gainNode = this.audioContext.createGain();
      const analyserNode = this.audioContext.createAnalyser();
      const panNode = this.audioContext.createStereoPanner();
      
      // Configure analyser for peak detection
      analyserNode.fftSize = 2048; // Larger FFT for better frequency resolution
      analyserNode.smoothingTimeConstant = 0.1; // Lower smoothing for faster response
      
      // Connect: gain -> analyser -> pan -> destination
      gainNode.connect(analyserNode);
      analyserNode.connect(panNode);
      panNode.connect(this.audioContext.destination);
      
      this.gainNodes.push(gainNode);
      this.analyserNodes.push(analyserNode);
      this.panNodes.push(panNode);
    }

    // Create audio buffers for incoming WebSocket audio
    // Initialize as empty arrays (not null) to ensure length property works
    this.channelBuffers = new Array(channelCount).fill(null).map(() => []);
    
    // Debug: Log buffer initialization
    console.log(`🎵 [MIXER] Initialized ${channelCount} channel buffers, each starting with length 0`);
    
    // Opus decoder for compressed audio
    this.opusDecoder = new OpusDecoderManager(sampleRate, 1); // 1 channel per decoder
    
    // Create a master gain node for the final mix
    this.masterGain = this.audioContext.createGain();
    // Will connect to destination in start() method
    
    // Create ScriptProcessorNode to process incoming audio and route through gain/analyser chains
    // Input: 0 channels (we provide data manually), Output: mixed stereo
    // Use larger buffer size (4096 samples = ~85ms at 48kHz) to match incoming packet size
    // This reduces processing frequency and prevents buffer underruns
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 0, 2);
    
    // Minimum buffer threshold before starting playback (user-configurable)
    // Default: ~341ms at 48kHz (1 * 16384 samples from one batch)
    this.minBufferSamples = 16384;
    this.isBuffering = true; // Start in buffering mode
    this.bufferStartTime = null; // Track when buffering started
    this.currentBufferSize = 0; // Current buffer size across all channels
    this.maxBufferSize = 0; // Maximum buffer size seen
    
    this.scriptProcessor.onaudioprocess = (e) => {
      this.processAudio(e);
    };
    
    // Note: ScriptProcessor needs to be connected to destination to run
    // We'll connect it in start() method

    // Start meter update loop
    this.meterAnimationFrame = null;
    this.updateMeters();
  }

  processAudio(e) {
    const outputL = e.outputBuffer.getChannelData(0);
    const outputR = e.outputBuffer.getChannelData(1);
    const frameCount = outputL.length;

    // Clear output
    outputL.fill(0);
    outputR.fill(0);

    // Check if we have enough buffered data across all channels before starting playback
    let minBufferSize = Infinity;
    for (let ch = 0; ch < this.channelCount; ch++) {
      const bufferLength = this.channelBuffers[ch]?.length || 0;
      if (bufferLength < minBufferSize) {
        minBufferSize = bufferLength;
      }
    }
    
    // Update buffer stats (always, even when not buffering)
    this.currentBufferSize = minBufferSize === Infinity ? 0 : minBufferSize;
    if (this.currentBufferSize > this.maxBufferSize) {
      this.maxBufferSize = this.currentBufferSize;
    }
    
    // If buffering, check if we have enough data to start
    if (this.isBuffering) {
      if (!this.bufferStartTime) {
        this.bufferStartTime = Date.now();
      }
      
      if (this.currentBufferSize >= this.minBufferSamples) {
        const bufferingTime = Date.now() - this.bufferStartTime;
        this.isBuffering = false;
        this.bufferStartTime = null;
        console.log(`✅ [MIXER] Buffer filled (${this.currentBufferSize} samples) in ${bufferingTime}ms, starting playback`);
      } else {
        // Still buffering - output silence
        return;
      }
    }
    
    // Process each channel: buffer -> gain -> analyser (for metering) -> pan -> mix
    for (let ch = 0; ch < this.channelCount; ch++) {
      const buffer = this.channelBuffers[ch];
      if (buffer.length < frameCount) {
        // Log when buffer is too small (first few times)
        if (!this._bufferTooSmallCount) this._bufferTooSmallCount = {};
        if (!this._bufferTooSmallCount[ch]) this._bufferTooSmallCount[ch] = 0;
        this._bufferTooSmallCount[ch]++;
        if (this._bufferTooSmallCount[ch] <= 3) {
          console.warn(`⚠️ [MIXER] Channel ${ch} buffer too small: ${buffer.length} < ${frameCount} (need more data)`);
        }
        // If buffer gets too low, go back to buffering mode
        if (buffer.length < this.minBufferSamples / 4) {
          this.isBuffering = true;
          console.warn(`⚠️ [MIXER] Buffer underrun on channel ${ch}, re-buffering...`);
        }
        continue;
      }

      const gain = this.gainNodes[ch].gain.value;
      const pan = this.panNodes[ch].pan.value;
      const gainL = gain * (pan <= 0 ? 1 : 1 - pan);
      const gainR = gain * (pan >= 0 ? 1 : 1 + pan);

      // Get samples from buffer
      const samples = buffer.splice(0, frameCount);
      
      // Feed samples through gain/analyser chain for metering
      // Create audio buffer and feed through gain node (analyser is connected to gain)
      const tempBuffer = this.audioContext.createBuffer(1, frameCount, this.sampleRate);
      const tempData = tempBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        tempData[i] = samples[i];
      }
      
      // Use a more efficient approach: create buffer source that feeds into gain node
      // This allows analyser (connected to gain) to measure the audio
      // Reuse buffer sources if possible, or create them more efficiently
      if (!this.bufferSources) {
        this.bufferSources = new Array(this.channelCount).fill(null);
      }
      
      // Create or reuse buffer source for this channel
      const bufferSource = this.audioContext.createBufferSource();
      bufferSource.buffer = tempBuffer;
      // Connect to gain node - audio flows: bufferSource -> gain -> analyser -> pan -> destination
      bufferSource.connect(this.gainNodes[ch]);
      const startTime = this.audioContext.currentTime;
      bufferSource.start(startTime);
      bufferSource.stop(startTime + frameCount / this.sampleRate);
      
      // Mix to output for playback (apply gain and pan)
      for (let i = 0; i < frameCount; i++) {
        outputL[i] += samples[i] * gainL;
        outputR[i] += samples[i] * gainR;
      }
    }
  }

  async addChannelData(channel, data, encoding = 'pcm') {
    if (channel >= 0 && channel < this.channelCount) {
      if (!data || data.length === 0) return;
      
      let samples;
      
      if (encoding === 'opus') {
        // Decode Opus-encoded data
        try {
          // Convert data to Uint8Array if needed
          let opusData;
          if (data instanceof Uint8Array) {
            opusData = data;
          } else if (Array.isArray(data)) {
            opusData = new Uint8Array(data);
          } else if (data instanceof ArrayBuffer) {
            opusData = new Uint8Array(data);
          } else {
            console.warn(`⚠️ [MIXER] Unsupported Opus data type for channel ${channel}`);
            return;
          }
          
          const decoded = await this.opusDecoder.decode(channel, opusData);
          samples = Array.from(decoded); // Convert Float32Array to array
        } catch (error) {
          console.error(`❌ [MIXER] Opus decode error for channel ${channel}:`, error);
          return;
        }
      } else {
        // PCM data (already decoded)
        samples = Array.isArray(data) ? data : Array.from(data);
      }
      
      // Track data addition for debugging
      if (!this._dataReceivedCount) this._dataReceivedCount = {};
      if (!this._dataReceivedCount[channel]) this._dataReceivedCount[channel] = 0;
      this._dataReceivedCount[channel]++;
      
      const beforeLength = this.channelBuffers[channel].length;
      this.channelBuffers[channel].push(...samples);
      const afterLength = this.channelBuffers[channel].length;
      
      // Log first few additions and periodically
      if (this._dataReceivedCount[channel] <= 5 || this._dataReceivedCount[channel] % 100 === 0) {
        console.log(`🎵 [MIXER] Channel ${channel}: Added ${samples.length} samples (${beforeLength} → ${afterLength} total)`);
      }
      
      // Prevent buffer overflow - allow larger buffer for smoother playback
      // Keep up to 2 seconds of audio (2 * sampleRate samples)
      const maxBufferSize = this.sampleRate * 2;
      if (this.channelBuffers[channel].length > maxBufferSize) {
        // Keep the most recent 1 second, discard older data
        this.channelBuffers[channel] = this.channelBuffers[channel].slice(-this.sampleRate);
      }
    }
  }

  setChannelGain(channel, gain) {
    if (this.gainNodes[channel]) {
      this.gainNodes[channel].gain.setValueAtTime(gain, this.audioContext.currentTime);
    }
  }

  setChannelPan(channel, pan) {
    if (this.panNodes[channel]) {
      this.panNodes[channel].pan.setValueAtTime(pan, this.audioContext.currentTime);
    }
  }

  setChannelMute(channel, muted) {
    this.setChannelGain(channel, muted ? 0 : 1);
  }

  updateMeters() {
    for (let ch = 0; ch < this.channelCount; ch++) {
      const analyser = this.analyserNodes[ch];
      if (!analyser) {
        this.peakLevels[ch] = -60;
        continue;
      }

      try {
        // Use getFloatTimeDomainData for more accurate measurement
        const dataArray = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(dataArray);

        // Find peak value (absolute maximum)
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const abs = Math.abs(dataArray[i]);
          if (abs > max) max = abs;
        }

        // Convert to dB (0-1 range, clamp to -60dB minimum)
        const db = max > 0.0001 ? 20 * Math.log10(max) : -60;
        const clampedDb = Math.max(-60, Math.min(0, db)); // Clamp between -60dB and 0dB

        this.peakLevels[ch] = clampedDb;

        // Update peak hold
        if (clampedDb > this.peakHolds[ch]) {
          this.peakHolds[ch] = clampedDb;
          
          // Clear existing timer
          if (this.peakHoldTimers[ch]) {
            clearTimeout(this.peakHoldTimers[ch]);
          }
          
          // Reset peak hold after 3 seconds
          this.peakHoldTimers[ch] = setTimeout(() => {
            this.peakHolds[ch] = -60; // Reset to minimum
          }, 3000);
        }
      } catch (error) {
        // If analyser isn't ready yet, use default value
        console.warn(`Analyser error for channel ${ch}:`, error);
        this.peakLevels[ch] = -60;
      }
    }

    this.meterAnimationFrame = requestAnimationFrame(() => this.updateMeters());
  }

  async start() {
    try {
      // Resume audio context (may require user interaction)
      if (this.audioContext.state === 'suspended') {
        console.log('🎵 [MIXER] Resuming suspended audio context...');
        await this.audioContext.resume();
        console.log(`✅ [MIXER] Audio context resumed, state: ${this.audioContext.state}`);
      }
      // Connect script processor to master gain, then to destination
      // The script processor will call processAudio() which mixes audio
      // and feeds it through gain/analyser chains for metering
      if (this.masterGain.context.state !== 'closed') {
        this.scriptProcessor.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);
        console.log('✅ [MIXER] Audio mixer started, script processor connected');
        console.log(`🎵 [MIXER] Audio context state: ${this.audioContext.state}, sample rate: ${this.audioContext.sampleRate}Hz`);
      } else {
        console.error('❌ [MIXER] Cannot start - audio context is closed');
      }
    } catch (error) {
      console.error('❌ [MIXER] Error starting audio mixer:', error);
      throw error;
    }
  }

  stop() {
    if (this.meterAnimationFrame) {
      cancelAnimationFrame(this.meterAnimationFrame);
      this.meterAnimationFrame = null;
    }
    
    // Clean up Opus decoder
    if (this.opusDecoder) {
      this.opusDecoder.destroy();
      this.opusDecoder = null;
    }
    
    this.scriptProcessor.disconnect();
    this.audioContext.suspend();
  }

  getLatency() {
    return (this.audioContext.outputLatency || this.audioContext.baseLatency) * 1000; // Convert to ms
  }

  getPeakLevel(channel) {
    return this.peakLevels[channel] || -60;
  }

  getPeakHold(channel) {
    return this.peakHolds[channel] || -60;
  }

  setBufferSize(samples) {
    // Convert from milliseconds to samples if needed
    if (samples < 1000) {
      // Assume it's milliseconds, convert to samples
      samples = Math.round((samples / 1000) * this.sampleRate);
    }
    this.minBufferSamples = Math.max(4096, Math.min(96000, samples)); // Clamp between 4096 and 96000 samples
    // If currently buffering, reset to allow new threshold
    if (this.isBuffering) {
      this.bufferStartTime = null;
    }
    console.log(`🔧 [MIXER] Buffer size set to ${this.minBufferSamples} samples (~${(this.minBufferSamples / this.sampleRate * 1000).toFixed(0)}ms)`);
  }

  getBufferStats() {
    // Recalculate current buffer size to ensure it's accurate
    let minBufferSize = Infinity;
    for (let ch = 0; ch < this.channelCount; ch++) {
      const bufferLength = this.channelBuffers[ch]?.length || 0;
      if (bufferLength < minBufferSize) {
        minBufferSize = bufferLength;
      }
    }
    const currentSize = minBufferSize === Infinity ? 0 : minBufferSize;
    
    // Update max if needed
    if (currentSize > this.maxBufferSize) {
      this.maxBufferSize = currentSize;
    }
    
    const progress = this.isBuffering ? Math.min(100, (currentSize / this.minBufferSamples) * 100) : 100;
    const bufferTimeMs = (this.minBufferSamples / this.sampleRate) * 1000;
    const currentTimeMs = (currentSize / this.sampleRate) * 1000;
    
    // Debug logging (first few times or periodically)
    if (!this._bufferStatsLogCount) this._bufferStatsLogCount = 0;
    this._bufferStatsLogCount++;
    if (this._bufferStatsLogCount <= 5 || this._bufferStatsLogCount % 20 === 0) {
      console.log(`📊 [MIXER] Buffer stats: current=${currentSize}, target=${this.minBufferSamples}, max=${this.maxBufferSize}, progress=${progress.toFixed(1)}%, isBuffering=${this.isBuffering}`);
    }
    
    return {
      current: currentSize,
      target: this.minBufferSamples,
      max: this.maxBufferSize,
      progress: progress,
      currentTimeMs: currentTimeMs,
      targetTimeMs: bufferTimeMs,
    };
  }
}

export function useDanteMixer(channelCount, sampleRate) {
  const mixer = ref(null);
  const peakLevels = ref(new Array(channelCount).fill(-60));
  const peakHolds = ref(new Array(channelCount).fill(-60));
  const isBuffering = ref(true); // Track buffering state
  const bufferStats = ref({ current: 0, target: 16384, max: 0, progress: 0, currentTimeMs: 0, targetTimeMs: 341 });
  let updateInterval = null;

  onMounted(() => {
    mixer.value = new AudioMixerEngine(channelCount, sampleRate);
    
    // Update reactive refs from mixer engine every frame (for peak levels - needs to be smooth)
    const updatePeakLevels = () => {
      if (mixer.value) {
        // Directly read from the mixer's peakLevels array
        for (let i = 0; i < channelCount; i++) {
          const level = mixer.value.peakLevels[i];
          const hold = mixer.value.peakHolds[i];
          if (level !== undefined) {
            peakLevels.value[i] = level;
          }
          if (hold !== undefined) {
            peakHolds.value[i] = hold;
          }
        }
        requestAnimationFrame(updatePeakLevels);
      }
    };
    updatePeakLevels();
    
    // Update buffering state and buffer stats every 500ms (not real-time)
    const updateBufferStats = () => {
      if (mixer.value) {
        // Update buffering state
        if (mixer.value.isBuffering !== undefined) {
          isBuffering.value = mixer.value.isBuffering;
        }
        // Update buffer stats
        if (mixer.value.getBufferStats) {
          bufferStats.value = mixer.value.getBufferStats();
        }
      }
    };
    updateBufferStats(); // Initial update
    updateInterval = setInterval(updateBufferStats, 500); // Update every 500ms
  });

  onBeforeUnmount(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    if (mixer.value) {
      mixer.value.stop();
    }
  });

  return {
    mixer,
    peakLevels,
    peakHolds,
    isBuffering,
    bufferStats,
  };
}

