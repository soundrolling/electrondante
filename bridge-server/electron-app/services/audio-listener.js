// Audio playback engine for listeners
// Uses Web Audio API for playback with jitter buffering

const JitterBuffer = require('../utils/audio-buffer');
const OpusDecoder = require('../opus-encoder'); // Will need to add decoder support

class AudioListener {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 48000;
    this.channels = options.channels || 1;
    this.volume = options.volume !== undefined ? options.volume : 1.0;
    
    // Web Audio API setup
    this.audioContext = null;
    this.gainNode = null;
    this.scriptProcessor = null;
    this.isPlaying = false;
    
    // Per-channel jitter buffers
    this.jitterBuffers = [];
    for (let i = 0; i < this.channels; i++) {
      this.jitterBuffers.push(new JitterBuffer({
        minSize: 5,
        targetSize: 20,
        maxSize: 100,
        maxLatency: 500,
        adaptive: true,
      }));
    }
    
    // Playback state
    this.playbackInterval = null;
    this.lastPlaybackTime = null;
  }
  
  // Initialize audio context
  // NOTE: This requires Web Audio API which is only available in browser/renderer context
  // For Electron main process, audio playback should be handled via IPC to renderer
  // or use a Node.js-compatible audio library like node-speaker
  async initialize() {
    try {
      // Check if we're in a browser context
      if (typeof window === 'undefined') {
        throw new Error('AudioListener requires browser/renderer context. Web Audio API is not available in Node.js main process.');
      }
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        throw new Error('Web Audio API not available');
      }
      
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
      
      // Resume audio context (required for some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      throw error;
    }
  }
  
  // Add audio packet to buffer
  addAudioPacket(packet) {
    const { channel, data, encoding, timestamp, sequence } = packet;
    
    if (channel >= 0 && channel < this.jitterBuffers.length) {
      this.jitterBuffers[channel].addPacket({
        data,
        encoding: encoding || 'pcm',
        timestamp,
        sequence,
      });
    }
  }
  
  // Start playback
  start() {
    if (this.isPlaying) return;
    
    if (!this.audioContext) {
      console.warn('Audio context not initialized');
      return;
    }
    
    this.isPlaying = true;
    this.lastPlaybackTime = Date.now();
    
    // Start playback loop
    this.playbackInterval = setInterval(() => {
      this.processPlayback();
    }, 10); // Process every 10ms
    
    console.log('Audio playback started');
  }
  
  // Stop playback
  stop() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    
    // Clear buffers
    this.jitterBuffers.forEach(buffer => buffer.clear());
    
    console.log('Audio playback stopped');
  }
  
  // Process audio playback
  processPlayback() {
    if (!this.audioContext || !this.gainNode) return;
    
    // Check if we have enough data in all channels
    const hasEnoughData = this.jitterBuffers.every(buffer => buffer.hasEnoughData());
    if (!hasEnoughData) {
      return; // Wait for more data
    }
    
    // Get packets from each channel
    const packets = this.jitterBuffers.map(buffer => buffer.getNextPacket());
    
    // Check if we got valid packets
    if (packets.some(p => !p)) {
      // Not all channels have data - put packets back
      packets.forEach((packet, ch) => {
        if (packet && this.jitterBuffers[ch]) {
          this.jitterBuffers[ch].addPacket(packet);
        }
      });
      return;
    }
    
    // Decode and play audio
    // For now, simple PCM playback (will need Opus decoder for encoded audio)
    try {
      const audioData = this.decodeAudioPackets(packets);
      if (audioData) {
        this.playAudioData(audioData);
      }
    } catch (error) {
      console.error('Error processing audio playback:', error);
    }
  }
  
  // Decode audio packets (PCM or Opus)
  decodeAudioPackets(packets) {
    // For PCM, packets should already be Float32Array
    // For Opus, would need decoder here
    
    const samples = [];
    packets.forEach((packet, ch) => {
      if (packet.encoding === 'opus') {
        // TODO: Implement Opus decoding
        console.warn('Opus decoding not yet implemented');
        return null;
      } else {
        // PCM data - should be array of floats
        if (Array.isArray(packet.data)) {
          samples[ch] = new Float32Array(packet.data);
        } else if (packet.data instanceof Float32Array) {
          samples[ch] = packet.data;
        } else {
          return null;
        }
      }
    });
    
    return samples.length > 0 ? samples : null;
  }
  
  // Play audio data using Web Audio API
  playAudioData(audioData) {
    if (!this.audioContext || !this.gainNode) return;
    
    // Create buffer source for each channel
    // For simplicity, mix to mono or stereo
    const frameCount = Math.max(...audioData.map(ch => ch.length));
    const outputChannels = Math.min(this.channels, 2); // Mono or stereo
    
    const buffer = this.audioContext.createBuffer(
      outputChannels,
      frameCount,
      this.sampleRate
    );
    
    // Fill buffer (mix channels if needed)
    for (let ch = 0; ch < outputChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const sourceCh = Math.min(ch, audioData.length - 1);
      
      if (audioData[sourceCh]) {
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = audioData[sourceCh][i] || 0;
        }
      }
    }
    
    // Create and play buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.start();
  }
  
  // Set volume (0.0 to 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }
  
  // Get buffer status
  getBufferStatus() {
    return this.jitterBuffers.map((buffer, ch) => ({
      channel: ch,
      ...buffer.getStatus(),
    }));
  }
  
  // Cleanup
  destroy() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
    
    this.gainNode = null;
    this.jitterBuffers = [];
  }
}

module.exports = AudioListener;

