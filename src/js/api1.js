// api1.js
import axios from "axios";

/* ===== Env & logging ===== */
const IS_DEV =
  /localhost|127\.0\.0\.1/.test(location.hostname) ||
  (document.documentElement.getAttribute("data-env") || "").toLowerCase() === "dev";

const logWarn = (...args) => {
  if (IS_DEV) console.warn(...args);
};

/* ===== Axios ===== */
const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});

/* ===== API ===== */
export async function fetchArtists(
  { page = 1, limit = 8, genre = "", sort = "", name = "" } = {}
) {
  try {
    const params = {
      page: Math.max(1, Number(page) || 1),
      limit: Math.max(1, Number(limit) || 8),
    };

    const s = String(sort).toLowerCase();
    if (s === "asc" || s === "desc") params.sortName = s;

    const g = String(genre).trim();
    if (g && g !== "All Genres") params.genre = g;

    const n = String(name).trim();
    if (n.length >= 1) params.name = n;

    const { data } = await api.get("/artists", { params });
    return {
      artists: Array.isArray(data?.artists) ? data.artists : [],
      totalArtists: Number(data?.totalArtists || 0),
      page: Number(data?.page || params.page),
      limit: Number(data?.limit || params.limit),
    };
  } catch (err) {
    logWarn("[api] fetchArtists", err?.message || err);
    try { window.__toast?.error("Не удалось загрузить артистов. Попробуйте позже."); } catch {}
    return { artists: [], totalArtists: 0, page: 1, limit };
  }
}

export async function fetchGenres() {
  try {
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
    return ["All Genres", ...uniq];
  } catch (err) {
    logWarn("[api] fetchGenres", err?.message || err);
    try { window.__toast?.error("Не удалось загрузить жанры."); } catch {}
    return ["All Genres"];
  }
}

export async function fetchArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}`);
    return data || null;
  } catch (err) {
    logWarn("[api] fetchArtist", err?.message || err);
    try { window.__toast?.error("Не удалось загрузить артиста."); } catch {}
    return null;
  }
}

export async function fetchArtistAlbums(id) {
  try {
    const { data } = await api.get(`/artists/${id}/albums`);

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.albumsList)) return data.albumsList;
    if (Array.isArray(data?.albums)) return data.albums;

    return [];
  } catch (err) {
    logWarn("[api] albums", err?.message || err);
    try { window.__toast?.error("Не удалось загрузить альбомы."); } catch {}
    return [];
  }
}
