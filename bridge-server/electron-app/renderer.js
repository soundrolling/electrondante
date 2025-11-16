// Renderer process - UI logic
let clientRunning = false;
let selectedDeviceId = null;

// DOM elements (will be initialized)
let startBtn;
let stopBtn;
let refreshDevicesBtn;
let railwayUrlInput;
let accessTokenInput;
let channelCountInput;
let deviceList;
let statusBar;
let connectionIndicator;
let statusText;
let messagesDiv;
let logArea;

// Waits for DOM and electronAPI
function initializeApp() {
  if (!window.electronAPI) {
    setTimeout(initializeApp, 100);  // Retry
    return;
  }

  const { electronAPI } = window;

  // Gets DOM elements
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
  railwayUrlInput = document.getElementById('railwayUrl');
  accessTokenInput = document.getElementById('accessToken');
  channelCountInput = document.getElementById('channelCount');
  deviceList = document.getElementById('deviceList');
  statusBar = document.getElementById('statusBar');
  connectionIndicator = document.getElementById('connectionIndicator');
  statusText = document.getElementById('statusText');
  messagesDiv = document.getElementById('messages');
  logArea = document.getElementById('logArea');

  // Check if all elements exist
  if (!startBtn || !stopBtn || !refreshDevicesBtn || !railwayUrlInput || 
      !accessTokenInput || !channelCountInput || !deviceList || !statusBar ||
      !connectionIndicator || !statusText || !messagesDiv || !logArea) {
    setTimeout(initializeApp, 100);  // Retry if DOM not ready
    return;
  }

  // Attaches listeners
  startBtn.addEventListener('click', startClient);
  stopBtn.addEventListener('click', stopClient);
  refreshDevicesBtn.addEventListener('click', refreshDevices);

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

  // Initial load
  addLog('Dante Audio Client ready', 'success');
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

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
    showMessage('Please enter Supabase Access Token', 'error');
    return;
  }
  
  try {
    startBtn.disabled = true;
    addLog('Starting client...', 'info');
    
    const result = await window.electronAPI.startClient({
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
    
    const result = await window.electronAPI.stopClient();
    
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
    const devices = await window.electronAPI.getDevices();
    renderDevices(devices);
    
    const status = await window.electronAPI.getStatus();
    if (status.deviceId !== null) {
      selectedDeviceId = status.deviceId;
    }
    
    if (devices.length === 0) {
      showMessage('No audio devices found. Make sure your audio device is connected and recognized by your OS.', 'error');
    }
  } catch (error) {
    showMessage(`Error refreshing devices: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
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
          const result = await window.electronAPI.setDevice(deviceId);
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
  if (clientRunning && window.electronAPI) {
    try {
      const status = await window.electronAPI.getStatus();
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