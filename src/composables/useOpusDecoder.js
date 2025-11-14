// Opus Decoder Utility for Browser
// Uses opus-decoder (WebAssembly-based)

import { OpusDecoder } from 'opus-decoder';

export class OpusDecoderManager {
  constructor(sampleRate = 48000, channels = 1) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.decoders = new Map(); // One decoder per channel
    this.initialized = false;
  }

  /**
   * Initialize decoder for a specific channel
   * @param {number} channel - Channel number
   * @returns {Promise<void>}
   */
  async initChannel(channel) {
    if (this.decoders.has(channel)) {
      return; // Already initialized
    }

    try {
      const decoder = new OpusDecoder({
        sampleRate: this.sampleRate,
        channels: this.channels,
        useWorker: false, // Use main thread for lower latency
      });

      await decoder.ready;
      this.decoders.set(channel, decoder);
      console.log(`✅ [OPUS DECODER] Initialized decoder for channel ${channel}`);
    } catch (error) {
      console.error(`❌ [OPUS DECODER] Failed to initialize decoder for channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Decode Opus-encoded audio data
   * @param {number} channel - Channel number
   * @param {Uint8Array|ArrayBuffer|Buffer} opusData - Opus-encoded audio data
   * @returns {Promise<Float32Array>} - Decoded PCM samples (-1.0 to 1.0)
   */
  async decode(channel, opusData) {
    if (!this.decoders.has(channel)) {
      await this.initChannel(channel);
    }

    const decoder = this.decoders.get(channel);
    if (!decoder) {
      throw new Error(`Decoder not available for channel ${channel}`);
    }

    try {
      // Convert to Uint8Array if needed
      let uint8Data;
      if (opusData instanceof Uint8Array) {
        uint8Data = opusData;
      } else if (opusData instanceof ArrayBuffer) {
        uint8Data = new Uint8Array(opusData);
      } else if (Buffer && Buffer.isBuffer(opusData)) {
        uint8Data = new Uint8Array(opusData);
      } else if (Array.isArray(opusData)) {
        uint8Data = new Uint8Array(opusData);
      } else {
        throw new Error(`Unsupported data type: ${typeof opusData}`);
      }

      // Decode Opus data
      const result = await decoder.decode(uint8Data);
      
      // result.channelData is an array of Float32Arrays (one per channel)
      // For mono, return the first channel
      if (result.channelData && result.channelData.length > 0) {
        return result.channelData[0]; // Return first channel as Float32Array
      }

      return new Float32Array(0);
    } catch (error) {
      console.error(`❌ [OPUS DECODER] Decode error for channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Decode Opus data synchronously (if possible)
   * Note: opus-decoder is async, but we can use it with await
   * @param {number} channel - Channel number
   * @param {Uint8Array|ArrayBuffer|Buffer} opusData - Opus-encoded audio data
   * @returns {Promise<Float32Array>} - Decoded PCM samples
   */
  async decodeSync(channel, opusData) {
    return this.decode(channel, opusData);
  }

  /**
   * Destroy decoder for a specific channel
   * @param {number} channel - Channel number
   */
  destroyChannel(channel) {
    const decoder = this.decoders.get(channel);
    if (decoder) {
      try {
        decoder.free();
      } catch (error) {
        console.warn(`⚠️ [OPUS DECODER] Error destroying decoder for channel ${channel}:`, error);
      }
      this.decoders.delete(channel);
    }
  }

  /**
   * Destroy all decoders
   */
  destroy() {
    for (const channel of this.decoders.keys()) {
      this.destroyChannel(channel);
    }
    this.decoders.clear();
  }
}

