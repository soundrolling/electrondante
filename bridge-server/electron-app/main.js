const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');

// Try to load client-core, handle errors gracefully
let DanteBridgeClient = null;
try {
  DanteBridgeClient = require('./client-core');
} catch (error) {
  console.error('Failed to load client-core:', error);
  // Will show error in UI
}

let mainWindow = null;
let client = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'icon.png'), // Add icon later
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (client) {
      client.stop();
      client = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Handle permission requests (required for macOS microphone access)
  app.on('web-contents-created', (event, contents) => {
    contents.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        // For macOS, we need to explicitly request microphone access
        if (process.platform === 'darwin') {
          systemPreferences.askForMediaAccess('microphone').then((granted) => {
            callback(granted);
          }).catch(() => {
            callback(false);
          });
        } else {
          callback(true); // Allow on other platforms
        }
      } else {
        callback(false); // Deny other permissions
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('start-client', async (event, config) => {
  try {
    if (!DanteBridgeClient) {
      return { 
        success: false, 
        error: 'Client core not available. Please rebuild native dependencies: npm run rebuild' 
      };
    }
    
    if (client) {
      client.stop();
    }
    
    client = new DanteBridgeClient(config);
    
    // Set up event forwarding
    client.on('status', (status) => {
      mainWindow?.webContents.send('client-status', status);
    });
    
    client.on('error', (error) => {
      mainWindow?.webContents.send('client-error', error);
    });
    
    client.on('devices', (devices) => {
      mainWindow?.webContents.send('devices-updated', devices);
    });
    
    await client.connect();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-client', async () => {
  if (client) {
    client.stop();
    client = null;
    return { success: true };
  }
  return { success: false, error: 'Client not running' };
});

ipcMain.handle('get-devices', async () => {
  if (client) {
    return client.getAvailableDevices();
  }
  return [];
});

ipcMain.handle('set-device', async (event, deviceId) => {
  if (client) {
    return client.setDevice(deviceId);
  }
  return { success: false, error: 'Client not running' };
});

ipcMain.handle('get-status', async () => {
  if (client) {
    return {
      connected: client.connected,
      registered: client.registered,
      deviceId: client.selectedDeviceId,
      devices: client.availableDevices,
    };
  }
  return {
    connected: false,
    registered: false,
    deviceId: null,
    devices: [],
  };
});

// Request microphone permission (macOS)
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform !== 'darwin') {
    return { granted: true, error: null }; // Not needed on other platforms
  }

  try {
    // Ensure window is visible and focused (required for macOS Ventura+)
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow) {
      mainWindow.focus();
    }

    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') {
      return { granted: true, error: null };
    }

    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted, error: granted ? null : 'Permission denied by user' };
  } catch (error) {
    return { granted: false, error: error.message };
  }
});

// Check microphone permission status
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform !== 'darwin') {
    return { granted: true, status: 'granted' };
  }

  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { granted: status === 'granted', status };
  } catch (error) {
    return { granted: false, status: 'unknown', error: error.message };
  }
});

