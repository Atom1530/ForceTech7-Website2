// src/js/artists/index.js
import { initArtists } from "./features/init.js";
import { createMiniPlayer } from "./features/player.js";

const RADIO_POOL = Array.from(new Set([
  "Zi_XLOBDo_Y","3JZ_D3ELwOQ","fRh_vgS2dFE","OPf0YbXqDm0","60ItHLz5WEA",
  "2Vv-BfVoq4g","kXYiU_JCYtU","UceaB4D0jpo","RubBzkZzpUA","kJQP7kiw5Fk",
  "CevxZvSJLk8","pRpeEdMmmQ0","IcrbM1l_BoI","YVkUvmDQ3HY","hT_nvWreIhg",
  "09R8_2nJtjg","uelHwf8o7_U","JGwWNGJdvx8","YQHsXMglC9A","NmugSMBh_iI",
  "LrUvu1mlWco","hLQl3WQQoQ0","RgKAFK5djSk","SlPhMPnQ58k","oRdxUFDoQe0",
  "09z7j-LPz1E","Pkh8UtuejGw","tt2k8PGm-TI","lY2yjAdbvdQ",
  "pXRviuL6vMY","nfs8NYg7yQM","nCkpzqqog4k","M7lc1UVf-VE"
]));

function ready(fn){
  if(document.readyState!=="loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}
function pickStartBtn(){
  // поддержим любые старые селекторы, но рекомендуем data-атрибут
  return document.querySelector('[data-radio="start"]')
      || document.querySelector('#rhythm-radio')
      || document.querySelector('#random-radio')
      || document.querySelector('#radio-start')
      || document.querySelector('.js-radio-start');
}

ready(() => {
  try { initArtists(); } catch {}
  const player = createMiniPlayer();

  const startBtn = pickStartBtn();
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      e.preventDefault();
      player.openQueue(RADIO_POOL, { shuffle: true, loop: true });
    });
  }

  // опционально: горячие клавиши
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.isComposing) return;
    if (e.key === "r" || e.key === "R") player.openQueue(RADIO_POOL, { shuffle:true, loop:true });
    if (e.key === "ArrowRight") player.next();
    if (e.key === "ArrowLeft")  player.prev();
  });

  // для отладки: window.__player.next(), prev(), openQueue([...])
  window.__player = player;
});
