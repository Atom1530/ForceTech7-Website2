// src/js/artists/features/state.js

const STORAGE_KEY = "artistsStateV2";

const initial = {
  page: 1,
  limit: 8,            // базовый лимит для Default
  genre: "",
  sort: "",
  q: "",
  isMobilePanelOpen: false,
};

// Текущее состояние
let state = { ...initial };

// Флаг и слушатели
let storageLoaded = false;
const listeners = new Set();

/* ---------------- storage helpers ---------------- */
function canUseStorage() {
  try {
    const k = "__probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function loadFromStorage() {
  if (storageLoaded) return;
  storageLoaded = true;
  if (!canUseStorage()) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    state = {
      page: Math.max(1, Number(obj?.page) || initial.page),
      limit: Math.max(1, Number(obj?.limit) || initial.limit),
      genre: String(obj?.genre ?? initial.genre),
      sort: String(obj?.sort ?? initial.sort),
      q: String(obj?.q ?? initial.q),
      isMobilePanelOpen: !!obj?.isMobilePanelOpen,
    };
  } catch {
    // игнор
  }
}

function saveToStorage() {
  if (!storageLoaded || !canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // квота/приватный режим — молча
  }
}

/* ---------------- pub/sub ---------------- */
function notify() {
  const snap = { ...state };
  for (const fn of listeners) {
    try { fn(snap); } catch {}
  }
}

/** Подписка на изменения состояния. Возвращает функцию отписки. */
export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Явная отписка (альтернатива функции, возвращаемой subscribe) */
export function unsubscribe(fn) {
  listeners.delete(fn);
}

// на всякий случай алиас, если где-то импортируется другое имя
export const onChange = subscribe;

/* ---------------- современный API ---------------- */
const ArtistState = {
  get() {
    loadFromStorage();
    return { ...state };
  },
  setPage(p) {
    loadFromStorage();
    state.page = Math.max(1, Number(p) || 1);
    saveToStorage(); notify();
  },
  setLimit(n) {
    loadFromStorage();
    state.limit = Math.max(1, Number(n) || initial.limit);
    saveToStorage(); notify();
  },
  setGenre(v) {
    loadFromStorage();
    state.genre = v || "";
    saveToStorage(); notify();
  },
  setSort(v) {
    loadFromStorage();
    state.sort = v || "";
    saveToStorage(); notify();
  },
  setQuery(v) {
    loadFromStorage();
    state.q = v || "";
    saveToStorage(); notify();
  },
  setMobilePanel(on) {
    loadFromStorage();
    state.isMobilePanelOpen = !!on;
    saveToStorage(); notify();
  },
  reset() {
    loadFromStorage();
    state = { ...initial };
    saveToStorage(); notify();
  },
};

export { ArtistState };
export default ArtistState;

/* ---------------- back-compat экспорт ---------------- */
// Старые импорты могли использовать эти функции.
export const getState = () => ArtistState.get();

export const setState = (patch = {}) => {
  loadFromStorage();
  const next = { ...state };

  if ("page" in patch)  next.page  = Math.max(1, Number(patch.page)  || 1);
  if ("limit" in patch) next.limit = Math.max(1, Number(patch.limit) || initial.limit);
  if ("genre" in patch) next.genre = String(patch.genre || "");
  if ("sort" in patch)  next.sort  = String(patch.sort  || "");
  if ("q" in patch)     next.q     = String(patch.q     || "");
  if ("isMobilePanelOpen" in patch) next.isMobilePanelOpen = !!patch.isMobilePanelOpen;

  state = next;
  saveToStorage(); notify();
  return ArtistState.get();
};

export const resetState = () => { ArtistState.reset(); return ArtistState.get(); };

// Пробрасываем поименованные сеттеры, если где-то импортируются напрямую
export const setPage        = (p)  => ArtistState.setPage(p);
export const setLimit       = (n)  => ArtistState.setLimit(n);
export const setGenre       = (v)  => ArtistState.setGenre(v);
export const setSort        = (v)  => ArtistState.setSort(v);
export const setQuery       = (v)  => ArtistState.setQuery(v);
export const setMobilePanel = (on) => ArtistState.setMobilePanel(on);

/* ---------------- первичная загрузка ---------------- */
loadFromStorage(); // чтобы состояние было готово до первых подписок


