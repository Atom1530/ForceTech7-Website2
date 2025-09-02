// Склейка фич секции "Artists"
import { initGrid } from './grid.js';         // твой модуль грида
// при необходимости сюда же добавим initPlayer / initZoom и т.д.

let booted = false;
export function initArtists() {
  if (booted) return; // защита от двойного запуска
  const root = document.querySelector('#artists-section');
  if (!root) return;
  initGrid(root);     // ← запускаем грид и всё, что он внутри подключает
  booted = true;
}
