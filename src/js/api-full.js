import axios from 'axios';

let page = 1;

// Получение списка артистов с пагинацией
export async function fetchArtists(limit = 8) {
  try {
    const res = await axios.get("https://sound-wave.b.goit.study/api/artists", {
      params: { limit, page }
    });
    page += 1;
    return {
      artists: res.data.artists,
      totalArtists: res.data.totalArtists
    };
  } catch (err) {
    console.error("Error fetching artists:", err);
    return { artists: [], totalArtists: 0 };
  }
}

// Получение полной информации об артисте и его альбомов
export async function fetchArtistFullInfo(id) {
  try {
    const artistRes = await axios.get(`https://sound-wave.b.goit.study/api/artists/${id}`);
    const albumsRes = await axios.get(`https://sound-wave.b.goit.study/api/artists/${id}/albums`);

    const artist = artistRes.data;
    const albums = Array.isArray(albumsRes.data) ? albumsRes.data : [];

    return {
      ...artist,
      albums
    };
  } catch (err) {
    console.error("Error fetching artist info:", err);
    return { albums: [] };
  }
}
