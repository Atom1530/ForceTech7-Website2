// /src/js/artists1.js
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

(function initArtists1() {
  const root = document.querySelector("#artists-section");
  if (!root) {
    console.warn("[artists1] #artists-section not found");
    return;
  }

  // ------- DOM refs -------
  const panel = root.querySelector("#filters-panel");
  const toggleBtn = root.querySelector("#filters-toggle");
  const toggleIco = root.querySelector("#filters-toggle-ico");
  const resetBtn = root.querySelector("#filters-reset");
  const resetBtnSm = root.querySelector("#filters-reset-sm");
  const searchInput = root.querySelector("#flt-q");
  const searchBtn = root.querySelector("#flt-q-btn");
  const ddSortBtn = root.querySelector("#dd-sort-btn");
  const ddSortIco = root.querySelector("#dd-sort-ico");
  const ddSortList = root.querySelector("#dd-sort-list");
  const ddGenreBtn = root.querySelector("#dd-genre-btn");
  const ddGenreIco = root.querySelector("#dd-genre-ico");
  const ddGenreList = root.querySelector("#dd-genre-list");

  const grid = root.querySelector("#artists-grid");
  const loader = root.querySelector("#artists-loader");
  const empty = root.querySelector("#artists-empty");
  const pager = root.querySelector("#artists-pager");

  const modal = root.querySelector("#artist-modal");
  const modalBody = root.querySelector("#am-body");
  const modalClose = root.querySelector("#am-close");

  // ------- state -------
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",         // '', 'asc', 'desc'
    genre: "",        // string or ''
    q: "",            // search text
    genres: ["All Genres"],
    isMobilePanelOpen: false,
  };

  // ------- helpers -------
  function show(el){ el?.removeAttribute("hidden"); }
  function hide(el){ el?.setAttribute("hidden",""); }
  function setChevron(open, icoEl){ if(!icoEl) return; icoEl.closest("svg").style.transform = open ? "rotate(180deg)" : "rotate(0deg)"; }

  function closeAllDropdowns(except=null){
    root.querySelectorAll(".dd").forEach(dd=>{
      if (dd !== except) {
        dd.classList.remove("open");
        const ico = dd.querySelector(".dd__btn .ico");
        setChevron(false, ico);
        dd.querySelector(".dd__list").style.display = "none";
      }
    });
  }

  function openDropdown(dd, open){
    const list = dd.querySelector(".dd__list");
    dd.classList.toggle("open", open);
    list.style.display = open ? "block" : "none";
    setChevron(open, dd.querySelector(".dd__btn .ico"));
  }

  function setDesktopOrMobile(){
    const isDesktop = window.matchMedia("(min-width:1440px)").matches;
    if (isDesktop) {
      panel.setAttribute("aria-hidden","false");
      state.isMobilePanelOpen = false;
      setChevron(false, toggleIco);
    } else {
      panel.setAttribute("aria-hidden", state.isMobilePanelOpen ? "false" : "true");
    }
  }

  function applyEmptyState(showEmpty){
    if (showEmpty){ show(empty); hide(grid); hide(pager); }
    else { hide(empty); show(grid); }
  }

  function buildCard(a){
    const id = a.id ?? a._id ?? a.artistId ?? "";
    const name = a.strArtist ?? a.name ?? "Unknown";
    const img = a.strArtistThumb ?? a.photo ?? a.image ?? "https://via.placeholder.com/472x290?text=No+Image";
    const about = a.strBiographyEN ?? a.about ?? "";
    const tags = Array.isArray(a.genres) ? a.genres : (a.genre ? [a.genre] : []);
    return `
      <li class="card" data-id="${id}">
        <div class="card__media"><img src="${img}" alt="${name}" loading="lazy"></div>
        <div class="card__tags">
          ${tags.map(t=>`<span class="tag">${t}</span>`).join("")}
        </div>
        <h3 class="card__title">${name}</h3>
        <p class="card__text">${about}</p>
        <button class="card__link" data-action="more">
          Learn More
          <svg class="ico"><use href="/img/sprite.svg#icon-chevron-right"></use></svg>
        </button>
      </li>`;
  }

  function renderGrid(artists){
    grid.innerHTML = artists.map(buildCard).join("");
  }

  function renderPager(page, totalPages){
    if (totalPages <= 1){ pager.innerHTML = ""; return; }
    const btn = (label, p, disabled=false, active=false, extra="") =>
      `<button ${disabled?"disabled":""} data-page="${p}" class="${active?"active":""}" ${extra}>${label}</button>`;

    const parts = [];
    const add = (label,p,dis=false,act=false,extra="") => parts.push(btn(label,p,dis,act,extra));

    add("‹", Math.max(1,page-1), page===1);
    const windowSize = 2;
    const from = Math.max(1, page-windowSize);
    const to = Math.min(totalPages, page+windowSize);

    if (from>1){ add("1",1,false,page===1); if(from>2) parts.push(`<button class="dots">…</button>`); }
    for(let p=from;p<=to;p++) add(String(p),p,false,p===page);
    if (to<totalPages){ if(to<totalPages-1) parts.push(`<button class="dots">…</button>`); add(String(totalPages),totalPages,false,page===totalPages); }
    add("›", Math.min(totalPages,page+1), page===totalPages);

    pager.innerHTML = parts.join("");
  }

  async function loadGenres(){
    const list = await fetchGenres();
    state.genres = list;
    ddGenreList.innerHTML = list.map(g => `<li data-val="${g}">${g}</li>`).join("");
  }

  async function loadArtists(){
    show(loader); hide(pager);
    const { artists, totalArtists } = await fetchArtists({
      page: state.page, limit: state.limit, genre: state.genre, sort: state.sort, q: state.q
    });
    state.total = totalArtists;

    if (!artists.length){
      hide(loader);
      grid.innerHTML = "";
      applyEmptyState(true);
      return;
    }
    applyEmptyState(false);
    renderGrid(artists);

    const totalPages = Math.max(1, Math.ceil(totalArtists / state.limit));
    renderPager(state.page, totalPages);
    show(pager);
    hide(loader);
  }

  function resetAll(){
    state.page = 1;
    state.sort = "";
    state.genre = "";
    state.q = "";
    searchInput.value = "";
    closeAllDropdowns();
    loadArtists();
  }

  // ------- events -------
  // панель на мобилках/планшетах
  toggleBtn?.addEventListener("click", () => {
    state.isMobilePanelOpen = !state.isMobilePanelOpen;
    panel.setAttribute("aria-hidden", state.isMobilePanelOpen ? "false" : "true");
    setChevron(state.isMobilePanelOpen, toggleIco);
  });
  window.addEventListener("resize", setDesktopOrMobile);

  // dropdowns
  ddSortBtn.addEventListener("click", () => {
    const dd = ddSortBtn.closest(".dd");
    const isOpen = dd.classList.contains("open");
    closeAllDropdowns(dd);
    openDropdown(dd, !isOpen);
  });
  ddGenreBtn.addEventListener("click", () => {
    const dd = ddGenreBtn.closest(".dd");
    const isOpen = dd.classList.contains("open");
    closeAllDropdowns(dd);
    openDropdown(dd, !isOpen);
  });

  ddSortList.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if(!li) return;
    state.sort = li.dataset.val || "";
    state.page = 1;
    openDropdown(ddSortBtn.closest(".dd"), false);
    loadArtists();
  });
  ddGenreList.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if(!li) return;
    const val = li.dataset.val || "";
    state.genre = (val === "All Genres") ? "" : val;
    state.page = 1;
    openDropdown(ddGenreBtn.closest(".dd"), false);
    loadArtists();
  });

  const sortDD  = document.querySelector('.dd[data-dd="sort"]');
const genreDD = document.querySelector('.dd[data-dd="genre"]');

function toggleDD(dd, force) {
  const willOpen = typeof force === 'boolean' ? force : !dd.classList.contains('dd--open');
  [sortDD, genreDD].forEach(d => d !== dd && d.classList.remove('dd--open'));
  dd.classList.toggle('dd--open', willOpen);
}

document.getElementById('dd-sort-btn') ?.addEventListener('click', () => toggleDD(sortDD));
document.getElementById('dd-genre-btn')?.addEventListener('click', () => toggleDD(genreDD));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dd')) [sortDD, genreDD].forEach(d => d.classList.remove('dd--open'));
});


  // поиск
  function doSearch(){
    state.q = searchInput.value.trim();
    state.page = 1;
    loadArtists();
  }
  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doSearch(); });

  // reset
  resetBtn.addEventListener("click", resetAll);
  resetBtnSm.addEventListener("click", () => { resetAll(); state.isMobilePanelOpen=false; panel.setAttribute("aria-hidden","true"); setChevron(false,toggleIco); });
  root.querySelector("#empty-reset").addEventListener("click", resetAll);

  // пагинация
  pager.addEventListener("click", (e)=>{
    const b = e.target.closest("button[data-page]"); if(!b || b.disabled) return;
    const p = Number(b.dataset.page)||1;
    if (p===state.page) return;
    state.page = p;
    loadArtists();
  });

  // Learn More (делегирование)
  grid.addEventListener("click", async (e)=>{
    const btn = e.target.closest('[data-action="more"]'); if(!btn) return;
    const card = btn.closest(".card");
    const id = card?.dataset?.id;
    if(!id) return;

    // открыть модалку
    openModal();
    await renderModal(id);
  });

  // модалка: закрытие
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click",(e)=>{ if(e.target.classList.contains("amodal__backdrop")) closeModal(); });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && !modal.hasAttribute("hidden")) closeModal(); });

  function openModal(){
    modal.removeAttribute("hidden");
    document.documentElement.style.overflow = "hidden";
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
  }
  function closeModal(){
    modal.setAttribute("hidden","");
    document.documentElement.style.overflow = "";
    modalBody.innerHTML = "";
  }

  function yearsText(a){
    const start = a?.intFormedYear || a?.yearStart || a?.formedYear;
    const end   = a?.intDiedYear || a?.yearEnd   || a?.disbandedYear;
    if (start && end) return `${start}–${end}`;
    if (start) return `${start}—present`;
    return "information missing";
    }

  function safe(val, fallback="—"){ return val ?? fallback; }

  function trackRow(t){
    const title = t?.title || t?.strTrack || t?.name || t?.track || "—";
    const dur = t?.time || t?.duration || t?.strDuration || t?.intDuration || "—";
    const y = t?.youtube || t?.youtube_url || t?.url || t?.strMusicVid || "";
    const yIcon = `<svg class="ico" style="width:14px;height:14px;"><use href="/img/sprite.svg#icon-youtube"></use></svg>`;
    return `<li class="tr"><span>${title}</span><span>${dur}</span><span>${y?`<a href="${y}" target="_blank" rel="noopener">${yIcon}</a>`:""}</span></li>`;
  }

  async function renderModal(id){
    const [a, albums] = await Promise.all([fetchArtist(id), fetchArtistAlbums(id)]);
    // artist fallback if endpoint returns null
    const details = a || {};
    const name = details?.strArtist || details?.name || "Unknown artist";
    const img  = details?.strArtistThumb || details?.photo || details?.image || "https://via.placeholder.com/960x400?text=No+Image";
    const country = details?.strCountry || details?.country || "—";
    const members = details?.intMembers || details?.members || "—";
    const sex = details?.strGender || details?.sex || "—";
    const bio = details?.strBiographyEN || details?.about || "";

    const genres = Array.isArray(details?.genres) ? details.genres
                    : (details?.genre ? [details.genre] : []);

    const albumsMarkup = (albums||[]).map(alb=>{
      const title = alb?.title || alb?.strAlbum || alb?.name || "Album";
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks
                     : (Array.isArray(alb?.songs) ? alb.songs : []);
      return `
      <div class="album">
        <h4 class="album__title">${title}</h4>
        <ul class="tbl">
          <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
          ${tracks.map(trackRow).join("")}
        </ul>
      </div>`;
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
      <div class="card__tags" style="margin:12px 0 18px">${genres.map(g=>`<span class="tag">${g}</span>`).join("")}</div>

      <h3 style="font:700 22px/1.2 'IBM Plex Sans';margin:12px 0 8px">Albums</h3>
      <div class="albums" style="display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
        ${albumsMarkup || "<p>—</p>"}
      </div>
    `;
  }

  // init
  setDesktopOrMobile();
  loadGenres();
  loadArtists();
})();
