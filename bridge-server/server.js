// Dante Personal Monitor Mixer - Bridge Server (Railway Relay)
// Relays audio from source (local bridge server) to all listeners (Vue apps)

const express = require('express');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Import utilities
const { generateAccessToken, generateRefreshToken, generateRoomToken, verifyToken, extractTokenFromHeader } = require('./utils/token');
const { hashPassword, verifyPassword, validatePasswordStrength, generateRoomCode } = require('./utils/password');
const { createRateLimit } = require('./middleware/rate-limit');

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT) || 3000, // Railway sets PORT - must be parsed as integer
  sampleRate: 48000, // Dante standard
  channels: parseInt(process.env.CHANNEL_COUNT) || 16, // Number of Dante input channels
  bufferSize: 128, // Smaller = lower latency, but higher CPU
  // Server-side buffering for listeners (in milliseconds)
  // Source sends fast → Server buffers → Listeners get consistent playback
  listenerBufferMs: parseInt(process.env.LISTENER_BUFFER_MS) || 500, // 500ms default buffer
  listenerBufferSamples: null, // Will be calculated from bufferMs and sampleRate
  // Railway/cloud platforms assign PORT automatically - use same port for HTTP and WebSocket
};

// Calculate buffer size in samples
CONFIG.listenerBufferSamples = Math.round((CONFIG.listenerBufferMs / 1000) * CONFIG.sampleRate);

console.log('🔧 Configuration:', {
  port: CONFIG.port,
  channels: CONFIG.channels,
  sampleRate: CONFIG.sampleRate,
  listenerBufferMs: CONFIG.listenerBufferMs,
  listenerBufferSamples: CONFIG.listenerBufferSamples,
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
    // Multi-room management
    // rooms: Map<roomId, { broadcaster, listeners, passwordHash, metadata, suspendedUntil, state, channelBuffers, isBuffering, bufferStartTime, relayInterval, relaySequence }>
    this.rooms = new Map();
    
    // Legacy single-room support (for backward compatibility during migration)
    this.listeners = new Map(); // clientId -> { ws, userId, type: 'listener', roomId? }
    this.sourceConnection = null; // { ws, userId, clientId, type: 'source', roomId? }
    this.audioBuffer = null;
    this.httpServer = null;
    this.wss = null;
    
    // Legacy server-side buffering (will be per-room)
    this.channelBuffers = new Array(CONFIG.channels).fill(null).map(() => []);
    this.isBuffering = true;
    this.bufferStartTime = null;
    this.relayInterval = null;
    this.relaySequence = 0;
    
    // Metrics
    this.metrics = {
      totalRoomsCreated: 0,
      totalListeners: 0,
      totalPacketsSent: 0,
      totalPacketsReceived: 0,
      authSuccesses: 0,
      authFailures: 0,
      roomDurations: [],
    };
    
    // Room cleanup interval (check for suspended rooms to close)
    this.roomCleanupInterval = setInterval(() => {
      this.cleanupSuspendedRooms();
    }, 60000); // Check every minute
    
    // Initialize HTTP server first, then WebSocket (which attaches to HTTP server)
    this.initHTTP();
    // initWebSocket will be called after HTTP server is ready
    // No local audio input on Railway - audio comes from source connection
  }
  
  // Clean up suspended rooms that have exceeded grace period
  cleanupSuspendedRooms() {
    const now = Date.now();
    const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.state === 'suspended' && room.suspendedUntil && now > room.suspendedUntil) {
        console.log(`🗑️ Closing suspended room ${roomId} (grace period expired)`);
        this.closeRoom(roomId);
      }
    }
  }
  
  // Create a new room
  async createRoom(broadcasterUserId, password, metadata = {}) {
    let roomCode;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Generate unique room code
    do {
      roomCode = generateRoomCode();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Failed to generate unique room code');
      }
    } while (this.rooms.has(roomCode));
    
    const roomId = roomCode;
    const passwordHash = await hashPassword(password);
    
    const room = {
      broadcaster: null, // Will be set when broadcaster connects
      listeners: new Map(), // clientId -> { ws, userId, nickname, joinedAt }
      passwordHash: passwordHash,
      metadata: {
        createdBy: broadcasterUserId,
        createdAt: new Date().toISOString(),
        name: metadata.name || `Room ${roomCode}`,
        public: metadata.public !== false, // Default to public
        ...metadata,
      },
      suspendedUntil: null,
      state: 'active', // 'active', 'suspended', 'closed'
      // Device and channel assignments
      assignedDevices: [], // Array of { deviceId, channels: [1,2,3], assignedAt }
      assignedChannels: {}, // Map of channelNumber -> { deviceId, channelNumber, active }
      // Per-room audio buffering
      channelBuffers: new Array(CONFIG.channels).fill(null).map(() => []),
      isBuffering: true,
      bufferStartTime: null,
      relayInterval: null,
      relaySequence: 0,
      _channelsReceived: new Set(),
      _audioReceivedCount: 0,
    };
    
    // Persist to database if Supabase is available
    if (supabase) {
      try {
        const { error } = await supabase
          .from('audio_rooms')
          .insert({
            id: roomId,
            code: roomCode,
            password_hash: passwordHash,
            created_by: broadcasterUserId,
            active: true,
            metadata: room.metadata,
          });
        
        if (error) {
          console.error('Error persisting room to database:', error);
          // Continue anyway - room is created in memory
        } else {
          console.log(`✅ Room ${roomId} persisted to database`);
        }
      } catch (error) {
        console.error('Error persisting room to database:', error);
        // Continue anyway
      }
    }
    
    this.rooms.set(roomId, room);
    this.metrics.totalRoomsCreated++;
    
    // Hash password asynchronously
    hashPassword(password).then((hash) => {
      room.passwordHash = hash;
    }).catch((error) => {
      console.error(`Error hashing password for room ${roomId}:`, error);
    });
    
    console.log(`✅ Room created: ${roomId} by user ${broadcasterUserId}`);
    return { roomId, roomCode };
  }
  
  // Close a room
  async closeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    // Stop relay interval
    if (room.relayInterval) {
      clearInterval(room.relayInterval);
      room.relayInterval = null;
    }
    
    // Close all connections
    if (room.broadcaster && room.broadcaster.ws) {
      try {
        room.broadcaster.ws.close();
      } catch (e) {
        // Ignore
      }
    }
    
    room.listeners.forEach((listener) => {
      if (listener.ws) {
        try {
          listener.ws.send(JSON.stringify({ type: 'roomClosed', roomId }));
          listener.ws.close();
        } catch (e) {
          // Ignore
        }
      }
    });
    
    // Calculate room duration if it had a broadcaster
    if (room.broadcaster && room.metadata.createdAt) {
      const duration = Date.now() - new Date(room.metadata.createdAt).getTime();
      this.metrics.roomDurations.push(duration);
      // Keep only last 1000 durations
      if (this.metrics.roomDurations.length > 1000) {
        this.metrics.roomDurations.shift();
      }
    }
    
    // Update database
    if (supabase) {
      try {
        const { error } = await supabase
          .from('audio_rooms')
          .update({ active: false })
          .eq('id', roomId);
        
        if (error) {
          console.error('Error updating room in database:', error);
        } else {
          console.log(`✅ Room ${roomId} marked as inactive in database`);
        }
      } catch (error) {
        console.error('Error updating room in database:', error);
      }
    }
    
    this.rooms.delete(roomId);
    console.log(`🗑️ Room closed: ${roomId}`);
  }
  
  // Suspend a room (grace period for broadcaster reconnection)
  suspendRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.state = 'suspended';
    room.suspendedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes grace period
    room.broadcaster = null;
    
    // Notify listeners
    room.listeners.forEach((listener) => {
      if (listener.ws && listener.ws.readyState === WebSocket.OPEN) {
        try {
          listener.ws.send(JSON.stringify({
            type: 'roomSuspended',
            roomId,
            suspendedUntil: room.suspendedUntil,
          }));
        } catch (e) {
          // Ignore
        }
      }
    });
    
    console.log(`⏸️ Room suspended: ${roomId} (grace period until ${new Date(room.suspendedUntil).toISOString()})`);
  }

  // Start relay interval to send buffered audio to listeners at consistent rate
  startRelayInterval() {
    if (this.relayInterval) {
      return; // Already started
    }
    
    // Calculate relay interval based on buffer size and sample rate
    // Target: relay packets at the same rate they're being received
    // Each packet represents ~341ms of audio (4096 samples * 4 batches / 48000)
    const relayIntervalMs = 341; // Match the source's batch interval
    
    console.log(`🔄 [SERVER] Starting relay interval: ${relayIntervalMs}ms (targeting consistent playback for listeners)`);
    
    this.relayInterval = setInterval(() => {
      this.relayBufferedAudio();
    }, relayIntervalMs);
  }
  
  // Stop relay interval
  stopRelayInterval() {
    if (this.relayInterval) {
      clearInterval(this.relayInterval);
      this.relayInterval = null;
      console.log('🛑 [SERVER] Stopped relay interval');
    }
  }
  
  // Relay buffered audio to all listeners
  relayBufferedAudio() {
    if (this.listeners.size === 0) {
      return; // No listeners to relay to
    }
    
    // Find the channel with the most buffered packets
    let maxBufferSize = 0;
    for (let ch = 0; ch < this.channelBuffers.length; ch++) {
      if (this.channelBuffers[ch].length > maxBufferSize) {
        maxBufferSize = this.channelBuffers[ch].length;
      }
    }
    
    if (maxBufferSize === 0) {
      return; // No buffered audio
    }
    
    // Relay one packet from each channel that has data
    let relayedCount = 0;
    let errorCount = 0;
    const channelsRelayed = [];
    
    for (let channel = 0; channel < this.channelBuffers.length; channel++) {
      const buffer = this.channelBuffers[channel];
      if (buffer.length === 0) continue;
      
      channelsRelayed.push(channel);
      
      // Get oldest packet (FIFO)
      const packet = buffer.shift();
      
      const audioMessage = JSON.stringify({
        type: 'audio',
        channel: channel,
        data: packet.data,
        encoding: packet.encoding,
        timestamp: packet.timestamp,
        sequence: this.relaySequence++,
        bufferCount: packet.bufferCount,
      });
      
      // Relay to all listeners
      this.listeners.forEach((listener, listenerId) => {
        if (listener.ws.readyState === WebSocket.OPEN) {
          try {
            listener.ws.send(audioMessage, (error) => {
              if (error) {
                errorCount++;
                console.error(`Error relaying audio to listener ${listenerId}:`, error.message);
                if (listener.ws.readyState !== WebSocket.OPEN) {
                  this.listeners.delete(listenerId);
                }
              } else {
                relayedCount++;
              }
            });
          } catch (error) {
            errorCount++;
            console.error(`Error relaying audio to listener ${listenerId}:`, error.message);
            if (listener.ws.readyState !== WebSocket.OPEN) {
              this.listeners.delete(listenerId);
            }
          }
        } else {
          this.listeners.delete(listenerId);
        }
      });
    }
    
    // Log relay stats periodically
    if (!this._relayStats) this._relayStats = { total: 0, relayed: 0, errors: 0 };
    this._relayStats.total++;
    this._relayStats.relayed += relayedCount;
    this._relayStats.errors += errorCount;
    
    if (this._relayStats.total % 100 === 0) {
      const avgRelayed = this.listeners.size > 0 ? Math.round(this._relayStats.relayed / this._relayStats.total) : 0;
      const errorRate = this._relayStats.total > 0 ? ((this._relayStats.errors / this._relayStats.total) * 100).toFixed(2) : '0.00';
      const bufferSizes = this.channelBuffers.map(buf => buf.length).join(',');
      const channelsRelayedStr = channelsRelayed.length > 0 ? channelsRelayed.join(',') : 'none';
      console.log(`📊 [SERVER] Relay stats: ${this._relayStats.total} cycles, avg ${avgRelayed} relayed per cycle, ${this._relayStats.errors} errors (${errorRate}%), buffer sizes: [${bufferSizes}], channels relayed this cycle: [${channelsRelayedStr}], listeners: ${this.listeners.size}`);
    }
  }

  // Notify all listeners about source status (legacy)
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
            isYourSource: listener.userId === sourceUserId,
          }));
        } catch (error) {
          console.error(`Error notifying source status to listener ${listenerId}:`, error);
        }
      }
    });
    
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
  
  // Notify room participants about room status
  notifyRoomStatus(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const hasBroadcaster = !!room.broadcaster;
    const broadcasterUserId = room.broadcaster?.userId || null;
    
    // Notify broadcaster
    if (room.broadcaster && room.broadcaster.ws.readyState === WebSocket.OPEN) {
      try {
        room.broadcaster.ws.send(JSON.stringify({
          type: 'roomStatus',
          roomId: roomId,
          hasBroadcaster: true,
          listenerCount: room.listeners.size,
          state: room.state,
        }));
      } catch (error) {
        console.error(`Error notifying room status to broadcaster:`, error);
      }
    }
    
    // Notify listeners
    room.listeners.forEach((listener, listenerId) => {
      if (listener.ws && listener.ws.readyState === WebSocket.OPEN) {
        try {
          listener.ws.send(JSON.stringify({
            type: 'roomStatus',
            roomId: roomId,
            hasBroadcaster: hasBroadcaster,
            broadcasterUserId: broadcasterUserId,
            listenerCount: room.listeners.size,
            state: room.state,
          }));
        } catch (error) {
          console.error(`Error notifying room status to listener ${listenerId}:`, error);
        }
      }
    });
  }
  
  // Start relay interval for a specific room
  startRoomRelayInterval(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.relayInterval) return;
    
    const relayIntervalMs = 341; // Match source batch interval
    
    room.relayInterval = setInterval(() => {
      this.relayRoomAudio(roomId);
    }, relayIntervalMs);
    
    console.log(`🔄 [ROOM ${roomId}] Starting relay interval: ${relayIntervalMs}ms`);
  }
  
  // Stop relay interval for a specific room
  stopRoomRelayInterval(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.relayInterval) return;
    
    clearInterval(room.relayInterval);
    room.relayInterval = null;
    console.log(`🛑 [ROOM ${roomId}] Stopped relay interval`);
  }
  
  // Relay buffered audio for a specific room
  relayRoomAudio(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.listeners.size === 0) return;
    
    // Find max buffer size across channels
    let maxBufferSize = 0;
    for (let ch = 0; ch < room.channelBuffers.length; ch++) {
      if (room.channelBuffers[ch].length > maxBufferSize) {
        maxBufferSize = room.channelBuffers[ch].length;
      }
    }
    
    if (maxBufferSize === 0) return;
    
    // Relay one packet from each channel
    for (let channel = 0; channel < room.channelBuffers.length; channel++) {
      const buffer = room.channelBuffers[channel];
      if (buffer.length === 0) continue;
      
      const packet = buffer.shift();
      
      const audioMessage = JSON.stringify({
        type: 'audio',
        channel: channel,
        data: packet.data,
        encoding: packet.encoding,
        timestamp: packet.timestamp,
        sequence: room.relaySequence++,
        bufferCount: packet.bufferCount,
      });
      
      // Relay to all room listeners
      room.listeners.forEach((listener, listenerId) => {
        if (listener.ws && listener.ws.readyState === WebSocket.OPEN) {
          try {
            listener.ws.send(audioMessage);
            this.metrics.totalPacketsSent++;
          } catch (error) {
            console.error(`Error relaying audio to listener ${listenerId} in room ${roomId}:`, error);
            if (listener.ws.readyState !== WebSocket.OPEN) {
              room.listeners.delete(listenerId);
            }
          }
        } else {
          room.listeners.delete(listenerId);
        }
      });
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
        perMessageDeflate: false, // Disable compression for lower latency (audio is already compressed if using Opus)
        clientTracking: true,
        maxPayload: 10 * 1024 * 1024, // 10MB max payload (for large audio batches)
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
      
      // Track connection start time for duration logging
      ws._connectionStartTime = Date.now();
      
      // Initially add as listener - will be changed to source if connection type message received
      this.listeners.set(clientId, { ws, userId: null, type: 'listener' });
      console.log(`📈 Total connections: ${this.listeners.size} listeners, ${this.sourceConnection ? 1 : 0} source`);

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
        // Clean up heartbeat
        if (ws._heartbeatInterval) {
          clearInterval(ws._heartbeatInterval);
        }
        
        const reasonStr = reason ? reason.toString() : 'none';
        console.log(`❌ Client disconnected: ${clientId} (code: ${code}, reason: ${reasonStr})`);
        
        // Log connection duration if available
        if (ws._connectionStartTime) {
          const duration = Date.now() - ws._connectionStartTime;
          console.log(`⏱️ Connection duration: ${Math.round(duration / 1000)}s`);
        }
        
        // Log specific error codes for debugging
        if (code === 1006) {
          console.warn(`⚠️ Abnormal closure (1006) for ${clientId} - connection closed without proper close frame`);
        }
        
        // Check if this client is a broadcaster in a room
        let roomId = null;
        let room = null;
        for (const [rid, r] of this.rooms.entries()) {
          if (r.broadcaster && r.broadcaster.clientId === clientId) {
            roomId = rid;
            room = r;
            break;
          } else if (r.listeners.has(clientId)) {
            // This is a listener in a room
            r.listeners.delete(clientId);
            console.log(`👂 Listener left room ${rid}: ${clientId} (remaining: ${r.listeners.size})`);
            this.notifyRoomStatus(rid);
            
            // Stop relay if no listeners
            if (r.listeners.size === 0 && r.relayInterval) {
              this.stopRoomRelayInterval(rid);
            }
            return; // Already handled
          }
        }
        
        if (roomId && room) {
          // Broadcaster disconnected - suspend room
          console.log(`⚠️ Broadcaster disconnected from room ${roomId} - suspending room`);
          this.suspendRoom(roomId);
          this.stopRoomRelayInterval(roomId);
        } else if (this.sourceConnection && this.sourceConnection.clientId === clientId) {
          // Legacy single-room mode - source disconnected
          console.log('⚠️ Source connection lost - audio streaming stopped');
          this.sourceConnection = null;
          this.stopRelayInterval();
          this.channelBuffers.forEach(buffer => buffer.length = 0);
          this.isBuffering = true;
          this.bufferStartTime = null;
          this.notifySourceStatus();
        } else {
          // Legacy listener disconnected
          this.listeners.delete(clientId);
          console.log(`📉 Listener count: ${this.listeners.size}`);
          
          if (this.listeners.size === 0) {
            this.stopRelayInterval();
          }
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error.message || error);
      });
      
      ws.on('ping', () => {
        ws.pong();
      });
      
      // Handle JSON ping messages from client (keepalive and latency measurement)
      // Note: ws library handles ping/pong automatically, but we can also handle JSON ping messages
      
      // Set up heartbeat: ping client every 30 seconds
      ws._heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: Date.now(),
            }));
          } catch (error) {
            console.error(`Error sending heartbeat to ${clientId}:`, error);
            clearInterval(ws._heartbeatInterval);
          }
        } else {
          clearInterval(ws._heartbeatInterval);
        }
      }, 30000); // 30 seconds
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
          // Register this connection as the audio source for a room
          // Supports both room-based (new) and legacy single-room modes
          try {
            const roomId = data.roomId;
            const roomToken = data.roomToken || data.token; // Support both room token and legacy Supabase token
            
            if (roomId && roomToken) {
              // Room-based registration
              const room = this.rooms.get(roomId);
              if (!room) {
                client.ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                return;
              }
              
              if (room.state !== 'active' && room.state !== 'suspended') {
                client.ws.send(JSON.stringify({ type: 'error', message: 'Room is not available' }));
                return;
              }
              
              // Verify room token
              let decoded;
              try {
                decoded = verifyToken(roomToken);
                if (decoded.type !== 'room' || decoded.roomId !== roomId) {
                  throw new Error('Invalid room token');
                }
              } catch (error) {
                client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid room token' }));
                return;
              }
              
              // Check if room already has a broadcaster
              if (room.broadcaster && room.broadcaster.clientId !== clientId) {
                // Check if this is the same user reclaiming
                if (decoded.userId && room.broadcaster.userId === decoded.userId) {
                  console.log(`🔄 User ${decoded.userId} reclaiming broadcaster for room ${roomId}`);
                  try {
                    room.broadcaster.ws.close();
                  } catch (e) {
                    // Ignore
                  }
                } else {
                  client.ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Room already has a broadcaster' 
                  }));
                  return;
                }
              }
              
              // Remove from legacy listeners if present
              this.listeners.delete(clientId);
              
              // Set as room broadcaster
              room.broadcaster = {
                ws: client.ws,
                userId: decoded.userId,
                clientId: clientId,
                type: 'source',
                roomId: roomId,
              };
              
              // Resume room if suspended
              if (room.state === 'suspended') {
                room.state = 'active';
                room.suspendedUntil = null;
                console.log(`▶️ Room ${roomId} resumed by broadcaster`);
              }
              
              // Reset room buffering state
              room.channelBuffers.forEach(buffer => buffer.length = 0);
              room.isBuffering = true;
              room.bufferStartTime = null;
              room.relaySequence = 0;
              room._channelsReceived = new Set();
              if (room.relayInterval) {
                clearInterval(room.relayInterval);
                room.relayInterval = null;
              }
              
              console.log(`🎤 Broadcaster registered for room ${roomId}: ${clientId}`);
              client.ws.send(JSON.stringify({ 
                type: 'sourceRegistered', 
                roomId: roomId,
                userId: decoded.userId,
                channels: CONFIG.channels,
                sampleRate: CONFIG.sampleRate,
                listenerCount: room.listeners.size,
              }));
              
              // Notify room listeners
              this.notifyRoomStatus(roomId);
            } else {
              // Legacy single-room mode (backward compatibility)
          if (!supabase) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Supabase not configured' }));
            return;
          }
          
            const { data: user, error } = await supabase.auth.getUser(data.token);
            if (error) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              return;
            }
            
            // Check if this user is already the source (reconnection scenario)
            if (this.sourceConnection && this.sourceConnection.userId === user.user.id) {
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
            
            // Reset buffering state when new source registers
            this.channelBuffers.forEach(buffer => buffer.length = 0);
            this.isBuffering = true;
            this.bufferStartTime = null;
            this.relaySequence = 0;
              this._channelsReceived = new Set();
              this.stopRelayInterval();
            
            console.log(`🎤 Source registered: ${clientId} by user ${user.user.id}`);
            client.ws.send(JSON.stringify({ 
              type: 'sourceRegistered', 
              userId: user.user.id,
              channels: CONFIG.channels,
              sampleRate: CONFIG.sampleRate
            }));
            
            this.notifySourceStatus();
            }
          } catch (error) {
            console.error('Source registration error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Source registration error' }));
          }
          break;
        
        case 'registerListener':
          // Register as listener for a room
          try {
            const { roomId, roomToken } = data;
            
            if (!roomId || !roomToken) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Room ID and token required' }));
              return;
            }
            
            const room = this.rooms.get(roomId);
            if (!room) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
              return;
            }
            
            if (room.state !== 'active' && room.state !== 'suspended') {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Room is not available' }));
              return;
            }
            
            // Verify room token
            let decoded;
            try {
              decoded = verifyToken(roomToken);
              if (decoded.type !== 'room' || decoded.roomId !== roomId) {
                throw new Error('Invalid room token');
              }
            } catch (error) {
              client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid room token' }));
              return;
            }
            
            // Remove from legacy listeners if present
            this.listeners.delete(clientId);
            
            // Add to room listeners
            room.listeners.set(clientId, {
              ws: client.ws,
              userId: decoded.userId || null,
              nickname: data.nickname || null,
              joinedAt: Date.now(),
              clientId: clientId,
            });
            
            console.log(`👂 Listener joined room ${roomId}: ${clientId} (total: ${room.listeners.size})`);
            
            // Send room status
            client.ws.send(JSON.stringify({
              type: 'listenerRegistered',
              roomId: roomId,
              roomName: room.metadata.name,
              hasBroadcaster: !!room.broadcaster,
              listenerCount: room.listeners.size,
              state: room.state,
              channels: CONFIG.channels,
              sampleRate: CONFIG.sampleRate,
            }));
            
            // Notify room status to all
            this.notifyRoomStatus(roomId);
          } catch (error) {
            console.error('Listener registration error:', error);
            client.ws.send(JSON.stringify({ type: 'error', message: 'Listener registration error' }));
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
            
            // Stop relay interval and clear buffers
            this.stopRelayInterval();
            this.channelBuffers.forEach(buffer => buffer.length = 0);
            this.isBuffering = true;
            this.bufferStartTime = null;
            
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
          // Audio data from source - buffer it, then relay to listeners at consistent rate
          // Supports both room-based (new) and legacy single-room modes
          let roomId = null;
          let room = null;
          
          // Determine if this is room-based or legacy
          if (isSource && this.sourceConnection && this.sourceConnection.roomId) {
            roomId = this.sourceConnection.roomId;
            room = this.rooms.get(roomId);
          } else if (!isSource) {
            // Check if client is in a room
            for (const [rid, r] of this.rooms.entries()) {
              if (r.broadcaster && r.broadcaster.clientId === clientId) {
                roomId = rid;
                room = r;
                break;
              }
            }
          }
          
          if (roomId && room) {
            // Room-based audio routing
            if (!room.broadcaster || room.broadcaster.clientId !== clientId) {
              console.warn(`Received audio from non-broadcaster client ${clientId} in room ${roomId}`);
              return;
            }
            
            this.metrics.totalPacketsReceived++;
            
            // Log periodically
            room._audioReceivedCount = (room._audioReceivedCount || 0) + 1;
            room._channelsReceived.add(data.channel);
            
            if (room._audioReceivedCount <= 5 || room._audioReceivedCount % 1000 === 0) {
              const bufferStatus = room.isBuffering ? 'buffering' : 'relaying';
              const bufferSizes = room.channelBuffers.map(buf => buf.length).join(',');
              const channelsReceivedList = Array.from(room._channelsReceived).sort((a, b) => a - b).join(',');
              console.log(`🎤 [ROOM ${roomId}] Received audio packet #${room._audioReceivedCount} (channel: ${data.channel}, encoding: ${data.encoding || 'pcm'}, status: ${bufferStatus}, buffer sizes: [${bufferSizes}], channels: [${channelsReceivedList}], listeners: ${room.listeners.size})`);
            }
            
            // Buffer audio
            if (data.channel !== undefined && data.data) {
              const channel = data.channel;
              if (channel >= 0 && channel < room.channelBuffers.length) {
                room.channelBuffers[channel].push({
                  data: data.data,
                  encoding: data.encoding || 'pcm',
                  timestamp: data.timestamp || Date.now(),
                  sequence: data.sequence || room._audioReceivedCount,
                  bufferCount: data.bufferCount || 1,
                });
                
                // Check if buffer is filled
                if (room.isBuffering) {
                  if (!room.bufferStartTime) {
                    room.bufferStartTime = Date.now();
                  }
                  
                  let minBufferSize = Infinity;
                  for (let ch = 0; ch < room.channelBuffers.length; ch++) {
                    const bufferLength = room.channelBuffers[ch].length;
                    if (bufferLength > 0 && bufferLength < minBufferSize) {
                      minBufferSize = bufferLength;
                    }
                  }
                  
                  const estimatedSamplesPerPacket = 16384;
                  const estimatedBufferSamples = minBufferSize * estimatedSamplesPerPacket;
                  
                  if (estimatedBufferSamples >= CONFIG.listenerBufferSamples || minBufferSize >= 10) {
                    const bufferingTime = Date.now() - room.bufferStartTime;
                    room.isBuffering = false;
                    room.bufferStartTime = null;
                    console.log(`✅ [ROOM ${roomId}] Buffer filled (${minBufferSize} packets, ~${estimatedBufferSamples} samples) in ${bufferingTime}ms, starting relay`);
                    
                    this.startRoomRelayInterval(roomId);
                  }
                }
              }
            }
          } else {
            // Legacy single-room mode
          if (!isSource) {
            console.warn(`Received audio from non-source client ${clientId}`);
            return;
          }
          
          // Log audio reception periodically for debugging
          if (!this._audioReceivedCount) this._audioReceivedCount = 0;
          if (!this._channelsReceived) this._channelsReceived = new Set();
          this._audioReceivedCount++;
          this._channelsReceived.add(data.channel);
          
          if (this._audioReceivedCount <= 5 || this._audioReceivedCount % 1000 === 0) {
            const bufferStatus = this.isBuffering ? 'buffering' : 'relaying';
            const bufferSizes = this.channelBuffers.map(buf => buf.length).join(',');
            const channelsReceivedList = Array.from(this._channelsReceived).sort((a, b) => a - b).join(',');
            console.log(`🎤 [SERVER] Received audio packet #${this._audioReceivedCount} from source (channel: ${data.channel}, encoding: ${data.encoding || 'pcm'}, status: ${bufferStatus}, buffer sizes: [${bufferSizes}], channels received so far: [${channelsReceivedList}], listeners: ${this.listeners.size})`);
          }
          
          // Buffer audio from source (fast acceptance, no delay)
          if (data.channel !== undefined && data.data) {
            const channel = data.channel;
            if (channel >= 0 && channel < this.channelBuffers.length) {
              // Add to buffer immediately (source → server is fast)
              this.channelBuffers[channel].push({
                data: data.data,
                encoding: data.encoding || 'pcm',
                timestamp: data.timestamp || Date.now(),
                sequence: data.sequence || this._audioReceivedCount,
                bufferCount: data.bufferCount || 1,
              });
              
              // Check if we have enough buffered data to start relaying
              if (this.isBuffering) {
                if (!this.bufferStartTime) {
                  this.bufferStartTime = Date.now();
                }
                
                // Check minimum buffer size across all channels
                let minBufferSize = Infinity;
                for (let ch = 0; ch < this.channelBuffers.length; ch++) {
                  const bufferLength = this.channelBuffers[ch].length;
                  if (bufferLength > 0 && bufferLength < minBufferSize) {
                    minBufferSize = bufferLength;
                  }
                }
                
                // Estimate samples in buffer (rough estimate: each packet is ~16384 samples when batched)
                // This is approximate - actual sample count depends on encoding and batching
                const estimatedSamplesPerPacket = 16384; // 4096 samples * 4 batches = ~16384 samples
                const estimatedBufferSamples = minBufferSize * estimatedSamplesPerPacket;
                
                if (estimatedBufferSamples >= CONFIG.listenerBufferSamples || minBufferSize >= 10) {
                  // Buffer filled - start relaying
                  const bufferingTime = Date.now() - this.bufferStartTime;
                  this.isBuffering = false;
                  this.bufferStartTime = null;
                  console.log(`✅ [SERVER] Buffer filled (${minBufferSize} packets, ~${estimatedBufferSamples} samples) in ${bufferingTime}ms, starting relay to listeners`);
                  
                  // Start relay interval if not already started
                  this.startRelayInterval();
                  }
                }
              }
            }
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

    // Authentication endpoints
    
    // POST /auth/broadcaster - Login with email/password, get access + refresh tokens
    app.post('/auth/broadcaster', createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), async (req, res) => {
      try {
        const { email, password } = req.body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }
        
        if (!supabase) {
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        
        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (authError || !authData.user) {
          this.metrics.authFailures++;
          return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Generate tokens
        const accessToken = generateAccessToken({ userId: authData.user.id, email: authData.user.email });
        const refreshToken = generateRefreshToken({ userId: authData.user.id });
        
        this.metrics.authSuccesses++;
        
        res.json({
          accessToken,
          refreshToken,
          user: {
            id: authData.user.id,
            email: authData.user.email,
          },
        });
      } catch (error) {
        console.error('Broadcaster auth error:', error);
        this.metrics.authFailures++;
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    // POST /auth/refresh - Refresh access token using refresh token
    app.post('/auth/refresh', createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 }), (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const refreshToken = extractTokenFromHeader(authHeader) || req.body.refreshToken;
        
        if (!refreshToken) {
          return res.status(400).json({ error: 'Refresh token required' });
        }
        
        const decoded = verifyToken(refreshToken);
        
        if (decoded.type !== 'refresh') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        // Generate new access token
        const accessToken = generateAccessToken({ userId: decoded.userId, email: decoded.email });
        
        res.json({ accessToken });
      } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({ error: error.message || 'Invalid refresh token' });
      }
    });
    
    // Helper function to validate token (Supabase or server-generated)
    const validateAuthToken = async (token) => {
      if (!token) {
        throw new Error('No token provided');
      }
      
      // Try Supabase JWT validation first
      if (supabase) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (!error && user) {
            console.log('✅ Supabase token validated for user:', user.email);
            return { userId: user.id, email: user.email, type: 'supabase' };
          }
        } catch (e) {
          console.log('Supabase token validation failed, trying server token...');
        }
      }
      
      // Fall back to server-generated token
      try {
        const decoded = verifyToken(token);
        if (decoded.type === 'access' || decoded.type === 'room') {
          console.log('✅ Server token validated');
          return { userId: decoded.userId, email: decoded.email, type: decoded.type };
        }
      } catch (e) {
        console.error('Token validation failed:', e.message);
      }
      
      throw new Error('Invalid token');
    };
    
    // POST /auth/room/create - Create a new room (requires authenticated broadcaster)
    app.post('/auth/room/create', createRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 3, keyGenerator: (req) => {
      // Rate limit by user ID if available, otherwise by IP
      const authHeader = req.headers.authorization;
      const token = extractTokenFromHeader(authHeader);
      if (token) {
        // Try to get user ID asynchronously, but we'll return IP for now for simplicity
        return req.ip;
      }
      return req.ip;
    } }), async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Validate token (Supabase or server-generated)
        const authData = await validateAuthToken(accessToken);
        
        const { password, name, metadata = {} } = req.body;
        
        if (!password) {
          return res.status(400).json({ error: 'Password is required' });
        }
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          return res.status(400).json({ error: passwordValidation.error });
        }
        
        // Create room
        const { roomId, roomCode } = await this.createRoom(authData.userId, password, { name, ...metadata });
        
        // Generate room token for the broadcaster
        const roomToken = generateRoomToken(roomId, authData.userId);
        
        res.json({
          roomId,
          roomCode,
          roomToken,
          name: name || `Room ${roomCode}`,
        });
      } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).json({ error: error.message || 'Failed to create room' });
      }
    });
    
    // POST /auth/room/join - Join a room with code and password
    app.post('/auth/room/join', createRateLimit({ windowMs: 5 * 60 * 1000, maxRequests: 10 }), async (req, res) => {
      try {
        const { roomCode, password } = req.body;
        
        if (!roomCode || !password) {
          return res.status(400).json({ error: 'Room code and password are required' });
        }
        
        const room = this.rooms.get(roomCode);
        
        if (!room) {
          this.metrics.authFailures++;
          return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.state !== 'active' && room.state !== 'suspended') {
          return res.status(400).json({ error: 'Room is not available' });
        }
        
        // Verify password
        if (!room.passwordHash) {
          // Password hasn't been hashed yet, wait a bit
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        
        if (!room.passwordHash) {
          return res.status(500).json({ error: 'Room password not ready' });
        }
        
        const passwordValid = await verifyPassword(password, room.passwordHash);
        
        if (!passwordValid) {
          this.metrics.authFailures++;
          return res.status(401).json({ error: 'Invalid room password' });
        }
        
        // Generate room token (no user ID for anonymous listeners)
        const roomToken = generateRoomToken(roomCode, null);
        
        this.metrics.authSuccesses++;
        
        res.json({
          roomId: roomCode,
          roomToken,
          roomName: room.metadata.name,
          listenerCount: room.listeners.size,
          state: room.state,
        });
      } catch (error) {
        console.error('Room join error:', error);
        this.metrics.authFailures++;
        res.status(500).json({ error: error.message || 'Failed to join room' });
      }
    });
    
    // GET /metrics - Server metrics endpoint
    // Public rooms endpoint
    app.get('/api/rooms/public', (req, res) => {
      try {
        const publicRooms = [];
        
        for (const [roomId, room] of this.rooms.entries()) {
          // Only include active rooms (not suspended or closed)
          if (room.state === 'active' && room.metadata) {
            publicRooms.push({
              code: roomId,
              name: room.metadata.name || `Room ${roomId}`,
              listenerCount: room.listeners.size,
              hasBroadcaster: !!room.broadcaster,
              createdAt: room.metadata.createdAt,
            });
          }
        }
        
        res.json({
          success: true,
          rooms: publicRooms,
        });
      } catch (error) {
        console.error('Error fetching public rooms:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch public rooms',
        });
      }
    });

    // Broadcaster API endpoints (require authentication)
    
    // GET /api/broadcaster/me - Get current broadcaster info
    app.get('/api/broadcaster/me', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        // Get user info from Supabase
        if (supabase) {
          const { data: userData, error } = await supabase.auth.admin.getUserById(decoded.userId);
          if (!error && userData) {
            return res.json({
              id: userData.user.id,
              email: userData.user.email,
            });
          }
        }
        
        res.json({
          id: decoded.userId,
          email: decoded.email,
        });
      } catch (error) {
        res.status(401).json({ error: error.message || 'Invalid token' });
      }
    });
    
    // GET /api/broadcaster/rooms - Get all rooms for authenticated broadcaster
    app.get('/api/broadcaster/rooms', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        const broadcasterRooms = [];
        
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.metadata.createdBy === decoded.userId) {
            broadcasterRooms.push({
              id: roomId,
              code: roomId,
              name: room.metadata.name || `Room ${roomId}`,
              listenerCount: room.listeners.size,
              hasBroadcaster: !!room.broadcaster,
              state: room.state,
              createdAt: room.metadata.createdAt,
              activeChannels: room.assignedChannels ? Object.keys(room.assignedChannels).length : 0,
              assignedDevices: room.assignedDevices || [],
            });
          }
        }
        
        res.json(broadcasterRooms);
      } catch (error) {
        res.status(401).json({ error: error.message || 'Invalid token' });
      }
    });
    
    // GET /api/broadcaster/devices - Get available audio devices (mock for web, real for Electron)
    app.get('/api/broadcaster/devices', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        // For web admin panel, return mock devices
        // In production, this would query the broadcaster's connected Electron app
        // or use a device discovery service
        const mockDevices = [
          {
            id: 'device-1',
            name: 'Dante Virtual Soundcard',
            channels: 32,
            sampleRate: 48000,
            assignedToRoom: null,
          },
          {
            id: 'device-2',
            name: 'USB Audio Interface',
            channels: 16,
            sampleRate: 48000,
            assignedToRoom: null,
          },
          {
            id: 'device-3',
            name: 'Built-in Microphone',
            channels: 1,
            sampleRate: 48000,
            assignedToRoom: null,
          },
        ];
        
        // Check which devices are assigned to rooms
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.assignedDevices) {
            for (const device of room.assignedDevices) {
              const mockDevice = mockDevices.find(d => d.id === device.deviceId);
              if (mockDevice) {
                mockDevice.assignedToRoom = room.metadata.name || roomId;
              }
            }
          }
        }
        
        res.json(mockDevices);
      } catch (error) {
        res.status(401).json({ error: error.message || 'Invalid token' });
      }
    });
    
    // POST /api/broadcaster/assign-device - Assign device to room with channels
    app.post('/api/broadcaster/assign-device', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        const { deviceId, roomId, channels } = req.body;
        
        if (!deviceId || !roomId || !channels || !Array.isArray(channels)) {
          return res.status(400).json({ error: 'deviceId, roomId, and channels array are required' });
        }
        
        const room = this.rooms.get(roomId);
        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.metadata.createdBy !== decoded.userId) {
          return res.status(403).json({ error: 'Not authorized to modify this room' });
        }
        
        // Initialize assigned devices/channels if not exists
        if (!room.assignedDevices) {
          room.assignedDevices = [];
        }
        if (!room.assignedChannels) {
          room.assignedChannels = {};
        }
        
        // Remove existing assignment for this device
        room.assignedDevices = room.assignedDevices.filter(d => d.deviceId !== deviceId);
        Object.keys(room.assignedChannels).forEach(ch => {
          if (room.assignedChannels[ch].deviceId === deviceId) {
            delete room.assignedChannels[ch];
          }
        });
        
        // Add new assignment
        room.assignedDevices.push({
          deviceId,
          channels: channels,
          assignedAt: new Date().toISOString(),
        });
        
        // Map channels
        channels.forEach(channelNum => {
          room.assignedChannels[channelNum] = {
            deviceId,
            channelNumber: channelNum,
            active: true,
          };
        });
        
        console.log(`✅ Device ${deviceId} assigned to room ${roomId} on channels ${channels.join(', ')}`);
        
        res.json({
          success: true,
          roomId,
          deviceId,
          channels,
        });
      } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to assign device' });
      }
    });
    
    // GET /api/broadcaster/rooms/:roomId/channels - Get channel assignments for a room
    app.get('/api/broadcaster/rooms/:roomId/channels', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        const { roomId } = req.params;
        const room = this.rooms.get(roomId);
        
        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.metadata.createdBy !== decoded.userId) {
          return res.status(403).json({ error: 'Not authorized to view this room' });
        }
        
        // Build channel list
        const channels = [];
        const assignedChannels = room.assignedChannels || {};
        const assignedDevices = room.assignedDevices || [];
        
        // Mock device names (in production, this would come from device registry)
        const deviceNameMap = {
          'device-1': 'Dante Virtual Soundcard',
          'device-2': 'USB Audio Interface',
          'device-3': 'Built-in Microphone',
        };
        
        for (let i = 1; i <= CONFIG.channels; i++) {
          const assignment = assignedChannels[i];
          channels.push({
            number: i,
            active: !!assignment,
            deviceId: assignment?.deviceId || null,
            deviceName: assignment ? (deviceNameMap[assignment.deviceId] || assignment.deviceId) : null,
          });
        }
        
        res.json({ channels });
      } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to load channels' });
      }
    });
    
    // DELETE /api/broadcaster/rooms/:roomId - Delete a room
    app.delete('/api/broadcaster/rooms/:roomId', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const accessToken = extractTokenFromHeader(authHeader);
        
        if (!accessToken) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        const decoded = verifyToken(accessToken);
        if (decoded.type !== 'access') {
          return res.status(401).json({ error: 'Invalid token type' });
        }
        
        const { roomId } = req.params;
        const room = this.rooms.get(roomId);
        
        if (!room) {
          return res.status(404).json({ error: 'Room not found' });
        }
        
        if (room.metadata.createdBy !== decoded.userId) {
          return res.status(403).json({ error: 'Not authorized to delete this room' });
        }
        
        await this.closeRoom(roomId);
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to delete room' });
      }
    });

    app.get('/metrics', (req, res) => {
      try {
        const activeRooms = Array.from(this.rooms.values()).filter(r => r.state === 'active').length;
        const totalListeners = Array.from(this.rooms.values()).reduce((sum, room) => sum + room.listeners.size, 0);
        const avgRoomDuration = this.metrics.roomDurations.length > 0
          ? this.metrics.roomDurations.reduce((a, b) => a + b, 0) / this.metrics.roomDurations.length
          : 0;
        
        res.json({
          activeRooms,
          totalRooms: this.rooms.size,
          totalListeners,
          totalRoomsCreated: this.metrics.totalRoomsCreated,
          totalPacketsSent: this.metrics.totalPacketsSent,
          totalPacketsReceived: this.metrics.totalPacketsReceived,
          authSuccesses: this.metrics.authSuccesses,
          authFailures: this.metrics.authFailures,
          avgRoomDurationMs: Math.round(avgRoomDuration),
          uptime: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
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
        if (process.env.RAILWAY_PUBLIC_DOMAIN) {
          console.log(`🌐 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
        }
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
      // Railway may close idle connections, so we use keepalive
      this.httpServer.keepAliveTimeout = 65000; // 65 seconds (Railway default is 60s)
      this.httpServer.headersTimeout = 66000; // 66 seconds (slightly longer than keepAliveTimeout)
      
      // Enable TCP keepalive for WebSocket connections (Railway optimization)
      this.httpServer.on('connection', (socket) => {
        socket.setKeepAlive(true, 30000); // Send keepalive every 30 seconds
        socket.setNoDelay(true); // Disable Nagle's algorithm for lower latency
      });
      
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

