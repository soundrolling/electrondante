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
    this.masterGain.connect(this.audioContext.destination);
    
    // Create ScriptProcessorNode to process incoming audio and route through gain/analyser chains
    // Input: channelCount channels from WebSocket, Output: mixed stereo
    this.scriptProcessor = this.audioContext.createScriptProcessor(256, 0, 2);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      this.processAudio(e);
    };
    
    // Connect script processor to master gain (which goes to destination)
    this.scriptProcessor.connect(this.masterGain);

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
      
      // Feed audio through gain node for analyser to measure
      // Use a splitter approach: create buffer source that feeds into gain node
      // This allows analyser (connected to gain) to measure the audio
      const bufferSource = this.audioContext.createBufferSource();
      bufferSource.buffer = tempBuffer;
      // Connect to gain node - audio flows: bufferSource -> gain -> analyser -> pan -> destination
      bufferSource.connect(this.gainNodes[ch]);
      const startTime = this.audioContext.currentTime;
      bufferSource.start(startTime);
      bufferSource.stop(startTime + frameCount / this.sampleRate);
      
      // Note: This creates many buffer sources, but it's necessary for analyser to measure
      // In production with real audio, this would be optimized
      
      // Mix to output for playback
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
      if (!analyser) continue;

      try {
        const dataArray = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(dataArray);

        // Find peak value
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const abs = Math.abs(dataArray[i] - 128);
          if (abs > max) max = abs;
        }

        // Convert to dB (0-128 range, clamp to -60dB minimum)
        const normalized = max / 128;
        const db = normalized > 0 ? 20 * Math.log10(normalized) : -60;
        const clampedDb = Math.max(-60, db);

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
      // Connect script processor (it processes input but doesn't output directly)
      // Audio flows through gain -> analyser -> pan -> destination
      this.scriptProcessor.connect(this.audioContext.destination);
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

  onMounted(() => {
    mixer.value = new AudioMixerEngine(channelCount, sampleRate);
    
    // Update reactive refs from mixer engine
    const updatePeakLevels = () => {
      if (mixer.value) {
        for (let i = 0; i < channelCount; i++) {
          peakLevels.value[i] = mixer.value.getPeakLevel(i);
          peakHolds.value[i] = mixer.value.getPeakHold(i);
        }
        requestAnimationFrame(updatePeakLevels);
      }
    };
    updatePeakLevels();
  });

  onBeforeUnmount(() => {
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

