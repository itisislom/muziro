/**
 * Muziro Cinematic Intro Animation Engine
 * Standalone module: Pencil-sketch 'M' + Montserrat Black 'uziro' + natural page blur dissolve.
 */
(function () {
  'use strict';

  function createIntroDOM() {
    // Main Natural Blur Overlay & Brand Stage
    if (!document.getElementById('intro-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'intro-overlay';
      overlay.className = 'intro-overlay';
      overlay.setAttribute('aria-label', 'Muziro Intro');
      overlay.innerHTML = `
        <div class="brand-stage" id="brand-stage">
          <!-- Letter M with authentic pencil graphite texture -->
          <div class="m-wrapper" id="m-wrapper">
            <svg class="pencil-m-svg" viewBox="0 0 52 44">
              <defs>
                <filter id="pencil-filter" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.0" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>

              <!-- Faint pencil sketch guide/texture -->
              <path
                class="m-stroke-sketch"
                pathLength="100"
                d="M 5,39 L 5,3 L 26,39 L 47,3 L 47,39"
                fill="none"
                stroke="#52525b"
                stroke-width="6.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                filter="url(#pencil-filter)"
                opacity="0.32"
              />

              <!-- Primary graphite pencil stroke (Montserrat Black proportions) -->
              <path
                class="m-stroke-main"
                pathLength="100"
                d="M 5,39 L 5,3 L 26,39 L 47,3 L 47,39"
                fill="none"
                stroke="#09090b"
                stroke-width="9.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                filter="url(#pencil-filter)"
              />
            </svg>
          </div>

          <!-- Text 'uziro' in Montserrat Black with balanced kerning -->
          <div class="uziro-wrapper" id="uziro-wrapper">
            <span class="uziro-text" id="uziro-text">uziro</span>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  function runIntro(force = false) {
    if (!force) {
      try {
        if (sessionStorage.getItem('muziro_intro_played')) {
          return;
        }
        sessionStorage.setItem('muziro_intro_played', 'true');
      } catch (e) {
        // Continue if storage is restricted
      }
    }

    createIntroDOM();

    const overlay = document.getElementById('intro-overlay');
    const mWrapper = document.getElementById('m-wrapper');
    const uziroWrapper = document.getElementById('uziro-wrapper');
    const uziroText = document.getElementById('uziro-text');

    let hasEnded = false;
    let exitTimer = null;

    function startSequence() {
      if (!uziroText || !mWrapper) return;

      // Measure exact rendered width of "uziro" in Montserrat Black
      const uziroRect = uziroText.getBoundingClientRect();
      // Account for margin-left (+2px)
      const effectiveUziroWidth = Math.max(120, Math.round(uziroRect.width || 148)) + 2;
      const initialShiftX = Math.round(effectiveUziroWidth / 2);

      // Phase 1 (0.0s - 1.0s):
      // M is positioned precisely at the horizontal center of the viewport
      mWrapper.style.transform = `translateX(${initialShiftX}px)`;
      mWrapper.classList.add('is-drawing');

      // Phase 2 (1.0s - 1.75s):
      // After 1 second, M slides left with extreme Ease-In and Ease-Out keyframe handles,
      // while "uziro" simultaneously unfolds to form the word "Muziro"
      setTimeout(() => {
        if (hasEnded) return;

        // Extreme Ease-In and Ease-Out curve (handles pulled all the way out)
        const extremeEase = 'cubic-bezier(0.85, 0, 0.15, 1)';

        // M slides left to its resting place
        mWrapper.style.transition = `transform 0.75s ${extremeEase}`;
        mWrapper.style.transform = 'translateX(0px)';

        // 'uziro' reveals simultaneously with balanced kerning
        uziroWrapper.style.transition = `clip-path 0.75s ${extremeEase}, opacity 0.5s ease`;
        uziroWrapper.style.clipPath = 'inset(0 0% 0 0)';
        uziroWrapper.style.opacity = '1';
      }, 1000);

      // Phase 3 (1.75s - 4.25s):
      // The word "Muziro" stands completely static for 2.5 seconds
      // Phase 4 (4.25s - 5.1s):
      // Smoothly dissolves the natural blur overlay and reveals the underlying page sharply
      exitTimer = setTimeout(() => {
        finishIntro();
      }, 4250);
    }

    function finishIntro() {
      if (hasEnded) return;
      hasEnded = true;
      if (exitTimer) clearTimeout(exitTimer);

      if (overlay) overlay.classList.add('is-fading-out');

      // Clean removal from DOM after smooth fade completes
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
      }, 900);
    }

    // Quick skip on click or Space/Enter/Escape
    if (overlay) {
      overlay.style.cursor = 'pointer';
      overlay.addEventListener('click', finishIntro);
    }
    window.addEventListener('keydown', function onIntroKey(e) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        finishIntro();
        window.removeEventListener('keydown', onIntroKey);
      }
    });

    // Wait for Montserrat 900 to be ready before starting animation calculations
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(startSequence);
      });
    } else {
      window.addEventListener('load', () => {
        requestAnimationFrame(startSequence);
      });
    }
  }

  // Auto-run when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runIntro);
  } else {
    runIntro();
  }

  // Global exposure for programmatic control if needed
  window.MuziroIntro = {
    start: runIntro
  };
})();
