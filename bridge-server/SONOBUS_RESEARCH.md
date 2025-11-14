# SonoBus Integration Research

## Overview

SonoBus is an open-source, high-quality, low-latency peer-to-peer audio streaming application. It's available at: https://github.com/sonosaurus/sonobus

## Current Architecture vs SonoBus

### Current Architecture (Relay/Server-Based)
```
Source → Railway Server (Relay) → Multiple Listeners
```
- **Pros:**
  - Simple to implement
  - Centralized control
  - Easy authentication/authorization
  - Works behind firewalls (Railway handles NAT)
  - One source, many listeners (broadcast model)

- **Cons:**
  - Higher latency (source → server → listeners)
  - Server bandwidth costs
  - Single point of failure
  - Server must handle all audio traffic

### SonoBus Architecture (Peer-to-Peer)
```
Source ↔ Listeners (Direct P2P connections)
```
- **Pros:**
  - Lower latency (direct connections)
  - No server bandwidth costs
  - Distributed (no single point of failure)
  - Efficient for small groups

- **Cons:**
  - More complex (NAT traversal, WebRTC, signaling)
  - Firewall/NAT issues (requires STUN/TURN servers)
  - Harder to implement authentication
  - Not ideal for one-to-many (each listener needs P2P connection to source)

## SonoBus Key Technologies

1. **WebRTC** - For peer-to-peer audio/video streaming
2. **Juce Framework** - Cross-platform audio framework (C++)
3. **Opus Codec** - Low-latency audio codec
4. **NAT Traversal** - STUN/TURN servers for firewall traversal
5. **Signaling Server** - For initial connection setup (WebSocket/HTTP)

## Potential Integration Approaches

### Option 1: Hybrid Approach (Recommended)
Keep Railway as signaling server, use WebRTC for audio:
```
Source → Railway (Signaling) → WebRTC P2P → Listeners
```
- Railway handles authentication and signaling
- Audio streams directly via WebRTC (lower latency)
- Railway doesn't handle audio data (reduces bandwidth)

### Option 2: Full P2P with Signaling
Replace Railway relay with signaling-only server:
```
Railway (Signaling Only) → WebRTC Mesh → All Peers
```
- Railway only for connection setup
- All audio is P2P
- More complex but most efficient

### Option 3: Learn from SonoBus, Keep Current Architecture
- Use SonoBus codec/compression techniques
- Keep relay architecture for simplicity
- Improve audio quality/latency with better codecs

## SonoBus Features We Could Adopt

1. **Opus Codec** - Better compression, lower latency than raw PCM
2. **Adaptive Bitrate** - Adjust quality based on network
3. **Jitter Buffer** - Handle network jitter better
4. **Audio Quality Settings** - User-selectable quality vs latency tradeoff
5. **Connection Quality Monitoring** - Show network stats to users

## Implementation Considerations

### For Our Use Case (One Source, Many Listeners)

**Current relay model is actually better because:**
- One source broadcasting to many listeners
- P2P would require source to maintain N connections (scales poorly)
- Relay is more efficient for broadcast scenarios

**But we could improve with:**
- Opus codec instead of raw PCM (much smaller packets)
- Better buffering/jitter handling
- Adaptive quality based on listener's connection

### WebRTC Integration Path

If we want to move to WebRTC:

1. **Signaling Server (Railway)**
   - Handle authentication
   - Exchange WebRTC offer/answer
   - Manage connection state

2. **Source (Electron App)**
   - Create WebRTC peer connection
   - Send audio via RTCRtpSender
   - Handle multiple peer connections (one per listener)

3. **Listeners (Vue App)**
   - Create WebRTC peer connection
   - Receive audio via RTCRtpReceiver
   - Handle audio playback

4. **STUN/TURN Servers**
   - Required for NAT traversal
   - Can use public STUN servers (free)
   - May need TURN server for strict firewalls (costs)

## Recommended Next Steps

1. **Short Term (Keep Current Architecture)**
   - Add Opus codec compression
   - Improve jitter buffering
   - Add connection quality monitoring

2. **Medium Term (Hybrid)**
   - Add WebRTC option for low-latency scenarios
   - Keep WebSocket relay as fallback
   - Let users choose based on their needs

3. **Long Term (Full P2P)**
   - Evaluate if full P2P makes sense for use case
   - Consider SonoBus codebase for reference
   - Implement only if latency/bandwidth becomes critical

## Resources

- **SonoBus GitHub**: https://github.com/sonosaurus/sonobus
- **SonoBus Website**: https://www.sonobus.net
- **WebRTC Documentation**: https://webrtc.org
- **Opus Codec**: https://opus-codec.org

## Code References

Key SonoBus files to study:
- Audio streaming implementation
- WebRTC peer connection handling
- Opus codec integration
- NAT traversal logic
- Jitter buffer implementation

