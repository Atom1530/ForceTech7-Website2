// artists1.js
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

const SPRITE = "/img/sprite.svg";

/* ================= Toast helper (vanilla) ================= */
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

/* ===== Scroll lock (фикс без дёрганий) ===== */
let __scrollY = 0;
function lockScroll() {
  __scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${__scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, __scrollY);
}


/* ================= Artists Section ================= */
(function initArtists1() {
  const root = document.querySelector("#artists-section");
  if (!root) return;

  // ---- refs
  const panel = root.querySelector("#filters-panel");
  const toggleBtn = root.querySelector("#filters-toggle");
  const resetBtn = root.querySelector("#filters-reset");
  const resetBtnSm = root.querySelector("#filters-reset-sm");
  const searchInput = root.querySelector("#flt-q");
  const searchBtn = root.querySelector("#flt-q-btn"); // может отсутствовать

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

  // ---- state
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",      // "", "asc", "desc"
    genre: "",     // "" | "Rock" | ...
    q: "",         // search query
    isMobilePanelOpen: false,
  };

  // ---- utils
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

  /* ====== Build card (с srcset) ====== */
  function buildCard(a) {
    const id = a?.id || a?._id || a?.artistId || "";
    const name = a?.strArtist || a?.name || "Unknown";
    const img = a?.strArtistThumb || a?.photo || a?.image || "https://via.placeholder.com/960x540?text=No+Image";
    const about = a?.strBiographyEN || a?.about || "";
    const tags = Array.isArray(a?.genres) ? a.genres : (a?.genre ? [a.genre] : []);

    // sizes: 50vw на десктопе (две колонки), 704px на планшете, 100vw на мобайле
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

  /* ====== Genres: small loader in dropdown ====== */
  async function loadGenres() {
    try {
      // визуальный лоадер в списке жанров
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
      // на всякий случай fallback (api уже показывает toast)
      ddGenreList.innerHTML = `<li data-val="">All Genres</li>`;
    } finally {
      ddGenre?.classList.remove("loading");
      ddGenreBtn?.removeAttribute("aria-busy");
      if (ddGenreBtn) ddGenreBtn.disabled = false;
    }
  }

  /* ====== Artists list ====== */
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
      // toast уже показан в api
    }

    // клиентская сортировка на всякий
    if (state.sort === "asc")  list = list.slice().sort((a,b)=> byName(a).localeCompare(byName(b)));
    if (state.sort === "desc") list = list.slice().sort((a,b)=> byName(b).localeCompare(byName(a)));

    if (!list.length){
      hide(loader);
      grid.innerHTML = "";
      applyEmpty(true);
      return;
    }

    applyEmpty(false);
    renderGrid(list);

    const totalPages = Math.max(1, Math.ceil(total / state.limit));
    renderPager(state.page, totalPages);
    show(pager);
    hide(loader);
  }

  /* ====== Common interactions ====== */
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

  // поиск
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

  /* ====== Modal ====== */
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
}


  modalClose?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) closeModal();
  });

  const onEsc = (e) => { if (e.key === "Escape" && !modal.hasAttribute("hidden")) closeModal(); };
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

  // карточка → модалка
  grid.addEventListener("click", async (e)=>{
    const btn = e.target.closest('[data-action="more"]'); if(!btn) return;
    const id = btn.closest(".card")?.dataset?.id; if(!id) return;
    openModal();
    await renderModal(id);
  });
})();
