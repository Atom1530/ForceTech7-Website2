// ===== Imports =====
import Swiper from 'swiper/bundle';
import 'swiper/swiper-bundle.css';
import iziToast from 'izitoast';
import 'izitoast/dist/css/iziToast.min.css';

// ===== Constants / State =====
const STORAGE_KEY = 'myFeedback';
let scrollY = 0;
let swiper = null;

// ===== DOM refs (назначим после DOMContentLoaded) =====
let overlay, openBtn, closeBtn, form, container, inputName, inputMessage, formRating;

// ===== Utils =====
function debounce(fn, delay = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ===== Stars =====
function createStars(container, rating) {
  if (!container) return;
  container.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.classList.add('star');
    if (i <= rating) star.classList.add('filled');
    container.appendChild(star);

    // Интерактив — только у рейтинга формы
    if (container.id === 'customer-rating') {
      star.addEventListener('click', () => {
        container.dataset.rating = String(i);
        createStars(container, i);
        saveToLocalStorage(); // сразу запишем рейтинг
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

// ===== LocalStorage (draft) =====
function saveToLocalStorage() {
  const name = inputName?.value?.trim() || '';
  const message = inputMessage?.value?.trim() || '';
  const rating = Number(formRating?.dataset?.rating || 0);

  // Всё пусто? Удаляем ключ.
  if (!name && !message && rating === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const draft = { name, message, rating };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

const saveDraftDebounced = debounce(saveToLocalStorage, 400);

function dataFromLocalStorage() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    saved = null;
  }

  if (!saved) {
    // На всякий случай визуально сбросим рейтинг
    if (formRating) {
      formRating.dataset.rating = '0';
      createStars(formRating, 0);
    }
    return;
  }

  if (inputName) inputName.value = saved.name || '';
  if (inputMessage) inputMessage.value = saved.message || '';
  if (formRating) {
    formRating.dataset.rating = String(saved.rating ?? 0);
    createStars(formRating, saved.rating ?? 0);
  }
}

function resetLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
  form?.reset();
  if (formRating) {
    formRating.dataset.rating = '0';
    createStars(formRating, 0);
  }
}

// ===== Modal =====
function openModal(e) {
  e?.preventDefault?.();
  scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';

  overlay.classList.remove('hidden');
  container.classList.add('hidden');

  dataFromLocalStorage(); // подхватим драфт при каждом открытии
}

function closeModal() {
  overlay.classList.add('hidden');
  container.classList.remove('hidden');

  document.body.style.position = '';
  window.scrollTo(0, scrollY);

  // Синхронно сбросим рейтинг визуально
  if (formRating) {
    formRating.dataset.rating = '0';
    createStars(formRating, 0);
  }

  // Сохраним/удалим актуальный драфт после закрытия
  saveToLocalStorage();
}

// ===== Swiper =====
function initSwiper() {
  // если уже был — уничтожим
  if (swiper) {
    swiper.destroy(true, true);
    swiper = null;
  }

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

    // 3 точки: первый / середина / последний
    pagination: {
      el: '.swiper-pagination',
      type: 'custom',
      clickable: true,
      renderCustom: (sw, _current, total) => {
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

  // клики по кастомным точкам
  const pag = document.querySelector('.swiper-pagination');
  if (pag) {
    pag.onclick = (e) => {
      const dot = e.target.closest('.swiper-dots');
      if (!dot) return;
      swiper.slideTo(Number(dot.dataset.i));
    };
  }

  // при смене слайда — перерисовать кастомные точки
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
        </div>
      `;

      wrapper.appendChild(slide);
      createStars(slide.querySelector('.rating'), stars); // звёзды в слайдах статичны
    });

    // инициализируем Swiper только после вставки слайдов
    initSwiper();
  } catch (err) {
    iziToast.error({
      title: 'Error',
      message: 'Bad request (invalid request params)',
    });
  }
}

// ===== Submit =====
function attachSubmitHandler() {
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = inputName.value.trim();
    const message = inputMessage.value.trim();
    const rating = Math.round(formRating.dataset.rating) || 0;

    if (!name || name.length < 2 || name.length > 16) {
      iziToast.error({ message: 'Shortest name - 2 letters; Largest name - 16 letters' });
      return;
    }
    if (!message || message.length < 10 || message.length > 512) {
      iziToast.error({ message: 'Min message - 10 symbols; Max message - 512 symbols' });
      return;
    }
    if (rating < 1 || rating > 5) {
      iziToast.error({ message: "Rating must be between '1' and '5'" });
      return;
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

      iziToast.success({ message: "Success! You're comment posted" });
      resetLocalStorage();
      closeModal();
      document.body.classList.remove('no-scroll');

      loadReviews();
    } catch (err) {
      iziToast.error({ message: 'Bad request (invalid request body)' });
    }
  });
}

// ===== Init =====
function initApp() {
  // Присваиваем DOM-элементы
  overlay = document.querySelector('.overlay');
  openBtn = document.querySelector('.feedback-btn');
  closeBtn = document.querySelector('.close-icon');
  form = document.querySelector('#feedback-form');
  container = document.querySelector('.feedback-section');
  inputName = document.querySelector('.form-input-name');
  inputMessage = document.querySelector('.form-input-message');
  formRating = document.getElementById('customer-rating');

  // Безопасные проверки
  if (!overlay || !container) {
    console.warn('Overlay or container not found');
  }

  // Звёзды в форме (интерактив)
  createStars(formRating, parseInt(formRating?.dataset?.rating) || 0);

  // Навешиваем обработчики модалки
  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
  });

  // Автосохранение драфта при наборе
  inputName?.addEventListener('input', saveDraftDebounced);
  inputMessage?.addEventListener('input', saveDraftDebounced);

  // Сабмит
  attachSubmitHandler();

  // Первичная загрузка отзывов
  loadReviews();
}

document.addEventListener('DOMContentLoaded', initApp);
