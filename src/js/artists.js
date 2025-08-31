import { fetchArtists, fetchIndAboutArtist } from './api';

const state = { page: 1, limit: 8, total: 0, sort: '', genre: '', q: '' };

const grid = document.getElementById('artistsGrid');
const paginator = document.getElementById('paginator');
const emptyState = document.getElementById('emptyState');

const filtersTrigger = document.getElementById('filtersTrigger');
const filtersPanel = document.getElementById('filtersPanel');
const filtersReset = document.getElementById('filtersReset');
const emptyReset = document.getElementById('emptyReset');

const searchForm = document.getElementById('filtersSearchForm');
const searchInput = document.getElementById('searchInput');

const ddSort = document.getElementById('ddSort');
const ddGenre = document.getElementById('ddGenre');
const genreList = document.getElementById('genreList');

const modal = document.getElementById('artistModal');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');

const escapeHtml = s =>
  String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

/* ---------- иконки-триггеры (вниз = крестик, вверх = «гамбургер») ---------- */
const ICON_DOWN = '/img/sprite.svg#icon-icon_close';
const ICON_UP   = '/img/sprite.svg#icon-icon_menu_mobile_navbar';

function setTriggerIcon(open) {
  const use = filtersTrigger.querySelector('use');
  if (use) use.setAttribute('href', open ? ICON_UP : ICON_DOWN);
}
function togglePanel(force) {
  const open = typeof force === 'boolean' ? force : filtersPanel.dataset.open !== 'true';
  filtersPanel.dataset.open = String(open);
  filtersTrigger.setAttribute('aria-expanded', String(open));
  setTriggerIcon(open);
}
function setDetailsIcon(detailsEl){
  const use = detailsEl.querySelector('.dd__chev use');
  if (!use) return;
  use.setAttribute('href', detailsEl.open ? ICON_UP : ICON_DOWN);
  const summary = detailsEl.querySelector('.dd__summary');
  if (summary) summary.setAttribute('aria-expanded', String(!!detailsEl.open));
}

/* ---------- отрисовка ---------- */
function clearGrid(){ grid.innerHTML = ''; }
function showEmpty(show){
  emptyState.classList.toggle('hdn', !show);
  // когда пусто — убираем пагинатор
  if (show) paginator.style.display = 'none';
}
function showPaginator(show){ paginator.style.display = show ? 'flex' : 'none'; }

function renderCards(artists) {
  const html = artists.map(a => {
    const tags = (a.genres || []).map(g => `<span class="tag">${escapeHtml(g)}</span>`).join('');
    return `
    <article class="card">
      <div class="card__media">
        <img class="card__img" src="${escapeHtml(a.strArtistThumb)}" alt="${escapeHtml(a.strArtist)}" loading="lazy">
      </div>
      <div class="card__body" data-id="${a.id}">
        <div class="tags">${tags}</div>
        <h3 class="card__title">${escapeHtml(a.strArtist)}</h3>
        <p class="card__text">${escapeHtml(a.strBiographyEN || '')}</p>
        <div class="card__footer">
          <button class="card__link" data-action="learn-more">Learn More
            <svg width="8" height="15"><use href="/img/sprite.svg#icon-icon_play_artists_sections"></use></svg>
          </button>
        </div>
      </div>
    </article>`;
  }).join('');
  grid.insertAdjacentHTML('beforeend', html);
}

function renderPaginator(total, page, limit) {
  state.total = total;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const btn = (label, p, disabled=false, active=false) =>
    `<button class="paginator__btn ${active ? 'paginator__btn--active' : ''}"
             data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`;

  const parts = [];
  const windowSize = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  parts.push(btn('‹', Math.max(1, page - 1), page === 1));
  if (start > 1) parts.push(btn('1', 1, false, page === 1), '<span class="paginator__btn" disabled>…</span>');
  for (let i = start; i <= end; i++) parts.push(btn(String(i), i, false, i === page));
  if (end < totalPages) parts.push('<span class="paginator__btn" disabled>…</span>', btn(String(totalPages), totalPages, false, page === totalPages));
  parts.push(btn('›', Math.min(totalPages, page + 1), page === totalPages));

  paginator.innerHTML = parts.join('');
  showPaginator(totalPages > 1);
}

async function loadArtists({ reset = true } = {}) {
  const { page, limit, sort, genre, q } = state;

  // Важно: твой fetchArtists должен уметь принимать эти параметры (page, limit, sort, genre, q)
  const { artists, totalArtists } = await fetchArtists({ page, limit, sort, genre, q })
    .catch(() => ({ artists: [], totalArtists: 0 }));

  if (reset) clearGrid();

  if (!artists.length) {
    showEmpty(true);
    return;
  }

  showEmpty(false);
  renderCards(artists);
  renderPaginator(totalArtists ?? artists.length, page, limit);
}

/* ---------- пагинация ---------- */
paginator.addEventListener('click', e => {
  const btn = e.target.closest('button[data-page]');
  if (!btn) return;
  const p = Number(btn.dataset.page);
  if (!Number.isFinite(p) || p === state.page) return;
  state.page = p;
  loadArtists({ reset: true });
});

/* ---------- Learn More -> модалка ---------- */
grid.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action="learn-more"]');
  if (!btn) return;
  const card = btn.closest('.card__body');
  const id = card?.dataset.id;
  if (!id) return;

  const title = card.querySelector('.card__title')?.textContent?.trim() || 'Artist';
  const img = card.previousElementSibling.querySelector('img')?.getAttribute('src') || '';

  // лоадер (минимальный)
  modalBody.innerHTML = `<h3 id="artistModalTitle" class="artists__title" style="font-size:28px;margin:0 0 12px">${escapeHtml(title)}</h3>
    <div class="modal__hero"><img src="${escapeHtml(img)}" alt="${escapeHtml(title)}"></div>
    <p style="opacity:.8;margin:0 0 12px">Loading albums…</p>`;
  openModal();

  let albums = [];
  try {
    const resp = await fetchIndAboutArtist(id);
    albums = Array.isArray(resp.albums) ? resp.albums : [];
  } catch { /* ignore */ }

  const albumsHtml = !albums.length
    ? `<div class="modal__album" style="grid-column: 1 / -1;"><h4>No albums found</h4><p class="modal__tracks">—</p></div>`
    : albums.map(a => `
      <div class="modal__album">
        <h4>${escapeHtml(a.strAlbum || 'Album')}</h4>
        <div class="modal__tracks">
          ${(a.tracks || []).length
            ? a.tracks.map(t => `
              <div class="modal__tracks-row">
                <span>${escapeHtml(t.strTrack || '—')}</span>
                <span>${escapeHtml(t.strTrackTime || '—')}</span>
                ${t.strMusicVid ? `<a href="${escapeHtml(t.strMusicVid)}" target="_blank" rel="noopener" aria-label="YouTube">
                  <svg width="18" height="18"><use href="/img/sprite.svg#icon-icon_youtube_footer"></use></svg>
                </a>` : '<span></span>'}
              </div>
            `).join('')
            : `<div class="modal__tracks-row"><span>—</span><span>—</span><span></span></div>`}
        </div>
      </div>
    `).join('');

  modalBody.innerHTML = `
    <h3 id="artistModalTitle" class="artists__title" style="font-size:28px;margin:0 0 12px">${escapeHtml(title)}</h3>
    <div class="modal__hero"><img src="${escapeHtml(img)}" alt="${escapeHtml(title)}"></div>
    <h4 style="margin:12px 0 8px">Albums</h4>
    <div class="modal__grid">${albumsHtml}</div>
  `;
});

function openModal(){
  modal.classList.remove('hdn');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  modal.classList.add('hdn');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  modalBody.innerHTML = '';
}
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target.dataset.close === 'backdrop') closeModal(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hdn')) closeModal(); });

/* ---------- панель фильтров (tablet/mobile) ---------- */
filtersTrigger.addEventListener('click', () => { togglePanel(); });

/* ---------- reset ---------- */
function doReset() {
  state.page = 1; state.sort = ''; state.genre = ''; state.q = '';
  searchInput.value = '';
  ddSort.removeAttribute('open'); ddGenre.removeAttribute('open');
  setDetailsIcon(ddSort); setDetailsIcon(ddGenre);
  togglePanel(false);
  loadArtists({ reset: true });
}
filtersReset.addEventListener('click', doReset);
emptyReset.addEventListener('click', doReset);

/* ---------- поиск ---------- */
searchForm.addEventListener('submit', e => { e.preventDefault(); doSearch(); });
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
function doSearch(){
  state.q = searchInput.value.trim();
  state.page = 1;
  loadArtists({ reset: true });
}

/* ---------- сортировка ---------- */
ddSort.addEventListener('toggle', () => setDetailsIcon(ddSort));
ddSort.addEventListener('click', e => {
  const li = e.target.closest('.dd__item'); if (!li) return;
  state.sort = li.dataset.value || '';
  state.page = 1;
  ddSort.removeAttribute('open');
  setDetailsIcon(ddSort);
  loadArtists({ reset: true });
});

/* ---------- жанры ---------- */
async function loadGenres() {
  try {
    const res = await fetch('https://sound-wave.b.goit.study/api/genres');
    const data = await res.json();
    const items = ['All Genres', ...data].map(name => {
      const val = name === 'All Genres' ? '' : name;
      return `<li class="dd__item" role="menuitem" data-value="${escapeHtml(val)}">${escapeHtml(name)}</li>`;
    }).join('');
    genreList.innerHTML = items;
  } catch { /* ignore */ }
}
ddGenre.addEventListener('toggle', () => setDetailsIcon(ddGenre));
ddGenre.addEventListener('click', e => {
  const li = e.target.closest('.dd__item'); if (!li) return;
  state.genre = li.dataset.value || '';
  state.page = 1;
  ddGenre.removeAttribute('open');
  setDetailsIcon(ddGenre);
  loadArtists({ reset: true });
});

/* только один открытый <details> за раз */
[ddSort, ddGenre].forEach(dd => {
  dd.addEventListener('toggle', () => {
    if (dd.open) (dd === ddSort ? ddGenre : ddSort).removeAttribute('open');
  });
});

/* закрывать панель вне клика (tablet/mobile) */
document.addEventListener('click', e => {
  if (window.matchMedia('(min-width: 1440px)').matches) return;
  if (filtersPanel.contains(e.target) || filtersTrigger.contains(e.target)) return;
  if (filtersPanel.dataset.open === 'true') togglePanel(false);
});

/* ---------- init ---------- */
(async function init(){
  // привести иконки к начальному состоянию
  setTriggerIcon(false);
  setDetailsIcon(ddSort);
  setDetailsIcon(ddGenre);

  await loadGenres();
  await loadArtists({ reset: true });
})();
