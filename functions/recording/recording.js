// Muziro Track Recording Module
// Studio-grade 32-bit Linear PCM audio capture via Web Audio AudioWorklet (0% compression)
// Pre-warmed hardware capture for 0ms instant recording start
// Architecture identical to BandLab / Pro Tools / Ableton Web Engine
window.MuziroRecorder = (function() {

  const SAVED_MIC_KEY = 'muziro_saved_mic_id';
  const SAVED_MIC_LABEL_KEY = 'muziro_saved_mic_label';

  let isRecording = false;
  let isCountingDown = false;
  let activeStream = null;
  let activeSource = null;
  let activeWorkletNode = null;
  let activeScriptNode = null;
  let activeDummyGain = null;
  let pcmChannels = []; // Array of Float32Array chunks per channel
  let currentTrackId = null;
  let recStartTime = 0;
  let countdownTimer = null;
  let workletRegistered = false;

  // Pre-warmed background stream during countdown for instant zero-latency start
  let prewarmedCapture = null;

  // Meter preview objects
  let previewStream = null;
  let previewSource = null;
  let previewAnalyser = null;
  let previewAnimFrame = null;

  // Raw Studio Audio Constraints: completely disables VoIP filters (echo cancellation,
  // noise suppression, AGC, highpass) that compress and muffle vocals
  function getStudioAudioConstraints(deviceId) {
    return {
      audio: {
        deviceId: deviceId ? { ideal: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        googEchoCancellation: false,
        googAutoGainControl: false,
        googNoiseSuppression: false,
        googHighpassFilter: false,
        googTypingNoiseDetection: false,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 24 },
        latency: { ideal: 0.003 }
      }
    };
  }

  // AudioWorklet processor code for inline fallback registration
  const WORKLET_PROCESSOR_CODE = `
    class MuziroPCMWorkletProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this._isRecording = true;
        this.port.onmessage = (e) => {
          if (e.data && e.data.action === 'STOP') {
            this._isRecording = false;
          }
        };
      }

      process(inputs) {
        if (!this._isRecording) return false;
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const numChannels = input.length;
        const channelData = new Array(numChannels);
        for (let c = 0; c < numChannels; c++) {
          channelData[c] = new Float32Array(input[c]);
        }

        this.port.postMessage({
          action: 'DATA',
          channels: channelData
        });

        return true;
      }
    }
    registerProcessor('muziro-pcm-recorder-processor', MuziroPCMWorkletProcessor);
  `;

  async function ensureWorkletLoaded(ctx) {
    if (workletRegistered) return true;
    if (!ctx || !ctx.audioWorklet) return false;

    try {
      await ctx.audioWorklet.addModule('functions/recording/recorder-worklet.js');
      workletRegistered = true;
      return true;
    } catch (e1) {
      try {
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);
        workletRegistered = true;
        return true;
      } catch (e2) {
        console.warn('AudioWorklet registration failed, using Linear PCM ScriptProcessor fallback:', e2);
        return false;
      }
    }
  }

  function initUI() {
    if (document.getElementById('mic-modal-overlay')) return;

    // 1. Microphone Selection Modal
    const modal = document.createElement('div');
    modal.className = 'mic-modal-overlay';
    modal.id = 'mic-modal-overlay';
    modal.innerHTML = `
      <div class="mic-modal-card">
        <div class="mic-modal-header">
          <div class="mic-modal-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            <span class="mic-modal-title">Select Microphone</span>
          </div>
          <span class="mic-target-track-badge" id="mic-target-track-badge">Track 1</span>
        </div>

        <div class="mic-form-group">
          <label class="mic-form-label" for="mic-device-select">Audio Input Device</label>
          <select class="mic-select-dropdown" id="mic-device-select"></select>
        </div>

        <div class="mic-meter-wrapper">
          <div class="mic-meter-caption">
            <span>Studio Input Signal (Raw PCM)</span>
            <span id="mic-meter-db">-∞ dB</span>
          </div>
          <div class="mic-meter-track">
            <div class="mic-meter-fill" id="mic-meter-fill"></div>
          </div>
        </div>

        <div class="mic-modal-actions">
          <button class="mic-btn mic-btn-cancel" id="btn-mic-cancel">Cancel</button>
          <button class="mic-btn mic-btn-start" id="btn-mic-start">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="5" cy="5" r="4"/>
            </svg>
            <span>Start Recording</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 2. Countdown Overlay
    const countdown = document.createElement('div');
    countdown.className = 'rec-countdown-overlay';
    countdown.id = 'rec-countdown-overlay';
    countdown.innerHTML = `
      <div class="rec-countdown-card">
        <div class="rec-countdown-number" id="rec-countdown-num">3</div>
        <div class="rec-countdown-label">Get Ready...</div>
      </div>
    `;
    document.body.appendChild(countdown);

    // Modal Events
    document.getElementById('btn-mic-cancel').addEventListener('click', closeSetup);
    document.getElementById('btn-mic-start').addEventListener('click', onConfirmStart);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSetup();
    });

    document.getElementById('mic-device-select').addEventListener('change', (e) => {
      startMeterPreview(e.target.value);
    });

    // Keyboard navigation in modal
    document.addEventListener('keydown', (e) => {
      const modalEl = document.getElementById('mic-modal-overlay');
      if (!modalEl || !modalEl.classList.contains('is-active')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeSetup();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirmStart();
      }
    });
  }

  // Plays synthesized countdown beeps
  function playBeep(freq = 880, dur = 0.08) {
    try {
      const ctx = window._muziroAudioContext || (window.audioContext ? window.audioContext : null);
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (_) {}
  }

  // Populate Audio Input Devices in Select Dropdown
  async function populateDevices(preferredDeviceId = null) {
    const select = document.getElementById('mic-device-select');
    if (!select) return;
    select.innerHTML = '<option value="">Loading devices...</option>';

    try {
      let tempStream = null;
      try {
        tempStream = await navigator.mediaDevices.getUserMedia(getStudioAudioConstraints());
      } catch (err) {
        console.warn('Microphone permission query:', err);
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }

      select.innerHTML = '';
      if (audioInputs.length === 0) {
        select.innerHTML = '<option value="">Default Microphone</option>';
        return;
      }

      const savedId = preferredDeviceId || localStorage.getItem(SAVED_MIC_KEY);
      const savedLabel = localStorage.getItem(SAVED_MIC_LABEL_KEY);

      let selectedIndex = 0;
      audioInputs.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Microphone ${idx + 1}`;
        if (savedId && dev.deviceId === savedId) {
          selectedIndex = idx;
        } else if (!savedId && savedLabel && dev.label === savedLabel) {
          selectedIndex = idx;
        }
        select.appendChild(opt);
      });

      if (select.options[selectedIndex]) {
        select.selectedIndex = selectedIndex;
      }

      // Start level meter for chosen device
      startMeterPreview(select.value);

    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
      select.innerHTML = '<option value="">Default Audio Input</option>';
    }
  }

  // Live VU Meter preview during device selection (NEVER connected to destination)
  async function startMeterPreview(deviceId) {
    stopMeterPreview();
    try {
      previewStream = await navigator.mediaDevices.getUserMedia(getStudioAudioConstraints(deviceId));
      const ctx = window._muziroAudioContext || (window.audioContext ? window.audioContext : null);
      if (!ctx) return;

      previewAnalyser = ctx.createAnalyser();
      previewAnalyser.fftSize = 256;
      previewSource = ctx.createMediaStreamSource(previewStream);
      previewSource.connect(previewAnalyser);
      // NOTE: previewAnalyser is intentionally NOT connected to ctx.destination to eliminate speaker feedback!

      const dataArray = new Uint8Array(previewAnalyser.frequencyBinCount);
      const fillEl = document.getElementById('mic-meter-fill');
      const dbEl = document.getElementById('mic-meter-db');

      function updateMeter() {
        if (!previewAnalyser) return;
        previewAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));

        if (fillEl) fillEl.style.width = pct + '%';
        if (dbEl) {
          if (pct <= 2) {
            dbEl.textContent = '-∞ dB';
          } else {
            const db = Math.round((pct - 100) * 0.4);
            dbEl.textContent = `${db} dB`;
          }
        }
        previewAnimFrame = requestAnimationFrame(updateMeter);
      }
      updateMeter();
    } catch (err) {
      console.warn('Meter preview unavailable:', err);
    }
  }

  function stopMeterPreview() {
    if (previewAnimFrame) {
      cancelAnimationFrame(previewAnimFrame);
      previewAnimFrame = null;
    }
    if (previewSource) {
      try { previewSource.disconnect(); } catch (_) {}
      previewSource = null;
    }
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      previewStream = null;
    }
    previewAnalyser = null;
    const fillEl = document.getElementById('mic-meter-fill');
    if (fillEl) fillEl.style.width = '0%';
  }

  // Pre-warms the microphone stream & worklet during countdown so start is instant (0ms delay)
  async function prewarmCapture(deviceId) {
    cleanupPrewarmed();
    try {
      const ctx = window._muziroAudioContext || (window.audioContext ? window.audioContext : null);
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(getStudioAudioConstraints(deviceId));
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      }

      if (!isCountingDown) {
        // Cancelled during device acquisition
        stream.getTracks().forEach(t => t.stop());
        return null;
      }

      const source = ctx.createMediaStreamSource(stream);
      let workletNode = null;
      let scriptNode = null;
      let dummyGain = null;

      const workletReady = await ensureWorkletLoaded(ctx);
      if (workletReady) {
        workletNode = new AudioWorkletNode(ctx, 'muziro-pcm-recorder-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2]
        });

        workletNode.port.onmessage = (e) => {
          if (isRecording && e.data && e.data.action === 'DATA' && e.data.channels) {
            onPCMChunkReceived(e.data.channels);
          }
        };

        source.connect(workletNode);
      } else {
        const bufferSize = 4096;
        scriptNode = ctx.createScriptProcessor(bufferSize, 2, 2);
        scriptNode.onaudioprocess = (e) => {
          if (!isRecording) return;
          const inBuf = e.inputBuffer;
          const ch0 = new Float32Array(inBuf.getChannelData(0));
          const ch1 = inBuf.numberOfChannels > 1 ? new Float32Array(inBuf.getChannelData(1)) : ch0;
          onPCMChunkReceived([ch0, ch1]);
        };

        dummyGain = ctx.createGain();
        dummyGain.gain.value = 0; // Mute: prevents any speaker feedback

        source.connect(scriptNode);
        scriptNode.connect(dummyGain);
        dummyGain.connect(ctx.destination);
      }

      prewarmedCapture = { stream, source, workletNode, scriptNode, dummyGain };
      return prewarmedCapture;
    } catch (err) {
      console.warn('Prewarming audio capture failed (will fall back on live start):', err);
      return null;
    }
  }

  function cleanupPrewarmed() {
    if (prewarmedCapture) {
      if (prewarmedCapture.workletNode) {
        try {
          prewarmedCapture.workletNode.port.postMessage({ action: 'STOP' });
          prewarmedCapture.workletNode.disconnect();
        } catch (_) {}
      }
      if (prewarmedCapture.scriptNode) {
        try { prewarmedCapture.scriptNode.disconnect(); } catch (_) {}
      }
      if (prewarmedCapture.dummyGain) {
        try { prewarmedCapture.dummyGain.disconnect(); } catch (_) {}
      }
      if (prewarmedCapture.source) {
        try { prewarmedCapture.source.disconnect(); } catch (_) {}
      }
      if (prewarmedCapture.stream) {
        prewarmedCapture.stream.getTracks().forEach(t => t.stop());
      }
      prewarmedCapture = null;
    }
  }

  // Open Microphone Setup dialog
  function openSetup(targetTrackId, targetTrackName = 'Audio Track') {
    initUI();
    if (isRecording || isCountingDown) {
      stopRecording();
      return;
    }

    currentTrackId = targetTrackId;
    const badge = document.getElementById('mic-target-track-badge');
    if (badge) badge.textContent = targetTrackName;

    const modal = document.getElementById('mic-modal-overlay');
    if (modal) modal.classList.add('is-active');

    populateDevices();
  }

  function closeSetup() {
    stopMeterPreview();
    const modal = document.getElementById('mic-modal-overlay');
    if (modal) modal.classList.remove('is-active');
  }

  // Main entry point when user clicks R or presses R key
  // Checks if saved microphone is still present; if so, records immediately without prompt!
  async function requestRecording(targetTrackId, targetTrackName = 'Audio Track') {
    initUI();
    if (isRecording || isCountingDown) {
      stopRecording();
      return;
    }

    currentTrackId = targetTrackId;

    try {
      const savedId = localStorage.getItem(SAVED_MIC_KEY);
      const savedLabel = localStorage.getItem(SAVED_MIC_LABEL_KEY);

      if (savedId) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        // Check if saved microphone is still present
        const matched = audioInputs.find(d => d.deviceId === savedId || (savedLabel && d.label && d.label === savedLabel));

        if (matched) {
          // Saved mic is connected and available! Immediately start 3-2-1 countdown!
          runCountdown(matched.deviceId);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not auto-verify saved microphone:', err);
    }

    // First time or saved mic was unplugged: open selection dialog
    openSetup(targetTrackId, targetTrackName);
  }

  // User confirmed in modal: remember device in localStorage and start countdown
  function onConfirmStart() {
    const select = document.getElementById('mic-device-select');
    const selectedDeviceId = select ? select.value : null;
    const selectedLabel = select && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';

    if (selectedDeviceId) {
      localStorage.setItem(SAVED_MIC_KEY, selectedDeviceId);
      if (selectedLabel) {
        localStorage.setItem(SAVED_MIC_LABEL_KEY, selectedLabel);
      }
    }

    closeSetup();
    runCountdown(selectedDeviceId);
  }

  function runCountdown(selectedDeviceId) {
    const overlay = document.getElementById('rec-countdown-overlay');
    const numEl = document.getElementById('rec-countdown-num');

    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    isCountingDown = true;

    // Start pre-warming the audio stream immediately in parallel with countdown!
    const prewarmTask = prewarmCapture(selectedDeviceId);

    if (!overlay || !numEl) {
      isCountingDown = false;
      executeRecordingStart(selectedDeviceId, prewarmTask);
      return;
    }

    overlay.classList.add('is-active');
    let count = 3;
    numEl.textContent = '3';
    playBeep(880, 0.08);

    countdownTimer = setInterval(() => {
      if (!isCountingDown) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        cleanupPrewarmed();
        return;
      }

      count--;
      if (count === 2) {
        numEl.textContent = '2';
        playBeep(880, 0.08);
      } else if (count === 1) {
        numEl.textContent = '1';
        playBeep(880, 0.08);
      } else if (count === 0) {
        numEl.textContent = 'REC';
        playBeep(1760, 0.14);
        clearInterval(countdownTimer);
        countdownTimer = null;

        // Instant start without artificial timeouts: 0ms latency!
        overlay.classList.remove('is-active');
        isCountingDown = false;
        executeRecordingStart(selectedDeviceId, prewarmTask);
      }
    }, 850);
  }

  function onPCMChunkReceived(channels) {
    if (!isRecording) return;
    if (pcmChannels.length === 0) {
      for (let c = 0; c < channels.length; c++) {
        pcmChannels.push([]);
      }
    }
    for (let c = 0; c < channels.length; c++) {
      if (pcmChannels[c]) {
        pcmChannels[c].push(channels[c]);
      }
    }
  }

  // Starts live recording via BandLab-grade AudioWorklet (Pure Uncompressed 32-bit Float PCM)
  async function executeRecordingStart(deviceId, prewarmTask = null) {
    if (isRecording) return;

    try {
      // If pre-warmed during countdown, grab pre-warmed objects instantly
      if (prewarmTask) {
        await prewarmTask;
      }

      const ctx = window._muziroAudioContext || (window.audioContext ? window.audioContext : null);
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (prewarmedCapture && prewarmedCapture.stream) {
        activeStream = prewarmedCapture.stream;
        activeSource = prewarmedCapture.source;
        activeWorkletNode = prewarmedCapture.workletNode;
        activeScriptNode = prewarmedCapture.scriptNode;
        activeDummyGain = prewarmedCapture.dummyGain;
        prewarmedCapture = null;
      } else {
        // Fallback live acquisition
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia(getStudioAudioConstraints(deviceId));
        } catch (e1) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
        }

        activeStream = stream;
        activeSource = ctx.createMediaStreamSource(activeStream);

        const workletReady = await ensureWorkletLoaded(ctx);
        if (workletReady) {
          activeWorkletNode = new AudioWorkletNode(ctx, 'muziro-pcm-recorder-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2]
          });

          activeWorkletNode.port.onmessage = (e) => {
            if (isRecording && e.data && e.data.action === 'DATA' && e.data.channels) {
              onPCMChunkReceived(e.data.channels);
            }
          };

          activeSource.connect(activeWorkletNode);
        } else {
          const bufferSize = 4096;
          activeScriptNode = ctx.createScriptProcessor(bufferSize, 2, 2);
          activeScriptNode.onaudioprocess = (e) => {
            if (!isRecording) return;
            const inBuf = e.inputBuffer;
            const ch0 = new Float32Array(inBuf.getChannelData(0));
            const ch1 = inBuf.numberOfChannels > 1 ? new Float32Array(inBuf.getChannelData(1)) : ch0;
            onPCMChunkReceived([ch0, ch1]);
          };

          activeDummyGain = ctx.createGain();
          activeDummyGain.gain.value = 0;

          activeSource.connect(activeScriptNode);
          activeScriptNode.connect(activeDummyGain);
          activeDummyGain.connect(ctx.destination);
        }
      }

      pcmChannels = [];
      isRecording = true;

      // Start timeline visualizer and sync backing playback immediately
      if (window.MuziroTimelineBridge && typeof window.MuziroTimelineBridge.onRecordingStarted === 'function') {
        recStartTime = window.MuziroTimelineBridge.onRecordingStarted(currentTrackId);
      }

    } catch (err) {
      console.error('Failed to start studio microphone recording:', err);
      alert('Could not start recording: ' + (err.message || err.name));
      isRecording = false;
      cleanupPrewarmed();
      if (window.MuziroTimelineBridge) {
        window.MuziroTimelineBridge.onRecordingCancelled(currentTrackId);
      }
    }
  }

  // Stops recording and builds the uncompressed 32-bit Float AudioBuffer
  async function stopRecording() {
    // 1. If currently in countdown, cancel it
    if (isCountingDown) {
      isCountingDown = false;
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      cleanupPrewarmed();
      const overlay = document.getElementById('rec-countdown-overlay');
      if (overlay) overlay.classList.remove('is-active');

      if (window.MuziroTimelineBridge) {
        window.MuziroTimelineBridge.onRecordingCancelled(currentTrackId);
      }
      return;
    }

    if (!isRecording) return;
    isRecording = false;

    // Disconnect Worklet / Nodes
    if (activeWorkletNode) {
      try {
        activeWorkletNode.port.postMessage({ action: 'STOP' });
        activeWorkletNode.disconnect();
      } catch (_) {}
      activeWorkletNode = null;
    }

    if (activeScriptNode) {
      try { activeScriptNode.disconnect(); } catch (_) {}
      activeScriptNode = null;
    }

    if (activeDummyGain) {
      try { activeDummyGain.disconnect(); } catch (_) {}
      activeDummyGain = null;
    }

    if (activeSource) {
      try { activeSource.disconnect(); } catch (_) {}
      activeSource = null;
    }

    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }

    cleanupPrewarmed();

    const numChannels = pcmChannels.length;
    if (numChannels === 0 || !pcmChannels[0] || pcmChannels[0].length === 0) {
      if (window.MuziroTimelineBridge) {
        window.MuziroTimelineBridge.onRecordingCancelled(currentTrackId);
      }
      return;
    }

    const ctx = window._muziroAudioContext || window.audioContext;
    if (!ctx) return;

    // Calculate total recorded frames
    let totalFrames = 0;
    for (let i = 0; i < pcmChannels[0].length; i++) {
      totalFrames += pcmChannels[0][i].length;
    }

    if (totalFrames === 0) {
      if (window.MuziroTimelineBridge) {
        window.MuziroTimelineBridge.onRecordingCancelled(currentTrackId);
      }
      return;
    }

    // Assemble bit-exact uncompressed AudioBuffer (Float32 PCM)
    const audioBuffer = ctx.createBuffer(numChannels, totalFrames, ctx.sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelTarget = audioBuffer.getChannelData(ch);
      let offset = 0;
      const chunks = pcmChannels[ch];
      for (let i = 0; i < chunks.length; i++) {
        channelTarget.set(chunks[i], offset);
        offset += chunks[i].length;
      }
    }

    pcmChannels = [];

    // Transparent 5ms cosine de-click fade-in and fade-out to prevent clicks/thuds at boundaries
    const fadeLen = Math.min(Math.floor(audioBuffer.sampleRate * 0.005), Math.floor(audioBuffer.length / 4));
    if (fadeLen > 0) {
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < fadeLen; i++) {
          const factor = 0.5 * (1 - Math.cos(Math.PI * (i / fadeLen)));
          data[i] *= factor;
          data[data.length - 1 - i] *= factor;
        }
      }
    }

    if (window.MuziroTimelineBridge && typeof window.MuziroTimelineBridge.onRecordingFinished === 'function') {
      window.MuziroTimelineBridge.onRecordingFinished(currentTrackId, audioBuffer, recStartTime);
    }
  }

  function getIsRecording() {
    return isRecording;
  }

  function getIsCountingDown() {
    return isCountingDown;
  }

  function getCurrentTrackId() {
    return currentTrackId;
  }

  // Initialize UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  return {
    requestRecording,
    openSetup,
    closeSetup,
    stopRecording,
    getIsRecording,
    getIsCountingDown,
    getCurrentTrackId
  };

})();
