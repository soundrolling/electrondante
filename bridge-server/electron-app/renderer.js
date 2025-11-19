// Renderer process - UI logic for multi-room audio system

// Global error handlers to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error lineno:', event.lineno);
  console.error('Error colno:', event.colno);
  if (event.error && event.error.stack) {
    console.error('Stack:', event.error.stack);
  }
  // Try to show in UI if possible
  if (typeof addLog !== 'undefined') {
    addLog(`Error: ${event.message}`, 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (event.reason && event.reason.stack) {
    console.error('Stack:', event.reason.stack);
  }
  if (typeof addLog !== 'undefined') {
    addLog(`Unhandled promise rejection: ${event.reason}`, 'error');
  }
});

let currentMode = 'listen'; // 'broadcast' or 'listen' - default to listen mode
let selectedDeviceId = null;
let currentRoom = null; // { roomId, roomCode, roomToken, roomName }
let isBroadcasting = false;
let isListening = false;
let audioContext = null;
let gainNode = null;
let analyserNode = null;
let isMuted = false;
let animationFrameId = null;
let audioBuffers = new Map(); // channel -> jitter buffer
let opusDecoders = new Map(); // channel -> OpusDecoder
let connectionQuality = 'unknown'; // 'excellent', 'good', 'fair', 'poor', 'unknown'
let latencyMs = 0;
let packetLossRate = 0;
let jitterMs = 0;
let nextStartTimes = new Map(); // channel -> next start time for scheduling
let driftCorrectionHistory = new Map(); // channel -> history of buffer sizes for drift correction

// DOM elements
let broadcastModeBtn, listenModeBtn; // Deprecated buttons
let broadcasterLoginToggleBtn, backToListenBtn; // New toggle buttons
let broadcastMode, listenMode;
let emailInput, passwordInput, loginBtn;
let roomPasswordInput, roomNameInput, createRoomBtn, endBroadcastBtn;
let roomCodeDisplay, listenerCountDisplay;
let railwayUrlInput, channelCountInput, bitrateSelect;
let startBroadcastBtn, stopBroadcastBtn, refreshDevicesBtn;
let deviceList, permissionSection, requestPermissionBtn;
let railwayUrlListenInput, roomCodeInput, roomPasswordInput, joinRoomBtn;
let listenRoomSection, listenRoomName, listenRoomStatus, volumeControl, volumeValue, leaveRoomBtn;
let muteBtn, copyInviteLinkBtn, audioVisualizerCanvas;
let openAdminBtn;
let broadcastRoomSection, broadcastAudioSection; // Broadcast mode sections
let statusBar, connectionIndicator, statusText, messagesDiv, logArea, toastContainer;

// Initialize app
function initializeApp() {
  try {
  if (!window.electronAPI) {
      setTimeout(initializeApp, 100);
    return;
  }

  const { electronAPI } = window;

  // Get DOM elements
  // broadcastModeBtn = document.getElementById('broadcastModeBtn'); // Removed
  // listenModeBtn = document.getElementById('listenModeBtn'); // Removed
  broadcasterLoginToggleBtn = document.getElementById('broadcasterLoginToggleBtn');
  backToListenBtn = document.getElementById('backToListenBtn');
  
  broadcastMode = document.getElementById('broadcastMode');
  listenMode = document.getElementById('listenMode');
  
  // Toast container
  toastContainer = document.getElementById('toast-container');
  
  // Broadcast mode elements
  emailInput = document.getElementById('email');
  passwordInput = document.getElementById('password');
  loginBtn = document.getElementById('loginBtn');
  roomPasswordInput = document.getElementById('roomPassword');
  roomNameInput = document.getElementById('roomName');
  createRoomBtn = document.getElementById('createRoomBtn');
  endBroadcastBtn = document.getElementById('endBroadcastBtn');
  roomCodeDisplay = document.getElementById('roomCode');
  listenerCountDisplay = document.getElementById('listenerCount');
  broadcastRoomSection = document.getElementById('broadcastRoomSection');
  broadcastAudioSection = document.getElementById('broadcastAudioSection');
  railwayUrlInput = document.getElementById('railwayUrl');
  channelCountInput = document.getElementById('channelCount');
  bitrateSelect = document.getElementById('bitrate');
  startBroadcastBtn = document.getElementById('startBroadcastBtn');
  stopBroadcastBtn = document.getElementById('stopBroadcastBtn');
  refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
  deviceList = document.getElementById('deviceList');
  permissionSection = document.getElementById('permissionSection');
  requestPermissionBtn = document.getElementById('requestPermissionBtn');
  
  // Listen mode elements
  railwayUrlListenInput = document.getElementById('railwayUrlListen');
  roomCodeInput = document.getElementById('roomCodeInput');
  const roomPasswordInputListen = document.getElementById('roomPasswordInput');
  joinRoomBtn = document.getElementById('joinRoomBtn');
  listenRoomSection = document.getElementById('listenRoomSection');
  listenRoomName = document.getElementById('listenRoomName');
  listenRoomStatus = document.getElementById('listenRoomStatus');
  refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
  publicRoomsList = document.getElementById('publicRoomsList');
  volumeControl = document.getElementById('volumeControl');
  volumeValue = document.getElementById('volumeValue');
  muteBtn = document.getElementById('muteBtn');
  copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
  audioVisualizerCanvas = document.getElementById('audioVisualizer');
  leaveRoomBtn = document.getElementById('leaveRoomBtn');
  
  // Common elements
  statusBar = document.getElementById('statusBar');
  connectionIndicator = document.getElementById('connectionIndicator');
  statusText = document.getElementById('statusText');
  messagesDiv = document.getElementById('messages');
  logArea = document.getElementById('logArea');
  openAdminBtn = document.getElementById('openAdminBtn');

  // Debug: Log if buttons are found
  console.log('Button check:', {
    broadcasterLoginToggleBtn: !!broadcasterLoginToggleBtn,
    loginBtn: !!loginBtn,
    openAdminBtn: !!openAdminBtn,
    backToListenBtn: !!backToListenBtn
  });

  // Attach event listeners
  if (broadcasterLoginToggleBtn) {
    broadcasterLoginToggleBtn.addEventListener('click', () => {
      console.log('Broadcaster login button clicked');
      switchMode('broadcast-login');
    });
  } else {
    console.error('broadcasterLoginToggleBtn not found!');
  }
  
  if (backToListenBtn) {
    backToListenBtn.addEventListener('click', () => {
      console.log('Back to listen button clicked');
      switchMode('listen');
    });
  } else {
    console.warn('backToListenBtn not found (may be hidden)');
  }
  
  // if (broadcastModeBtn) broadcastModeBtn.addEventListener('click', () => switchMode('broadcast'));
  // if (listenModeBtn) listenModeBtn.addEventListener('click', () => switchMode('listen'));
  
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      console.log('Login button clicked');
      handleLogin();
    });
  } else {
    console.error('loginBtn not found!');
  }
  if (createRoomBtn) createRoomBtn.addEventListener('click', handleCreateRoom);
  if (endBroadcastBtn) endBroadcastBtn.addEventListener('click', handleEndBroadcast);
  if (startBroadcastBtn) startBroadcastBtn.addEventListener('click', handleStartBroadcast);
  if (stopBroadcastBtn) stopBroadcastBtn.addEventListener('click', handleStopBroadcast);
  if (refreshDevicesBtn) refreshDevicesBtn.addEventListener('click', refreshDevices);
  if (requestPermissionBtn) requestPermissionBtn.addEventListener('click', requestMicrophonePermission);
  if (joinRoomBtn) joinRoomBtn.addEventListener('click', handleJoinRoom);
  if (refreshRoomsBtn) refreshRoomsBtn.addEventListener('click', handleRefreshRooms);
  
  // Load public rooms when switching to listen mode
  if (listenModeBtn) {
    listenModeBtn.addEventListener('click', () => {
      setTimeout(handleRefreshRooms, 100);
    });
  }
  if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', handleLeaveRoom);
  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', () => {
      console.log('Admin button clicked');
      openAdminPanel();
    });
  } else {
    console.error('openAdminBtn not found!');
  }
  // Volume control is handled below in the handleAudioData section
  
  // Room code input - auto uppercase
  if (roomCodeInput) {
    roomCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
    });
  }

  // Check microphone permission
  checkMicrophonePermission();

  // Electron API event listeners
  electronAPI.onStatus((status) => {
    updateStatus(status);
    addLog(status.message, status.type === 'error' ? 'error' : 'info');
  });

  electronAPI.onError((error) => {
    showMessage(error.message, 'error');
    addLog(error.message, 'error');
  });

  electronAPI.onDevicesUpdated((devices) => {
    renderDevices(devices);
  });
  
  electronAPI.onRoomStatus?.((status) => {
    handleRoomStatus(status);
  });
  
  electronAPI.onAudioData?.((data) => {
    // Audio data received (for listeners) - play using Web Audio API
    handleAudioData(data);
  });

  electronAPI.onConsoleLog?.((log) => {
    addLog(`[Main] ${log.message}`, log.level >= 2 ? 'error' : 'info');
  });

  // Load saved mode - default to listen mode
  const savedMode = localStorage.getItem('appMode') || 'listen';
  switchMode(savedMode);

  // Check auth status
  checkAuthStatus();

  addLog('Dante Audio Client ready', 'success');
  setTimeout(refreshDevices, 1000);
  } catch (error) {
    console.error('Error initializing app:', error);
    // Show error in UI if possible
    if (typeof alert !== 'undefined') {
      alert('Error initializing app: ' + error.message + '\n\nCheck console for details.');
    }
    // Try to log to console
    console.error('Stack:', error.stack);
  }
}

// Switch between broadcast and listen modes
function switchMode(mode) {
  console.log('switchMode called with:', mode);
  currentMode = mode;
  localStorage.setItem('appMode', mode);

  // Show/hide sections based on mode
  if (mode === 'broadcast-login' || mode === 'broadcast') {
    // Show broadcast mode (login section)
    if (broadcastMode) {
      broadcastMode.style.display = 'block';
      // Show login section, hide room/audio sections initially
      const loginSection = broadcastMode.querySelector('.section:first-of-type');
      if (loginSection) loginSection.style.display = 'block';
      if (broadcastRoomSection) broadcastRoomSection.style.display = 'none';
      if (broadcastAudioSection) broadcastAudioSection.style.display = 'none';
    }
    if (listenMode) listenMode.style.display = 'none';
    updateStatus({ message: 'Broadcast Mode - Please login to create a room', type: 'info' });
  } else if (mode === 'listen') {
    // Show listen mode
    if (broadcastMode) broadcastMode.style.display = 'none';
    if (listenMode) listenMode.style.display = 'block';
    updateStatus({ message: 'Listen Mode - Enter room code to join', type: 'info' });
    // Auto-load public rooms when switching to listen mode
    setTimeout(handleRefreshRooms, 500);
  }

  // Stop any active connections when switching
  if ((mode === 'broadcast-login' || mode === 'broadcast') && isListening) {
    handleLeaveRoom();
  } else if (mode === 'listen' && isBroadcasting) {
    handleStopBroadcast();
  }
}

// Check authentication status
async function checkAuthStatus() {
  if (!window.electronAPI) return;
  
  try {
    const status = await window.electronAPI.getAuthStatus();
    if (status.authenticated) {
      addLog(`Authenticated as ${status.user?.email || 'user'}`, 'success');
      // Only show room creation section if in broadcast mode
      if (currentMode === 'broadcast') {
        showBroadcastRoomSection();
      }
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

// Handle login
async function handleLogin() {
  if (!window.electronAPI) return;
  
  const email = emailInput?.value.trim();
  const password = passwordInput?.value;
  const railwayUrl = railwayUrlInput?.value.trim() || 'wss://proapp2149-production.up.railway.app';
  
  if (!email || !password) {
    showMessage('Please enter email and password', 'error');
    return;
  }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    addLog('Signing in...', 'info');
    
    const result = await window.electronAPI.login(email, password, railwayUrl);
    
    if (result.success) {
      showMessage('Login successful!', 'success');
      addLog(`Logged in as ${result.user.email}`, 'success');
      showBroadcastRoomSection();
    } else {
      showMessage(result.error || 'Login failed', 'error');
      addLog(`Login failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Login error: ${error.message}`, 'error');
    addLog(`Login error: ${error.message}`, 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  }
}

// Show broadcast room section after login
function showBroadcastRoomSection() {
  const roomSection = document.getElementById('broadcastRoomSection');
  if (roomSection) {
    roomSection.style.display = 'block';
  }
  const audioSection = document.getElementById('broadcastAudioSection');
  if (audioSection) {
    audioSection.style.display = 'block';
  }
}

// Handle room creation
async function handleCreateRoom() {
  if (!window.electronAPI) return;
  
  const password = roomPasswordInput?.value;
  const name = roomNameInput?.value.trim();
  
  if (!password || password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = 'Creating...';
    addLog('Creating room...', 'info');
    
    const result = await window.electronAPI.createRoom(password, name || null);
    
    if (result.success) {
      currentRoom = {
        roomId: result.roomId,
        roomCode: result.roomCode,
        roomToken: result.roomToken,
        roomName: result.name,
      };
      
      if (roomCodeDisplay) roomCodeDisplay.textContent = result.roomCode;
      if (listenerCountDisplay) listenerCountDisplay.textContent = '0';
      
      showMessage(`Room created: ${result.roomCode}`, 'success');
      addLog(`Room created: ${result.roomCode}`, 'success');
      
      if (endBroadcastBtn) endBroadcastBtn.style.display = 'inline-block';
      if (startBroadcastBtn) startBroadcastBtn.disabled = false;
    } else {
      showMessage(result.error || 'Failed to create room', 'error');
      addLog(`Room creation failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
  } finally {
    if (createRoomBtn) {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Create Room';
    }
  }
}

// Handle end broadcast
async function handleEndBroadcast() {
  if (!window.electronAPI) return;
  
  try {
    await handleStopBroadcast();
    await window.electronAPI.endBroadcast();
    currentRoom = null;
    if (roomCodeDisplay) roomCodeDisplay.textContent = '';
    if (endBroadcastBtn) endBroadcastBtn.style.display = 'none';
    showMessage('Broadcast ended', 'success');
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
}

// Handle start broadcast
async function handleStartBroadcast() {
  if (!currentRoom) {
    showMessage('Please create a room first', 'error');
    return;
  }
  
  const railwayUrl = railwayUrlInput?.value.trim() || 'wss://proapp2149-production.up.railway.app';
  const channelCount = parseInt(channelCountInput?.value) || 32;
  const bitrate = parseInt(bitrateSelect?.value) || 64000;
  
  // Check microphone permission
  if (window.electronAPI && window.electronAPI.checkMicrophonePermission) {
    try {
      const permResult = await window.electronAPI.checkMicrophonePermission();
      if (!permResult.granted) {
        const shouldRequest = confirm('Microphone permission is required. Request it now?');
        if (shouldRequest) {
          await requestMicrophonePermission();
          const recheck = await window.electronAPI.checkMicrophonePermission();
          if (!recheck.granted) {
            showMessage('Microphone permission is required', 'error');
            return;
          }
        } else {
          return;
        }
      }
    } catch (error) {
      // Ignore
    }
  }
  
  try {
    startBroadcastBtn.disabled = true;
    addLog('Starting broadcast...', 'info');
    
    const result = await window.electronAPI.startBroadcast({
      railwayWsUrl: railwayUrl,
      roomId: currentRoom.roomId,
      roomToken: currentRoom.roomToken,
      channels: channelCount,
      bitrate: bitrate,
      deviceId: selectedDeviceId || -1,
    });
    
    if (result.success) {
      isBroadcasting = true;
      startBroadcastBtn.disabled = true;
      stopBroadcastBtn.disabled = false;
      showMessage('Broadcasting started', 'success');
    } else {
      showMessage(`Failed to start: ${result.error}`, 'error');
      startBroadcastBtn.disabled = false;
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    startBroadcastBtn.disabled = false;
  }
}

// Handle stop broadcast
async function handleStopBroadcast() {
  if (!window.electronAPI) return;
  
  try {
    stopBroadcastBtn.disabled = true;
    addLog('Stopping broadcast...', 'info');
    
    const result = await window.electronAPI.stopBroadcast();
    
    if (result.success) {
      isBroadcasting = false;
      startBroadcastBtn.disabled = false;
      stopBroadcastBtn.disabled = true;
      showMessage('Broadcast stopped', 'success');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    stopBroadcastBtn.disabled = false;
  }
}

// Handle join room
async function handleJoinRoom() {
  if (!window.electronAPI) return;
  
  const roomCode = roomCodeInput?.value.trim().toUpperCase();
  const password = document.getElementById('roomPasswordInput')?.value;
  const railwayUrl = railwayUrlListenInput?.value.trim() || 'wss://proapp2149-production.up.railway.app';
  
  if (!roomCode || roomCode.length !== 6) {
    showMessage('Please enter a valid 6-character room code', 'error');
    return;
  }
  
  if (!password) {
    showMessage('Please enter room password', 'error');
    return;
  }
  
  try {
    joinRoomBtn.disabled = true;
    joinRoomBtn.textContent = 'Joining...';
    addLog(`Joining room ${roomCode}...`, 'info');
    
    const result = await window.electronAPI.joinRoom(roomCode, password, railwayUrl);
    
    if (result.success) {
      currentRoom = {
        roomId: result.roomId,
        roomCode: roomCode,
        roomToken: result.roomToken,
        roomName: result.roomName,
      };
      
      if (listenRoomName) listenRoomName.textContent = result.roomName;
      if (listenRoomStatus) listenRoomStatus.textContent = 'Connected';
      
      // Start listening
      const listenResult = await window.electronAPI.startListening({
        railwayWsUrl: railwayUrl,
        roomId: result.roomId,
        roomToken: result.roomToken,
        sampleRate: 48000,
        channels: 1,
        volume: parseInt(volumeControl?.value || 100) / 100,
      });
      
      if (listenResult.success) {
        isListening = true;
        if (listenRoomSection) listenRoomSection.style.display = 'block';
        
        // Initialize audio playback
        await initAudioPlayback();
        
        showMessage(`Joined room: ${result.roomName}`, 'success');
        addLog(`Joined room: ${result.roomName}`, 'success');
      } else {
        showMessage(`Failed to start listening: ${listenResult.error}`, 'error');
      }
    } else {
      showMessage(result.error || 'Failed to join room', 'error');
      addLog(`Join failed: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
  } finally {
    if (joinRoomBtn) {
      joinRoomBtn.disabled = false;
      joinRoomBtn.textContent = 'Join Room';
    }
  }
}

// Open admin panel (Electron only)
async function openAdminPanel() {
  if (!window.electronAPI || !window.electronAPI.openAdminPanel) {
    showMessage('Admin panel is only available in the Electron app', 'error');
    return;
  }
  
  try {
    const result = await window.electronAPI.openAdminPanel();
    if (result.success) {
      showMessage('Admin panel opened', 'success');
    } else {
      showMessage(`Failed to open admin panel: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    addLog(`Admin panel error: ${error.message}`, 'error');
  }
}

// Handle refresh public rooms
async function handleRefreshRooms() {
  if (!window.electronAPI) return;
  
  const railwayUrl = railwayUrlListenInput?.value || 'wss://proapp2149-production.up.railway.app';
  const baseUrl = railwayUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  
  try {
    if (refreshRoomsBtn) refreshRoomsBtn.disabled = true;
    if (publicRoomsList) {
      publicRoomsList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Loading rooms...</div>';
    }
    
    const response = await fetch(`${baseUrl}/api/rooms/public`);
    const data = await response.json();
    
    if (data.success && data.rooms) {
      renderPublicRooms(data.rooms);
    } else {
      if (publicRoomsList) {
        publicRoomsList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No public rooms available</div>';
      }
    }
  } catch (error) {
    console.error('Error fetching public rooms:', error);
    if (publicRoomsList) {
      publicRoomsList.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Error loading rooms</div>';
    }
  } finally {
    if (refreshRoomsBtn) refreshRoomsBtn.disabled = false;
  }
}

// Render public rooms list
function renderPublicRooms(rooms) {
  if (!publicRoomsList) return;
  
  if (!rooms || rooms.length === 0) {
    publicRoomsList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No public rooms available</div>';
    return;
  }
  
  publicRoomsList.innerHTML = rooms.map(room => {
    const listenerCount = room.listenerCount || 0;
    const hasBroadcaster = room.hasBroadcaster || false;
    const status = hasBroadcaster ? '🔴 Live' : '⏸️ Waiting';
    
    return `
      <div class="device-item" style="cursor: pointer;" data-room-code="${room.code}">
        <div class="device-name">${room.name || `Room ${room.code}`}</div>
        <div class="device-info">${status} • ${listenerCount} listener${listenerCount !== 1 ? 's' : ''} • Code: ${room.code}</div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  publicRoomsList.querySelectorAll('.device-item').forEach(item => {
    item.addEventListener('click', () => {
      const roomCode = item.dataset.roomCode;
      if (roomCodeInput) {
        roomCodeInput.value = roomCode;
      }
      // Focus password input for user to enter password
      const roomPasswordInputListen = document.getElementById('roomPasswordInput');
      if (roomPasswordInputListen) {
        roomPasswordInputListen.focus();
      }
    });
  });
}

// Handle leave room
async function handleLeaveRoom() {
  if (!window.electronAPI) return;
  
  try {
    leaveRoomBtn.disabled = true;
    addLog('Leaving room...', 'info');
    
    await window.electronAPI.stopListening();
    await window.electronAPI.leaveRoom();
    
    isListening = false;
    currentRoom = null;
    
    // Clean up audio context
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
      gainNode = null;
      analyserNode = null;
    }
    
    // Reset scheduling
    nextStartTimes.clear();
    driftCorrectionHistory.clear();
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    if (listenRoomSection) listenRoomSection.style.display = 'none';
    if (roomCodeInput) roomCodeInput.value = '';
    const roomPasswordInputListen = document.getElementById('roomPasswordInput');
    if (roomPasswordInputListen) roomPasswordInputListen.value = '';
    
    showMessage('Left room', 'success');
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    if (leaveRoomBtn) leaveRoomBtn.disabled = false;
  }
}

// Handle room status updates
function handleRoomStatus(status) {
  if (status.roomId === currentRoom?.roomId) {
    if (listenerCountDisplay && status.listenerCount !== undefined) {
      listenerCountDisplay.textContent = status.listenerCount;
    }
    if (listenRoomStatus) {
      if (status.hasBroadcaster) {
        listenRoomStatus.textContent = 'Broadcasting';
      } else if (status.state === 'suspended') {
        listenRoomStatus.textContent = 'Suspended';
      } else {
        listenRoomStatus.textContent = 'Waiting for broadcaster';
      }
    }
  }
}

// Refresh devices
async function refreshDevices() {
  if (!window.electronAPI) return;
  
  try {
    addLog('Enumerating audio devices...', 'info');
    
    if (window.electronAPI.checkMicrophonePermission) {
      const permStatus = await window.electronAPI.checkMicrophonePermission();
      if (!permStatus.granted) {
        showMessage('Microphone permission required', 'error');
        if (permissionSection) permissionSection.style.display = 'block';
        return;
      }
    }
    
    const devices = await window.electronAPI.getDevices();
    addLog(`Found ${devices.length} audio input device(s)`, devices.length > 0 ? 'success' : 'info');
    renderDevices(devices);
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
  }
}

// Render devices
function renderDevices(devices) {
  if (!deviceList) return;
  
  if (!devices || devices.length === 0) {
    deviceList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No audio devices found</div>';
    return;
  }
  
  deviceList.innerHTML = devices.map(device => {
    const isSelected = device.id === selectedDeviceId || (selectedDeviceId === null && device.isDefault);
    return `
      <div class="device-item ${isSelected ? 'selected' : ''}" data-device-id="${device.id}">
        <div class="device-name">${device.name}</div>
        <div class="device-info">${device.maxInputChannels} channels, ${device.defaultSampleRate}Hz ${device.isDefault ? '(Default)' : ''}</div>
      </div>
    `;
  }).join('');
  
  deviceList.querySelectorAll('.device-item').forEach(item => {
    item.addEventListener('click', async () => {
      const deviceId = parseInt(item.dataset.deviceId);
      selectedDeviceId = deviceId;
      
      deviceList.querySelectorAll('.device-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      
      if (isBroadcasting && window.electronAPI) {
        try {
          const result = await window.electronAPI.setDevice(deviceId);
          if (result.success) {
            showMessage(`Device changed to: ${item.querySelector('.device-name').textContent}`, 'success');
          }
        } catch (error) {
          showMessage(`Error: ${error.message}`, 'error');
        }
      }
    });
  });
}

// Check microphone permission
async function checkMicrophonePermission() {
  if (!window.electronAPI?.checkMicrophonePermission) return;
  
  try {
    const result = await window.electronAPI.checkMicrophonePermission();
    if (!result.granted && permissionSection) {
      permissionSection.style.display = 'block';
    } else if (result.granted && permissionSection) {
      permissionSection.style.display = 'none';
    }
  } catch (error) {
    // Ignore
  }
}

// Request microphone permission
async function requestMicrophonePermission() {
  if (!window.electronAPI?.requestMicrophonePermission) return;
  
  try {
    if (requestPermissionBtn) {
      requestPermissionBtn.disabled = true;
      requestPermissionBtn.textContent = 'Requesting...';
    }
    
    addLog('Requesting microphone permission...', 'info');
    const result = await window.electronAPI.requestMicrophonePermission();
    
    if (result.granted) {
      showMessage('Microphone permission granted!', 'success');
      if (permissionSection) permissionSection.style.display = 'none';
      setTimeout(refreshDevices, 1000);
    } else {
      showMessage('Microphone permission denied', 'error');
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
  } finally {
    if (requestPermissionBtn) {
      requestPermissionBtn.disabled = false;
      requestPermissionBtn.textContent = 'Request Microphone Permission';
    }
  }
}

// Update status
function updateStatus(status) {
  if (!statusText) return;
  
  statusText.textContent = status.message || 'Unknown';
  
  if (connectionIndicator) {
  connectionIndicator.classList.remove('connected', 'registered');
  if (status.type === 'connected' || status.type === 'registered' || status.type === 'audio-started') {
    connectionIndicator.classList.add('connected');
    if (status.type === 'registered' || status.type === 'audio-started') {
      connectionIndicator.classList.add('registered');
    }
  }
}
}

// Show toast message
function showMessage(message, type = 'info') {
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3000);
}

// Add log
function addLog(message, type = 'info') {
  if (!logArea) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.appendChild(logEntry);
  logArea.scrollTop = logArea.scrollHeight;
  
  while (logArea.children.length > 100) {
    logArea.removeChild(logArea.firstChild);
  }
}

// Initialize audio context for playback
async function initAudioPlayback() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error('Web Audio API not available');
    }
    
    audioContext = new AudioContext({ sampleRate: 48000 });
    
    // Create analyser
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    
    gainNode = audioContext.createGain();
    gainNode.gain.value = isMuted ? 0 : (parseInt(volumeControl?.value || 100) / 100);
    
    // Connect graph: Source -> Gain -> Analyser -> Destination
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    
    // Resume if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Start visualizer loop
    drawVisualizer();
    
    return true;
  } catch (error) {
    console.error('Error initializing audio playback:', error);
    return false;
  }
}

// Draw audio visualizer
function drawVisualizer() {
  if (!audioVisualizerCanvas) return;
  
  const canvasCtx = audioVisualizerCanvas.getContext('2d');
  const width = audioVisualizerCanvas.width;
  const height = audioVisualizerCanvas.height;
  
  // Schedule next frame
  animationFrameId = requestAnimationFrame(drawVisualizer);
  
  canvasCtx.fillStyle = '#000';
  canvasCtx.fillRect(0, 0, width, height);
  
  if (!analyserNode || !isListening) {
    // Draw idle state (flat line)
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, height / 2);
    canvasCtx.lineTo(width, height / 2);
    canvasCtx.strokeStyle = '#333';
    canvasCtx.stroke();
    return;
  }
  
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteTimeDomainData(dataArray);
  
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#3b82f6';
  canvasCtx.beginPath();
  
  const sliceWidth = width * 1.0 / bufferLength;
  let x = 0;
  
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * height / 2;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  canvasCtx.lineTo(audioVisualizerCanvas.width, audioVisualizerCanvas.height / 2);
  canvasCtx.stroke();
}

// Initialize Opus decoder for a channel (Deprecated - decoding moved to Main process)
/*
function getOpusDecoder(channel) {
  if (!opusDecoders.has(channel)) {
    try {
      // Cannot use require in renderer
      return null;
    } catch (error) {
      return null;
    }
  }
  return opusDecoders.get(channel);
}
*/

// Handle audio data for playback with jitter buffering
async function handleAudioData(audioData) {
  if (!isListening) return;
  
  // Initialize audio context if needed
  if (!audioContext) {
    const initialized = await initAudioPlayback();
    if (!initialized) return;
  }
  
  try {
    const { channel, data, encoding, timestamp, sequence } = audioData;
    
    // Initialize jitter buffer for this channel if needed
    if (!audioBuffers.has(channel)) {
      // JitterBuffer is loaded globally via script tag in index.html
      if (typeof JitterBuffer !== 'undefined') {
        audioBuffers.set(channel, new JitterBuffer({
          minSize: 5,
          targetSize: 20,
          maxSize: 100,
          maxLatency: 500,
          adaptive: true,
        }));
      } else {
        console.error('JitterBuffer class not found');
        return;
      }
    }
    
    const jitterBuffer = audioBuffers.get(channel);
    
    // Add packet to jitter buffer
    jitterBuffer.addPacket({
      data,
      encoding: encoding || 'pcm',
      timestamp,
      sequence,
    });
    
    // Update connection quality metrics
    updateConnectionQuality(jitterBuffer, timestamp);
    
    // Try to get next packet for playback
    if (jitterBuffer.hasEnoughData()) {
      // Schedule as many packets as we can to build up a small hardware buffer
      // This ensures we stay ahead of the audio clock
      while (jitterBuffer.buffer.length > jitterBuffer.minSize) {
        const packet = jitterBuffer.getNextPacket();
        if (packet) {
          await playAudioPacket(packet, channel, jitterBuffer);
        } else {
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error handling audio data:', error);
  }
}

// Play a single audio packet
async function playAudioPacket(packet, channel, jitterBuffer) {
  if (!audioContext || !gainNode) return;
  
  try {
    let samples;
    
    // Note: Opus decoding is now handled in main process or assumed to be PCM if passed here
    
    // PCM data - convert to Float32Array
    if (Array.isArray(packet.data)) {
      samples = new Float32Array(packet.data);
    } else if (packet.data instanceof Float32Array) {
      samples = packet.data;
    } else if (packet.data instanceof Uint8Array) {
      // Assuming pre-decoded float data sent as bytes or similar
      samples = new Float32Array(packet.data.buffer); 
    } else if (packet.data && packet.data.type === 'Buffer') {
       // Buffer object from IPC
       samples = new Float32Array(new Uint8Array(packet.data.data).buffer);
    } else {
      // console.warn('Unknown data format', packet);
      return;
    }
    
    // Create audio buffer
    const frameCount = samples.length;
    if (frameCount === 0) return;
    
    const buffer = audioContext.createBuffer(1, frameCount, 48000); // Mono, 48kHz
    const channelData = buffer.getChannelData(0);
    channelData.set(samples);
    
    // Create source
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    
    // Drift correction: Adjust playback rate based on buffer size
    // If buffer is growing (sender fast), speed up. If shrinking (sender slow), slow down.
    if (jitterBuffer) {
      const status = jitterBuffer.getStatus();
      const targetSize = status.targetSize;
      const currentSize = status.size;
      
      // Simple P-controller for drift
      // 1.0 is normal speed. Range: 0.95 to 1.05
      let playbackRate = 1.0;
      
      if (currentSize > targetSize + 5) {
        playbackRate = 1.002; // Slightly faster to drain buffer
      } else if (currentSize < targetSize - 5) {
        playbackRate = 0.998; // Slightly slower to build buffer
      }
      
      // Apply larger correction if way off
      if (currentSize > targetSize * 2) playbackRate = 1.01;
      if (currentSize < targetSize * 0.5) playbackRate = 0.99;
      
      source.playbackRate.value = playbackRate;
    }

    // Precise Scheduling
    const now = audioContext.currentTime;
    let nextStartTime = nextStartTimes.get(channel) || 0;
    
    // If we've fallen behind (underrun), reset scheduling to now + small latency
    // 0.02s (20ms) allows a tiny bit of time for processing before playing
    if (nextStartTime < now) {
      nextStartTime = now + 0.02;
    }
    
    source.start(nextStartTime);
    
    // Advance next start time by duration (adjusted for playback rate)
    // duration = length / sampleRate / playbackRate
    const duration = buffer.duration / source.playbackRate.value;
    nextStartTime += duration;
    nextStartTimes.set(channel, nextStartTime);
    
    } catch (error) {
    console.error('Error playing audio packet:', error);
  }
}

// Update connection quality metrics
let lastPacketTime = null;
let sequenceHistory = [];
let latencyHistory = [];

function updateConnectionQuality(jitterBuffer, timestamp) {
  if (!jitterBuffer) return;
  
  const bufferStatus = jitterBuffer.getStatus();
  latencyMs = bufferStatus.averageLatency || 0;
  jitterMs = bufferStatus.averageJitter || 0;
  packetLossRate = bufferStatus.packetLossRate || 0;
  
  // Determine quality level based on buffer metrics
  if (latencyMs < 100 && jitterMs < 20 && packetLossRate < 0.01) {
    connectionQuality = 'excellent';
  } else if (latencyMs < 200 && jitterMs < 50 && packetLossRate < 0.05) {
    connectionQuality = 'good';
  } else if (latencyMs < 400 && jitterMs < 100 && packetLossRate < 0.10) {
    connectionQuality = 'fair';
  } else {
    connectionQuality = 'poor';
  }
  
  // Update UI
  updateConnectionQualityIndicator();
}

// Update connection quality indicator in UI
function updateConnectionQualityIndicator() {
  const qualityIndicator = document.getElementById('qualityIndicator');
  const qualityText = document.getElementById('qualityText');
  const qualityStats = document.getElementById('qualityStats');
  const connectionQualityDiv = document.getElementById('connectionQuality');
  
  if (!qualityIndicator || !qualityText || !connectionQualityDiv) return;
  
  // Show quality indicator when listening
  if (isListening) {
    connectionQualityDiv.style.display = 'flex';
    connectionQualityDiv.style.alignItems = 'center';
    
    // Set color based on quality
    const colors = {
      excellent: '#10b981',
      good: '#3b82f6',
      fair: '#f59e0b',
      poor: '#ef4444',
      unknown: '#888',
    };
    
    const labels = {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      unknown: 'Unknown',
    };
    
    qualityIndicator.style.background = colors[connectionQuality] || colors.unknown;
    qualityText.textContent = labels[connectionQuality] || labels.unknown;
    
    // Show stats
    if (qualityStats) {
      const stats = [];
      if (latencyMs > 0) stats.push(`${Math.round(latencyMs)}ms`);
      if (jitterMs > 0) stats.push(`J:${Math.round(jitterMs)}ms`);
      if (packetLossRate > 0) stats.push(`L:${(packetLossRate * 100).toFixed(1)}%`);
      qualityStats.textContent = stats.length > 0 ? `(${stats.join(', ')})` : '';
    }
  } else {
    connectionQualityDiv.style.display = 'none';
  }
}

// Volume control handler (moved to initialization section)

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
