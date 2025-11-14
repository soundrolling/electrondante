// Dante Bridge Server - Client Mode
// Captures audio from virtual soundcard and sends to Railway relay server

const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
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
  bufferSize: 128,
  reconnectDelay: 3000, // 3 seconds
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

    console.log('🎤 Initializing audio input from Dante Virtual Soundcard...');
    
    try {
      // List available audio devices
      const devices = portAudio.getDevices();
      console.log('Available audio devices:', devices.map(d => ({ id: d.id, name: d.name })));
      
      // Create audio input stream
      this.audioInput = new portAudio.AudioIO({
        inOptions: {
          channelCount: CONFIG.channels,
          sampleFormat: portAudio.SampleFormat32Bit,
          sampleRate: CONFIG.sampleRate,
          deviceId: parseInt(process.env.DANTE_DEVICE_ID) || -1, // Auto-select or specify device ID
          closeOnError: false,
        },
      });

      // Process incoming audio in real-time
      this.audioInput.on('data', (buffer) => {
        this.processAudioBuffer(buffer);
      });

      this.audioInput.start();
      console.log(`✅ Audio input started: ${CONFIG.channels} channels @ ${CONFIG.sampleRate}Hz`);
    } catch (error) {
      console.error('❌ Error initializing audio input:', error);
      console.error('Make sure Dante Virtual Soundcard is installed and configured');
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

    // Send each channel as separate audio message to Railway
    channels.forEach((channelData, chIndex) => {
      try {
        this.ws.send(JSON.stringify({
          type: 'audio',
          channel: chIndex,
          data: Array.from(channelData), // Convert Float32Array to Array for JSON
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error(`Error sending audio for channel ${chIndex}:`, error);
      }
    });
  }

  stop() {
    console.log('🛑 Stopping client...');
    
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

