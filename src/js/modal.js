const refs = {
  modalOverlayArtists: document.querySelector('.modal-overlay-artists'),
  closeModalBtn: document.querySelector('.close-btn'),
  body: document.querySelector('body'),
  loader: document.querySelector('.modal-loader'),
  artistsSection: document.querySelector('#artists-card-id'), 
};

function showLoader() {
  refs.loader.classList.add('is-visible');
}

function hideLoader() {
  refs.loader.classList.remove('is-visible');
}

window.history.scrollRestoration = 'manual';

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  console.log('Page loaded, scroll set to top');
});

function onModalOverlayClick(event) {
  if (event.target === refs.modalOverlayArtists) {
    console.log('Overlay clicked, closing modal');
    closeModal();
  }
}

function onDocumentKeydown(event) {
  if (
    refs.modalOverlayArtists.classList.contains('is-open') &&
    event.key === 'Escape'
  ) {
    console.log('Escape pressed, closing modal');
    closeModal();
  }
}

export function openModal() {
  console.log('Opening modal');
  refs.modalOverlayArtists.classList.add('is-open');

  const scrollY = window.scrollY || window.pageYOffset;
  refs.body.style.top = `-${scrollY}px`; 
  refs.body.classList.add('no-scroll');

  refs.closeModalBtn.addEventListener('click', closeModal);
  refs.modalOverlayArtists.addEventListener('click', onModalOverlayClick);
  document.addEventListener('keydown', onDocumentKeydown);
  showLoader();
}

export function closeModal() {
  console.log('Closing modal');
  refs.modalOverlayArtists.classList.remove('is-open');

  const scrollY = parseInt(refs.body.style.top || '0') * -1;
  refs.body.classList.remove('no-scroll');
  refs.body.style.top = '';
  window.scrollTo(0, scrollY);

  refs.closeModalBtn.removeEventListener('click', closeModal);
  refs.modalOverlayArtists.removeEventListener('click', onModalOverlayClick);
  document.removeEventListener('keydown', onDocumentKeydown);
  hideLoader();
}

if (refs.artistsSection) {
  refs.artistsSection.addEventListener('click', (event) => {
    const learnMoreButton = event.target.closest('.artist-card-link, .card__link');
    if (!learnMoreButton) return;

    if (learnMoreButton.tagName === 'A') event.preventDefault();

    console.log('Artist card clicked, opening modal');
    openModal();
  });
} else {
  console.warn('Виконавців з ID "artists-card-id" не знайдено.');
}
