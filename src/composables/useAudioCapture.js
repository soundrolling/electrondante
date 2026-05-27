// Browser Audio Capture - multi-device → stereo broadcast bus
// Opens N audio inputs in parallel (e.g. 8x DVS stereo pairs), routes each captured
// channel through gain/pan/send into a stereo broadcast bus, and streams the bus
// over WebSocket as 2-channel PCM using the existing bridge-server message format.

import { ref, reactive, onBeforeUnmount } from 'vue';

const BUFFER_SIZE = 4096;
const BATCH_SIZE = 4;

export function useAudioCapture(wsRef, _legacyChannelCount = 32, sampleRate = 48000, isSourceRef = null) {
  // --- Device discovery state ---
  const availableDevices = ref([]); // [{id, label, groupId}]
  const selectedDeviceIds = ref([]); // ids the user has checked

  // --- Capture state ---
  const isCapturing = ref(false);
  const captureError = ref('');
  const streamLatency = ref((BUFFER_SIZE / sampleRate) * 1000 * BATCH_SIZE);

  // --- Per-channel strip state (reactive list rendered by the UI) ---
  const channels = ref([]); // each entry: { stripId, deviceId, deviceLabel, channelIndex, label, gain, pan, sendToBroadcast, peakDb }

  // --- Broadcast bus meters & master ---
  const broadcastPeakL = ref(-60);
  const broadcastPeakR = ref(-60);
  const broadcastGain = ref(0.8);

  // --- Internal audio graph (non-reactive) ---
  let audioContext = null;
  const deviceStreams = new Map(); // deviceId -> { stream, source, splitter, strips: [{stripId, gainNode, panNode, sendGain, analyser}] }
  let broadcastBus = null;
  let broadcastSplitter = null;
  let broadcastAnalyserL = null;
  let broadcastAnalyserR = null;
  let scriptProc = null;
  let stripCounter = 0;
  let meterRafId = null;

  const peakDbFromAnalyser = (analyser, tmpBuf) => {
    analyser.getFloatTimeDomainData(tmpBuf);
    let max = 0;
    for (let i = 0; i < tmpBuf.length; i++) {
      const a = Math.abs(tmpBuf[i]);
      if (a > max) max = a;
    }
    return max > 0.0001 ? 20 * Math.log10(max) : -60;
  };

  // --- Public: enumerate available input devices ---
  const enumerateDevices = async () => {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach(t => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableDevices.value = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          id: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          groupId: d.groupId,
        }));
      console.log(`🔍 [CAPTURE] Found ${availableDevices.value.length} audio input devices`);
      return availableDevices.value;
    } catch (err) {
      captureError.value = `Failed to enumerate devices: ${err.name} - ${err.message}`;
      console.error('❌ [CAPTURE] enumerateDevices:', err);
      return [];
    }
  };

  const toggleDevice = (deviceId) => {
    const idx = selectedDeviceIds.value.indexOf(deviceId);
    if (idx >= 0) selectedDeviceIds.value.splice(idx, 1);
    else selectedDeviceIds.value.push(deviceId);
  };

  // --- Open one device, add its strips to the graph ---
  const openDevice = async (deviceId) => {
    const constraints = {
      audio: {
        deviceId: { exact: deviceId },
        channelCount: { ideal: 2, max: 2 },
        sampleRate: { ideal: sampleRate },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    const channelCount = Math.max(1, settings.channelCount || 1);
    const deviceLabel = track.label || `Device ${deviceId.slice(0, 8)}`;

    const source = audioContext.createMediaStreamSource(stream);
    const splitter = audioContext.createChannelSplitter(channelCount);
    source.connect(splitter);

    const strips = [];
    for (let ch = 0; ch < channelCount; ch++) {
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.8;
      const panNode = audioContext.createStereoPanner();
      // Default: stereo device → ch0=L, ch1=R. Mono → center.
      panNode.pan.value = channelCount === 2 ? (ch === 0 ? -1 : 1) : 0;
      const sendGain = audioContext.createGain();
      sendGain.gain.value = 1;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;

      splitter.connect(gainNode, ch);
      gainNode.connect(analyser);
      analyser.connect(panNode);
      panNode.connect(sendGain);
      sendGain.connect(broadcastBus);

      const stripId = ++stripCounter;
      const label = channelCount === 2 ? `${deviceLabel} (${ch === 0 ? 'L' : 'R'})` : deviceLabel;
      channels.value.push(reactive({
        stripId,
        deviceId,
        deviceLabel,
        channelIndex: ch,
        label,
        gain: 0.8,
        pan: panNode.pan.value,
        sendToBroadcast: true,
        peakDb: -60,
      }));
      strips.push({ stripId, gainNode, panNode, sendGain, analyser });
    }

    deviceStreams.set(deviceId, { stream, source, splitter, strips });
    console.log(`✅ [CAPTURE] Opened ${deviceLabel} (${channelCount} channel${channelCount === 1 ? '' : 's'})`);
  };

  const closeDevice = (deviceId) => {
    const entry = deviceStreams.get(deviceId);
    if (!entry) return;
    entry.strips.forEach(s => {
      try { s.sendGain.disconnect(); } catch { /* ignore */ }
      try { s.panNode.disconnect(); } catch { /* ignore */ }
      try { s.analyser.disconnect(); } catch { /* ignore */ }
      try { s.gainNode.disconnect(); } catch { /* ignore */ }
    });
    try { entry.splitter.disconnect(); } catch { /* ignore */ }
    try { entry.source.disconnect(); } catch { /* ignore */ }
    entry.stream.getTracks().forEach(t => t.stop());
    deviceStreams.delete(deviceId);
    channels.value = channels.value.filter(s => s.deviceId !== deviceId);
  };

  const findStripNodes = (stripId) => {
    for (const entry of deviceStreams.values()) {
      const found = entry.strips.find(s => s.stripId === stripId);
      if (found) return found;
    }
    return null;
  };

  const setStripGain = (stripId, value) => {
    const v = Math.max(0, Math.min(2, Number(value) || 0));
    const nodes = findStripNodes(stripId);
    if (nodes) nodes.gainNode.gain.value = v;
    const state = channels.value.find(s => s.stripId === stripId);
    if (state) state.gain = v;
  };
  const setStripPan = (stripId, value) => {
    const v = Math.max(-1, Math.min(1, Number(value) || 0));
    const nodes = findStripNodes(stripId);
    if (nodes) nodes.panNode.pan.value = v;
    const state = channels.value.find(s => s.stripId === stripId);
    if (state) state.pan = v;
  };
  const setStripSend = (stripId, on) => {
    const nodes = findStripNodes(stripId);
    if (nodes) nodes.sendGain.gain.value = on ? 1 : 0;
    const state = channels.value.find(s => s.stripId === stripId);
    if (state) state.sendToBroadcast = !!on;
  };
  const setBroadcastGain = (value) => {
    const v = Math.max(0, Math.min(2, Number(value) || 0));
    broadcastGain.value = v;
    if (broadcastBus) broadcastBus.gain.value = v;
  };

  // --- Meter loop (rAF) ---
  const startMeterLoop = () => {
    const tmp = new Float32Array(1024);
    const tick = () => {
      for (const entry of deviceStreams.values()) {
        for (const s of entry.strips) {
          const db = peakDbFromAnalyser(s.analyser, tmp);
          const state = channels.value.find(st => st.stripId === s.stripId);
          if (state) state.peakDb = db;
        }
      }
      if (broadcastAnalyserL && broadcastAnalyserR) {
        broadcastPeakL.value = peakDbFromAnalyser(broadcastAnalyserL, tmp);
        broadcastPeakR.value = peakDbFromAnalyser(broadcastAnalyserR, tmp);
      }
      meterRafId = requestAnimationFrame(tick);
    };
    meterRafId = requestAnimationFrame(tick);
  };

  // --- Start capture: open all selected devices, wire broadcast bus, start sending ---
  const startCapture = async () => {
    if (isCapturing.value) {
      console.warn('⚠️ [CAPTURE] Already capturing');
      return;
    }

    const ws = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const msg = `WebSocket not connected (state: ${ws ? ws.readyState : 'null'})`;
      captureError.value = msg;
      throw new Error(msg);
    }

    if (selectedDeviceIds.value.length === 0) {
      const msg = 'Select at least one input device first';
      captureError.value = msg;
      throw new Error(msg);
    }

    try {
      captureError.value = '';

      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContext = new Ctx({ sampleRate, latencyHint: 'interactive' });

      broadcastBus = audioContext.createGain();
      broadcastBus.gain.value = broadcastGain.value;
      broadcastBus.channelCount = 2;
      broadcastBus.channelCountMode = 'explicit';
      broadcastBus.channelInterpretation = 'speakers';

      broadcastSplitter = audioContext.createChannelSplitter(2);
      broadcastAnalyserL = audioContext.createAnalyser();
      broadcastAnalyserR = audioContext.createAnalyser();
      broadcastAnalyserL.fftSize = 1024;
      broadcastAnalyserR.fftSize = 1024;
      broadcastAnalyserL.smoothingTimeConstant = 0;
      broadcastAnalyserR.smoothingTimeConstant = 0;
      broadcastBus.connect(broadcastSplitter);
      broadcastSplitter.connect(broadcastAnalyserL, 0);
      broadcastSplitter.connect(broadcastAnalyserR, 1);

      // Script processor taps the broadcast bus output and sends it over WS as 2 channels (L=0, R=1)
      scriptProc = audioContext.createScriptProcessor(BUFFER_SIZE, 2, 1);
      broadcastBus.connect(scriptProc);

      let batchL = [];
      let batchR = [];
      let seq = 0;
      let firstSendLogged = false;

      scriptProc.onaudioprocess = (e) => {
        const currentWs = typeof wsRef === 'function' ? wsRef() : (wsRef?.value || wsRef);
        if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
        const isSrc = isSourceRef
          ? (typeof isSourceRef === 'function' ? isSourceRef() : (isSourceRef?.value ?? false))
          : true;
        if (!isSrc) return;

        const inL = e.inputBuffer.getChannelData(0);
        const inR = e.inputBuffer.numberOfChannels >= 2 ? e.inputBuffer.getChannelData(1) : inL;
        batchL.push(Array.from(inL));
        batchR.push(Array.from(inR));

        if (batchL.length >= BATCH_SIZE) {
          const flat = (arr) => {
            const out = [];
            for (const a of arr) out.push(...a);
            return out;
          };
          const lSamples = flat(batchL);
          const rSamples = flat(batchR);
          const t = Date.now();
          try {
            currentWs.send(JSON.stringify({
              type: 'audio', channel: 0, data: lSamples, encoding: 'pcm',
              sampleRate: audioContext.sampleRate, bufferCount: batchL.length,
              timestamp: t, sequence: seq,
            }));
            currentWs.send(JSON.stringify({
              type: 'audio', channel: 1, data: rSamples, encoding: 'pcm',
              sampleRate: audioContext.sampleRate, bufferCount: batchR.length,
              timestamp: t, sequence: seq,
            }));
            seq++;
            if (!firstSendLogged) {
              console.log('📤 [CAPTURE] First broadcast send', {
                samplesPerChannel: lSamples.length,
                sampleRate: audioContext.sampleRate,
              });
              firstSendLogged = true;
            }
          } catch (err) {
            captureError.value = `Send failed: ${err.message}`;
          }
          batchL = [];
          batchR = [];
        }

        const out = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < out.length; i++) out[i] = 0;
      };
      scriptProc.connect(audioContext.destination);

      // Open all selected devices
      const failures = [];
      for (const deviceId of selectedDeviceIds.value) {
        try {
          await openDevice(deviceId);
        } catch (err) {
          console.error(`❌ [CAPTURE] Failed to open device ${deviceId}:`, err);
          const dev = availableDevices.value.find(d => d.id === deviceId);
          failures.push(`${dev?.label || deviceId}: ${err.message}`);
        }
      }
      if (failures.length > 0) {
        captureError.value = `Some devices failed: ${failures.join('; ')}`;
      }
      if (deviceStreams.size === 0) {
        throw new Error('No devices opened successfully');
      }

      streamLatency.value = (BUFFER_SIZE / sampleRate) * 1000 * BATCH_SIZE;
      isCapturing.value = true;
      startMeterLoop();
      console.log(`✅ [CAPTURE] Started: ${deviceStreams.size} device(s), ${channels.value.length} channel(s) → stereo broadcast bus`);
    } catch (err) {
      console.error('❌ [CAPTURE] startCapture failed:', err);
      captureError.value = captureError.value || `Start failed: ${err.message}`;
      await stopCapture();
      throw err;
    }
  };

  const stopCapture = async () => {
    if (meterRafId) {
      cancelAnimationFrame(meterRafId);
      meterRafId = null;
    }
    for (const deviceId of [...deviceStreams.keys()]) closeDevice(deviceId);
    if (scriptProc) {
      try { scriptProc.disconnect(); } catch { /* ignore */ }
      scriptProc.onaudioprocess = null;
      scriptProc = null;
    }
    if (broadcastSplitter) {
      try { broadcastSplitter.disconnect(); } catch { /* ignore */ }
      broadcastSplitter = null;
    }
    broadcastAnalyserL = null;
    broadcastAnalyserR = null;
    if (broadcastBus) {
      try { broadcastBus.disconnect(); } catch { /* ignore */ }
      broadcastBus = null;
    }
    if (audioContext) {
      try { await audioContext.close(); } catch { /* ignore */ }
      audioContext = null;
    }
    isCapturing.value = false;
    channels.value = [];
    broadcastPeakL.value = -60;
    broadcastPeakR.value = -60;
  };

  onBeforeUnmount(() => { stopCapture(); });

  return {
    // device discovery
    availableDevices,
    selectedDeviceIds,
    toggleDevice,
    enumerateDevices,
    // capture state
    isCapturing,
    captureError,
    streamLatency,
    // per-channel strips
    channels,
    setStripGain,
    setStripPan,
    setStripSend,
    // broadcast bus
    broadcastPeakL,
    broadcastPeakR,
    broadcastGain,
    setBroadcastGain,
    // actions
    startCapture,
    stopCapture,
  };
}
