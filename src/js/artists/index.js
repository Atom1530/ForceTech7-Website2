
import { initGrid } from "./features/grid.js";
import { createMiniPlayer } from "./features/player.js";
import { UISound } from "./lib/sound.js";

// --- анти-двойной запуск (если где-то ещё импортят этот же файл) ---
if (window.__artists_boot) {
 
} else {
  window.__artists_boot = true;

  // 1) Грид/модалка
  initGrid();

  // 2) Мини-плеер (singleton)
  const player = createMiniPlayer();

  // 3) Радио-очередь
  //    
  const FALLBACK_IDS = [
    "dQw4w9WgXcQ",
    "kXYiU_JCYtU",
    "3JZ_D3ELwOQ",
    "e-ORhEE9VVg",
    "hTWKbfoikeg",
  ];

  // --- утилита: получить массив id из data-атрибутов или взять запасной ---
  function getRadioIds(btnEl) {
    // Вариант 1: <button id="random-radio" data-yt="id1,id2,id3">
    const raw = btnEl?.getAttribute?.("data-yt");
    if (raw && raw.trim()) {
      return raw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Вариант 2: <script type="application/json" id="radio-data">["id1","id2"]</script>
    const jsonEl =
      document.querySelector("#radio-data") ||
      document.querySelector('[data-radio-json="true"]');
    if (jsonEl) {
      try {
        const arr = JSON.parse(jsonEl.textContent || "[]");
        if (Array.isArray(arr) && arr.length) return arr;
      } catch {}
    }

    // Фолбэк: фиксированный набор
    return FALLBACK_IDS;
  }

  // --- навешиваем обработчики на разные возможные селекторы кнопок ---
  const radioBtn =
    document.querySelector("#random-radio") ||
    document.querySelector("#rhythm-radio") ||
    document.querySelector('[data-action="radio"]') ||
    document.querySelector("#radio-shuffle");

  const nextBtn =
    document.querySelector("#radio-next") ||
    document.querySelector(".radio-next") ||
    document.querySelector('[data-action="radio-next"]');

  const prevBtn =
    document.querySelector("#radio-prev") ||
    document.querySelector(".radio-prev") ||
    document.querySelector('[data-action="radio-prev"]');

  const stopBtn =
    document.querySelector("#radio-stop") ||
    document.querySelector("#radio-reset") ||
    document.querySelector('[data-action="radio-stop"]');

  // Запуск радио (очередь + перемешка + зацикливание)
  function startRadio(btnEl) {
    UISound?.tap?.();
    const ids = getRadioIds(btnEl);
    if (!ids || !ids.length) return;
    // Важно: именно openQueue, а не open — чтобы Next/Prev работали по очереди.
    player.openQueue(ids, { shuffle: true, loop: true, startIndex: 0 });
  }

  radioBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    startRadio(radioBtn);
  });

  // Внешние кнопки управления 
  nextBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    UISound?.tap?.();
    player.next();
  });

  prevBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    UISound?.tap?.();
    player.prev();
  });

  stopBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    UISound?.tap?.();
    player.close();
  });

 
  window.__artistMiniPlayer = player;
}
