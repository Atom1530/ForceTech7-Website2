
import axios from "axios";

const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});


export async function fetchArtists(
  { page = 1, limit = 8, genre = "", sort = "", q = "" } = {}
) {
  try {
    const params = {
      page: Math.max(1, Number(page) || 1),
      limit: Math.max(1, Number(limit) || 8),
    };

    
    const s = String(sort).toLowerCase();
    if (s === "asc" || s === "desc") params.sort = s;

    const g = String(genre).trim();
    if (g && g !== "All Genres") params.genre = g;

    const query = String(q).trim();
    
    if (query.length >= 2) params.q = query;

    const { data } = await api.get("/artists", { params });
    return {
      artists: Array.isArray(data?.artists) ? data.artists : [],
      totalArtists: Number(data?.totalArtists || 0),
    };
  } catch (err) {
    console.warn("[api] fetchArtists", err?.message || err);
    return { artists: [], totalArtists: 0 };
  }
}

// genres
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
    console.warn("[api] fetchGenres", err?.message || err);
    return ["All Genres"];
  }
}

// artist details (для модалки)
export async function fetchArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}`);
    return data || null;
  } catch {
    return null;
  }
}

// albums for modal
export async function fetchArtistAlbums(id) {
  try {
    const { data } = await api.get(`/artists/${id}/albums`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[api] albums", err?.message || err);
    return [];
  }
}
