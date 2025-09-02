// src/js/artists/index.js
import "../artists/lib/toast.js";                 // один раз на страницу
import { UISound } from "../artists/lib/sound.js";
import { initArtists } from "./features/init.js";

export { initArtists, UISound };

// автозапуск (без двойного вызова с мостом)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initArtists());
} else {
  initArtists();
}




