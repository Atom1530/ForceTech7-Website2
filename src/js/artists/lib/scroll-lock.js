// Реф-счётчик + «аварийная» разблокировка
let depth = 0;
let savedY = 0;

export function lockScroll() {
  if (depth++ === 0) {
    savedY = window.scrollY || document.documentElement.scrollTop || 0;
    const s = document.body.style;
    s.position = "fixed";
    s.top = `-${savedY}px`;
    s.left = "0";
    s.right = "0";
    s.width = "100%";
    document.body.classList.add("scroll-locked");
  }
}

export function unlockScroll(force = false) {
  if (force) depth = 1;                // принудительно «свести» к нулю
  if (depth > 0 && --depth === 0) {
    const s = document.body.style;
    s.position = s.top = s.left = s.right = s.width = "";
    window.scrollTo(0, savedY);
    document.body.classList.remove("scroll-locked");
  }
}

// на всякий случай — доступно из консоли: window.__unlockScroll()
export function emergencyUnlock() { unlockScroll(true); }
if (typeof window !== "undefined") {
  window.__unlockScroll = emergencyUnlock;
  // если страница перегружается в зафиксированном состоянии — снимем блокировку
  window.addEventListener("pageshow", () => emergencyUnlock());
}
