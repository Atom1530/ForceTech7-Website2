import { fetchArtists, fetchGenres, fetchIndAboutArtist } from "./api";

const sprite = "/img/sprite.svg";

/* ---------- состояние ---------- */
const st = { page:1, limit:8, genre:"", sort:"", q:"", total:0, artists:[] };
const section   = document.querySelector(".artists");
const gallery   = section.querySelector("[data-gallery]");
const paginator = section.querySelector(".paginator");
const emptyBox  = section.querySelector("#artistsEmpty");
const filters   = section.querySelector("#filters");
const toggleBtn = section.querySelector("#filtersToggle");

/* элементы фильтров */
const searchInput = filters.querySelector("#filtersSearchInput");
const searchBtn   = filters.querySelector("#filtersSearchBtn");
const resetBtn    = filters.querySelector("#filtersReset");
const sortBtn     = filters.querySelector("#sortToggle");
const sortMenu    = filters.querySelector("#sortMenu");
const genreBtn    = filters.querySelector("#genreToggle");
const genreMenu   = filters.querySelector("#genreMenu");

const sortIconUse  = sortBtn.querySelector("use");
const genreIconUse = genreBtn.querySelector("use");
const toggleIconUse= toggleBtn.querySelector("use");

/* ---------- утилиты ---------- */
const isDesktop = () => window.matchMedia("(min-width:1440px)").matches;
const setIcon = (useEl, id) => useEl && useEl.setAttribute("href", `${sprite}#${id}`);
const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/* ---------- фильтры ---------- */
function updateFiltersVisibility(open){
  if (isDesktop()){
    filters.setAttribute("aria-hidden","false"); // стационарно слева
    toggleBtn.setAttribute("aria-expanded","false");
    setIcon(toggleIconUse, "icon-icon_menu_mobile_navbar");
  } else {
    filters.setAttribute("aria-hidden", open ? "false" : "true");
    toggleBtn.setAttribute("aria-expanded", String(open));
    setIcon(toggleIconUse, open ? "icon-icon_close" : "icon-icon_menu_mobile_navbar");
  }
}

/* ---------- рендер ---------- */
function renderCards(list){
  gallery.innerHTML = list.map(a=>{
    const id    = a.id;
    const name  = a.strArtist || a.name || "Unknown";
    const img   = a.strArtistThumb || a.image || "";
    const bio   = a.strBiographyEN || a.description || "";
    const tags  = Array.isArray(a.genres) ? a.genres : [];

    return `
      <div class="card">
        <div class="card__media">
          <img src="${img}" alt="${esc(name)}" loading="lazy" />
        </div>
        <div class="card__body" data-id="${id}">
          <div class="tags">${tags.map(g=>`<span class="tag">${esc(g)}</span>`).join("")}</div>
          <h3 class="card__title">${esc(name)}</h3>
          <p class="card__text">${esc(bio)}</p>
          <div class="card__footer">
            <button class="card__link">Learn More
              <svg class="icon-learn-more"><use href="${sprite}#icon-icon_play_artists_sections"></use></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderPagination(total, page, limit){
  const pages = Math.max(1, Math.ceil(total/limit));
  if (!total){ paginator.innerHTML = ""; return; }

  const btn = (label, p, dis=false, act=false, aria="") =>
    `<button class="pg__btn${act?" is-act":""}${dis?" is-dis":""}" data-page="${p}" ${dis?"disabled":""} ${aria}>${label}</button>`;

  const items = [];
  const first=1, last=pages;
  const prev = Math.max(first, page-1);
  const next = Math.min(last,  page+1);

  items.push(btn("‹", prev, page===first, false, 'aria-label="Previous"'));

  const show = new Set([first, page-1, page, page+1, last].filter(n=>n>=first && n<=last));
  let lastPrinted = 0;
  [...show].sort((a,b)=>a-b).forEach(n=>{
    if (lastPrinted && n-lastPrinted>1) items.push(`<span class="pg__dots">…</span>`);
    items.push(btn(String(n), n, false, n===page));
    lastPrinted = n;
  });

  items.push(btn("›", next, page===last, false, 'aria-label="Next"'));
  paginator.innerHTML = items.join("");
}

/* ---------- пустое состояние ---------- */
function showEmpty(show){
  emptyBox.classList.toggle("hiden", !show);
  if (show) gallery.innerHTML = "";
}

/* ---------- загрузка данных ---------- */
async function loadGenres(){
  const list = await fetchGenres(); // [{label,value}]
  genreMenu.innerHTML = list.map(({label,value}) =>
    `<li><button type="button" class="dd__item" data-genre="${esc(value)}">${esc(label)}</button></li>`
  ).join("");
}

async function loadArtists(){
  const { artists, totalArtists } = await fetchArtists(st);
  st.artists = artists; st.total = totalArtists;

  if (!artists.length){ showEmpty(true); renderPagination(0, st.page, st.limit); return; }
  showEmpty(false);
  renderCards(artists);
  renderPagination(totalArtists, st.page, st.limit);
}

/* ---------- события ---------- */
toggleBtn.addEventListener("click", ()=>{
  const willOpen = toggleBtn.getAttribute("aria-expanded") !== "true";
  updateFiltersVisibility(willOpen);
});
window.addEventListener("resize", ()=> updateFiltersVisibility(false) );

sortBtn.addEventListener("click", ()=>{
  const open = sortBtn.getAttribute("aria-expanded") !== "true";
  sortBtn.setAttribute("aria-expanded", String(open));
  sortMenu.classList.toggle("is-open", open);
  setIcon(sortIconUse, open ? "icon-icon_close" : "icon-icon_menu_mobile_navbar");
  // закрыть соседний
  genreBtn.setAttribute("aria-expanded","false");
  genreMenu.classList.remove("is-open");
  setIcon(genreIconUse,"icon-icon_menu_mobile_navbar");
});

genreBtn.addEventListener("click", ()=>{
  const open = genreBtn.getAttribute("aria-expanded") !== "true";
  genreBtn.setAttribute("aria-expanded", String(open));
  genreMenu.classList.toggle("is-open", open);
  setIcon(genreIconUse, open ? "icon-icon_close" : "icon-icon_menu_mobile_navbar");
  // закрыть соседний
  sortBtn.setAttribute("aria-expanded","false");
  sortMenu.classList.remove("is-open");
  setIcon(sortIconUse,"icon-icon_menu_mobile_navbar");
});

sortMenu.addEventListener("click", e=>{
  const btn = e.target.closest(".dd__item"); if (!btn) return;
  st.sort = btn.dataset.sort || "";
  st.page = 1;
  sortBtn.click(); // закрыть
  loadArtists();
});

genreMenu.addEventListener("click", e=>{
  const btn = e.target.closest(".dd__item"); if (!btn) return;
  st.genre = btn.dataset.genre || "";
  st.page = 1;
  genreBtn.click(); // закрыть
  loadArtists();
});

searchBtn.addEventListener("click", ()=>{
  st.q = searchInput.value.trim(); st.page = 1; loadArtists();
});
searchInput.addEventListener("keydown", e=>{
  if (e.key === "Enter"){ st.q = searchInput.value.trim(); st.page = 1; loadArtists(); }
});

resetBtn.addEventListener("click", ()=>{
  st.page=1; st.genre=""; st.sort=""; st.q="";
  searchInput.value = "";
  sortBtn.setAttribute("aria-expanded","false"); sortMenu.classList.remove("is-open"); setIcon(sortIconUse,"icon-icon_menu_mobile_navbar");
  genreBtn.setAttribute("aria-expanded","false"); genreMenu.classList.remove("is-open"); setIcon(genreIconUse,"icon-icon_menu_mobile_navbar");
  if (!isDesktop()) updateFiltersVisibility(false);
  loadArtists();
});

emptyBox.querySelector("#emptyResetBtn").addEventListener("click", ()=> resetBtn.click() );

paginator.addEventListener("click", e=>{
  const b = e.target.closest(".pg__btn"); if (!b || b.disabled) return;
  st.page = Number(b.dataset.page);
  loadArtists();
  window.scrollTo({ top: section.offsetTop - 12, behavior: "smooth" });
});

gallery.addEventListener("click", async e=>{
  const btn = e.target.closest(".card__link"); if (!btn) return;
  const id = btn.closest(".card__body")?.dataset?.id; if (!id) return;
  openModal(id);
});

/* ---------- модалка ---------- */
let modal;
function ensureModal(){
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "modal hiden";
  modal.innerHTML = `
    <div class="modal__backdrop"></div>
    <div class="modal__box" role="dialog" aria-modal="true">
      <button class="modal__close" aria-label="Close">
        <svg class="icon"><use href="${sprite}#icon-icon_close"></use></svg>
      </button>
      <div class="modal__content"><div class="modal__loader">Loading…</div></div>
    </div>`;
  document.body.appendChild(modal);

  const close = ()=>{ modal.classList.add("hiden"); document.body.style.overflow=""; document.removeEventListener("keydown", onEsc); };
  const onEsc = e=>{ if (e.key==="Escape") close(); };

  modal.querySelector(".modal__backdrop").addEventListener("click", close);
  modal.querySelector(".modal__close").addEventListener("click", close);
  modal.close = close; modal.onEsc = onEsc;
  return modal;
}
async function openModal(id){
  const m = ensureModal();
  m.classList.remove("hiden"); document.body.style.overflow="hidden"; document.addEventListener("keydown", m.onEsc);
  const box = m.querySelector(".modal__content");
  box.innerHTML = `<div class="modal__loader">Loading…</div>`;

  // найдём краткие данные из текущего списка
  const brief = st.artists.find(a=> String(a.id) === String(id)) || {};
  const name  = brief.strArtist || brief.name || "Unknown";
  const img   = brief.strArtistThumb || brief.image || "";
  const genres= Array.isArray(brief.genres) ? brief.genres : [];

  const { albums } = await fetchIndAboutArtist(id);

  const rows = (tracks)=> (tracks||[]).map(t=>{
    const n = t.strTrack || t.name || "Track";
    const len = t.intDuration || t.length || t.time || "";
    const link = t.strMusicVid || t.youtube || t.url || "";
    return `<li class="tr">
      <span class="tr__name">${esc(n)}</span>
      <span class="tr__time">${esc(len)}</span>
      <span class="tr__link">${link ? `<a href="${link}" target="_blank" rel="noreferrer"><svg class="icon"><use href="${sprite}#icon-icon_youtube_footer"></use></svg></a>` : ""}</span>
    </li>`;
  }).join("");

  const albumsHtml = (albums && albums.length)
    ? albums.map(alb=>{
        const title = alb.strAlbum || alb.title || "Untitled";
        const list = alb.tracks || alb.songs || [];
        return `<section class="album">
          <h5 class="album__title">${esc(title)}</h5>
          <ul class="table">
            <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
            ${rows(list)}
          </ul>
        </section>`;
      }).join("")
    : `<div class="albums__empty">No albums data</div>`;

  box.innerHTML = `
    <h3 class="modal__title">${esc(name)}</h3>
    <div class="modal__hero">
      ${img ? `<img class="modal__img" src="${img}" alt="${esc(name)}">` : ""}
      <div class="modal__facts">
        <div><b>Years active</b><span>${brief.yearsActive ?? "information missing"}</span></div>
        <div><b>Sex</b><span>${brief.sex ?? (brief.type ?? "—")}</span></div>
        <div><b>Members</b><span>${brief.members ?? "—"}</span></div>
        <div><b>Country</b><span>${brief.country ?? "—"}</span></div>
      </div>
    </div>
    <div class="modal__bio">
      <h4>Biography</h4>
      <p>${esc(brief.strBiographyEN || brief.description || "—")}</p>
      <div class="tags">${genres.map(g=>`<span class="tag">${esc(g)}</span>`).join("")}</div>
    </div>
    <h4 class="modal__albumsTitle">Albums</h4>
    <div class="modal__albums">${albumsHtml}</div>
  `;
}

/* ---------- init ---------- */
(async function init(){
  updateFiltersVisibility(false);     // моб/таб — закрыт; десктоп — виден слева
  await loadGenres();
  await loadArtists();
})();
