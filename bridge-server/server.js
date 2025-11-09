// Dante Personal Monitor Mixer - Bridge Server
// Receives Dante audio channels and streams to web clients via WebSocket

const express = require('express');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Lazy load naudiodon - only if audio hardware is available
let portAudio = null;
try {
  portAudio = require('naudiodon');
} catch (error) {
  console.warn('naudiodon not available (no audio hardware):', error.message);
  console.warn('Server will run without audio input - suitable for cloud deployment');
}

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT) || 3000, // Railway sets PORT - must be parsed as integer
  sampleRate: 48000, // Dante standard
  channels: parseInt(process.env.CHANNEL_COUNT) || 16, // Number of Dante input channels
  bufferSize: 128, // Smaller = lower latency, but higher CPU
  // Railway/cloud platforms assign PORT automatically - use same port for HTTP and WebSocket
};

console.log('🔧 Configuration:', {
  port: CONFIG.port,
  channels: CONFIG.channels,
  sampleRate: CONFIG.sampleRate,
  nodeEnv: process.env.NODE_ENV,
  railwayEnv: process.env.RAILWAY_ENVIRONMENT,
});

// Initialize Supabase client (with error handling)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    console.log('✅ Supabase client initialized');
  } else {
    console.warn('⚠️ Supabase credentials not found - authentication will be disabled');
    console.warn('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
  console.warn('Server will continue without Supabase authentication');
}

class DanteBridgeServer {
  constructor() {
    this.clients = new Map(); // clientId -> { ws, userId }
    this.audioBuffer = null;
    this.httpServer = null;
    this.wss = null;
    // Initialize HTTP server first, then WebSocket (which attaches to HTTP server)
    this.initHTTP();
    // initWebSocket will be called after HTTP server is ready
    this.initAudioInput();
  }

  initAudioInput() {
    // Skip audio input if naudiodon is not available (cloud deployment)
    if (!portAudio) {
      console.log('Audio input disabled - naudiodon not available (cloud deployment mode)');
      console.log('Server will accept WebSocket connections but no audio will be streamed');
      console.log('For audio input, deploy to a machine with audio hardware (Raspberry Pi, VPS, etc.)');
      return;
    }

    console.log('Initializing audio input from Dante Virtual Soundcard...');
    
    try {
      // List available audio devices
      const devices = portAudio.getDevices();
      console.log('Available audio devices:', devices.map(d => ({ id: d.id, name: d.name })));
      
      // Create audio input stream from Dante Virtual Soundcard
      this.audioInput = new portAudio.AudioIO({
        inOptions: {
          channelCount: CONFIG.channels,
          sampleFormat: portAudio.SampleFormat32Bit,
          sampleRate: CONFIG.sampleRate,
          deviceId: parseInt(process.env.DANTE_DEVICE_ID) || -1, // Auto-select or specify Dante device ID
          closeOnError: false,
        },
      });

      // Process incoming audio in real-time
      this.audioInput.on('data', (buffer) => {
        this.processAudioBuffer(buffer);
      });

      this.audioInput.start();
      console.log(`Audio input started: ${CONFIG.channels} channels @ ${CONFIG.sampleRate}Hz`);
    } catch (error) {
      console.error('Error initializing audio input:', error);
      console.warn('Continuing without audio input (for testing without Dante hardware)');
    }
  }

  processAudioBuffer(interleavedBuffer) {
    if (!interleavedBuffer || interleavedBuffer.length === 0) return;
    
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

    // Store for WebRTC streaming
    this.audioBuffer = channels;
    
    // Send to all connected clients
    this.broadcastAudio(channels);
  }

  broadcastAudio(channels) {
    // Only broadcast if we have audio data (naudiodon available)
    if (!channels || channels.length === 0) return;
    
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Send audio data via WebSocket
        // Format: channelIndex, audioData
        channels.forEach((channelData, chIndex) => {
          const message = {
            type: 'audio',
            channel: chIndex,
            data: Array.from(channelData), // Convert Float32Array to Array for JSON
            timestamp: Date.now(),
          };
          
          try {
            client.ws.send(JSON.stringify(message));
          } catch (error) {
            console.error(`Error sending audio to client ${clientId}:`, error);
          }
        });
      }
    });
  }

  initWebSocket() {
    if (!this.httpServer) {
      console.error('❌ HTTP server not initialized yet, cannot attach WebSocket');
      return;
    }
    try {
      // Attach WebSocket server to HTTP server (Railway-friendly)
      this.wss = new WebSocket.Server({ 
        server: this.httpServer,
        perMessageDeflate: false, // Disable compression for lower latency
        clientTracking: true,
        verifyClient: (info) => {
          console.log(`🔍 WebSocket upgrade request from: ${info.origin || 'no origin'}`);
          return true; // Accept all connections
        },
      });
      console.log(`✅ WebSocket server attached to HTTP server on port ${CONFIG.port}`);
      
      // Handle WebSocket upgrade errors
      this.wss.on('error', (error) => {
        console.error('❌ WebSocket server error:', error);
      });
      
      this.wss.on('headers', (headers, req) => {
        // Add CORS headers for WebSocket upgrade
        const origin = req.headers.origin;
        if (origin) {
          headers.push(`Access-Control-Allow-Origin: ${origin}`);
        }
        headers.push('Access-Control-Allow-Credentials: true');
      });
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error);
      throw error;
    }

    this.wss.on('connection', async (ws, req) => {
      const clientId = this.generateClientId();
      const clientIp = req.socket.remoteAddress || 'unknown';
      console.log(`✅ Client connected: ${clientId} from ${clientIp}`);
      console.log(`📡 Request URL: ${req.url}`);
      this.clients.set(clientId, { ws, userId: null });

      // Send initial configuration immediately
      try {
        ws.send(JSON.stringify({
          type: 'config',
          channels: CONFIG.channels,
          sampleRate: CONFIG.sampleRate,
          clientId,
        }));
        console.log(`📤 Sent config to client ${clientId}`);
      } catch (error) {
        console.error(`❌ Error sending config to ${clientId}:`, error);
      }

      ws.on('message', async (message) => {
        await this.handleClientMessage(clientId, message);
      });

      ws.on('close', (code, reason) => {
        console.log(`❌ Client disconnected: ${clientId} (code: ${code}, reason: ${reason || 'none'})`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message || error);
      });
      
      ws.on('ping', () => {
        ws.pong();
      });
    });
  }

  async handleClientMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      
      if (!client) return;

      switch (data.type) {
        case 'authenticate':
          // Verify JWT token with Supabase
          if (!supabase) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Supabase not configured' }));
            return;
          }
          try {
            const { data: user, error } = await supabase.auth.getUser(data.token);
            if (error) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              return;
            }
            client.userId = user.user.id;
            client.ws.send(JSON.stringify({ type: 'authenticated', userId: user.user.id }));
          } catch (error) {
            console.error('Authentication error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication error' }));
          }
          break;

        case 'loadPreset':
          if (!client.userId) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }

          // Load mix preset from Supabase
          if (!supabase) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Supabase not configured' }));
            return;
          }
          try {
            const { data: preset, error: presetError } = await supabase
              .from('mix_presets')
              .select('*')
              .eq('user_id', client.userId)
              .eq('id', data.presetId)
              .single();

            if (presetError) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Preset not found' }));
              return;
            }
            client.ws.send(JSON.stringify({ type: 'preset', data: preset }));
          } catch (error) {
            console.error('Load preset error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Failed to load preset' }));
          }
          break;

        case 'savePreset':
          if (!client.userId) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }

          // Save mix preset to Supabase
          if (!supabase) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Supabase not configured' }));
            return;
          }
          try {
            const { error: saveError } = await supabase.from('mix_presets').upsert({
              user_id: client.userId,
              name: data.name,
              faders: data.faders, // Array of gain values per channel
              pans: data.pans,
              mutes: data.mutes,
              updated_at: new Date().toISOString(),
            });

            if (saveError) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Failed to save preset' }));
              return;
            }
            client.ws.send(JSON.stringify({ type: 'presetSaved' }));
          } catch (error) {
            console.error('Save preset error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Failed to save preset' }));
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  }

  initHTTP() {
    const app = express();
    
    // CORS middleware for Railway/cloud deployment
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      // Allow requests from Vercel and localhost
      if (origin && (
        origin.includes('vercel.app') || 
        origin.includes('soundrolling.com') ||
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')
      )) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    app.use(express.json());
    app.use(express.static('public'));

    // Root route - Railway health check (must respond quickly)
    app.get('/', (req, res) => {
      try {
        res.status(200).json({
          service: 'Dante Bridge Server',
          status: 'running',
          version: '1.0.0',
          uptime: Math.floor(process.uptime()),
          endpoints: {
            health: '/health',
            websocket: '/ (wss://)',
          },
        });
      } catch (error) {
        console.error('Error in root route:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // Keep-alive endpoint for Railway (fast response)
    app.get('/ping', (req, res) => {
      res.status(200).send('pong');
    });

    app.get('/health', (req, res) => {
      try {
        res.status(200).json({
          status: 'ok',
          channels: CONFIG.channels,
          connectedClients: this.clients.size,
          platform: process.env.RAILWAY_ENVIRONMENT || 'local',
          audioAvailable: !!portAudio,
          websocketEnabled: true,
          port: CONFIG.port,
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error in health check:', error);
        res.status(500).json({ 
          status: 'error',
          error: error.message 
        });
      }
    });

    // WebSocket upgrade endpoint (for debugging)
    app.get('/ws', (req, res) => {
      res.json({
        message: 'WebSocket server is running',
        upgrade: 'Use wss:// protocol to connect',
        path: '/',
      });
    });

    // Store HTTP server reference for WebSocket attachment
    try {
      this.httpServer = app.listen(CONFIG.port, '0.0.0.0', () => {
        console.log(`✅ HTTP server listening on port ${CONFIG.port}`);
        console.log(`🌍 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'local'}`);
        console.log(`🔌 WebSocket will be available at: ws://localhost:${CONFIG.port}`);
        console.log(`🌐 Public URL: https://proapp2149-production.up.railway.app`);
        console.log(`📡 Server ready to accept connections`);
        // Initialize WebSocket after HTTP server is ready
        this.initWebSocket();
      });
      
      this.httpServer.on('error', (error) => {
        console.error('❌ HTTP server error:', error);
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${CONFIG.port} is already in use`);
        }
        process.exit(1);
      });
      
      // Keep server alive - Railway needs shorter timeouts
      this.httpServer.keepAliveTimeout = 61000; // 61 seconds
      this.httpServer.headersTimeout = 62000; // 62 seconds
      
      // Handle server errors
      this.httpServer.on('clientError', (err, socket) => {
        console.error('HTTP client error:', err);
        if (!socket.destroyed) {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });
      
    } catch (error) {
      console.error('❌ Failed to start HTTP server:', error);
      throw error;
    }
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Start the server with error handling
let server;
try {
  console.log('🚀 Starting Dante Bridge Server...');
  console.log(`📦 Node version: ${process.version}`);
  console.log(`🔧 PORT env var: ${process.env.PORT || 'not set (using default 3000)'}`);
  
  server = new DanteBridgeServer();
  console.log('✅ Dante Bridge Server initialized successfully');
  
  // Keep process alive
  setInterval(() => {
    // Periodic heartbeat to keep process alive
    if (server && server.httpServer) {
      const uptime = process.uptime();
      if (uptime % 60 === 0) { // Log every minute
        console.log(`💓 Server heartbeat - uptime: ${Math.floor(uptime)}s, clients: ${server.clients.size}`);
      }
    }
  }, 1000);
  
} catch (error) {
  console.error('❌ Failed to start server:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  if (server.audioInput && portAudio) {
    try {
      server.audioInput.quit();
    } catch (error) {
      console.error('Error stopping audio input:', error);
    }
  }
  if (server.httpServer) {
    server.httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown); // Railway sends SIGTERM

