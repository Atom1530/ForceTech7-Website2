// Предзагрузка данных артиста при hover на “Learn more” >150мс.

import { fetchArtist, fetchArtistAlbums } from "./api.js";

const cache = new Map(); // id -> { artist, albums, ts }

export function getPrefetched(id) {
  return cache.get(String(id));
}

export function initPrefetch(root) {
  const grid = root.querySelector("#artists-grid");
  if (!grid) return;

  let hoverTimer = null;
  let hoverId = null;

  function schedulePrefetch(id) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      try {
        if (cache.has(id)) return;
        const [artist, albums] = await Promise.all([
          fetchArtist(id),
          fetchArtistAlbums(id),
        ]);
        cache.set(id, { artist, albums, ts: Date.now() });
      } catch { /* тихо игнорим */ }
    }, 150);
  }

  grid.addEventListener("mouseenter", (e) => {
    const btn = e.target.closest('[data-action="more"]');
    if (!btn) return;
    const id = btn.closest(".card")?.dataset?.id;
    if (!id) return;
    hoverId = String(id);
    schedulePrefetch(hoverId);
  }, true);

  grid.addEventListener("mouseleave", (e) => {
    if (e.target.closest('[data-action="more"]')) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      hoverId = null;
    }
  }, true);
}
