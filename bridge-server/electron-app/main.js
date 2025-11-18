const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

// Auto-updater for GitHub Releases
// This must be called before app.whenReady() and requires the repository field in package.json
try {
  require('update-electron-app')({
    repo: 'soundrolling/electrondante',
    updateInterval: '1 hour',
    logger: {
      info: (...args) => console.log('[Auto-updater]', ...args),
      warn: (...args) => console.warn('[Auto-updater]', ...args),
      error: (...args) => console.error('[Auto-updater]', ...args)
    }
  });
  console.log('Auto-updater initialized');
} catch (error) {
  console.warn('Auto-updater not available:', error.message);
  // Continue without auto-updates if the module fails to load
}

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

function mapInputDevices(devices) {
  return devices
    .filter((d) => d && d.maxInputChannels > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      maxInputChannels: d.maxInputChannels,
      defaultSampleRate: d.defaultSampleRate,
      isDefault: d.isDefault,
    }));
}

async function enumerateDevicesWithRetry(maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const naudiodon = require('naudiodon');
      const devices = naudiodon.getDevices();
      if (!Array.isArray(devices)) {
        throw new Error('Naudiodon returned invalid device list');
      }
      appendAppLog('INFO', `Enumerated devices on attempt ${attempt}`);
      return mapInputDevices(devices);
    } catch (error) {
      lastError = error;
      appendAppLog('WARN', `Device enumeration attempt ${attempt} failed`, error);
      if (attempt < maxAttempts) {
        await delay(300 * attempt);
      }
    }
  }
  throw lastError || new Error('Device enumeration failed');
}

async function requestMicrophonePermissionWithRetries(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'granted') {
        return { granted: true, status };
      }
      const granted = await systemPreferences.askForMediaAccess('microphone');
      if (granted) {
        return { granted: true, status: 'granted' };
      }
      appendAppLog('WARN', `Microphone permission denied on attempt ${attempt}`);
    } catch (error) {
      appendAppLog('ERROR', `Error requesting microphone permission on attempt ${attempt}`, error);
    }
    if (attempt < maxAttempts) {
      await delay(500 * attempt);
    }
  }
  return { granted: false, status: 'denied', error: 'Could not obtain microphone permission' };
}

function getMicrophonePermissionStatus() {
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { granted: status === 'granted', status };
  } catch (error) {
    appendAppLog('ERROR', 'Failed to read microphone permission status', error);
    return { granted: false, status: 'unknown', error: error.message };
  }
}

const LOG_FILENAME = 'dante-audio-client.log';
let appLogPath = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAppLogPath() {
  if (!appLogPath) {
    appLogPath = path.join(app.getPath('userData'), LOG_FILENAME);
  }
  return appLogPath;
}

function appendAppLog(level, message, error = null) {
  const timestamp = new Date().toISOString();
  const stack = error ? ` | ${error.stack || error}` : '';
  const entry = `${timestamp} [${level}] ${message}${stack}\n`;
  const filePath = getAppLogPath();

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFile(filePath, entry, (err) => {
      if (err) {
        console.error('Failed to write log file:', err);
      }
    });
  } catch (writeError) {
    console.error('Could not append to log file', writeError);
  }
}

function logErrorContext(context, error) {
  console.error(context, error);
  appendAppLog('ERROR', context, error);
}

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
  logErrorContext('Uncaught Exception', error);
  // Don't exit - let Electron handle it
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logErrorContext('Unhandled Rejection', reason);
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
  if (client) {
    return client.getAvailableDevices();
  }

  if (process.platform === 'darwin') {
    const permission = getMicrophonePermissionStatus();
    appendAppLog('INFO', `Microphone permission status: ${permission.status}`);
    if (!permission.granted) {
      appendAppLog('WARN', 'Microphone permission not granted; skipping device enumeration');
      return [];
    }
  }

  try {
    const devices = await enumerateDevicesWithRetry();
    appendAppLog('INFO', `Enumerated ${devices.length} input device(s)`);
    return devices;
  } catch (error) {
    logErrorContext('Error enumerating devices', error);
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

ipcMain.handle('get-health-check', async () => {
  const health = {
    nativeModuleLoaded: !!DanteBridgeClient,
    microphone: { granted: true, status: 'granted' },
    deviceScan: { success: false, devices: 0, error: null },
    timestamp: new Date().toISOString(),
    logPath: getAppLogPath(),
  };

  if (process.platform === 'darwin') {
    health.microphone = getMicrophonePermissionStatus();
  }

  if (!health.microphone.granted) {
    health.deviceScan.error = 'Microphone permission not granted';
    appendAppLog('WARN', 'Health check: microphone permission missing');
    return health;
  }

  try {
    const devices = await enumerateDevicesWithRetry(2);
    health.deviceScan.success = devices.length > 0;
    health.deviceScan.devices = devices.length;
    if (!health.deviceScan.success) {
      health.deviceScan.error = 'No devices found';
    }
  } catch (error) {
    health.deviceScan.error = error.message;
    appendAppLog('ERROR', 'Health check device enumeration failed', error);
  }

  return health;
});

// Request microphone permission (macOS)
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform !== 'darwin') {
    return { granted: true, error: null };
  }

  try {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow) {
      mainWindow.focus();
    }

    const result = await requestMicrophonePermissionWithRetries();
    appendAppLog('INFO', `Microphone permission request result: ${result.status || (result.granted ? 'granted' : 'denied')}`);
    return result;
  } catch (error) {
    logErrorContext('Exception while requesting microphone permission', error);
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

