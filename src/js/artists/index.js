// src/js/artists/index.js
import { initArtists } from "./features/init.js";
import { createMiniPlayer } from "./features/player.js";
import { UISound } from "./lib/sound.js";

// Пул YouTube ID
const RADIO_POOL = [
  "Zi_XLOBDo_Y","3JZ_D3ELwOQ","fRh_vgS2dFE","OPf0YbXqDm0","60ItHLz5WEA",
  "2Vv-BfVoq4g","kXYiU_JCYtU","UceaB4D0jpo","RubBzkZzpUA","kJQP7kiw5Fk",
  "CevxZvSJLk8","pRpeEdMmmQ0","IcrbM1l_BoI","YVkUvmDQ3HY","hT_nvWreIhg",
  "09R8_2nJtjg","uelHwf8o7_U","JGwWNGJdvx8","YQHsXMglC9A","NmugSMBh_iI",
  "LrUvu1mlWco","hLQl3WQQoQ0","RgKAFK5djSk","SlPhMPnQ58k","oRdxUFDoQe0",
  "09z7j-LPz1E","Pkh8UtuejGw","tt2k8PGm-TI","lY2yjAdbvdQ","pXRviuL6vMY",
  "09tj3yqpP5g","nfs8NYg7yQM","nCkpzqqog4k","M7lc1UVf-VE"
];

// селекторы возможных кнопок
const pick = (list) => list.map(q => document.querySelector(q)).find(Boolean);
const pickStartButton = () => pick([
  '[data-radio="start"]', '#rhythm-radio', '#random-radio', '#radio-start', '.js-radio-start'
]);
const pickNextBtn = () => pick(['[data-radio="next"]','#radio-next','.js-radio-next']);
const pickPrevBtn = () => pick(['[data-radio="prev"]','#radio-prev','.js-radio-prev']);
const pickStopBtn = () => pick(['[data-radio="stop"]','#radio-stop','.js-radio-stop']);

document.addEventListener("DOMContentLoaded", () => {
  try { initArtists(); } catch {}

  const player = createMiniPlayer();

  const startBtn = pickStartButton();
  if (startBtn) {
    startBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      UISound?.tap?.();
      await player.openQueue(RADIO_POOL, { shuffle: true, loop: true });
      player.ensureAudible();
    });
  }

  const nextBtn = pickNextBtn();
  if (nextBtn) nextBtn.addEventListener("click", (e) => {
    e.preventDefault(); UISound?.tap?.(); player.next();
  });

  const prevBtn = pickPrevBtn();
  if (prevBtn) prevBtn.addEventListener("click", (e) => {
    e.preventDefault(); UISound?.tap?.(); player.prev();
  });

  const stopBtn = pickStopBtn();
  if (stopBtn) stopBtn.addEventListener("click", (e) => {
    e.preventDefault(); UISound?.tap?.(); player.close();
  });
});
