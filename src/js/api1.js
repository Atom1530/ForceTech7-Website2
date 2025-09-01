
import axios from "axios";

const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});


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
    console.warn("[api] fetchArtists", err?.message || err);
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
    console.warn("[api] fetchGenres", err?.message || err);
    return ["All Genres"];
  }
}


export async function fetchArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}`);
    return data || null;
  } catch {
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
    console.warn("[api] albums", err?.message || err);
    return [];
  }
}
