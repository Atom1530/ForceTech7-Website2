import { initGrid } from "./grid.js";
import { createArtistModal } from "./modal.js";
import { initRouter } from "./router.js";
import { initPrefetch } from "./prefetch.js";

export function initArtists(root = document.querySelector("#artists-section")) {
  if (!root) return;

  // URL-sync сначала (восстановит состояние до начальной загрузки)
  initRouter(root);

  // Модалка (возвращает open/close)
  const modal = createArtistModal(root);

  // Prefetch "Learn more" (ускоряет открытие модалки)
  initPrefetch(root);

  // Грид (передаём модалку для открытия)
  initGrid(root, { openModal: modal.open });
}
