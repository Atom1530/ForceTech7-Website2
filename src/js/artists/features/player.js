// Мини-плеер с очередью, drag за верхнюю кромку, сворачивание в «пузырь».
// Пузырь появляется ТОЛЬКО когда плеер свёрнут, пульсирует при воспроизведении,
// замирает на паузе/стопе. Клик по пузырю раскрывает плеер. Перетаскивание пузыря
// НЕ раскрывает (порог по дистанции). Позиция пузыря запоминается.

let _instance = null;

/* ---------------- YT API ---------------- */
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

/* ---------------- Player ---------------- */
export function createMiniPlayer() {
  if (_instance) return _instance;

  // ---------- DOM ----------
  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner">
      <div class="am-player__dragzone" title="Drag player" aria-hidden="true"></div>
      <button class="am-player__drag" type="button" aria-label="Drag"></button>
      <button class="am-player__close" type="button" aria-label="Close">×</button>

      <div class="am-player__frame">
        <div class="am-player__host" id="am-player-host"></div>
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
          <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open YouTube ↗</a>
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
          <button class="am-player__hide" type="button" aria-label="Minimize">Hide</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  // Пузырь (свёрнутый режим)
  const bubble = document.createElement("button");
  bubble.className = "am-player__bubble is-paused";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Show player");
  bubble.innerHTML = `<span class="note">♪</span>`;
  bubble.hidden = true; // скрыт по умолчанию
  document.body.appendChild(bubble);

  // refs
  const host    = dock.querySelector("#am-player-host");
  const btnClose= dock.querySelector(".am-player__close");
  const btnPlay = dock.querySelector(".am-player__play");
  const btnPrev = dock.querySelector(".am-player__prev");
  const btnNext = dock.querySelector(".am-player__next");
  const btnMute = dock.querySelector(".am-player__mute");
  const btnHide = dock.querySelector(".am-player__hide");
  const aYT     = dock.querySelector(".am-player__yt");
  const vol     = dock.querySelector(".am-player__slider");
  const prog    = dock.querySelector(".am-player__progress");
  const tCur    = dock.querySelector(".am-player__cur");
  const tDur    = dock.querySelector(".am-player__dur");
  const dragzone= dock.querySelector(".am-player__dragzone");
  const dragBtn = dock.querySelector(".am-player__drag");

  // ---------- state ----------
  let yt = null;
  let ready = false;
  let duration = 0;
  let timer = null;
  let muted = false;
  let volVal = 60;
  let userSeeking = false;

  // очередь
  let queue = [];     // массив id
  let qi = -1;        // текущий индекс
  let loop = false;   // опционально

  // drag state (плеер)
  let dragging = false;
  let dragOffX = 0, dragOffY = 0;

  // drag state (bubble)
  let bDragging = false;
  let bStart = {x:0,y:0}, bWasDrag = false;

  if (isIOS) {
    vol.disabled = true;
    vol.title = "On iOS the volume is hardware-only";
  }

  /* ---------- UI helpers ---------- */
  function uiShow(on) {
    dock.classList.toggle("am-player--active", !!on);
    // когда плеер активен — пузырь скрываем
    bubble.hidden = !!on;
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
  function bubblePulse(isPlaying) {
    bubble.classList.toggle("is-paused", !isPlaying);
  }

  // при первом Hide ставим пузырь в низ по центру
  function placeBubbleInitial() {
    // если ранее позиция сохранена — восстановим
    const saved = localStorage.getItem("am.bubble.pos");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        bubble.style.left = p.left ?? "";
        bubble.style.top  = p.top  ?? "";
        bubble.style.right= p.right?? "24px";
        bubble.style.bottom=p.bottom?? "24px";
        return;
      } catch {}
    }
    // иначе — низ по центру
    bubble.style.left = "50%";
    bubble.style.right = "auto";
    bubble.style.bottom = "24px";
    bubble.style.top = "auto";
    bubble.style.transform = "translateX(-50%)";
  }
  function saveBubblePos() {
    const st = getComputedStyle(bubble);
    const pos = {
      left: st.left, top: st.top, right: st.right, bottom: st.bottom
    };
    localStorage.setItem("am.bubble.pos", JSON.stringify(pos));
  }

  /* ---------- YT ---------- */
  function ensureYT(id) {
    return loadYTAPI().then(() => {
      if (yt) { try { yt.destroy(); } catch {} yt = null; }
      host.innerHTML = `<div id="am-player-yt"></div>`;
      yt = new YT.Player("am-player-yt", {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, controls: 1, enablejsapi: 1, origin: location.origin },
        events: {
          onReady: () => {
            ready = true;
            duration = yt.getDuration() || 0;
            uiSetTime(0, duration);
            if (!isIOS && typeof yt.setVolume === "function") yt.setVolume(volVal);
            if (muted && yt.mute) yt.mute();
            uiPlayIcon(true);
            bubblePulse(true);
            startTimer();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              uiPlayIcon(true);
              bubblePulse(true);
              startTimer();
            } else if (e.data === YT.PlayerState.PAUSED) {
              uiPlayIcon(false);
              bubblePulse(false);
              clearTimer();
            } else if (e.data === YT.PlayerState.ENDED) {
              uiPlayIcon(false);
              bubblePulse(false);
              clearTimer();
              autoNext();
            }
          }
        }
      });
    });
  }

  /* ---------- queue helpers ---------- */
  function playByIndex(idx) {
    if (!queue.length) return;
    qi = clamp(idx, 0, queue.length - 1);
    const id = queue[qi];
    aYT.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    ready = false; duration = 0; clearTimer();
    return ensureYT(id);
  }
  function autoNext() {
    if (!queue.length) return;
    if (qi < queue.length - 1) playByIndex(qi + 1);
    else if (loop) playByIndex(0);
  }

  /* ---------- Drag p l a y e r (верхняя кромка) ---------- */
  function beginDrag(e) {
    dragging = true;
    dock.classList.add("am-player--free");
    const r = dock.getBoundingClientRect();
    let cx = (e.touches ? e.touches[0].clientX : e.clientX);
    let cy = (e.touches ? e.touches[0].clientY : e.clientY);
    // Переключаемся на абсолютные координаты (снимаем translate)
    dock.style.left = `${r.left}px`;
    dock.style.top  = `${r.top}px`;
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.style.transform = "none";

    dragOffX = cx - r.left;
    dragOffY = cy - r.top;

    dragzone.classList.add("dragging");
    document.addEventListener("mousemove", moveDrag);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchmove", moveDrag, { passive:false });
    document.addEventListener("touchend", endDrag);
    document.addEventListener("touchcancel", endDrag);
  }
  function moveDrag(e) {
    if (!dragging) return;
    e.preventDefault?.();
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = dock.getBoundingClientRect();
    let cx = (e.touches ? e.touches[0].clientX : e.clientX);
    let cy = (e.touches ? e.touches[0].clientY : e.clientY);
    let nx = clamp(cx - dragOffX, 12, vw - r.width - 12);
    let ny = clamp(cy - dragOffY, 12, vh - r.height - 12);
    dock.style.left = `${nx}px`;
    dock.style.top  = `${ny}px`;
  }
  function endDrag() {
    dragging = false;
    dragzone.classList.remove("dragging");
    document.removeEventListener("mousemove", moveDrag);
    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchmove", moveDrag);
    document.removeEventListener("touchend", endDrag);
    document.removeEventListener("touchcancel", endDrag);
  }
  dragzone.addEventListener("mousedown", beginDrag);
  dragzone.addEventListener("touchstart", beginDrag, { passive:true });
  dragBtn.addEventListener("mousedown", beginDrag);
  dragBtn.addEventListener("touchstart", beginDrag, { passive:true });

  /* ---------- Drag b u b b l e ---------- */
  function bubblePointerDown(e){
    bDragging = true; bWasDrag = false;
    const p = (e.touches ? e.touches[0] : e);
    bStart.x = p.clientX; bStart.y = p.clientY;
    document.addEventListener("mousemove", bubblePointerMove);
    document.addEventListener("mouseup", bubblePointerUp);
    document.addEventListener("touchmove", bubblePointerMove, { passive:false });
    document.addEventListener("touchend", bubblePointerUp);
  }
  function bubblePointerMove(e){
    if (!bDragging) return;
    e.preventDefault?.();
    const p = (e.touches ? e.touches[0] : e);
    const dx = p.clientX - bStart.x;
    const dy = p.clientY - bStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) bWasDrag = true;

    const r = bubble.getBoundingClientRect();
    let x = r.left + dx;
    let y = r.top  + dy;
    const vw = window.innerWidth, vh = window.innerHeight;

    // ограничим и применим абсолютные координаты
    x = clamp(x, 8, vw - r.width - 8);
    y = clamp(y, 8, vh - r.height - 8);

    bubble.style.left = `${x}px`;
    bubble.style.top  = `${y}px`;
    bubble.style.right = "auto";
    bubble.style.bottom= "auto";
    bubble.style.transform = "none";

    bStart.x = p.clientX;
    bStart.y = p.clientY;
  }
  function bubblePointerUp(){
    if (!bDragging) return;
    bDragging = false;
    document.removeEventListener("mousemove", bubblePointerMove);
    document.removeEventListener("mouseup", bubblePointerUp);
    document.removeEventListener("touchmove", bubblePointerMove);
    document.removeEventListener("touchend", bubblePointerUp);
    saveBubblePos();
  }
  bubble.addEventListener("mousedown", bubblePointerDown);
  bubble.addEventListener("touchstart", bubblePointerDown, { passive:true });
  bubble.addEventListener("click", (e) => {
    // если только что тянули — не раскрываем
    if (bWasDrag) { bWasDrag = false; return; }
    show(); // раскрыть плеер
  });

  /* ---------- UI events ---------- */
  btnClose.addEventListener("click", () => {
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer();
    uiShow(false);
    bubble.hidden = true;                // пузырь исчезает при полном закрытии
    bubblePulse(false);                  // и не пульсирует
    queue = []; qi = -1;
  });

  btnPlay.addEventListener("click", () => {
    if (!ready || !yt) return;
    const s = yt.getPlayerState ? yt.getPlayerState() : -1;
    if (s === YT.PlayerState.PLAYING) { yt.pauseVideo?.(); uiPlayIcon(false); bubblePulse(false); }
    else { yt.playVideo?.(); uiPlayIcon(true); bubblePulse(true); }
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
    if (!isIOS) yt?.setVolume?.(v);
    volVal = v;
    // слегка подмешаем громкость в амплитуду пульса пузыря
    const amp = 1.03 + Math.min(0.12, v/100 * 0.12);
    bubble.style.setProperty("--amp", String(amp));
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

  btnHide.addEventListener("click", () => minimize());

  /* ---------- Public API ---------- */
  async function open(urlOrId) {
    const id = getYouTubeId(urlOrId);
    if (!id) return;
    queue = [id]; qi = 0;
    aYT.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    bubble.hidden = true;      // при открытом плеере пузыря нет
    await ensureYT(id);
  }

  async function openQueue(list, opts = {}) {
    const ids = (list || []).map(getYouTubeId).filter(Boolean);
    if (!ids.length) return;
    loop = !!opts.loop;
    const arr = opts.shuffle ? shuffleArr(ids) : ids.slice();
    queue = arr;
    const start = clamp(Number(opts.startIndex ?? 0) || 0, 0, queue.length - 1);
    await playByIndex(start);
  }

  function next() { if (queue.length) playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi)); }
  function prev() { if (queue.length) playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0)); }

  function minimize() {
    // скрываем карточку, показываем пузырь (вниз по центру при первом сворачивании)
    dock.classList.add("am-player--min");
    bubble.hidden = false;
    placeBubbleInitial();
  }
  function show() {
    dock.classList.remove("am-player--min");
    uiShow(true);
  }

  function isActive() { return dock.classList.contains("am-player--active"); }
  function isPlaying() {
    try {
      return yt && yt.getPlayerState && yt.getPlayerState() === YT.PlayerState.PLAYING;
    } catch { return false; }
  }
  function close() { btnClose.click(); }

  _instance = { open, openQueue, next, prev, isActive, isPlaying, minimize, show, close };
  return _instance;
}
