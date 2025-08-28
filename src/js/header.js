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

function smoothScroll(targetId) {
  const target = document.querySelector(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
const navLinks = document.querySelectorAll(
  '.header-nav-link, .mobile-menu-nav-link'
);

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
