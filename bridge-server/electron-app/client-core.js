// Dante Bridge Client Core - Extracted for Electron app
const WebSocket = require('ws');
const EventEmitter = require('events');
const path = require('path');

// Load Opus encoder (local to electron app)
let OpusEncoder = null;
try {
  OpusEncoder = require('./opus-encoder');
} catch (error) {
  console.warn('⚠️ Opus encoder not available:', error.message);
}

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
      railwayWsUrl: config.railwayWsUrl || '',
      sampleRate: config.sampleRate || 48000,
      channels: config.channels || 16,
      selectedChannels: config.selectedChannels || null, // Array of specific channels to stream (e.g., [1,2,5,7])
      bufferSize: 4096, // Increased from 128 for better quality (~85ms at 48kHz)
      batchSize: 4, // Batch 4 buffers before sending (reduces WebSocket overhead)
      reconnectDelay: 3000,
      accessToken: config.accessToken,
      roomId: config.roomId,
      roomToken: config.roomToken,
      mode: config.mode || 'broadcaster', // 'broadcaster' or 'listener'
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
    this.heartbeatInterval = null;
    this.lastPongTime = null;
    
    // Opus encoders (one per channel)
    this.opusEncoders = [];
    this.useOpus = OpusEncoder !== null; // Enable Opus if available
    
    // Determine which channels to stream
    if (this.config.selectedChannels && Array.isArray(this.config.selectedChannels)) {
      this.selectedChannels = this.config.selectedChannels.sort((a, b) => a - b);
      // Need to capture up to the highest channel number
      this.audioChannelCount = Math.max(...this.selectedChannels);
      console.log(`Streaming selected channels: ${this.selectedChannels.join(', ')}`);
    } else {
      this.selectedChannels = null;
      this.audioChannelCount = Math.max(1, this.config.channels);
    }
    
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
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Register based on mode
        if (this.config.mode === 'listener') {
          await this.registerAsListener();
        } else if (this.config.accessToken || this.config.roomToken) {
          await this.registerAsSource();
        } else {
          this.emit('error', { type: 'auth', message: 'No access token or room token provided' });
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
        this.stopHeartbeat();
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

    const token = this.config.roomToken || this.config.accessToken;
    if (!token) {
      this.emit('error', { type: 'auth', message: 'No access token or room token' });
      return;
    }

    try {
      const message = {
        type: 'registerSource',
      };
      
      // Room-based registration
      if (this.config.roomId && this.config.roomToken) {
        message.roomId = this.config.roomId;
        message.roomToken = this.config.roomToken;
      } else {
        // Legacy mode
        message.token = token;
      }
      
      this.ws.send(JSON.stringify(message));
      this.emit('status', { type: 'registering', message: 'Registering as source...' });
    } catch (error) {
      this.emit('error', { type: 'registration', message: error.message });
    }
  }
  
  async registerAsListener() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.config.roomId || !this.config.roomToken) {
      this.emit('error', { type: 'auth', message: 'Room ID and token required for listener mode' });
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'registerListener',
        roomId: this.config.roomId,
        roomToken: this.config.roomToken,
      }));
      this.emit('status', { type: 'registering', message: 'Registering as listener...' });
    } catch (error) {
      this.emit('error', { type: 'registration', message: error.message });
    }
  }
  
  startHeartbeat() {
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
          }));
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 30000);
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'sourceRegistered':
        this.registered = true;
        const roomInfo = message.roomId ? ` in room ${message.roomId}` : '';
        this.emit('status', { 
          type: 'registered', 
          message: `Registered as source${roomInfo} (${message.channels} channels @ ${message.sampleRate}Hz)` 
        });
        if (this.config.mode === 'broadcaster') {
          this.initAudioInput();
        }
        break;
      
      case 'listenerRegistered':
        this.registered = true;
        this.emit('status', { 
          type: 'registered', 
          message: `Joined room ${message.roomId}: ${message.roomName}` 
        });
        this.emit('roomStatus', {
          roomId: message.roomId,
          roomName: message.roomName,
          hasBroadcaster: message.hasBroadcaster,
          listenerCount: message.listenerCount,
          state: message.state,
        });
        break;

      case 'roomStatus':
        this.emit('roomStatus', message);
        break;
      
      case 'audio':
        // Audio data for listeners
        if (this.config.mode === 'listener') {
          this.emit('audio', message);
        }
        break;

      case 'error':
        this.emit('error', { type: 'server', message: message.message });
        break;

      case 'authenticated':
        this.emit('status', { type: 'authenticated', message: 'Authenticated with server' });
        break;
      
      case 'ping':
        // Respond to server ping
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({
              type: 'pong',
              timestamp: message.timestamp || Date.now(),
            }));
          } catch (error) {
            console.error('Error sending pong:', error);
          }
        }
        break;
      
      case 'pong':
        // Update last pong time for connection health
        this.lastPongTime = Date.now();
        break;
      
      case 'roomClosed':
        this.emit('status', { type: 'roomClosed', message: `Room ${message.roomId} has been closed` });
        this.emit('error', { type: 'room', message: 'Room has been closed by broadcaster' });
        break;
      
      case 'roomSuspended':
        this.emit('status', { type: 'roomSuspended', message: `Room ${message.roomId} is suspended` });
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
      
      const targetDevice = this.selectDeviceForCapture(inputDevices);

      this.audioInput = new portAudio.AudioIO({
        inOptions: {
          channelCount: this.audioChannelCount,
          sampleFormat: portAudio.SampleFormat32Bit,
          sampleRate: this.config.sampleRate,
          deviceId: targetDevice.id,
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
      
      const deviceName = targetDevice.name || 
                        (this.selectedDeviceId === -1 ? 'Default' : `Device ${this.selectedDeviceId}`);
      this.emit('status', { 
        type: 'audio-started', 
        message: `Audio capture started: ${deviceName} (${this.audioChannelCount} channels @ ${this.config.sampleRate}Hz)` 
      });
    } catch (error) {
      this.emit('error', { type: 'audio', message: `Failed to start audio: ${error.message}` });
    }
  }

  selectDeviceForCapture(inputDevices = []) {
    if (!Array.isArray(inputDevices) || inputDevices.length === 0) {
      throw new Error('No available audio input devices');
    }

    const desiredChannels = Math.max(1, this.config.channels);
    let targetDevice = null;

    if (this.selectedDeviceId >= 0) {
      targetDevice = inputDevices.find((d) => d.id === this.selectedDeviceId);
    }

    if (!targetDevice) {
      targetDevice = inputDevices.find((d) => d.isDefault) || inputDevices[0];
    }

    if (!targetDevice) {
      throw new Error('Unable to determine an audio input device');
    }

    const maxChannels = targetDevice.maxInputChannels || desiredChannels;
    let channelCount = Math.min(desiredChannels, maxChannels);
    if (channelCount < 1) {
      channelCount = 1;
    }

    const previousChannelCount = this.audioChannelCount;
    this.audioChannelCount = channelCount;
    this.selectedDeviceId = targetDevice.id;

    if (channelCount !== previousChannelCount) {
      this.emit('status', {
        type: 'audio-channel-adjust',
        message: `Adjusted to ${channelCount} channel(s) for ${targetDevice.name} (device max ${maxChannels})`,
      });
    }

    return targetDevice;
  }

  processAudioBuffer(interleavedBuffer) {
    if (!interleavedBuffer || interleavedBuffer.length === 0) return;
    if (!this.registered || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.audioChannelCount || this.audioChannelCount < 1) {
      return;
    }
    
    const frameCount = interleavedBuffer.length / this.audioChannelCount / 4;
    const channels = [];
    
    for (let ch = 0; ch < this.audioChannelCount; ch++) {
      channels[ch] = new Float32Array(frameCount);
    }

    for (let frame = 0; frame < frameCount; frame++) {
      for (let ch = 0; ch < this.audioChannelCount; ch++) {
        const index = (frame * this.audioChannelCount + ch) * 4;
        const sample = interleavedBuffer.readInt32LE(index) / 2147483648.0;
        channels[ch][frame] = sample;
      }
    }

    // Initialize batch queue if not exists
    if (!this.audioBatchQueue) {
      this.audioBatchQueue = [];
      this.bufferCount = 0;
      this.sequenceNumber = 0; // Sequence number for packet ordering
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
      
      // Determine which channels to send
      const channelsToSend = this.selectedChannels || Array.from({ length: this.audioChannelCount }, (_, i) => i + 1);
      
      // Combine all buffers in batch for each selected channel
      channelsToSend.forEach((channelNum) => {
        const chIndex = channelNum - 1; // Convert 1-based to 0-based index
        if (chIndex < 0 || chIndex >= this.audioChannelCount) {
          return; // Skip invalid channels
        }
        
        const combinedSamples = [];
        for (const buffer of batch) {
          if (buffer.channels[chIndex]) {
            combinedSamples.push(...Array.from(buffer.channels[chIndex]));
          }
        }
        
        if (combinedSamples.length > 0) {
          try {
            let audioData;
            let encoding = 'pcm';
            
            if (this.useOpus && OpusEncoder) {
              // Initialize Opus encoder for this channel if needed
              if (!this.opusEncoders[chIndex]) {
                this.opusEncoders[chIndex] = new OpusEncoder(this.config.sampleRate, 1, 64000);
              }
              
              // Encode to Opus
              const opusBuffer = this.opusEncoders[chIndex].encode(combinedSamples);
              if (opusBuffer && opusBuffer.length > 0) {
                // Convert Buffer to array for JSON transmission
                audioData = Array.from(opusBuffer);
                encoding = 'opus';
              } else {
                // Fallback to PCM if encoding fails
                audioData = combinedSamples;
                encoding = 'pcm';
              }
            } else {
              audioData = combinedSamples;
              encoding = 'pcm';
            }
            
            this.ws.send(JSON.stringify({
              type: 'audio',
              channel: channelNum, // Send 1-based channel number (not 0-based index)
              data: audioData,
              encoding: encoding, // Indicate encoding type
              timestamp: batch[0].timestamp, // Use first buffer's timestamp
              bufferCount: batch.length,
              sequence: this.sequenceNumber, // Add sequence number for jitter buffering
            }));
          } catch (error) {
            console.error(`Error sending audio for channel ${channelNum}:`, error);
          }
        }
      });
      
      // Increment sequence number after sending all channels
      this.sequenceNumber++;
      
      if (this.bufferCount % 50 === 0) {
        const bufferLatencyMs = (this.config.bufferSize / this.config.sampleRate) * 1000;
        const effectiveLatencyMs = bufferLatencyMs * this.config.batchSize;
        console.log(`📤 Sent ${this.bufferCount} buffers (batched: ${this.config.batchSize} buffers, ~${effectiveLatencyMs.toFixed(1)}ms latency)`);
      }
    }
  }

  stop() {
    this.stopHeartbeat();
    
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

