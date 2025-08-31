
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

(function initArtists1() {
  const root = document.querySelector("#artists-section");
  if (!root) {
    console.warn("[artists1] #artists-section not found");
    return;
  }

  // ---------- DOM refs ----------
  const panel       = root.querySelector("#filters-panel");
  const toggleBtn   = root.querySelector("#filters-toggle");
  const toggleIco   = root.querySelector("#filters-toggle-ico");

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
  const loader      = root.querySelector("#artists-loader");
  const empty       = root.querySelector("#artists-empty");
  const pager       = root.querySelector("#artists-pager");

  const modal       = root.querySelector("#artist-modal");
  const modalBody   = root.querySelector("#am-body");
  const modalClose  = root.querySelector("#am-close");

  // ---------- state ----------
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",  
    genre: "",  
    q: "",     
    isMobilePanelOpen: false,
  };

  // ---------- helpers ----------
  const show = el => el && el.removeAttribute("hidden");
  const hide = el => el && el.setAttribute("hidden", "");
  function setChevron(open, useEl) {
    if (!useEl) return;
    const svg = useEl.closest("svg");
    if (svg) svg.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
  }
  function closeAllDropdowns(except = null) {
    [ddSort, ddGenre].forEach(dd => {
      if (!dd) return;
      if (dd !== except) {
        dd.classList.remove("open");
        const list = dd.querySelector(".dd__list");
        if (list) list.style.display = "none";
        const useEl = dd.querySelector(".dd__btn .ico use");
        setChevron(false, useEl);
      }
    });
  }
  function openDropdown(dd, open) {
    if (!dd) return;
    dd.classList.toggle("open", open);
    const list = dd.querySelector(".dd__list");
    if (list) list.style.display = open ? "block" : "none";
    const useEl = dd.querySelector(".dd__btn .ico use");
    setChevron(open, useEl);
  }
  function setDesktopOrMobile() {
    const isDesktop = window.matchMedia("(min-width:1440px)").matches;
    if (isDesktop) {
      panel.setAttribute("aria-hidden", "false");
      state.isMobilePanelOpen = false;
      toggleBtn?.setAttribute("aria-expanded", "false");
      setChevron(false, root.querySelector("#filters-toggle-ico"));
    } else {
      panel.setAttribute("aria-hidden", state.isMobilePanelOpen ? "false" : "true");
      toggleBtn?.setAttribute("aria-expanded", String(state.isMobilePanelOpen));
    }
  }
  function applyEmptyState(showEmpty) {
    if (showEmpty) { show(empty); hide(grid); hide(pager); }
    else { hide(empty); show(grid); }
  }

  // ---------- render ----------
  function buildCard(a) {
    const id    = a.id ?? a._id ?? a.artistId ?? "";
    const name  = a.strArtist ?? a.name ?? "Unknown";
    const img   = a.strArtistThumb ?? a.photo ?? a.image ?? "https://via.placeholder.com/472x290?text=No+Image";
    const about = a.strBiographyEN ?? a.about ?? "";
    const tags  = Array.isArray(a.genres) ? a.genres : (a.genre ? [a.genre] : []);
    return `
      <li class="card" data-id="${id}">
        <div class="card__media"><img src="${img}" alt="${name}" loading="lazy"></div>
        <div class="card__tags">
          ${tags.map(t => `<span class="tag">${t}</span>`).join("")}
        </div>
        <h3 class="card__title">${name}</h3>
        <p class="card__text">${about}</p>
        <button class="card__link" data-action="more">
          Learn More
          <svg class="ico"><use href="/img/sprite.svg#icon-chevron-right"></use></svg>
        </button>
      </li>
    `;
  }
  function renderGrid(artists) {
    grid.innerHTML = artists.map(buildCard).join("");
  }
  function renderPager(page, totalPages) {
    if (totalPages <= 1) { pager.innerHTML = ""; return; }
    const btn = (label, p, disabled = false, active = false) =>
      `<button ${disabled ? "disabled" : ""} data-page="${p}" class="${active ? "active" : ""}">${label}</button>`;
    const parts = [];
    parts.push(btn("‹", Math.max(1, page - 1), page === 1));

    const windowSize = 2;
    const from = Math.max(1, page - windowSize);
    const to   = Math.min(totalPages, page + windowSize);

    if (from > 1) {
      parts.push(btn("1", 1, false, page === 1));
      if (from > 2) parts.push(`<button class="dots">…</button>`);
    }
    for (let p = from; p <= to; p++) parts.push(btn(String(p), p, false, page === p));
    if (to < totalPages) {
      if (to < totalPages - 1) parts.push(`<button class="dots">…</button>`);
      parts.push(btn(String(totalPages), totalPages, false, page === totalPages));
    }
    parts.push(btn("›", Math.min(totalPages, page + 1), page === totalPages));
    pager.innerHTML = parts.join("");
  }

  // ---------- data ----------
  async function loadGenres() {
    try {
      const list = await fetchGenres();
      const names = (Array.isArray(list) ? list : [])
        .map(g => typeof g === "string" ? g : (g?.name || g?.title || g?.genre || ""))
        .filter(Boolean);
      const final = ["All Genres", ...names.filter((v, i, a) => a.indexOf(v) === i)];
      ddGenreList.innerHTML = final.map(g => `<li data-val="${g}">${g}</li>`).join("");
    } catch (e) {
      console.warn("[artists1] loadGenres failed:", e);
      ddGenreList.innerHTML = `<li data-val="All Genres">All Genres</li>`;
    }
  }


  async function loadArtists() {
    show(loader); hide(pager);

    const params = { page: state.page, limit: state.limit };
    if (state.q) params.q = state.q.trim();
    if (state.genre && state.genre !== "All Genres") params.genre = state.genre;

    let { artists, totalArtists } = await fetchArtists(params);
    state.total = totalArtists ?? 0;

    // клиентская сортировка
    if (artists && artists.length && (state.sort === "asc" || state.sort === "desc")) {
      const nm = a => (a?.strArtist ?? a?.name ?? "").toLocaleLowerCase();
      artists = [...artists].sort((a, b) => {
        const r = nm(a).localeCompare(nm(b));
        return state.sort === "asc" ? r : -r;
      });
    }

    if (!artists || !artists.length) {
      hide(loader);
      grid.innerHTML = "";
      applyEmptyState(true);
      return;
    }

    applyEmptyState(false);
    renderGrid(artists);

    const totalPages = Math.max(1, Math.ceil((totalArtists ?? 0) / state.limit));
    renderPager(state.page, totalPages);
    show(pager);
    hide(loader);
  }

  function resetAll() {
    state.page = 1;
    state.sort = "";
    state.genre = "";
    state.q    = "";
    searchInput.value = "";
    closeAllDropdowns();
    loadArtists();
  }

  // ---------- events ----------
  toggleBtn?.addEventListener("click", () => {
    state.isMobilePanelOpen = !state.isMobilePanelOpen;
    panel.setAttribute("aria-hidden", state.isMobilePanelOpen ? "false" : "true");
    toggleBtn?.setAttribute("aria-expanded", String(state.isMobilePanelOpen));
    setChevron(state.isMobilePanelOpen, root.querySelector("#filters-toggle-ico"));
  });
  window.addEventListener("resize", setDesktopOrMobile);

  ddSortBtn?.addEventListener("click", () => {
    const isOpen = ddSort.classList.contains("open");
    closeAllDropdowns(ddSort);
    openDropdown(ddSort, !isOpen);
  });
  ddGenreBtn?.addEventListener("click", () => {
    const isOpen = ddGenre.classList.contains("open");
    closeAllDropdowns(ddGenre);
    openDropdown(ddGenre, !isOpen);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dd")) closeAllDropdowns();
  });

  ddSortList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    state.sort = li.dataset.val || "";
    state.page = 1;
    openDropdown(ddSort, false);
    loadArtists();
  });
  ddGenreList?.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    const val = li.dataset.val || "";
    state.genre = (val === "All Genres") ? "" : val;
    state.page = 1;
    openDropdown(ddGenre, false);
    loadArtists();
  });

  function doSearch() {
    state.q = searchInput.value.trim();
    state.page = 1;
    loadArtists();
  }
  searchBtn?.addEventListener("click", doSearch);
  searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  resetBtn?.addEventListener("click", resetAll);
  resetBtnSm?.addEventListener("click", () => {
    resetAll();
    state.isMobilePanelOpen = false;
    panel.setAttribute("aria-hidden", "true");
    toggleBtn?.setAttribute("aria-expanded", "false");
    setChevron(false, root.querySelector("#filters-toggle-ico"));
  });
  root.querySelector("#empty-reset")?.addEventListener("click", resetAll);

  pager?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-page]"); if (!b || b.disabled) return;
    const p = Number(b.dataset.page) || 1;
    if (p === state.page) return;
    state.page = p;
    loadArtists();
  });

  grid?.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="more"]'); if (!btn) return;
    const id = btn.closest(".card")?.dataset?.id;
    if (!id) return;
    openModal();
    try { await renderModal(id); }
    catch { modalBody.innerHTML = `<p style="color:#fff">Failed to load details.</p>`; }
  });

  modalClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hasAttribute("hidden")) closeModal();
  });

  function openModal() {
    modal.removeAttribute("hidden");
    document.documentElement.style.overflow = "hidden";
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
  }
  function closeModal() {
    modal.setAttribute("hidden", "");
    document.documentElement.style.overflow = "";
    modalBody.innerHTML = "";
  }

  const safe = (v, fb = "—") => (v ?? fb);
  function yearsText(a) {
    const start = a?.intFormedYear || a?.yearStart || a?.formedYear;
    const end   = a?.intDiedYear   || a?.yearEnd   || a?.disbandedYear;
    if (start && end) return `${start}–${end}`;
    if (start) return `${start}—present`;
    return "information missing";
  }
  function trackRow(t) {
    const title = t?.title || t?.strTrack || t?.name || t?.track || "—";
    const dur   = t?.time  || t?.duration || t?.strDuration || t?.intDuration || "—";
    const y     = t?.youtube || t?.youtube_url || t?.url || t?.strMusicVid || "";
    const yIcon = `<svg class="ico" style="width:14px;height:14px;"><use href="/img/sprite.svg#icon-youtube"></use></svg>`;
    return `<li class="tr"><span>${title}</span><span>${dur}</span><span>${y ? `<a href="${y}" target="_blank" rel="noopener">${yIcon}</a>` : ""}</span></li>`;
  }
  async function renderModal(id) {
    const [a, albumsResp] = await Promise.all([ fetchArtist(id), fetchArtistAlbums(id) ]);
    const details = a || {};
    const name    = details?.strArtist || details?.name || "Unknown artist";
    const img     = details?.strArtistThumb || details?.photo || details?.image || "https://via.placeholder.com/960x420?text=No+Image";
    const country = details?.strCountry || details?.country || "—";
    const members = details?.intMembers || details?.members || "—";
    const sex     = details?.strGender  || details?.sex || "—";
    const bio     = details?.strBiographyEN || details?.about || "";
    const genres  = Array.isArray(details?.genres) ? details.genres : (details?.genre ? [details.genre] : []);

    const albums = Array.isArray(albumsResp) ? albumsResp : (albumsResp?.albums || []);
    const albumsMarkup = (albums || []).map(alb => {
      const title  = alb?.title || alb?.strAlbum || alb?.name || "Album";
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks : (Array.isArray(alb?.songs) ? alb.songs : []);
      return `
        <div class="album">
          <h4 class="album__title">${title}</h4>
          <ul class="tbl">
            <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
            ${tracks.map(trackRow).join("")}
          </ul>
        </div>
      `;
    }).join("");

    modalBody.innerHTML = `
      <h3 style="font:700 28px/1.2 'Epilogue';margin:0 0 14px;color:#fff">${name}</h3>
      <img src="${img}" alt="${name}" style="width:100%;max-height:420px;object-fit:cover;border-radius:12px;margin:8px 0 16px">
      <div class="cols" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
        <div>
          <div><b>Years active</b><br>${yearsText(details)}</div>
          <div style="margin-top:10px"><b>Members</b><br>${safe(members)}</div>
        </div>
        <div>
          <div><b>Sex</b><br>${safe(sex)}</div>
          <div style="margin-top:10px"><b>Country</b><br>${safe(country)}</div>
        </div>
      </div>
      <div style="margin:10px 0 14px"><b>Biography</b><br><p style="margin:6px 0 0">${bio || "—"}</p></div>
      <div class="card__tags" style="margin:12px 0 18px">${genres.map(g => `<span class="tag">${g}</span>`).join("")}</div>

      <h3 style="font:700 22px/1.2 'IBM Plex Sans';margin:12px 0 8px">Albums</h3>
      <div class="albums" style="display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
        ${albumsMarkup || "<p>—</p>"}
      </div>
    `;
  }

  // ---------- init ----------
  setDesktopOrMobile();
  loadGenres();
  loadArtists();
})();
