// src/js/artists/features/grid.js
import { UISound } from "../lib/sound.js";
import { toast } from "../lib/toast.js";
import { fetchArtists, fetchGenres } from "./api.js";
import { createArtistModal } from "./modal.js";

const SPRITE = "/img/sprite.svg";

export function initGrid(root) {
  // root — контейнер секции #artists-section
  if (!root || !(root instanceof HTMLElement)) return;

  // ===== Refs =====
  const panel       = root.querySelector("#filters-panel");
  const toggleBtn   = root.querySelector("#filters-toggle");
  const resetBtn    = root.querySelector("#filters-reset");
  const resetBtnSm  = root.querySelector("#filters-reset-sm");
  const searchInput = root.querySelector("#flt-q");
  const searchBtn   = root.querySelector("#flt-q-btn");

  const ddSort     = root.querySelector('.dd[data-dd="sort"]');
  const ddSortBtn  = root.querySelector("#dd-sort-btn");
  const ddSortList = root.querySelector("#dd-sort-list");

  const ddGenre     = root.querySelector('.dd[data-dd="genre"]');
  const ddGenreBtn  = root.querySelector("#dd-genre-btn");
  const ddGenreList = root.querySelector("#dd-genre-list");

  const grid   = root.querySelector("#artists-grid");
  const loader = root.querySelector("#artists-loader");
  const empty  = root.querySelector("#artists-empty");
  const pager  = root.querySelector("#artists-pager");

  // модалка может жить вне секции — ищем и там, и тут
  const modalEl =
    root.querySelector("#artist-modal") || document.querySelector("#artist-modal");

  // ===== State =====
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",
    genre: "",
    q: "",
    isMobilePanelOpen: false,
  };

  // Защита от гонок ответов API
  let reqId = 0;

  // ===== Utils =====
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const isDesktop = () => matchMedia("(min-width:1440px)").matches;
  const byName = (a) => (a?.strArtist || a?.name || "").toLowerCase();

  function syncPanelMode() {
    if (!panel) return;
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

  function applyEmpty(on) {
    if (on) { show(empty); hide(grid); hide(pager); resetGridInlineStyles(); }
    else { hide(empty); show(grid); }
  }
  function resetGridInlineStyles() {
    if (!grid) return;
    grid.style.height = "";
    grid.style.overflow = "";
    grid.style.transition = "";
    grid.style.willChange = "";
  }

  // ===== Skeletons + fade-in =====
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
    if (!grid) return;
    const n = Math.max(1, Number(count) || state.limit || 8);
    grid.innerHTML = new Array(n).fill(0).map(buildSkeletonCard).join("");
    show(grid); hide(empty); hide(pager);
  }
  function afterImagesFadeIn() {
    if (!grid) return;
    const imgs = grid.querySelectorAll("img.img-fade");
    imgs.forEach((img) => {
      const done = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth > 0) done();
      else img.addEventListener("load", done, { once: true });
    });
  }

  // ===== Плавная смена контента без «подпрыгиваний» =====
  let gridCleanupTimer = null;
  function lockGridHeight(h) {
    if (!grid) return;
    const hh = h ?? grid.getBoundingClientRect().height;
    grid.style.willChange = "height";
    grid.style.overflow = "hidden";
    grid.style.transition = "none";
    grid.style.height = `${Math.max(1, Math.round(hh || 0))}px`;
  }
  function unlockGridHeight() {
    if (!grid) return;
    grid.style.height = "";
    grid.style.overflow = "";
    grid.style.transition = "";
    grid.style.willChange = "";
  }
  function swapGridContent(renderFn) {
    if (!grid) return;
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

  // ===== Render =====
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
          <svg class="ico" aria-hidden="true">
            <use href="${SPRITE}#icon-icon_play_artists_sections"></use>
          </svg>
        </button>
      </li>`;
  }
  function renderGrid(arr) {
    if (!grid) return;
    grid.innerHTML = arr.map(buildCard).join("");
    afterImagesFadeIn();
  }
  function renderPager(page, totalPages) {
    if (!pager) return;
    if (totalPages <= 0) { pager.innerHTML = ""; hide(pager); return; }
    if (totalPages === 1) {
      pager.innerHTML = `<button class="active" data-page="1" disabled>1</button>`;
      show(pager);
      return;
    }
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

  // ===== Data =====
  async function loadGenres() {
    if (!ddGenreList) return;
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

    // фиксируем текущую высоту и сразу рисуем скелетоны
    const prevH = grid?.getBoundingClientRect().height || 0;
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
      list  = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch (e) {
      if (myId !== reqId) return;
      list = [];
      total = 0;
      toast.error?.("Failed to load artists");
    }

    // Подкрутить страницу, если вышли за пределы
    let totalPages = Math.max(1, Math.ceil(total / state.limit));
    if (state.page > totalPages && allowRetry) { state.page = totalPages; return loadArtists(false); }
    if (state.page < 1 && allowRetry) { state.page = 1; return loadArtists(false); }

    // Локальная сортировка (если надо)
    if (state.sort === "asc")  list = list.slice().sort((a, b) => byName(a).localeCompare(byName(b)));
    if (state.sort === "desc") list = list.slice().sort((a, b) => byName(b).localeCompare(byName(a)));

    if (myId !== reqId) return;

    if (!list.length) {
      if (grid) grid.innerHTML = "";
      applyEmpty(true);
      unlockGridHeight();
      return;
    }

    applyEmpty(false);
    swapGridContent(() => renderGrid(list));
    renderPager(state.page, totalPages);
  }

  function resetAll() {
    state.page = 1;
    state.sort = "";
    state.genre = "";
    state.q = "";
    if (searchInput) searchInput.value = "";
    closeDropdowns();
    loadArtists();
  }

  // ===== Dropdowns =====
  function closeDropdowns(except) {
    [ddSort, ddGenre].forEach((dd) => {
      if (!dd) return;
      if (dd !== except) {
        dd.classList.remove("open");
        const ul = dd.querySelector(".dd__list");
        if (ul) ul.style.display = "none";
      }
    });
  }
  function toggleDropdown(dd) {
    if (!dd) return;
    const open = !dd.classList.contains("open");
    closeDropdowns(dd);
    dd.classList.toggle("open", open);
    const ul = dd.querySelector(".dd__list");
    if (ul) ul.style.display = open ? "block" : "none";
  }

  // ===== UI + звуки =====
  toggleBtn?.addEventListener("click", () => {
    UISound.tap();
    state.isMobilePanelOpen = !state.isMobilePanelOpen;
    syncPanelMode();
  });
  addEventListener("resize", syncPanelMode);

  ddSortBtn?.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddSort); });
  ddGenreBtn?.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddGenre); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dd")) closeDropdowns();
  });

  ddSortList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    state.sort = li.dataset.val || "";
    state.page = 1;
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    const v = li.dataset.val || "";
    state.genre = v === "All Genres" ? "" : v;
    state.page = 1;
    toggleDropdown(ddGenre);
      loadArtists();
      ddSortBtn?.focus({ preventScroll: true });
  });

  function doSearch() {
    UISound.tap();
    state.q = searchInput?.value?.trim() || "";
    state.page = 1;
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  resetBtn?.addEventListener("click", () => { UISound.tap(); resetAll(); });
  resetBtnSm?.addEventListener("click", () => {
    UISound.tap();
    resetAll();
    state.isMobilePanelOpen = false;
    syncPanelMode();
  });
  root.querySelector("#empty-reset")?.addEventListener("click", () => { UISound.tap(); resetAll(); });

  pager?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    const p = Number(b.dataset.page) || 1;
    if (p === state.page) return;
    UISound.page();
    // сначала плавный скролл, затем подмена — чтобы не дёргалось
    scrollToGridTop();
    state.page = p;
    loadArtists();
  });

  // Learn more → модалка
  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="more"]'); if (!btn) return;
    const id = btn.closest(".card")?.dataset?.id; if (!id) return;
    UISound.tap();
    try {
      createArtistModal(modalEl, id);
    } catch (err) {
      console.error(err);
      toast.error?.("Failed to open modal");
    }
  });

  // ===== Init =====
  syncPanelMode();
  loadGenres();
  loadArtists();
}
