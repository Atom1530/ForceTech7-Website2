// ===== Imports =====
import Swiper from 'swiper/bundle';
import 'swiper/swiper-bundle.css';

import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';

// ===== DOM =====
const overlay = document.querySelector('.overlay');
const openBtn = document.querySelector('.feedback-btn');
const closeBtn = document.querySelector('.close-icon');
const form = document.querySelector('#feedback-form');
const container = document.querySelector('.feedback-section');
const inputName = document.querySelector('.form-input-name');
const inputMessage = document.querySelector('.form-input-message');
const formRating = document.getElementById('customer-rating');

const STORAGE_KEY = 'myFeedback';

let scrollY = 0;
let swiper = null;

// ===== Modal =====
openBtn.addEventListener('click', (e) => {
  e.preventDefault();
  scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';

  overlay.classList.remove('hidden');
  container.classList.add('hidden');

  dataFromLocalStorage();
});

function closeModal() {
  overlay.classList.add('hidden');
  container.classList.remove('hidden');
  document.body.style.position = '';
  window.scrollTo(0, scrollY);
  createStars(document.getElementById('customer-rating'), 0);
}

closeBtn.addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== Stars =====
function createStars(container, rating) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    if (i <= rating) star.classList.add('filled');
    container.appendChild(star);

    if (container.id === 'customer-rating') {
      star.addEventListener('click', () => {
        container.dataset.rating = i;
        createStars(container, i);
        saveToLocalStorage();
      });
      star.addEventListener('mouseenter', () => {
        hoveredStar(container, i);
      });
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

// инициализируем звёзды в форме
createStars(formRating, parseInt(formRating?.dataset.rating) || 0);

// ===== Swiper =====
function initSwiper() {
  // если уже был — уничтожаем начисто
  if (swiper) swiper.destroy(true, true);

  swiper = new Swiper('.swiper', {
    slidesPerView: 1,
    spaceBetween: 0,
    loop: false,
    grabCursor: true,
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    centeredSlides: false,
    // Рисуем 3 точки: первый / середина / последний
    pagination: {
      el: '.swiper-pagination',
      type: 'custom',
      clickable: true,
      renderCustom: (sw, current, total) => {
        const first = 0;
        const last = total - 1;
        const middle = Math.floor(total / 2);
        const curr = sw.realIndex;

        const isActive = (i) =>
          (i === first && curr === first) ||
          (i === last && curr === last) ||
          (i === middle && curr !== first && curr !== last);

        const dot = (i) =>
          `<span class="swiper-dots ${isActive(i) ? 'active' : ''}" data-i="${i}"></span>`;

        return dot(first) + dot(middle) + dot(last);
      },
    },
  });

  // клики по кастомным 3 точкам
  const pag = document.querySelector('.swiper-pagination');
  pag.onclick = (e) => {
    const dot = e.target.closest('.swiper-dots');
    if (!dot) return;
    swiper.slideTo(Number(dot.dataset.i));
  };

  // при каждом слайде перерисовываем кастомные точки
  swiper.on('slideChange', () => swiper.pagination.render());
}

// ===== Fetch & render feedbacks =====
async function loadReviews() {
  const wrapper = document.querySelector('.swiper-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = '';

  try {
    const res = await fetch('https://sound-wave.b.goit.study/api/feedbacks');
    const json = await res.json();
    const feedbacks = (json?.data || []).slice(0, 10); // РОВНО 10

    feedbacks.forEach((fb, index) => {
      const stars = Math.round(fb.rating || 0);

      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
slide.innerHTML = `
  <div class="rating my-rating" id="rating-${index}" data-rating="${stars}"></div>
  <div class="feedback">
    <p class="customer-feedback">${fb.descr}</p>
    <h3 class="customer-name">${fb.name}</h3>
  </div>`;

      wrapper.appendChild(slide);
      createStars(slide.querySelector('.rating'), stars);
    });

    // Инициализируем Swiper только ПОСЛЕ того, как слайды в DOM
    initSwiper();
  } catch (err) {
    iziToast.error({
      title: 'Error',
      message: 'Bad request (invalid request params)',
    });
  }
}

// ===== LocalStorage =====
function saveToLocalStorage() {
  const params = {
    name: inputName.value.trim(),
    message: inputMessage.value.trim(),
    rating: Math.round(formRating.dataset.rating) || 0,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
}

function dataFromLocalStorage() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (!saved) return;

  if (saved.name) inputName.value = saved.name;
  if (saved.message) inputMessage.value = saved.message;
  if (saved.rating) formRating.dataset.rating = saved.rating;

  createStars(formRating, saved.rating || 0);
}

function resetLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  form.reset();
  formRating.dataset.rating = 0;
  createStars(formRating, 0);
}

// ===== Submit =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = inputName.value.trim();
  const message = inputMessage.value.trim();
  const rating = Math.round(formRating.dataset.rating) || 0;

  if (!name || name.length < 2 || name.length > 16) {
    return iziToast.error({ message: 'Shortest name - 2 letters; Largest name - 16 letters' });
  }
  if (!message || message.length < 10 || message.length > 512) {
    return iziToast.error({ message: 'Min message - 10 symbols; Max message - 512 symbols' });
  }
  if (rating < 1 || rating > 5) {
    return iziToast.error({ message: "Rating must be between '1' and '5'" });
  }

  try {
    const response = await fetch('https://sound-wave.b.goit.study/api/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ name, descr: message, rating }),
    });

    if (!response.ok) {
      iziToast.error({ title: 'Error:', message: `${response.status}` });
      return;
    }

    resetLocalStorage();
    closeModal();
    document.body.classList.remove('no-scroll');

    // Перезагружаем отзывы и пересоздаём swiper (будет снова 10)
    loadReviews();
  } catch (err) {
    iziToast.error({ message: 'Bad request (invalid request body)' });
  }
});

// ===== Start =====
document.addEventListener('DOMContentLoaded', loadReviews);
