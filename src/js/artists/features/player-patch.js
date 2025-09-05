// src/js/artists/features/player-patch.js
// Фиксы: ни одного passive-listener там, где вызывается preventDefault,
// + корректное перетаскивание пузыря без "залипания".

export default function mountPlayerPatch(player) {
  // Базовые элементы
  const dock = document.querySelector(".am-player");
  if (!dock) return;

  const bubble = document.querySelector(".am-player__bubble");
  const dragzone = document.querySelector(".am-player__dragzone");

  // Разрешаем кастомные жесты без прокрутки страницы
  [bubble, dragzone].forEach((el) => {
    if (el) el.style.touchAction = "none";
  });

  // Используем не-passive слушатели там, где можем вызвать preventDefault
  const NP = { passive: false };

  // Универсальная точка старта перетаскивания: либо сам bubble, либо dragzone
  const handle = bubble || dragzone;
  if (!handle) return;

  let dragging = false;
  let startX = 0, startY = 0;
  let baseLeft = 0, baseTop = 0;

  // вспомогательно: координаты из pointer/touch/mouse события
  const point = (ev) => {
    if (ev.touches && ev.touches[0]) {
      return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    }
    if (ev.changedTouches && ev.changedTouches[0]) {
      return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    }
    return { x: ev.clientX, y: ev.clientY };
  };

  const onDown = (ev) => {
    const p = point(ev);
    startX = p.x;
    startY = p.y;

    // Будем таскать именно пузырь, а не весь док
    const target = bubble || dock;
    const rect = target.getBoundingClientRect();
    baseLeft = rect.left;
    baseTop  = rect.top;

    dragging = true;

    // предотвращаем прокрутку страницы во время drag
    if (ev.cancelable) ev.preventDefault();

    window.addEventListener("touchmove", onMove, NP);
    window.addEventListener("mousemove", onMove, NP);
    window.addEventListener("touchend", onUp, NP);
    window.addEventListener("mouseup", onUp, NP);
  };

  const onMove = (ev) => {
    if (!dragging) return;

    const p = point(ev);
    const dx = p.x - startX;
    const dy = p.y - startY;

    const target = bubble || dock;
    const w = target.offsetWidth || 0;
    const h = target.offsetHeight || 0;

    // позиционируем как fixed-элемент (центрируем по точке)
    target.style.position = "fixed";
    target.style.left = `${Math.round(baseLeft + dx)}px`;
    target.style.top  = `${Math.round(baseTop  + dy)}px`;
    target.style.right = "auto";
    target.style.bottom = "auto";

    if (ev.cancelable) ev.preventDefault();
  };

  const onUp = (ev) => {
    dragging = false;
    window.removeEventListener("touchmove", onMove, NP);
    window.removeEventListener("mousemove", onMove, NP);
    window.removeEventListener("touchend", onUp, NP);
    window.removeEventListener("mouseup", onUp, NP);
    if (ev.cancelable) ev.preventDefault();
  };

  // Ставим слушатели с НЕ-passive опцией
  handle.addEventListener("touchstart", onDown, NP);
  handle.addEventListener("mousedown", onDown, NP);

  // Дополнительно: если плеер свёрнут, клики/скролл должны проходить "сквозь"
  // сам док, но оставаться на пузыре.
  dock.classList.add("am-player--patch-applied");
}
