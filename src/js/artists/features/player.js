// src/js/artists/features/player.js
// Singleton YouTube мини-плеер: без дублей, устойчив к HMR (Vite).
let YT_READY_PROMISE = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (YT_READY_PROMISE) return YT_READY_PROMISE;
  YT_READY_PROMISE = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => reject(new Error("YT API load failed"));
    document.head.appendChild(s);
    const t = setTimeout(() => reject(new Error("YT API timeout")), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(t); resolve(); };
  });
  return YT_READY_PROMISE;
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const pad2 = (n)=>String(n|0).padStart(2,"0");
const fmt  = (s)=>{ s=Math.max(0,Math.round(s||0)); const m=(s/60|0), r=s%60; return `${m}:${pad2(r)}`; };
function getYTId(url){
  try{
    const u = new URL(url);
    if(/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
    if(u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    return m ? m[2] : "";
  }catch{ return ""; }
}

// ──────────────────────────────────────────────────────────────────────────────
// SINGLETON (переживает HMR):
let __AM_PLAYER_INSTANCE = window.__AM_PLAYER_INSTANCE || null;

export function createMiniPlayer(/* rootElNotUsed */) {
  // если уже создан — возвращаем тот же API, заодно подчистим возможные дубли DOM
  if (__AM_PLAYER_INSTANCE) {
    cleanupExtraDocks(__AM_PLAYER_INSTANCE.dock);
    return __AM_PLAYER_INSTANCE.api;
  }

  // перед созданием — удалим любые старые дубли (если остались после HMR/правок)
  cleanupExtraDocks();

  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner">
      <div class="am-player__frame">
        <div class="am-player__host" id="am-player-yt-host"></div>
      </div>
      <button class="am-player__close" type="button" aria-label="Close">×</button>
      <div class="am-player__bar">
        <div class="am-player__left">
          <button class="am-player__play" type="button" aria-label="Play/Pause">▶️</button>
          <span class="am-player__time"><b class="c">0:00</b> / <span class="d">0:00</span></span>
        </div>
        <div class="am-player__progresswrap">
          <input class="am-player__progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Seek">
        </div>
        <div class="am-player__right">
          <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" step="1" value="60" aria-label="Volume">
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  // refs
  const host        = dock.querySelector("#am-player-yt-host");
  const btnPlay     = dock.querySelector(".am-player__play");
  const btnMute     = dock.querySelector(".am-player__mute");
  const btnClose    = dock.querySelector(".am-player__close");
  const rngProgress = dock.querySelector(".am-player__progress");
  const rngVolume   = dock.querySelector(".am-player__slider");
  const timeCur     = dock.querySelector(".am-player__time .c");
  const timeDur     = dock.querySelector(".am-player__time .d");
  const openLink    = dock.querySelector(".am-player__yt");

  // state
  let player = null, duration = 0, timer = null;
  let wantedVol = 60, muted = false, draggingProgress = false;

  const setActive = (on)=>dock.classList.toggle("am-player--active", !!on);
  const clearTimer = ()=>{ if (timer) { clearInterval(timer); timer = null; } };
  const startTimer = ()=>{
    clearTimer();
    timer = setInterval(()=>{
      if (!player || draggingProgress) return;
      let cur = 0; try { cur = player.getCurrentTime?.() || 0; } catch {}
      timeCur.textContent = fmt(cur);
      const p = duration > 0 ? (cur/duration)*100 : 0;
      rngProgress.value = String(clamp(p,0,100));
    }, 250);
  };
  const destroyPlayer = ()=>{
    clearTimer();
    try { player?.stopVideo?.(); } catch {}
    try { player?.destroy?.(); } catch {}
    player = null;
  };

  function playPause(){
    if (!player) return;
    const st = player.getPlayerState?.();
    if (st === 1) { player.pauseVideo?.(); btnPlay.textContent = "▶️"; }
    else { player.playVideo?.(); btnPlay.textContent = "⏸"; }
  }
  function setVolume(vol){
    vol = clamp(vol|0, 0, 100);
    wantedVol = vol;
    if (isIOS) return; // на iOS программная громкость недоступна
    try { player?.setVolume?.(vol); } catch {}
    if (vol === 0) { muted = true; try{ player?.mute?.(); }catch{} btnMute.textContent = "🔇"; }
    else { if (muted){ muted=false; try{player?.unMute?.();}catch{} } btnMute.textContent = "🔈"; }
  }

  // UI handlers (вешаем ОДИН раз)
  btnPlay.addEventListener("click", playPause);
  btnMute.addEventListener("click", ()=>{
    if (!player) return;
    muted = !muted;
    if (muted) { player.mute?.(); btnMute.textContent = "🔇"; }
    else { player.unMute?.(); btnMute.textContent = "🔈"; if (!isIOS) player.setVolume?.(wantedVol); }
  });
  btnClose.addEventListener("click", ()=> api.close());

  rngVolume.addEventListener("input", (e)=> setVolume(Number(e.target.value)||0) );
  rngProgress.addEventListener("pointerdown", ()=> { draggingProgress = true; });
  rngProgress.addEventListener("pointerup",   ()=> { draggingProgress = false; });
  rngProgress.addEventListener("input", (e)=>{
    if (!player || duration <= 0) return;
    const p = Number(e.target.value) || 0;
    const t = clamp((p/100)*duration, 0, duration);
    try { player.seekTo?.(t, true); } catch {}
    timeCur.textContent = fmt(t);
  });

  async function open(youtubeUrl){
    const id = getYTId(youtubeUrl);
    if (!id) return;
    openLink.href = youtubeUrl;

    setActive(true);
    await loadYT();

    destroyPlayer();
    host.innerHTML = ""; // YT сам создаст iframe внутри host

    player = new YT.Player(host, {
      host: "https://www.youtube-nocookie.com",
      videoId: id,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1, controls: 0, origin: location.origin },
      events: {
        onReady: () => {
          try { duration = player.getDuration?.() || 0; } catch { duration = 0; }
          timeDur.textContent = fmt(duration);
          btnPlay.textContent = "⏸";
          if (!isIOS) setVolume(wantedVol);
          startTimer();
        },
        onStateChange: (e) => {
          const ps = e.data;
          if (ps === YT.PlayerState.PLAYING) btnPlay.textContent = "⏸";
          else if (ps === YT.PlayerState.PAUSED || ps === YT.PlayerState.ENDED) btnPlay.textContent = "▶️";
        }
      }
    });
  }

  function close(){ setActive(false); destroyPlayer(); }
  function isActive(){ return dock.classList.contains("am-player--active"); }

  const api = { open, close, isActive };
  __AM_PLAYER_INSTANCE = { api, dock };
  window.__AM_PLAYER_INSTANCE = __AM_PLAYER_INSTANCE; // пережить HMR
  return api;
}

// Удаляет лишние .am-player, оставляя только один (опционально — конкретный)
function cleanupExtraDocks(keepEl){
  const nodes = Array.from(document.querySelectorAll(".am-player"));
  if (!nodes.length) return;
  const toRemove = keepEl ? nodes.filter(n => n !== keepEl) : nodes;
  // если keepEl не передан — оставим только самый первый
  if (!keepEl && nodes.length) toRemove.shift();
  toRemove.forEach(n => n.remove());
}
