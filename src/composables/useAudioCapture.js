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
      
      // Ensure we have a valid channel count (at least 1, default to 2 for stereo)
      let actualChannelCount = settings.channelCount;
      if (!actualChannelCount || actualChannelCount < 1) {
        // Try to get channel count from constraints or default to 2
        actualChannelCount = 2;
      }
      const actualSampleRate = settings.sampleRate || audioContext.value.sampleRate;
      
      console.log('🎤 Audio stream settings:', {
        deviceId: settings.deviceId,
        channelCount: actualChannelCount,
        sampleRate: actualSampleRate,
        requestedChannels: channelCount,
        settings: settings,
      });
      
      // Note: Most browsers only support stereo (2 channels) via getUserMedia
      // For multi-channel devices like Dante Virtual Soundcard, you may need:
      // 1. A browser extension that provides multi-channel access
      // 2. Or use the local client.js for full multi-channel support
      // For now, we'll capture what's available (typically 1-2 channels)
      
      // Create media stream source
      mediaStreamSource.value = audioContext.value.createMediaStreamSource(mediaStream.value);
      
      // Determine the actual number of channels available from the source
      // The MediaStreamSource might have a different channel count than what we requested
      const sourceChannelCount = mediaStreamSource.value.channelCount || actualChannelCount;
      const finalChannelCount = Math.max(1, Math.min(sourceChannelCount, actualChannelCount));
      
      console.log('📊 Channel configuration:', {
        requested: channelCount,
        settingsChannelCount: actualChannelCount,
        sourceChannelCount: sourceChannelCount,
        finalChannelCount: finalChannelCount,
      });
      
      // Create script processor to capture audio data
      // Buffer size: 256 samples for low latency
      // Note: ScriptProcessorNode requires at least 1 output channel to connect to destination
      // We use 1 output channel (mono) even though we don't need it - it's required for the node to work
      // Input channels: use the actual available channels (at least 1)
      // Output channels: use 1 (required for connection, but we'll silence it)
      const bufferSize = 256;
      const inputChannels = Math.max(1, finalChannelCount);
      const outputChannels = 1; // Always 1 - we don't need output, just capture
      
      console.log(`Creating ScriptProcessorNode: ${inputChannels} input channels, ${outputChannels} output channel`);
      scriptProcessor.value = audioContext.value.createScriptProcessor(bufferSize, inputChannels, outputChannels);
      
      scriptProcessor.value.onaudioprocess = (e) => {
        // Re-check WebSocket connection
        const currentWs = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
          return;
        }
        
        // Process each input channel
        const inputChannelData = [];
        const availableInputChannels = e.inputBuffer.numberOfChannels;
        
        for (let ch = 0; ch < availableInputChannels; ch++) {
          try {
            const inputData = e.inputBuffer.getChannelData(ch);
            // Convert Float32Array to regular array for JSON serialization
            const samples = Array.from(inputData);
            inputChannelData.push(samples);
          } catch (error) {
            console.warn(`Error reading channel ${ch}:`, error);
          }
        }
        
        // Send audio data to Railway via WebSocket
        // Send each channel separately for compatibility with existing server
        try {
          const channelsToSend = Math.min(availableInputChannels, channelCount);
          for (let ch = 0; ch < channelsToSend; ch++) {
            if (inputChannelData[ch]) {
              currentWs.send(JSON.stringify({
                type: 'audio',
                channel: ch,
                data: inputChannelData[ch],
                sampleRate: audioContext.value.sampleRate,
              }));
            }
          }
        } catch (error) {
          console.error('Error sending audio data:', error);
          captureError.value = 'Failed to send audio data';
        }
        
        // Clear the output buffer (we don't need to output anything, just capture)
        // This prevents any audio from being played back
        try {
          const outputChannels = e.outputBuffer.numberOfChannels;
          for (let ch = 0; ch < outputChannels; ch++) {
            const outputData = e.outputBuffer.getChannelData(ch);
            outputData.fill(0);
          }
        } catch (error) {
          console.warn('Error clearing output buffer:', error);
        }
      };
      
      // Connect: mediaStreamSource -> scriptProcessor -> destination
      // Note: ScriptProcessorNode must be connected to destination to work, even if output is silent
      mediaStreamSource.value.connect(scriptProcessor.value);
      scriptProcessor.value.connect(audioContext.value.destination);
      
      isCapturing.value = true;
      console.log(`✅ Audio capture started: ${inputChannels} input channels, ${outputChannels} output channel @ ${audioContext.value.sampleRate}Hz`);
      
      if (finalChannelCount < channelCount) {
        console.warn(`⚠️ Device only provides ${finalChannelCount} channels, but ${channelCount} were requested.`);
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

