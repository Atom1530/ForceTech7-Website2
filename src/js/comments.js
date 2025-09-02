import 'css-star-rating/css/star-rating.css';
import Swiper from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import iziToast from 'izitoast';
import "izitoast/dist/css/iziToast.min.css";



const overlay = document.querySelector(".overlay");
const openBtn = document.querySelector(".feedback-btn")
const closeBtn = document.querySelector(".close-icon");
const form = document.querySelector("#feedback-form");
const container = document.querySelector(".feedback-section");


// modal
openBtn.addEventListener("click", (e) => {
    overlay.classList.remove("hidden");
  container.classList.add("hidden");
  document.body.classList.add("no-scroll");
})

closeBtn.addEventListener("click", (e) => {
    overlay.classList.add("hidden");
  container.classList.remove("hidden");
  document.body.classList.remove("no-scroll");
  form.reset();
  createStars(document.getElementById("customer-rating", 0));
});

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    overlay.classList.add("hidden")
    container.classList.remove("hidden");
    document.body.classList.remove("no-scroll");
      form.reset();
  createStars(document.getElementById("customer-rating", 0));
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    overlay.classList.add("hidden")
    container.classList.remove("hidden")
    document.body.classList.remove("no-scroll");
      form.reset();
  createStars(document.getElementById("customer-rating", 0));
  }
})

// stars
function createStars(container, rating) {
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.classList.add("star");
    if (i <= rating) star.classList.add("filled");
    container.appendChild(star);
    if (container.id === "customer-rating") {
      star.addEventListener("click", (e) => {
        container.dataset.rating = i;
        createStars(container, i);
      })
    }
  }
}

// data from API
const formRating = document.getElementById("customer-rating");
createStars(formRating, parseInt(formRating.dataset.rating) || 0);

const swiper = new Swiper('.swiper', {
  slidesPerView: 1,
  spaceBetween: 20,
  loop: false,
        grabCursor: true,
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev', },
  pagination: { el: '.swiper-pagination', clickable: true, },
});
document.querySelector('.swiper-button-prev').addEventListener('click', () => {
  swiper.slidePrev();
})
document.querySelector('.swiper-button-next').addEventListener('click', () => {
  swiper.slideNext();
})

//dots
const dots = document.querySelector('.swiper-pagination');
dots.innerHTML = `
  <span class="swiper-dots"></span>
    <span class="swiper-dots"></span>
  <span class="swiper-dots"></span>`

function activateDot(dotNumber) {
  const dots = document.querySelectorAll(".swiper-dots");
  dots.forEach(dot => dot.classList.remove('active'));
  if (dots[dotNumber - 1]) {
    dots[dotNumber - 1].classList.add('active');
  }
}
  
function getDotIndex(index) {
  if (index === 0) {
    return 1;
  } else if (index === 9) {
    return 3;
  } else {
    return 2;
  }
}

activateDot(getDotIndex(swiper.realIndex));

const dotElements = document.querySelectorAll('.swiper-dots');
dotElements.forEach((dot, index) => {
  dot.addEventListener('click', (e) => {
    let slideIndex = 0;

    if (index === 0) {
      slideIndex = 0;
    } else if (index === 1) {
      slideIndex = 1;
    } else if (index === 2) {
      slideIndex = 9;
    }
    swiper.slideTo(slideIndex);
  })
})

swiper.on('slideChange', (e) => {
  const currentIndex = swiper.realIndex
  activateDot(getDotIndex(currentIndex))
});

async function loadReviews() {
  const wrapper = document.querySelector(".swiper-wrapper");
  try {
    const data = await fetch("https://sound-wave.b.goit.study/api/feedbacks");
    const json = await data.json();
    const feedbacks = json.data.slice(0, 10);
    feedbacks.forEach((feedback, index) => {
      const stars = Math.round(feedback.rating);

      const slide = document.createElement("div");
      slide.classList.add("swiper-slide")

      slide.innerHTML = `<div class="rating" id="rating-${index}" data-rating="${stars}"></div>
                <div class="feedback">
                    <p class="customer-feedback">${feedback.descr}</p>
                    <h3 class="customer-name">${feedback.name}</h3>
                </div>`;
      wrapper.appendChild(slide);
      const starContainer = slide.querySelector(".rating");
      createStars(starContainer, stars);
    });
swiper.update()
  } catch (err) {
    iziToast.error({
      title: 'Error',
      message: 'Bad request (invalid request params)'
    })
  }
}


// data to API
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = form.querySelector(".form-input-name").value.trim();
  const message = form.querySelector(".form-input-message").value.trim()
  const rating = Math.round(formRating.dataset.rating) || 0;
  console.log("Name:", name);
  console.log("Message:", message);
  console.log("Rating:", rating);

    if (!name || name.length < 2 || name.length > 16) {
      return iziToast.error({ message: 'Shortest name - 2 letters; Largest name - 16 letters' })
  };
  if (!message || message.length < 10 || message.length > 512) {
    return iziToast.error({ message: 'Min message - 10 symbols; Max message - 512 symbols' })
  }
  if (rating < 1 || rating > 5) {
    return iziToast.error({ message: "Rating must be between '1' and '5'" })
  }
  try {
    const response = await fetch("https://sound-wave.b.goit.study/api/feedbacks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        name: name,
        descr: message,
        rating: rating,
      })
      
    })
    
    if (!response.ok) {
      iziToast.error({
        title: 'Error:',
        message: '${response.status}'});
    } 

    form.reset();
    formRating.dataset.rating = 0;
    createStars(formRating, 0);
    overlay.classList.add("hidden");
    container.classList.remove("hidden");
    document.body.classList.remove("no-scroll");
    loadReviews();
  } catch (err) {

    iziToast.error({ message: 'Bad request (invalid request body)' })
  }
})
document.addEventListener("DOMContentLoaded", loadReviews);
