// /src/js/api.1.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});

// нормализация жанров — API иногда отдаёт строки/объекты
function normalizeGenres(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.genres ?? [];
  const list = arr.map(item => {
    if (typeof item === "string") return item;
    if (item?.name) return item.name;
    if (item?.genre) return item.genre;
    if (item?.title) return item.title;
    if (item?.strGenre) return item.strGenre;
    return null;
  }).filter(Boolean);
  // уникальные
  return Array.from(new Set(list));
}

// ===== API =====

// список артистов
export async function fetchArtists({ page = 1, limit = 8, genre = "", sort = "", q = "" } = {}) {
  try {
    const params = { page, limit };
    if (genre && genre !== "All Genres") params.genre = genre;
    if (sort) params.sort = sort; // 'asc' | 'desc'
    if (q) params.q = q;

    const { data } = await api.get("/artists", { params });
    const artists = data?.artists ?? [];
    const totalArtists = data?.totalArtists ?? artists.length ?? 0;
    return { artists, totalArtists };
  } catch (e) {
    console.warn("[api] fetchArtists error:", e?.message);
    return { artists: [], totalArtists: 0 };
  }
}

// жанры
export async function fetchGenres() {
  try {
    const { data } = await api.get("/genres");
    const list = normalizeGenres(data);
    return ["All Genres", ...list];
  } catch (e) {
    console.warn("[api] fetchGenres error:", e?.message);
    return ["All Genres"];
  }
}

// детали артиста
export async function fetchArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}`);
    return data;
  } catch (e) {
    console.warn("[api] fetchArtist error:", e?.message);
    return null;
  }
}

// альбомы артиста
export async function fetchArtistAlbums(id) {
  try {
    const { data } = await api.get(`/artists/${id}/albums`);
    return Array.isArray(data) ? data : (data?.albums ?? []);
  } catch (e) {
    console.warn("[api] fetchArtistAlbums error:", e?.message);
    return [];
  }
}
