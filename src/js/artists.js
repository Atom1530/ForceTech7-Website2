import { fetchArtists } from "./api";
function deactivateBtn() {
  button.classList.add('lm-non-ative')
}
function activeBtn() {
  button.classList.remove('lm-non-ative')
}
function hideBtn() {
  button.classList.add('hiden')
}
function showBtn() {
  button.classList.remove('hiden')
}
function hideLoader() {
  loader.classList.add('hiden')
}
function showLoader() {
  loader.classList.remove('hiden')
}

const button = document.querySelector('.load-more')
const loader = document.querySelector('.loader')
const gallery = document.querySelector('.gallery')
let artistId = 0

// =====================================================================================================
// повертає id при кліку
export function getArtistIdFromClick(e) {
  const btn = e.target.closest('.card__link');
  if (!btn) return null;

  const artistCard = btn.closest('.card__body');
  return artistCard.dataset.id;
}
// =====================================================================================================

gallery.addEventListener('click', (e) => {
  const artistId = getArtistIdFromClick(e)

  // MUST WILL BE IMPORT FUNCTION name="openModal"
  openModal(artistId)

});


function createListArtists(images) {
  const markup = images.map(({ id, strArtistThumb, genres, strArtist, strBiographyEN }) => `
  <div class="card">
      <div class="card__media">
    <img src="${strArtistThumb}" alt="${strArtist}" />
  </div>
  <div class="card__body" data-id="${id}">
    <div class="tags">
      ${genres.map(genre => `<span class="tag">${genre}</span>`).join('')}
    </div>
    <h3 class="card__title">${strArtist}</h3>
    <p class="card__text">${strBiographyEN}</p>
    <div class="card__footer">
      <button class="card__link">Learn More <svg class="icon-learn-more">
            <use href="/img/sprite.svg#icon-icon_play_artists_sections"></use>
        </svg></button>
    </div>
  </div>
  </div>
`).join('');
  const gallery = document.querySelector('.gallery')
  gallery.insertAdjacentHTML('beforeend', markup)
}


fetchArtists().then(({ artists, totalArtists, }) => {
  hideLoader()
  createListArtists(artists);
  showBtn()
});

function loadMore(images) {

  const noDescAvailable = 'No description available'
  const markup = images.map(({ id, strArtistThumb, genres, strArtist, strBiographyEN }) => {
    let description = strBiographyEN
    if (!description) {
      description = noDescAvailable
    }
    return `<div class="card">
      <div class="card__media">
    <img src="${strArtistThumb}" alt="${strArtist}" />
  </div>
  <div class="card__body" data-id="${id}">
    <div class="tags">
      ${genres.map(genre => `<span class="tag">${genre}</span>`).join('')}
    </div>
    <h3 class="card__title">${strArtist}</h3>
    <p class="card__text">${description}</p>
    <div class="card__footer">
<button class="card__link">Learn More <svg class="icon-learn-more">
            <use href="/img/sprite.svg#icon-icon_play_artists_sections"></use>
        </svg></button>
    </div>
  </div>
  </div>
`}).join('');

  const gallery = document.querySelector('.gallery')
  gallery.insertAdjacentHTML('beforeend', markup)
}

let loadedArtists = 8; // скільки вже завантажено

button.addEventListener('click', () => {
  hideBtn()
  showLoader()
  fetchArtists().then(({ artists, totalArtists }) => {
    loadMore(artists)
    hideLoader()
    loadedArtists += artists.length
    if (loadedArtists >= totalArtists) {
      deactivateBtn()
      button.disabled = true;
      return
    }
    showBtn()
  })

})

