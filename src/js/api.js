import axios from "axios";

const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});

// Список артистов
export async function fetchArtists({ page = 1, limit = 8, genre = "", sort = "", q = "" } = {}) {
  try {
    const params = { page, limit };
    if (genre) params.genre = genre;     // строка жанра
    if (sort)  params.sort = sort;       // 'asc' | 'desc'
    if (q)     params.q = q;             // поисковая строка

    const { data } = await api.get("/artists", { params });
    return {
      artists: Array.isArray(data?.artists) ? data.artists : [],
      totalArtists: Number.isFinite(data?.totalArtists) ? data.totalArtists : 0,
    };
  } catch {
    return { artists: [], totalArtists: 0 };
  }
}

// Жанры (нормализуем в {label,value})
export async function fetchGenres() {
  try {
    const { data } = await api.get("/genres");
    const raw = Array.isArray(data) ? data : (data?.genres ?? []);
    const map = g => {
      if (typeof g === "string") return { label: g, value: g };
      if (g && typeof g === "object") {
        const label = g.label ?? g.name ?? g.title ?? "Unknown";
        const value = g.value ?? g.slug ?? g.name ?? label;
        return { label, value };
      }
      return { label: String(g), value: String(g) };
    };
    return [{ label: "All Genres", value: "" }, ...raw.map(map)];
  } catch {
    return [{ label: "All Genres", value: "" }];
  }
}

// Альбомы для модалки
export async function fetchIndAboutArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}/albums`);
    return { albums: Array.isArray(data) ? data : (data?.albums ?? []) };
  } catch {
    return { albums: [] };
  }
}
