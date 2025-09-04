// src/js/artists/features/grid.js
import { UISound } from "../lib/sound.js";
import { fetchArtists, fetchGenres } from "./api.js";
import { ArtistState } from "./state.js";
import { createArtistModal } from "./modal.js";
import { openZoom } from "./zoom.js";

// === SPRITE: инлайн через Vite ?raw (id-only в <use>) ===
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
const icon = (id, cls = "ico") =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}" xlink:href="#${id}"></use></svg>`;

// ——— параметры рендеринга ———
const DEFAULT_LIMIT = 8;

// Без сетевых запросов → не будет ошибок в консоли
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <rect width="100%" height="100%" fill="#0b0b0b"/>
      <text x="50%" y="50%" fill="#888" font-family="IBM Plex Sans,Arial,sans-serif"
            font-size="28" text-anchor="middle" dominant-baseline="middle">No image</text>
    </svg>`
  );

// аккуратно отсекаем «странные» URL, чтобы не гонять лишние запросы
function looksLikeImageUrl(u) {
  if (!u || typeof u !== "string") return false;
  if (!/^https?:\/\//i.test(u)) return false;
  if (/null|undefined$/i.test(u)) return false;
  // допускаем и svg, и растровые
  if (!/\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|#|$)/i.test(u)) return false;
  return true;
}

// лимит для List View
function computeListLimit() {
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  if (w >= 1440) return 16;
  if (w >= 768) return 12;
  return 10;
}

// гарантируем наличие кнопки List view (особенно на мобилке)
function ensureViewToggle(root) {
  let btn = root.querySelector("#view-toggle");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "view-toggle";
    btn.type = "button";
    btn.className = "filters__view";
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "List view";
    const mount =
      root.querySelector(".filters__bar") ||
      root.querySelector(".filters") ||
      root;
    mount.appendChild(btn);
  }
  return btn;
}

export function initGrid(root = document.querySelector("#artists-section")) {
  if (!root) return;

  ensureSpriteMounted(document);

  // ---------- refs ----------
  const panel = root.querySelector("#filters-panel");
  const toggleBtn = root.querySelector("#filters-toggle");
  const resetBtn = root.querySelector("#filters-reset");
  const resetBtnSm = root.querySelector("#filters-reset-sm");
  const viewToggle = ensureViewToggle(root);

  const searchInput = root.querySelector("#flt-q");
  const searchBtn = root.querySelector("#flt-q-btn");

  const ddSort = root.querySelector('.dd[data-dd="sort"]');
  const ddSortBtn = root.querySelector("#dd-sort-btn") || ddSort?.querySelector(".dd__btn");
  const ddSortList = root.querySelector("#dd-sort-list") || ddSort?.querySelector(".dd__list");

  const ddGenre = root.querySelector('.dd[data-dd="genre"]');
  const ddGenreBtn = root.querySelector("#dd-genre-btn") || ddGenre?.querySelector(".dd__btn");
  const ddGenreList = root.querySelector("#dd-genre-list") || ddGenre?.querySelector(".dd__list");

  const grid = root.querySelector("#artists-grid");
  const pager = root.querySelector("#artists-pager");
  const empty = root.querySelector("#artists-empty");
  const sectionRoot = root.closest(".artists1") || root;

  const modalApi = createArtistModal(document);

  let reqId = 0;
  let lastAppliedLimit = null;

  // ---------- utils ----------
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const isDesktop = () => matchMedia("(min-width:1440px)").matches;
  const byName = (a) => (a?.strArtist || a?.name || "").toLowerCase();
  const isListMode = () => sectionRoot.classList.contains("view-list");

  function updateViewButtonUI(listOn) {
    viewToggle?.setAttribute("aria-pressed", String(listOn));
    if (viewToggle) viewToggle.textContent = listOn ? "Default view" : "List view";
  }

  function applyAutoLimitForCurrentMode({ resetPage = false } = {}) {
    const want = isListMode() ? computeListLimit() : DEFAULT_LIMIT;
    if (lastAppliedLimit === want) return;
    lastAppliedLimit = want;
    ArtistState.setLimit(want);
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
    if (on) {
      show(empty);
      hide(grid);
      hide(pager);
      resetGridInlineStyles();
    } else {
      hide(empty);
      show(grid);
    }
  }
  function resetGridInlineStyles() {
    grid.style.height = "";
    grid.style.overflow = "";
    grid.style.transition = "";
    grid.style.willChange = "";
  }

  // skeleton + fade-in
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
    show(grid);
    hide(empty);
    hide(pager);
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
    grid.querySelectorAll("img").forEach((img) => {
      img.onerror = () => {
        img.onerror = null;
        img.src = FALLBACK_IMG; // локальный data: → нет ошибок в консоли
      };
    });
  }

  // удерживаем высоту на время перерендера
  let gridCleanupTimer = null;
  function lockGridHeight(h) {
    const hh = h ?? grid.getBoundingClientRect().height;
    grid.style.willChange = "height";
    grid.style.overflow = "hidden";
    grid.style.transition = "none";
    grid.style.height = `${Math.max(1, Math.round(hh || 0))}px`;
  }
  function unlockGridHeight() {
    resetGridInlineStyles();
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

  // ---------- rendering ----------
  function buildCard(a) {
    const id = a?.id || a?._id || a?.artistId || "";
    const name = a?.strArtist || a?.name || "Unknown";
    const rawImg = a?.strArtistThumb || a?.photo || a?.image || "";
    const img = looksLikeImageUrl(rawImg) ? rawImg : FALLBACK_IMG;
    const about = a?.strBiographyEN || a?.about || "";
    const tags = Array.isArray(a?.genres) ? a.genres : a?.genre ? [a.genre] : [];

    return `
      <li class="card" data-id="${id}">
        <div class="card__media">
          <img class="img-fade"
               src="${img}"
               alt="${name}"
               loading="lazy"
               onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
        </div>
        <div class="card__tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        <h3 class="card__title">${name}</h3>
        <p class="card__text">${about}</p>
        <button class="card__link" data-action="more">
          Learn More ${icon("icon-icon_play_artists_sections")}
        </button>
      </li>`;
  }
  function renderGrid(arr) {
    grid.innerHTML = arr.map(buildCard).join("");
    attachImgFallbacks();
    afterImagesFadeIn();
  }

  function renderPager(page, totalPages) {
    if (totalPages <= 0) {
      pager.innerHTML = "";
      hide(pager);
      return;
    }
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
      if (from > 2) out.push(`<button class="dots" disabled>…</button>`);
    }
    for (let p = from; p <= to; p++) out.push(btn(String(p), p, false, p === page));
    if (to < totalPages) {
      if (to < totalPages - 1) out.push(`<button class="dots" disabled>…</button>`);
      out.push(btn(String(totalPages), totalPages, false, page === totalPages));
    }
    out.push(btn("›", Math.min(totalPages, page + 1), page === totalPages, false));

    pager.innerHTML = out.join("");
    show(pager);
  }

  // ---------- data ----------
  async function loadGenres() {
    try {
      ddGenre?.classList.add("loading");
      ddGenreBtn?.setAttribute("aria-busy", "true");
      if (ddGenreBtn) ddGenreBtn.disabled = true;
      if (ddGenreList) {
        ddGenreList.innerHTML = `
          <li class="dd__loading">
            <span class="dd__spinner" aria-hidden="true"></span>
            <span>Loading…</span>
          </li>`;
      }
      const list = await fetchGenres();
      if (ddGenreList)
        ddGenreList.innerHTML = list.map((g) => `<li data-val="${g}">${g}</li>`).join("");
    } catch {
      if (ddGenreList) ddGenreList.innerHTML = `<li data-val="">All Genres</li>`;
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
        page,
        limit,
        genre: genre || "",
        sort: sort || "",
        name: q?.trim?.() || "",
      });
      if (myId !== reqId) return;
      list = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch {
      if (myId !== reqId) return;
      list = [];
      total = 0;
    }

    let totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages && allowRetry) {
      ArtistState.setPage(totalPages);
      return loadArtists(false);
    }
    if (page < 1 && allowRetry) {
      ArtistState.setPage(1);
      return loadArtists(false);
    }

    if (sort === "asc") list = list.slice().sort((a, b) => byName(a).localeCompare(byName(b)));
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
    if (!dd) return;
    const open = !dd.classList.contains("open");
    closeDropdowns(dd);
    dd.classList.toggle("open", open);
    const ul = dd.querySelector(".dd__list");
    if (ul) ul.style.display = open ? "block" : "none";
  }

  // ---------- UI events ----------
  toggleBtn?.addEventListener("click", () => {
    try { UISound?.tap?.(); } catch {}
    const st = ArtistState.get();
    ArtistState.setMobilePanel(!st.isMobilePanelOpen);
    syncPanelMode();
  });
  addEventListener("resize", () => {
    syncPanelMode();
    if (isListMode()) applyAutoLimitForCurrentMode({ resetPage: true });
  });

  ddSortBtn?.addEventListener("click", () => { try { UISound?.tap?.(); } catch {} toggleDropdown(ddSort); });
  ddGenreBtn?.addEventListener("click", () => { try { UISound?.tap?.(); } catch {} toggleDropdown(ddGenre); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dd")) closeDropdowns();
  });

  ddSortList?.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    try { UISound?.tap?.(); } catch {}
    ArtistState.setSort(li.dataset.val || "");
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList?.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    try { UISound?.tap?.(); } catch {}
    const v = li.dataset.val || "";
    ArtistState.setGenre(v === "All Genres" ? "" : v);
    toggleDropdown(ddGenre);
    loadArtists();
    ddSortBtn?.focus();
  });

  function doSearch() {
    try { UISound?.tap?.(); } catch {}
    ArtistState.setQuery(searchInput?.value.trim() || "");
    ArtistState.setPage(1);
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  function resetAll() {
    ArtistState.reset();
    if (searchInput) searchInput.value = "";
    closeDropdowns();
    lastAppliedLimit = null;
    applyAutoLimitForCurrentMode({ resetPage: true });
  }
  resetBtn?.addEventListener("click", () => {
    try { UISound?.tap?.(); } catch {}
    resetAll();
  });
  resetBtnSm?.addEventListener("click", () => {
    try { UISound?.tap?.(); } catch {}
    resetAll();
    ArtistState.setMobilePanel(false);
    syncPanelMode();
  });
  root.querySelector("#empty-reset")?.addEventListener("click", () => {
    try { UISound?.tap?.(); } catch {}
    resetAll();
  });

  pager?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    const p = Number(b.dataset.page) || 1;
    if (p === ArtistState.get().page) return;
    try { UISound?.page?.(); } catch {}
    scrollToGridTop();
    ArtistState.setPage(p);
    loadArtists();
  });

  // Learn More + Zoom
  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest(".card__link, [data-action='more']");
    if (btn) {
      const id = btn.closest(".card")?.dataset?.id;
      if (!id) return;
      try { UISound?.tap?.(); } catch {}
      modalApi.openFor(id);
      return;
    }
    const img = e.target.closest(".card__media img");
    if (img) {
      try { UISound?.tap?.(); } catch {}
      const src = img.currentSrc || img.src || img.getAttribute("src") || "";
      openZoom(src, img.getAttribute("alt") || "");
    }
  });

  // List/Grid view
  viewToggle?.addEventListener("click", () => {
    try { UISound?.tap?.(); } catch {}
    const listOn = !isListMode();
    sectionRoot.classList.toggle("view-list", listOn);
    sectionRoot.classList.toggle("view-grid", !listOn);
    updateViewButtonUI(listOn);
    lastAppliedLimit = null;
    applyAutoLimitForCurrentMode({ resetPage: true });
  });

  // init
  updateViewButtonUI(isListMode());
  syncPanelMode();
  lastAppliedLimit = null;
  applyAutoLimitForCurrentMode({ resetPage: false });
  loadGenres();
  loadArtists();
}
