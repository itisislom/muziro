// Muziro Reverb Effect Module
window.MuziroReverb = (function() {
  
  let currentClipId = null;
  let currentReverbValue = 0; // 0 to 100
  let isDraggingKnob = false;
  let impulseResponseBuffers = {};

  // Generate a synthetic cinematic reverb impulse response
  function getImpulseResponse(ctx) {
    const sampleRate = ctx.sampleRate;
    if (impulseResponseBuffers[sampleRate]) return impulseResponseBuffers[sampleRate];
    const length = Math.round(sampleRate * 2.5); // 2.5 seconds tail
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const n = length - i;
      // Exponential decay white noise
      const decay = Math.pow(n / length, 3.5);
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    impulseResponseBuffers[sampleRate] = impulse;
    return impulse;
  }

  // Initialize UI in DOM
  function initUI() {
    if (document.getElementById('reverb-context-menu')) return;

    // 1. Context Menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'timeline-context-menu';
    contextMenu.id = 'reverb-context-menu';
    contextMenu.innerHTML = `
      <button class="context-menu-item" id="btn-open-reverb">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
        <span>Reverb</span>
      </button>
    `;
    document.body.appendChild(contextMenu);

    // 2. Reverb Modal
    const modal = document.createElement('div');
    modal.className = 'reverb-modal-overlay';
    modal.id = 'reverb-modal-overlay';
    modal.innerHTML = `
      <div class="reverb-modal-card">
        <div class="reverb-modal-header">Reverb</div>
        
        <div class="reverb-knob-container" id="reverb-knob-container" title="Drag up/right to increase, down/left to decrease. Scroll wheel or double-click to reset.">
          <div class="reverb-knob-track" id="reverb-knob-track"></div>
          <div class="reverb-knob-dial" id="reverb-knob-dial">
            <div class="reverb-knob-indicator"></div>
          </div>
        </div>
        
        <div class="reverb-knob-value" id="reverb-knob-value">0%</div>

        <div class="reverb-modal-actions">
          <button class="reverb-btn reverb-btn-cancel" id="reverb-btn-cancel">Cancel</button>
          <button class="reverb-btn reverb-btn-apply" id="reverb-btn-apply">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Context Menu Document Click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#reverb-context-menu')) {
        hideContextMenu();
      }
    });

    document.getElementById('btn-open-reverb').addEventListener('click', (e) => {
      e.stopPropagation();
      hideContextMenu();
      if (currentClipId) {
        let initialVal = currentReverbValue;
        if (window.MuziroReverbBridge && typeof window.MuziroReverbBridge.getClipReverb === 'function') {
          initialVal = window.MuziroReverbBridge.getClipReverb(currentClipId);
        } else if (window.tracks) {
          outer: for (const t of window.tracks) {
            for (const c of (t.clips || [])) {
              if (c.id === currentClipId) {
                initialVal = c.reverb || 0;
                break outer;
              }
            }
          }
        }
        showModal(initialVal);
      }
    });

    // Modal Buttons Logic
    document.getElementById('reverb-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      hideModal();
    });

    document.getElementById('reverb-btn-apply').addEventListener('click', (e) => {
      e.stopPropagation();
      applyReverb();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });

    // Keyboard Shortcuts while Modal is Open
    document.addEventListener('keydown', (e) => {
      const modalEl = document.getElementById('reverb-modal-overlay');
      if (!modalEl || !modalEl.classList.contains('is-active')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideModal();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        applyReverb();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setKnobValue(Math.min(100, currentReverbValue + step));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        setKnobValue(Math.max(0, currentReverbValue - step));
      }
    });

    // Knob Logic
    const knobContainer = document.getElementById('reverb-knob-container');
    const dial = document.getElementById('reverb-knob-dial');
    let startY = 0;
    let startX = 0;
    let startVal = 0;

    function onKnobPointerDown(clientX, clientY, e) {
      isDraggingKnob = true;
      startY = clientY;
      startX = clientX;
      startVal = currentReverbValue;

      window.addEventListener('mousemove', onKnobMouseMove);
      window.addEventListener('mouseup', onKnobMouseUp);
      window.addEventListener('touchmove', onKnobTouchMove, { passive: false });
      window.addEventListener('touchend', onKnobTouchEnd);
    }

    dial.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onKnobPointerDown(e.clientX, e.clientY, e);
    });

    knobContainer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onKnobPointerDown(e.clientX, e.clientY, e);
    });

    // Double-click resets knob to 0%
    knobContainer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setKnobValue(0);
    });

    // Mouse wheel controls knob
    knobContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? (e.shiftKey ? 5 : 2) : (e.shiftKey ? -5 : -2);
      setKnobValue(Math.max(0, Math.min(100, currentReverbValue + delta)));
    }, { passive: false });

    // Touch Support
    dial.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        e.preventDefault();
        onKnobPointerDown(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    }, { passive: false });

    function onKnobMouseMove(e) {
      if (!isDraggingKnob) return;
      const dy = startY - e.clientY; // moving up increases value
      const dx = e.clientX - startX; // moving right increases value
      const change = (dy * 0.5) + (dx * 0.25);
      const newVal = Math.max(0, Math.min(100, Math.round(startVal + change)));
      setKnobValue(newVal);
    }

    function onKnobMouseUp() {
      isDraggingKnob = false;
      window.removeEventListener('mousemove', onKnobMouseMove);
      window.removeEventListener('mouseup', onKnobMouseUp);
      window.removeEventListener('touchmove', onKnobTouchMove);
      window.removeEventListener('touchend', onKnobTouchEnd);
    }

    function onKnobTouchMove(e) {
      if (!isDraggingKnob || !e.touches || !e.touches[0]) return;
      e.preventDefault();
      const dy = startY - e.touches[0].clientY;
      const dx = e.touches[0].clientX - startX;
      const change = (dy * 0.5) + (dx * 0.25);
      const newVal = Math.max(0, Math.min(100, Math.round(startVal + change)));
      setKnobValue(newVal);
    }

    function onKnobTouchEnd() {
      onKnobMouseUp();
    }
  }

  function setKnobValue(val) {
    currentReverbValue = Math.max(0, Math.min(100, Math.round(val)));
    const valEl = document.getElementById('reverb-knob-value');
    if (valEl) {
      valEl.textContent = currentReverbValue + '%';
    }
    
    // Map 0-100 to -135deg to +135deg
    // 0% -> -135deg, 100% -> +135deg, range = 270deg
    const angle = -135 + (currentReverbValue / 100) * 270;
    const percent = (currentReverbValue / 100) * 75; // 75% is the full arc for conic gradient
    
    const dial = document.getElementById('reverb-knob-dial');
    const track = document.getElementById('reverb-knob-track');
    
    if (dial) dial.style.setProperty('--knob-angle', angle + 'deg');
    if (track) track.style.setProperty('--knob-percent', percent + '%');
  }

  function showContextMenu(x, y, clipId, clipReverb) {
    initUI();
    currentClipId = clipId;
    if (clipReverb !== undefined) {
      currentReverbValue = Math.max(0, Math.min(100, Math.round(Number(clipReverb) || 0)));
    }
    const menu = document.getElementById('reverb-context-menu');
    if (!menu) return;

    menu.classList.add('is-active');

    // Keep menu inside viewport boundaries
    const menuWidth = menu.offsetWidth || 140;
    const menuHeight = menu.offsetHeight || 44;
    const maxX = window.innerWidth - menuWidth - 8;
    const maxY = window.innerHeight - menuHeight - 8;
    const posX = Math.max(8, Math.min(x, maxX));
    const posY = Math.max(8, Math.min(y, maxY));

    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
  }

  function hideContextMenu() {
    const menu = document.getElementById('reverb-context-menu');
    if (menu) menu.classList.remove('is-active');
  }

  function showModal(initialValue = 0) {
    initUI();
    setKnobValue(initialValue);
    const modal = document.getElementById('reverb-modal-overlay');
    if (modal) modal.classList.add('is-active');
  }

  function hideModal() {
    const modal = document.getElementById('reverb-modal-overlay');
    if (modal) modal.classList.remove('is-active');
  }

  function applyReverb() {
    if (!currentClipId) {
      hideModal();
      return;
    }

    const value = Math.max(0, Math.min(100, Math.round(currentReverbValue)));

    // 1. First attempt: Use official MuziroReverbBridge if available
    let bridgeHandled = false;
    if (window.MuziroReverbBridge && typeof window.MuziroReverbBridge.applyReverb === 'function') {
      try {
        window.MuziroReverbBridge.applyReverb(currentClipId, value);
        bridgeHandled = true;
      } catch (err) {
        console.error('MuziroReverbBridge.applyReverb error:', err);
      }
    }

    // 2. Fallback: Direct state mutation if bridge wasn't present
    if (!bridgeHandled && window.tracks) {
      if (typeof window.pushHistorySnapshot === 'function') {
        window.pushHistorySnapshot();
      }
      outer: for (const t of window.tracks) {
        for (const c of (t.clips || [])) {
          if (c.id === currentClipId) {
            c.reverb = value;
            break outer;
          }
        }
      }
      const isPlaying = typeof window.getIsPlaying === 'function' ? window.getIsPlaying() : Boolean(window.isPlaying);
      if (isPlaying && typeof window.startAllSources === 'function') {
        const tempTime = typeof window.getCurrentPlayheadTime === 'function' ? window.getCurrentPlayheadTime() : (window.currentPlayheadTime || 0);
        window.startAllSources(tempTime);
      }
    }

    // 3. Custom event notification
    try {
      window.dispatchEvent(new CustomEvent('muziro:apply-reverb', {
        detail: {
          clipId: currentClipId,
          reverb: value
        }
      }));
    } catch (_) {}

    // Always close modal upon clicking Apply
    hideModal();
  }

  // Ensure UI initializes whether DOM is loading or already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  return {
    showContextMenu,
    hideContextMenu,
    showModal,
    hideModal,
    applyReverb,
    getImpulseResponse,
    setKnobValue
  };

})();
