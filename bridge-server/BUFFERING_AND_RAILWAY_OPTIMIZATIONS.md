# Buffering and Railway Optimizations

## Buffering Architecture

### Two-Stage Buffering System

The system uses a **two-stage buffering approach** for optimal performance:

1. **Source → Railway Server**: **Fast (no delay)**
   - Source sends audio packets immediately to Railway
   - No buffering delay on source side
   - Low latency from source to server

2. **Railway Server → Listeners**: **Buffered (delayed relay)**
   - Railway buffers audio packets before relaying
   - Default buffer: 500ms (configurable via `LISTENER_BUFFER_MS`)
   - Relays at consistent rate (341ms intervals) for smooth playback
   - Absorbs network jitter between source and listeners

3. **Listener → Playback**: **Client-side buffering**
   - Each listener accumulates audio in buffers before playback
   - Additional buffering for network variations
   - User-configurable buffer size (50-2000ms)

### How Server-Side Buffering Works

1. **Source sends audio**: Packets arrive at Railway immediately (fast)
2. **Railway buffers**: Packets stored in per-channel FIFO queues
3. **Buffer fills**: Server waits until buffer reaches target size (~500ms)
4. **Relay starts**: Server begins relaying at consistent rate (341ms intervals)
5. **Listeners receive**: Smooth, consistent audio stream despite network variations

### Server-Side Buffer Accumulation

- **Initial State**: Server buffers start empty when source registers
- **Source Sends**: Audio packets arrive at Railway and are buffered immediately (no delay)
- **Buffer Check**: Server checks if buffer has enough packets (~500ms worth)
- **Relay Start**: Once buffer is filled, server starts relaying at consistent rate
- **Continuous Relay**: Server maintains buffer and relays packets every 341ms

### Client-Side Buffer Accumulation

- **Initial State**: Listener buffers start empty (length 0)
- **Data Reception**: Audio samples are added to channel buffers via `addChannelData()`
- **Buffer Check**: `processAudio()` checks if minimum buffer size is reached
- **Playback Start**: Once `minBufferSamples` is reached, playback begins
- **Continuous Buffering**: If buffer drops below threshold, playback pauses and rebuffers

### Debugging Buffer Issues

Check browser console for these logs:

```
🎵 [MIXER] Initialized 32 channel buffers, each starting with length 0
🎵 [MIXER] Channel 0: Added 16384 samples (0 → 16384 total)
📊 [MIXER] Buffer stats: current=16384, target=16384, max=16384, progress=100.0%, isBuffering=false
✅ [MIXER] Buffer filled (16384 samples) in 500ms, starting playback
```

If you see:
- **Buffer never increases**: Check that audio packets are being received (look for `🎧 [LISTENER] Received audio packet`)
- **Buffer increases but playback doesn't start**: Check that `current >= target` in buffer stats
- **Buffer keeps resetting**: Check for errors in `addChannelData()` or WebSocket disconnections

## Railway Server Optimizations

### WebSocket Settings

1. **Compression Disabled**: `perMessageDeflate: false`
   - Audio is already compressed (Opus) or needs low latency
   - Reduces CPU usage on server

2. **Max Payload**: `maxPayload: 10MB`
   - Allows large audio batches without fragmentation
   - Prevents connection drops on large packets

3. **TCP Keepalive**: Enabled on all connections
   - `setKeepAlive(true, 30000)` - Sends keepalive every 30 seconds
   - Prevents Railway from closing idle connections
   - `setNoDelay(true)` - Disables Nagle's algorithm for lower latency

4. **HTTP Timeouts**: 
   - `keepAliveTimeout: 65000ms` (65 seconds)
   - `headersTimeout: 66000ms` (66 seconds)
   - Slightly longer than Railway's default 60s to prevent premature closures

### Error Handling

- **Broken Connections**: Automatically removed from listener list
- **Relay Stats**: Logged every 1000 packets for monitoring
- **Error Callbacks**: WebSocket send errors are caught and logged

### Railway Environment Variables

**Required:**
- `PORT` - Automatically set by Railway (don't override)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

**Optional:**
- `LISTENER_BUFFER_MS` - Server-side buffer size in milliseconds (default: 500ms)
  - Larger = smoother playback for listeners, but longer initial delay
  - Smaller = lower latency, but more prone to dropouts
  - Recommended: 300-1000ms depending on network conditions

The server automatically:
- Detects Railway environment from `RAILWAY_ENVIRONMENT`
- Configures timeouts appropriately
- Calculates buffer size in samples from `LISTENER_BUFFER_MS` and sample rate

## Monitoring in Railway

### Check Server Logs

Look for these patterns:

**Good Signs:**
```
✅ [SERVER] Buffer filled (10 packets, ~163840 samples) in 500ms, starting relay to listeners
🔄 [SERVER] Starting relay interval: 341ms (targeting consistent playback for listeners)
📊 [SERVER] Relay stats: 100 cycles, avg 2 relayed per cycle, 0 errors (0.00%), buffer sizes: [5,5,5,5], listeners: 2
✅ WebSocket server attached to HTTP server on port 3000
```

**Warning Signs:**
```
Error relaying audio to listener <id>: <error>
Received audio from non-source client <id>
```

### Health Check Endpoint

Visit `/health` to see:
- Number of connected listeners
- Whether source is active
- Server uptime

## Client-Side Buffer Monitoring

### Buffer Stats Display

The UI shows:
- **Current Buffer**: Samples currently buffered
- **Target Buffer**: Required samples before playback starts
- **Progress**: Percentage of target reached
- **Max Seen**: Highest buffer size reached (useful for debugging)

### Adjusting Buffer Size

Users can adjust buffer size (50-2000ms) in the UI:
- **Smaller buffers** = Lower latency, but more prone to dropouts
- **Larger buffers** = Smoother playback, but longer initial delay

Default: ~341ms (16384 samples at 48kHz)

## Troubleshooting

### Buffer Not Filling

1. **Check WebSocket Connection**: Look for `✅ Connected to bridge server`
2. **Check Audio Reception**: Look for `🎧 [LISTENER] Received audio packet`
3. **Check Source Status**: Verify source is active and streaming
4. **Check Network**: Look for packet loss in connection quality display

### Buffer Fills But Playback Doesn't Start

1. **Check Buffer Stats**: Verify `current >= target`
2. **Check Audio Context**: Verify `✅ Audio mixer started`
3. **Check Browser Permissions**: Audio playback may require user interaction

### Intermittent Dropouts

1. **Increase Buffer Size**: Use larger buffer (500-1000ms)
2. **Check Network Quality**: Look for packet loss or high latency
3. **Check Server Load**: Monitor Railway logs for errors

## Railway-Specific Recommendations

1. **Resource Limits**: Railway free tier has limits - monitor CPU/memory usage
2. **Connection Limits**: Railway may limit concurrent connections
3. **Timeout Settings**: Current settings (65s keepalive) should prevent premature closures
4. **Logging**: Railway logs are available in dashboard - check for errors

## Server-Side Buffering Configuration

### Adjusting Buffer Size

Set `LISTENER_BUFFER_MS` environment variable in Railway:
- **300ms**: Lower latency, faster startup, but more prone to dropouts
- **500ms** (default): Balanced - good for most use cases
- **1000ms**: Smoother playback, longer initial delay, better for unstable networks

### How It Works

1. Source sends audio packets → Railway buffers them immediately
2. Railway accumulates packets until buffer target is reached
3. Railway starts relaying at consistent rate (341ms intervals)
4. Listeners receive smooth, consistent stream

### Benefits

- **Source doesn't wait**: Can send audio as fast as possible
- **Consistent playback**: Listeners get smooth audio despite network jitter
- **Network resilience**: Server buffer absorbs variations
- **Configurable**: Adjust buffer size based on network conditions

## Next Steps for Optimization

1. **Opus Compression**: Already implemented for Node.js clients, reduces bandwidth
2. **Adaptive Buffering**: Could adjust buffer size based on network conditions
3. **Jitter Buffer**: Could add packet reordering for out-of-order delivery
4. **Connection Pooling**: For multiple listeners, could optimize relay logic
5. **Dynamic Buffer Adjustment**: Could adjust server buffer based on listener count and network quality

