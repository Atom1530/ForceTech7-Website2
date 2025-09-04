// CRC/JS/api.js
// Единая обёртка над REST API проекта.
// Возвращает стабильные структуры, не бросает исключений наружу.
// Совместимо с artists/features/api.js

import axios from "axios";

/* =========================
   ENV / ЛОГИРОВАНИЕ
   ========================= */
const IS_DEV =
  /localhost|127\.0\.0\.1/.test(location.hostname) ||
  (document.documentElement.getAttribute("data-env") || "").toLowerCase() === "dev";

const logWarn = (...args) => { if (IS_DEV) console.warn(...args); };

/* =========================
   BASE URL (с возможностью переопределить)
   ========================= */
// приоритет: <html data-api="..."> → VITE_API_BASE → дефолт
const API_BASE =
  document.documentElement.getAttribute("data-api") ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "https://sound-wave.b.goit.study/api";

/* =========================
   AXIOS ИНСТАНС
   ========================= */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { "Accept": "application/json" },
});

// перехватчик ответов — ничего «магического» не делаем, только единый warn в DEV
api.interceptors.response.use(
  (res) => res,
  (err) => {
    logWarn("[api] HTTP error:", err?.message || err);
    return Promise.reject(err);
  }
);

/* =========================
   ХЕЛПЕРЫ
   ========================= */
function toastError(msg) {
  try { window.__toast?.error(msg); } catch {}
}

// безопасная нормализация любого значения в число (с минимумом)
function clampNumber(v, min, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

/* =========================
   API ФУНКЦИИ
   ========================= */

/**
 * Список артистов
 * @param {{page?:number,limit?:number,genre?:string,sort?:'asc'|'desc'|'',name?:string}} params
 * @returns {Promise<{artists:Array,totalArtists:number,page:number,limit:number}>}
 */
export async function fetchArtists(
  { page = 1, limit = 8, genre = "", sort = "", name = "" } = {}
) {
  try {
    const params = {
      page: clampNumber(page, 1, 1),
      limit: clampNumber(limit, 1, 8),
    };

    const s = String(sort || "").toLowerCase();
    if (s === "asc" || s === "desc") params.sortName = s;

    const g = String(genre || "").trim();
    if (g && g !== "All Genres") params.genre = g;

    const n = String(name || "").trim();
    if (n.length >= 1) params.name = n;

    const { data } = await api.get("/artists", { params });

    // Нормализация ответа (на случай неожиданных форм)
    const artists = Array.isArray(data?.artists) ? data.artists
                   : Array.isArray(data)          ? data
                   : [];
    const totalArtists = clampNumber(data?.totalArtists, 0, artists.length);
    const pageOut  = clampNumber(data?.page, 1, params.page);
    const limitOut = clampNumber(data?.limit, 1, params.limit);

    return { artists, totalArtists, page: pageOut, limit: limitOut };
  } catch (err) {
    logWarn("[api] fetchArtists failed:", err?.message || err);
    toastError("Не удалось загрузить артистов. Попробуйте позже.");
    return { artists: [], totalArtists: 0, page: 1, limit: clampNumber(limit, 1, 8) };
  }
}

/* ----- кэш жанров (in-memory) на короткое время ----- */
let _genresCache = { ts: 0, list: [] };
const GENRES_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Список жанров
 * @returns {Promise<string[]>} — массив имён жанров (включая "All Genres" первым)
 */
export async function fetchGenres() {
  try {
    const now = Date.now();
    if (_genresCache.list.length && now - _genresCache.ts < GENRES_TTL) {
      return _genresCache.list.slice(); // отдаём копию
    }

    const { data } = await api.get("/genres");
    const raw = Array.isArray(data) ? data : (data?.genres || []);
    const names = raw
      .map((g) =>
        typeof g === "string"
          ? g
          : g?.name || g?.title || g?.genre || g?.label || ""
      )
      .filter(Boolean);
    const uniq = [...new Set(names)];
    const out = ["All Genres", ...uniq];

    _genresCache = { ts: now, list: out };
    return out;
  } catch (err) {
    logWarn("[api] fetchGenres failed:", err?.message || err);
    toastError("Не удалось загрузить жанры.");
    return ["All Genres"];
  }
}

/**
 * Один артист
 * @param {string|number} id
 * @returns {Promise<Object|null>}
 */
export async function fetchArtist(id) {
  if (!id && id !== 0) return null;
  try {
    const { data } = await api.get(`/artists/${id}`);
    // Возможные формы: объект, массив, { artists: [...] }
    if (data && !Array.isArray(data)) return data;
    if (Array.isArray(data) && data.length) return data[0];
    if (Array.isArray(data?.artists) && data.artists.length) return data.artists[0];
    return null;
  } catch (err) {
    logWarn("[api] fetchArtist failed:", err?.message || err);
    toastError("Не удалось загрузить артиста.");
    return null;
  }
}

/**
 * Альбомы артиста (каждый альбом может содержать массив треков)
 * @param {string|number} id
 * @returns {Promise<Array>}
 */
export async function fetchArtistAlbums(id) {
  if (!id && id !== 0) return [];
  try {
    const { data } = await api.get(`/artists/${id}/albums`);

    // Возможные формы от API:
    // - Array
    // - { albumsList: [...] } / { albums: [...] } / { album: [...] }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.albumsList)) return data.albumsList;
    if (Array.isArray(data?.albums)) return data.albums;
    if (Array.isArray(data?.album)) return data.album;

    return [];
  } catch (err) {
    logWarn("[api] fetchArtistAlbums failed:", err?.message || err);
    toastError("Не удалось загрузить альбомы.");
    return [];
  }
}

/* =========================
   Доп. экспорт при необходимости
   ========================= */
export { api, API_BASE, IS_DEV };
