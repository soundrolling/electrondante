const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startClient: (config) => ipcRenderer.invoke('start-client', config),
  stopClient: () => ipcRenderer.invoke('stop-client'),
  getDevices: () => ipcRenderer.invoke('get-devices'),
  setDevice: (deviceId) => ipcRenderer.invoke('set-device', deviceId),
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Event listeners
  onStatus: (callback) => ipcRenderer.on('client-status', (event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('client-error', (event, data) => callback(data)),
  onDevicesUpdated: (callback) => ipcRenderer.on('devices-updated', (event, data) => callback(data)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

