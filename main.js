const { app, BrowserWindow, ipcMain, systemPreferences, session } = require('electron');
const path = require('path');
const packageJson = require('./package.json');

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
    title: `Dante Audio Client v${packageJson.version}`,
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

  // Wait for window to be ready before requesting permissions
  mainWindow.webContents.once('did-finish-load', () => {
    // Window is ready, but don't request permissions automatically
    // Let the user trigger it when they need it
    console.log('Window ready');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (client) {
      client.stop();
      client = null;
    }
  });
}

app.whenReady().then(() => {
  // Set up session permission handlers for microphone access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    
    if (permission === 'media') {
      // For media permissions (microphone/camera), check macOS permission status
      if (process.platform === 'darwin') {
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        console.log('Microphone status for media permission:', micStatus);
        
        if (micStatus === 'granted') {
          callback(true); // Allow
        } else {
          // Ensure window is focused before requesting permission
          const window = BrowserWindow.fromWebContents(webContents);
          if (window) {
            if (!window.isVisible()) {
              window.show();
            }
            window.focus();
          }
          
          // Request permission if not granted
          systemPreferences.askForMediaAccess('microphone').then(granted => {
            console.log('Media access permission result:', granted);
            callback(granted);
          }).catch(err => {
            console.error('Error requesting media access:', err);
            callback(false);
          });
        }
      } else {
        // On non-macOS, allow by default
        callback(true);
      }
    } else {
      // Deny other permissions by default
      callback(false);
    }
  });
  
  createWindow();

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
  // Check microphone permission on macOS before enumerating devices
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      console.log('Microphone permission status:', status);
      
      if (status !== 'granted') {
        console.warn('Microphone permission not granted - returning empty device list');
        // Don't request permission here - user should use the button
        return [];
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return [];
    }
  }
  
  // Try to get devices from running client first
  if (client) {
    try {
      return client.getAvailableDevices();
    } catch (error) {
      console.error('Error getting devices from client:', error);
    }
  }
  
  // If no client, try to get devices directly using naudiodon
  try {
    const naudiodon = require('naudiodon');
    const devices = naudiodon.getDevices();
    const inputDevices = devices
      .filter(d => d.maxInputChannels > 0)
      .map(d => ({
        id: d.id,
        name: d.name,
        maxInputChannels: d.maxInputChannels,
        defaultSampleRate: d.defaultSampleRate,
        isDefault: d.isDefault,
      }));
    return inputDevices;
  } catch (error) {
    console.error('Error getting devices from naudiodon:', error);
    return [];
  }
});

ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform !== 'darwin') {
    return { granted: true, message: 'Not on macOS, permission not needed' };
  }
  
  try {
    // Check current status first
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('Current microphone permission status:', status);
    
    if (status === 'granted') {
      return { granted: true, message: 'Microphone permission already granted' };
    }
    
    // Ensure window exists, is visible, and focused
    if (!mainWindow) {
      return { 
        granted: false, 
        message: 'Window not available. Please restart the app.' 
      };
    }
    
    // Show and focus the window to ensure permission dialog can appear
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    // Focus the window - this is critical for macOS permission dialogs
    mainWindow.focus();
    
    // Wait a moment to ensure window is fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Requesting microphone permission...');
    console.log('Window visible:', mainWindow.isVisible());
    console.log('Window focused:', mainWindow.isFocused());
    
    // Request permission - this will show the system dialog
    // Note: askForMediaAccess must be called from the main process
    const result = await systemPreferences.askForMediaAccess('microphone');
    
    console.log('Permission request result:', result);
    
    // Check status again after request
    const newStatus = systemPreferences.getMediaAccessStatus('microphone');
    console.log('New microphone permission status:', newStatus);
    
    if (result || newStatus === 'granted') {
      console.log('Microphone permission granted');
      return { granted: true, message: 'Microphone permission granted' };
    } else {
      console.warn('Microphone permission denied or not granted');
      return { 
        granted: false, 
        message: 'Microphone permission denied. Please grant in System Settings → Privacy & Security → Microphone, then restart the app.' 
      };
    }
  } catch (error) {
    console.error('Error requesting microphone permission:', error);
    console.error('Error stack:', error.stack);
    return { 
      granted: false, 
      message: `Error requesting permission: ${error.message}. Please check System Settings → Privacy & Security → Microphone.` 
    };
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

