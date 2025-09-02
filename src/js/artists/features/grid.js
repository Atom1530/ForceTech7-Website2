
import { UISound } from "../lib/sound.js";
import { fetchArtists, fetchGenres, fetchArtistAlbums } from "./api.js";
import { ArtistState } from "./state.js";
import { createArtistModal } from "./modal.js";
import { createMiniPlayer } from "./player.js";
import { openZoom } from "./zoom.js";

const SPRITE = "/img/sprite.svg";

export function initGrid(root = document.querySelector("#artists-section")) {
  if (!root) return;

  // ---------- refs ----------
  const panel       = root.querySelector("#filters-panel");
  const toggleBtn   = root.querySelector("#filters-toggle");
  const resetBtn    = root.querySelector("#filters-reset");
  const resetBtnSm  = root.querySelector("#filters-reset-sm");

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

  // модалка (API) + глобальный мини-плеер (для «радио»)
  const modalApi = createArtistModal(document);
  const radioPlayer = createMiniPlayer(); // singleton, монтируется в <body>

  // текущее содержимое для «радио»
  let lastList = [];

  // защита от гонок API
  let reqId = 0;

  // ---------- utils ----------
  const show = (el) => el && el.removeAttribute("hidden");
  const hide = (el) => el && el.setAttribute("hidden", "");
  const isDesktop = () => matchMedia("(min-width:1440px)").matches;
  const byName = (a) => (a?.strArtist || a?.name || "").toLowerCase();

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
    const n = Math.max(1, Number(count) || 8);
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

  // удержание высоты на время смены контента
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
    grid.innerHTML = arr.map(buildCard).join("");
    afterImagesFadeIn();
  }

  function renderPager(page, totalPages) {
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

    // фиксируем высоту → скелетоны → скрываем пейджер
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
      if (myId !== reqId) return; // устаревший ответ
      list  = Array.isArray(server.artists) ? server.artists : [];
      total = Number(server.totalArtists || list.length || 0);
    } catch {
      if (myId !== reqId) return;
      list = [];
      total = 0;
    }

    // страницы и кламп
    let totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages && allowRetry) { ArtistState.setPage(totalPages); return loadArtists(false); }
    if (page < 1 && allowRetry)          { ArtistState.setPage(1);         return loadArtists(false); }

    // локальная сортировка
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
    lastList = list.slice(); // для «радио»
    renderPager(ArtistState.get().page, totalPages);
  }

  // ---------- dropdowns ----------
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

  // ---------- UI events ----------
  toggleBtn?.addEventListener("click", () => {
    UISound.tap();
    const st = ArtistState.get();
    ArtistState.setMobilePanel(!st.isMobilePanelOpen);
    syncPanelMode();
  });
  addEventListener("resize", syncPanelMode);

  ddSortBtn?.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddSort); });
  ddGenreBtn?.addEventListener("click", () => { UISound.tap(); toggleDropdown(ddGenre); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeDropdowns(); });

  ddSortList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    ArtistState.setSort(li.dataset.val || "");
    toggleDropdown(ddSort);
    loadArtists();
  });

  ddGenreList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    UISound.tap();
    const v = li.dataset.val || "";
    ArtistState.setGenre(v === "All Genres" ? "" : v);
    toggleDropdown(ddGenre);
    loadArtists();
    ddSortBtn?.focus();
  });

  function doSearch() {
    UISound.tap();
    ArtistState.setQuery(searchInput.value.trim());
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  function resetAll() {
    ArtistState.reset();
    if (searchInput) searchInput.value = "";
    closeDropdowns();
    loadArtists();
  }
  resetBtn?.addEventListener("click", () => { UISound.tap(); resetAll(); });
  resetBtnSm?.addEventListener("click", () => {
    UISound.tap();
    resetAll();
    ArtistState.setMobilePanel(false);
    syncPanelMode();
  });
  root.querySelector("#empty-reset")?.addEventListener("click", () => { UISound.tap(); resetAll(); });

  pager?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    const p = Number(b.dataset.page) || 1;
    if (p === ArtistState.get().page) return;
    UISound.page();
    scrollToGridTop();
    ArtistState.setPage(p);
    loadArtists();
  });

  // ---------- модалка + зум ----------
  grid.addEventListener("click", (e) => {
    // Learn More → модалка
    const btn = e.target.closest('[data-action="more"]');
    if (btn) {
      const id = btn.closest(".card")?.dataset?.id;
      if (!id) return;
      UISound.tap();
      modalApi.openFor(id);
      return;
    }

    // Клик по фото → zoom
    const img = e.target.closest(".card__media img");
    if (img) {
      UISound.tap();
      const src = img.currentSrc || img.src || img.getAttribute("src") || "";
      openZoom(src, img.getAttribute("alt") || "");
    }
  });

  // ---------- RADIO: случайные треки из видимых артистов ----------
  async function startRadioFromVisible() {
    try {
      const ids = lastList.map(a => a?.id).filter(Boolean);
      if (!ids.length) { window.__toast?.info?.("Сначала загрузите артистов."); return; }

      const pick = ids.sort(() => Math.random() - 0.5).slice(0, 10);
      const albumsArr = await Promise.all(pick.map(id => fetchArtistAlbums(id).catch(() => [])));

      const urls = [];
      for (const albums of albumsArr) {
        for (const alb of (albums || [])) {
          for (const t of (alb.tracks || [])) {
            if (t.youtube) urls.push(t.youtube);
          }
        }
      }
      if (!urls.length) { window.__toast?.error?.("Не нашли треков с YouTube-ссылками в текущем списке."); return; }

      radioPlayer.playQueue(urls, { shuffle: true, loop: true });
    } catch (e) {
      window.__toast?.error?.("Не удалось запустить радио.");
    }
  }
  const radioBtn = root.querySelector("#radio-shuffle");
  radioBtn?.addEventListener("click", () => { UISound.tap(); startRadioFromVisible(); });

  // ---------- init ----------
  syncPanelMode();
  loadGenres();
  loadArtists();
}

