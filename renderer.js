// Renderer process - UI logic

// Global state
let clientRunning = false;
let selectedDeviceId = null;
let electronAPI = null;

// DOM element references (will be set after DOM is ready)
let startBtn, stopBtn, refreshDevicesBtn, requestPermissionBtn;
let railwayUrlInput, accessTokenInput;
let channelCountInput, deviceList, statusBar, connectionIndicator;
let statusText, messagesDiv, logArea;
let statusPollingInterval = null;

// Initialization function - waits for DOM and electronAPI
function initializeApp() {
  // Check if electronAPI is available
  if (!window.electronAPI) {
    console.warn('electronAPI not available yet, retrying...');
    setTimeout(initializeApp, 100);
    return;
  }
  
  electronAPI = window.electronAPI;
  
  // Get DOM elements
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
  requestPermissionBtn = document.getElementById('requestPermissionBtn');
  railwayUrlInput = document.getElementById('railwayUrl');
  accessTokenInput = document.getElementById('accessToken');
  channelCountInput = document.getElementById('channelCount');
  deviceList = document.getElementById('deviceList');
  statusBar = document.getElementById('statusBar');
  connectionIndicator = document.getElementById('connectionIndicator');
  statusText = document.getElementById('statusText');
  messagesDiv = document.getElementById('messages');
  logArea = document.getElementById('logArea');
  
  // Check if all required elements exist
  if (!startBtn || !stopBtn || !refreshDevicesBtn || !requestPermissionBtn || !railwayUrlInput || 
      !accessTokenInput || !channelCountInput || !deviceList || !statusBar ||
      !connectionIndicator || !statusText || !messagesDiv || !logArea) {
    console.warn('Some DOM elements not found yet, retrying...');
    setTimeout(initializeApp, 100);
    return;
  }
  
  // Attach event listeners to buttons
  startBtn.addEventListener('click', startClient);
  stopBtn.addEventListener('click', stopClient);
  refreshDevicesBtn.addEventListener('click', refreshDevices);
  requestPermissionBtn.addEventListener('click', requestMicrophonePermission);
  
  // Set up Electron API event listeners
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
  
  // Start status polling
  startStatusPolling();
  
  // Initial log
  addLog('Dante Audio Client ready', 'success');
  
  // Initial load - try to get devices immediately
  refreshDevices();
  
  console.log('App initialized successfully');
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

async function requestMicrophonePermission() {
  try {
    if (!electronAPI) {
      showMessage('Electron API not available', 'error');
      return;
    }
    
    requestPermissionBtn.disabled = true;
    addLog('Requesting microphone permission...', 'info');
    showMessage('Requesting microphone permission - a system dialog should appear', 'info');
    
    // Request permission explicitly
    const result = await electronAPI.requestMicrophonePermission();
    
    if (result.granted) {
      showMessage('Microphone permission granted! Refreshing devices...', 'success');
      addLog('Microphone permission granted', 'success');
      // Wait a moment for the system to register the permission
      await new Promise(resolve => setTimeout(resolve, 500));
      // Refresh devices now that permission is granted
      await refreshDevices();
    } else {
      showMessage('Microphone permission denied. Please grant permission in System Settings → Privacy & Security → Microphone', 'error');
      addLog('Microphone permission denied - grant in System Settings', 'error');
    }
  } catch (error) {
    showMessage(`Error requesting permission: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
    console.error('Permission request error:', error);
  } finally {
    requestPermissionBtn.disabled = false;
  }
}

async function refreshDevices() {
  try {
    if (!electronAPI) {
      showMessage('Electron API not available', 'error');
      return;
    }
    
    refreshDevicesBtn.disabled = true;
    addLog('Enumerating audio devices...', 'info');
    
    const devices = await electronAPI.getDevices();
    addLog(`Found ${devices.length} audio device(s)`, devices.length > 0 ? 'success' : 'error');
    renderDevices(devices);
    
    const status = await electronAPI.getStatus();
    if (status.deviceId !== null) {
      selectedDeviceId = status.deviceId;
    }
    
    if (devices.length === 0) {
      showMessage('No audio devices found. Click "Request Microphone Permission" above, then check System Settings → Privacy & Security → Microphone.', 'error');
      addLog('No devices found - request microphone permission first', 'error');
    }
  } catch (error) {
    showMessage(`Error refreshing devices: ${error.message}`, 'error');
    addLog(`Error: ${error.message}`, 'error');
    console.error('Device enumeration error:', error);
  } finally {
    refreshDevicesBtn.disabled = false;
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

// Status polling function
function startStatusPolling() {
  // Clear any existing interval
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
  }
  
  // Poll status every 2 seconds
  statusPollingInterval = setInterval(async () => {
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
        // Ignore errors during polling
      }
    }
  }, 2000);
}

// Proper DOM Ready Detection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp(); // DOM already loaded
}
