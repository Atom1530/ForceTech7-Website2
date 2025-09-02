// src/js/artists/features/state.js
// Единое хранилище состояния секции Artists + подписки.
// Совместимо с твоим прежним ArtistState (интерфейс сохранён),
// но добавлены getState/setState/subscribe и resetFilters.

const _state = {
  page: 1,
  limit: 8,
  total: 0,
  sort: "",
  genre: "",
  q: "",
  isMobilePanelOpen: false,
};

const listeners = new Set();
function snapshot() { return { ..._state }; }
function notify() {
  const s = snapshot();
  listeners.forEach(fn => { try { fn(s); } catch {} });
}

export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() { return snapshot(); }

/** Пакетное обновление: setState({ page, genre, ... })
 *  Если меняем genre/sort/q — страница сбрасывается на 1 (как раньше).
 */
export function setState(patch = {}) {
  const resetPage = ("genre" in patch) || ("sort" in patch) || ("q" in patch);
  const next = { ..._state, ...patch };
  if (resetPage && !("page" in patch)) next.page = 1;

  // клампы
  next.page  = Math.max(1, Number(next.page)  || 1);
  next.limit = Math.max(1, Number(next.limit) || 8);
  next.total = Math.max(0, Number(next.total) || 0);

  let changed = false;
  for (const k of Object.keys(next)) {
    if (_state[k] !== next[k]) { _state[k] = next[k]; changed = true; }
  }
  if (changed) notify();
  return snapshot();
}

export function resetFilters() {
  return setState({ page: 1, sort: "", genre: "", q: "" });
}

/* ===== Совместимость с прежним интерфейсом ===== */
export const ArtistState = {
  get() { return snapshot(); },

  setPage(p)  { setState({ page: Math.max(1, Number(p) || 1) }); },
  setLimit(n) { setState({ limit: Math.max(1, Number(n) || 8) }); },

  setSort(v)  { setState({ sort: v || "" }); },
  setGenre(v) { setState({ genre: v || "" }); },
  setQuery(v) { setState({ q: (v || "").trim() }); },

  setTotal(n) { setState({ total: Math.max(0, Number(n) || 0) }); },

  setMobilePanel(open) { setState({ isMobilePanelOpen: !!open }); },

  reset() { resetFilters(); },
};
