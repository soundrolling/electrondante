const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

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
  // Try to find icon, but don't fail if it doesn't exist
  let iconPath = null;
  try {
    const possibleIconPaths = [
      path.join(__dirname, 'build', 'icon.icns'),
      path.join(__dirname, 'icon.png'),
      path.join(__dirname, 'icon.icns'),
    ];
    for (const icon of possibleIconPaths) {
      if (fs.existsSync(icon)) {
        iconPath = icon;
        break;
      }
    }
  } catch (error) {
    console.warn('Could not find icon file:', error.message);
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    ...(iconPath && { icon: iconPath }),
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual glitches
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.loadFile('index.html').catch((error) => {
    console.error('Failed to load index.html:', error);
    // Try to show error in window if it exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('load-error', error.message);
    }
  });
  
  // Forward console logs to renderer for debugging
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (level >= 2) { // Error or warning
      mainWindow.webContents.send('console-log', { level, message });
    }
  });

  // Handle window errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('Window crashed, killed:', killed);
  });

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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - let Electron handle it
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.whenReady().then(() => {
  console.log('App ready, creating window...');
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
  // Try to get devices from running client first
  if (client) {
    return client.getAvailableDevices();
  }
  
  // If no client, try to enumerate devices directly
  try {
    const naudiodon = require('naudiodon');
    console.log('Attempting to enumerate devices with naudiodon...');
    
    // Check microphone permission first (macOS)
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      console.log('Microphone permission status:', status);
      if (status !== 'granted') {
        console.warn('Microphone permission not granted, status:', status);
        return [];
      }
    }
    
    const devices = naudiodon.getDevices();
    console.log(`Found ${devices.length} total devices from naudiodon`);
    
    const inputDevices = devices
      .filter(d => d.maxInputChannels > 0)
      .map(d => ({
        id: d.id,
        name: d.name,
        maxInputChannels: d.maxInputChannels,
        defaultSampleRate: d.defaultSampleRate,
        isDefault: d.isDefault,
      }));
    
    console.log(`Found ${inputDevices.length} input devices:`, inputDevices.map(d => d.name));
    return inputDevices;
  } catch (error) {
    console.error('Error enumerating devices:', error);
    console.error('Error stack:', error.stack);
    return [];
  }
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

