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
          <span class="latency-info">Latency: {{ latency.toFixed(1) }}ms</span>
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
import { useDanteMixer } from '@/composables/useDanteMixer';
import DanteChannelStrip from './DanteChannelStrip.vue';

const router = useRouter();

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
const connectionError = ref('');

// Mixer state
const channels = ref([]);
const presets = ref([]);
const selectedPresetId = ref('');
const showSavePresetModal = ref(false);
const presetName = ref('');

// Audio engine - support up to 32 channels
const { mixer, peakLevels, peakHolds } = useDanteMixer(32, 48000);

// Computed: only show enabled channels
const enabledChannels = computed(() => {
  return channels.value.filter(ch => ch.enabled);
});

// WebSocket URL from environment
const wsUrl = computed(() => {
  let url = process.env.VUE_APP_BRIDGE_WS_URL || 'ws://localhost:3001';
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
});

// Check authentication on mount
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    authenticated.value = true;
    connectWebSocket();
    loadPresets();
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    authenticated.value = !!session?.user;
    if (authenticated.value) {
      connectWebSocket();
      loadPresets();
    } else {
      disconnectWebSocket();
    }
  });
});

onBeforeUnmount(() => {
  disconnectWebSocket();
  if (mixer.value) {
    mixer.value.stop();
  }
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
    
    console.log(`🔌 Attempting WebSocket connection to: ${url}`);
    const ws = new WebSocket(url);
    wsRef.value = ws;

    ws.onopen = async () => {
      console.log('Connected to bridge server');
      connected.value = true;
      connectionError.value = ''; // Clear any previous errors

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
      console.log('Disconnected from bridge server', event.code, event.reason);
      connected.value = false;
      if (event.code !== 1000) { // Not a normal closure
        connectionError.value = `Connection closed (code: ${event.code}). Retrying...`;
      }
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
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
  if (wsRef.value) {
    wsRef.value.close();
    wsRef.value = null;
  }
};

const handleServerMessage = (message) => {
  switch (message.type) {
    case 'config':
      // Config is now handled in ws.onmessage directly
      console.log('Config message already handled');
      break;

    case 'audio':
      // Receive audio data for a channel
      if (mixer.value) {
        mixer.value.addChannelData(message.channel, message.data);
      }
      break;

    case 'preset':
      // Load preset settings
      applyPreset(message.data);
      break;

    case 'authenticated':
      console.log('Authenticated with server');
      loadPresets();
      break;

    case 'presetSaved':
      loadPresets();
      showSavePresetModal.value = false;
      presetName.value = '';
      break;

    case 'error':
      console.error('Server error:', message.message);
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

// Update latency periodically
watch(() => mixer.value, (newMixer) => {
  if (newMixer) {
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

.mixer-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  margin: 0;
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

.mixer-interface {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  background: white;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
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
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
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
  background: white;
  padding: 2rem;
  border-radius: 8px;
  min-width: 300px;
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

