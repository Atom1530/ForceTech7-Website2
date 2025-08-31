// /src/js/artists1.js
import { fetchArtists, fetchGenres, fetchArtist, fetchArtistAlbums } from "./api1.js";

(function initArtists1() {
  const root = document.querySelector("#artists-section");
  if (!root) return;

  // ---- refs
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

  // ---- state
  const state = {
    page: 1,
    limit: 8,
    total: 0,
    sort: "",     
    genre: "",    
    q: "",        
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
    if (on) {
      show(empty); hide(grid); hide(pager);
    } else {
      hide(empty); show(grid);
    }
  }

  function buildCard(a){
    const id = a?.id || a?._id || a?.artistId || "";
    const name = a?.strArtist || a?.name || "Unknown";
    const img = a?.strArtistThumb || a?.photo || a?.image || "https://via.placeholder.com/472x290?text=No+Image";
    const about = a?.strBiographyEN || a?.about || "";
    const tags = Array.isArray(a?.genres) ? a.genres : (a?.genre ? [a.genre] : []);
    return `
      <li class="card" data-id="${id}">
        <div class="card__media"><img src="${img}" alt="${name}" loading="lazy"></div>
        <div class="card__tags">${tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <h3 class="card__title">${name}</h3>
        <p class="card__text">${about}</p>
        <button class="card__link" data-action="more">
          Learn More
          <svg class="ico"><use href="#icon-icon_right_button_feedback_sec"></use></svg>
        </button>
      </li>`;
  }

  function renderGrid(arr){ grid.innerHTML = arr.map(buildCard).join(""); }

  function renderPager(page, totalPages){
    if (totalPages <= 1){ pager.innerHTML = ""; return; }
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

  // ---- data
  async function loadGenres(){
    try{
      const list = await fetchGenres();
      ddGenreList.innerHTML = list.map(g=>`<li data-val="${g}">${g}</li>`).join("");
    }catch{ ddGenreList.innerHTML = `<li data-val="">All Genres</li>`; }
  }

  
  async function loadArtists(){
    show(loader); hide(pager);

    const wantSearch = (state.q.trim().length >= 2);
    let list = [];
    let total = 0;

    try {
      if (wantSearch) {
       
        const res = await fetchArtists({ page: 1, limit: 200, genre: state.genre || "" });
        list = Array.isArray(res.artists) ? res.artists : [];
       
        if (state.genre) {
          list = list.filter(a => {
            const gs = Array.isArray(a?.genres) ? a.genres : (a?.genre ? [a.genre] : []);
            return gs.includes(state.genre);
          });
        }
        const ql = state.q.trim().toLowerCase();
        list = list.filter(a => byName(a).includes(ql));
        total = list.length;
      } else {
        
        const res = await fetchArtists({ page: state.page, limit: state.limit, genre: state.genre || "" });
        list = Array.isArray(res.artists) ? res.artists : [];
        total = Number(res.totalArtists || list.length || 0);
      }
    } catch {
      list = []; total = 0;
    }

    
    if (state.sort === "asc")  list = list.slice().sort((a,b)=> byName(a).localeCompare(byName(b)));
    if (state.sort === "desc") list = list.slice().sort((a,b)=> byName(b).localeCompare(byName(a)));

   
    let toRender = list;
    let totalPages;
    if (wantSearch) {
      totalPages = Math.max(1, Math.ceil(list.length / state.limit));
      const start = (state.page - 1) * state.limit;
      toRender = list.slice(start, start + state.limit);
    } else {
      totalPages = Math.max(1, Math.ceil(total / state.limit));
    }

    if (!toRender.length){
      hide(loader); grid.innerHTML = ""; applyEmpty(true); return;
    }

    applyEmpty(false);
    renderGrid(toRender);
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
    closeDropdowns();
    loadArtists();
  }

  // ---- dropdowns
  function closeDropdowns(except){
    [ddSort, ddGenre].forEach(dd=>{
      if (dd !== except) {
        dd.classList.remove("open");
        const ul = dd.querySelector(".dd__list");
        if (ul) ul.style.display = "none";
      }
    });
  }
  function toggleDropdown(dd){
    const open = !dd.classList.contains("open");
    closeDropdowns(dd);
    dd.classList.toggle("open", open);
    const ul = dd.querySelector(".dd__list");
    if (ul) ul.style.display = open ? "block" : "none";
  }

  // ---- events
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
  searchBtn.addEventListener("click", doSearch);
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

  // ---- modal
  grid.addEventListener("click", async (e)=>{
    const btn = e.target.closest('[data-action="more"]'); if(!btn) return;
    const id = btn.closest(".card")?.dataset?.id; if(!id) return;
    openModal();
    await renderModal(id);
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click",(e)=>{ if(e.target.classList.contains("amodal__backdrop")) closeModal(); });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && !modal.hasAttribute("hidden")) closeModal(); });

  function openModal(){ modal.removeAttribute("hidden"); document.documentElement.style.overflow="hidden"; modalBody.innerHTML = `<div class="amodal__loader loader"></div>`; }
  function closeModal(){ modal.setAttribute("hidden",""); document.documentElement.style.overflow=""; modalBody.innerHTML = ""; }

  function years(details){
    const s = details?.intFormedYear || details?.yearStart || details?.formedYear;
    const e = details?.intDiedYear   || details?.yearEnd   || details?.disbandedYear;
    if (s && e) return `${s}–${e}`;
    if (s) return `${s}—present`;
    return "—";
  }
  function trackRow(t){
    const title = t?.title || t?.strTrack || t?.name || "—";
    const dur   = t?.time || t?.duration || t?.strDuration || t?.intDuration || "—";
    const y     = t?.youtube || t?.youtube_url || t?.url || t?.strMusicVid || "";
    const yIcon = `<svg class="ico" style="width:14px;height:14px"><use href="#icon-icon_youtube_footer"></use></svg>`;
    return `<li class="tr"><span>${title}</span><span>${dur}</span><span>${y ? `<a href="${y}" target="_blank" rel="noopener">${yIcon}</a>` : ""}</span></li>`;
  }
  async function renderModal(id){
    const [a, albums] = await Promise.all([fetchArtist(id), fetchArtistAlbums(id)]);
    const d = a || {};
    const name    = d?.strArtist || d?.name || "Unknown artist";
    const img     = d?.strArtistThumb || d?.photo || d?.image || "https://via.placeholder.com/960x400?text=No+Image";
    const country = d?.strCountry || d?.country || "—";
    const members = d?.intMembers || d?.members || "—";
    const sex     = d?.strGender || d?.sex || "—";
    const bio     = d?.strBiographyEN || d?.about || "";
    const genres  = Array.isArray(d?.genres) ? d.genres : (d?.genre ? [d.genre] : []);

    const albumsMarkup = (albums||[]).map(alb=>{
      const title  = alb?.title || alb?.strAlbum || alb?.name || "Album";
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks : (Array.isArray(alb?.songs) ? alb.songs : []);
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
          <div><b>Years active</b><br>${years(d)}</div>
          <div style="margin-top:10px"><b>Members</b><br>${members}</div>
        </div>
        <div>
          <div><b>Sex</b><br>${sex}</div>
          <div style="margin-top:10px"><b>Country</b><br>${country}</div>
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
  syncPanelMode();
  loadGenres();
  loadArtists();
})();

