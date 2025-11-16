// Renderer process - UI logic
if (!window.electronAPI) {
  console.error('electronAPI not available - preload script may not have loaded');
}
const { electronAPI } = window;

let clientRunning = false;
let selectedDeviceId = null;

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const requestPermissionBtn = document.getElementById('requestPermissionBtn');
const railwayUrlInput = document.getElementById('railwayUrl');
const accessTokenInput = document.getElementById('accessToken');
const channelCountInput = document.getElementById('channelCount');
const deviceList = document.getElementById('deviceList');
const statusBar = document.getElementById('statusBar');
const connectionIndicator = document.getElementById('connectionIndicator');
const statusText = document.getElementById('statusText');
const messagesDiv = document.getElementById('messages');
const logArea = document.getElementById('logArea');

// Event listeners
startBtn.addEventListener('click', startClient);
stopBtn.addEventListener('click', stopClient);
refreshDevicesBtn.addEventListener('click', refreshDevices);
requestPermissionBtn.addEventListener('click', requestMicrophonePermission);

// Electron API event listeners
electronAPI.onStatus((status) => {
  updateStatus(status);
  addLog(status.message, status.type === 'error' ? 'error' : 'success');
});

electronAPI.onError((error) => {
  showMessage(error.message, 'error');
  addLog(error.message, 'error');
});

electronAPI.onDevicesUpdated((devices) => {
  renderDevices(devices);
});

// Functions
async function startClient() {
  const railwayUrl = railwayUrlInput.value.trim();
  const accessToken = accessTokenInput.value.trim();
  const channelCount = parseInt(channelCountInput.value) || 32;
  
  if (!railwayUrl) {
    showMessage('Please enter Railway WebSocket URL', 'error');
    return;
  }
  
  if (!accessToken) {
    showMessage('Please enter Supabase API Key', 'error');
    return;
  }
  
  try {
    startBtn.disabled = true;
    addLog('Starting client...', 'info');
    
    const result = await electronAPI.startClient({
      railwayWsUrl: railwayUrl,
      accessToken: accessToken,
      channels: channelCount,
      deviceId: selectedDeviceId || -1,
    });
    
    if (result.success) {
      clientRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      refreshDevicesBtn.disabled = false;
      showMessage('Client started successfully', 'success');
      
      // Refresh devices after a short delay
      setTimeout(refreshDevices, 1000);
    } else {
      showMessage(`Failed to start: ${result.error}`, 'error');
      startBtn.disabled = false;
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    startBtn.disabled = false;
  }
}

async function stopClient() {
  try {
    stopBtn.disabled = true;
    addLog('Stopping client...', 'info');
    
    const result = await electronAPI.stopClient();
    
    if (result.success) {
      clientRunning = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      refreshDevicesBtn.disabled = true;
      showMessage('Client stopped', 'success');
      updateStatus({ type: 'stopped', message: 'Not Connected' });
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    stopBtn.disabled = false;
  }
}

async function refreshDevices() {
  try {
    if (!electronAPI) {
      showMessage('Electron API not available', 'error');
      return;
    }
    
    addLog('Requesting microphone permission and enumerating devices...', 'info');
    const devices = await electronAPI.getDevices();
    addLog(`Found ${devices.length} audio device(s)`, devices.length > 0 ? 'success' : 'error');
    renderDevices(devices);
    
    const status = await electronAPI.getStatus();
    if (status.deviceId !== null) {
      selectedDeviceId = status.deviceId;
    }
    
    if (devices.length === 0) {
      showMessage('No audio devices found. On macOS, make sure you granted microphone permission when prompted. Check System Settings → Privacy & Security → Microphone.', 'error');
      addLog('No devices found - check microphone permission in System Settings', 'error');
    }
  } catch (error) {
    showMessage(`Error refreshing devices: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
    console.error('Device enumeration error:', error);
  }
}

function renderDevices(devices) {
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
  
  // Add click handlers
  deviceList.querySelectorAll('.device-item').forEach(item => {
    item.addEventListener('click', async () => {
      const deviceId = parseInt(item.dataset.deviceId);
      selectedDeviceId = deviceId;
      
      // Update UI
      deviceList.querySelectorAll('.device-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      
      // Update device if client is running
      if (clientRunning) {
        try {
          const result = await electronAPI.setDevice(deviceId);
          if (result.success) {
            showMessage(`Device changed to: ${item.querySelector('.device-name').textContent}`, 'success');
            addLog(`Device changed to ID ${deviceId}`, 'info');
          }
        } catch (error) {
          showMessage(`Error changing device: ${error.message}`, 'error');
        }
      }
    });
  });
}

function updateStatus(status) {
  statusText.textContent = status.message || 'Unknown';
  
  // Update indicator
  connectionIndicator.classList.remove('connected', 'registered');
  if (status.type === 'connected' || status.type === 'registered' || status.type === 'audio-started') {
    connectionIndicator.classList.add('connected');
    if (status.type === 'registered' || status.type === 'audio-started') {
      connectionIndicator.classList.add('registered');
    }
  }
}

function showMessage(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
  messageDiv.textContent = message;
  
  messagesDiv.innerHTML = '';
  messagesDiv.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

function addLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logArea.appendChild(logEntry);
  logArea.scrollTop = logArea.scrollHeight;
  
  // Keep only last 100 entries
  while (logArea.children.length > 100) {
    logArea.removeChild(logArea.firstChild);
  }
}

// Initial status check
setInterval(async () => {
  if (clientRunning) {
    try {
      const status = await electronAPI.getStatus();
      if (status.connected && !connectionIndicator.classList.contains('connected')) {
        updateStatus({ type: 'connected', message: 'Connected' });
      }
      if (status.registered && !connectionIndicator.classList.contains('registered')) {
        updateStatus({ type: 'registered', message: 'Registered as Source' });
      }
    } catch (error) {
      // Ignore errors
    }
  }
}, 2000);

// Initial load - try to get devices immediately
addLog('Dante Audio Client ready', 'success');
refreshDevices();

