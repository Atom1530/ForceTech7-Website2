// /src/js/api1.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://sound-wave.b.goit.study/api",
  timeout: 15000,
});

export async function fetchArtists({ page=1, limit=8, genre="", q="" } = {}) {
  try {
    const params = { page, limit };
    if (genre) params.genre = genre;
    if (q) params.q = q;
    const { data } = await api.get("/artists", { params });
    return { artists: data?.artists ?? [], totalArtists: data?.totalArtists ?? 0 };
  } catch (err) {
    console.warn("[api] fetchArtists", err?.response?.status, err?.message);
    return { artists: [], totalArtists: 0 };
  }
}

export async function fetchGenres() {
  try {
    const { data } = await api.get("/genres");
    const list = Array.isArray(data) ? data : (data?.genres ?? []);
    return list;
  } catch {
    return [];
  }
}

export async function fetchArtist(id) {
  try {
    const { data } = await api.get(`/artists/${id}`);
    return data;
  } catch {
    return null;
  }
}

export async function fetchArtistAlbums(id) {
  try {
    const { data } = await api.get(`/artists/${id}/albums`);
    return data ?? [];
  } catch {
    return [];
  }
}
