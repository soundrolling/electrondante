const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Legacy client methods (for backward compatibility)
  startClient: (config) => ipcRenderer.invoke('start-client', config),
  stopClient: () => ipcRenderer.invoke('stop-client'),
  getDevices: () => ipcRenderer.invoke('get-devices'),
  setDevice: (deviceId) => ipcRenderer.invoke('set-device', deviceId),
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Authentication methods
  login: (email, password, railwayUrl) => ipcRenderer.invoke('auth-login', email, password, railwayUrl),
  logout: () => ipcRenderer.invoke('auth-logout'),
  refreshToken: () => ipcRenderer.invoke('auth-refresh-token'),
  getAuthStatus: () => ipcRenderer.invoke('auth-get-status'),
  
  // Room management (broadcaster)
  createRoom: (password, name, metadata) => ipcRenderer.invoke('room-create', password, name, metadata),
  endBroadcast: () => ipcRenderer.invoke('room-end-broadcast'),
  
  // Room joining (listener)
  joinRoom: (roomCode, password, railwayUrl) => ipcRenderer.invoke('room-join', roomCode, password, railwayUrl),
  leaveRoom: () => ipcRenderer.invoke('room-leave'),
  
  // Broadcasting
  startBroadcast: (config) => ipcRenderer.invoke('broadcast-start', config),
  stopBroadcast: () => ipcRenderer.invoke('broadcast-stop'),
  
  // Listening
  startListening: (config) => ipcRenderer.invoke('listen-start', config),
  stopListening: () => ipcRenderer.invoke('listen-stop'),
  setVolume: (volume) => ipcRenderer.invoke('listen-set-volume', volume),
  
  // Permission handling (macOS)
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  
  // Event listeners
  onStatus: (callback) => ipcRenderer.on('client-status', (event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('client-error', (event, data) => callback(data)),
  onDevicesUpdated: (callback) => ipcRenderer.on('devices-updated', (event, data) => callback(data)),
  onConsoleLog: (callback) => ipcRenderer.on('console-log', (event, data) => callback(data)),
  onRoomStatus: (callback) => ipcRenderer.on('room-status', (event, data) => callback(data)),
  onAudioData: (callback) => ipcRenderer.on('audio-data', (event, data) => callback(data)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  getHealthCheck: () => ipcRenderer.invoke('get-health-check'),
});

