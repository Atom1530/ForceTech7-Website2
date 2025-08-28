import axios from 'axios';


export let page = 1

export async function fetchArtists() {
  try {
    const res = await axios.get("https://sound-wave.b.goit.study/api/artists", { params: { limit: 8, page } });
    page += 1;
    return res.data.artists;
  } catch (err) {
    console.error("Помилка:", err);
    return [];
  }
}


