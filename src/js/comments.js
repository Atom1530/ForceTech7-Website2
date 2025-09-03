import 'css-star-rating/css/star-rating.css';
import Swiper from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';


const overlay = document.querySelector('.overlay');
const openBtn = document.querySelector('.feedback-btn');
const closeBtn = document.querySelector('.close-btn, .close-icon'); 
const form = document.querySelector('#feedback-form');
const container = document.querySelector('.feedback-section');
const inputName = document.querySelector('.form-input-name');
const inputMessage = document.querySelector('.form-input-message');
const formRating = document.getElementById('customer-rating');

const STORAGE_KEY = 'myFeedback';

// чтобы не было submit-поведения
openBtn?.setAttribute('type', 'button');

// --- scroll lock (без прыжка)
const scrollLock = {
  y: 0,
  lock() {
    this.y = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  },
  unlock() {
    const y = this.y || 0;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, y);
    this.y = 0;
  }
};

// --- ERROR UI (красная рамка при пустом поле)
const ERROR_CLASS = 'is-error';
const TOUCHED_CLASS = 'touched';

function markError(el) {
  if (!el) return;
  const empty = !el.value.trim();
  el.classList.add(TOUCHED_CLASS);
  el.classList.toggle(ERROR_CLASS, empty);
}
[inputName, inputMessage].forEach(el => {
  if (!el) return;
  el.addEventListener('blur', () => markError(el));
  el.addEventListener('input', () => markError(el));
});

// --- MODAL
openBtn?.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  container.classList.add('hidden');
  scrollLock.lock(); // вместо document.body.classList.add('no-scroll')
  dataFromLocalStorage();
});

(document.querySelector('.close-btn') || document.querySelector('.close-icon'))?.addEventListener('click', () => {
  overlay.classList.add('hidden');
  container.classList.remove('hidden');
  scrollLock.unlock(); // вместо remove('no-scroll')
  createStars(document.getElementById('customer-rating'), parseInt(formRating.dataset.rating) || 0); // <-- фикс
});

overlay?.addEventListener('click', e => {
  if (e.target === overlay) {
    overlay.classList.add('hidden');
    container.classList.remove('hidden');
    scrollLock.unlock();
    createStars(document.getElementById('customer-rating'), parseInt(formRating.dataset.rating) || 0); // <-- фикс
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    overlay.classList.add('hidden');
    container.classList.remove('hidden');
    scrollLock.unlock();
    createStars(document.getElementById('customer-rating'), parseInt(formRating.dataset.rating) || 0); // <-- фикс
  }
});

// --- STARS
function createStars(container, rating = 0) {
  if (!container) return;
  container.innerHTML = '';
  const r = parseInt(rating) || 0;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    if (i <= r) star.classList.add('filled');
    container.appendChild(star);

    if (container.id === 'customer-rating') {
      star.addEventListener('click', () => {
        container.dataset.rating = i;
        createStars(container, i);
        saveToLocalStorage();
      });
      star.addEventListener('mouseenter', () => hoveredStar(container, i));
      star.addEventListener('mouseleave', () => {
        const savedRating = parseInt(formRating.dataset.rating) || 0;
        createStars(container, savedRating);
      });
    }
  }
}

function hoveredStar(container, upTo) {
  const stars = container.querySelectorAll('.star');
  stars.forEach((star, index) => {
    if (index < upTo) star.classList.add('filled');
    else star.classList.remove('filled');
  });
}

// init stars
createStars(formRating, parseInt(formRating.dataset.rating) || 0);

// --- SWIPER
const swiper = new Swiper('.swiper', {
  slidesPerView: 1,
  spaceBetween: 20,
  loop: false,
  grabCursor: true,
  navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
  pagination: { el: '.swiper-pagination', clickable: true }
});

document.querySelector('.swiper-button-prev')?.addEventListener('click', () => swiper.slidePrev());
document.querySelector('.swiper-button-next')?.addEventListener('click', () => swiper.slideNext());

// dots
const dots = document.querySelector('.swiper-pagination');
if (dots) {
  dots.innerHTML = `
    <span class="swiper-dots"></span>
    <span class="swiper-dots"></span>
    <span class="swiper-dots"></span>
  `;
}
function activateDot(dotNumber) {
  const all = document.querySelectorAll('.swiper-dots');
  all.forEach(dot => dot.classList.remove('active'));
  if (all[dotNumber - 1]) all[dotNumber - 1].classList.add('active');
}
function getDotIndex(index) {
  if (index === 0) return 1;
  if (index === 9) return 3;
  return 2;
}
activateDot(getDotIndex(swiper.realIndex));
document.querySelectorAll('.swiper-dots').forEach((dot, index) => {
  dot.addEventListener('click', () => {
    const map = [0, 1, 9];
    swiper.slideTo(map[index] ?? 0);
  });
});
swiper.on('slideChange', () => {
  const currentIndex = swiper.realIndex;
  activateDot(getDotIndex(currentIndex));
});

// --- REVIEWS
function normalizeFeedbackList(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.feedbacks)) return json.feedbacks;
  if (json && Array.isArray(json.results)) return json.results;
  return [];
}

async function loadReviews() {
  const wrapper = document.querySelector('.swiper-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';

  try {
    const res = await fetch('https://sound-wave.b.goit.study/api/feedbacks');
    const json = await res.json();
    const feedbacks = normalizeFeedbackList(json).slice(0, 10);

    feedbacks.forEach((feedback, index) => {
      const stars = Math.round(Number(feedback?.rating) || 0);
      const slide = document.createElement('div');
      slide.classList.add('swiper-slide');
      slide.innerHTML = `
        <div class="rating" id="rating-${index}" data-rating="${stars}"></div>
        <div class="feedback">
          <p class="customer-feedback">${String(feedback?.descr ?? '')}</p>
          <h3 class="customer-name">${String(feedback?.name ?? '')}</h3>
        </div>`;
      wrapper.appendChild(slide);
      createStars(slide.querySelector('.rating'), stars);
    });
    swiper.update();
  } catch (err) {
    iziToast.error({ title: 'Error', message: 'Bad request (invalid request params)' });
  }
}

// --- LOCAL STORAGE
function saveToLocalStorage() {
  const params = {
    name: inputName.value.trim(),
    message: inputMessage.value.trim(),
    rating: parseInt(formRating.dataset.rating) || 0
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
}

function dataFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved?.name) inputName.value = saved.name;
    if (saved?.message) inputMessage.value = saved.message;
    if (typeof saved?.rating !== 'undefined') {
      formRating.dataset.rating = saved.rating;
      createStars(formRating, parseInt(saved.rating) || 0);
    }
    // актуализируем подсветку ошибок после автозаполнения
    [inputName, inputMessage].forEach(el => markError(el));
  } catch {}
}

function resetLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  form.reset();
  formRating.dataset.rating = 0;
  createStars(formRating, 0);
  [inputName, inputMessage].forEach(el => el.classList.remove(ERROR_CLASS, TOUCHED_CLASS));
}

// --- SUBMIT
form?.addEventListener('submit', async e => {
  e.preventDefault();

  const name = inputName.value.trim();
  const message = inputMessage.value.trim();
  const rating = parseInt(formRating.dataset.rating) || 0;

  // подсветка пустых
  const empties = [];
  if (!name) { markError(inputName); empties.push(inputName); }
  if (!message) { markError(inputMessage); empties.push(inputMessage); }
  if (empties.length) {
    empties[0].focus();
    return iziToast.error({ message: 'Please fill out required fields.' });
  }

  if (name.length < 2 || name.length > 16) {
    markError(inputName);
    return iziToast.error({ message: 'Shortest name - 2 letters; Largest name - 16 letters' });
  }
  if (message.length < 10 || message.length > 512) {
    markError(inputMessage);
    return iziToast.error({ message: 'Min message - 10 symbols; Max message - 512 symbols' });
  }
  if (rating < 1 || rating > 5) {
    return iziToast.error({ message: "Rating must be between '1' and '5'" });
  }

  try {
    const response = await fetch('https://sound-wave.b.goit.study/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, descr: message, rating })
    });

    if (!response.ok) {
      return iziToast.error({ title: 'Error:', message: `HTTP ${response.status}` },);
    }

    iziToast.success({ message: "Comment posted, Thank you!" ,position: 'center'});
    resetLocalStorage();
    overlay.classList.add('hidden');
    container.classList.remove('hidden');
    scrollLock.unlock(); // вместо remove('no-scroll')
    loadReviews();
  } catch (err) {
    iziToast.error({ message: 'Bad request (invalid request body)' });
  }
});

document.addEventListener('DOMContentLoaded', loadReviews);
