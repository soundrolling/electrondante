// Dante Bridge Server - Client Mode
// Captures audio from virtual soundcard and sends to Railway relay server

const WebSocket = require('ws');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpusEncoder = require('./opus-encoder');
require('dotenv').config();

// Lazy load naudiodon - required for client mode
let portAudio = null;
try {
  portAudio = require('naudiodon');
} catch (error) {
  console.error('❌ naudiodon not available - client mode requires audio hardware');
  console.error('Install naudiodon: npm install naudiodon');
  process.exit(1);
}

// Configuration
const CONFIG = {
  railwayWsUrl: process.env.RAILWAY_WS_URL || process.env.RAILWAY_URL || 'wss://proapp2149-production.up.railway.app',
  sampleRate: 48000, // Dante standard
  channels: parseInt(process.env.CHANNEL_COUNT) || 16,
  bufferSize: 4096, // Increased from 128 for better quality (~85ms at 48kHz)
  batchSize: 4, // Batch 4 buffers before sending (reduces WebSocket overhead)
  reconnectDelay: 3000, // 3 seconds
  localHttpPort: parseInt(process.env.LOCAL_HTTP_PORT) || 3002, // Local HTTP server for device management
};

// Ensure Railway URL uses wss:// protocol
if (CONFIG.railwayWsUrl.startsWith('https://')) {
  CONFIG.railwayWsUrl = CONFIG.railwayWsUrl.replace('https://', 'wss://');
} else if (CONFIG.railwayWsUrl.startsWith('http://')) {
  CONFIG.railwayWsUrl = CONFIG.railwayWsUrl.replace('http://', 'ws://');
} else if (!CONFIG.railwayWsUrl.startsWith('ws')) {
  CONFIG.railwayWsUrl = `wss://${CONFIG.railwayWsUrl}`;
}

console.log('🔧 Client Mode Configuration:', {
  railwayUrl: CONFIG.railwayWsUrl,
  channels: CONFIG.channels,
  sampleRate: CONFIG.sampleRate,
});

// Initialize Supabase client for authentication
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    console.log('✅ Supabase client initialized');
  } else {
    console.warn('⚠️ Supabase credentials not found');
    console.warn('Set SUPABASE_URL and SUPABASE_ANON_KEY for authentication');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
}

class DanteBridgeClient {
  constructor() {
    this.ws = null;
    this.audioInput = null;
    this.connected = false;
    this.registered = false;
    this.reconnectTimer = null;
    this.accessToken = null;
    this.selectedDeviceId = parseInt(process.env.DANTE_DEVICE_ID) || -1;
    this.availableDevices = [];
    this.httpServer = null;
    
    // Opus encoders (one per channel)
    this.opusEncoders = [];
    this.useOpus = true; // Enable Opus encoding by default
    
    this.initLocalHTTPServer();
  }

  initLocalHTTPServer() {
    const app = express();
    app.use(express.json());
    
    // CORS middleware
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Get available audio devices
    app.get('/devices', (req, res) => {
      try {
        if (!portAudio) {
          return res.status(503).json({ error: 'naudiodon not available' });
        }
        
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
        res.json({ devices: inputDevices, currentDeviceId: this.selectedDeviceId });
      } catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Set selected device
    app.post('/device', (req, res) => {
      try {
        const { deviceId } = req.body;
        if (deviceId === undefined) {
          return res.status(400).json({ error: 'deviceId is required' });
        }

        const deviceIdInt = parseInt(deviceId);
        this.selectedDeviceId = deviceIdInt;
        
        // Restart audio input with new device
        if (this.audioInput) {
          try {
            this.audioInput.quit();
            this.audioInput = null;
          } catch (e) {
            console.warn('Error stopping old audio input:', e);
          }
        }

        // Reinitialize with new device
        this.initAudioInput();
        
        res.json({ 
          success: true, 
          deviceId: this.selectedDeviceId,
          message: `Audio device changed to device ID ${this.selectedDeviceId}`
        });
      } catch (error) {
        console.error('Error setting device:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get current device
    app.get('/device', (req, res) => {
      res.json({ deviceId: this.selectedDeviceId });
    });

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        connected: this.connected,
        registered: this.registered,
        audioActive: !!this.audioInput,
        currentDeviceId: this.selectedDeviceId,
      });
    });

    try {
      this.httpServer = app.listen(CONFIG.localHttpPort, '127.0.0.1', () => {
        console.log(`🌐 Local HTTP server listening on http://127.0.0.1:${CONFIG.localHttpPort}`);
        console.log(`   GET  /devices - List available audio devices`);
        console.log(`   GET  /device  - Get current device`);
        console.log(`   POST /device  - Set audio device (body: {deviceId: number})`);
        console.log(`   GET  /health  - Health check`);
      });
    } catch (error) {
      console.error('Failed to start local HTTP server:', error);
    }
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Already connected to Railway');
      return;
    }

    // Clean up existing connection
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore errors
      }
      this.ws = null;
    }

    try {
      console.log(`🔌 Connecting to Railway: ${CONFIG.railwayWsUrl}`);
      this.ws = new WebSocket(CONFIG.railwayWsUrl);

      this.ws.on('open', async () => {
        console.log('✅ Connected to Railway');
        this.connected = true;
        
        // Get Supabase access token for authentication
        // Priority: 1. Environment variable, 2. Supabase session (if available)
        if (process.env.SUPABASE_ACCESS_TOKEN) {
          this.accessToken = process.env.SUPABASE_ACCESS_TOKEN;
          console.log('✅ Using access token from environment variable');
          await this.registerAsSource();
        } else if (supabase) {
          try {
            // Try to get session (may not work in Node.js without browser context)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              this.accessToken = session.access_token;
              await this.registerAsSource();
            } else {
              console.warn('⚠️ No Supabase session found');
              console.warn('💡 To authenticate, set SUPABASE_ACCESS_TOKEN environment variable');
              console.warn('   Get the token from browser DevTools: localStorage.getItem("sb-...-auth-token")');
              console.warn('   Or from the Vue app after signing in');
            }
          } catch (error) {
            console.warn('⚠️ Cannot get session from Supabase (Node.js limitation)');
            console.warn('💡 Set SUPABASE_ACCESS_TOKEN environment variable with your access token');
            console.warn('   Get it from browser after signing in to the Vue app');
          }
        } else {
          console.warn('⚠️ Supabase not configured - cannot authenticate');
          console.warn('💡 Set SUPABASE_ACCESS_TOKEN environment variable with your access token');
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
        console.log(`❌ Disconnected from Railway (code: ${code}, reason: ${reason || 'none'})`);
        this.connected = false;
        this.registered = false;
        
        // Reconnect after delay
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          this.connect();
        }, CONFIG.reconnectDelay);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.connected = false;
      });

    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.connected = false;
    }
  }

  async registerAsSource() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot register - not connected');
      return;
    }

    if (!this.accessToken) {
      console.warn('Cannot register - no access token');
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'registerSource',
        token: this.accessToken,
      }));
      console.log('📤 Sent source registration request');
    } catch (error) {
      console.error('Error registering as source:', error);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'config':
        console.log('📥 Received config:', {
          channels: message.channels,
          sampleRate: message.sampleRate,
          clientId: message.clientId,
        });
        break;

      case 'sourceRegistered':
        console.log('✅ Registered as audio source');
        console.log(`   User ID: ${message.userId}`);
        console.log(`   Channels: ${message.channels}`);
        console.log(`   Sample Rate: ${message.sampleRate}Hz`);
        this.registered = true;
        // Start audio capture once registered
        this.initAudioInput();
        break;

      case 'error':
        console.error('❌ Server error:', message.message);
        if (message.message.includes('already registered')) {
          console.log('Another source is already registered. Waiting...');
        }
        break;

      case 'authenticated':
        console.log('✅ Authenticated with Railway');
        break;

      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  initAudioInput() {
    if (this.audioInput) {
      console.log('Audio input already initialized');
      return;
    }

    if (!portAudio) {
      console.error('❌ naudiodon not available');
      return;
    }

    console.log('🎤 Initializing audio input...');
    
    try {
      // List available audio devices
      const devices = portAudio.getDevices();
      const inputDevices = devices.filter(d => d.maxInputChannels > 0);
      console.log('Available audio input devices:');
      inputDevices.forEach(d => {
        const isSelected = d.id === this.selectedDeviceId || (this.selectedDeviceId === -1 && d.isDefault);
        console.log(`  ${isSelected ? '→' : ' '} [${d.id}] ${d.name} (${d.maxInputChannels} channels, ${d.defaultSampleRate}Hz)`);
      });
      
      // Create audio input stream with larger buffer for better quality
      // Buffer size: 4096 frames = ~85ms at 48kHz (prioritizing quality over latency)
      this.audioInput = new portAudio.AudioIO({
        inOptions: {
          channelCount: CONFIG.channels,
          sampleFormat: portAudio.SampleFormat32Bit,
          sampleRate: CONFIG.sampleRate,
          deviceId: this.selectedDeviceId, // Use selected device ID
          closeOnError: false,
          framesPerBuffer: CONFIG.bufferSize, // Use configured buffer size
        },
      });
      
      const bufferLatencyMs = (CONFIG.bufferSize / CONFIG.sampleRate) * 1000;
      const effectiveLatencyMs = bufferLatencyMs * CONFIG.batchSize;
      console.log(`📊 Audio buffer configuration:`, {
        bufferSize: CONFIG.bufferSize,
        batchSize: CONFIG.batchSize,
        bufferLatencyMs: bufferLatencyMs.toFixed(1),
        effectiveLatencyMs: effectiveLatencyMs.toFixed(1),
        sampleRate: CONFIG.sampleRate,
      });

      // Process incoming audio in real-time
      this.audioInput.on('data', (buffer) => {
        this.processAudioBuffer(buffer);
      });

      this.audioInput.start();
      const deviceName = inputDevices.find(d => d.id === this.selectedDeviceId)?.name || 
                        (this.selectedDeviceId === -1 ? 'Default' : `Device ${this.selectedDeviceId}`);
      console.log(`✅ Audio input started: ${deviceName} - ${CONFIG.channels} channels @ ${CONFIG.sampleRate}Hz`);
    } catch (error) {
      console.error('❌ Error initializing audio input:', error);
      console.error('Make sure the selected audio device is available and configured');
      if (this.selectedDeviceId !== -1) {
        console.error(`Trying to use device ID ${this.selectedDeviceId} - it may not be available`);
      }
    }
  }

  processAudioBuffer(interleavedBuffer) {
    if (!interleavedBuffer || interleavedBuffer.length === 0) return;
    if (!this.registered || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return; // Don't process audio if not registered or connected
    }
    
    // Convert interleaved buffer to separate channel arrays
    const frameCount = interleavedBuffer.length / CONFIG.channels / 4; // 32-bit = 4 bytes
    const channels = [];
    
    for (let ch = 0; ch < CONFIG.channels; ch++) {
      channels[ch] = new Float32Array(frameCount);
    }

    // Deinterleave
    for (let frame = 0; frame < frameCount; frame++) {
      for (let ch = 0; ch < CONFIG.channels; ch++) {
        const index = (frame * CONFIG.channels + ch) * 4;
        const sample = interleavedBuffer.readInt32LE(index) / 2147483648.0; // Convert to -1.0 to 1.0
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
    if (this.audioBatchQueue.length >= CONFIG.batchSize) {
      const batch = this.audioBatchQueue.splice(0, CONFIG.batchSize);
      
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
            let audioData;
            let encoding = 'pcm';
            
            if (this.useOpus) {
              // Initialize Opus encoder for this channel if needed
              if (!this.opusEncoders[chIndex]) {
                this.opusEncoders[chIndex] = new OpusEncoder(CONFIG.sampleRate, 1, 64000);
              }
              
              // Encode to Opus
              const opusBuffer = this.opusEncoders[chIndex].encode(combinedSamples);
              if (opusBuffer && opusBuffer.length > 0) {
                // Convert Buffer to base64 or array for JSON transmission
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
              channel: chIndex,
              data: audioData,
              encoding: encoding, // Indicate encoding type
              timestamp: batch[0].timestamp, // Use first buffer's timestamp
              bufferCount: batch.length,
              sequence: this.sequenceNumber, // Add sequence number for jitter buffering
            }));
          } catch (error) {
            console.error(`Error sending audio for channel ${chIndex}:`, error);
          }
        }
      });
      
      // Increment sequence number after sending all channels
      this.sequenceNumber++;
      
      if (this.bufferCount % 50 === 0) {
        const bufferLatencyMs = (CONFIG.bufferSize / CONFIG.sampleRate) * 1000;
        const effectiveLatencyMs = bufferLatencyMs * CONFIG.batchSize;
        console.log(`📤 Sent ${this.bufferCount} buffers (batched: ${CONFIG.batchSize} buffers, ~${effectiveLatencyMs.toFixed(1)}ms latency)`);
      }
    }
  }

  stop() {
    console.log('🛑 Stopping client...');
    
    // Clean up Opus encoders
    if (this.opusEncoders) {
      this.opusEncoders.forEach((encoder, index) => {
        if (encoder) {
          try {
            encoder.destroy();
          } catch (error) {
            console.warn(`⚠️ Error destroying Opus encoder for channel ${index}:`, error);
          }
        }
      });
      this.opusEncoders = [];
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.audioInput && portAudio) {
      try {
        this.audioInput.quit();
        this.audioInput = null;
        console.log('✅ Audio input stopped');
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

    if (this.httpServer) {
      try {
        this.httpServer.close(() => {
          console.log('✅ Local HTTP server stopped');
        });
      } catch (error) {
        console.error('Error stopping HTTP server:', error);
      }
    }
  }
}

// Start the client
let client;
try {
  console.log('🚀 Starting Dante Bridge Client...');
  console.log(`📦 Node version: ${process.version}`);
  
  client = new DanteBridgeClient();
  client.connect();
  
  console.log('✅ Dante Bridge Client initialized');
  console.log('💡 Make sure you are signed in to the app to authenticate');
  
} catch (error) {
  console.error('❌ Failed to start client:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Handle graceful shutdown
const shutdown = () => {
  console.log('\nShutting down gracefully...');
  if (client) {
    client.stop();
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

