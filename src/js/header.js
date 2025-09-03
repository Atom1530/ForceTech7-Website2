const refs = {
  openBtn: document.querySelector('[data-menu-open]'),
  closeBtn: document.querySelector('[data-menu-close]'),
  menu: document.querySelector('[data-menu]'),
  links: document.querySelectorAll('[data-menu-link]'),
  logos: document.querySelectorAll('.header-logo'),
  header: document.querySelector('.header'),
};

function openMenu() {
  if (!refs.menu) return;
  refs.menu.hidden = false;
  refs.menu.classList.add('show');
  document.body.style.overflow = 'hidden';
  refs.openBtn?.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  if (!refs.menu) return;
  refs.menu.classList.remove('show');
  setTimeout(() => {
    refs.menu.hidden = true;
  }, 400);
  document.body.style.overflow = '';
  refs.openBtn?.setAttribute('aria-expanded', 'false');
}

function smoothScroll(targetHref) {
  const raw = (targetHref || '').replace('#', '');
  const el =
    document.getElementById(raw) ||
    document.getElementById(`${raw}-section`);
  if (!el) return;

  const offset = (refs.header?.offsetHeight || 80) + 8; // буфер ниже хедера
  const y = el.getBoundingClientRect().top + window.pageYOffset - offset;

  window.scrollTo({ top: y, behavior: 'smooth' });
}


refs.openBtn?.addEventListener('click', openMenu);
refs.closeBtn?.addEventListener('click', closeMenu);

refs.links.forEach(link =>
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    closeMenu();
    smoothScroll(targetId);
  })
);

refs.logos.forEach(logo => {
  logo.addEventListener('click', e => {
    if (logo.closest('.mobile-menu')) {
      e.preventDefault();
      closeMenu();
      setTimeout(() => {
        window.location.href = logo.getAttribute('href');
      }, 400);
    }
  });
});

refs.menu?.addEventListener('click', e => {
  if (e.target === refs.menu) {
    closeMenu();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && refs.menu?.classList.contains('show')) {
    closeMenu();
  }
});

const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.header-nav-link, .mobile-menu-nav-link');

// карта: ЭЛЕМЕНТ СЕКЦИИ -> массив ссылок, которые на него указывают (с поддержкой alias: #id и #id-section)
const linkTargets = new Map();
navLinks.forEach(a => {
  const href = (a.getAttribute('href') || '').trim();
  if (!href.startsWith('#')) return;
  const rawId = href.slice(1);
  const el = document.getElementById(rawId) || document.getElementById(`${rawId}-section`);
  if (!el) return;
  if (!linkTargets.has(el)) linkTargets.set(el, []);
  linkTargets.get(el).push(a);
});

// единый setter: строго одна активная
let currentEl = null;
function setActiveByEl(el) {
  if (!el || currentEl === el) return;
  navLinks.forEach(a => a.classList.remove('active'));
  (linkTargets.get(el) || []).forEach(a => a.classList.add('active'));
  currentEl = el;
}

// блокировка обновлений от IO после клика (на время smooth-scroll)
let lockUntil = 0;
const LOCK_MS = 700;
const isLocked = () => Date.now() < lockUntil;

// IO с учётом фикс-хедера
const headerOffset = (refs.header?.offsetHeight || 80) + 8;
const visibleRatio = new Map(); // el -> ratio

const io = new IntersectionObserver(
  entries => {
    entries.forEach(en => {
      visibleRatio.set(en.target, en.isIntersecting ? en.intersectionRatio : 0);
    });
    if (isLocked()) return; // во время якорного скролла не трогаем подсветку
    const best = [...visibleRatio.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) setActiveByEl(best[0]);
  },
  {
    root: null,
    rootMargin: `-${headerOffset}px 0px -55% 0px`,
    threshold: [0, 0.25, 0.5, 0.75, 1],
  }
);

// наблюдаем только секции, на которые есть ссылки
linkTargets.forEach((_, el) => io.observe(el));

// первичная активация при загрузке
window.addEventListener('load', () => {
  window.dispatchEvent(new Event('scroll'));
});

// клик по ссылке: мгновенная подсветка + блокировка IO
navLinks.forEach(a => {
  a.addEventListener('click', () => {
    const href = (a.getAttribute('href') || '').trim();
    if (!href.startsWith('#')) return;
    const raw = href.slice(1);
    const el = document.getElementById(raw) || document.getElementById(`${raw}-section`);
    if (!el) return;
    setActiveByEl(el);
    lockUntil = Date.now() + LOCK_MS;
  });
});


function onScroll() {
  const scrollPos = window.scrollY + refs.header.offsetHeight + 10;

  sections.forEach(sec => {
    if (
      scrollPos >= sec.offsetTop &&
      scrollPos < sec.offsetTop + sec.offsetHeight
    ) {
      const id = sec.getAttribute('id');
      navLinks.forEach(link => {
        link.classList.toggle(
          'active',
          link.getAttribute('href') === `#${id}`
        );
      });
    }
  });
}

window.addEventListener('scroll', onScroll);