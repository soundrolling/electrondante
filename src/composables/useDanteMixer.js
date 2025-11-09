// Dante Personal Monitor Mixer - Audio Engine Composable
// Manages Web Audio API nodes and peak level meters

import { ref, onMounted, onBeforeUnmount } from 'vue';

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
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.3;
      
      // Connect: gain -> analyser -> pan -> destination
      gainNode.connect(analyserNode);
      analyserNode.connect(panNode);
      panNode.connect(this.audioContext.destination);
      
      this.gainNodes.push(gainNode);
      this.analyserNodes.push(analyserNode);
      this.panNodes.push(panNode);
    }

    // Create audio buffers for incoming WebSocket audio
    this.channelBuffers = new Array(channelCount).fill(null).map(() => []);
    
    // Create a master gain node for the final mix
    this.masterGain = this.audioContext.createGain();
    // Will connect to destination in start() method
    
    // Create ScriptProcessorNode to process incoming audio and route through gain/analyser chains
    // Input: 0 channels (we provide data manually), Output: mixed stereo
    this.scriptProcessor = this.audioContext.createScriptProcessor(256, 0, 2);
    
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

    // Process each channel: buffer -> gain -> analyser (for metering) -> pan -> mix
    for (let ch = 0; ch < this.channelCount; ch++) {
      const buffer = this.channelBuffers[ch];
      if (buffer.length < frameCount) continue;

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

  addChannelData(channel, data) {
    if (channel >= 0 && channel < this.channelCount) {
      this.channelBuffers[channel].push(...data);
      
      // Prevent buffer overflow
      if (this.channelBuffers[channel].length > this.sampleRate) {
        this.channelBuffers[channel] = this.channelBuffers[channel].slice(-this.sampleRate / 2);
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
        await this.audioContext.resume();
      }
      // Connect script processor to master gain, then to destination
      // The script processor will call processAudio() which mixes audio
      // and feeds it through gain/analyser chains for metering
      if (this.masterGain.context.state !== 'closed') {
        this.scriptProcessor.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);
        console.log('Audio mixer started, script processor connected');
      }
    } catch (error) {
      console.error('Error starting audio mixer:', error);
      throw error;
    }
  }

  stop() {
    if (this.meterAnimationFrame) {
      cancelAnimationFrame(this.meterAnimationFrame);
      this.meterAnimationFrame = null;
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
}

export function useDanteMixer(channelCount, sampleRate) {
  const mixer = ref(null);
  const peakLevels = ref(new Array(channelCount).fill(-60));
  const peakHolds = ref(new Array(channelCount).fill(-60));
  let updateInterval = null;

  onMounted(() => {
    mixer.value = new AudioMixerEngine(channelCount, sampleRate);
    
    // Update reactive refs from mixer engine every frame
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
  });

  onBeforeUnmount(() => {
    if (updateInterval) {
      cancelAnimationFrame(updateInterval);
    }
    if (mixer.value) {
      mixer.value.stop();
    }
  });

  return {
    mixer,
    peakLevels,
    peakHolds,
  };
}

