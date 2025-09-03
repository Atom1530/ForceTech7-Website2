// Мини-плеер (singleton): очередь, next/prev, автоследование,
// drag карточки, свёрнутый режим (bubble) с запоминанием позиции,
// верхняя левая ссылка "YouTube" (закрывает плеер при клике).

let _instance = null;

function loadYTAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (loadYTAPI._p) return loadYTAPI._p;
  loadYTAPI._p = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => rej(new Error("YT API load failed"));
    document.head.appendChild(s);
    const t = setTimeout(() => rej(new Error("YT API timeout")), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(t); res(); };
  });
  return loadYTAPI._p;
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
function getYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const u = new URL(urlOrId);
    if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    return m ? m[2] : "";
  } catch { return ""; }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shuffleArr = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function fmtTimeSec(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ——— bubble position persistence ———
const BUBBLE_KEY = "amBubblePos";
function saveBubblePos(left, top) {
  try { localStorage.setItem(BUBBLE_KEY, JSON.stringify({ left, top })); } catch {}
}
function loadBubblePos() {
  try { return JSON.parse(localStorage.getItem(BUBBLE_KEY) || "null"); } catch { return null; }
}

export function createMiniPlayer() {
  if (_instance) return _instance;

  // ---------- DOM ----------
  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner">
      <!-- верхняя зона для drag -->
      <div class="am-player__dragzone" aria-hidden="true"></div>

      <!-- кнопки в правом верхнем углу -->
      <button class="am-player__drag" type="button" aria-label="Drag"></button>
      <button class="am-player__hide am-player__hide--floating" type="button" aria-label="Minimize">Hide</button>
      <button class="am-player__close" type="button" aria-label="Close">×</button>

      <!-- видео -->
      <div class="am-player__frame">
        <div class="am-player__host" id="am-player-host"></div>

        <!-- наша верхняя левая "YouTube" ссылка (ниже drag-зоны) -->
        <a class="am-player__ytlink" href="#" target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube">YouTube ↗</a>
      </div>

      <!-- нижняя панель -->
      <div class="am-player__bar">
        <div class="am-player__left">
          <button class="am-player__skip am-player__prev" type="button" aria-label="Previous">⏮</button>
          <button class="am-player__play" type="button" aria-label="Play/Pause">▶</button>
          <button class="am-player__skip am-player__next" type="button" aria-label="Next">⏭</button>
          <span class="am-player__time"><span class="am-player__cur">0:00</span> / <span class="am-player__dur">0:00</span></span>
        </div>

        <div class="am-player__progresswrap">
          <input class="am-player__progress" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">
        </div>

        <div class="am-player__right">
          <!-- нижнюю ссылку YouTube удалили -->
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  // пузырь (свёрнутый режим)
  let bubble = null;
  let bubbleDragging = false;
  let bubbleStart = null;

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement("button");
    bubble.className = "am-player__bubble is-paused";
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Open player");
    bubble.style.display = "none"; // по умолчанию скрыта
    bubble.innerHTML = `<span class="note">♪</span>`;
    document.body.appendChild(bubble);

    // drag bubble
    bubble.addEventListener("pointerdown", (e) => {
      bubbleDragging = false;
      bubble.setPointerCapture(e.pointerId);
      bubbleStart = { x: e.clientX, y: e.clientY };
      bubble.dataset.bx = String(bubble.offsetLeft);
      bubble.dataset.by = String(bubble.offsetTop);
    });
    bubble.addEventListener("pointermove", (e) => {
      if (!bubbleStart) return;
      const dx = e.clientX - bubbleStart.x;
      const dy = e.clientY - bubbleStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) bubbleDragging = true;
      const nx = (parseFloat(bubble.dataset.bx || "0") + dx) | 0;
      const ny = (parseFloat(bubble.dataset.by || "0") + dy) | 0;
      bubble.style.left = `${nx}px`;
      bubble.style.top  = `${ny}px`;
    });
    bubble.addEventListener("pointerup", (e) => {
      try { bubble.releasePointerCapture(e.pointerId); } catch {}
      if (!bubbleDragging) { restoreFromBubble(); }
      const rect = bubble.getBoundingClientRect();
      saveBubblePos(rect.left, rect.top);
      bubbleStart = null;
      bubbleDragging = false;
      clampBubbleToViewport();
    });

    return bubble;
  }

  function showBubble(useSaved = true) {
    const b = ensureBubble();
    let left, top;
    if (useSaved) {
      const saved = loadBubblePos();
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        left = saved.left; top = saved.top;
      }
    }
    // если нет сохранённой — центр-низ
    if (left == null || top == null) {
      const vpW = (window.visualViewport?.width || window.innerWidth);
      const vpH = (window.visualViewport?.height || window.innerHeight);
      const size = 64; // базовый размер пузыря из CSS
      left = (vpW - size) / 2;
      top  = vpH - size - 24;
    }
    b.style.left = `${left | 0}px`;
    b.style.top  = `${top | 0}px`;
    b.style.display = "grid";
    clampBubbleToViewport();
  }
  function hideBubble() {
    if (bubble) bubble.style.display = "none";
  }
  function setBubblePulse(isPlaying) {
    const b = ensureBubble();
    b.classList.toggle("is-paused", !isPlaying);
  }
  function setBubbleAmp(volVal) {
    const b = ensureBubble();
    const amp = 1.02 + (Math.max(0, Math.min(100, volVal)) / 100) * 0.08;
    b.style.setProperty("--amp", amp.toFixed(3));
  }
  function clampBubbleToViewport(margin = 8) {
    if (!bubble || bubble.style.display === "none") return;
    const vpW = (window.visualViewport?.width || window.innerWidth);
    const vpH = (window.visualViewport?.height || window.innerHeight);
    const r = bubble.getBoundingClientRect();
    let left = r.left, top = r.top;
    const maxLeft = vpW - r.width - margin;
    const maxTop  = vpH - r.height - margin;
    left = Math.max(margin, Math.min(left, Math.max(margin, maxLeft)));
    top  = Math.max(margin, Math.min(top,  Math.max(margin, maxTop)));
    bubble.style.left = `${left}px`;
    bubble.style.top  = `${top}px`;
  }

  // refs
  const host     = dock.querySelector("#am-player-host");
  const dragZone = dock.querySelector(".am-player__dragzone");
  const dragBtn  = dock.querySelector(".am-player__drag");
  const btnClose = dock.querySelector(".am-player__close");
  const btnHide  = dock.querySelector(".am-player__hide");
  const ytLink   = dock.querySelector(".am-player__ytlink");

  const btnPlay  = dock.querySelector(".am-player__play");
  const btnPrev  = dock.querySelector(".am-player__prev");
  const btnNext  = dock.querySelector(".am-player__next");
  const btnMute  = dock.querySelector(".am-player__mute");
  const vol      = dock.querySelector(".am-player__slider");
  const prog     = dock.querySelector(".am-player__progress");
  const tCur     = dock.querySelector(".am-player__cur");
  const tDur     = dock.querySelector(".am-player__dur");

  // ---------- state ----------
  let yt = null;
  let ready = false;
  let isPlaying = false;
  let duration = 0;
  let timer = null;
  let muted = false;
  let volVal = 60;
  let userSeeking = false;

  // drag state (карточка)
  let dragActive = false;
  let dragStart = null;
  let dockStart = null;

  // очередь
  let queue = [];
  let qi = -1;
  let loop = false;

  if (isIOS) { vol.disabled = true; vol.title = "On iOS the volume is hardware-only"; }

  // ---------- UI ----------
  function uiShow(on) {
    dock.classList.toggle("am-player--active", !!on);
    if (on) hideBubble();
  }
  function uiPlayIcon(play) { btnPlay.textContent = play ? "⏸" : "▶"; }
  function uiMuteIcon(isMuted) { btnMute.textContent = isMuted ? "🔇" : "🔈"; }
  function uiSetTime(cur, dur) {
    tCur.textContent = fmtTimeSec(cur);
    tDur.textContent = fmtTimeSec(dur);
    if (!userSeeking) {
      const v = dur > 0 ? Math.round((cur / dur) * 1000) : 0;
      prog.value = String(v);
    }
  }
  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    clearTimer();
    timer = setInterval(() => {
      if (!ready || !yt || typeof yt.getCurrentTime !== "function") return;
      const cur = yt.getCurrentTime() || 0;
      const dur = duration || yt.getDuration() || 0;
      duration = dur;
      uiSetTime(cur, dur);
    }, 250);
  }

  // ---------- YT ----------
  function ensureYT(id) {
    return loadYTAPI().then(() => {
      if (yt) { try { yt.destroy(); } catch {} yt = null; }
      host.innerHTML = `<div id="am-player-yt"></div>`;
      yt = new YT.Player("am-player-yt", {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: {
          autoplay: 1, rel: 0, modestbranding: 1, controls: 1, enablejsapi: 1, origin: location.origin
        },
        events: {
          onReady: () => {
            ready = true;
            duration = yt.getDuration() || 0;
            uiSetTime(0, duration);
            if (!isIOS && typeof yt.setVolume === "function") yt.setVolume(volVal);
            if (muted && yt.mute) yt.mute();
            uiPlayIcon(true);
            isPlaying = true;
            setBubblePulse(true);
            setBubbleAmp(volVal);
            startTimer();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              uiPlayIcon(true);
              isPlaying = true;
              setBubblePulse(true);
              startTimer();
            } else if (e.data === YT.PlayerState.PAUSED) {
              uiPlayIcon(false);
              isPlaying = false;
              setBubblePulse(false);
              clearTimer();
            } else if (e.data === YT.PlayerState.ENDED) {
              uiPlayIcon(false);
              isPlaying = false;
              setBubblePulse(false);
              clearTimer();
              autoNext();
              window.dispatchEvent(new CustomEvent("amplayer:ended", { detail: { id } }));
            }
          }
        }
      });
    });
  }

  // ---------- queue helpers ----------
  function playByIndex(idx) {
    if (!queue.length) return;
    qi = clamp(idx, 0, queue.length - 1);
    const id = queue[qi];
    // выставляем ссылку для верхней левой "YouTube"
    if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    ready = false; duration = 0; clearTimer();
    return ensureYT(id);
  }
  function autoNext() {
    if (!queue.length) return;
    if (qi < queue.length - 1) playByIndex(qi + 1);
    else if (loop) playByIndex(0);
  }

  // ---------- Drag карточки ----------
  function onDragStart(e) {
    dragActive = true;
    dock.classList.add("am-player--free");
    const r = dock.getBoundingClientRect();
    dock.style.left = `${r.left}px`;
    dock.style.top  = `${r.top}px`;
    dock.style.transform = "none";
    dragStart = { x: e.clientX, y: e.clientY };
    dockStart = { left: r.left, top: r.top };
    (e.currentTarget === dragZone ? dragZone : dragBtn).classList.add("dragging");
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }
  function onDragMove(e) {
    if (!dragActive || !dragStart || !dockStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dock.style.left = `${(dockStart.left + dx) | 0}px`;
    dock.style.top  = `${(dockStart.top + dy) | 0}px`;
  }
  function clampDockToViewport(margin = 8) {
    const vpW = (window.visualViewport?.width || window.innerWidth);
    const vpH = (window.visualViewport?.height || window.innerHeight);
    const r = dock.getBoundingClientRect();
    let left = r.left, top = r.top;
    const maxLeft = vpW - r.width - margin;
    const maxTop  = vpH - r.height - margin;
    left = Math.max(margin, Math.min(left, Math.max(margin, maxLeft)));
    top  = Math.max(margin, Math.min(top,  Math.max(margin, maxTop)));
    dock.style.left = `${left}px`;
    dock.style.top  = `${top}px`;
  }
  function onDragEnd(e) {
    dragActive = false;
    (dragZone.classList.contains("dragging") ? dragZone : dragBtn).classList.remove("dragging");
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    clampDockToViewport(8);
  }

  [dragZone, dragBtn].forEach(el => {
    el.addEventListener("pointerdown", onDragStart);
    el.addEventListener("pointermove", onDragMove);
    el.addEventListener("pointerup", onDragEnd);
    el.addEventListener("pointercancel", onDragEnd);
  });

  // ресайз/эмуляция
  function onViewportChange() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (dock.classList.contains("am-player--free")) clampDockToViewport(8);
        clampBubbleToViewport(8);
      });
    });
  }
  window.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);

  // ---------- UI events ----------
  btnClose.addEventListener("click", () => {
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer();
    isPlaying = false;
    uiPlayIcon(false);
    uiShow(false);
    hideBubble(); // закрываем полностью — пузыря тоже нет
    queue = []; qi = -1;
  });

  btnHide.addEventListener("click", () => {
    uiShow(false);
    showBubble(true);      // показываем в сохранённом месте
    setBubbleAmp(volVal);
    setBubblePulse(isPlaying);
  });

  function restoreFromBubble() {
    uiShow(true);
    hideBubble();
  }

  // верхняя левая "YouTube": открываем и закрываем плеер
  ytLink.addEventListener("click", (e) => {
    const url = ytLink.getAttribute("href");
    if (!url) return;
    e.preventDefault();
    // открыть в новой вкладке
    window.open(url, "_blank", "noopener,noreferrer");
    // полностью закрыть плеер (и скрыть пузырь)
    btnClose.click();
  });

  btnPlay.addEventListener("click", () => {
    if (!ready || !yt) return;
    const s = yt.getPlayerState ? yt.getPlayerState() : -1;
    if (s === YT.PlayerState.PLAYING) {
      yt.pauseVideo?.();
      isPlaying = false;
      setBubblePulse(false);
      uiPlayIcon(false);
    } else {
      yt.playVideo?.();
      isPlaying = true;
      setBubblePulse(true);
      uiPlayIcon(true);
    }
  });

  btnPrev.addEventListener("click", () => {
    if (!queue.length) return;
    playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0));
  });

  btnNext.addEventListener("click", () => {
    if (!queue.length) return;
    playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi));
  });

  btnMute.addEventListener("click", () => {
    if (!yt) return;
    muted = !muted;
    if (muted) yt.mute?.(); else yt.unMute?.();
    uiMuteIcon(muted);
  });

  vol.addEventListener("input", () => {
    const v = Number(vol.value) || 0;
    volVal = v;
    setBubbleAmp(volVal);
    if (!isIOS) yt?.setVolume?.(v);
    if (v === 0 && !muted) { muted = true; yt?.mute?.(); uiMuteIcon(true); }
    else if (v > 0 && muted) { muted = false; yt?.unMute?.(); uiMuteIcon(false); }
  });

  prog.addEventListener("input", () => {
    userSeeking = true;
    const v = Number(prog.value) || 0;
    const sec = duration > 0 ? (v / 1000) * duration : 0;
    tCur.textContent = fmtTimeSec(sec);
  });
  prog.addEventListener("change", () => {
    userSeeking = false;
    if (!yt || !duration) return;
    const v = Number(prog.value) || 0;
    const sec = (v / 1000) * duration;
    yt.seekTo?.(sec, true);
  });

  // ---------- Public API ----------
  async function open(urlOrId) {
    const id = getYouTubeId(urlOrId);
    if (!id) return;
    queue = [id]; qi = 0;
    if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    hideBubble();
    await ensureYT(id);
  }

  async function openQueue(list, opts = {}) {
    const ids = (list || []).map(getYouTubeId).filter(Boolean);
    if (!ids.length) return;
    loop = !!opts.loop;
    const arr = opts.shuffle ? shuffleArr(ids) : ids.slice();
    queue = arr;
    const start = clamp(Number(opts.startIndex ?? 0) || 0, 0, queue.length - 1);
    hideBubble();
    await playByIndex(start);
  }

  function next() { if (queue.length) playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi)); }
  function prev() { if (queue.length) playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0)); }
  function isActive() { return dock.classList.contains("am-player--active"); }
  function close() { btnClose.click(); }

  _instance = { open, openQueue, next, prev, isActive, close };
  return _instance;
}
