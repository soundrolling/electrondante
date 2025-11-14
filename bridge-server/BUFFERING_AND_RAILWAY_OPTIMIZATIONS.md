# Buffering and Railway Optimizations

## Buffering Flow Verification

### How Buffering Works

1. **Source → Server**: Audio packets are sent from source (browser/Electron) to Railway server
2. **Server → Listeners**: Railway relays audio packets to all connected listeners
3. **Listener Buffering**: Each listener accumulates audio in buffers before playback

### Buffer Accumulation

- **Initial State**: Buffers start empty (length 0)
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

No additional Railway-specific variables needed. The server automatically:
- Uses `PORT` environment variable (set by Railway)
- Detects Railway environment from `RAILWAY_ENVIRONMENT`
- Configures timeouts appropriately

## Monitoring in Railway

### Check Server Logs

Look for these patterns:

**Good Signs:**
```
📊 [SERVER] Audio relay stats: 1000 packets, 2000 relayed, 0 errors, 2 listeners
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

## Next Steps for Optimization

1. **Opus Compression**: Already implemented for Node.js clients, reduces bandwidth
2. **Adaptive Buffering**: Could adjust buffer size based on network conditions
3. **Jitter Buffer**: Could add packet reordering for out-of-order delivery
4. **Connection Pooling**: For multiple listeners, could optimize relay logic

