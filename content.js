// ============================================================
// STATE
// ============================================================
const playerState = {
  trackId: null,
  title: '',
  artist: '',
  artwork: '',
  isPlaying: false,
  isLiked: false,
  duration: 0,
  currentTime: 0,
};

let activeQueueOwner = null; // 'overlay' | 'mini'
let originalWaveform = null, waveformPlaceholder = null;
let originalQueue = null, queuePlaceholder = null;
let waveformResizeObserver = null;
let idleTimer = null;
let upNextToastShownFor = null;
let nextTrackCache = { title: '', artist: '', artwork: '' };
let buttonCheckScheduled = false;
let lastUrl = location.href;

// ============================================================
// BOOT
// ============================================================
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
  const badgeActions = document.querySelector('.playbackSoundBadge__actions');
  if (!badgeActions) return;

  if (!document.getElementById('np-overlay')) {
    initNowPlayingUI();
    setupPersistentLogic();
  }

  if (!document.getElementById('np-toggle-btn')) {
    const btn = makeBtn('np-toggle-btn', 'Now Playing',
      `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M2 2v4h1.5V3.5H7V2H2zm9 0v1.5h3.5V7H16V2h-5zM2 14h5v-1.5H3.5V9H2v5zm12.5-1.5H11V14h5V9h-1.5v3.5z"/></svg>`);
    btn.onclick = () => toggleOverlay();
    badgeActions.appendChild(btn);
  }

  if (!document.getElementById('np-mini-toggle-btn')) {
    const btn = makeBtn('np-mini-toggle-btn', 'Mini Player',
      `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3zm8 6v3h4V9H9z"/></svg>`);
    btn.onclick = () => toggleMiniPlayer();
    badgeActions.appendChild(btn);
  }
}

function makeBtn(id, title, iconHtml) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.title = title;
  btn.className = 'sc-button sc-button-small sc-button-icon sc-button-secondary';
  btn.innerHTML = iconHtml;
  return btn;
}

// ============================================================
// SVG ASSETS
// ============================================================
const SVG = {
  prev: `<svg viewBox="0 0 24 24"><path d="M4.444 3C4.2 3 4 3.201 4 3.45V20.55C4 20.799 4.2 21 4.444 21H6.222C6.468 21 6.667 20.799 6.667 20.55V12.563L19.32 20.57C19.616 20.757 20 20.542 20 20.188V3.812C20 3.458 19.616 3.243 19.32 3.43L6.667 11.438V3.45C6.667 3.201 6.468 3 6.222 3H4.444Z" fill="currentColor"/></svg>`,
  next: `<svg viewBox="0 0 24 24"><path d="M17.778 3C17.532 3 17.333 3.201 17.333 3.45V11.438L4.68 3.43C4.384 3.243 4 3.458 4 3.812V20.188C4 20.542 4.384 20.757 4.68 20.57L17.333 12.563V20.55C17.333 20.799 17.532 21 17.778 21H19.556C19.801 21 20 20.799 20 20.55V3.45C20 3.201 19.801 3 19.556 3H17.778Z" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M12.322 7.576a.5.5 0 0 1 0 .848l-6.557 4.098A.5.5 0 0 1 5 12.098V3.902a.5.5 0 0 1 .765-.424l6.557 4.098Z" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><path d="M10 4.5c0-.276-.252-.5-.563-.5H5.563C5.252 4 5 4.224 5 4.5v15c0 .276.252.5.563.5h3.875c.31 0 .562-.224.562-.5v-15ZM19 4.5c0-.276-.252-.5-.563-.5h-3.875c-.31 0-.562.224-.562.5v15c0 .276.252.5.563.5h3.874c.311 0 .563-.224.563-.5v-15Z" fill="currentColor"/></svg>`,
  like: `<svg viewBox="0 0 16 16"><path d="M7.978 5c.653-1.334 1.644-2 2.972-2 1.992 0 3.405 1.657 2.971 4-.289 1.561-2.27 3.895-5.943 7C4.19 10.895 2.21 8.561 2.035 7c-.26-2.343.947-4 2.972-4 1.35 0 2.34.666 2.971 2z" fill="currentColor"/></svg>`,
  queue: `<svg viewBox="0 0 16 16"><path d="M4.322 4.424C4.635 4.228 4.635 3.772 4.322 3.576L1.765 1.978C1.432 1.77 1 2.009 1 2.402V5.598C1 5.991 1.432 6.23 1.765 6.022L4.322 4.424Z" fill="currentColor"/><path d="M7 4.75H15V3.25H7V4.75Z" fill="currentColor"/><path d="M1 9.875H15V8.375H1V9.875Z" fill="currentColor"/><path d="M15 15H1V13.5H15V15Z" fill="currentColor"/></svg>`,
  expand: `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M2 2v4h1.5V3.5H7V2H2zm9 0v1.5h3.5V7H16V2h-5zM2 14h5v-1.5H3.5V9H2v5zm12.5-1.5H11V14h5V9h-1.5v3.5z"/></svg>`,
  mini: `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3zm8 6v3h4V9H9z"/></svg>`,
};

function controlsHtml(prefix) {
  return `
    <button class="np-btn" id="${prefix}-prev" title="Previous">${SVG.prev}</button>
    <button class="np-btn np-play-btn" id="${prefix}-play" title="Play/Pause">${SVG.play}</button>
    <button class="np-btn" id="${prefix}-next" title="Next">${SVG.next}</button>
    <button class="np-btn" id="${prefix}-like" title="Like">${SVG.like}</button>
    <button class="np-btn" id="${prefix}-queue-btn" title="Queue">${SVG.queue}</button>
  `;
}

// ============================================================
// DOM BUILD
// ============================================================
function initNowPlayingUI() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="np-overlay">
      <div id="np-background"></div>
      <div id="np-content">
        <div id="np-topbar">
          <button id="np-to-mini" class="np-btn" title="Switch to Mini Player">${SVG.mini}</button>
          <button id="np-close" title="Close">×</button>
        </div>
        <div id="np-center">
          <div id="np-art"></div>
          <div id="np-details">
            <a id="np-artist" href="#">Artist</a>
            <a id="np-title" href="#">Track Title</a>
          </div>
        </div>
        <div id="np-bottom">
          <div id="np-waveform-host"></div>
          <div id="np-fallback-bg"><div id="np-fallback-fill"></div></div>
          <div id="np-controls">${controlsHtml('np')}</div>
          <div id="np-queue-host"></div>
        </div>
      </div>
    </div>

    <div id="np-mini">
      <div id="np-mini-bg"></div>
      <div id="np-mini-inner">
        <div id="np-mini-header">
          <div id="np-mini-art"></div>
          <div id="np-mini-meta">
            <div id="np-mini-title"></div>
            <div id="np-mini-artist"></div>
          </div>
          <button id="np-mini-expand" class="np-btn" title="Expand to full view">${SVG.expand}</button>
          <button id="np-mini-close" class="np-btn" title="Close">×</button>
        </div>
        <div id="np-mini-controls">${controlsHtml('np-mini')}</div>
        <div id="np-mini-queue-host"></div>
      </div>
    </div>
  `);
}

// ============================================================
// MAIN LOGIC
// ============================================================
function setupPersistentLogic() {
  const overlay = document.getElementById('np-overlay');
  const bg = document.getElementById('np-background');
  const art = document.getElementById('np-art');
  const titleEl = document.getElementById('np-title');
  const artistEl = document.getElementById('np-artist');
  const fallbackBg = document.getElementById('np-fallback-bg');
  const fallbackFill = document.getElementById('np-fallback-fill');
  const waveformHost = document.getElementById('np-waveform-host');
  const queueHost = document.getElementById('np-queue-host');

  const mini = document.getElementById('np-mini');
  const miniBg = document.getElementById('np-mini-bg');
  const miniArt = document.getElementById('np-mini-art');
  const miniTitle = document.getElementById('np-mini-title');
  const miniArtist = document.getElementById('np-mini-artist');
  const miniQueueHost = document.getElementById('np-mini-queue-host');

  // ----------------------------------------------------------
  // WAVEFORM DOCK / UNDOCK  (P0 drift fix)
  // ----------------------------------------------------------
  function dockWaveform() {
    const nativeWaveform = document.querySelector('.waveformWrapper');
    if (nativeWaveform && !originalWaveform) {
      waveformPlaceholder = document.createElement('div');
      nativeWaveform.parentNode.insertBefore(waveformPlaceholder, nativeWaveform);
      waveformHost.appendChild(nativeWaveform);
      originalWaveform = nativeWaveform;
      waveformHost.style.display = 'block';
      fallbackBg.style.display = 'none';

      // Force SC to recalculate its cached bounding rects after the DOM move.
      // Without this, SC's waveform hover math uses stale coordinates from before
      // appendChild() relocated the element, causing the exponential cursor drift.
      requestAnimationFrame(() => {
        void nativeWaveform.getBoundingClientRect(); // flush layout
        window.dispatchEvent(new Event('resize'));
      });

      if (!waveformResizeObserver) {
        waveformResizeObserver = new ResizeObserver(() => {
          if (originalWaveform) window.dispatchEvent(new Event('resize'));
        });
        waveformResizeObserver.observe(waveformHost);
      }
    } else if (!nativeWaveform) {
      waveformHost.style.display = 'none';
      fallbackBg.style.display = 'block';
    }
  }

  function undockWaveform() {
    if (originalWaveform && waveformPlaceholder?.parentNode) {
      waveformPlaceholder.parentNode.replaceChild(originalWaveform, waveformPlaceholder);
      originalWaveform = null;
      waveformPlaceholder = null;
    }
  }

  // ----------------------------------------------------------
  // QUEUE DOCK / UNDOCK
  // ----------------------------------------------------------
  function getQueueHost(owner) {
    return owner === 'mini' ? miniQueueHost : queueHost;
  }

  function dockQueue(owner) {
    // Relocate if already docked elsewhere
    if (originalQueue && queuePlaceholder?.parentNode) {
      queuePlaceholder.parentNode.replaceChild(originalQueue, queuePlaceholder);
      originalQueue = null;
      queuePlaceholder = null;
    }
    const nativeQueue = document.querySelector('.playControls__queue .queue');
    if (!nativeQueue) return false;

    queuePlaceholder = document.createElement('div');
    nativeQueue.parentNode.insertBefore(queuePlaceholder, nativeQueue);
    getQueueHost(owner).appendChild(nativeQueue);
    originalQueue = nativeQueue;
    activeQueueOwner = owner;
    updateNextTrackCache();
    return true;
  }

  function undockQueue(silent) {
    if (originalQueue && queuePlaceholder?.parentNode) {
      queuePlaceholder.parentNode.replaceChild(originalQueue, queuePlaceholder);
      originalQueue = null;
      queuePlaceholder = null;
    }
    const prev = activeQueueOwner;
    activeQueueOwner = null;
    overlay.classList.remove('show-queue');
    mini.classList.remove('show-queue');

    // Sync SC queue button state
    if (!silent) {
      const scQueueBtn = document.querySelector('.playbackSoundBadge__showQueue.m-active');
      if (scQueueBtn) scQueueBtn.click();
    }
    return prev;
  }

  // ----------------------------------------------------------
  // QUEUE TOGGLE
  // ----------------------------------------------------------
  function toggleQueue(owner) {
    if (activeQueueOwner === owner) {
      undockQueue();
      return;
    }
    // Transfer ownership if open elsewhere
    if (activeQueueOwner && activeQueueOwner !== owner) {
      const other = activeQueueOwner === 'overlay' ? overlay : mini;
      other.classList.remove('show-queue');
      dockQueue(owner);
      if (owner === 'overlay') overlay.classList.add('show-queue');
      else mini.classList.add('show-queue');
      return;
    }
    // Open SC queue first if not already open
    const isNativeOpen = !!document.querySelector('.playControls__queue .queue');
    if (!isNativeOpen) document.querySelector('.playbackSoundBadge__showQueue')?.click();

    setTimeout(() => {
      if (dockQueue(owner)) {
        if (owner === 'overlay') overlay.classList.add('show-queue');
        else mini.classList.add('show-queue');
      }
    }, 150);
  }

  // ----------------------------------------------------------
  // NEXT TRACK CACHE
  // ----------------------------------------------------------
  function updateNextTrackCache() {
    const items = document.querySelectorAll('.queueItemView');
    let foundActive = false;
    nextTrackCache = { title: '', artist: '', artwork: '' };
    for (const item of items) {
      if (foundActive) {
        nextTrackCache.title = item.querySelector('.queueItemView__title a')?.textContent?.trim() || '';
        nextTrackCache.artist = item.querySelector('.queueItemView__username')?.textContent?.trim() || '';
        const artEl = item.querySelector('.queueItemView__artworkImage .sc-artwork');
        if (artEl?.style.backgroundImage) {
          nextTrackCache.artwork = artEl.style.backgroundImage.slice(5, -2).replace(/t\d+x\d+/, 't50x50');
        }
        break;
      }
      if (item.classList.contains('m-active')) foundActive = true;
    }
  }

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  function setState(patch) {
    const prev = { ...playerState };
    Object.assign(playerState, patch);
    renderFromState(prev, playerState);
  }

  function renderFromState(prev, next) {
    const trackChanged = prev.trackId !== next.trackId && next.trackId !== null;

    if (trackChanged) {
      overlay.classList.add('np-transitioning');
      mini.classList.add('np-transitioning');
      setTimeout(() => {
        applyVisuals(next);
        overlay.classList.remove('np-transitioning');
        mini.classList.remove('np-transitioning');
      }, 150);
      upNextToastShownFor = null;
      updateNextTrackCache();
    } else if (prev.artwork !== next.artwork) {
      applyVisuals(next);
    } else {
      // Always keep text in sync even without a track change
      titleEl.textContent = next.title || '';
      artistEl.textContent = next.artist || '';
      miniTitle.textContent = next.title || '';
      miniArtist.textContent = next.artist || '';
    }

    if (prev.isPlaying !== next.isPlaying) syncPlayPause(next.isPlaying);
    if (prev.isLiked !== next.isLiked) syncLike(next.isLiked);

    if (!originalWaveform && next.duration > 0) {
      fallbackFill.style.width = ((next.currentTime / next.duration) * 100) + '%';
    }

    checkUpNextToast();
  }

  function applyVisuals(state) {
    if (state.artwork) {
      const url500 = state.artwork.replace(/t\d+x\d+/, 't500x500');
      const url50  = state.artwork.replace(/t\d+x\d+/, 't50x50');
      bg.style.backgroundImage = `url("${url500}")`;
      art.style.backgroundImage = `url("${url500}")`;
      miniBg.style.backgroundImage = `url("${url500}")`;
      miniArt.style.backgroundImage = `url("${url50}")`;
    }
    titleEl.textContent = state.title || '';
    artistEl.textContent = state.artist || '';
    miniTitle.textContent = state.title || '';
    miniArtist.textContent = state.artist || '';
  }

  function syncPlayPause(isPlaying) {
    const icon = isPlaying ? SVG.pause : SVG.play;
    document.getElementById('np-play').innerHTML = icon;
    document.getElementById('np-mini-play').innerHTML = icon;
  }

  function syncLike(isLiked) {
    document.getElementById('np-like').classList.toggle('np-liked', isLiked);
    document.getElementById('np-mini-like').classList.toggle('np-liked', isLiked);
  }

  // ----------------------------------------------------------
  // DOM → STATE SYNC
  // ----------------------------------------------------------
  function syncFromDOM() {
    const nativeArt    = document.querySelector('.playbackSoundBadge__avatar span.sc-artwork');
    const nativeTitleA = document.querySelector('.playbackSoundBadge__titleLink');
    const nativeArtistA = document.querySelector('.playbackSoundBadge__lightLink');
    const playNode     = document.querySelector('.playControls__play');
    const likeNode     = document.querySelector('.playbackSoundBadge__like');
    const progressWrap = document.querySelector('.playbackTimeline__progressWrapper');

    const artwork    = nativeArt?.style.backgroundImage?.slice(5, -2) || '';
    // The title link href is the most stable unique track identifier
    const trackId    = nativeTitleA?.href || artwork || null;
    const title      = nativeTitleA?.querySelector('span[aria-hidden="true"]')?.textContent?.trim()
                    || nativeTitleA?.textContent?.trim() || '';
    const artist     = nativeArtistA?.textContent?.trim() || '';
    const isPlaying  = playNode?.classList.contains('playing') || false;
    const isLiked    = likeNode?.classList.contains('sc-button-selected') || false;
    // aria-valuenow / aria-valuemax give exact seconds without string parsing
    const currentTime = parseInt(progressWrap?.getAttribute('aria-valuenow')) || 0;
    const duration    = parseInt(progressWrap?.getAttribute('aria-valuemax')) || 0;

    setState({ trackId, title, artist, artwork, isPlaying, isLiked, currentTime, duration });
  }

  // ----------------------------------------------------------
  // UP NEXT TOAST
  // ----------------------------------------------------------
  function checkUpNextToast() {
    const { duration, currentTime, trackId } = playerState;
    if (!duration || !currentTime) return;
    const remaining = duration - currentTime;
    if (remaining > 10 || remaining <= 0) return;
    if (upNextToastShownFor === trackId) return;
    upNextToastShownFor = trackId;

    if (nextTrackCache.title) {
      showUpNextToast(nextTrackCache);
      return;
    }
    // Try to briefly open the queue to read next track, then close it
    const wasOpen = !!document.querySelector('.playControls__queue .queue');
    if (!wasOpen) {
      document.querySelector('.playbackSoundBadge__showQueue')?.click();
      requestAnimationFrame(() => {
        updateNextTrackCache();
        if (nextTrackCache.title) showUpNextToast(nextTrackCache);
        document.querySelector('.playbackSoundBadge__showQueue')?.click();
      });
    }
  }

  function showUpNextToast(track) {
    let wrapper = document.getElementById('gritter-notice-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'gritter-notice-wrapper';
      wrapper.className = 'top-right';
      document.body.appendChild(wrapper);
    }
    document.getElementById('np-up-next-toast')?.remove();

    const item = document.createElement('div');
    item.id = 'np-up-next-toast';
    item.className = 'gritter-item-wrapper oneLine';
    item.setAttribute('role', 'alert');
    item.innerHTML = `
      <div class="gritter-top"></div>
      <div class="gritter-item">
        <a class="gritter-close" href="#" tabindex="1" style="display:none">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.94 8l-4.47 4.47 1.06 1.06L8 9.06l4.47 4.47 1.06-1.06L9.06 8l4.47-4.47-1.06-1.06L8 6.94 3.53 2.47 2.47 3.53 6.94 8z" fill="currentColor"></path></svg>
        </a>
        ${track.artwork ? `<img src="${esc(track.artwork)}" class="gritter-image" alt="">` : ''}
        <div class="gritter-with-image">
          <span class="gritter-title">${esc(track.title)}</span>
          <p></p>
          <p class="sc-text-secondary">Up Next${track.artist ? ` · ${esc(track.artist)}` : ''}</p>
          <p></p>
        </div>
        <div style="clear:both"></div>
      </div>
      <div class="gritter-bottom"></div>
    `;
    wrapper.appendChild(item);
    setTimeout(() => {
      item.style.transition = 'opacity 0.4s ease';
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 400);
    }, 4000);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ----------------------------------------------------------
  // IDLE TIMER  (1 s, opacity-based so queue state is preserved)
  // ----------------------------------------------------------
  function resetIdleTimer() {
    if (!overlay.classList.contains('active')) return;
    overlay.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => overlay.classList.add('idle'), 1000);
  }
  overlay.addEventListener('mousemove', resetIdleTimer);
  overlay.addEventListener('click', resetIdleTimer);

  // ----------------------------------------------------------
  // OVERLAY TOGGLE
  // ----------------------------------------------------------
  function toggleOverlay() {
    if (overlay.classList.contains('active')) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      undockWaveform();
      if (activeQueueOwner === 'overlay') undockQueue(true);
      clearTimeout(idleTimer);
    } else {
      syncFromDOM();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      dockWaveform();
      resetIdleTimer();
    }
  }
  window.toggleOverlay = toggleOverlay;
  document.getElementById('np-close').onclick = toggleOverlay;
  document.getElementById('np-to-mini').onclick = () => {
    toggleOverlay();
    if (!mini.classList.contains('active')) toggleMiniPlayer();
  };

  // ----------------------------------------------------------
  // MINI PLAYER TOGGLE
  // ----------------------------------------------------------
  function toggleMiniPlayer() {
    if (mini.classList.contains('active')) {
      mini.classList.remove('active');
      if (activeQueueOwner === 'mini') undockQueue(true);
      saveMiniState();
    } else {
      restoreMiniState();
      syncFromDOM();
      mini.classList.add('active');
      saveMiniState();
    }
  }
  window.toggleMiniPlayer = toggleMiniPlayer;
  document.getElementById('np-mini-close').onclick = toggleMiniPlayer;
  document.getElementById('np-mini-expand').onclick = () => {
    toggleMiniPlayer();
    if (!overlay.classList.contains('active')) toggleOverlay();
  };

  // ----------------------------------------------------------
  // CONTROL WIRING  (proxy → native SC)
  // ----------------------------------------------------------
  [['prev', '.playControls__prev'], ['next', '.playControls__next'],
   ['play', '.playControls__play']].forEach(([name, sel]) => {
    const handler = () => document.querySelector(sel)?.click();
    document.getElementById(`np-${name}`).onclick = handler;
    document.getElementById(`np-mini-${name}`).onclick = handler;
  });

  const likeHandler = () => document.querySelector('.playbackSoundBadge__like')?.click();
  document.getElementById('np-like').onclick = likeHandler;
  document.getElementById('np-mini-like').onclick = likeHandler;

  document.getElementById('np-queue-btn').onclick = () => toggleQueue('overlay');
  document.getElementById('np-mini-queue-btn').onclick = () => toggleQueue('mini');

  // SPA link navigation
  artistEl.onclick = (e) => {
    e.preventDefault();
    toggleOverlay();
    setTimeout(() => document.querySelector('.playbackSoundBadge__lightLink')?.click(), 0);
  };
  titleEl.onclick = (e) => {
    e.preventDefault();
    toggleOverlay();
    setTimeout(() => document.querySelector('.playbackSoundBadge__titleLink')?.click(), 0);
  };

  // ----------------------------------------------------------
  // MINI PLAYER DRAG
  // ----------------------------------------------------------
  const miniHeader = document.getElementById('np-mini-header');
  let dragging = false, dragStartX, dragStartY, dragStartL, dragStartT;

  miniHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    const rect = mini.getBoundingClientRect();
    dragStartL = rect.left; dragStartT = rect.top;
    mini.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const newL = Math.max(0, Math.min(window.innerWidth - mini.offsetWidth, dragStartL + e.clientX - dragStartX));
    const newT = Math.max(0, Math.min(window.innerHeight - mini.offsetHeight, dragStartT + e.clientY - dragStartY));
    mini.style.left = newL + 'px';
    mini.style.top = newT + 'px';
    mini.style.right = 'auto';
    mini.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    mini.style.transition = '';
    saveMiniState();
  });

  // Save dimensions on resize (CSS resize: both)
  new ResizeObserver(() => saveMiniState()).observe(mini);

  // ----------------------------------------------------------
  // MINI STATE PERSISTENCE
  // ----------------------------------------------------------
  function saveMiniState() {
    localStorage.setItem('npMiniOpen',   mini.classList.contains('active'));
    if (mini.style.left)  localStorage.setItem('npMiniX', mini.style.left);
    if (mini.style.top)   localStorage.setItem('npMiniY', mini.style.top);
    localStorage.setItem('npMiniW', mini.offsetWidth + 'px');
    localStorage.setItem('npMiniH', mini.offsetHeight + 'px');
  }

  function restoreMiniState() {
    const x = localStorage.getItem('npMiniX');
    const y = localStorage.getItem('npMiniY');
    const w = localStorage.getItem('npMiniW');
    const h = localStorage.getItem('npMiniH');
    if (x) { mini.style.left = x; mini.style.right = 'auto'; }
    if (y) { mini.style.top  = y; mini.style.bottom = 'auto'; }
    if (w) mini.style.width  = w;
    if (h) mini.style.height = h;
  }

  // Restore mini-player if it was open before a page refresh
  if (localStorage.getItem('npMiniOpen') === 'true') {
    restoreMiniState();
    setTimeout(() => {
      mini.classList.add('active');
      syncFromDOM();
    }, 600);
  }

  // ----------------------------------------------------------
  // SC STATE OBSERVER (single observer for play controls + badge)
  // ----------------------------------------------------------
  function attachObservers() {
    const playControls = document.querySelector('.playControls');
    const soundBadge   = document.querySelector('.playbackSoundBadge');
    if (!playControls && !soundBadge) return;

    const obs = new MutationObserver(() => {
      if (overlay.classList.contains('active') || mini.classList.contains('active')) {
        syncFromDOM();
      }
    });
    const opts = { subtree: true, attributes: true, attributeFilter: ['style', 'class'] };
    if (playControls) obs.observe(playControls, opts);
    if (soundBadge)   obs.observe(soundBadge, { ...opts, childList: true });
  }
  attachObservers();

  // Re-attach observers after SPA navigations (controls re-mount)
  let obsAttachTimer;
  const spaObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Undock everything before React destroys the nodes
      if (overlay.classList.contains('active')) {
        undockWaveform();
        if (activeQueueOwner === 'overlay') undockQueue(true);
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
      if (activeQueueOwner === 'mini') undockQueue(true);
      clearTimeout(obsAttachTimer);
      obsAttachTimer = setTimeout(attachObservers, 500);
    }
  });
  spaObserver.observe(document.body, { childList: true, subtree: true });
}
