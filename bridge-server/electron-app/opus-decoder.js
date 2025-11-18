// Opus Decoder Utility for Electron Renderer
// Uses opusscript (pure JavaScript Opus decoder)
// Note: opusscript works in both Node.js and browser contexts

let OpusScript = null;
try {
  // Try to load opusscript - works in Electron renderer
  OpusScript = require('opusscript');
} catch (error) {
  console.warn('⚠️ OpusScript not available for decoding:', error.message);
}

class OpusDecoder {
  constructor(sampleRate = 48000, channels = 1) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.frameSize = 960; // 20ms at 48kHz (Opus standard)
    
    if (OpusScript) {
      try {
        this.decoder = new OpusScript(sampleRate, channels, OpusScript.Application.AUDIO);
      } catch (error) {
        console.error('❌ Failed to create Opus decoder:', error);
        this.decoder = null;
      }
    } else {
      this.decoder = null;
    }
  }

  /**
   * Decode Opus-encoded audio to PCM
   * @param {Buffer|Uint8Array|Array<number>} opusData - Opus-encoded audio data
   * @returns {Float32Array} - Decoded PCM audio samples (-1.0 to 1.0)
   */
  decode(opusData) {
    if (!this.decoder || !opusData || opusData.length === 0) {
      return new Float32Array(0);
    }

    try {
      // Convert to Buffer if needed
      let buffer;
      if (Buffer.isBuffer(opusData)) {
        buffer = opusData;
      } else if (opusData instanceof Uint8Array) {
        buffer = Buffer.from(opusData);
      } else if (Array.isArray(opusData)) {
        buffer = Buffer.from(opusData);
      } else {
        console.warn('Invalid Opus data type:', typeof opusData);
        return new Float32Array(0);
      }

      // Decode Opus to Int16 PCM
      const decoded = this.decoder.decode(buffer, this.frameSize);
      
      if (!decoded || decoded.length === 0) {
        return new Float32Array(0);
      }

      // Convert Int16Array to Float32Array (-1.0 to 1.0)
      const floatSamples = new Float32Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        floatSamples[i] = decoded[i] / 32768.0;
      }

      return floatSamples;
    } catch (error) {
      console.error('❌ Opus decoding error:', error);
      return new Float32Array(0);
    }
  }

  /**
   * Destroy the decoder and free resources
   */
  destroy() {
    if (this.decoder) {
      try {
        this.decoder.delete();
      } catch (error) {
        console.warn('⚠️ Error destroying Opus decoder:', error);
      }
      this.decoder = null;
    }
  }
}

module.exports = OpusDecoder;

