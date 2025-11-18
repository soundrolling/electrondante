# Testing Guide - Dante Audio Client v1.1.0

## Pre-Testing Setup

### 1. Server Setup (Railway)
```bash
# Ensure Railway server is deployed with latest code
# Environment variables required:
- JWT_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- PORT (auto-set by Railway)
```

### 2. Database Setup (Supabase)
```bash
# Run the migration script in Supabase SQL editor
# See: supabase-migration.sql

# Verify tables exist:
- audio_rooms
- room_participants
- room_analytics
- audit_log
```

### 3. Desktop App Build
```bash
cd electron-app
npm install
npm run build:mac  # or build:win / build:linux
```

---

## Test Scenarios

### Scenario 1: Broadcaster Flow
**Objective**: Test complete broadcaster journey

1. **Launch App**
   - [ ] App opens successfully
   - [ ] Defaults to "Listen Mode"
   - [ ] No errors in logs

2. **Switch to Broadcast Mode**
   - [ ] Click "Broadcast Mode" button
   - [ ] Button turns blue (active)
   - [ ] Login section appears
   - [ ] Status shows: "Broadcast Mode - Please login to create a room"

3. **Login as Broadcaster**
   - [ ] Enter valid email and password
   - [ ] Click "Sign In"
   - [ ] Success message appears
   - [ ] Room creation section appears
   - [ ] Audio device list loads

4. **Create Room**
   - [ ] Enter room password (min 6 chars)
   - [ ] Enter room name (optional)
   - [ ] Click "Create Room"
   - [ ] Room code displays (6 chars, e.g., "ABC123")
   - [ ] Listener count shows "0"

5. **Select Audio Device**
   - [ ] Device list shows available inputs
   - [ ] Select Dante Virtual Soundcard (or test device)
   - [ ] Device highlights when selected

6. **Start Broadcasting**
   - [ ] Click "Start Broadcasting"
   - [ ] Button becomes disabled
   - [ ] "Stop Broadcasting" button enables
   - [ ] Status shows "Broadcasting"
   - [ ] Logs show audio packets being sent

7. **Monitor Broadcast**
   - [ ] Listener count updates when someone joins
   - [ ] No audio dropouts or errors
   - [ ] Connection stays stable for 5+ minutes

8. **Stop Broadcasting**
   - [ ] Click "Stop Broadcasting"
   - [ ] Button states reverse
   - [ ] Status updates

**Expected Results**: 
- No errors
- Smooth audio transmission
- Listener count accurate

---

### Scenario 2: Listener Flow
**Objective**: Test anonymous listener joining

1. **Launch Second Instance**
   - [ ] Open second instance of app
   - [ ] Defaults to "Listen Mode"
   - [ ] Room browser auto-loads

2. **Browse Public Rooms**
   - [ ] Click "Refresh Rooms"
   - [ ] List shows active rooms
   - [ ] Shows: Room name, code, listener count, status (Live/Waiting)

3. **Join Room via Browser**
   - [ ] Click a room in the list
   - [ ] Room code auto-fills
   - [ ] Enter room password
   - [ ] Click "Join Room"

4. **Join Room via Code**
   - [ ] Enter room code manually (6 chars)
   - [ ] Enter password
   - [ ] Click "Join Room"
   - [ ] Success: Room info appears
   - [ ] Fail (wrong password): Error message appears

5. **Audio Playback**
   - [ ] Audio starts playing automatically
   - [ ] Visualizer shows waveform
   - [ ] No crackling or dropouts
   - [ ] Smooth playback for 5+ minutes

6. **Connection Quality**
   - [ ] Quality indicator visible
   - [ ] Shows color: Green (Excellent) / Blue (Good) / Yellow (Fair) / Red (Poor)
   - [ ] Stats show: Latency, Jitter, Packet Loss

7. **Volume Controls**
   - [ ] Volume slider adjusts audio
   - [ ] Percentage displays correctly
   - [ ] Mute button (🔊) toggles to (🔇)
   - [ ] Muted state: volume shows "Muted"

8. **Leave Room**
   - [ ] Click "Leave Room"
   - [ ] Audio stops
   - [ ] Returns to room join screen
   - [ ] No hanging connections

**Expected Results**:
- Smooth audio with no gaps
- Connection quality updates in real-time
- All controls work correctly

---

### Scenario 3: Multi-Room Test
**Objective**: Verify room isolation

1. **Create Room A (Instance 1)**
   - [ ] Login as User A
   - [ ] Create room "Stage 1" with password "test123"
   - [ ] Note room code (e.g., "ABC123")
   - [ ] Start broadcasting with Source A

2. **Create Room B (Instance 2)**
   - [ ] Login as User B (different account)
   - [ ] Create room "Stage 2" with password "test456"
   - [ ] Note room code (e.g., "XYZ789")
   - [ ] Start broadcasting with Source B

3. **Join Room A (Instance 3)**
   - [ ] Enter Room A code + password
   - [ ] Join room
   - [ ] Verify hearing Source A only

4. **Join Room B (Instance 4)**
   - [ ] Enter Room B code + password
   - [ ] Join room
   - [ ] Verify hearing Source B only

5. **Verify Isolation**
   - [ ] Listener A hears only Source A
   - [ ] Listener B hears only Source B
   - [ ] No audio bleeding between rooms
   - [ ] Room browser shows both rooms

**Expected Results**:
- Complete audio isolation between rooms
- No cross-contamination
- Both rooms stable simultaneously

---

### Scenario 4: Network Resilience
**Objective**: Test reconnection and buffering

1. **Setup**
   - [ ] Broadcaster streaming
   - [ ] Listener connected and playing

2. **Simulate Network Issues**
   - [ ] Throttle network to 1 Mbps (use Network Link Conditioner or similar)
   - [ ] Audio continues playing
   - [ ] Connection quality indicator changes to "Fair" or "Poor"
   - [ ] Buffer size increases (adaptive)

3. **Brief Disconnect**
   - [ ] Disable network for 2 seconds
   - [ ] Re-enable network
   - [ ] Listener reconnects automatically
   - [ ] Audio resumes with minimal gap
   - [ ] Logs show reconnection attempts

4. **Broadcaster Disconnect**
   - [ ] Kill broadcaster process
   - [ ] Listener sees "Suspended" status
   - [ ] Wait 30 seconds
   - [ ] Restart broadcaster with same room
   - [ ] Broadcaster reconnects to room
   - [ ] Listener resumes playback

5. **Long-term Stability**
   - [ ] Stream for 30+ minutes
   - [ ] No memory leaks (check Activity Monitor/Task Manager)
   - [ ] Audio stays smooth
   - [ ] No gradual quality degradation

**Expected Results**:
- Automatic reconnection on brief disconnects
- Graceful degradation under poor network
- No permanent audio desync

---

### Scenario 5: Security & Edge Cases
**Objective**: Verify security and error handling

1. **Authentication**
   - [ ] Invalid login credentials rejected
   - [ ] Token refresh works after 15+ minutes
   - [ ] Logout clears session
   - [ ] Cannot create room without login

2. **Room Access**
   - [ ] Cannot join with wrong password
   - [ ] Cannot join non-existent room code
   - [ ] Room code is case-insensitive
   - [ ] Room code only accepts A-Z, 0-9

3. **Rate Limiting**
   - [ ] Multiple rapid login attempts blocked
   - [ ] Multiple rapid room create attempts blocked
   - [ ] Error message: "Too many requests"

4. **Edge Cases**
   - [ ] Room with 10+ simultaneous listeners
   - [ ] Broadcaster drops while 5+ listeners connected
   - [ ] Multiple rapid mode switches
   - [ ] Empty room name (uses default)
   - [ ] Very long room name (truncated or handled)

5. **Browser Compatibility**
   - [ ] Audio plays in different browsers (for future web client)
   - [ ] Visualizer renders correctly
   - [ ] No console errors

**Expected Results**:
- All security measures working
- Graceful error handling
- No crashes or hangs

---

## Performance Benchmarks

### Audio Quality Metrics
- **Latency**: < 500ms end-to-end
- **Jitter**: < 50ms average
- **Packet Loss**: < 1%
- **Buffer Size**: 5-20 packets (adaptive)

### Resource Usage
- **Broadcaster CPU**: < 15%
- **Listener CPU**: < 10%
- **Memory**: < 200 MB per instance
- **Network (64kbps Opus)**: ~8 KB/s per listener

### Server Metrics (Railway)
- **CPU**: < 50% with 10 concurrent rooms
- **Memory**: < 512 MB
- **Network**: Scales with listener count
- **Response Time**: < 100ms for API calls

---

## Troubleshooting Common Issues

### Audio Not Playing
1. Check device selection (correct input/output)
2. Check volume not muted
3. Check audio permissions granted
4. Check network connectivity
5. Check server logs for errors

### Connection Fails
1. Verify Railway server is running
2. Check WebSocket URL correct
3. Check firewall not blocking
4. Check credentials valid
5. Check room code correct

### Poor Audio Quality
1. Check network quality indicator
2. Reduce bitrate (32kbps vs 128kbps)
3. Check CPU usage not maxed
4. Check other apps not using network heavily
5. Try wired connection vs WiFi

### Room Not Found
1. Verify room code correct (6 chars)
2. Check room still active (broadcaster connected)
3. Check room not expired (5min grace period)
4. Refresh room browser

---

## Automated Testing (Future)

### Unit Tests
```bash
# Run unit tests
npm test

# Tests cover:
- Token generation/validation
- Password hashing
- Room code generation
- Jitter buffer logic
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Tests cover:
- Auth flow end-to-end
- Room creation and joining
- WebSocket message routing
- Audio packet relay
```

### Load Tests
```bash
# Simulate 100 listeners
npm run test:load

# Metrics:
- Concurrent connections
- Audio packet loss rate
- Server response times
- Memory usage over time
```

---

## Test Report Template

```markdown
# Test Report - v1.1.0

**Tester**: [Name]
**Date**: [Date]
**Platform**: [macOS/Windows/Linux]
**Server**: [Railway URL]

## Results Summary
- Tests Passed: X/Y
- Critical Issues: X
- Minor Issues: X
- Performance: [Pass/Fail]

## Detailed Results
| Scenario | Status | Notes |
|----------|--------|-------|
| Broadcaster Flow | ✅ | |
| Listener Flow | ✅ | |
| Multi-Room | ⚠️ | Minor audio glitch at start |
| Network Resilience | ✅ | |
| Security | ✅ | |

## Issues Found
1. [Issue description]
   - Severity: [Critical/Major/Minor]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]

## Recommendations
- [Any suggestions for improvement]
```

---

## Checklist Before Release

- [ ] All test scenarios pass
- [ ] No critical bugs
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Database migration tested
- [ ] Environment variables documented
- [ ] Release notes written
- [ ] Build artifacts generated (Mac/Win/Linux)
- [ ] GitHub release created
- [ ] Railway deployment updated

---

## Contact

Issues? Report at: https://github.com/soundrolling/electrondante/issues

