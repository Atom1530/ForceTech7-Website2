import { fetchArtists } from "./api";

const button = document.querySelector('.load-more')

function createListArtists(images) {
  const markup = images.map(({ strArtistThumb, genres, strArtist, strBiographyEN }) => `
  <div class="card">
      <div class="card__media">
    <img src="${strArtistThumb}" alt="${strArtist}" />
  </div>
  <div class="card__body">
    <div class="tags">
      ${genres.map(genre => `<span class="tag">${genre}</span>`).join('')}
    </div>
    <h3 class="card__title">${strArtist}</h3>
    <p class="card__text">${strBiographyEN}</p>
    <div class="card__footer">
      <a class="card__link" href="#">Learn More →</a>
    </div>
  </div>
  </div>
`).join('');
  const gallery = document.querySelector('.gallery')
  gallery.insertAdjacentHTML('beforeend', markup)
}


fetchArtists().then(({ artists, totalArtists }) => {
  createListArtists(artists);
});

function loadMore(images) {


  const markup = images.map(({ strArtistThumb, genres, strArtist, strBiographyEN }) => `
  <div class="card">
      <div class="card__media">
    <img src="${strArtistThumb}" alt="${strArtist}" />
  </div>
  <div class="card__body">
    <div class="tags">
      ${genres.map(genre => `<span class="tag">${genre}</span>`).join('')}
    </div>
    <h3 class="card__title">${strArtist}</h3>
    <p class="card__text">${strBiographyEN}</p>
    <div class="card__footer">
      <a class="card__link" href="#">Learn More →</a>
    </div>
  </div>
  </div>
`).join('');

  const gallery = document.querySelector('.gallery')
  gallery.insertAdjacentHTML('beforeend', markup)
}

let loadedArtists = 8; // скільки вже завантажено

button.addEventListener('click', () => {
  fetchArtists().then(({ artists, totalArtists }) => {
    loadedArtists += artists.length
    loadMore(artists)
    if (loadedArtists >= totalArtists) {
      button.style.display = 'none';
    }
  })

})