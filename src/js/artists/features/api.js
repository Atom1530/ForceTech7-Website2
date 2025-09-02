// src/js/artists/features/api.js
// Чистая точка входа для запросов + re-export state (мягкий мост).

export {
  fetchArtists,
  fetchGenres,
  fetchArtist,
  fetchArtistAlbums,
} from "../../api1.js"; // <- твой реальный API

// Мост: чтобы старые импорты ArtistState из "./api.js" не падали.
// Постепенно переводи код на прямой импорт из "./state.js".
export {
  ArtistState,
  getState,
  setState,
  subscribe,
  resetFilters,
} from "./state.js";


