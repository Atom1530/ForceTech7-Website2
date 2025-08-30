import axios from 'axios';


let page = 1
// FUNCTION FOR ARTISTS SECTION
export async function fetchArtists() {
    try {
        const res = await axios.get("https://sound-wave.b.goit.study/api/artists", { params: { limit: 8, page } });
        page += 1;
        return {
            artists: res.data.artists,
            totalArtists: res.data.totalArtists
        }
    } catch (err) {
        console.error("Помилка:", err);
        return [];
    }
}

// FUNCTION FOR MODAL WINDOW
export async function fetchIndAboutArtist(id) {
    try {
        const res = await axios.get("https://sound-wave.b.goit.study/api/artists/{id}/albums")
        return res.data
    } catch (err) {
        console.error("Помилка", err)
        return []
    }
    // IT IS NECESSARY TO DESTRUCT THE DATA WHEN USING
}
