

let _instance = null;

/* -------------------- YT API -------------------- */
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

/* -------------------- Экспорт: фабрика singleton -------------------- */
export function createMiniPlayer() {
  if (_instance) return _instance;

  /* ---------- DOM ---------- */
  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner">
      <div class="am-player__dragzone" aria-hidden="true" title="Drag the player"></div>

      <!-- Верхние кнопки: Hide слева от Close -->
      <button class="am-player__hide" type="button" aria-label="Hide">Hide</button>
      <button class="am-player__close" type="button" aria-label="Close">×</button>

      <div class="am-player__frame">
        <div class="am-player__host" id="am-player-host"></div>
        <!-- наша кнопка YouTube поверх кадра, влево-вверх -->
        <a class="am-player__ytlink" href="#" target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube">YouTube ↗</a>
      </div>

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
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  // плавающий пузырь создаём по требованию
  let bubble = null;

  // refs
  const host     = dock.querySelector("#am-player-host");
  const btnClose = dock.querySelector(".am-player__close");
  const btnHide  = dock.querySelector(".am-player__hide");
  const btnPlay  = dock.querySelector(".am-player__play");
  const btnPrev  = dock.querySelector(".am-player__prev");
  const btnNext  = dock.querySelector(".am-player__next");
  const btnMute  = dock.querySelector(".am-player__mute");
  const vol      = dock.querySelector(".am-player__slider");
  const prog     = dock.querySelector(".am-player__progress");
  const tCur     = dock.querySelector(".am-player__cur");
  const tDur     = dock.querySelector(".am-player__dur");
  const dragzone = dock.querySelector(".am-player__dragzone");
  const aYTlink  = dock.querySelector(".am-player__ytlink");

  /* ---------- state ---------- */
  let yt = null;
  let ready = false;
  let duration = 0;
  let timer = null;
  let muted = false;
  let volVal = 60;
  let userSeeking = false;

  // очередь
  let queue = [];
  let qi = -1;
  let loop = false;

  // позиция дока (free mode)
  const DOCK_KEY = "amPlayerPos";
  let dockDrag = null;

  // позиция пузыря
  const BUBBLE_KEY = "amBubblePos2";
  let bubbleDragging = false;
  let bubbleStart = null;
  let _bubblePos = null;

  // watchdog (если видео не стартовало)
  let watchdogId = null;

  if (isIOS) {
    vol.disabled = true;
    vol.title = "On iOS the volume is hardware-only";
  }

  /* ---------- UI helpers ---------- */
  function uiShow(on) {
    dock.classList.toggle("am-player--active", !!on);
    if (on) hideBubble();
  }
  function uiMin(on) {
    dock.classList.toggle("am-player--min", !!on);
    if (on) showBubble(true);
    else hideBubble();
  }
  function uiPlayIcon(isPlaying) { btnPlay.textContent = isPlaying ? "⏸" : "▶"; }
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
  function clearWatchdog() {
    if (watchdogId) { clearTimeout(watchdogId); watchdogId = null; }
  }

  

  /* ---------- YT ---------- */
  function skipWithDelay(ms = 2000) { setTimeout(autoNext, ms); }

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
            setBubblePulse(true);
            setBubbleAmp(volVal);
            startTimer();

            clearWatchdog();
            // если за 6с не ушло в PLAYING — скипаем
            watchdogId = setTimeout(() => {
              try {
                if (yt && yt.getPlayerState && yt.getPlayerState() !== YT.PlayerState.PLAYING) {
                  console.warn("Watchdog: видео не стартовало — пропускаем.");
                  setBubblePulse(false);
                  skipWithDelay(0);
                }
              } catch {}
            }, 6000);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              clearWatchdog();
              uiPlayIcon(true);
              setBubblePulse(true);
              startTimer();
            } else if (e.data === YT.PlayerState.PAUSED) {
              uiPlayIcon(false);
              setBubblePulse(false);
              clearTimer();
            } else if (e.data === YT.PlayerState.ENDED) {
              uiPlayIcon(false);
              setBubblePulse(false);
              clearTimer();
              clearWatchdog();
              autoNext();
            }
          },
          onError: (e) => {
            console.error("YT Player error:", e?.data);
            uiPlayIcon(false);
            setBubblePulse(false);
            clearTimer();
            clearWatchdog();
            skipWithDelay(1200);
          }
        }
      });
    });
  }

  /* ---------- Очередь ---------- */
  async function playByIndex(idx) {
    if (!queue.length) return;
    qi = clamp(idx, 0, queue.length - 1);
    const id = queue[qi];
    if (!id || !/^[\w-]{11}$/.test(id)) {
      console.warn("Некорректный YouTube ID, пропускаю:", id);
      return skipWithDelay(0);
    }
    // обновим ссылку «YouTube ↗»
    aYTlink.href = `https://www.youtube.com/watch?v=${id}`;

    uiShow(true);
    ready = false; duration = 0; clearTimer(); clearWatchdog();

    try {
      await ensureYT(id);
    } catch (err) {
      console.error("Не удалось воспроизвести:", id, err);
      skipWithDelay(1200);
    }
  }
  function autoNext() {
    if (!queue.length) return;
    if (qi < queue.length - 1) playByIndex(qi + 1);
    else if (loop) playByIndex(0);
  }

  /* ---------- Перетаскивание ДОКА ---------- */
  function getVP() {
    const w = window.visualViewport?.width || document.documentElement.clientWidth || window.innerWidth;
    const h = window.visualViewport?.height || document.documentElement.clientHeight || window.innerHeight;
    return { w, h };
  }
  function clampDock() {
    if (!dock.classList.contains("am-player--free")) return;
    const rect = dock.getBoundingClientRect();
    const { w, h } = getVP();
    let left = clamp(rect.left, 8, Math.max(8, w - rect.width - 8));
    let top  = clamp(rect.top,  8, Math.max(8, h - rect.height - 8));
    dock.style.left = `${left}px`;
    dock.style.top  = `${top}px`;
    try { localStorage.setItem(DOCK_KEY, JSON.stringify({ left, top })); } catch {}
  }
  function restoreDockPos() {
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(DOCK_KEY) || "null"); } catch {}
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      dock.classList.add("am-player--free");
      dock.style.transform = "none";
      dock.style.left = `${pos.left}px`;
      dock.style.top  = `${pos.top}px`;
      dock.style.right = "auto";
      dock.style.bottom = "auto";
      clampDock();
    } else {
      dock.classList.remove("am-player--free");
      dock.style.left = "";
      dock.style.top  = "";
      dock.style.right = "";
      dock.style.bottom = "";
      dock.style.transform = "";
    }
  }
  function beginDockDrag(e) {
    if (!dock.classList.contains("am-player--free")) {
      const r = dock.getBoundingClientRect();
      dock.classList.add("am-player--free");
      dock.style.transform = "none";
      dock.style.left = `${r.left}px`;
      dock.style.top  = `${r.top}px`;
      dock.style.right = "auto";
      dock.style.bottom = "auto";
    }
    dockDrag = {
      startX: e.clientX,
      startY: e.clientY,
      baseLeft: parseFloat(dock.style.left || "0"),
      baseTop:  parseFloat(dock.style.top || "0"),
    };
    dragzone.classList.add("dragging");
    try { dragzone.setPointerCapture?.(e.pointerId); } catch {}
  }
  function moveDockDrag(e) {
    if (!dockDrag) return;
    let left = dockDrag.baseLeft + (e.clientX - dockDrag.startX);
    let top  = dockDrag.baseTop  + (e.clientY - dockDrag.startY);
    const r = dock.getBoundingClientRect();
    const { w, h } = getVP();
    left = clamp(left, 8, Math.max(8, w - r.width - 8));
    top  = clamp(top,  8, Math.max(8, h - r.height - 8));
    dock.style.left = `${left}px`;
    dock.style.top  = `${top}px`;
  }
  function endDockDrag(e) {
    if (!dockDrag) return;
    try { dragzone.releasePointerCapture?.(e.pointerId); } catch {}
    dragzone.classList.remove("dragging");
    dockDrag = null;
    clampDock();
  }

  dragzone.addEventListener("pointerdown", beginDockDrag);
  window.addEventListener("pointermove", moveDockDrag);
  window.addEventListener("pointerup", endDockDrag);
  window.addEventListener("resize", clampDock);
  window.visualViewport?.addEventListener("resize", clampDock);
  window.addEventListener("orientationchange", clampDock);

  /* ---------- ПУЗЫРЬ ---------- */
  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement("button");
    bubble.className = "am-player__bubble is-paused";
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Open player");
    bubble.style.display = "none";
    bubble.style.left = "auto";
    bubble.style.top = "auto";
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    bubble.innerHTML = `<span class="note">♪</span>`;
    document.body.appendChild(bubble);

    bubble.addEventListener("pointerdown", (e) => {
      bubbleDragging = false;
      try { bubble.setPointerCapture(e.pointerId); } catch {}
      const r = bubble.getBoundingClientRect();
      bubbleStart = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    });
    bubble.addEventListener("pointermove", (e) => {
      if (!bubbleStart) return;
      const dx = e.clientX - bubbleStart.x;
      const dy = e.clientY - bubbleStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) bubbleDragging = true;
      const nx = (bubbleStart.left + dx) | 0;
      const ny = (bubbleStart.top  + dy) | 0;
      bubble.style.right = "auto";
      bubble.style.bottom = "auto";
      bubble.style.left = `${nx}px`;
      bubble.style.top  = `${ny}px`;
    });
    bubble.addEventListener("pointerup", (e) => {
      try { bubble.releasePointerCapture(e.pointerId); } catch {}
      if (!bubbleDragging) { uiMin(false); } // клик — раскрыть
      clampBubbleToViewport();
      persistBubblePos();
      bubbleStart = null;
      bubbleDragging = false;
    });

    return bubble;
  }

  function getStableWH() {
    const w = document.documentElement.clientWidth || window.innerWidth;
    const h = document.documentElement.clientHeight || window.innerHeight;
    return { w, h };
  }
  function saveBubblePos(left, top, width, height) {
    const { w, h } = getStableWH();
    const rw = Math.max(1, w - width);
    const rh = Math.max(1, h - height);
    _bubblePos = {
      left, top, width, height,
      rx: clamp(left / rw, 0, 1),
      ry: clamp(top  / rh, 0, 1)
    };
    try { localStorage.setItem(BUBBLE_KEY, JSON.stringify(_bubblePos)); } catch {}
  }
  function loadBubblePos() {
    if (_bubblePos && Number.isFinite(_bubblePos.left) && Number.isFinite(_bubblePos.top)) return _bubblePos;
    try {
      const obj = JSON.parse(localStorage.getItem(BUBBLE_KEY) || "null");
      if (obj && Number.isFinite(obj.rx) && Number.isFinite(obj.ry)) return obj;
    } catch {}
    return null;
  }
  function fromRatioToPx(pos, fallback = 64) {
    const { w, h } = getStableWH();
    const bw = pos?.width  || fallback;
    const bh = pos?.height || fallback;
    const rw = Math.max(1, w - bw);
    const rh = Math.max(1, h - bh);
    const left = clamp(Math.round((pos?.rx ?? 0.5) * rw), 8, rw);
    const top  = clamp(Math.round((pos?.ry ?? 0.8) * rh), 8, rh);
    return { left, top };
  }
  function showBubble(useSaved = true) {
    const b = ensureBubble();
    b.style.right = "auto";
    b.style.bottom = "auto";
    b.style.display = "grid";

    const r0 = b.getBoundingClientRect();
    let pos = useSaved ? loadBubblePos() : null;
    let left, top;
    if (pos) {
      const p = fromRatioToPx(pos, r0.width || 64);
      left = p.left; top = p.top;
    } else {
      const { w, h } = getVP();
      const size = r0.width || 64;
      left = Math.max(8, Math.round((w - size) / 2));
      top  = Math.max(8, Math.round(h - size - 24));
    }
    b.style.left = `${left}px`;
    b.style.top  = `${top}px`;
    clampBubbleToViewport();
    persistBubblePos();
  }
  function hideBubble() { if (bubble) bubble.style.display = "none"; }
  function setBubblePulse(isPlaying) {
    const b = ensureBubble();
    b.classList.toggle("is-paused", !isPlaying);
  }
  function setBubbleAmp(v) {
    const b = ensureBubble();
    const amp = 1.02 + (Math.max(0, Math.min(100, v)) / 100) * 0.08;
    b.style.setProperty("--amp", amp.toFixed(3));
  }
  function clampBubbleToViewport(margin = 8) {
    if (!bubble || bubble.style.display === "none") return;
    const { w, h } = getVP();
    const r = bubble.getBoundingClientRect();
    let left = clamp(r.left, margin, Math.max(margin, w - r.width - margin));
    let top  = clamp(r.top,  margin, Math.max(margin, h - r.height - margin));
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    bubble.style.left = `${left}px`;
    bubble.style.top  = `${top}px`;
  }
  function persistBubblePos() {
    if (!bubble || bubble.style.display === "none") return;
    const r = bubble.getBoundingClientRect();
    saveBubblePos(r.left, r.top, r.width, r.height);
  }
  window.addEventListener("resize", () => { clampBubbleToViewport(); persistBubblePos(); });
  window.visualViewport?.addEventListener("resize", () => { clampBubbleToViewport(); persistBubblePos(); });
  window.addEventListener("orientationchange", () => { clampBubbleToViewport(); persistBubblePos(); });

  /* ---------- Кнопки UI ---------- */
  btnClose.addEventListener("click", () => {
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer(); clearWatchdog();
    uiShow(false);
    uiMin(false);
    queue = []; qi = -1;
    setBubblePulse(false);
  });

  btnHide.addEventListener("click", () => { uiMin(true); });

  // Ссылка YouTube ↗: перед навигацией — выключаем плеер
  aYTlink.addEventListener("click", () => {
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer(); clearWatchdog();
    uiShow(false);
    uiMin(false);
    queue = []; qi = -1;
    setBubblePulse(false);
    // дальше браузер откроет ссылку в новой вкладке
  });

  btnPlay.addEventListener("click", () => {
    if (!ready || !yt) return;
    const s = yt.getPlayerState ? yt.getPlayerState() : -1;
    if (s === YT.PlayerState.PLAYING) {
      yt.pauseVideo?.(); uiPlayIcon(false); setBubblePulse(false);
    } else {
      yt.playVideo?.();  uiPlayIcon(true);  setBubblePulse(true);
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
    if (!isIOS) yt?.setVolume?.(v);
    if (v === 0 && !muted) { muted = true; yt?.mute?.(); uiMuteIcon(true); }
    else if (v > 0 && muted) { muted = false; yt?.unMute?.(); uiMuteIcon(false); }
    setBubbleAmp(v);
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

  /* ---------- Публичное API ---------- */
  async function open(urlOrId) {
    const id = getYouTubeId(urlOrId);
    if (!id) return;
    queue = [id]; qi = 0;
    uiMin(false); uiShow(true);
    restoreDockPos();
    await playByIndex(0);
  }
  async function openQueue(list, opts = {}) {
    const ids = (list || []).map(getYouTubeId).filter(Boolean);
    if (!ids.length) return;
    loop = !!opts.loop;
    const arr = opts.shuffle ? shuffleArr(ids) : ids.slice();
    queue = arr;
    const start = clamp(Number(opts.startIndex ?? 0) || 0, 0, queue.length - 1);
    uiMin(false); uiShow(true);
    restoreDockPos();
    await playByIndex(start);
  }
  function next() { if (queue.length) playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi)); }
  function prev() { if (queue.length) playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0)); }
  function isActive() { return dock.classList.contains("am-player--active") && !dock.classList.contains("am-player--min"); }
  function minimize() { uiMin(true); }
  function close() { btnClose.click(); }

  _instance = { open, openQueue, next, prev, minimize, isActive, close };
  return _instance;
}
