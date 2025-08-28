import { fetchArtists } from "./api";

function createListArtists (images){
      const markup = images.map(({ strArtistThumb, genres, strArtist, strBiographyEN }) => `
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
`).join('');

document.getElementById('gallery').innerHTML = markup;
}

fetchArtists().then(artists => {
  createListArtists(artists);
});