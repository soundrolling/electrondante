# Database Usage Guide

## Overview

This guide shows how to use the Supabase database tables in the server code for persistence and analytics.

## Current Status

The server currently uses **in-memory room storage**. The database tables are ready for integration. Below are examples of how to integrate database persistence.

## Integration Examples

### 1. Persist Room Creation

When a room is created in `server.js`, also save to database:

```javascript
// In createRoom() method
async createRoom(broadcasterUserId, password, metadata = {}) {
  // ... existing in-memory room creation ...
  
  // Also persist to database
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audio_rooms')
        .insert({
          code: roomCode,
          password_hash: room.passwordHash,
          created_by: broadcasterUserId,
          active: true,
          public: metadata.public || false,
          metadata: metadata,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error persisting room to database:', error);
        // Continue with in-memory room even if DB fails
      } else {
        console.log(`Room ${roomCode} persisted to database`);
      }
    } catch (error) {
      console.error('Exception persisting room:', error);
    }
  }
  
  return { roomId, roomCode };
}
```

### 2. Track Participant Joins

When a listener joins a room:

```javascript
// In registerListener handler
if (supabase && roomId) {
  try {
    await supabase.from('room_participants').insert({
      room_id: roomId,
      user_id: decoded.userId || null,
      nickname: data.nickname || null,
      client_id: clientId,
      role: 'listener',
      joined_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging participant join:', error);
  }
}
```

### 3. Track Participant Leaves

When a listener leaves:

```javascript
// In WebSocket close handler
if (supabase && roomId) {
  try {
    await supabase
      .from('room_participants')
      .update({
        left_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('client_id', clientId)
      .is('left_at', null); // Only update if not already set
  } catch (error) {
    console.error('Error logging participant leave:', error);
  }
}
```

### 4. Log Audit Events

For security and debugging:

```javascript
// Helper function
async function logAuditEvent(eventType, userId, roomId, ipAddress, details = {}) {
  if (!supabase) return;
  
  try {
    await supabase.from('audit_log').insert({
      event_type: eventType,
      user_id: userId || null,
      room_id: roomId || null,
      ip_address: ipAddress,
      details: details,
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

// Usage examples:
// Login success
await logAuditEvent('login_success', user.id, null, req.ip);

// Room created
await logAuditEvent('room_created', userId, roomId, req.ip, { roomCode });

// Failed login
await logAuditEvent('login_failure', null, null, req.ip, { email });

// Rate limit exceeded
await logAuditEvent('rate_limit_exceeded', userId, null, req.ip, { endpoint });
```

### 5. Update Room Analytics

Aggregate analytics periodically or on room close:

```javascript
// When room closes or periodically
async function updateRoomAnalytics(roomId) {
  if (!supabase) return;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get current stats
    const { data: participants } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);
    
    const peakListeners = Math.max(...participants.map(p => 
      // Calculate peak from connection times
      // (simplified - would need more complex query for actual peak)
    ));
    
    const totalListenMinutes = participants
      .filter(p => p.connection_duration)
      .reduce((sum, p) => sum + (p.connection_duration / 60), 0);
    
    // Upsert analytics
    await supabase.from('room_analytics').upsert({
      room_id: roomId,
      date: today,
      peak_listeners: peakListeners,
      total_listen_minutes: Math.round(totalListenMinutes),
      total_listeners: participants.length,
    }, {
      onConflict: 'room_id,date'
    });
  } catch (error) {
    console.error('Error updating room analytics:', error);
  }
}
```

### 6. Mark Room as Inactive

When room is closed:

```javascript
// In closeRoom() method
if (supabase && roomId) {
  try {
    await supabase
      .from('audio_rooms')
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('code', roomId);
  } catch (error) {
    console.error('Error marking room as inactive:', error);
  }
}
```

## Query Examples

### Get Active Rooms for a User

```javascript
const { data: rooms } = await supabase
  .from('audio_rooms')
  .select('*')
  .eq('created_by', userId)
  .eq('active', true)
  .order('created_at', { ascending: false });
```

### Get Room Participants

```javascript
const { data: participants } = await supabase
  .from('room_participants')
  .select('*, audio_rooms(code, metadata)')
  .eq('room_id', roomId)
  .is('left_at', null); // Only active participants
```

### Get Room Statistics

```javascript
const { data: stats } = await supabase
  .from('room_statistics_view')
  .select('*')
  .eq('id', roomId)
  .single();
```

### Get Recent Audit Logs

```javascript
const { data: logs } = await supabase
  .from('audit_log')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(100);
```

## Migration Strategy

Since the server currently uses in-memory storage, you can:

1. **Phase 1**: Add database writes alongside in-memory (dual-write)
2. **Phase 2**: Read from database on startup to restore rooms
3. **Phase 3**: Remove in-memory storage, use database as source of truth

### Restore Rooms on Startup

```javascript
// In server constructor or init method
async restoreRoomsFromDatabase() {
  if (!supabase) return;
  
  try {
    const { data: rooms, error } = await supabase
      .from('audio_rooms')
      .select('*')
      .eq('active', true);
    
    if (error) {
      console.error('Error restoring rooms:', error);
      return;
    }
    
    for (const roomData of rooms) {
      // Recreate in-memory room structure
      const room = {
        broadcaster: null,
        listeners: new Map(),
        passwordHash: roomData.password_hash,
        metadata: roomData.metadata || {},
        suspendedUntil: roomData.suspended_until ? new Date(roomData.suspended_until) : null,
        state: roomData.suspended_until ? 'suspended' : 'active',
        channelBuffers: new Array(CONFIG.channels).fill(null).map(() => []),
        isBuffering: true,
        bufferStartTime: null,
        relayInterval: null,
        relaySequence: 0,
        _channelsReceived: new Set(),
        _audioReceivedCount: 0,
      };
      
      this.rooms.set(roomData.code, room);
      console.log(`Restored room ${roomData.code} from database`);
    }
  } catch (error) {
    console.error('Exception restoring rooms:', error);
  }
}
```

## Performance Considerations

- **Indexes**: All foreign keys and frequently queried columns are indexed
- **Batch Operations**: Use batch inserts for multiple participants
- **Async Operations**: Database operations should be non-blocking
- **Error Handling**: Always handle database errors gracefully - don't break room functionality if DB is down

## Security Notes

- Service role key has full access (bypasses RLS)
- User-scoped operations use RLS policies
- Passwords are hashed before storage
- IP addresses are logged for audit purposes
- All timestamps use TIME ZONE for accuracy

