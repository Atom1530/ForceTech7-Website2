import axios from 'axios';
import Pagination from 'tui-pagination';



export async function fetchArtists() {
  try {
    const res = await axios.get("https://sound-wave.b.goit.study/api/artists", { params: { limit: 8 } });
    
    return res.data.artists;
  } catch (err) {
    console.error("Помилка:", err);
    return [];
  }
}


