// Browser Audio Capture Composable
// Captures audio from browser-accessible devices and streams to WebSocket

import { ref, onBeforeUnmount } from 'vue';

export function useAudioCapture(wsRef, channelCount = 32, sampleRate = 48000) {
  const audioContext = ref(null);
  const mediaStream = ref(null);
  const mediaStreamSource = ref(null);
  const scriptProcessor = ref(null);
  const isCapturing = ref(false);
  const captureError = ref('');
  const availableDevices = ref([]);
  const selectedDeviceId = ref('');
  
  // Enumerate available audio input devices
  const enumerateDevices = async () => {
    try {
      // Request permission first (required for device labels)
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
        }));
      
      availableDevices.value = audioInputs;
      console.log(`✅ Found ${audioInputs.length} audio input devices`);
      return audioInputs;
    } catch (error) {
      console.error('Error enumerating devices:', error);
      captureError.value = `Failed to enumerate devices: ${error.message}`;
      return [];
    }
  };
  
  // Start capturing audio from selected device
  const startCapture = async (deviceId = null) => {
    if (isCapturing.value) {
      console.warn('Already capturing audio');
      return;
    }
    
    // Access wsRef value (it's a ref)
    const ws = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      captureError.value = 'WebSocket not connected';
      return;
    }
    
    try {
      captureError.value = '';
      
      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext.value = new AudioContextClass({
        sampleRate: sampleRate,
        latencyHint: 'interactive',
      });
      
      // Request audio stream with device selection
      // Try to request multiple channels if supported (up to channelCount)
      const constraints = {
        audio: deviceId 
          ? { 
              deviceId: { exact: deviceId },
              // Try to request multiple channels (browser may limit this)
              channelCount: { ideal: channelCount, max: channelCount },
              sampleRate: { ideal: sampleRate },
            }
          : {
              // Try to request multiple channels even for default device
              channelCount: { ideal: channelCount, max: channelCount },
              sampleRate: { ideal: sampleRate },
            },
      };
      
      mediaStream.value = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Get stream settings to determine actual channel count
      const audioTrack = mediaStream.value.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      const actualChannelCount = settings.channelCount || 2; // Default to stereo
      const actualSampleRate = settings.sampleRate || audioContext.value.sampleRate;
      
      console.log('🎤 Audio stream settings:', {
        deviceId: settings.deviceId,
        channelCount: actualChannelCount,
        sampleRate: actualSampleRate,
        requestedChannels: channelCount,
      });
      
      // Note: Most browsers only support stereo (2 channels) via getUserMedia
      // For multi-channel devices like Dante Virtual Soundcard, you may need:
      // 1. A browser extension that provides multi-channel access
      // 2. Or use the local client.js for full multi-channel support
      // For now, we'll capture what's available (typically 1-2 channels)
      
      // Create media stream source
      mediaStreamSource.value = audioContext.value.createMediaStreamSource(mediaStream.value);
      
      // Create script processor to capture audio data
      // Buffer size: 256 samples for low latency
      const bufferSize = 256;
      scriptProcessor.value = audioContext.value.createScriptProcessor(bufferSize, actualChannelCount, 0);
      
      scriptProcessor.value.onaudioprocess = (e) => {
        // Re-check WebSocket connection
        const currentWs = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
          return;
        }
        
        // Process each input channel
        const inputChannels = [];
        for (let ch = 0; ch < actualChannelCount; ch++) {
          const inputData = e.inputBuffer.getChannelData(ch);
          // Convert Float32Array to regular array for JSON serialization
          const samples = Array.from(inputData);
          inputChannels.push(samples);
        }
        
        // Send audio data to Railway via WebSocket
        // Send each channel separately for compatibility with existing server
        try {
          for (let ch = 0; ch < Math.min(actualChannelCount, channelCount); ch++) {
            currentWs.send(JSON.stringify({
              type: 'audio',
              channel: ch,
              data: inputChannels[ch],
              sampleRate: audioContext.value.sampleRate,
            }));
          }
        } catch (error) {
          console.error('Error sending audio data:', error);
          captureError.value = 'Failed to send audio data';
        }
      };
      
      // Connect: mediaStreamSource -> scriptProcessor -> (no output, just capture)
      mediaStreamSource.value.connect(scriptProcessor.value);
      scriptProcessor.value.connect(audioContext.value.destination); // Must connect to destination to work
      
      isCapturing.value = true;
      console.log(`✅ Audio capture started: ${actualChannelCount} channels @ ${audioContext.value.sampleRate}Hz`);
      
      if (actualChannelCount < channelCount) {
        console.warn(`⚠️ Device only provides ${actualChannelCount} channels, but ${channelCount} were requested.`);
        console.warn('For multi-channel devices like Dante Virtual Soundcard, consider using the local client.js for full support.');
      }
      
    } catch (error) {
      console.error('Error starting audio capture:', error);
      captureError.value = `Failed to start capture: ${error.message}`;
      stopCapture();
    }
  };
  
  // Stop capturing audio
  const stopCapture = () => {
    if (scriptProcessor.value) {
      try {
        scriptProcessor.value.disconnect();
      } catch (e) {
        console.warn('Error disconnecting script processor:', e);
      }
      scriptProcessor.value = null;
    }
    
    if (mediaStreamSource.value) {
      try {
        mediaStreamSource.value.disconnect();
      } catch (e) {
        console.warn('Error disconnecting media stream source:', e);
      }
      mediaStreamSource.value = null;
    }
    
    if (mediaStream.value) {
      mediaStream.value.getTracks().forEach(track => track.stop());
      mediaStream.value = null;
    }
    
    if (audioContext.value) {
      audioContext.value.close().catch(e => {
        console.warn('Error closing audio context:', e);
      });
      audioContext.value = null;
    }
    
    isCapturing.value = false;
    console.log('🛑 Audio capture stopped');
  };
  
  // Cleanup on unmount
  onBeforeUnmount(() => {
    stopCapture();
  });
  
  return {
    isCapturing,
    captureError,
    availableDevices,
    selectedDeviceId,
    enumerateDevices,
    startCapture,
    stopCapture,
  };
}

