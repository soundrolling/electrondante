// Admin Panel JavaScript
// Check if running in Electron and use injected tokens/URL
let API_BASE_URL = window.location.origin;
let accessToken = null;
let refreshToken = null;
let currentUser = null;

// If running in Electron, use injected tokens and API URL
if (window.__ELECTRON_AUTH_TOKENS__ && window.__ELECTRON_API_URL__) {
  API_BASE_URL = window.__ELECTRON_API_URL__;
  // Auto-login with Electron tokens
  accessToken = window.__ELECTRON_AUTH_TOKENS__.accessToken;
  refreshToken = window.__ELECTRON_AUTH_TOKENS__.refreshToken;
  currentUser = window.__ELECTRON_AUTH_TOKENS__.user;
  
  // Store in localStorage for persistence
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(currentUser));
}
let selectedRoom = null;
let selectedDevice = null;
let rooms = [];
let devices = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if running in Electron
  if (typeof window.__ELECTRON_AUTH_TOKENS__ === 'undefined') {
    // Not in Electron - show error
    document.getElementById('loginSection').innerHTML = `
      <div class="login-section">
        <div class="error-message">
          <h2>⚠️ Admin Panel</h2>
          <p>This admin panel is only available within the Electron app.</p>
          <p>Please open it from the main app using the "⚙️ Admin" button.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // If Electron tokens are available, skip login check
  if (window.__ELECTRON_AUTH_TOKENS__ && window.__ELECTRON_AUTH_TOKENS__.accessToken) {
    showDashboard();
    loadRooms();
    loadDevices();
  } else {
    // In Electron but not authenticated - show login
    checkAuth();
    loadDevices();
  }
});

// Check if user is already authenticated
async function checkAuth() {
  const storedToken = localStorage.getItem('accessToken');
  const storedRefresh = localStorage.getItem('refreshToken');
  const storedUser = localStorage.getItem('user');
  
  if (storedToken && storedUser) {
    accessToken = storedToken;
    refreshToken = storedRefresh;
    currentUser = JSON.parse(storedUser);
    
    // Verify token is still valid
    if (await verifyToken()) {
      showDashboard();
      loadRooms();
    } else {
      // Try to refresh
      if (refreshToken && await refreshAccessToken()) {
        showDashboard();
        loadRooms();
      } else {
        showLogin();
      }
    }
  } else {
    showLogin();
  }
}

// Verify token is valid
async function verifyToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/broadcaster/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Show login screen
function showLogin() {
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('header').style.display = 'none';
  document.getElementById('dashboard').classList.remove('active');
}

// Show dashboard
function showDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('header').style.display = 'flex';
  document.getElementById('dashboard').classList.add('active');
  document.getElementById('userEmail').textContent = currentUser.email;
}

// Handle login
async function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  
  if (!email || !password) {
    showError(errorDiv, 'Please enter email and password');
    return;
  }
  
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    errorDiv.style.display = 'none';
    
    const response = await fetch(`${API_BASE_URL}/auth/broadcaster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Store tokens
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    currentUser = data.user;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    showDashboard();
    loadRooms();
    showToast('Login successful!', 'success');
    
  } catch (error) {
    showError(errorDiv, error.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
}

// Handle logout
async function handleLogout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  showLogin();
  showToast('Logged out successfully', 'success');
}

// Refresh access token
async function refreshAccessToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    accessToken = data.accessToken;
    localStorage.setItem('accessToken', accessToken);
    return true;
  } catch (error) {
    return false;
  }
}

// Load rooms
async function loadRooms() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/broadcaster/rooms`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        if (await refreshAccessToken()) {
          return loadRooms();
        } else {
          handleLogout();
          return;
        }
      }
      throw new Error('Failed to load rooms');
    }
    
    rooms = await response.json();
    renderRooms();
  } catch (error) {
    console.error('Error loading rooms:', error);
    document.getElementById('roomsGrid').innerHTML = 
      `<div class="error-message">Error loading rooms: ${error.message}</div>`;
  }
}

// Render rooms
function renderRooms() {
  const grid = document.getElementById('roomsGrid');
  
  if (rooms.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🏠</div>
        <p>No rooms yet. Create your first room!</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = rooms.map(room => `
    <div class="room-card ${selectedRoom?.id === room.id ? 'active' : ''}" onclick="selectRoom('${room.id}')">
      <div class="room-header">
        <div>
          <div class="room-name">${room.name || `Room ${room.code}`}</div>
          <div class="room-code">${room.code}</div>
        </div>
        <span class="room-status ${room.hasBroadcaster ? 'live' : 'waiting'}">
          ${room.hasBroadcaster ? '🔴 Live' : '⏸️ Waiting'}
        </span>
      </div>
      <div class="room-stats">
        <span>👥 ${room.listenerCount || 0} listeners</span>
        <span>🎚️ ${room.activeChannels || 0} channels</span>
      </div>
      <div class="room-actions">
        <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); assignDeviceToRoom('${room.id}')">
          Assign Device
        </button>
        <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteRoom('${room.id}')">
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Select room
function selectRoom(roomId) {
  selectedRoom = rooms.find(r => r.id === roomId);
  renderRooms();
  
  // If on channels tab, load channels for this room
  if (document.querySelector('.tab.active').textContent === 'Channel Management') {
    loadChannelsForRoom(roomId);
  }
}

// Load devices (Electron only - uses real audio devices)
async function loadDevices() {
  try {
    // In Electron, get real devices from main process
    if (window.electronAPI && window.electronAPI.getDevices) {
      try {
        const electronDevices = await window.electronAPI.getDevices();
        if (electronDevices && Array.isArray(electronDevices)) {
          devices = electronDevices.map((device, index) => ({
            id: `device-${device.id || index}`,
            name: device.name,
            channels: device.maxInputChannels || 1,
            sampleRate: device.defaultSampleRate || 48000,
            assignedToRoom: null,
            electronDeviceId: device.id, // Store original ID for reference
          }));
          renderDevices();
          return;
        }
      } catch (error) {
        console.error('Could not get devices from Electron:', error);
        document.getElementById('deviceList').innerHTML = `
          <div class="error-message">Error loading devices: ${error.message}</div>
        `;
        return;
      }
    }
    
    // If no Electron API, show error
    document.getElementById('deviceList').innerHTML = `
      <div class="error-message">
        Admin panel requires Electron app. Please open from the main app.
      </div>
    `;
  } catch (error) {
    console.error('Error loading devices:', error);
    document.getElementById('deviceList').innerHTML = `
      <div class="error-message">Error loading devices: ${error.message}</div>
    `;
  }
}

// Render devices
function renderDevices() {
  const list = document.getElementById('deviceList');
  
  if (devices.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎤</div>
        <p>No audio devices found</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = devices.map(device => `
    <div class="device-item ${selectedDevice?.id === device.id ? 'selected' : ''}" 
         onclick="selectDevice('${device.id}')">
      <div class="device-info">
        <div class="device-name">${device.name}</div>
        <div class="device-details">
          ${device.channels || 'Unknown'} channels • 
          ${device.sampleRate || 'Unknown'} Hz
          ${device.assignedToRoom ? ` • Assigned to: ${device.assignedToRoom}` : ''}
        </div>
      </div>
      <button class="btn btn-small btn-primary" 
              onclick="event.stopPropagation(); assignDeviceToRoom(null, '${device.id}')">
        Assign
      </button>
    </div>
  `).join('');
}

// Select device
function selectDevice(deviceId) {
  selectedDevice = devices.find(d => d.id === deviceId);
  renderDevices();
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
  
  // Load data if needed
  if (tabName === 'channels' && selectedRoom) {
    loadChannelsForRoom(selectedRoom.id);
  }
}

// Show create room modal
function showCreateRoomModal() {
  document.getElementById('createRoomModal').classList.add('active');
}

// Close create room modal
function closeCreateRoomModal() {
  document.getElementById('createRoomModal').classList.remove('active');
  document.getElementById('roomName').value = '';
  document.getElementById('roomPassword').value = '';
  document.getElementById('createRoomError').style.display = 'none';
}

// Create room
async function createRoom() {
  const name = document.getElementById('roomName').value.trim();
  const password = document.getElementById('roomPassword').value;
  const errorDiv = document.getElementById('createRoomError');
  const createBtn = document.getElementById('createRoomBtn');
  
  if (!password || password.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters');
    return;
  }
  
  try {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    errorDiv.style.display = 'none';
    
    const response = await fetch(`${API_BASE_URL}/auth/room/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create room');
    }
    
    closeCreateRoomModal();
    loadRooms();
    showToast('Room created successfully!', 'success');
    
  } catch (error) {
    showError(errorDiv, error.message);
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Create Room';
  }
}

// Assign device to room
function assignDeviceToRoom(roomId, deviceId) {
  selectedDevice = deviceId ? devices.find(d => d.id === deviceId) : selectedDevice;
  
  // Populate room select
  const roomSelect = document.getElementById('assignRoomSelect');
  roomSelect.innerHTML = '<option value="">-- Select a room --</option>' +
    rooms.map(r => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>${r.name || r.code}</option>`).join('');
  
  // Populate channel checkboxes (1-32 channels)
  const channelCheckboxes = document.getElementById('channelCheckboxes');
  channelCheckboxes.innerHTML = '';
  for (let i = 1; i <= 32; i++) {
    const checkbox = document.createElement('div');
    checkbox.innerHTML = `
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="checkbox" value="${i}" style="width: 18px; height: 18px;">
        <span>Channel ${i}</span>
      </label>
    `;
    channelCheckboxes.appendChild(checkbox);
  }
  
  document.getElementById('assignDeviceModal').classList.add('active');
}

// Close assign device modal
function closeAssignDeviceModal() {
  document.getElementById('assignDeviceModal').classList.remove('active');
}

// Assign device
async function assignDevice() {
  const roomId = document.getElementById('assignRoomSelect').value;
  const selectedChannels = Array.from(document.querySelectorAll('#channelCheckboxes input:checked'))
    .map(cb => parseInt(cb.value));
  
  if (!roomId) {
    showToast('Please select a room', 'error');
    return;
  }
  
  if (!selectedDevice) {
    showToast('Please select a device', 'error');
    return;
  }
  
  if (selectedChannels.length === 0) {
    showToast('Please select at least one channel', 'error');
    return;
  }
  
  try {
    const assignBtn = document.getElementById('assignDeviceBtn');
    assignBtn.disabled = true;
    assignBtn.textContent = 'Assigning...';
    
    const response = await fetch(`${API_BASE_URL}/api/broadcaster/assign-device`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId: selectedDevice.id,
        roomId: roomId,
        channels: selectedChannels
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to assign device');
    }
    
    closeAssignDeviceModal();
    loadRooms();
    loadDevices();
    showToast('Device assigned successfully!', 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    const assignBtn = document.getElementById('assignDeviceBtn');
    assignBtn.disabled = false;
    assignBtn.textContent = 'Assign Device';
  }
}

// Load channels for room
async function loadChannelsForRoom(roomId) {
  try {
    // First load devices to get device names
    await loadDevices();
    
    const response = await fetch(`${API_BASE_URL}/api/broadcaster/rooms/${roomId}/channels`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load channels');
    }
    
    const channelData = await response.json();
    renderChannels(channelData);
    
    // Update room select in channels tab
    const channelRoomSelect = document.querySelector('#channelsTab select');
    channelRoomSelect.innerHTML = '<option value="">-- Select a room --</option>' +
      rooms.map(r => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>${r.name || r.code}</option>`).join('');
    
    channelRoomSelect.onchange = (e) => {
      if (e.target.value) {
        loadChannelsForRoom(e.target.value);
      }
    };
    
  } catch (error) {
    console.error('Error loading channels:', error);
    document.getElementById('channelsGrid').innerHTML = `
      <div class="error-message">Error loading channels: ${error.message}</div>
    `;
  }
}

// Render channels
function renderChannels(channelData) {
  const grid = document.getElementById('channelsGrid');
  const channels = channelData.channels || [];
  
  grid.innerHTML = '';
  for (let i = 1; i <= 32; i++) {
    const channel = channels.find(c => c.number === i);
    const isActive = channel && channel.active;
    const deviceName = channel ? channel.deviceName : null;
    
    grid.innerHTML += `
      <div class="channel-item ${isActive ? 'active' : ''}">
        <div class="channel-number">${i}</div>
        <div class="channel-status ${isActive ? 'active' : ''}">
          ${isActive ? `✓ ${deviceName || 'Active'}` : 'Inactive'}
        </div>
      </div>
    `;
  }
}

// Delete room
async function deleteRoom(roomId) {
  if (!confirm('Are you sure you want to delete this room? All listeners will be disconnected.')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/broadcaster/rooms/${roomId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete room');
    }
    
    loadRooms();
    showToast('Room deleted successfully', 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Utility functions
function showError(element, message) {
  element.textContent = message;
  element.style.display = 'block';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

