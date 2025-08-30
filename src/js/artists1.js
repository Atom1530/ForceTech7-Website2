/* eslint-disable */
import { fetchArtists /*, fetchIndAboutArtist */ } from './api.js';

const qs  = (s, c=document) => c.querySelector(s);
const qsa = (s, c=document) => [...c.querySelectorAll(s)];
const el  = (t, cls) => Object.assign(document.createElement(t), cls?{className:cls}:{});

const state = {
  q: '',
  sort: 'default',     // default | az | za
  genre: 'all',        // 'all' | <Genre>
  page: 1,
  perPage: 8,          // 8 как в ТЗ
  artists: [],
  genres: []
};

/* ---------- helpers ---------- */
const escapeHtml = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

const placeholderImg = (w, h, text='No Image') =>
  'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
       <rect width="100%" height="100%" fill="#121214"/>
       <text x="50%" y="50%" fill="#888" font-family="IBM Plex Sans,Arial" font-size="20"
             text-anchor="middle" dominant-baseline="middle">${escapeHtml(text)}</text>
     </svg>`
  );

/* ---------- map API -> UI ---------- */
function mapArtists(raw=[]) {
  return raw.map(a => ({
    id:   a.idArtist || a.id || a._id,
    name: a.strArtist || a.name || '',
    bio:  a.strBiographyEN || a.bio || '',
    thumb: a.strArtistThumb || a.thumb || a.photo || '',
    genres: Array.isArray(a.genres)
      ? a.genres
      : (a.strGenre ? String(a.strGenre).split(',').map(s=>s.trim()).filter(Boolean) : [])
  }));
}

/* ---------- load ALL pages once, then фильтруем локально ---------- */
async function bootstrapData(){
  let all = [];
  let total = 0;

  // первая страница
  const first = await fetchArtists();
  total = first.totalArtists || (first.artists?.length ?? 0);
  all = all.concat(mapArtists(first.artists));

  // догружаем остальные страницы
  while (all.length < total) {
    const { artists } = await fetchArtists();
    if (!artists || !artists.length) break;
    all = all.concat(mapArtists(artists));
  }
  return all;
}

/* ---------- genres, filters, sorting ---------- */
function computeGenres(list){
  const s = new Set();
  list.forEach(a => (a.genres||[]).forEach(g => s.add(g)));
  return ['All Genres', ...[...s].sort((a,b)=>a.localeCompare(b))];
}

function applyFilters(){
  const { q, sort, genre, artists } = state;
  let arr = artists.slice();

  if (q.trim()){
    const t = q.trim().toLowerCase();
    arr = arr.filter(a =>
      a.name.toLowerCase().includes(t) ||
      (a.bio||'').toLowerCase().includes(t) ||
      (a.genres||[]).some(g => g.toLowerCase().includes(t))
    );
  }
  if (genre !== 'all'){
    arr = arr.filter(a => (a.genres||[]).includes(genre));
  }
  if (sort === 'az') arr.sort((a,b)=>a.name.localeCompare(b.name));
  if (sort === 'za') arr.sort((a,b)=>b.name.localeCompare(a.name));

  return arr;
}

/* ---------- render ---------- */
function renderGallery(list){
  const root = qs('#artistsGrid');
  root.innerHTML = '';

  const start = (state.page-1) * state.perPage;
  const pageItems = list.slice(start, start + state.perPage);

  pageItems.forEach(a=>{
    const card = el('article','card');

    const media = el('a','card__media'); media.href='#'; media.setAttribute('aria-label', a.name);
    const img = el('img'); img.src = a.thumb || placeholderImg(1200,800,a.name); img.alt = a.name;
    media.append(img);

    const body = el('div','card__body');
    const tags = el('div','tags');
    (a.genres||[]).slice(0,4).forEach(t=>{ const span=el('span','tag'); span.textContent=t; tags.append(span); });
    const title=el('h3','card__title'); title.textContent=a.name;
    const text =el('p','card__text');  text.textContent=a.bio||'';

    const footer = el('div','card__footer');
    const link = el('a','card__link'); link.href='#';
    link.innerHTML = `Learn More <svg class="icon"><use href="/img/sprite.svg#icon-icon_play_artists_sections"></use></svg>`;

    footer.append(link);
    body.append(tags,title,text,footer);
    card.append(media,body);
    root.append(card);
  });

  qs('#emptyState').classList.toggle('hidden', list.length > 0);
}

function renderPagination(list){
  const total = Math.max(1, Math.ceil(list.length / state.perPage));
  state.page = Math.min(state.page, total);

  const root = qs('#artistsPagination');
  root.innerHTML = '';

  const makeNum = (p,label=p)=>{
    const btn=el('button','page-num'); btn.textContent=label;
    if (p===state.page) btn.classList.add('is-current');
    btn.addEventListener('click',()=>{ state.page=p; update(); });
    return btn;
  };
  const makeIcon=(id,fn)=>{
    const b=el('button','page-btn');
    b.innerHTML = `<svg class="icon" style="width:18px;height:18px;fill:currentColor"><use href="/img/sprite.svg#${id}"></use></svg>`;
    b.addEventListener('click',fn);
    return b;
  };

  root.append(makeIcon('icon-icon_left_button_feedback_sec', ()=>{ if(state.page>1){state.page--; update();} }));

  const maxShown = 7;
  if (total <= maxShown) {
    for(let p=1;p<=total;p++) root.append(makeNum(p));
  } else {
    const ell = ()=> root.append(Object.assign(el('span','page-ellipsis'),{textContent:'…'}));
    root.append(makeNum(1));
    if (state.page>3) ell();
    const start = Math.max(2, state.page-1);
    const end   = Math.min(total-1, state.page+1);
    for(let p=start;p<=end;p++) root.append(makeNum(p));
    if (state.page<total-2) ell();
    root.append(makeNum(total));
  }

  root.append(makeIcon('icon-icon_right_button_feedback_sec', ()=>{ if(state.page<total){state.page++; update();} }));
}

/* ---------- modal ---------- */
const modal = qs('#filtersModal');
const openModal  = ()=> modal.classList.add('is-open');
const closeModal = ()=> modal.classList.remove('is-open');

/* ---------- bind UI ---------- */
function bindUI(){
  qs('.filters-toggle').addEventListener('click', openModal);
  qs('.filters-reset').addEventListener('click', resetAll);
  qs('.empty__btn').addEventListener('click', resetAll);
  qs('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

  const input = qs('#q');
  const clear = qs('.search__clear');
  const toggleClear = ()=> clear.style.display = input.value ? 'grid' : 'none';
  input.addEventListener('input', ()=>{
    state.q = input.value;
    state.page = 1;
    toggleClear();
    update();
  });
  clear.addEventListener('click', ()=>{
    input.value = '';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.focus();
  });

  qsa('input[name="sort"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      state.sort = r.value;
      state.page = 1;
      update();
    });
  });
}

function buildGenresUI(){
  const root = qs('#genreList'); root.innerHTML='';
  state.genres.forEach((g,i)=>{
    const val = i===0 ? 'all' : g;
    const lab = el('label');
    const inp = el('input'); inp.type='radio'; inp.name='genre'; inp.value=val; if(i===0) inp.checked=true;
    inp.addEventListener('change', ()=>{ state.genre=val; state.page=1; update(); });
    const span = el('span'); span.textContent=g;
    lab.append(inp,span); root.append(lab);
  });
}

function resetAll(){
  state.q=''; state.sort='default'; state.genre='all'; state.page=1;
  qs('#q').value='';
  qsa('input[name="sort"]').forEach(r=> r.checked = (r.value==='default'));
  qsa('input[name="genre"]').forEach(r=> r.checked = (r.value==='all'));
  update();
}

/* ---------- update ---------- */
function update(){
  const list = applyFilters();
  renderGallery(list);
  renderPagination(list);
}

/* ---------- start ---------- */
(async function start(){
  bindUI();
  state.artists = await bootstrapData();         // грузим все страницы через ваш API
  state.genres  = computeGenres(state.artists);  // строим список жанров
  buildGenresUI();
  update();
})();
