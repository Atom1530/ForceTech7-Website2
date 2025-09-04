// src/js/artists/features/grid.js
import { UISound } from "../lib/sound.js";
import { fetchArtists, fetchGenres } from "./api.js";
import { ArtistState } from "./state.js";
import { createArtistModal } from "./modal.js";
import { openZoom } from "./zoom.js";

// === SPRITE: инлайн во время сборки, без путей/BASE ===
import SPRITE_RAW from "../../../img/sprite.svg?raw";

const SPRITE_CONTAINER_ID = "GLOBAL_SVG_SPRITE";
function ensureSpriteMounted(doc = document) {
  if (doc.getElementById(SPRITE_CONTAINER_ID)) return;
  const wrap = doc.createElement("div");
  wrap.id = SPRITE_CONTAINER_ID;
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.position = "absolute";
  wrap.style.width = "0";
  wrap.style.height = "0";
  wrap.style.overflow = "hidden";
  wrap.innerHTML = SPRITE_RAW;
  doc.body.prepend(wrap);
}

// иконки по id
const icon = (id, cls = "ico") =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}" xlink:href="#${id}"></use></svg>`;

// ====== Константы ======
const DEFAULT_LIMIT = 8; // Default View
const DECK_TEXT =
  "A look at the influential figures who shaped jazz music history."; // короткий «дек» под фото

function computeListLimit() {
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  if (w >= 1440) return 16; // desktop
  if (w >= 768)  return 12; // tablet
  return 10;                // mobile
}

// ====== Инициализация ======
export function initGrid(root = document.querySelector("#artists-section")) {
  if (!root) return;

  ensureSpriteMounted(document);

  // ---------- refs ----------
  const panel       = root.querySelector("#filters-panel");
  const toggleBtn   = root.querySelector("#filters-toggle");
  const resetBtn    = root.querySelector("#filters-reset");
  const resetBtnSm  = root.querySelector("#filters-reset-sm");
  const viewToggle  = root.querySelector("#view-toggle");

  const searchInput = root.querySelector("#flt-q");
  const searchBtn   = root.querySelector("#flt-q-btn");

  const ddSort      = root.querySelector('.dd[data-dd="sort"]');
  const ddSortBtn   = root.querySelector("#dd-sort-btn");
  const ddSortList  = root.querySelector("#dd-sort-list");

  const ddGenre     = root.querySelector('.dd[data-dd="genre"]');
  const ddGenreBtn  = root.querySelector("#dd-genre-btn");
  const ddGenreList = root.querySelector("#dd-genre-list");

  const grid        = root.querySelector("#artists-grid");
  const pager       = root.querySelector("#artists-pager");
  const empty       = root.querySelector("#artists-empty");

  const sectionRoot = root.closest(".artists1") || root;
  const modalApi    = createArtistModal(document);

  // защита от гонок
  let reqId = 0;
  // для авто-лимита в List View
  let lastAppliedLimit = null;

  // ---------- utils ----------
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const isDesktop = () => matchMedia("(min-width:1440px)").matches;
  const byName = (a) => (a?.strArtist || a?.name || "").toLowerCase();
  const FALLBACK_IMG = "https://via.placeholder.com/960x540?text=No+Image";

  const isListMode = () => sectionRoot.classList.contains("view-list");

  function applyAutoLimitForCurrentMode({ resetPage = false } = {}) {
    const target = isListMode() ? computeListLimit() : DEFAULT_LIMIT;
    if (lastAppliedLimit === target) return;
    lastAppliedLimit = target;
    ArtistState.setLimit(target);
    if (resetPage) ArtistState.setPage(1);
    loadArtists();
  }

  function syncPanelMode() {
    const st = ArtistState.get();
    if (isDesktop()) {
      panel?.setAttribute("aria-hidden", "false");
      toggleBtn?.setAttribute("aria-expanded", "false");
      ArtistState.setMobilePanel(false);
    } else {
      panel?.setAttribute("aria-hidden", st.isMobilePanelOpen ? "false" : "true");
      toggleBtn?.setAttribute("aria-expanded", st.isMobilePanelOpen ? "true" : "false");
    }
  }

  function scrollToGridTop() {
    const top = root.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: "smooth" });
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

  // ---------- skeleton + fade-in ----------
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
    const n = Math.max(1, Number(count) || DEFAULT_LIMIT);
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
  function attachImgFallbacks() {
    grid.querySelectorAll("img.img-fade").forEach(img => {
      img.onerror = () => { img.onerror = null; img.src = FALLBACK_IMG; };
    });
  }

  // удержание высоты на время перерендера
  let gridCleanupTimer = null;
  function lockGridHeight(h) {
    const hh = h ?? grid.getBoundingClientRect().height;
    grid.style.willChange = "height";
    grid.style.overflow = "hidden";
    grid.style.transition = "none";
    grid.style.height = `${Math.max(1, Math.round(hh || 0))}px`;
  }
  function unlockGridHeight() { resetGridInlineStyles(); }
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

  // ---------- rendering ----------
  function buildCard(a) {
    const id    = a?.id || a?._id || a?.artistId || "";
    const name  = a?.strArtist || a?.name || "Unknown";
    const img   = a?.strArtistThumb || a?.photo || a?.image || FALLBACK_IMG;
    const genres = Array.isArray(a?.genres) ? a.genres : (a?.genre ? [a.genre] : []);

    // короткий «дек» (Default View; в ListView скрываем CSS-ом)
    const desc  = DECK_TEXT;

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
            onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"
          >
        </div>

        <div class="card__tags">
          ${genres.map(t => `<span class="tag">${t}</span>`).join("")}
        </div>

        <h3 class="card__title">${name}</h3>

        <p class="card__text">${desc}</p>

        <button class="card__link" data-action="more">
          Learn More
          ${icon("icon-icon_play_artists_sections")}
        </button>
      </li>`;
  }

  function renderGrid(arr) {
    grid.innerHTML = arr.map(buildCard).join("");
    attachImgFallbacks();
    afterImagesFadeIn();
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 0) { pager.innerHTML = ""; hide(pager); return; }

    const mkBtn = (label, p, dis = false, act = false) =>
      `<button ${dis ? "disabled" : ""} data-page="${p}" class="${act ? "active" : ""}">${label}</button>`;

    if (totalPages === 1) {
      pager.innerHTML = mkBtn("1", 1, true, true);
      show(pager);
      return;
    }

    const win = 2;
    const from = Math.max(1, page - win);
    const to   = Math.min(totalPages, page + win);
    const out  = [];

    out.push(mkBtn("‹", Math.max(1, page - 1), page === 1, false));

    if (from > 1) {
      out.push(mkBtn("1", 1, false, page === 1));
      if (from > 2) out.push(`<button class="dots" disabled>…</button>`);
    }

    for (let i = from; i <= to; i++) {
      out.push(mkBtn(String(i), i, false, i === page));
    }

    if (to < totalPages) {
      if (to < totalPages - 1) out.push(`<button class="dots" disabled>…</button>`);
      out.push(mkBtn(String(totalPages), totalPages, false, page === totalPages));
    }

    out.push(mkBtn("›", Math.min(totalPages, page + 1), page === totalPages, false));

    pager.innerHTML = out.join("");
    show(pager);
  }

  // ---------- data ----------
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

    const { page, limit, genre, sort, q } = ArtistState.get();

    lockGridHeight(grid.getBoundingClientRect().height);
    renderSkeleton(limit);
    hide(pager);

    let list = [];
    let total = 0;

    try {
      const server = await fetchArtists({
        page, limit,
        genre: genre || "",
        sort:  sort  || "",
        name:  q?.trim?.() || "",
      });
      if (myId !== reqId) return;
      list  = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch {
      if (myId !== reqId) return;
      list = [];
      total = 0;
    }

    let totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
    if (page > totalPages && allowRetry) { ArtistState.setPage(totalPages); return loadArtists(false); }
    if (page < 1 && allowRetry)          { ArtistState.setPage(1);         return loadArtists(false); }

    if (sort === "asc")  list = list.slice().sort((a, b) => byName(a).localeCompare(byName(b)));
    if (sort === "desc") list = list.slice().sort((a, b) => byName(b).localeCompare(byName(a)));

    if (myId !== reqId) return;

    if (!list.length) {
      grid.innerHTML = "";
      applyEmpty(true);
      unlockGridHeight();
      return;
    }

    applyEmpty(false);
    swapGridContent(() => renderGrid(list));
    renderPager(ArtistState.get().page, totalPages);
  }

  // ---------- dropdowns ----------
  function closeDropdowns(except) {
    [ddSort, ddGenre].forEach((dd) => {
      if (dd && dd !== except) {
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

  // ---------- UI events ----------
  toggleBtn?.addEventListener("click", () => {
    UISound?.tap?.();
    const st = ArtistState.get();
    ArtistState.setMobilePanel(!st.isMobilePanelOpen);
    syncPanelMode();
  });

  addEventListener("resize", () => {
    syncPanelMode();
    if (isListMode()) applyAutoLimitForCurrentMode({ resetPage: true });
  });

  ddSortBtn?.addEventListener("click", () => { UISound?.tap?.(); toggleDropdown(ddSort); });
  ddGenreBtn?.addEventListener("click", () => { UISound?.tap?.(); toggleDropdown(ddGenre); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeDropdowns(); });

  ddSortList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound?.tap?.();
    ArtistState.setSort(li.dataset.val || "");
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound?.tap?.();
    const v = li.dataset.val || "";
    ArtistState.setGenre(v === "All Genres" ? "" : v);
    toggleDropdown(ddGenre);
    loadArtists();
    ddSortBtn?.focus();
  });

  function doSearch() {
    UISound?.tap?.();
    ArtistState.setQuery(searchInput?.value.trim() || "");
    ArtistState.setPage(1);
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  function resetAll() {
    ArtistState.reset();
    if (searchInput) searchInput.value = "";
    closeDropdowns();
    lastAppliedLimit = null;
    applyAutoLimitForCurrentMode({ resetPage: true });
  }
  resetBtn?.addEventListener("click", () => { UISound?.tap?.(); resetAll(); });
  resetBtnSm?.addEventListener("click", () => {
    UISound?.tap?.();
    resetAll();
    ArtistState.setMobilePanel(false);
    syncPanelMode();
  });
  root.querySelector("#empty-reset")?.addEventListener("click", () => { UISound?.tap?.(); resetAll(); });

  pager?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    const next = Number(b.dataset.page) || 1;
    if (next === ArtistState.get().page) return;
    UISound?.page?.();
    scrollToGridTop();
    ArtistState.setPage(next);
    loadArtists();
  });

  // ---------- Learn More: делегирование клика ----------
  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest('.card__link,[data-action="more"]');
    if (!btn) return;
    const card = btn.closest(".card");
    const id = card?.dataset?.id;
    if (id) {
      e.preventDefault();
      UISound?.tap?.();
      modalApi.openFor(id);
    }
  });

  // ---------- List/Grid view ----------
  function updateViewButtonUI(listOn) {
    viewToggle?.setAttribute("aria-pressed", String(listOn));
    if (viewToggle) viewToggle.textContent = listOn ? "Default view" : "List view";
  }

  viewToggle?.addEventListener("click", () => {
    UISound?.tap?.();
    const listOn = !isListMode();
    sectionRoot.classList.toggle("view-list", listOn);
    sectionRoot.classList.toggle("view-grid", !listOn);
    updateViewButtonUI(listOn);
    lastAppliedLimit = null;
    applyAutoLimitForCurrentMode({ resetPage: true });
  });

  // ---------- init ----------
  syncPanelMode();
  lastAppliedLimit = null;
  applyAutoLimitForCurrentMode({ resetPage: false });

  loadGenres();
  loadArtists();
}
