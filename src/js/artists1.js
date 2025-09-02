// artists1.js
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

const SPRITE = "/img/sprite.svg";

/* ================== UISound: мягкий «клац» ================== */
const UISound = (() => {
  let ctx, master, comp, postLP;
  let inited = false;
  function init() {
    if (inited) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 22;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.08;

    postLP = ctx.createBiquadFilter();
    postLP.type = "lowpass";
    postLP.frequency.value = 2300;
    postLP.Q.value = 0.6;

    master = ctx.createGain();
    master.gain.value = 0.11;

    master.connect(postLP);
    postLP.connect(comp);
    comp.connect(ctx.destination);
    inited = true;
  }
  function resume(){ if (ctx && ctx.state === "suspended") ctx.resume(); }
  function tap(){
    if (!inited) init();
    if (!ctx) return;
    resume();
    const now = ctx.currentTime + 0.004;

    const durNoise = 0.055;
    const nsrc = ctx.createBufferSource();
    const nbuf = ctx.createBuffer(1, Math.max(32, (ctx.sampleRate * durNoise) | 0), ctx.sampleRate);
    const ch = nbuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) {
      const t = i / ch.length;
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
    }
    nsrc.buffer = nbuf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2050; bp.Q.value = 0.9;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 360; hp.Q.value = 0.7;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.linearRampToValueAtTime(0.45, now + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    nsrc.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(master);
    nsrc.start(now); nsrc.stop(now + 0.06);

    const osc = ctx.createOscillator();
    osc.type = "triangle"; osc.frequency.setValueAtTime(2100, now);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.linearRampToValueAtTime(0.20, now + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(og); og.connect(master);
    osc.start(now); osc.stop(now + 0.055);

    const low = ctx.createOscillator();
    low.type = "sine"; low.frequency.setValueAtTime(165, now);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0.0001, now);
    lg.gain.linearRampToValueAtTime(0.05, now + 0.003);
    lg.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
    low.connect(lg); lg.connect(master);
    low.start(now); low.stop(now + 0.045);
  }
  function page(){
    if (!inited) init();
    if (!ctx) return;
    resume();
    const now = ctx.currentTime + 0.003;
    const osc = ctx.createOscillator();
    osc.type = "triangle"; osc.frequency.setValueAtTime(1750, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.17, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now + 0.065);
  }
  const unlock = () => { init(); resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
  return { tap, page };
})();

/* ================= Toast helper ================= */
(function initToast() {
  if (window.__toast) return;
  const box = document.createElement("div");
  box.className = "toast-container";
  document.body.appendChild(box);
  const show = (message, kind = "info", timeout = 3000) => {
    const item = document.createElement("div");
    item.className = `toast toast--${kind}`;
    item.setAttribute("role", "status");
    item.textContent = String(message || "");
    box.appendChild(item);
    const t = setTimeout(() => {
      item.classList.add("toast--hide");
      item.addEventListener("animationend", () => item.remove(), { once: true });
    }, timeout);
    item.addEventListener("click", () => {
      clearTimeout(t);
      item.classList.add("toast--hide");
      item.addEventListener("animationend", () => item.remove(), { once: true });
    });
  };
  window.__toast = {
    show,
    info: (m, t) => show(m, "info", t),
    success: (m, t) => show(m, "success", t),
    error: (m, t) => show(m, "error", t),
  };
})();

/* ================= Scroll lock (модалка) ================= */
let __scrollY = 0;
function lockScroll() {
  __scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = "fixed";
  document.body.style.top = `-${__scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}
function unlockScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, __scrollY);
}

/* ================= Artists Section ================= */
(function initArtists1() {
  const root = document.querySelector("#artists-section");
  if (!root) return;

  // refs
  const panel = root.querySelector("#filters-panel");
  const toggleBtn = root.querySelector("#filters-toggle");
  const resetBtn = root.querySelector("#filters-reset");
  const resetBtnSm = root.querySelector("#filters-reset-sm");
  const searchInput = root.querySelector("#flt-q");
  const searchBtn = root.querySelector("#flt-q-btn");

  const ddSort = root.querySelector('.dd[data-dd="sort"]');
  const ddSortBtn = root.querySelector("#dd-sort-btn");
  const ddSortList = root.querySelector("#dd-sort-list");

  const ddGenre = root.querySelector('.dd[data-dd="genre"]');
  const ddGenreBtn = root.querySelector("#dd-genre-btn");
  const ddGenreList = root.querySelector("#dd-genre-list");

  const grid = root.querySelector("#artists-grid");
  const loader = root.querySelector("#artists-loader");
  const empty = root.querySelector("#artists-empty");
  const pager = root.querySelector("#artists-pager");

  const modal = root.querySelector("#artist-modal");
  const modalBody = root.querySelector("#am-body");
  const modalClose = root.querySelector("#am-close");
  const modalDialog = root.querySelector(".amodal__dialog");

  // state
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",
    genre: "",
    q: "",
    isMobilePanelOpen: false,
  };

  // защита от гонок
  let reqId = 0;

  // utils
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const isDesktop = () => matchMedia("(min-width:1440px)").matches;
  const byName = (a) => (a?.strArtist || a?.name || "").toLowerCase();

  function syncPanelMode() {
    if (isDesktop()) {
      panel.setAttribute("aria-hidden", "false");
      toggleBtn?.setAttribute("aria-expanded", "false");
      state.isMobilePanelOpen = false;
    } else {
      panel.setAttribute("aria-hidden", state.isMobilePanelOpen ? "false" : "true");
      toggleBtn?.setAttribute("aria-expanded", state.isMobilePanelOpen ? "true" : "false");
    }
  }

  function scrollToGridTop() {
    const top = root.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // ====== skeletons + fade-in ======
  function buildSkeletonCard() {
    return `
      <li class="card card--skel">
        <div class="card__media skel skel--media"></div>
        <div class="card__tags">
          <span class="tag skel skel--tag"></span>
          <span class="tag skel skel--tag"></span>
        </div>
        <div class="skel skel--title"></div>
        <div class="skel skel--text"></div>
      </li>`;
  }
  function renderSkeleton(count) {
    const n = Math.max(1, Number(count) || state.limit || 8);
    grid.innerHTML = new Array(n).fill(0).map(buildSkeletonCard).join("");
    show(grid); hide(empty); hide(pager);
  }
  function afterImagesFadeIn() {
    const imgs = grid.querySelectorAll("img.img-fade");
    imgs.forEach((img) => {
      const done = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth > 0) done();
      else img.addEventListener("load", done, { once: true });
    });
  }

  function applyEmpty(on) {
    if (on) { show(empty); hide(grid); hide(pager); resetGridInlineStyles(); }
    else { hide(empty); show(grid); }
  }
  function resetGridInlineStyles() {
    grid.style.height = "";
    grid.style.overflow = "";
    grid.style.transition = "";
    grid.style.willChange = "";
  }

  // ====== НОВОЕ: фиксация высоты грида на время загрузки ======
  let gridCleanupTimer = null;
  function lockGridHeight(h) {
    const hh = h ?? grid.getBoundingClientRect().height;
    grid.style.willChange = "height";
    grid.style.overflow = "hidden";
    grid.style.transition = "none";
    grid.style.height = `${Math.max(1, Math.round(hh || 0))}px`;
  }
  function unlockGridHeight() {
    grid.style.height = "";
    grid.style.overflow = "";
    grid.style.transition = "";
    grid.style.willChange = "";
  }
  function swapGridContent(renderFn) {
    renderFn();
    void grid.offsetHeight;
    const newH = grid.scrollHeight;
    grid.style.transition = "height 200ms ease";
    grid.style.height = `${newH}px`;
    const onEnd = (e) => {
      if (e.target !== grid || e.propertyName !== "height") return;
      grid.removeEventListener("transitionend", onEnd);
      unlockGridHeight();
    };
    grid.addEventListener("transitionend", onEnd);
    clearTimeout(gridCleanupTimer);
    gridCleanupTimer = setTimeout(unlockGridHeight, 400);
  }

  function buildCard(a) {
    const id = a?.id || a?._id || a?.artistId || "";
    const name = a?.strArtist || a?.name || "Unknown";
    const img = a?.strArtistThumb || a?.photo || a?.image || "https://via.placeholder.com/960x540?text=No+Image";
    const about = a?.strBiographyEN || a?.about || "";
    const tags = Array.isArray(a?.genres) ? a.genres : (a?.genre ? [a.genre] : []);
    const sizes = "(min-width:1440px) 50vw, (min-width:768px) 704px, 100vw";
    return `
      <li class="card" data-id="${id}">
        <div class="card__media">
          <img
            class="img-fade"
            src="${img}"
            srcset="${img} 1x, ${img} 2x"
            sizes="${sizes}"
            alt="${name}"
            loading="lazy"
          >
        </div>
        <div class="card__tags">${tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
        <h3 class="card__title">${name}</h3>
        <p class="card__text">${about}</p>
        <button class="card__link" data-action="more">
          Learn More
          <svg class="ico" aria-hidden="true"><use href="${SPRITE}#icon-icon_play_artists_sections"></use></svg>
        </button>
      </li>`;
  }
  function renderGrid(arr) {
    grid.innerHTML = arr.map(buildCard).join("");
    afterImagesFadeIn();
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 0) { pager.innerHTML = ""; hide(pager); return; }
    if (totalPages === 1) { pager.innerHTML = `<button class="active" data-page="1" disabled>1</button>`; show(pager); return; }
    const btn = (label, p, dis = false, act = false) =>
      `<button ${dis ? "disabled" : ""} data-page="${p}" class="${act ? "active" : ""}">${label}</button>`;
    const win = 2;
    const from = Math.max(1, page - win);
    const to = Math.min(totalPages, page + win);
    const out = [];
    out.push(btn("‹", Math.max(1, page - 1), page === 1, false));
    if (from > 1) {
      out.push(btn("1", 1, false, page === 1));
      if (from > 2) out.push(`<button class="dots">…</button>`);
    }
    for (let p = from; p <= to; p++) out.push(btn(String(p), p, false, p === page));
    if (to < totalPages) {
      if (to < totalPages - 1) out.push(`<button class="dots">…</button>`);
      out.push(btn(String(totalPages), totalPages, false, page === totalPages));
    }
    out.push(btn("›", Math.min(totalPages, page + 1), page === totalPages, false));
    pager.innerHTML = out.join("");
    show(pager);
  }

  async function loadGenres() {
    try {
      ddGenre?.classList.add("loading");
      ddGenreBtn?.setAttribute("aria-busy", "true");
      if (ddGenreBtn) ddGenreBtn.disabled = true;
      ddGenreList.innerHTML = `
        <li class="dd__loading">
          <span class="dd__spinner" aria-hidden="true"></span>
          <span>Loading…</span>
        </li>`;
      const list = await fetchGenres();
      ddGenreList.innerHTML = list.map((g) => `<li data-val="${g}">${g}</li>`).join("");
    } catch {
      ddGenreList.innerHTML = `<li data-val="">All Genres</li>`;
    } finally {
      ddGenre?.classList.remove("loading");
      ddGenreBtn?.removeAttribute("aria-busy");
      if (ddGenreBtn) ddGenreBtn.disabled = false;
    }
  }

  async function loadArtists(allowRetry = true) {
    const myId = ++reqId;

    // ВАЖНО: фиксируем текущую высоту (до замены на скелетоны), чтобы не было «подпрыгивания»
    const prevH = grid.getBoundingClientRect().height;
    lockGridHeight(prevH);
    renderSkeleton(state.limit);
    hide(pager);

    const query = state.q.trim();
    const wantSearch = query.length >= 1;

    let list = [];
    let total = 0;

    try {
      const server = await fetchArtists({
        page: state.page,
        limit: state.limit,
        genre: state.genre || "",
        sort: state.sort || "",
        name: wantSearch ? query : "",
      });
      if (myId !== reqId) return; // устаревший ответ

      list = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch {
      if (myId !== reqId) return;
      list = [];
      total = 0;
    }

    // страницы и кламп
    let totalPages = Math.max(1, Math.ceil(total / state.limit));
    if (state.page > totalPages && allowRetry) { state.page = totalPages; return loadArtists(false); }
    if (state.page < 1 && allowRetry) { state.page = 1; return loadArtists(false); }

    // локальная сортировка (если надо)
    if (state.sort === "asc")  list = list.slice().sort((a, b) => byName(a).localeCompare(byName(b)));
    if (state.sort === "desc") list = list.slice().sort((a, b) => byName(b).localeCompare(byName(a)));

    if (myId !== reqId) return;

    if (!list.length) {
      grid.innerHTML = "";
      applyEmpty(true);
      unlockGridHeight();
      return;
    }

    applyEmpty(false);
    // Плавная смена содержимого с удержанием высоты
    swapGridContent(() => renderGrid(list));
    renderPager(state.page, totalPages);
  }

  function resetAll() {
    state.page = 1;
    state.sort = "";
    state.genre = "";
    state.q = "";
    searchInput.value = "";
    closeDropdowns();
    loadArtists();
  }

  function closeDropdowns(except) {
    [ddSort, ddGenre].forEach((dd) => {
      if (dd !== except) {
        dd.classList.remove("open");
        const ul = dd.querySelector(".dd__list");
        if (ul) ul.style.display = "none";
      }
    });
  }
  function toggleDropdown(dd) {
    const open = !dd.classList.contains("open");
    closeDropdowns(dd);
    dd.classList.toggle("open", open);
    const ul = dd.querySelector(".dd__list");
    if (ul) ul.style.display = open ? "block" : "none";
  }

  // ===== UI events + звуки =====
  toggleBtn?.addEventListener("click", () => {
    UISound.tap();
    state.isMobilePanelOpen = !state.isMobilePanelOpen;
    syncPanelMode();
  });
  addEventListener("resize", syncPanelMode);

  ddSortBtn.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddSort); });
  ddGenreBtn.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddGenre); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeDropdowns(); });

  ddSortList.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    state.sort = li.dataset.val || "";
    state.page = 1;
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    const v = li.dataset.val || "";
    state.genre = v === "All Genres" ? "" : v;
    state.page = 1;
    toggleDropdown(ddGenre);
    loadArtists();
  });

  function doSearch() {
    UISound.tap();
    state.q = searchInput.value.trim();
    state.page = 1;
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  resetBtn.addEventListener("click", () => { UISound.tap(); resetAll(); });
  resetBtnSm?.addEventListener("click", () => {
    UISound.tap();
    resetAll();
    state.isMobilePanelOpen = false;
    syncPanelMode();
  });
  root.querySelector("#empty-reset")?.addEventListener("click", () => { UISound.tap(); resetAll(); });

  pager.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    const p = Number(b.dataset.page) || 1;
    if (p === state.page) return;
    UISound.page();
    // СНАЧАЛА плавный скролл, затем загрузка (grid высота зафиксирована — без «подпрыгивания»)
    scrollToGridTop();
    state.page = p;
    loadArtists();
  });

  /* ================= Mini YouTube с громкостью ================= */
  let __ytReadyPromise = null;
  function loadYTAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (__ytReadyPromise) return __ytReadyPromise;
    __ytReadyPromise = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => reject(new Error("YT API load failed"));
      document.head.appendChild(tag);
      const t = setTimeout(() => reject(new Error("YT API timeout")), 15000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(t); resolve(); };
    });
    return __ytReadyPromise;
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  function getYouTubeId(url) {
    try {
      const u = new URL(url);
      if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
      if (m) return m[2];
      return "";
    } catch { return ""; }
  }

  let playerDock = null, playerFrame = null, playerOpenLink = null;
  let volWrap = null, volSlider = null, muteBtn = null;
  let ytPlayer = null, muted = false, currentVol = 60;

  function ensurePlayerDock() {
    if (playerDock) return;
    const dialog = modal.querySelector(".amodal__dialog");
    playerDock = document.createElement("div");
    playerDock.className = "am-player";
    playerDock.innerHTML = `
      <div class="am-player__inner" role="region" aria-label="YouTube mini player">
        <div class="am-player__frame" id="am-player-frame"></div>
        <div class="am-player__bar">
          <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          <div class="am-player__volwrap">
            <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
            <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
          </div>
          <button class="am-player__close" type="button" aria-label="Close player">×</button>
        </div>
      </div>`;
    dialog.appendChild(playerDock);

    playerFrame    = playerDock.querySelector(".am-player__frame");
    playerOpenLink = playerDock.querySelector(".am-player__yt");
    volWrap        = playerDock.querySelector(".am-player__volwrap");
    volSlider      = playerDock.querySelector(".am-player__slider");
    muteBtn        = playerDock.querySelector(".am-player__mute");

    playerDock.querySelector(".am-player__close").addEventListener("click", () => { UISound.tap(); closePlayer(); });
    muteBtn.addEventListener("click", () => {
      UISound.tap();
      muted = !muted;
      if (ytPlayer?.mute) {
        if (muted) ytPlayer.mute(); else ytPlayer.unMute();
      }
      muteBtn.textContent = muted ? "🔇" : "🔈";
    });
    volSlider.addEventListener("input", () => {
      currentVol = Number(volSlider.value) || 0;
      if (ytPlayer?.setVolume) ytPlayer.setVolume(currentVol);
      if (currentVol === 0) { muted = true; muteBtn.textContent = "🔇"; ytPlayer?.mute?.(); }
      else if (muted) { muted = false; muteBtn.textContent = "🔈"; ytPlayer?.unMute?.(); }
    });

    if (isIOS) {
      volSlider.disabled = true;
      volSlider.title = "На iOS громкость регулируется только аппаратно";
    }
  }

  async function openPlayer(youtubeUrl) {
    const id = getYouTubeId(youtubeUrl);
    if (!id) { window.__toast?.error("Не удалось открыть видео."); return; }
    ensurePlayerDock();
    playerOpenLink.href = youtubeUrl;
    playerDock.classList.add("am-player--active");

    try {
      await loadYTAPI();
      if (ytPlayer) { try { ytPlayer.destroy(); } catch {} ytPlayer = null; }
      playerFrame.innerHTML = `<div id="am-player-yt"></div>`;
      ytPlayer = new YT.Player("am-player-yt", {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, controls: 1, enablejsapi: 1, origin: location.origin },
        events: {
          onReady: (e) => {
            if (!isIOS && e.target.setVolume) e.target.setVolume(currentVol);
            if (muted && e.target.mute) e.target.mute();
          }
        }
      });
      volWrap.style.display = "";
    } catch {
      playerFrame.innerHTML = `
        <iframe
          title="YouTube video player"
          src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&controls=1"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="origin-when-cross-origin"
          style="width:100%; height:100%; border:0; display:block"
        ></iframe>`;
      volWrap.style.display = "none";
    }
  }
  function closePlayer() {
    if (ytPlayer) { try { ytPlayer.stopVideo?.(); ytPlayer.destroy?.(); } catch {} ytPlayer = null; }
    if (playerFrame) playerFrame.innerHTML = "";
    if (playerDock) playerDock.classList.remove("am-player--active");
  }

  modal.addEventListener("click", (e) => {
    const a = e.target.closest("a.yt");
    if (!a) return;
    e.preventDefault();
    UISound.tap();
    openPlayer(a.href);
  });

  /* ================= Image Zoom Lightbox ================= */
  let zoomOverlay = null, zoomImg = null, zoomLink = null, stageEl = null;
  let isPanning = false, startX = 0, startY = 0, curX = 0, curY = 0, scale = 1;
  const activePointers = new Map(); let pinchActive = false, pinchBaseDist = 0, pinchBaseScale = 1;
  let baseW = 0, baseH = 0, stageW = 0, stageH = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist  = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
  const midpoint = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });

  function ensureZoom() {
    if (zoomOverlay) return;
    zoomOverlay = document.createElement("div");
    zoomOverlay.className = "am-zoom";
    zoomOverlay.innerHTML = `
      <div class="am-zoom__backdrop"></div>
      <div class="am-zoom__dialog" role="dialog" aria-modal="true" aria-label="Image preview">
        <div class="am-zoom__stage"><img class="am-zoom__img" alt=""></div>
        <div class="am-zoom__bar">
          <a class="am-zoom__open" href="#" target="_blank" rel="noopener noreferrer">Open original ↗</a>
          <button class="am-zoom__close" type="button" aria-label="Close">×</button>
        </div>
      </div>`;
    document.body.appendChild(zoomOverlay);
    zoomImg  = zoomOverlay.querySelector(".am-zoom__img");
    zoomLink = zoomOverlay.querySelector(".am-zoom__open");
    stageEl  = zoomOverlay.querySelector(".am-zoom__stage");

    zoomOverlay.querySelector(".am-zoom__backdrop").addEventListener("click", () => { UISound.tap(); closeImgZoom(); });
    zoomOverlay.querySelector(".am-zoom__close").addEventListener("click", () => { UISound.tap(); closeImgZoom(); });

    zoomImg.addEventListener("dblclick", () => { UISound.tap(); toggleZoom(); });
    zoomOverlay.addEventListener("wheel", onWheel, { passive: false });

    zoomImg.addEventListener("pointerdown", onPointerDown);
    zoomImg.addEventListener("pointermove", onPointerMove);
    zoomImg.addEventListener("pointerup", onPointerUpCancel);
    zoomImg.addEventListener("pointercancel", onPointerUpCancel);

    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape" && isZoomActive()) { UISound.tap(); closeImgZoom(); }});
    window.addEventListener("resize", () => { if (!isZoomActive()) return; measureStage(); applyTransform(); });
  }
  const isZoomActive = () => zoomOverlay && zoomOverlay.classList.contains("am-zoom--active");
  function measureBase() {
    const prev = zoomImg.style.transform; zoomImg.style.transform = "translate3d(0,0,0) scale(1)";
    const r = zoomImg.getBoundingClientRect(); zoomImg.style.transform = prev;
    baseW = r.width; baseH = r.height;
  }
  function measureStage(){ const s = stageEl.getBoundingClientRect(); stageW = s.width; stageH = s.height; }
  function clampPan() {
    if (!baseW || !baseH || !stageW || !stageH) return;
    const contentW = baseW * scale, contentH = baseH * scale;
    if (contentW <= stageW) curX = 0; else { const maxX = (contentW - stageW)/2; curX = clamp(curX, -maxX, maxX); }
    if (contentH <= stageH) curY = 0; else { const maxY = (contentH - stageH)/2; curY = clamp(curY, -maxY, maxY); }
  }
  function openImgZoom(src, alt) {
    if (!src) return; ensureZoom();
    activePointers.clear(); pinchActive = false; pinchBaseDist = 0; pinchBaseScale = 1;
    isPanning = false; startX = startY = 0; curX = curY = 0; scale = 1;
    zoomImg.src = src; zoomImg.alt = alt || ""; zoomLink.href = src;
    applyTransform();
    const doMeasure = () => { measureStage(); measureBase(); clampPan(); applyTransform(); };
    if (zoomImg.complete) requestAnimationFrame(doMeasure); else zoomImg.onload = () => requestAnimationFrame(doMeasure);
    zoomOverlay.classList.add("am-zoom--active");
  }
  function closeImgZoom(){ if (!zoomOverlay) return; zoomOverlay.classList.remove("am-zoom--active"); zoomImg.src = ""; activePointers.clear(); pinchActive = false; }
  function applyTransform(){ clampPan(); zoomImg.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${scale})`; zoomImg.style.cursor = scale > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in"; }
  function toggleZoom(){ const prev = scale; scale = prev > 1 ? 1 : 2; if (scale === 1) { curX = 0; curY = 0; } applyTransform(); }
  function onWheel(e){
    if (!isZoomActive()) return; e.preventDefault();
    const newScale = clamp(scale + (e.deltaY > 0 ? -0.15 : 0.15), 1, 3);
    const rect = zoomImg.getBoundingClientRect();
    const pivot = { x: e.clientX, y: e.clientY };
    const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    const factor = newScale / scale;
    curX += (center.x - pivot.x) * (1 - factor);
    curY += (center.y - pivot.y) * (1 - factor);
    scale = newScale; if (scale === 1) { curX = 0; curY = 0; } applyTransform();
  }
  function onPointerDown(e){
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    zoomImg.setPointerCapture(e.pointerId);
    if (activePointers.size === 2) {
      const [p1, p2] = Array.from(activePointers.values());
      pinchActive = true; pinchBaseDist = dist(p1,p2) || 1; pinchBaseScale = scale; isPanning = false; return;
    }
    if (activePointers.size === 1 && scale > 1){ isPanning = true; startX = e.clientX - curX; startY = e.clientY - curY; applyTransform(); }
  }
  function onPointerMove(e){
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchActive && activePointers.size >= 2) {
      const [p1,p2] = Array.from(activePointers.values()); const d = dist(p1,p2) || 1;
      let newScale = clamp(pinchBaseScale * (d / pinchBaseDist), 1, 3);
      const mid = midpoint(p1,p2); const rect = zoomImg.getBoundingClientRect();
      const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      const factor = newScale / scale; curX += (center.x - mid.x) * (1 - factor); curY += (center.y - mid.y) * (1 - factor);
      scale = newScale; if (scale === 1) { curX = 0; curY = 0; } applyTransform(); return;
    }
    if (isPanning && activePointers.size === 1 && scale > 1) { curX = e.clientX - startX; curY = e.clientY - startY; applyTransform(); }
  }
  function onPointerUpCancel(e){
    if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);
    try { zoomImg.releasePointerCapture(e.pointerId); } catch {}
    if (activePointers.size < 2) { pinchActive = false; pinchBaseDist = 0; }
    if (activePointers.size === 0) { isPanning = false; applyTransform(); }
  }

  // Клик по фото → зум
  modal.addEventListener("click", (e) => {
    const img = e.target.closest(".amodal__img"); if (!img) return;
    UISound.tap();
    const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
    openImgZoom(src, img.getAttribute("alt") || "");
  });
  grid.addEventListener("click", (e) => {
    const img = e.target.closest(".card__media img"); if (!img) return;
    UISound.tap();
    const src = img.currentSrc || img.src || "";
    openImgZoom(src, img.alt || "");
  });

  /* ================= Модалка + кнопка «вверх» ================= */
  let scrollTopBtn = null, dialogScrollHandler = null;
  function ensureModalScrollTopBtn() {
    if (scrollTopBtn) return;
    scrollTopBtn = document.createElement("button");
    scrollTopBtn.type = "button";
    scrollTopBtn.setAttribute("aria-label", "Scroll to top");
    scrollTopBtn.innerHTML = "↑";
    Object.assign(scrollTopBtn.style, {
      position: "fixed",
      right: "24px",
      bottom: "24px",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
      lineHeight: "1",
      background: "var(--color-affair, #764191)",
      color: "var(--color-white, #fff)",
      boxShadow: "0 8px 20px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,0.1)",
      zIndex: "5",
    });
    scrollTopBtn.addEventListener("click", () => {
      UISound.tap();
      modalDialog?.scrollTo({ top: 0, behavior: "smooth" });
    });
    modal.appendChild(scrollTopBtn);
  }

  function openModal() {
    modal.removeAttribute("hidden");
    lockScroll();
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
    addEscListener();

    ensureModalScrollTopBtn();
    dialogScrollHandler = () => {
      const t = modalDialog?.scrollTop || 0;
      if (!scrollTopBtn) return;
      scrollTopBtn.style.display = t > 220 ? "flex" : "none";
    };
    modalDialog?.addEventListener("scroll", dialogScrollHandler);
    dialogScrollHandler();
  }
  function closeModal() {
    modal.setAttribute("hidden", "");
    unlockScroll();
    modalBody.innerHTML = "";
    removeEscListener();
    closePlayer();
    closeImgZoom();
    if (dialogScrollHandler) {
      modalDialog?.removeEventListener("scroll", dialogScrollHandler);
      dialogScrollHandler = null;
    }
    if (scrollTopBtn) scrollTopBtn.style.display = "none";
  }

  modalClose?.addEventListener("click", () => { UISound.tap(); closeModal(); });
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) { UISound.tap(); closeModal(); }
  });

  const onEsc = (e) => {
    if (e.key !== "Escape" || modal.hasAttribute("hidden")) return;
    UISound.tap();
    if (isZoomActive()) closeImgZoom(); else closeModal();
  };
  function addEscListener(){ document.addEventListener("keydown", onEsc); }
  function removeEscListener(){ document.removeEventListener("keydown", onEsc); }

  /* ================= Форматки и модалка контента ================= */
  function fmtTime(val) {
    let ms = Number(val);
    if (!isFinite(ms)) return "—";
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  function years(details){
    const s = details?.intFormedYear || details?.yearStart || details?.formedYear;
    const e = details?.intDisbandedYear || details?.intDiedYear || details?.yearEnd || details?.disbandedYear;
    if (s && e) return `${s}–${e}`;
    if (s) return `${s}–present`;
    return "information missing";
  }
  function trackRow(t) {
    const title = t?.strTrack || t?.title || t?.name || "—";
    const dur   = fmtTime(t?.intDuration ?? t?.duration ?? t?.time);
    const link  = t?.movie ?? t?.youtube ?? t?.youtube_url ?? t?.url ?? t?.strMusicVid;
    const yIco  = `<svg class="ico am-yt" aria-hidden="true"><use href="${SPRITE}#icon-icon_youtube_footer"></use></svg>`;
    return `
      <li class="tr">
        <span>${title}</span>
        <span>${dur}</span>
        <span>${link ? `<a class="yt" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube">${yIco}</a>` : `<span class="yt-ph"></span>`}</span>
      </li>`;
  }

  async function renderModal(id){
    const [a, albums] = await Promise.all([fetchArtist(id), fetchArtistAlbums(id)]);
    const d = a || {};
    theconst
    const name    = d?.strArtist || d?.name || "Unknown artist";
    const img     = d?.strArtistThumb || d?.photo || d?.image || "https://via.placeholder.com/960x540?text=No+Image";
    const country = d?.strCountry || d?.country || "N/A";
    const members = d?.intMembers || d?.members || "N/A";
    const sex     = d?.strGender || d?.sex || "N/A";
    const bio     = d?.strBiographyEN || d?.about || "";
    const genres  = Array.isArray(d?.genres) ? d.genres : (d?.genre ? [d.genre] : []);

    const albumsMarkup = (albums||[]).map(alb=>{
      const title  = alb?.strAlbum || alb?.title || alb?.name || "Album";
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks :
                     (Array.isArray(alb?.songs) ? alb.songs : []);
      return `
        <div class="am-album">
          <div class="am-album__title">${title}</div>
          <ul class="tbl">
            <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
            ${tracks.map(trackRow).join("")}
          </ul>
        </div>`;
    }).join("");

    modalBody.innerHTML = `
      <h3 class="amodal__title">${name}</h3>
      <div class="amodal__content">
        <img class="amodal__img" src="${img}" alt="${name}" loading="lazy">
        <div class="amodal__info">
          <div class="am-meta">
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Years active</span><span class="val">${years(d)}</span></div>
              <div class="am-meta__item"><span class="lbl">Sex</span><span class="val">${sex}</span></div>
            </div>
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Members</span><span class="val">${members}</span></div>
              <div class="am-meta__item"><span class="lbl">Country</span><span class="val">${country}</span></div>
            </div>
          </div>
          <div class="am-bio"><div class="lbl">Biography</div><p>${bio || "—"}</p></div>
          ${genres.length ? `<div class="am-tags">${genres.map(g=>`<span class="tag">${g}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      <h4 class="amodal__albums-title">Albums</h4>
      <div class="amodal__albums">
        ${albumsMarkup || "<p class='muted'>No albums found for this artist.</p>"}
      </div>`;
  }

  // init
  syncPanelMode();
  loadGenres();
  loadArtists();

  // Learn more → модалка
  grid.addEventListener("click", async (e)=>{
    const btn = e.target.closest('[data-action="more"]'); if(!btn) return;
    const id = btn.closest(".card")?.dataset?.id; if(!id) return;
    UISound.tap();
    openModal();
    await renderModal(id);
  });
})();
