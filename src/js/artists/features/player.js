
// Мини-плеер (singleton). Очередь, next/prev, автопереход, фиксы автоплея.

import { UISound } from "../lib/sound.js";

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

export function createMiniPlayer() {
  if (_instance) return _instance;

  // ---------- DOM ----------
  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner">
      <div class="am-player__frame"><div class="am-player__host" id="am-player-host"></div></div>

      <button class="am-player__close" type="button" aria-label="Close">×</button>

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
          <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open YouTube ↗</a>
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

// --- Drag handle (кнопка-«хват») ---
const dragHandle = document.createElement("button");
dragHandle.type = "button";
dragHandle.className = "am-player__drag";
dragHandle.setAttribute("aria-label", "Drag player");
dragHandle.textContent = "⋮⋮"; // можно заменить на иконку
dock.querySelector(".am-player__inner").appendChild(dragHandle);

// ——— Перетаскивание ———
(function enableDrag(el, handle){
  let dragging = false;
  let startX = 0, startY = 0;
  let startLeft = 0, startTop = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function toPixel(n){ return typeof n === "number" ? n : parseFloat(String(n||0)) || 0; }

  function switchToAbsoluteFromCurrentPosition(){
    // берём текущие координаты визуального расположения
    const r = el.getBoundingClientRect();
    // переводим плеер из режима bottom/left:50%/transform — в явные left/top
    el.style.left = `${Math.round(r.left)}px`;
    el.style.top  = `${Math.round(r.top)}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.transform = "translate(0,0)";
  }

  handle.addEventListener("pointerdown", (e) => {
    // ЛКМ/палец/перо
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    handle.setPointerCapture(e.pointerId);

    // если плеер ещё в «центровке» (left:50% + translate),
    // переведём его в абсолютные координаты, чтобы двигать свободно
    const st = getComputedStyle(el);
    const usingTranslateCenter = st.transform && st.transform !== "none" && st.left === "50%";
    if (usingTranslateCenter) switchToAbsoluteFromCurrentPosition();

    startX = e.clientX;
    startY = e.clientY;

    // фиксируем стартовые left/top
    const st2 = getComputedStyle(el);
    startLeft = toPixel(st2.left);
    startTop  = toPixel(st2.top);

    // чтобы скролл/даблтап не мешал на мобилках
    handle.style.touchAction = "none";
    document.body.style.userSelect = "none";
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // границы внутри вьюпорта
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let nextLeft = startLeft + dx;
    let nextTop  = startTop + dy;

    nextLeft = clamp(nextLeft, 8, vw - w - 8);
    nextTop  = clamp(nextTop, 8, vh - h - 8);

    el.style.left = `${Math.round(nextLeft)}px`;
    el.style.top  = `${Math.round(nextTop)}px`;
  });

  function endDrag(e){
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch {}
    handle.style.touchAction = "";
    document.body.style.userSelect = "";
    // запомним позицию
    localStorage.setItem("amplayer_pos", JSON.stringify({
      left: el.style.left, top: el.style.top
    }));
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // двойной клик по «хвату» — вернуть «как было» (по центру снизу)
  handle.addEventListener("dblclick", () => {
    el.style.left = "50%";
    el.style.right = "auto";
    el.style.bottom = "128px";
    el.style.top = "auto";
    el.style.transform = "translate(-50%, 0)";
    localStorage.removeItem("amplayer_pos");
  });

  // восстановление позиции при загрузке
  const saved = localStorage.getItem("amplayer_pos");
  if (saved) {
    try {
      const { left, top } = JSON.parse(saved);
      if (left && top) {
        el.style.left = left;
        el.style.top = top;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "translate(0,0)";
      }
    } catch {}
  }
})(dock, dragHandle);


  // refs
  const host    = dock.querySelector("#am-player-host");
  const btnClose= dock.querySelector(".am-player__close");
  const btnPlay = dock.querySelector(".am-player__play");
  const btnPrev = dock.querySelector(".am-player__prev");
  const btnNext = dock.querySelector(".am-player__next");
  const btnMute = dock.querySelector(".am-player__mute");
  const aYT     = dock.querySelector(".am-player__yt");
  const vol     = dock.querySelector(".am-player__slider");
  const prog    = dock.querySelector(".am-player__progress");
  const tCur    = dock.querySelector(".am-player__cur");
  const tDur    = dock.querySelector(".am-player__dur");

  // ---------- state ----------
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

  if (isIOS) {
    vol.disabled = true;
    vol.title = "On iOS the volume is hardware-only";
  }

  // ---------- UI ----------
  function uiShow(on) {
    if (on) {
      dock.classList.add("am-player--active");
      dock.style.pointerEvents = "auto";
    } else {
      dock.classList.remove("am-player--active");
      dock.style.pointerEvents = "";
    }
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

  // ---------- YT ----------
  function ensureYT(id, userGesture = false) {
    return loadYTAPI().then(() => {
      if (yt) { try { yt.destroy(); } catch {} yt = null; }
      host.innerHTML = `<div id="am-player-yt"></div>`;
      yt = new YT.Player("am-player-yt", {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: {
          autoplay: userGesture ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          enablejsapi: 1,
          origin: location.origin
        },
        events: {
          onReady: () => {
            ready = true;
            duration = yt.getDuration() || 0;
            uiSetTime(0, duration);
            try { if (!isIOS && typeof yt.setVolume === "function") yt.setVolume(volVal); } catch {}
            if (userGesture) { try { yt.unMute?.(); yt.playVideo?.(); } catch {} }
            uiPlayIcon(true);
            startTimer();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              uiPlayIcon(true);
              startTimer();
            } else if (e.data === YT.PlayerState.PAUSED) {
              uiPlayIcon(false);
              clearTimer();
            } else if (e.data === YT.PlayerState.ENDED) {
              uiPlayIcon(false);
              clearTimer();
              autoNext();
            }
          }
        }
      });
    });
  }

  // ---------- queue helpers ----------
  function playByIndex(idx, userGesture = false) {
    if (!queue.length) return;
    qi = clamp(idx, 0, queue.length - 1);
    const id = queue[qi];
    aYT.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    ready = false; duration = 0; clearTimer();
    return ensureYT(id, userGesture);
  }
  function autoNext() {
    if (!queue.length) return;
    if (qi < queue.length - 1) playByIndex(qi + 1, false);
    else if (loop) playByIndex(0, false);
  }

  // ---------- UI events (добавлены UISound.tap) ----------
  btnClose.addEventListener("click", () => {
    UISound?.tap?.();
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer();
    uiShow(false);
    queue = []; qi = -1;
  });

  btnPlay.addEventListener("click", () => {
    UISound?.tap?.();
    if (!ready || !yt) return;
    const s = yt.getPlayerState ? yt.getPlayerState() : -1;
    if (s === YT.PlayerState.PLAYING) { yt.pauseVideo?.(); uiPlayIcon(false); }
    else { yt.playVideo?.(); uiPlayIcon(true); }
  });

  btnPrev.addEventListener("click", () => {
    UISound?.tap?.();
    if (!queue.length) return;
    playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0), true);
  });

  btnNext.addEventListener("click", () => {
    UISound?.tap?.();
    if (!queue.length) return;
    playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi), true);
  });

  btnMute.addEventListener("click", () => {
    UISound?.tap?.();
    if (!yt) return;
    const willMute = !yt.isMuted?.();
    if (willMute) yt.mute?.(); else yt.unMute?.();
    uiMuteIcon(willMute);
  });

  vol.addEventListener("input", () => {
    // без звука, чтобы не раздражать при перетаскивании
    const v = Number(vol.value) || 0;
    if (!isIOS) yt?.setVolume?.(v);
    volVal = v;
    const nowMuted = v === 0;
    if (nowMuted && !yt?.isMuted?.()) yt?.mute?.();
    if (!nowMuted && yt?.isMuted?.()) yt?.unMute?.();
    uiMuteIcon(yt?.isMuted?.() ?? false);
  });

  prog.addEventListener("input", () => {
    // тихо
    userSeeking = true;
    const v = Number(prog.value) || 0;
    const sec = duration > 0 ? (v / 1000) * duration : 0;
    tCur.textContent = fmtTimeSec(sec);
  });
  prog.addEventListener("change", () => {
    UISound?.tap?.();
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
    aYT.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    await ensureYT(id, true);
  }

  async function openQueue(list, opts = {}) {
    const ids = (list || []).map(getYouTubeId).filter(Boolean);
    if (!ids.length) return;
    loop = !!opts.loop;
    queue = opts.shuffle ? shuffleArr(ids) : ids.slice();
    const start = clamp(Number(opts.startIndex ?? 0) || 0, 0, queue.length - 1);
    await playByIndex(start, true);
  }

  function next() { if (queue.length) playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi), true); }
  function prev() { if (queue.length) playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0), true); }
  function isActive() { return dock.classList.contains("am-player--active"); }
  function close() { const ev = new Event("click"); btnClose.dispatchEvent(ev); }
  function ensureAudible() { try { yt?.unMute?.(); yt?.playVideo?.(); } catch {} }

  _instance = { open, openQueue, next, prev, isActive, close, ensureAudible };
  return _instance;
}
