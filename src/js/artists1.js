// artists1.js
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

const SPRITE = "/img/sprite.svg";

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

/* ================= Scroll lock ================= */
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

  // Refs
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

  // State
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",
    genre: "",
    q: "",
    isMobilePanelOpen: false,
  };

  // Utils
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

  function applyEmpty(on) {
    if (on) { show(empty); hide(grid); hide(pager); }
    else { hide(empty); show(grid); }
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
          <svg class="ico" aria-hidden="true">
            <use href="${SPRITE}#icon-icon_play_artists_sections"></use>
          </svg>
        </button>
      </li>`;
  }

  function renderGrid(arr) { grid.innerHTML = arr.map(buildCard).join(""); }

  function renderPager(page, totalPages) {
    if (totalPages <= 1) { pager.innerHTML = ""; return; }
    const btn = (label, p, dis=false, act=false) =>
      `<button ${dis?"disabled":""} data-page="${p}" class="${act?"active":""}">${label}</button>`;
    const win = 2;
    const from = Math.max(1, page - win);
    const to   = Math.min(totalPages, page + win);
    const out = [];
    const add = (...a)=> out.push(btn(...a));
    add("‹", Math.max(1, page-1), page===1);
    if (from>1){ add("1",1,false,page===1); if(from>2) out.push(`<button class="dots">…</button>`); }
    for(let p=from;p<=to;p++) add(String(p),p,false,p===page);
    if (to<totalPages){ if(to<totalPages-1) out.push(`<button class="dots">…</button>`); add(String(totalPages),totalPages,false,page===totalPages); }
    add("›", Math.min(totalPages, page+1), page===totalPages);
    pager.innerHTML = out.join("");
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
      ddGenreList.innerHTML = list.map(g => `<li data-val="${g}">${g}</li>`).join("");
    } catch {
      ddGenreList.innerHTML = `<li data-val="">All Genres</li>`;
    } finally {
      ddGenre?.classList.remove("loading");
      ddGenreBtn?.removeAttribute("aria-busy");
      if (ddGenreBtn) ddGenreBtn.disabled = false;
    }
  }

  async function loadArtists() {
    show(loader); hide(pager);
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
      list = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch {
      list = [];
      total = 0;
    }
    if (state.sort === "asc")  list = list.slice().sort((a,b)=> byName(a).localeCompare(byName(b)));
    if (state.sort === "desc") list = list.slice().sort((a,b)=> byName(b).localeCompare(byName(a)));
    if (!list.length){ hide(loader); grid.innerHTML = ""; applyEmpty(true); return; }
    applyEmpty(false);
    renderGrid(list);
    const totalPages = Math.max(1, Math.ceil(total / state.limit));
    renderPager(state.page, totalPages);
    show(pager);
    hide(loader);
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
    [ddSort, ddGenre].forEach(dd=>{
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

  toggleBtn?.addEventListener("click", ()=>{
    state.isMobilePanelOpen = !state.isMobilePanelOpen;
    syncPanelMode();
  });
  addEventListener("resize", syncPanelMode);

  ddSortBtn.addEventListener("click", ()=> toggleDropdown(ddSort));
  ddGenreBtn.addEventListener("click", ()=> toggleDropdown(ddGenre));
  document.addEventListener("click", (e)=>{ if(!e.target.closest(".dd")) closeDropdowns(); });

  ddSortList.addEventListener("click", (e)=>{
    const li = e.target.closest("li"); if(!li) return;
    state.sort = li.dataset.val || "";
    state.page = 1;
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList.addEventListener("click", (e)=>{
    const li = e.target.closest("li"); if(!li) return;
    const v = li.dataset.val || "";
    state.genre = (v === "All Genres") ? "" : v;
    state.page = 1;
    toggleDropdown(ddGenre);
    loadArtists();
  });

  function doSearch(){
    state.q = searchInput.value.trim();
    state.page = 1;
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter") doSearch(); });

  resetBtn.addEventListener("click", resetAll);
  resetBtnSm?.addEventListener("click", ()=>{ resetAll(); state.isMobilePanelOpen=false; syncPanelMode(); });
  root.querySelector("#empty-reset")?.addEventListener("click", resetAll);

  pager.addEventListener("click", (e)=>{
    const b = e.target.closest("button[data-page]"); if(!b || b.disabled) return;
    const p = Number(b.dataset.page)||1;
    if (p === state.page) return;
    state.page = p;
    loadArtists();
  });

  /* ================= Mini YouTube Player ================= */
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

  let playerDock = null;
  let playerFrame = null;
  let playerOpenLink = null;

  function ensurePlayerDock() {
    if (playerDock) return;
    const dialog = modal.querySelector(".amodal__dialog");
    playerDock = document.createElement("div");
    playerDock.className = "am-player";
    playerDock.innerHTML = `
      <div class="am-player__inner" role="region" aria-label="YouTube mini player">
        <div class="am-player__frame"></div>
        <div class="am-player__bar">
          <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          <button class="am-player__close" type="button" aria-label="Close player">×</button>
        </div>
      </div>`;
    dialog.appendChild(playerDock);
    playerFrame = playerDock.querySelector(".am-player__frame");
    playerOpenLink = playerDock.querySelector(".am-player__yt");
    playerDock.querySelector(".am-player__close").addEventListener("click", closePlayer);
  }

  function openPlayer(youtubeUrl) {
    const id = getYouTubeId(youtubeUrl);
    if (!id) { window.__toast?.error("Не удалось открыть видео."); return; }
    ensurePlayerDock();
    const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    let iframe = playerFrame.querySelector("iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.setAttribute("title", "YouTube video player");
      iframe.setAttribute("allow","accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("referrerpolicy", "origin-when-cross-origin");
      playerFrame.appendChild(iframe);
    }
    iframe.src = src;
    playerOpenLink.href = youtubeUrl;
    playerDock.classList.add("am-player--active");
  }

  function closePlayer() {
    if (!playerDock) return;
    const iframe = playerFrame?.querySelector("iframe");
    if (iframe) iframe.src = "";
    playerDock.classList.remove("am-player--active");
  }

  modal.addEventListener("click", (e) => {
    const a = e.target.closest("a.yt");
    if (!a) return;
    e.preventDefault();
    openPlayer(a.href);
  });

  /* ================= Image Zoom Lightbox (global, pinch + bounds) ================= */
  let zoomOverlay = null;
  let zoomImg = null;
  let zoomLink = null;
  let stageEl = null;

  // pan/zoom state
  let isPanning = false;
  let startX = 0, startY = 0;
  let curX = 0, curY = 0;
  let scale = 1;

  // pinch state
  const activePointers = new Map(); // id -> {x,y}
  let pinchActive = false;
  let pinchBaseDist = 0;
  let pinchBaseScale = 1;

  // bounds base (measured at scale=1)
  let baseW = 0, baseH = 0;
  let stageW = 0, stageH = 0;

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
  function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

  function ensureZoom() {
    if (zoomOverlay) return;
    zoomOverlay = document.createElement("div");
    zoomOverlay.className = "am-zoom";
    zoomOverlay.innerHTML = `
      <div class="am-zoom__backdrop"></div>
      <div class="am-zoom__dialog" role="dialog" aria-modal="true" aria-label="Image preview">
        <div class="am-zoom__stage">
          <img class="am-zoom__img" alt="">
        </div>
        <div class="am-zoom__bar">
          <a class="am-zoom__open" href="#" target="_blank" rel="noopener noreferrer">Open original ↗</a>
          <button class="am-zoom__close" type="button" aria-label="Close">×</button>
        </div>
      </div>`;
    document.body.appendChild(zoomOverlay);

    zoomImg  = zoomOverlay.querySelector(".am-zoom__img");
    zoomLink = zoomOverlay.querySelector(".am-zoom__open");
    stageEl  = zoomOverlay.querySelector(".am-zoom__stage");

    zoomOverlay.querySelector(".am-zoom__backdrop").addEventListener("click", closeImgZoom);
    zoomOverlay.querySelector(".am-zoom__close").addEventListener("click", closeImgZoom);

    // Desktop UX
    zoomImg.addEventListener("dblclick", toggleZoom);
    zoomOverlay.addEventListener("wheel", onWheel, { passive: false });

    // Pointer events (mouse/touch/pen)
    zoomImg.addEventListener("pointerdown", onPointerDown);
    zoomImg.addEventListener("pointermove", onPointerMove);
    zoomImg.addEventListener("pointerup", onPointerUpCancel);
    zoomImg.addEventListener("pointercancel", onPointerUpCancel);

    // ESC to close
    document.addEventListener("keydown", (e)=>{
      if (e.key === "Escape" && isZoomActive()) closeImgZoom();
    });

    // On resize: re-measure stage and clamp
    window.addEventListener("resize", () => {
      if (!isZoomActive()) return;
      measureStage();
      applyTransform();
    });
  }

  function isZoomActive(){ return zoomOverlay && zoomOverlay.classList.contains("am-zoom--active"); }

  function measureBase() {
    // измеряем картинку в состоянии scale=1, translate=0
    const prevTransform = zoomImg.style.transform;
    zoomImg.style.transform = "translate3d(0,0,0) scale(1)";
    const r = zoomImg.getBoundingClientRect();
    zoomImg.style.transform = prevTransform;
    baseW = r.width;
    baseH = r.height;
  }
  function measureStage() {
    const s = stageEl.getBoundingClientRect();
    stageW = s.width;
    stageH = s.height;
  }

  function clampPan() {
    if (!baseW || !baseH || !stageW || !stageH) return;
    const contentW = baseW * scale;
    const contentH = baseH * scale;

    // если контент меньше контейнера — центруем и не даём сдвигать
    if (contentW <= stageW) curX = 0;
    else {
      const maxX = (contentW - stageW) / 2;
      curX = clamp(curX, -maxX, maxX);
    }

    if (contentH <= stageH) curY = 0;
    else {
      const maxY = (contentH - stageH) / 2;
      curY = clamp(curY, -maxY, maxY);
    }
  }

  function openImgZoom(src, alt) {
    if (!src) return;
    ensureZoom();

    // reset state
    activePointers.clear();
    pinchActive = false;
    pinchBaseDist = 0;
    pinchBaseScale = 1;
    isPanning = false;
    startX = startY = 0;
    curX = curY = 0;
    scale = 1;

    zoomImg.src = src;
    zoomImg.alt = alt || "";
    zoomLink.href = src;

    // применяем 1x, потом меряем и уже после — плавно работаем
    applyTransform();

    const doMeasure = () => {
      measureStage();
      measureBase();
      clampPan();
      applyTransform();
    };

    if (zoomImg.complete) {
      // иногда complete=true, но размеры ещё 0 — отложим в кадр
      requestAnimationFrame(doMeasure);
    } else {
      zoomImg.onload = () => {
        requestAnimationFrame(doMeasure);
      };
    }

    zoomOverlay.classList.add("am-zoom--active");
  }

  function closeImgZoom() {
    if (!zoomOverlay) return;
    zoomOverlay.classList.remove("am-zoom--active");
    zoomImg.src = "";
    activePointers.clear();
    pinchActive = false;
  }

  function applyTransform() {
    clampPan();
    zoomImg.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${scale})`;
    zoomImg.style.cursor = scale > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in";
  }

  function toggleZoom() {
    const prev = scale;
    scale = prev > 1 ? 1 : 2;
    if (scale === 1) { curX = 0; curY = 0; }
    applyTransform();
  }

  function onWheel(e){
    if (!isZoomActive()) return;
    e.preventDefault();
    const newScale = clamp(scale + (e.deltaY > 0 ? -0.15 : 0.15), 1, 3);

    // масштабируем вокруг курсора (pivot)
    const rect = zoomImg.getBoundingClientRect();
    const pivot = { x: e.clientX, y: e.clientY };
    const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    const factor = newScale / scale;
    curX += (center.x - pivot.x) * (1 - factor);
    curY += (center.y - pivot.y) * (1 - factor);

    scale = newScale;
    if (scale === 1) { curX = 0; curY = 0; }
    applyTransform();
  }

  /* ===== Pointer (pan + pinch) ===== */
  function onPointerDown(e){
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    zoomImg.setPointerCapture(e.pointerId);

    if (activePointers.size === 2) {
      const [p1, p2] = Array.from(activePointers.values());
      pinchActive = true;
      pinchBaseDist = dist(p1, p2) || 1;
      pinchBaseScale = scale;
      isPanning = false;
      return;
    }
    if (activePointers.size === 1 && scale > 1) {
      isPanning = true;
      startX = e.clientX - curX;
      startY = e.clientY - curY;
      applyTransform();
    }
  }

  function onPointerMove(e){
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchActive && activePointers.size >= 2) {
      const values = Array.from(activePointers.values());
      const p1 = values[0], p2 = values[1];
      const d = dist(p1, p2) || 1;
      let newScale = clamp(pinchBaseScale * (d / pinchBaseDist), 1, 3);

      // удерживаем под пальцами — якорим к midpoint
      const mid = midpoint(p1, p2);
      const rect = zoomImg.getBoundingClientRect();
      const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      const factor = newScale / scale;
      curX += (center.x - mid.x) * (1 - factor);
      curY += (center.y - mid.y) * (1 - factor);

      scale = newScale;
      if (scale === 1) { curX = 0; curY = 0; }
      applyTransform();
      return;
    }

    if (isPanning && activePointers.size === 1 && scale > 1) {
      curX = e.clientX - startX;
      curY = e.clientY - startY;
      applyTransform();
    }
  }

  function onPointerUpCancel(e){
    if (activePointers.has(e.pointerId)) {
      activePointers.delete(e.pointerId);
    }
    try { zoomImg.releasePointerCapture(e.pointerId); } catch {}

    if (activePointers.size < 2) {
      pinchActive = false;
      pinchBaseDist = 0;
    }
    if (activePointers.size === 0) {
      isPanning = false;
      applyTransform();
    }
  }

  // Клик по фото в модалке → зум
  modal.addEventListener("click", (e) => {
    const img = e.target.closest(".amodal__img");
    if (!img) return;
    const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
    openImgZoom(src, img.getAttribute("alt") || "");
  });

  // Клик по фото на сетке → зум
  grid.addEventListener("click", (e) => {
    const img = e.target.closest(".card__media img");
    if (!img) return;
    const src = img.currentSrc || img.src || "";
    openImgZoom(src, img.alt || "");
  });

  /* ================= Modal open/close ================= */
  function openModal() {
    modal.removeAttribute("hidden");
    lockScroll();
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
    addEscListener();
  }
  function closeModal() {
    modal.setAttribute("hidden", "");
    unlockScroll();
    modalBody.innerHTML = "";
    removeEscListener();
    closePlayer();
    closeImgZoom();
  }

  modalClose?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) closeModal();
  });

  const onEsc = (e) => {
    if (e.key !== "Escape" || modal.hasAttribute("hidden")) return;
    if (isZoomActive()) closeImgZoom();
    else closeModal();
  };
  function addEscListener(){ document.addEventListener("keydown", onEsc); }
  function removeEscListener(){ document.removeEventListener("keydown", onEsc); }

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
    const yIco  = `
      <svg class="ico am-yt" aria-hidden="true">
        <use href="${SPRITE}#icon-icon_youtube_footer"></use>
      </svg>`;
    return `
      <li class="tr">
        <span>${title}</span>
        <span>${dur}</span>
        <span>
          ${link
            ? `<a class="yt" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube">${yIco}</a>`
            : `<span class="yt-ph"></span>`}
        </span>
      </li>`;
  }

  async function renderModal(id){
    const [a, albums] = await Promise.all([fetchArtist(id), fetchArtistAlbums(id)]);
    const d = a || {};
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

          <div class="am-bio">
            <div class="lbl">Biography</div>
            <p>${bio || "—"}</p>
          </div>

          ${genres.length ? `<div class="am-tags">${genres.map(g=>`<span class="tag">${g}</span>`).join("")}</div>` : ""}
        </div>
      </div>

      <h4 class="amodal__albums-title">Albums</h4>
      <div class="amodal__albums">
        ${albumsMarkup || "<p class='muted'>No albums found for this artist.</p>"}
      </div>
    `;
  }

  // init
  syncPanelMode();
  loadGenres();
  loadArtists();

  grid.addEventListener("click", async (e)=>{
    const btn = e.target.closest('[data-action="more"]'); if(!btn) return;
    const id = btn.closest(".card")?.dataset?.id; if(!id) return;
    openModal();
    await renderModal(id);
  });
})();
