
import {
  fetchArtists as _fetchArtists,
  fetchGenres  as _fetchGenres,
  fetchArtist  as _fetchArtist,
  fetchArtistAlbums as _fetchArtistAlbums,
} from "../../api.js";

// ---------- helpers ----------
const normId = (o) => o?.idArtist || o?.id || o?._id || o?.artistId || "";

const normGenres = (o) => {
  if (Array.isArray(o?.genres)) return o.genres;
  if (typeof o?.strGenre === "string" && o.strGenre.trim())
    return o.strGenre.split(/,\s*/).filter(Boolean);
  if (o?.genre) return [o.genre];
  return [];
};

const NOPHOTO = "https://via.placeholder.com/960x540?text=No+Image";

const normArtist = (o = {}) => ({
  id: normId(o),
  name: o.strArtist || o.name || "Unknown artist",
  image: o.strArtistThumb || o.thumb || o.photo || o.image || NOPHOTO,
  country: o.strCountry || o.country || "N/A",
  members: o.intMembers || o.members || "N/A",
  gender:  o.strGender || o.sex || "N/A",
  biography: o.strBiographyEN || o.biography || o.about || "",
  genres: normGenres(o),
  formedYear: o.intFormedYear || o.formedYear || o.yearStart || null,
  endedYear:  o.intDisbandedYear || o.intDiedYear || o.disbandedYear || o.yearEnd || null,
});

const normTrack = (t = {}) => ({
  title: t.strTrack || t.title || t.name || "—",
  duration: Number(t.intDuration ?? t.duration ?? t.time ?? 0),
  youtube: t.strMusicVid || t.youtube || t.youtube_url || t.url || t.movie || "",
});

const normAlbum = (a = {}) => {
  const rawTracks =
    Array.isArray(a.tracks) ? a.tracks :
    Array.isArray(a.songs)  ? a.songs  :
    Array.isArray(a.track)  ? a.track  : [];
  return {
    title: a.strAlbum || a.title || a.name || "Album",
    tracks: rawTracks.map(normTrack),
  };
};

// ---------- exported API (normalized) ----------
export async function fetchArtists(params) {
  const res = await _fetchArtists(params);
  const list = Array.isArray(res?.artists) ? res.artists
             : Array.isArray(res)          ? res
             : [];
  const artists = list.map(normArtist);
  const totalArtists = Number(res?.totalArtists ?? res?.total ?? artists.length);
  return { artists, totalArtists };
}

export async function fetchGenres() {
  const res = await _fetchGenres();
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.genres)) return res.genres;
  return [];
}

export async function fetchArtist(id) {
  const res = await _fetchArtist(id);
  const obj = Array.isArray(res) ? res[0]
            : Array.isArray(res?.artists) ? res.artists[0]
            : res;
  return obj ? normArtist(obj) : null;
}

export async function fetchArtistAlbums(id) {
  const res = await _fetchArtistAlbums(id);
  const list = Array.isArray(res) ? res
             : Array.isArray(res?.albums) ? res.albums
             : Array.isArray(res?.album)  ? res.album
             : [];
  return list.map(normAlbum);
}



