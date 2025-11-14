// Dante Bridge Client Core - Extracted for Electron app
const WebSocket = require('ws');
const EventEmitter = require('events');

// Lazy load naudiodon
let portAudio = null;
let naudiodonError = null;
try {
  portAudio = require('naudiodon');
} catch (error) {
  naudiodonError = error;
  console.error('❌ naudiodon not available:', error.message);
  console.error('   This usually means native modules need to be rebuilt.');
  console.error('   Run: npm run rebuild');
}

class DanteBridgeClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      railwayWsUrl: config.railwayWsUrl || 'wss://proapp2149-production.up.railway.app',
      sampleRate: config.sampleRate || 48000,
      channels: config.channels || 16,
      bufferSize: 4096, // Increased from 128 for better quality (~85ms at 48kHz)
      batchSize: 4, // Batch 4 buffers before sending (reduces WebSocket overhead)
      reconnectDelay: 3000,
      accessToken: config.accessToken,
    };
    
    // Ensure Railway URL uses wss:// protocol
    if (this.config.railwayWsUrl.startsWith('https://')) {
      this.config.railwayWsUrl = this.config.railwayWsUrl.replace('https://', 'wss://');
    } else if (this.config.railwayWsUrl.startsWith('http://')) {
      this.config.railwayWsUrl = this.config.railwayWsUrl.replace('http://', 'ws://');
    } else if (!this.config.railwayWsUrl.startsWith('ws')) {
      this.config.railwayWsUrl = `wss://${this.config.railwayWsUrl}`;
    }
    
    this.ws = null;
    this.audioInput = null;
    this.connected = false;
    this.registered = false;
    this.reconnectTimer = null;
    this.selectedDeviceId = config.deviceId || -1;
    this.availableDevices = [];
    
    this.emit('status', { type: 'initialized', message: 'Client initialized' });
  }

  getAvailableDevices() {
    if (!portAudio) {
      const errorMsg = naudiodonError 
        ? `naudiodon not available: ${naudiodonError.message}. Please rebuild: npm run rebuild`
        : 'naudiodon not available. Please rebuild native modules: npm run rebuild';
      this.emit('error', { type: 'device-enumeration', message: errorMsg });
      return [];
    }
    
    try {
      const devices = portAudio.getDevices();
      const inputDevices = devices
        .filter(d => d.maxInputChannels > 0)
        .map(d => ({
          id: d.id,
          name: d.name,
          maxInputChannels: d.maxInputChannels,
          defaultSampleRate: d.defaultSampleRate,
          isDefault: d.isDefault,
        }));
      
      this.availableDevices = inputDevices;
      return inputDevices;
    } catch (error) {
      this.emit('error', { type: 'device-enumeration', message: error.message });
      return [];
    }
  }

  setDevice(deviceId) {
    const deviceIdInt = parseInt(deviceId);
    this.selectedDeviceId = deviceIdInt;
    
    // Restart audio input with new device if already running
    if (this.audioInput && this.registered) {
      try {
        this.audioInput.quit();
        this.audioInput = null;
      } catch (e) {
        console.warn('Error stopping old audio input:', e);
      }
      
      // Reinitialize with new device
      this.initAudioInput();
    }
    
    return { success: true, deviceId: this.selectedDeviceId };
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    try {
      this.emit('status', { type: 'connecting', message: `Connecting to ${this.config.railwayWsUrl}` });
      this.ws = new WebSocket(this.config.railwayWsUrl);

      this.ws.on('open', async () => {
        this.connected = true;
        this.emit('status', { type: 'connected', message: 'Connected to Railway' });
        
        if (this.config.accessToken) {
          await this.registerAsSource();
        } else {
          this.emit('error', { type: 'auth', message: 'No access token provided' });
        }
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.registered = false;
        this.emit('status', { type: 'disconnected', message: `Disconnected (code: ${code})` });
        
        if (this.audioInput) {
          try {
            this.audioInput.quit();
            this.audioInput = null;
          } catch (e) {}
        }
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => {
          this.emit('status', { type: 'reconnecting', message: 'Attempting to reconnect...' });
          this.connect();
        }, this.config.reconnectDelay);
      });

      this.ws.on('error', (error) => {
        this.emit('error', { type: 'websocket', message: error.message });
      });

    } catch (error) {
      this.emit('error', { type: 'connection', message: error.message });
    }
  }

  async registerAsSource() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.config.accessToken) {
      this.emit('error', { type: 'auth', message: 'No access token' });
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'registerSource',
        token: this.config.accessToken,
      }));
      this.emit('status', { type: 'registering', message: 'Registering as source...' });
    } catch (error) {
      this.emit('error', { type: 'registration', message: error.message });
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'sourceRegistered':
        this.registered = true;
        this.emit('status', { 
          type: 'registered', 
          message: `Registered as source (${message.channels} channels @ ${message.sampleRate}Hz)` 
        });
        this.initAudioInput();
        break;

      case 'error':
        this.emit('error', { type: 'server', message: message.message });
        break;

      case 'authenticated':
        this.emit('status', { type: 'authenticated', message: 'Authenticated with server' });
        break;
    }
  }

  initAudioInput() {
    if (this.audioInput) {
      return;
    }

    if (!portAudio) {
      const errorMsg = naudiodonError 
        ? `naudiodon not available: ${naudiodonError.message}. Please rebuild: npm run rebuild`
        : 'naudiodon not available. Please rebuild native modules: npm run rebuild';
      this.emit('error', { type: 'audio', message: errorMsg });
      return;
    }

    try {
      const devices = portAudio.getDevices();
      const inputDevices = devices.filter(d => d.maxInputChannels > 0);
      
      this.availableDevices = inputDevices.map(d => ({
        id: d.id,
        name: d.name,
        maxInputChannels: d.maxInputChannels,
        defaultSampleRate: d.defaultSampleRate,
        isDefault: d.isDefault,
      }));
      
      this.emit('devices', this.availableDevices);
      
      // Create audio input with larger buffer for better quality
      const bufferLatencyMs = (this.config.bufferSize / this.config.sampleRate) * 1000;
      const effectiveLatencyMs = bufferLatencyMs * this.config.batchSize;
      
      this.audioInput = new portAudio.AudioIO({
        inOptions: {
          channelCount: this.config.channels,
          sampleFormat: portAudio.SampleFormat32Bit,
          sampleRate: this.config.sampleRate,
          deviceId: this.selectedDeviceId,
          closeOnError: false,
          framesPerBuffer: this.config.bufferSize, // Use configured buffer size
        },
      });
      
      this.emit('status', { 
        type: 'audio-config', 
        message: `Audio buffer: ${this.config.bufferSize} samples, batch: ${this.config.batchSize}, latency: ~${effectiveLatencyMs.toFixed(1)}ms` 
      });

      this.audioInput.on('data', (buffer) => {
        this.processAudioBuffer(buffer);
      });

      this.audioInput.start();
      
      const deviceName = inputDevices.find(d => d.id === this.selectedDeviceId)?.name || 
                        (this.selectedDeviceId === -1 ? 'Default' : `Device ${this.selectedDeviceId}`);
      this.emit('status', { 
        type: 'audio-started', 
        message: `Audio capture started: ${deviceName} (${this.config.channels} channels @ ${this.config.sampleRate}Hz)` 
      });
    } catch (error) {
      this.emit('error', { type: 'audio', message: `Failed to start audio: ${error.message}` });
    }
  }

  processAudioBuffer(interleavedBuffer) {
    if (!interleavedBuffer || interleavedBuffer.length === 0) return;
    if (!this.registered || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const frameCount = interleavedBuffer.length / this.config.channels / 4;
    const channels = [];
    
    for (let ch = 0; ch < this.config.channels; ch++) {
      channels[ch] = new Float32Array(frameCount);
    }

    for (let frame = 0; frame < frameCount; frame++) {
      for (let ch = 0; ch < this.config.channels; ch++) {
        const index = (frame * this.config.channels + ch) * 4;
        const sample = interleavedBuffer.readInt32LE(index) / 2147483648.0;
        channels[ch][frame] = sample;
      }
    }

    // Initialize batch queue if not exists
    if (!this.audioBatchQueue) {
      this.audioBatchQueue = [];
      this.bufferCount = 0;
    }
    
    // Add to batch queue
    this.audioBatchQueue.push({
      channels: channels,
      timestamp: Date.now(),
    });
    this.bufferCount++;
    
    // Send batched audio when queue reaches batch size
    if (this.audioBatchQueue.length >= this.config.batchSize) {
      const batch = this.audioBatchQueue.splice(0, this.config.batchSize);
      
      // Combine all buffers in batch for each channel
      channels.forEach((_, chIndex) => {
        const combinedSamples = [];
        for (const buffer of batch) {
          if (buffer.channels[chIndex]) {
            combinedSamples.push(...Array.from(buffer.channels[chIndex]));
          }
        }
        
        if (combinedSamples.length > 0) {
          try {
            this.ws.send(JSON.stringify({
              type: 'audio',
              channel: chIndex,
              data: combinedSamples,
              timestamp: batch[0].timestamp, // Use first buffer's timestamp
              bufferCount: batch.length,
            }));
          } catch (error) {
            console.error(`Error sending audio for channel ${chIndex}:`, error);
          }
        }
      });
      
      if (this.bufferCount % 50 === 0) {
        const bufferLatencyMs = (this.config.bufferSize / this.config.sampleRate) * 1000;
        const effectiveLatencyMs = bufferLatencyMs * this.config.batchSize;
        console.log(`📤 Sent ${this.bufferCount} buffers (batched: ${this.config.batchSize} buffers, ~${effectiveLatencyMs.toFixed(1)}ms latency)`);
      }
    }
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.audioInput) {
      try {
        this.audioInput.quit();
        this.audioInput = null;
      } catch (error) {
        console.error('Error stopping audio input:', error);
      }
    }

    if (this.ws) {
      try {
        this.ws.close();
        this.ws = null;
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
    }

    this.connected = false;
    this.registered = false;
    this.emit('status', { type: 'stopped', message: 'Client stopped' });
  }
}

module.exports = DanteBridgeClient;

