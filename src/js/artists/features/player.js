
// Мини-плеер (singleton). Поддержка очереди, next/prev, автоследования.

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
  let queue = [];     // массив id
  let qi = -1;        // текущий индекс
  let loop = false;   // по желанию
  // (shuffle применяем один раз при установке очереди)

  if (isIOS) {
    vol.disabled = true;
    vol.title = "On iOS the volume is hardware-only";
  }

  // ---------- UI ----------
  function uiShow(on) { dock.classList.toggle("am-player--active", !!on); }
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

  // ---------- UI events ----------
  btnClose.addEventListener("click", () => {
    try { yt?.stopVideo?.(); yt?.destroy?.(); } catch {}
    yt = null; ready = false; duration = 0; clearTimer();
    uiShow(false);
    queue = []; qi = -1;
  });

  btnPlay.addEventListener("click", () => {
    if (!ready || !yt) return;
    const s = yt.getPlayerState ? yt.getPlayerState() : -1;
    if (s === YT.PlayerState.PLAYING) { yt.pauseVideo?.(); uiPlayIcon(false); }
    else { yt.playVideo?.(); uiPlayIcon(true); }
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
    aYT.href = `https://www.youtube.com/watch?v=${id}`;
    uiShow(true);
    await ensureYT(id);
  }

  async function openQueue(list, opts = {}) {
    const ids = (list || [])
      .map(getYouTubeId)
      .filter(Boolean);
    if (!ids.length) return;
    loop = !!opts.loop;
    const arr = opts.shuffle ? shuffleArr(ids) : ids.slice();
    queue = arr;
    const start = clamp(Number(opts.startIndex ?? 0) || 0, 0, queue.length - 1);
    await playByIndex(start);
  }

  function next() { if (queue.length) playByIndex(qi < queue.length - 1 ? qi + 1 : (loop ? 0 : qi)); }
  function prev() { if (queue.length) playByIndex(qi > 0 ? qi - 1 : (loop ? queue.length - 1 : 0)); }
  function isActive() { return dock.classList.contains("am-player--active"); }
  function close() { btnClose.click(); }

  _instance = { open, openQueue, next, prev, isActive, close };
  return _instance;
}

