// Dante Personal Monitor Mixer - Bridge Server (Railway Relay)
// Relays audio from source (local bridge server) to all listeners (Vue apps)

const express = require('express');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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
    this.listeners = new Map(); // clientId -> { ws, userId, type: 'listener' }
    this.sourceConnection = null; // { ws, userId, clientId, type: 'source' }
    this.audioBuffer = null;
    this.httpServer = null;
    this.wss = null;
    // Initialize HTTP server first, then WebSocket (which attaches to HTTP server)
    this.initHTTP();
    // initWebSocket will be called after HTTP server is ready
    // No local audio input on Railway - audio comes from source connection
  }

  // Notify all listeners about source status
  notifySourceStatus(userId = null) {
    const hasSource = !!this.sourceConnection;
    const sourceUserId = this.sourceConnection?.userId || null;
    const isCurrentUserSource = userId && userId === sourceUserId;
    
    this.listeners.forEach((listener, listenerId) => {
      if (listener.ws.readyState === WebSocket.OPEN) {
        try {
          listener.ws.send(JSON.stringify({
            type: 'sourceStatus',
            hasSource: hasSource,
            sourceUserId: sourceUserId,
            isYourSource: listener.userId === sourceUserId, // Tell listener if they are the source
          }));
        } catch (error) {
          console.error(`Error notifying source status to listener ${listenerId}:`, error);
        }
      }
    });
    
    // Also notify source connection if it exists
    if (this.sourceConnection && this.sourceConnection.ws.readyState === WebSocket.OPEN) {
      try {
        this.sourceConnection.ws.send(JSON.stringify({
          type: 'sourceStatus',
          hasSource: true,
          sourceUserId: sourceUserId,
          isYourSource: true,
        }));
      } catch (error) {
        console.error(`Error notifying source status to source:`, error);
      }
    }
  }

  // Relay audio from source to all listeners
  relayAudioToListeners(channels) {
    if (!channels || channels.length === 0) return;
    if (!this.sourceConnection) {
      console.warn('No source connection - cannot relay audio');
      return;
    }
    
    // Send audio to all listener connections (not source)
    this.listeners.forEach((listener, clientId) => {
      if (listener.ws.readyState === WebSocket.OPEN) {
        // Send audio data via WebSocket
        channels.forEach((channelData, chIndex) => {
          const message = {
            type: 'audio',
            channel: chIndex,
            data: Array.isArray(channelData) ? channelData : Array.from(channelData),
            timestamp: Date.now(),
          };
          
          try {
            listener.ws.send(JSON.stringify(message));
          } catch (error) {
            console.error(`Error relaying audio to listener ${clientId}:`, error);
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
      
      // Initially add as listener - will be changed to source if connection type message received
      this.listeners.set(clientId, { ws, userId: null, type: 'listener' });

      // Send initial configuration immediately
      // Get user ID if authenticated (will be set after authentication)
      let currentUserId = null;
      
      try {
        ws.send(JSON.stringify({
          type: 'config',
          channels: CONFIG.channels,
          sampleRate: CONFIG.sampleRate,
          clientId,
          hasSource: !!this.sourceConnection,
          sourceUserId: this.sourceConnection?.userId || null,
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
        
        // Check if this was the source connection
        if (this.sourceConnection && this.sourceConnection.clientId === clientId) {
          console.log('⚠️ Source connection lost - audio streaming stopped');
          this.sourceConnection = null;
          // Notify all listeners that source is no longer available
          this.notifySourceStatus();
        } else {
          this.listeners.delete(clientId);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message || error);
      });
      
      ws.on('ping', () => {
        ws.pong();
      });
      
      // Handle ping messages from client (keepalive)
      // Note: ws library handles ping/pong automatically, but we can also handle JSON ping messages
    });
  }

  async handleClientMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      
      // Check if this is a source connection or listener
      const isSource = this.sourceConnection && this.sourceConnection.clientId === clientId;
      const client = isSource ? this.sourceConnection : this.listeners.get(clientId);
      
      if (!client) return;

      switch (data.type) {
        case 'registerSource':
          // Register this connection as the audio source
          // Authenticate source first
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
            
            // Check if this user is already the source (reconnection scenario)
            if (this.sourceConnection && this.sourceConnection.userId === user.user.id) {
              // User is reclaiming their source - replace the old connection
              console.log(`🔄 User ${user.user.id} reclaiming source connection`);
              try {
                this.sourceConnection.ws.close();
              } catch (e) {
                // Ignore errors closing old connection
              }
              this.sourceConnection = null;
            }
            
            // Check if another source is already registered
            if (this.sourceConnection) {
              client.ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Source already registered. Only one source allowed at a time.' 
              }));
              return;
            }
            
            // Remove from listeners and set as source
            this.listeners.delete(clientId);
            this.sourceConnection = {
              ws: client.ws,
              userId: user.user.id,
              clientId: clientId,
              type: 'source'
            };
            
            console.log(`🎤 Source registered: ${clientId} by user ${user.user.id}`);
            client.ws.send(JSON.stringify({ 
              type: 'sourceRegistered', 
              userId: user.user.id,
              channels: CONFIG.channels,
              sampleRate: CONFIG.sampleRate
            }));
            
            // Notify all listeners that source is now available
            this.notifySourceStatus();
          } catch (error) {
            console.error('Source registration error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Source registration error' }));
          }
          break;

        case 'unregisterSource':
          // Unregister as source - can be called from source connection OR listener if they are the source user
          if (!supabase || !data.token) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
            return;
          }
          
          try {
            const { data: user, error } = await supabase.auth.getUser(data.token);
            if (error) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              return;
            }
            
            // Check if this user is the source (either as source connection or as listener)
            if (!this.sourceConnection || this.sourceConnection.userId !== user.user.id) {
              client.ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'You are not the registered source' 
              }));
              return;
            }
            
            console.log(`🛑 Source unregistered: ${this.sourceConnection.clientId} by user ${user.user.id}`);
            
            // Close the source connection (might be different from current client)
            if (this.sourceConnection.clientId !== clientId) {
              // User is unregistering from a different connection (reconnection scenario)
              try {
                this.sourceConnection.ws.close();
              } catch (e) {
                // Ignore errors
              }
            } else {
              // Same connection - move back to listeners
              this.listeners.set(clientId, {
                ws: client.ws,
                userId: user.user.id,
                type: 'listener'
              });
            }
            
            this.sourceConnection = null;
            
            // Send confirmation to the client that requested unregistration
            client.ws.send(JSON.stringify({ 
              type: 'sourceUnregistered'
            }));
            
            // Notify all listeners that source is no longer available
            this.notifySourceStatus();
          } catch (error) {
            console.error('Source unregistration error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Source unregistration error' }));
          }
          break;

        case 'audio':
          // Audio data from source - relay to all listeners
          if (!isSource) {
            console.warn(`Received audio from non-source client ${clientId}`);
            return;
          }
          
          // Relay audio to all listeners (single channel packet format)
          if (data.channel !== undefined && data.data) {
            this.listeners.forEach((listener, listenerId) => {
              if (listener.ws.readyState === WebSocket.OPEN) {
                try {
                  listener.ws.send(JSON.stringify({
                    type: 'audio',
                    channel: data.channel,
                    data: data.data,
                    encoding: data.encoding || 'pcm', // Preserve encoding (opus or pcm)
                    timestamp: data.timestamp || Date.now(),
                    sequence: data.sequence, // Preserve sequence number for jitter buffering
                    bufferCount: data.bufferCount, // Preserve buffer count
                  }));
                } catch (error) {
                  console.error(`Error relaying audio to listener ${listenerId}:`, error);
                }
              }
            });
          }
          break;

        case 'authenticate':
          // Verify JWT token with Supabase (for listeners)
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
            console.log(`✅ Listener authenticated: ${clientId} by user ${user.user.id}`);
            
            // Send source status after authentication so client knows if they are the source
            const hasSource = !!this.sourceConnection;
            const sourceUserId = this.sourceConnection?.userId || null;
            const isYourSource = user.user.id === sourceUserId;
            
            client.ws.send(JSON.stringify({
              type: 'sourceStatus',
              hasSource: hasSource,
              sourceUserId: sourceUserId,
              isYourSource: isYourSource,
            }));
          } catch (error) {
            console.error('Authentication error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication error' }));
          }
          break;

        case 'loadPreset':
          // Only listeners can load presets
          if (isSource) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Presets not available for source connections' }));
            return;
          }
          
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
          // Only listeners can save presets
          if (isSource) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Presets not available for source connections' }));
            return;
          }
          
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

        case 'ping':
          // Respond to ping with pong (keepalive and latency measurement)
          try {
            client.ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: data.timestamp || Date.now() 
            }));
          } catch (error) {
            console.error(`Error sending pong to ${clientId}:`, error);
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
          connectedListeners: this.listeners.size,
          hasSource: !!this.sourceConnection,
          platform: process.env.RAILWAY_ENVIRONMENT || 'local',
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
        console.log(`💓 Server heartbeat - uptime: ${Math.floor(uptime)}s, listeners: ${server.listeners.size}, source: ${server.sourceConnection ? 'connected' : 'none'}`);
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

