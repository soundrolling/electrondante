// Dante Personal Monitor Mixer - Bridge Server
// Receives Dante audio channels and streams to web clients via WebSocket

const express = require('express');
const WebSocket = require('ws');
const portAudio = require('naudiodon'); // For accessing Dante Virtual Soundcard
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  sampleRate: 48000, // Dante standard
  channels: parseInt(process.env.CHANNEL_COUNT) || 16, // Number of Dante input channels
  bufferSize: 128, // Smaller = lower latency, but higher CPU
  // Railway/cloud platforms assign PORT automatically - use same port for HTTP and WebSocket
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class DanteBridgeServer {
  constructor() {
    this.clients = new Map(); // clientId -> { ws, userId }
    this.audioBuffer = null;
    this.httpServer = null;
    this.initHTTP();
    this.initWebSocket();
    this.initAudioInput();
  }

  initAudioInput() {
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
    // Attach WebSocket server to HTTP server (Railway-friendly)
    this.wss = new WebSocket.Server({ server: this.httpServer });
    console.log(`WebSocket server attached to HTTP server on port ${CONFIG.port}`);

    this.wss.on('connection', async (ws, req) => {
      const clientId = this.generateClientId();
      console.log(`Client connected: ${clientId}`);
      this.clients.set(clientId, { ws, userId: null });

      // Send initial configuration
      ws.send(JSON.stringify({
        type: 'config',
        channels: CONFIG.channels,
        sampleRate: CONFIG.sampleRate,
        clientId,
      }));

      ws.on('message', async (message) => {
        await this.handleClientMessage(clientId, message);
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
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
          const { data: user, error } = await supabase.auth.getUser(data.token);
          if (error) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
            return;
          }

          client.userId = user.user.id;
          client.ws.send(JSON.stringify({ type: 'authenticated', userId: user.user.id }));
          break;

        case 'loadPreset':
          if (!client.userId) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }

          // Load mix preset from Supabase
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
          break;

        case 'savePreset':
          if (!client.userId) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }

          // Save mix preset to Supabase
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

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        channels: CONFIG.channels,
        connectedClients: this.clients.size,
        platform: process.env.RAILWAY_ENVIRONMENT || 'local',
      });
    });

    // Store HTTP server reference for WebSocket attachment
    this.httpServer = app.listen(CONFIG.port, '0.0.0.0', () => {
      console.log(`HTTP server listening on port ${CONFIG.port}`);
      console.log(`Environment: ${process.env.RAILWAY_ENVIRONMENT || 'local'}`);
      console.log(`WebSocket will be available at: ws://localhost:${CONFIG.port}`);
    });
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Start the server
const server = new DanteBridgeServer();

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  if (server.audioInput) {
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

