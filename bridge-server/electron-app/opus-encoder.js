// Opus Encoder Utility for Node.js
// Uses opusscript (pure JavaScript Opus encoder)

const OpusScript = require('opusscript');

class OpusEncoder {
  constructor(sampleRate = 48000, channels = 1, bitrate = 64000) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.bitrate = bitrate;
    this.encoder = new OpusScript(sampleRate, channels, OpusScript.Application.AUDIO);
    this.frameSize = 960; // 20ms at 48kHz (Opus standard)
    this.bytesPerSample = 2; // 16-bit samples
  }

  /**
   * Encode PCM audio samples to Opus
   * @param {Float32Array|Array<number>} samples - PCM audio samples (-1.0 to 1.0)
   * @returns {Buffer} - Opus-encoded audio data
   */
  encode(samples) {
    if (!samples || samples.length === 0) {
      return Buffer.alloc(0);
    }

    // Convert Float32Array to Int16Array (Opus expects 16-bit PCM)
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = Math.round(clamped * 32767);
    }

    // Encode to Opus
    try {
      const encoded = this.encoder.encode(int16Samples, this.frameSize);
      return Buffer.from(encoded);
    } catch (error) {
      console.error('❌ Opus encoding error:', error);
      return Buffer.alloc(0);
    }
  }

  /**
   * Encode multiple channels (interleaved)
   * @param {Array<Float32Array|Array<number>>} channelSamples - Array of channel samples
   * @returns {Buffer} - Opus-encoded audio data
   */
  encodeChannels(channelSamples) {
    if (!channelSamples || channelSamples.length === 0) {
      return Buffer.alloc(0);
    }

    // For multi-channel, we encode each channel separately
    // (Opus supports multi-channel, but opusscript may have limitations)
    // For now, encode first channel only (can be extended later)
    if (channelSamples.length > 0 && channelSamples[0]) {
      return this.encode(channelSamples[0]);
    }

    return Buffer.alloc(0);
  }

  /**
   * Destroy the encoder and free resources
   */
  destroy() {
    if (this.encoder) {
      try {
        this.encoder.delete();
      } catch (error) {
        console.warn('⚠️ Error destroying Opus encoder:', error);
      }
      this.encoder = null;
    }
  }
}

module.exports = OpusEncoder;

