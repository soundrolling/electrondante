// Browser Audio Capture Composable
// Captures audio from browser-accessible devices and streams to WebSocket

import { ref, onBeforeUnmount } from 'vue';

export function useAudioCapture(wsRef, channelCount = 32, sampleRate = 48000, isSourceRef = null) {
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
    console.log('🔍 [AUDIO CAPTURE] Starting device enumeration...');
    try {
      console.log('🔍 [AUDIO CAPTURE] Requesting microphone permission...');
      // Request permission first (required for device labels)
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ [AUDIO CAPTURE] Microphone permission granted');
      
      console.log('🔍 [AUDIO CAPTURE] Enumerating devices...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(`📋 [AUDIO CAPTURE] Found ${devices.length} total devices`);
      
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
        }));
      
      console.log(`✅ [AUDIO CAPTURE] Found ${audioInputs.length} audio input devices:`, audioInputs);
      availableDevices.value = audioInputs;
      return audioInputs;
    } catch (error) {
      console.error('❌ [AUDIO CAPTURE] Error enumerating devices:', error);
      console.error('❌ [AUDIO CAPTURE] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      captureError.value = `Failed to enumerate devices: ${error.name} - ${error.message}`;
      return [];
    }
  };
  
  // Start capturing audio from selected device
  const startCapture = async (deviceId = null) => {
    console.log('🎤 [AUDIO CAPTURE] Starting capture...', { deviceId, isCapturing: isCapturing.value });
    
    if (isCapturing.value) {
      console.warn('⚠️ [AUDIO CAPTURE] Already capturing audio, skipping');
      captureError.value = 'Already capturing audio';
      return;
    }
    
    // Access wsRef value (it's a ref)
    const ws = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
    console.log('🔌 [AUDIO CAPTURE] WebSocket check:', {
      wsExists: !!ws,
      readyState: ws ? ws.readyState : 'N/A',
      readyStateNames: { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' },
    });
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const errorMsg = `WebSocket not connected (state: ${ws ? ws.readyState : 'null'})`;
      console.error('❌ [AUDIO CAPTURE]', errorMsg);
      captureError.value = errorMsg;
      throw new Error(errorMsg);
    }
    
    try {
      console.log('🧹 [AUDIO CAPTURE] Clearing previous errors');
      captureError.value = '';
      
      // Create audio context
      console.log('🎵 [AUDIO CAPTURE] Creating AudioContext...', { sampleRate, latencyHint: 'interactive' });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext.value = new AudioContextClass({
        sampleRate: sampleRate,
        latencyHint: 'interactive',
      });
      console.log('✅ [AUDIO CAPTURE] AudioContext created:', {
        state: audioContext.value.state,
        sampleRate: audioContext.value.sampleRate,
        baseLatency: audioContext.value.baseLatency,
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
      
      console.log('📡 [AUDIO CAPTURE] Requesting media stream with constraints:', JSON.stringify(constraints, null, 2));
      mediaStream.value = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ [AUDIO CAPTURE] Media stream obtained:', {
        id: mediaStream.value.id,
        active: mediaStream.value.active,
        audioTracks: mediaStream.value.getAudioTracks().length,
      });
      
      // Get stream settings to determine actual channel count
      const audioTrack = mediaStream.value.getAudioTracks()[0];
      console.log('🎵 [AUDIO CAPTURE] Audio track:', {
        id: audioTrack.id,
        kind: audioTrack.kind,
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
      });
      
      const settings = audioTrack.getSettings();
      console.log('⚙️ [AUDIO CAPTURE] Track settings:', settings);
      
      // Ensure we have a valid channel count (at least 1, default to 2 for stereo)
      let actualChannelCount = settings.channelCount;
      if (!actualChannelCount || actualChannelCount < 1) {
        console.warn('⚠️ [AUDIO CAPTURE] No channel count in settings, defaulting to 2');
        actualChannelCount = 2;
      }
      const actualSampleRate = settings.sampleRate || audioContext.value.sampleRate;
      
      console.log('🎤 [AUDIO CAPTURE] Audio stream settings:', {
        deviceId: settings.deviceId,
        channelCount: actualChannelCount,
        sampleRate: actualSampleRate,
        requestedChannels: channelCount,
        allSettings: settings,
      });
      
      // Browser limitation warning
      if (actualChannelCount < channelCount) {
        console.warn(`⚠️ [AUDIO CAPTURE] Browser only provides ${actualChannelCount} channel(s), but ${channelCount} were requested.`);
        console.warn(`⚠️ [AUDIO CAPTURE] Channel mapping: Browser channels 0-${actualChannelCount - 1} will map to Dante channels 0-${actualChannelCount - 1}.`);
        console.warn(`⚠️ [AUDIO CAPTURE] Dante channels ${actualChannelCount}-${channelCount - 1} will have no audio (browser limitation).`);
        console.warn(`⚠️ [AUDIO CAPTURE] For full multi-channel support (1-to-1 mapping with all Dante channels), use the Electron app.`);
      } else {
        console.log(`✅ [AUDIO CAPTURE] Full channel support: ${actualChannelCount} channels available. Channel mapping: 1-to-1 (Dante channel 0 → Mixer channel 0, etc.)`);
      }
      
      // Note: Most browsers only support stereo (2 channels) via getUserMedia
      // For multi-channel devices like Dante Virtual Soundcard, you may need:
      // 1. A browser extension that provides multi-channel access
      // 2. Or use the Electron app for full multi-channel support
      // For now, we'll capture what's available (typically 1-2 channels)
      
      // Create media stream source
      console.log('🔗 [AUDIO CAPTURE] Creating MediaStreamSource...');
      mediaStreamSource.value = audioContext.value.createMediaStreamSource(mediaStream.value);
      console.log('✅ [AUDIO CAPTURE] MediaStreamSource created:', {
        channelCount: mediaStreamSource.value.channelCount,
        channelCountMode: mediaStreamSource.value.channelCountMode,
        channelInterpretation: mediaStreamSource.value.channelInterpretation,
        numberOfInputs: mediaStreamSource.value.numberOfInputs,
        numberOfOutputs: mediaStreamSource.value.numberOfOutputs,
      });
      
      // Determine the actual number of channels available from the source
      // The MediaStreamSource might have a different channel count than what we requested
      const sourceChannelCount = mediaStreamSource.value.channelCount || actualChannelCount;
      const finalChannelCount = Math.max(1, Math.min(sourceChannelCount, actualChannelCount));
      
      console.log('📊 [AUDIO CAPTURE] Channel configuration:', {
        requested: channelCount,
        settingsChannelCount: actualChannelCount,
        sourceChannelCount: sourceChannelCount,
        finalChannelCount: finalChannelCount,
      });
      
      // Create script processor to capture audio data
      // Buffer size: 4096 samples for better quality (higher latency but better quality)
      // At 48kHz: 4096 samples = ~85ms latency
      // Note: ScriptProcessorNode requires at least 1 output channel to connect to destination
      // We use 1 output channel (mono) even though we don't need it - it's required for the node to work
      // Input channels: use the actual available channels (at least 1)
      // Output channels: use 1 (required for connection, but we'll silence it)
      const bufferSize = 4096; // Increased from 256 for better quality
      const inputChannels = Math.max(1, finalChannelCount);
      const outputChannels = 1; // Always 1 - we don't need output, just capture
      
      const bufferLatencyMs = (bufferSize / audioContext.value.sampleRate) * 1000;
      console.log(`🔧 [AUDIO CAPTURE] Creating ScriptProcessorNode:`, {
        bufferSize,
        inputChannels,
        outputChannels,
        sampleRate: audioContext.value.sampleRate,
        bufferLatencyMs: bufferLatencyMs.toFixed(1),
      });
      
      try {
        scriptProcessor.value = audioContext.value.createScriptProcessor(bufferSize, inputChannels, outputChannels);
        console.log('✅ [AUDIO CAPTURE] ScriptProcessorNode created successfully');
      } catch (error) {
        console.error('❌ [AUDIO CAPTURE] Failed to create ScriptProcessorNode:', error);
        throw new Error(`Failed to create ScriptProcessorNode: ${error.message}`);
      }
      
      let audioProcessCount = 0;
      let audioBufferQueue = []; // Queue to batch audio before sending
      let sequenceNumber = 0; // Sequence number for packet ordering
      const BATCH_SIZE = 4; // Send every 4 buffers (reduces WebSocket overhead)
      const _channelSendCount = {}; // Track send count per channel (closure variable, not this._channelSendCount)
      const effectiveLatencyMs = bufferLatencyMs * BATCH_SIZE;
      
      // Update stream latency
      streamLatency.value = effectiveLatencyMs;
      
      scriptProcessor.value.onaudioprocess = (e) => {
        audioProcessCount++;
        if (audioProcessCount === 1) {
          console.log('🎵 [AUDIO CAPTURE] First audio buffer received:', {
            inputChannels: e.inputBuffer.numberOfChannels,
            inputLength: e.inputBuffer.length,
            outputChannels: e.outputBuffer.numberOfChannels,
            outputLength: e.outputBuffer.length,
            sampleRate: e.inputBuffer.sampleRate,
            bufferLatencyMs: bufferLatencyMs.toFixed(1),
            batchSize: BATCH_SIZE,
            effectiveLatencyMs: (bufferLatencyMs * BATCH_SIZE).toFixed(1),
          });
        }
        
        // Re-check WebSocket connection and source registration
        const currentWs = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
          if (audioProcessCount === 1 || audioProcessCount % 100 === 0) {
            console.warn(`⚠️ [AUDIO CAPTURE] WebSocket not connected (buffer #${audioProcessCount}), skipping audio send. WS exists: ${!!currentWs}, readyState: ${currentWs ? currentWs.readyState : 'N/A'}`);
          }
          return;
        }
        
        // Check if we're registered as source (if isSourceRef is provided)
        const isSource = isSourceRef ? (typeof isSourceRef === 'function' ? isSourceRef() : (isSourceRef?.value ?? false)) : true;
        if (!isSource) {
          // Not registered as source - stop sending audio
          if (audioProcessCount === 1 || audioProcessCount % 100 === 0) {
            console.warn(`⚠️ [AUDIO CAPTURE] Not registered as source (buffer #${audioProcessCount}), stopping capture. isSourceRef: ${!!isSourceRef}, isSource value: ${isSource}`);
          }
          if (audioProcessCount === 1) {
            stopCapture();
          }
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
            console.error(`❌ [AUDIO CAPTURE] Error reading channel ${ch}:`, error);
          }
        }
        
        // Add to batch queue
        audioBufferQueue.push({
          channels: inputChannelData,
          timestamp: Date.now(),
        });
        
        // Send batched audio data when queue reaches batch size
        if (audioBufferQueue.length >= BATCH_SIZE) {
          try {
            const channelsToSend = Math.min(availableInputChannels, channelCount);
            const batch = audioBufferQueue.splice(0, BATCH_SIZE); // Remove from queue
            
            // Log batch info for first few batches
            if (audioProcessCount <= BATCH_SIZE * 3 || audioProcessCount % 200 === 0) {
              console.log(`📦 [AUDIO CAPTURE] Processing batch (buffer #${audioProcessCount}): ${batch.length} buffers, ${channelsToSend} channels to send, available: ${availableInputChannels}, requested: ${channelCount}`);
            }
            
            // Combine all buffers in batch for each channel
            for (let ch = 0; ch < channelsToSend; ch++) {
              const combinedSamples = [];
              for (const buffer of batch) {
                if (buffer.channels[ch]) {
                  combinedSamples.push(...buffer.channels[ch]);
                }
              }
              
              if (combinedSamples.length > 0) {
                // Log first few sends per channel for debugging
                if (!_channelSendCount[ch]) _channelSendCount[ch] = 0;
                _channelSendCount[ch]++;
                
                if (_channelSendCount[ch] <= 3 || _channelSendCount[ch] % 100 === 0) {
                  console.log(`📤 [AUDIO CAPTURE] Sending audio for channel ${ch}: ${combinedSamples.length} samples (packet #${_channelSendCount[ch]})`);
                }
                
                currentWs.send(JSON.stringify({
                  type: 'audio',
                  channel: ch,
                  data: combinedSamples,
                  encoding: 'pcm', // Indicate PCM encoding
                  sampleRate: audioContext.value.sampleRate,
                  bufferCount: batch.length,
                  timestamp: batch[0].timestamp, // Use first buffer's timestamp
                  sequence: sequenceNumber, // Add sequence number for jitter buffering
                }));
              } else {
                console.warn(`⚠️ [AUDIO CAPTURE] Channel ${ch} has no samples to send (combinedSamples.length = 0)`);
              }
            }
            
            // Increment sequence number after sending all channels
            sequenceNumber++;
            
            if (audioProcessCount % 50 === 0) {
              const effectiveLatency = (bufferLatencyMs * BATCH_SIZE).toFixed(1);
              console.log(`📤 [AUDIO CAPTURE] Sent ${audioProcessCount} buffers (batched: ${BATCH_SIZE} buffers, ~${effectiveLatency}ms latency)`);
            }
          } catch (error) {
            console.error('❌ [AUDIO CAPTURE] Error sending audio data:', error);
            captureError.value = `Failed to send audio data: ${error.message}`;
            // Clear queue on error to prevent buildup
            audioBufferQueue = [];
          }
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
          console.warn('⚠️ [AUDIO CAPTURE] Error clearing output buffer:', error);
        }
      };
      
      // Connect: mediaStreamSource -> scriptProcessor -> destination
      // Note: ScriptProcessorNode must be connected to destination to work, even if output is silent
      console.log('🔗 [AUDIO CAPTURE] Connecting audio nodes...');
      try {
        mediaStreamSource.value.connect(scriptProcessor.value);
        console.log('✅ [AUDIO CAPTURE] MediaStreamSource connected to ScriptProcessor');
        
        scriptProcessor.value.connect(audioContext.value.destination);
        console.log('✅ [AUDIO CAPTURE] ScriptProcessor connected to destination');
      } catch (error) {
        console.error('❌ [AUDIO CAPTURE] Error connecting audio nodes:', error);
        throw new Error(`Failed to connect audio nodes: ${error.message}`);
      }
      
      isCapturing.value = true;
      console.log(`✅ Audio capture started: ${inputChannels} input channels, ${outputChannels} output channel @ ${audioContext.value.sampleRate}Hz`);
      
      if (finalChannelCount < channelCount) {
        console.warn(`⚠️ Device only provides ${finalChannelCount} channels, but ${channelCount} were requested.`);
        console.warn('For multi-channel devices like Dante Virtual Soundcard, consider using the local client.js for full support.');
      }
      
    } catch (error) {
      console.error('❌ [AUDIO CAPTURE] Error starting audio capture:', error);
      console.error('❌ [AUDIO CAPTURE] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        constraint: error.constraint,
      });
      const errorMsg = `Failed to start capture: ${error.name} - ${error.message}`;
      captureError.value = errorMsg;
      stopCapture();
      throw new Error(errorMsg);
    }
  };
  
  // Stop capturing audio
  const stopCapture = () => {
    console.log('🛑 [AUDIO CAPTURE] Stopping capture...');
    
    if (scriptProcessor.value) {
      try {
        console.log('🔌 [AUDIO CAPTURE] Disconnecting ScriptProcessor...');
        scriptProcessor.value.disconnect();
        console.log('✅ [AUDIO CAPTURE] ScriptProcessor disconnected');
      } catch (e) {
        console.warn('⚠️ [AUDIO CAPTURE] Error disconnecting script processor:', e);
      }
      scriptProcessor.value = null;
    }
    
    if (mediaStreamSource.value) {
      try {
        console.log('🔌 [AUDIO CAPTURE] Disconnecting MediaStreamSource...');
        mediaStreamSource.value.disconnect();
        console.log('✅ [AUDIO CAPTURE] MediaStreamSource disconnected');
      } catch (e) {
        console.warn('⚠️ [AUDIO CAPTURE] Error disconnecting media stream source:', e);
      }
      mediaStreamSource.value = null;
    }
    
    if (mediaStream.value) {
      console.log('🛑 [AUDIO CAPTURE] Stopping media stream tracks...');
      mediaStream.value.getTracks().forEach((track, index) => {
        console.log(`🛑 [AUDIO CAPTURE] Stopping track ${index}:`, track.label || track.id);
        track.stop();
      });
      mediaStream.value = null;
    }
    
    if (audioContext.value) {
      console.log('🔌 [AUDIO CAPTURE] Closing AudioContext...');
      audioContext.value.close().catch(e => {
        console.warn('⚠️ [AUDIO CAPTURE] Error closing audio context:', e);
      });
      audioContext.value = null;
    }
    
    isCapturing.value = false;
    console.log('✅ [AUDIO CAPTURE] Capture stopped completely');
  };
  
  // Cleanup on unmount
  onBeforeUnmount(() => {
    stopCapture();
  });
  
  // Calculate stream latency based on buffer size and batch size
  const calculateStreamLatency = (bufferSize, batchSize, sampleRate) => {
    const bufferLatencyMs = (bufferSize / sampleRate) * 1000;
    return bufferLatencyMs * batchSize;
  };
  
  const streamLatency = ref(calculateStreamLatency(4096, 4, sampleRate)); // Default values
  
  return {
    isCapturing,
    captureError,
    availableDevices,
    selectedDeviceId,
    streamLatency,
    enumerateDevices,
    startCapture,
    stopCapture,
  };
}

