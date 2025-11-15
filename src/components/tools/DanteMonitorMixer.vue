<template>
  <div class="dante-monitor-mixer">
    <div class="mixer-container">
      <!-- Header -->
      <div class="mixer-header">
        <h2 class="mixer-title">Dante Personal Monitor Mixer</h2>
        <div class="status-bar">
          <span 
            class="status-indicator"
            :class="{ 'connected': connected, 'disconnected': !connected }"
          >
            {{ connected ? '● Connected' : '○ Disconnected' }}
          </span>
          <span v-if="isSource" class="source-badge">🎤 Source</span>
          <span v-else-if="hasSource" class="listener-badge">👂 Listener</span>
          <span v-else class="no-source-badge">⚠️ No Source</span>
          <span class="latency-info">
            Playback: {{ latency.toFixed(1) }}ms | 
            Stream: ~{{ streamLatency.toFixed(0) }}ms | 
            Network: {{ connectionQuality.averageLatency }}ms | 
            Quality: <span :style="{ color: connectionQuality.qualityColor }">{{ qualityLevelDisplay }}</span>
            <span v-if="connectionQuality.packetLoss > 0" style="color: #ef4444;">
              ({{ connectionQuality.packetLoss.toFixed(1) }}% loss)
            </span>
          </span>
        </div>
        <div v-if="connectionError" class="connection-error">
          <p>⚠️ Connection Error: {{ connectionError }}</p>
          <p class="error-hint">WebSocket URL: {{ wsUrl }}</p>
        </div>
      </div>

      <!-- Auth Component (if not authenticated) -->
      <div v-if="!authenticated" class="auth-section">
        <h3>Sign In Required</h3>
        <form @submit.prevent="handleSignIn" class="auth-form">
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            required
            class="form-input"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            required
            class="form-input"
          />
          <button type="submit" :disabled="authLoading" class="btn btn-primary">
            {{ authLoading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
        <p v-if="authError" class="error-message">{{ authError }}</p>
      </div>

      <!-- Mixer Interface (if authenticated) -->
      <div v-else class="mixer-interface">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button 
            @click="activeTab = 'source'"
            :class="['tab-button', { active: activeTab === 'source' }]"
          >
            🎤 Audio Source
          </button>
          <button 
            @click="activeTab = 'mixer'"
            :class="['tab-button', { active: activeTab === 'mixer' }]"
          >
            🎧 Monitor Mixer
          </button>
        </div>

        <!-- Tab Content: Audio Source Setup -->
        <div v-show="activeTab === 'source'" class="tab-content source-tab">
          <div class="source-setup-section">
          <h3 class="section-title">🎤 Audio Source Setup</h3>
          <div class="source-control-bar">
            <!-- Audio Device Selection -->
            <div class="device-selection">
            <div class="device-header">
              <label class="device-label">Audio Input Device:</label>
              <span v-if="isCapturing" class="client-status connected">● Capturing</span>
              <span v-else class="client-status disconnected">○ Not Capturing</span>
            </div>
            
            <div class="device-controls">
              <select 
                v-model="selectedDeviceId"
                :disabled="deviceLoading || isSource"
                class="device-select"
              >
                <option value="">Default Device</option>
                <option 
                  v-for="device in availableDevices" 
                  :key="device.id" 
                  :value="device.id"
                >
                  {{ device.label }}
                </option>
              </select>
              <button 
                @click="refreshDevices"
                :disabled="deviceLoading"
                class="btn btn-secondary btn-small"
              >
                {{ deviceLoading ? 'Loading...' : 'Refresh Devices' }}
              </button>
            </div>
            
            <p v-if="deviceError || captureError" class="error-message">{{ deviceError || captureError }}</p>
            <p v-if="isSource" class="info-message">
              Device selection disabled while source is active. Stop source to change device.
            </p>
            <p v-if="!isSource && availableDevices.length === 0" class="info-message">
              Click "Refresh Devices" to load available audio input devices. You may need to grant microphone permissions.
            </p>
            <p v-if="!isSource && availableDevices.length > 0" class="info-message">
              <strong>Note:</strong> Most browsers only support stereo (2 channels) via web audio. For multi-channel devices like Dante Virtual Soundcard with 16+ channels, the browser will typically only capture 1-2 channels. For full multi-channel support, use the Electron app (see download link below).
            </p>
            
            <!-- Electron App Download Info -->
            <div class="electron-app-info" v-if="!isSource">
              <p class="info-message electron-app-message">
                <strong>💻 For Multi-Channel Audio:</strong> Download the Electron app for full support of devices like Dante Virtual Soundcard (16+ channels). 
                <a href="https://github.com/soundrolling/proapp2149/releases" target="_blank" class="electron-app-link">Download from GitHub Releases</a>
              </p>
            </div>
            
            <!-- Debug Panel (for testing) -->
            <div class="debug-panel">
              <button 
                @click="showDebugPanel = !showDebugPanel"
                class="btn btn-secondary btn-small"
                style="margin-top: 0.5rem;"
              >
                {{ showDebugPanel ? 'Hide' : 'Show' }} Debug Info
              </button>
              <div v-if="showDebugPanel" class="debug-content">
                <h4>Debug Information</h4>
                <div class="debug-section">
                  <strong>Audio Capture State:</strong>
                  <ul>
                    <li>Is Capturing: {{ isCapturing }}</li>
                    <li>Selected Device ID: {{ selectedDeviceId || 'Default' }}</li>
                    <li>Available Devices: {{ availableDevices.length }}</li>
                    <li>Capture Error: {{ captureError || 'None' }}</li>
                    <li>Device Error: {{ deviceError || 'None' }}</li>
                  </ul>
                </div>
                <div class="debug-section">
                  <strong>WebSocket State:</strong>
                  <ul>
                    <li>Connected: {{ connected }}</li>
                    <li>Is Source: {{ isSource }}</li>
                    <li>Has Source: {{ hasSource }}</li>
                    <li>Source Registration Error: {{ sourceRegistrationError || 'None' }}</li>
                    <li>Connection Error: {{ connectionError || 'None' }}</li>
                  </ul>
                </div>
                <div class="debug-section">
                  <strong>Instructions:</strong>
                  <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                    Check browser console (F12) for detailed logs prefixed with [AUDIO CAPTURE].<br>
                    Copy any errors you see here or in the console and share them for debugging.
                  </p>
                </div>
              </div>
            </div>
            </div>
          </div>
            
          <div class="source-controls">
            <button 
              v-if="!isSource && !isYourSource"
              @click="registerAsSource"
              :disabled="!connected || hasSource"
              class="btn btn-primary"
            >
              {{ hasSource ? 'Source Already Active (Another User)' : 'Register as Source' }}
            </button>
            <p v-if="hasSource && !isYourSource" class="info-message another-source-active">
              <strong>⚠️ Another user is already the source.</strong> Only one source can be active at a time. Wait for the current source to stop, or ask them to transfer control.
            </p>
            <button 
              v-if="isSource"
              @click="unregisterAsSource"
              class="btn btn-secondary"
            >
              Stop Source
            </button>
            <button 
              v-if="!isSource && isYourSource"
              @click="unregisterAsSource"
              class="btn btn-danger"
            >
              Stop My Source (Reconnected)
            </button>
            <p v-if="sourceRegistrationError" class="error-message">{{ sourceRegistrationError }}</p>
            <p v-if="isYourSource && !isSource" class="info-message source-on-other-device">
              <strong>ℹ️ You are the active source on another device.</strong> This device is in listener mode. You can stop the source from here, or switch to the source device to control it directly.
            </p>
            <p v-if="!hasSource && !isSource && !isYourSource" class="info-message">
              No audio source active. Select an audio device above, then register as source to start streaming.
            </p>
            </div>
          </div>
          
          <!-- Active Source Status (when source is active) -->
          <div class="active-source-status" v-if="isSource">
            <div class="source-status-card">
              <h3 class="section-title">🎤 Active Source</h3>
              <div class="status-info">
                <span class="status-badge active">● Streaming Active</span>
                <span class="status-badge device">Device: {{ selectedDeviceId ? availableDevices.find(d => d.id === selectedDeviceId)?.label || 'Selected Device' : 'Default Device' }}</span>
              </div>
              <button 
                @click="unregisterAsSource"
                class="btn btn-secondary"
                style="margin-top: 1rem;"
              >
                Stop Source
              </button>
              <p v-if="sourceRegistrationError" class="error-message" style="margin-top: 0.5rem;">{{ sourceRegistrationError }}</p>
            </div>
          </div>
        </div>

        <!-- Tab Content: Monitor Mixer -->
        <div v-show="activeTab === 'mixer'" class="tab-content mixer-tab">
          <!-- Show active source indicator when streaming as source -->
          <div v-if="isSource && isCapturing" class="streaming-indicator">
            <span class="streaming-badge">● Streaming Active</span>
            <span class="streaming-info">Audio is being captured and streamed. You can switch tabs freely - streaming will continue.</span>
          </div>
          
          <!-- Show buffering indicator when buffering audio (only for listeners) -->
          <div v-if="hasSource && isBuffering && !isSource" class="buffering-indicator">
            <div class="buffering-content">
              <div class="buffering-spinner"></div>
              <div class="buffering-text">
                <span class="buffering-badge">⏳ Buffering Audio...</span>
                <div class="buffering-details">
                  <span class="buffering-info">
                    Buffer: {{ bufferStats.current.toLocaleString() }} / {{ bufferStats.target.toLocaleString() }} samples
                    ({{ bufferStats.currentTimeMs.toFixed(0) }}ms / {{ bufferStats.targetTimeMs.toFixed(0) }}ms)
                  </span>
                  <div class="buffering-progress-bar">
                    <div 
                      class="buffering-progress-fill" 
                      :style="{ width: `${bufferStats.progress}%` }"
                    ></div>
                  </div>
                  <span class="buffering-progress-text">{{ bufferStats.progress.toFixed(1) }}% - Max seen: {{ bufferStats.max.toLocaleString() }} samples</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Buffer Settings (when not buffering or always visible) -->
          <div v-if="hasSource && !isSource" class="buffer-settings">
            <button 
              @click="showBufferSettings = !showBufferSettings"
              class="btn btn-secondary btn-small"
            >
              {{ showBufferSettings ? 'Hide' : 'Show' }} Buffer Settings
            </button>
            <div v-if="showBufferSettings" class="buffer-settings-panel">
              <label class="buffer-settings-label">
                Buffer Size (milliseconds):
                <input 
                  v-model.number="bufferSizeMs"
                  type="number"
                  min="50"
                  max="2000"
                  step="50"
                  @change="updateBufferSize"
                  class="buffer-size-input"
                />
                <span class="buffer-size-hint">(~{{ Math.round((bufferSizeMs / 1000) * 48000).toLocaleString() }} samples at 48kHz)</span>
              </label>
              <p class="buffer-settings-info">
                Larger buffers = smoother playback but longer initial delay. 
                Current: {{ bufferStats.targetTimeMs.toFixed(0) }}ms ({{ bufferStats.target.toLocaleString() }} samples)
              </p>
            </div>
          </div>
          
          <!-- Listener/Mixer Section (for monitoring and mixing) -->
          <div class="listener-mixer-section" v-if="hasSource || !isSource">
          <h3 class="section-title">🎧 Monitor Mixer</h3>
          
          <!-- Preset Bar -->
        <div class="preset-bar">
          <select 
            v-model="selectedPresetId"
            @change="loadPreset"
            class="preset-select"
          >
            <option value="">Select Preset</option>
            <option 
              v-for="preset in presets" 
              :key="preset.id" 
              :value="preset.id"
            >
              {{ preset.name }}
            </option>
          </select>
          <button 
            @click="showSavePresetModal = true"
            class="btn btn-positive"
          >
            Save Preset
          </button>
        </div>

          <!-- Channel Grid -->
          <div class="channels-grid">
          <DanteChannelStrip
            v-for="(channel, index) in enabledChannels"
            :key="channel.index"
            :channel="channel"
            :peak-level="peakLevels[channel.index]"
            :peak-hold="peakHolds[channel.index]"
            @fader-change="(value) => handleFaderChange(channel.index, value)"
            @pan-change="(value) => handlePanChange(channel.index, value)"
            @mute-toggle="() => handleMuteToggle(channel.index)"
            @solo-toggle="() => handleSoloToggle(channel.index)"
          />
          <!-- Add Channel Button -->
          <button 
            v-if="enabledChannels.length < Math.min(32, channels.length)"
            @click="addChannel"
            class="add-channel-btn"
            :disabled="enabledChannels.length >= 32"
          >
            <span class="add-icon">+</span>
            <span class="add-label">Add Channel</span>
          </button>
        </div>
          </div>
          
          <!-- No Source Message -->
          <div class="no-source-message" v-if="!hasSource && !isSource">
            <div class="info-card">
              <h3>⚠️ No Audio Source Active</h3>
              <p>An audio source needs to be registered before you can monitor the mix.</p>
              <button 
                @click="activeTab = 'source'"
                class="btn btn-primary"
                style="margin-top: 1rem;"
              >
                Go to Audio Source Setup
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Preset Modal -->
      <div v-if="showSavePresetModal" class="modal-overlay" @click.self="showSavePresetModal = false">
        <div class="modal-content">
          <h3>Save Preset</h3>
          <input
            v-model="presetName"
            type="text"
            placeholder="Preset name"
            class="form-input"
            @keyup.enter="savePreset"
          />
          <div class="modal-actions">
            <button @click="showSavePresetModal = false" class="btn btn-secondary">
              Cancel
            </button>
            <button @click="savePreset" class="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '@/supabase';
import { useUserStore } from '@/stores/userStore';
import { useDanteMixer } from '@/composables/useDanteMixer';
import { useAudioCapture } from '@/composables/useAudioCapture';
import { useConnectionQuality } from '@/composables/useConnectionQuality';
import DanteChannelStrip from './DanteChannelStrip.vue';

const router = useRouter();
const userStore = useUserStore();

// Auth state
const authenticated = ref(false);
const email = ref('');
const password = ref('');
const authLoading = ref(false);
const authError = ref('');

// Connection state
const connected = ref(false);
const wsRef = ref(null);
const latency = ref(0);
const streamLatency = ref(340); // Default: ~340ms (4096 samples * 4 batches / 48000 * 1000)
const connectionError = ref('');
const isSource = ref(false);
const hasSource = ref(false);
const sourceRegistrationError = ref('');
const isYourSource = ref(false); // True if current user is the source (even if reconnected as listener)
const sourceUserId = ref(null); // ID of the user who is currently the source
const reconnectTimer = ref(null);
const pingInterval = ref(null);
const audioPacketCount = ref(0); // Track received audio packets for debugging

// Browser audio capture - pass isSource ref so it stops sending when not source
const {
  isCapturing,
  captureError,
  availableDevices,
  selectedDeviceId,
  streamLatency: captureStreamLatency,
  enumerateDevices,
  startCapture,
  stopCapture,
} = useAudioCapture(wsRef, 32, 48000, computed(() => isSource.value));

// Use stream latency from capture, or default
watch(captureStreamLatency, (newLatency) => {
  if (newLatency) {
    streamLatency.value = newLatency;
  }
});

const deviceLoading = ref(false);
const deviceError = ref('');
const showDebugPanel = ref(false);
const activeTab = ref('mixer'); // 'source' or 'mixer' - default to mixer for listeners

// Connection quality monitoring
const connectionQuality = useConnectionQuality();

// Computed property to unwrap quality level for display
const qualityLevelDisplay = computed(() => {
  // Access .value explicitly since qualityLevel is a computed ref
  const level = connectionQuality.qualityLevel?.value ?? 'unknown';
  return String(level).toUpperCase();
});

// User role check
const userRole = ref(null);
const isOwnerOrAdmin = computed(() => {
  return userRole.value === 'owner' || userRole.value === 'admin';
});

// Mixer state
const channels = ref([]);
const presets = ref([]);
const selectedPresetId = ref('');
const showSavePresetModal = ref(false);
const presetName = ref('');

// Audio engine - support up to 32 channels
const { mixer, peakLevels, peakHolds, isBuffering, bufferStats } = useDanteMixer(32, 48000);

// Buffer size setting (in milliseconds, converted to samples)
const bufferSizeMs = ref(341); // Default ~341ms
const showBufferSettings = ref(false);

// Computed: only show enabled channels
const enabledChannels = computed(() => {
  return channels.value.filter(ch => ch.enabled);
});

// WebSocket URL from environment
const wsUrl = computed(() => {
  let url = import.meta.env.VITE_BRIDGE_WS_URL || process.env.VUE_APP_BRIDGE_WS_URL || 'ws://localhost:3001';
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
});

// Check user role
const checkUserRole = async () => {
  if (!userStore.currentProject?.id) {
    userRole.value = null;
    return;
  }
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      userRole.value = null;
      return;
    }
    
    const { data, error } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', userStore.currentProject.id)
      .eq('user_email', email)
      .single();
    
    if (error) {
      console.warn('Could not check user role:', error);
      userRole.value = null;
      return;
    }
    
    userRole.value = data?.role || null;
    
    // Load audio devices for all authenticated users (not just owners/admins)
    if (authenticated.value) {
      loadAudioDevices();
    }
  } catch (error) {
    console.error('Error checking user role:', error);
    userRole.value = null;
  }
};

// Check authentication on mount
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    authenticated.value = true;
    connectWebSocket();
    loadPresets();
    checkUserRole();
    loadAudioDevices(); // Load browser audio devices
    // Default to mixer tab for listeners
    activeTab.value = 'mixer';
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    authenticated.value = !!session?.user;
    if (authenticated.value) {
      connectWebSocket();
      loadPresets();
      checkUserRole();
      loadAudioDevices(); // Load browser audio devices
    } else {
      disconnectWebSocket();
      userRole.value = null;
      stopCapture(); // Stop any active capture
    }
  });
  
  // Watch for project changes
  watch(() => userStore.currentProject, () => {
    checkUserRole();
  });
});

onBeforeUnmount(() => {
  disconnectWebSocket();
  if (mixer.value) {
    mixer.value.stop();
  }
  // Clear any remaining timers
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value);
  }
  if (pingInterval.value) {
    clearInterval(pingInterval.value);
  }
  stopCapture(); // Stop audio capture
});

// Authentication
const handleSignIn = async () => {
  authLoading.value = true;
  authError.value = '';

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (error) throw error;

    authenticated.value = true;
    connectWebSocket();
    loadPresets();
  } catch (error) {
    authError.value = error.message || 'Failed to sign in';
  } finally {
    authLoading.value = false;
  }
};

// WebSocket connection
const connectWebSocket = async () => {
  if (wsRef.value?.readyState === WebSocket.OPEN) return;

  // Clean up any existing connection
  if (wsRef.value) {
    try {
      wsRef.value.close();
    } catch (e) {
      // Ignore errors when closing
    }
    wsRef.value = null;
  }

  try {
    // Ensure URL has no trailing slash and uses correct protocol
    let url = wsUrl.value.trim();
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    
    // Ensure protocol is correct
    if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (!url.startsWith('ws')) {
      // Default to wss for production URLs
      url = `wss://${url}`;
    }
    
    console.log(`🔌 Attempting WebSocket connection to: ${url}`);
    const ws = new WebSocket(url);
    wsRef.value = ws;

    ws.onopen = async () => {
      console.log('✅ Connected to bridge server');
      connected.value = true;
      connectionError.value = ''; // Clear any previous errors
      
      // Track connection start time
      ws._connectionStartTime = Date.now();
      
      // Clear any pending reconnect timer
      if (reconnectTimer.value) {
        clearTimeout(reconnectTimer.value);
        reconnectTimer.value = null;
      }
      
      // Set up ping interval to keep connection alive and measure latency (every 5 seconds)
      if (pingInterval.value) {
        clearInterval(pingInterval.value);
      }
      pingInterval.value = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            connectionQuality.startPing();
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } catch (error) {
            console.warn('Failed to send ping:', error);
          }
        }
      }, 5000); // Ping every 5 seconds for connection keepalive

      // Authenticate with server
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: session.access_token,
        }));
      }
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Only log non-audio messages (audio messages are too frequent)
        if (message.type !== 'audio') {
          console.log('📨 Received message:', message.type, message);
        }
        
        // Handle config message immediately (before handleServerMessage)
        if (message.type === 'config') {
          console.log('✅ Received config:', message);
          
        // Update source status from config
        if (message.hasSource !== undefined) {
          hasSource.value = message.hasSource;
        }
        
        // Check if current user is the source (reconnection scenario)
        if (message.sourceUserId) {
          // We'll check this after authentication
          console.log('Source user ID from config:', message.sourceUserId);
        }
          
          // Initialize channel state
          // Only channels 1-2 (index 0-1) are enabled and unmuted by default
          // Rest are muted and disabled until user adds them
          const maxChannels = Math.min(32, message.channels);
          const channelState = Array.from({ length: maxChannels }, (_, i) => ({
            index: i,
            name: `Channel ${i + 1}`,
            gain: 0.7, // Default 70% volume
            pan: 0,
            muted: i >= 2, // Mute channels 3+ by default
            solo: false,
            enabled: i < 2, // Only enable channels 1-2 by default
          }));
          
          channels.value = channelState;
          console.log(`📊 Initialized ${channelState.length} channels (${channelState.filter(ch => ch.enabled).length} enabled)`);
          
          // Apply initial mute states to audio engine
          if (mixer.value) {
            channelState.forEach((ch, i) => {
              mixer.value.setChannelGain(i, ch.muted ? 0 : ch.gain);
              mixer.value.setChannelPan(i, ch.pan);
            });
          }
          
          // Try to start audio context (may need user interaction)
          if (mixer.value) {
            try {
              await mixer.value.start();
              latency.value = mixer.value.getLatency();
              console.log('✅ Audio mixer started');
            } catch (error) {
              if (error.name === 'NotAllowedError') {
                console.warn('⚠️ AudioContext requires user interaction. Click anywhere to enable audio.');
                connectionError.value = 'Click anywhere on the page to enable audio playback';
                // Add click handler to start audio on first user interaction
                const startAudioOnClick = async () => {
                  try {
                    await mixer.value.start();
                    latency.value = mixer.value.getLatency();
                    connectionError.value = '';
                    console.log('✅ Audio mixer started after user interaction');
                    document.removeEventListener('click', startAudioOnClick);
                    document.removeEventListener('touchstart', startAudioOnClick);
                  } catch (e) {
                    console.error('Failed to start audio:', e);
                  }
                };
                document.addEventListener('click', startAudioOnClick, { once: true });
                document.addEventListener('touchstart', startAudioOnClick, { once: true });
              } else {
                console.error('Error starting audio:', error);
              }
            }
          }
          return; // Don't call handleServerMessage for config
        }
        
        handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      const reason = event.reason || 'no reason';
      const code = event.code;
      console.log(`❌ Disconnected from bridge server (code: ${code}, reason: ${reason})`);
      
      // Log connection duration if tracked
      if (ws._connectionStartTime) {
        const duration = Date.now() - ws._connectionStartTime;
        console.log(`⏱️ Connection duration: ${Math.round(duration / 1000)}s`);
      }
      
      // Log specific error codes for debugging
      if (code === 1006) {
        console.warn('⚠️ Abnormal closure (1006) - connection closed without proper close frame. This may indicate network issues or Railway timeout.');
      } else if (code === 1001) {
        console.log('ℹ️ Going away (1001) - server or client is shutting down');
      } else if (code === 1000) {
        console.log('✅ Normal closure (1000)');
      }
      
      connected.value = false;
      isSource.value = false;
      hasSource.value = false;
      
      // Clear ping interval
      if (pingInterval.value) {
        clearInterval(pingInterval.value);
        pingInterval.value = null;
      }
      
      // Clear any existing reconnect timer
      if (reconnectTimer.value) {
        clearTimeout(reconnectTimer.value);
      }
      
      // Don't reconnect if it was a normal closure (1000) or if we're shutting down
      if (code !== 1000) {
        connectionError.value = `Connection closed (code: ${code}). Retrying...`;
        // Reconnect after 3 seconds with exponential backoff
        reconnectTimer.value = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      connected.value = false;
      connectionError.value = `Failed to connect to ${wsUrl.value}. Check that the Railway server is running and the URL is correct.`;
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    connected.value = false;
    connectionError.value = error.message || `Cannot connect to ${wsUrl.value}`;
  }
};

const disconnectWebSocket = () => {
  // Clear timers
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value);
    reconnectTimer.value = null;
  }
  if (pingInterval.value) {
    clearInterval(pingInterval.value);
    pingInterval.value = null;
  }
  
  if (wsRef.value) {
    try {
      wsRef.value.close(1000, 'Client disconnecting');
    } catch (e) {
      // Ignore errors
    }
    wsRef.value = null;
  }
};

const handleServerMessage = async (message) => {
  switch (message.type) {
    case 'config':
      // Config is now handled in ws.onmessage directly
      console.log('Config message already handled');
      break;

    case 'audio':
      // Receive audio data for a channel
      // Only process if we're NOT the source (sources don't receive their own audio)
      if (isSource.value) {
        // Source shouldn't receive audio - this is unexpected
        console.warn(`⚠️ [LISTENER] Source received audio packet (this shouldn't happen)`);
        return;
      }
      
      // Note: Jitter buffering would be handled here if implemented
      if (mixer.value) {
        const encoding = message.encoding || 'pcm'; // Default to PCM if not specified
        // Log first few audio packets for debugging
        audioPacketCount.value++;
        if (audioPacketCount.value <= 5 || audioPacketCount.value % 100 === 0) {
          console.log(`🎧 [LISTENER] Received audio packet #${audioPacketCount.value} for channel ${message.channel}, encoding: ${encoding}, data length: ${message.data?.length || 0}`);
          // Log buffer stats after receiving audio
          if (mixer.value.getBufferStats) {
            const stats = mixer.value.getBufferStats();
            console.log(`📊 [LISTENER] Buffer after packet: current=${stats.current}, target=${stats.target}, progress=${stats.progress.toFixed(1)}%`);
          }
        }
        mixer.value.addChannelData(message.channel, message.data, encoding);
      } else {
        console.warn(`⚠️ [LISTENER] Received audio but mixer is not initialized`);
      }
      // Update connection quality stats if available
      if (message.sequence !== undefined && connectionQuality) {
        // Track packet reception for quality monitoring
        connectionQuality.updateStats({
          packetsReceived: connectionQuality.packetsReceived + 1,
        });
      }
      break;

    case 'preset':
      // Load preset settings
      applyPreset(message.data);
      break;

    case 'authenticated':
      console.log('Authenticated with server');
      loadPresets();
      // Request source status update after authentication
      // Server will send sourceStatus message with isYourSource flag
      break;

    case 'sourceRegistered':
      console.log('✅ Registered as source');
      isSource.value = true;
      hasSource.value = true;
      sourceRegistrationError.value = '';
      // Switch to source tab when registered as source
      activeTab.value = 'source';
      // Start capturing audio from selected device
      if (wsRef.value && wsRef.value.readyState === WebSocket.OPEN) {
        console.log('🎤 Starting audio capture after source registration...');
        try {
          await startCapture(selectedDeviceId.value || null);
          console.log('✅ Audio capture started successfully');
        } catch (error) {
          console.error('❌ Failed to start audio capture:', error);
          sourceRegistrationError.value = `Failed to start audio capture: ${error.message || error}`;
        }
      } else {
        console.error('❌ WebSocket not ready for audio capture');
        sourceRegistrationError.value = 'WebSocket not connected. Cannot start audio capture.';
      }
      break;

    case 'sourceUnregistered':
      console.log('✅ Unregistered as source');
      isSource.value = false;
      hasSource.value = false;
      isYourSource.value = false;
      sourceRegistrationError.value = '';
      stopCapture();
      break;

    case 'sourceStatus':
      // Update source status from server
      hasSource.value = message.hasSource;
      isYourSource.value = message.isYourSource || false;
      sourceUserId.value = message.sourceUserId || null;
      
      // If user is the source on another device, automatically switch to listener tab
      if (message.isYourSource && !isSource.value) {
        // User is the source but on a different device - switch to listener tab
        console.log('⚠️ You are the source on another device. Switching to listener mode.');
        activeTab.value = 'mixer';
      } else if (!message.hasSource && isSource.value) {
        // We were source but server says no source - connection lost
        isSource.value = false;
        isYourSource.value = false;
        sourceUserId.value = null;
      }
      break;

    case 'presetSaved':
      loadPresets();
      showSavePresetModal.value = false;
      presetName.value = '';
      break;

    case 'pong':
      // Server responded to ping - connection is alive
      connectionQuality.recordPong();
      if (message.timestamp) {
        const roundTripTime = Date.now() - message.timestamp;
        connectionQuality.updateLatency(roundTripTime / 2); // One-way latency
      }
      break;

    case 'error':
      console.error('Server error:', message.message);
      if (message.message.includes('Source already registered')) {
        hasSource.value = true;
        sourceRegistrationError.value = 'Another source is already active. Only one source allowed at a time.';
      } else if (message.message.includes('Source registration')) {
        sourceRegistrationError.value = message.message;
      }
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
};

// Preset management
const loadPresets = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('mix_presets')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error loading presets:', error);
    return;
  }

  presets.value = data || [];
};

const loadPreset = async () => {
  if (!selectedPresetId.value || !wsRef.value) return;

  wsRef.value.send(JSON.stringify({
    type: 'loadPreset',
    presetId: selectedPresetId.value,
  }));
};

const applyPreset = (preset) => {
  if (!mixer.value) return;

  // Apply preset values but preserve enabled state (UI preference)
  const updatedChannels = channels.value.map((ch, i) => ({
    ...ch,
    gain: preset.faders?.[i] ?? ch.gain,
    pan: preset.pans?.[i] ?? ch.pan,
    muted: preset.mutes?.[i] ?? ch.muted,
    // Keep enabled state - don't change which channels are visible
  }));

  channels.value = updatedChannels;

  // Apply to audio engine
  updatedChannels.forEach((ch, i) => {
    mixer.value.setChannelGain(i, ch.muted ? 0 : ch.gain);
    mixer.value.setChannelPan(i, ch.pan);
  });
};

const savePreset = async () => {
  if (!presetName.value || !wsRef.value) return;

  const preset = {
    name: presetName.value,
    faders: channels.value.map(ch => ch.gain),
    pans: channels.value.map(ch => ch.pan),
    mutes: channels.value.map(ch => ch.muted),
  };

  wsRef.value.send(JSON.stringify({
    type: 'savePreset',
    ...preset,
  }));
};

// Channel controls
const handleFaderChange = (channelIndex, value) => {
  const updatedChannels = [...channels.value];
  updatedChannels[channelIndex].gain = value;
  channels.value = updatedChannels;

  if (mixer.value && !updatedChannels[channelIndex].muted) {
    mixer.value.setChannelGain(channelIndex, value);
  }
};

const handlePanChange = (channelIndex, value) => {
  const updatedChannels = [...channels.value];
  updatedChannels[channelIndex].pan = value;
  channels.value = updatedChannels;

  if (mixer.value) {
    mixer.value.setChannelPan(channelIndex, value);
  }
};

const handleMuteToggle = (channelIndex) => {
  const updatedChannels = [...channels.value];
  updatedChannels[channelIndex].muted = !updatedChannels[channelIndex].muted;
  channels.value = updatedChannels;

  if (mixer.value) {
    mixer.value.setChannelMute(channelIndex, updatedChannels[channelIndex].muted);
  }
};

const handleSoloToggle = (channelIndex) => {
  const updatedChannels = channels.value.map((ch, i) => ({
    ...ch,
    solo: i === channelIndex ? !ch.solo : false,
  }));

  const anySolo = updatedChannels.some(ch => ch.solo);

  // Apply mute states based on solo
  updatedChannels.forEach((ch, i) => {
    if (anySolo) {
      ch.muted = !ch.solo;
    }
  });

  channels.value = updatedChannels;

  // Apply to audio engine
  updatedChannels.forEach((ch, i) => {
    if (mixer.value) {
      const shouldMute = anySolo ? !ch.solo : ch.muted;
      mixer.value.setChannelMute(i, shouldMute);
    }
  });
};

// Add next disabled channel
const addChannel = () => {
  const nextDisabledIndex = channels.value.findIndex(ch => !ch.enabled);
  if (nextDisabledIndex === -1) return; // No more channels to add
  
  const updatedChannels = [...channels.value];
  updatedChannels[nextDisabledIndex].enabled = true;
  updatedChannels[nextDisabledIndex].muted = false; // Unmute when adding
  
  channels.value = updatedChannels;
  
  // Apply to audio engine
  if (mixer.value) {
    mixer.value.setChannelGain(nextDisabledIndex, updatedChannels[nextDisabledIndex].gain);
    mixer.value.setChannelPan(nextDisabledIndex, updatedChannels[nextDisabledIndex].pan);
  }
};

// Source registration
const registerAsSource = async () => {
  if (!wsRef.value || wsRef.value.readyState !== WebSocket.OPEN) {
    sourceRegistrationError.value = 'Not connected to server';
    return;
  }

  sourceRegistrationError.value = '';
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      sourceRegistrationError.value = 'Not authenticated. Please sign in first.';
      return;
    }

    wsRef.value.send(JSON.stringify({
      type: 'registerSource',
      token: session.access_token,
    }));
    
    console.log('📤 Sent source registration request');
  } catch (error) {
    console.error('Error registering as source:', error);
    sourceRegistrationError.value = error.message || 'Failed to register as source';
  }
};

const unregisterAsSource = async () => {
  // Stop audio capture first
  stopCapture();
  
  if (!wsRef.value || wsRef.value.readyState !== WebSocket.OPEN) {
    // If not connected, just reset state
    isSource.value = false;
    hasSource.value = false;
    sourceRegistrationError.value = '';
    return;
  }
  
  try {
    // Get access token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      sourceRegistrationError.value = 'Not authenticated. Please sign in first.';
      return;
    }
    
    // Send unregister message to server
    wsRef.value.send(JSON.stringify({
      type: 'unregisterSource',
      token: session.access_token,
    }));
    
    console.log('📤 Sent source unregistration request');
    
    // Reset state immediately (server will confirm)
    isSource.value = false;
    hasSource.value = false;
    sourceRegistrationError.value = '';
  } catch (error) {
    console.error('Error unregistering as source:', error);
    sourceRegistrationError.value = error.message || 'Failed to unregister as source';
  }
};

// Browser audio device management
const loadAudioDevices = async () => {
  deviceLoading.value = true;
  deviceError.value = '';
  
  try {
    const devices = await enumerateDevices();
    console.log(`✅ Loaded ${devices.length} browser audio devices`);
    deviceError.value = '';
  } catch (error) {
    console.error('Error loading audio devices:', error);
    deviceError.value = error.message || 'Failed to load audio devices. Check browser permissions.';
  } finally {
    deviceLoading.value = false;
  }
};

const refreshDevices = async () => {
  await loadAudioDevices();
};

// Update buffer size
const updateBufferSize = () => {
  if (mixer.value && bufferSizeMs.value) {
    mixer.value.setBufferSize(bufferSizeMs.value);
  }
};

// Update latency periodically
watch(() => mixer.value, (newMixer) => {
  if (newMixer) {
    // Set initial buffer size
    updateBufferSize();
    
    const updateLatency = () => {
      if (newMixer) {
        latency.value = newMixer.getLatency();
        requestAnimationFrame(updateLatency);
      }
    };
    updateLatency();
  }
});
</script>

<style scoped>
.dante-monitor-mixer {
  min-height: 100vh;
  background: var(--bg-primary, #ffffff);
  padding: 2rem;
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .dante-monitor-mixer {
    background: var(--bg-primary, #1f2937);
    color: var(--text-primary, #f9fafb);
  }
}

.mixer-container {
  max-width: 1400px;
  margin: 0 auto;
}

.mixer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .mixer-header {
    border-bottom-color: var(--border-light, #4b5563);
  }
}

.mixer-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .mixer-title {
    color: var(--text-primary, #f9fafb);
  }
}

.status-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.status-indicator {
  font-weight: 600;
  font-size: 0.875rem;
}

.status-indicator.connected {
  color: #10b981;
}

.status-indicator.disconnected {
  color: #ef4444;
}

.latency-info {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

@media (prefers-color-scheme: dark) {
  .latency-info {
    color: var(--text-secondary, #9ca3af);
  }
}

.auth-section {
  max-width: 400px;
  margin: 4rem auto;
  padding: 2rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
}

.auth-section h3 {
  margin: 0 0 1.5rem 0;
  color: var(--text-primary, #1f2937);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .form-input {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
    color: var(--text-primary, #f9fafb);
  }
}

.error-message {
  margin-top: 1rem;
  color: #ef4444;
  font-size: 0.875rem;
}

.connection-error {
  margin-top: 1rem;
  padding: 1rem;
  background: #fee2e2;
  border: 1px solid #ef4444;
  border-radius: 4px;
  color: #991b1b;
}

.connection-error p {
  margin: 0.5rem 0;
}

.error-hint {
  font-size: 0.875rem;
  color: #7f1d1d;
  font-family: monospace;
}

.debug-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f3f4f6);
  border: 1px solid var(--border-light, #d1d5db);
  border-radius: 6px;
}

@media (prefers-color-scheme: dark) {
  .debug-panel {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
  }
}

.debug-content {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .debug-content {
    background: var(--bg-primary, #1f2937);
    border-color: var(--border-light, #4b5563);
    color: var(--text-primary, #f9fafb);
  }
}

.debug-content h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: var(--text-primary, #1f2937);
}

.debug-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.debug-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.debug-section ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
}

.debug-section li {
  margin: 0.25rem 0;
  font-family: monospace;
  font-size: 0.8125rem;
}

.mixer-interface {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.tab-navigation {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid var(--border-light, #e2e8f0);
  margin-bottom: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  .tab-navigation {
    border-bottom-color: var(--border-light, #4b5563);
  }
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.tab-button:hover {
  color: var(--text-primary, #1f2937);
  background: var(--bg-secondary, #f8f9fa);
}

.tab-button.active {
  color: var(--primary, #3b82f6);
  border-bottom-color: var(--primary, #3b82f6);
  background: transparent;
}

@media (prefers-color-scheme: dark) {
  .tab-button {
    color: var(--text-secondary, #9ca3af);
  }
  
  .tab-button:hover {
    color: var(--text-primary, #f9fafb);
    background: var(--bg-secondary, #374151);
  }
  
  .tab-button.active {
    color: var(--primary, #60a5fa);
    border-bottom-color: var(--primary, #60a5fa);
  }
}

.tab-content {
  min-height: 400px;
}

.source-tab,
.mixer-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.streaming-indicator {
  padding: 1rem;
  background: #f0fdf4;
  border: 2px solid #10b981;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.streaming-badge {
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
}

.streaming-info {
  color: #065f46;
  font-size: 0.875rem;
  flex: 1;
}

.buffering-indicator {
  padding: 1.5rem;
  background: var(--bg-secondary, #fef3c7);
  border: 2px solid var(--border-warning, #f59e0b);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.buffering-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.buffering-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(245, 158, 11, 0.2);
  border-top-color: #f59e0b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.buffering-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.buffering-badge {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary, #92400e);
}

.buffering-info {
  color: var(--text-secondary, #78350f);
  font-size: 0.8125rem;
}

.buffering-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.buffering-progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(245, 158, 11, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.buffering-progress-fill {
  height: 100%;
  background: #f59e0b;
  transition: width 0.3s ease;
}

.buffering-progress-text {
  font-size: 0.75rem;
  color: var(--text-secondary, #78350f);
  font-family: monospace;
}

.buffer-settings {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8f9fa);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 6px;
}

.buffer-settings-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-primary, white);
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 4px;
}

.buffer-settings-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.buffer-size-input {
  padding: 0.5rem;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1f2937);
  width: 150px;
}

.buffer-size-hint {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: normal;
}

.buffer-settings-info {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

@media (prefers-color-scheme: dark) {
  .buffer-settings {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
  }
  
  .buffer-settings-panel {
    background: var(--bg-primary, #1f2937);
    border-color: var(--border-light, #4b5563);
  }
  
  .buffer-settings-label {
    color: var(--text-primary, #f9fafb);
  }
  
  .buffer-size-input {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
    color: var(--text-primary, #f9fafb);
  }
  
  .buffer-size-hint,
  .buffer-settings-info {
    color: var(--text-secondary, #9ca3af);
  }
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .section-title {
    color: var(--text-primary, #f9fafb);
    border-bottom-color: var(--border-light, #4b5563);
  }
}

.source-setup-section {
  padding: 2rem;
  background: var(--bg-primary, white);
  border-radius: 12px;
  border: 2px solid var(--border-light, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

@media (prefers-color-scheme: dark) {
  .source-setup-section {
    background: var(--bg-primary, #1f2937);
    border-color: var(--border-light, #4b5563);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}

.source-control-bar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.active-source-status {
  padding: 1.5rem;
  background: #f0fdf4;
  border-radius: 8px;
  border: 2px solid #10b981;
}

.source-status-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-info {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.status-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.active {
  background: #10b981;
  color: white;
}

.status-badge.device {
  background: #e0e7ff;
  color: #4338ca;
}

.listener-mixer-section {
  padding: 1.5rem;
  background: var(--bg-primary, white);
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .listener-mixer-section {
    background: var(--bg-primary, #1f2937);
    border-color: var(--border-light, #4b5563);
  }
}

.no-source-message {
  padding: 2rem;
  text-align: center;
}

.info-card {
  padding: 2rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  color: #92400e;
}

.info-card h3 {
  margin: 0 0 0.75rem 0;
  color: #92400e;
}

.info-card p {
  margin: 0.5rem 0;
  color: #78350f;
}

.source-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .source-controls {
    border-top-color: var(--border-light, #4b5563);
  }
}

.device-selection {
  padding: 1.5rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  border: 1px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .device-selection {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
  }
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-light, #e2e8f0);
}

@media (prefers-color-scheme: dark) {
  .device-header {
    border-bottom-color: var(--border-light, #4b5563);
  }
}

.client-status {
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 2px solid;
}

.client-status.connected {
  color: #065f46;
  background: #d1fae5;
  border-color: #10b981;
}

.client-status.disconnected {
  color: #991b1b;
  background: #fee2e2;
  border-color: #ef4444;
}

@media (prefers-color-scheme: dark) {
  .client-status.connected {
    color: #d1fae5;
    background: #065f46;
    border-color: #10b981;
  }
  
  .client-status.disconnected {
    color: #fee2e2;
    background: #991b1b;
    border-color: #ef4444;
  }
}

.client-setup {
  margin-top: 1rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
}

.setup-instructions {
  margin-top: 0.75rem;
}

.setup-instructions ol {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.setup-instructions code {
  background: #1f2937;
  color: #f9fafb;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.setup-note {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.device-label {
  display: block;
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary, #1f2937);
  margin-bottom: 0;
}

@media (prefers-color-scheme: dark) {
  .device-label {
    color: var(--text-primary, #f9fafb);
  }
}

.device-controls {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
  margin-top: 1rem;
}

.device-select {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid var(--border-light, #e2e8f0);
  border-radius: 6px;
  font-size: 0.9375rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1f2937);
  font-weight: 500;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.device-select:focus {
  outline: none;
  border-color: var(--primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.device-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-color-scheme: dark) {
  .device-select {
    background: var(--bg-primary, #1f2937);
    border-color: var(--border-light, #4b5563);
    color: var(--text-primary, #f9fafb);
  }
  
  .device-select:focus {
    border-color: var(--primary, #60a5fa);
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.info-message {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin: 0.75rem 0 0 0;
  line-height: 1.6;
}

.info-message strong {
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .info-message {
    color: var(--text-secondary, #9ca3af);
  }
  
  .info-message strong {
    color: var(--text-primary, #f9fafb);
  }
}

.electron-app-info {
  margin-top: 1.5rem;
}

.electron-app-message {
  margin: 0;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
  border: 2px solid #3b82f6;
  border-radius: 8px;
  color: white;
  font-size: 0.9375rem;
  line-height: 1.6;
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);
}

.electron-app-message strong {
  color: white;
  font-weight: 700;
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.electron-app-link {
  color: #bfdbfe;
  text-decoration: underline;
  font-weight: 600;
  transition: color 0.2s;
}

.electron-app-link:hover {
  color: white;
  text-decoration: none;
}

@media (prefers-color-scheme: dark) {
  .electron-app-message {
    background: linear-gradient(135deg, #1e3a8a 0%, #1e3a8a 100%);
    border-color: #60a5fa;
    box-shadow: 0 4px 12px rgba(30, 58, 138, 0.4);
  }
  
  .electron-app-link {
    color: #bfdbfe;
  }
  
  .electron-app-link:hover {
    color: white;
  }
}

.source-on-other-device {
  background: #1e40af;
  border: 1px solid #3b82f6;
  padding: 0.75rem;
  border-radius: 4px;
  color: white;
}

.source-on-other-device strong {
  color: white;
}

@media (prefers-color-scheme: dark) {
  .source-on-other-device {
    background: #1e3a8a;
    border-color: #60a5fa;
    color: white;
  }
  
  .source-on-other-device strong {
    color: white;
  }
}

.another-source-active {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  color: #78350f;
}

.another-source-active strong {
  color: #78350f;
}

@media (prefers-color-scheme: dark) {
  .another-source-active {
    background: #92400e;
    border-color: #f59e0b;
    color: white;
  }
  
  .another-source-active strong {
    color: white;
  }
}

.source-badge,
.listener-badge,
.no-source-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
}

.source-badge {
  background: #10b981;
  color: white;
}

.listener-badge {
  background: #3b82f6;
  color: white;
}

.no-source-badge {
  background: #f59e0b;
  color: white;
}

.preset-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.preset-select {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-light, #e2e8f0);
  border-radius: 4px;
  font-size: 1rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .preset-select {
    background: var(--bg-secondary, #374151);
    border-color: var(--border-light, #4b5563);
    color: var(--text-primary, #f9fafb);
  }
}

.btn {
  padding: 0.875rem 1.75rem;
  border: 2px solid transparent;
  font-weight: 600;
  font-size: 0.9375rem;
  transition: all 0.2s;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-color: #2563eb;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.btn-positive {
  background: #10b981;
  color: white;
}

.btn-positive:hover:not(:disabled) {
  background: #059669;
}

.btn-secondary {
  background: #6b7280;
  color: white;
  border-color: #4b5563;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
  border-color: #374151;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.btn-secondary:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.add-channel-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--bg-secondary, #f8f9fa);
  border: 2px dashed var(--border-light, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
  min-height: 200px;
  color: var(--text-secondary, #6b7280);
}

.add-channel-btn:hover:not(:disabled) {
  background: var(--bg-dark, #e5e7eb);
  border-color: var(--primary, #3b82f6);
  color: var(--primary, #3b82f6);
}

.add-channel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-icon {
  font-size: 2.5rem;
  font-weight: 300;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.add-label {
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary, white);
  padding: 2rem;
  border-radius: 8px;
  min-width: 300px;
  color: var(--text-primary, #1f2937);
}

@media (prefers-color-scheme: dark) {
  .modal-content {
    background: var(--bg-primary, #1f2937);
    color: var(--text-primary, #f9fafb);
  }
}

.modal-content h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary, #1f2937);
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .dante-monitor-mixer {
    padding: 1rem;
  }

  .mixer-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .channels-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
  }
}
</style>

