let buttonCheckScheduled = false;

// P0 FIX: Throttled SPA Observer to inject launcher without killing CPU
const mainObserver = new MutationObserver(() => {
  if (buttonCheckScheduled) return;
  buttonCheckScheduled = true;
  requestAnimationFrame(() => {
    buttonCheckScheduled = false;
    injectButtonIfNeeded();
  });
});

mainObserver.observe(document.body, { childList: true, subtree: true });

function injectButtonIfNeeded() {
  // P1 FIX: Place it elegantly inside the native actions row
  const badgeActions = document.querySelector('.playbackSoundBadge__actions');
  
  if (badgeActions && !document.getElementById('np-toggle-btn')) {
    try {
      if (!document.getElementById('np-overlay')) {
        initNowPlayingUI();
        setupPersistentLogic(); 
      }
      
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'np-toggle-btn';
      toggleBtn.title = 'Now Playing';
      // Native styling
      toggleBtn.className = 'sc-button sc-button-small sc-button-icon sc-button-secondary';
      // simple expand icon
      toggleBtn.innerHTML = `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M2 2v4h1.5V3.5H7V2H2zm9 0v1.5h3.5V7H16V2h-5zM2 14h5v-1.5H3.5V9H2v5zm12.5-1.5H11V14h5V9h-1.5v3.5z"/></svg>`;
      toggleBtn.onclick = () => window.toggleOverlay?.();
      
      badgeActions.appendChild(toggleBtn);
    } catch (err) {
      console.error('[NowPlaying] Failed to initialize:', err);
    }
  }
}

function initNowPlayingUI() {
  const overlayHTML = `
    <div id="np-overlay">
      <div id="np-background"></div>
      <div id="np-content">
        <div id="np-topbar">
          <button id="np-close">×</button>
        </div>
        <div id="np-center">
          <div id="np-art"></div>
          <div id="np-details">
            <a id="np-artist">Artist</a>
            <a id="np-title">Track Title</a>
          </div>
        </div>
        <div id="np-bottom">
          <div id="np-waveform-host"></div>
          <div id="np-fallback-bg"><div id="np-fallback-fill"></div></div>
          
          <div id="np-controls">
            <button class="np-btn" id="np-prev"><svg viewBox="0 0 24 24"><path d="M4.44444 3C4.19898 3 4 3.20147 4 3.45V20.55C4 20.7985 4.19898 21 4.44444 21H6.22222C6.46768 21 6.66667 20.7985 6.66667 20.55V12.5625L19.32 20.5697C19.616 20.757 20 20.5415 20 20.1881V3.81191C20 3.45847 19.616 3.24299 19.32 3.43031L6.66667 11.4375V3.45C6.66667 3.20147 6.46768 3 6.22222 3H4.44444Z" fill="currentColor"></path></svg></button>
            <button class="np-btn" id="np-play"><svg viewBox="0 0 24 24"><path d="M12.322 7.576a.5.5 0 0 1 0 .848l-6.557 4.098A.5.5 0 0 1 5 12.098V3.902a.5.5 0 0 1 .765-.424l6.557 4.098Z" fill="currentColor"></path></svg></button>
            <button class="np-btn" id="np-next"><svg viewBox="0 0 24 24"><path d="M17.7778 3C17.5323 3 17.3333 3.20147 17.3333 3.45V11.4375L4.68 3.43031C4.38398 3.24299 4 3.45847 4 3.81191V20.1881C4 20.5415 4.38398 20.757 4.68 20.5697L17.3333 12.5625V20.55C17.3333 20.7985 17.5323 21 17.7778 21H19.5556C19.801 21 20 20.7985 20 20.55V3.45C20 3.20147 19.801 3 19.5556 3H17.7778Z" fill="currentColor"></path></svg></button>
            <button class="np-btn" id="np-like" title="Like"><svg viewBox="0 0 16 16"><path d="M7.978 5c.653-1.334 1.644-2 2.972-2 1.992 0 3.405 1.657 2.971 4-.289 1.561-2.27 3.895-5.943 7C4.19 10.895 2.21 8.561 2.035 7c-.26-2.343.947-4 2.972-4 1.35 0 2.34.666 2.971 2z" fill="currentColor"></path></svg></button>
            <button class="np-btn" id="np-queue-btn" title="Queue"><svg viewBox="0 0 16 16"><path d="M4.3216 4.42401C4.63494 4.22818 4.63494 3.77185 4.3216 3.57601L1.765 1.97814C1.43198 1.77 1 2.00942 1 2.40214V5.59789C1 5.99061 1.43198 6.23003 1.765 6.02189L4.3216 4.42401Z" fill="currentColor"></path><path d="M7 4.75H15V3.25H7V4.75Z" fill="currentColor"></path><path d="M1 9.875H15V8.375H1V9.875Z" fill="currentColor"></path><path d="M15 15H1V13.5H15V15Z" fill="currentColor"></path></svg></button>
          </div>
          
          <div id="np-queue-host"></div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

function setupPersistentLogic() {
  const overlay = document.getElementById('np-overlay');
  const bg = document.getElementById('np-background');
  const art = document.getElementById('np-art');
  const titleEl = document.getElementById('np-title');
  const artistEl = document.getElementById('np-artist');
  const playBtn = document.getElementById('np-play');
  
  const waveformHost = document.getElementById('np-waveform-host');
  const queueHost = document.getElementById('np-queue-host');
  const fallbackBg = document.getElementById('np-fallback-bg');
  const fallbackFill = document.getElementById('np-fallback-fill');

  // DOM Moving Tracking Variables
  let originalWaveform = null;
  let waveformPlaceholder = null;
  let originalQueue = null;
  let queuePlaceholder = null;
  let idleTimer;

  // --- Remote Control DOM Moving Logic ---
  function dockWaveform() {
    const nativeWaveform = document.querySelector('.waveformWrapper');
    if (nativeWaveform && !originalWaveform) {
      waveformPlaceholder = document.createElement('div');
      nativeWaveform.parentNode.insertBefore(waveformPlaceholder, nativeWaveform);
      waveformHost.appendChild(nativeWaveform);
      originalWaveform = nativeWaveform;
      
      waveformHost.style.display = 'block';
      fallbackBg.style.display = 'none';
    } else if (!nativeWaveform && !originalWaveform) {
      waveformHost.style.display = 'none';
      fallbackBg.style.display = 'block';
    }
  }

  function undockElements() {
    // Put Waveform Back
    if (originalWaveform && waveformPlaceholder && waveformPlaceholder.parentNode) {
      waveformPlaceholder.parentNode.replaceChild(originalWaveform, waveformPlaceholder);
      originalWaveform = null;
      waveformPlaceholder = null;
    }
    // Put Queue Back
    if (originalQueue && queuePlaceholder && queuePlaceholder.parentNode) {
      queuePlaceholder.parentNode.replaceChild(originalQueue, queuePlaceholder);
      originalQueue = null;
      queuePlaceholder = null;
      
      // Tell SC to close native queue to keep state in sync
      const scQueueBtn = document.querySelector('.playbackSoundBadge__showQueue.m-active');
      if (scQueueBtn) scQueueBtn.click();
      overlay.classList.remove('show-queue');
    }
  }

  // SPA Route Change Listener (Undock elements before React unmounts them to prevent crashes)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (overlay.classList.contains('active')) {
        undockElements();
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // --- Idle Timer Logic ---
  const resetIdleTimer = () => {
    if (!overlay.classList.contains('active')) return;
    overlay.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => overlay.classList.add('idle'), 3000);
  };
  
  overlay.addEventListener('mousemove', resetIdleTimer);
  overlay.addEventListener('click', resetIdleTimer);

  // --- Overlay Toggle ---
  window.toggleOverlay = () => {
    overlay.classList.toggle('active');
    if (overlay.classList.contains('active')) {
      document.body.style.overflow = 'hidden'; 
      updateMetadata(); 
      dockWaveform();
      resetIdleTimer();
    } else {
      document.body.style.overflow = '';
      undockElements();
      clearTimeout(idleTimer);
    }
  };
  document.getElementById('np-close').onclick = () => window.toggleOverlay?.();

  // --- SPA Link Navigations (Minimise overlay and go to page) ---
  artistEl.onclick = (e) => {
    e.preventDefault();
    window.toggleOverlay?.(); 
    setTimeout(() => document.querySelector('.playbackSoundBadge__lightLink')?.click(), 0);
  };
  titleEl.onclick = (e) => {
    e.preventDefault();
    window.toggleOverlay?.();
    setTimeout(() => document.querySelector('.playbackSoundBadge__titleLink')?.click(), 0);
  };

  // --- P1: Proxy Clicks to Native SoundCloud Controls ---
  document.getElementById('np-prev').onclick = () => document.querySelector('.playControls__prev')?.click();
  document.getElementById('np-next').onclick = () => document.querySelector('.playControls__next')?.click();
  document.getElementById('np-play').onclick = () => document.querySelector('.playControls__play')?.click();
  document.getElementById('np-like').onclick = () => document.querySelector('.playbackSoundBadge__like')?.click();

  // --- P0: Queue Button Live Remote Logic ---
  document.getElementById('np-queue-btn').onclick = () => {
    const isQueueOpen = overlay.classList.contains('show-queue');
    
    // First, undock if already open
    if (originalQueue && queuePlaceholder) {
      queuePlaceholder.parentNode.replaceChild(originalQueue, queuePlaceholder);
      originalQueue = null;
    }
    
    // Toggle SoundCloud's native queue state
    document.querySelector('.playbackSoundBadge__showQueue')?.click();
    
    if (!isQueueOpen) {
      // Opening queue. Wait for SC React to render it, then dock it into our host.
      setTimeout(() => {
        const nativeQueue = document.querySelector('.playControls__queue .queue');
        if (nativeQueue) {
          queuePlaceholder = document.createElement('div');
          nativeQueue.parentNode.insertBefore(queuePlaceholder, nativeQueue);
          queueHost.appendChild(nativeQueue);
          originalQueue = nativeQueue;
          overlay.classList.add('show-queue');
        }
      }, 150); // slight delay to ensure React finishes mounting the DOM
    } else {
      overlay.classList.remove('show-queue');
    }
  };

  // --- Data Sync Function ---
  function updateMetadata() {
    const nativeArt = document.querySelector('.playbackSoundBadge__avatar span.sc-artwork');
    const nativeTitle = document.querySelector('.playbackSoundBadge__titleLink span[aria-hidden="true"]');
    const nativeArtist = document.querySelector('.playbackSoundBadge__lightLink');
    const playNode = document.querySelector('.playControls__play');
    
    // 1. Update Artwork & Background
    if (nativeArt && nativeArt.style.backgroundImage) {
      let url = nativeArt.style.backgroundImage.slice(5, -2);
      url = url.replace(/t\d+x\d+/, 't500x500');
      bg.style.backgroundImage = `url("${url}")`;
      art.style.backgroundImage = `url("${url}")`;
    }
    
    // 2. Update Text
    if (nativeTitle) titleEl.textContent = nativeTitle.textContent;
    if (nativeArtist) artistEl.textContent = nativeArtist.textContent;

    // 3. Update Play Button Icon
    if (playNode) {
      const isPlaying = playNode.classList.contains('playing');
      playBtn.innerHTML = isPlaying 
        ? `<svg viewBox="0 0 24 24"><path d="M10 4.5c0-.276-.252-.5-.563-.5H5.563C5.252 4 5 4.224 5 4.5v15c0 .276.252.5.563.5h3.875c.31 0 .562-.224.562-.5v-15ZM19 4.5c0-.276-.252-.5-.563-.5h-3.875c-.31 0-.562.224-.562.5v15c0 .276.252.5.563.5h3.874c.311 0 .563-.224.563-.5v-15Z" fill="currentColor"></path></svg>` 
        : `<svg viewBox="0 0 24 24"><path d="M12.322 7.576a.5.5 0 0 1 0 .848l-6.557 4.098A.5.5 0 0 1 5 12.098V3.902a.5.5 0 0 1 .765-.424l6.557 4.098Z" fill="currentColor"></path></svg>`;
    }

    // 4. Update Fallback Progress (Only needed if NOT on a track page with a waveform)
    if (!originalWaveform) {
      const progressNode = document.querySelector('.playbackTimeline__progressHandle'); 
      if (progressNode && progressNode.style.left) {
        fallbackFill.style.width = progressNode.style.left;
      }
    }
  }

  // --- Singleton Sync Observer ---
  const playControlsContainer = document.querySelector('.playControls');
  if (playControlsContainer) {
    const stateObserver = new MutationObserver(() => {
      if (overlay.classList.contains('active')) updateMetadata();
    });
    stateObserver.observe(playControlsContainer, { 
      subtree: true, attributes: true, attributeFilter: ['style', 'class'] 
    });
  }
}