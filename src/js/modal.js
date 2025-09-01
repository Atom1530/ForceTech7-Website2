
import { fetchIndAboutArtist } from './api.js';

const modalOverlay = document.querySelector('.modal-overlay-artists');
const modalBody = document.querySelector('.modal-body'); // контейнер внутри оверлея

function showLoader() {
  modalBody.innerHTML = '<div class="loader">Loading...</div>';
}

function hideLoader() {
  const loader = modalBody.querySelector('.loader');
  if (loader) loader.remove();
}

function formatDuration(ms) {
  if (!ms) return '—';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

export async function openModal(artistData) {
  if (!artistData) return;

  const { id, strArtist, strArtistThumb, strBiographyEN, genres = [] } = artistData;

  modalOverlay.classList.add('is-open');
  document.body.classList.add('no-scroll');

  showLoader();

  try {
    const { albums } = await fetchIndAboutArtist(id);

    let albumsMarkup = '';
    if (albums.length) {
      albumsMarkup = albums.map(album => {
        const tracksMarkup = album.tracks?.map(track => `
          <li class="track">
            <span>${track.strTrack || 'No name'}</span>
            <span>${formatDuration(track.intDuration)}</span>
            <span>${track.movie ? `<a href="${track.movie}" target="_blank">YouTube</a>` : ''}</span>
          </li>
        `).join('') || '';
        return `
          <div class="album">
            <h4>${album.strAlbum || 'Unknown Album'}</h4>
            <ul class="tracks">
              <li class="track header"><span>Track</span><span>Time</span><span>Link</span></li>
              ${tracksMarkup}
            </ul>
          </div>
        `;
      }).join('');
    } else {
      albumsMarkup = '<p>No albums found for this artist.</p>';
    }

    modalBody.innerHTML = `
      <button class="close-btn">×</button>
      <div class="modal-content">
        <div class="artist-header">
          <img src="${strArtistThumb}" alt="${strArtist}" class="artist-photo"/>
          <h2 class="artist-name">${strArtist}</h2>
          ${genres.length ? `<div class="artist-genres">${genres.map(g=>`<span class="genre">${g}</span>`).join('')}</div>` : ''}
        </div>
        <div class="artist-bio">
          <h3>Biography</h3>
          <p>${strBiographyEN || 'No biography available.'}</p>
        </div>
        <h3>Albums</h3>
        <div class="artist-albums">
          ${albumsMarkup}
        </div>
      </div>
    `;

    modalBody.querySelector('.close-btn').addEventListener('click', closeModal);

  } catch (err) {
    modalBody.innerHTML = '<p>Error loading artist info.</p>';
  } finally {
    hideLoader();
  }
}

export function closeModal() {
  modalOverlay.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  modalBody.innerHTML = '';
}

// Закрытие кликом на оверлей
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Закрытие по ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) closeModal();
});


window.openModal = openModal;
window.closeModal = closeModal;