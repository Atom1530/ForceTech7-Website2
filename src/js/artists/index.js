// src/js/artists/index.js
// Апгрейд радио: большой пул, сбор ID с страницы, кэш, анти-повтор.
// Ничего не ломает существующие части: initArtists + мини-плеер.

import { initArtists } from "./features/init.js";
import { createMiniPlayer } from "./features/player.js";

/* -------------------- утилиты -------------------- */
function getYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const u = new URL(urlOrId, location.href);
    if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    return m ? m[2] : "";
  } catch {
    return "";
  }
}
const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* -------------------- seed-пул -------------------- */
// Можно смело дополнять своими ID. Дубликаты автоматически фильтруются.
const SEED_IDS = uniq([
  // Твои прежние ID
  "Zi_XLOBDo_Y","3JZ_D3ELwOQ","fRh_vgS2dFE","OPf0YbXqDm0","60ItHLz5WEA",
  "2Vv-BfVoq4g","kXYiU_JCYtU","UceaB4D0jpo","RubBzkZzpUA","kJQP7kiw5Fk",
  "CevxZvSJLk8","pRpeEdMmmQ0","IcrbM1l_BoI","YVkUvmDQ3HY","hT_nvWreIhg",
  "09R8_2nJtjg","uelHwf8o7_U","JGwWNGJdvx8","YQHsXMglC9A","NmugSMBh_iI",
  "LrUvu1mlWco","hLQl3WQQoQ0","RgKAFK5djSk","SlPhMPnQ58k","oRdxUFDoQe0",
  "09z7j-LPz1E","Pkh8UtuejGw","tt2k8PGm-TI","lY2yjAdbvdQ","pXRviuL6vMY",
  "09tj3yqpP5g","nfs8NYg7yQM","nCkpzqqog4k","M7lc1UVf-VE",

  // Дополнения (разнообразие)
  "fLexgOxsZu0","2vjPBrBU-TM","JGwWNGJdvx8","9bZkp7q19f0","e-ORhEE9VVg",
  "hLQl3WQQoQ0","OPf0YbXqDm0","dQw4w9WgXcQ","Zi_XLOBDo_Y","gCYcHz2k5x0",
  "ktvTqknDobU","ub82Xb1C8os","ktvTqknDobU","fKopy74weus","uelHwf8o7_U",
  "Qv5fqunQ_4I","IcrbM1l_BoI","2vjPBrBU-TM","kXYiU_JCYtU","CevxZvSJLk8",
  "kJQP7kiw5Fk","hT_nvWreIhg","vNoKguSdy4Y","0KSOMA3QBU0","lp-EO5I60KA",
  "DK_0jXPuIr0","tVj0ZTS4WF4","6fVE8kSM43I","SlPhMPnQ58k","6Ejga4kJUts",
  "JGwWNGJdvx8","gGdGFtwCNBE","YVkUvmDQ3HY","rYEDA3JcQqw","AtKZKl7Bgu0",
  "0KSOMA3QBU0","ktvTqknDobU","hT_nvWreIhg","eVTXPUF4Oz4","kffacxfA7G4"
]);

/* -------------------- кэш пула в localStorage -------------------- */
const LS_KEY_POOL = "am.radio.pool";
const LS_KEY_LAST = "am.radio.last";

function readPoolLS() {
  try {
    const raw = localStorage.getItem(LS_KEY_POOL);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? uniq(arr) : [];
  } catch {
    return [];
  }
}
function savePoolLS(arr) {
  try {
    localStorage.setItem(LS_KEY_POOL, JSON.stringify(uniq(arr).slice(0, 800)));
  } catch {}
}
function addToPoolLS(ids) {
  if (!ids?.length) return;
  const cur = new Set(readPoolLS());
  ids.forEach((id) => cur.add(id));
  savePoolLS([...cur]);
}

/* -------------------- сбор ID из DOM (модалка и т.п.) -------------------- */
function collectFromDOM(root = document) {
  const out = new Set();
  root.querySelectorAll('a[href*="youtu"], a.yt').forEach((a) => {
    const href = a.getAttribute("href") || "";
    const id = getYouTubeId(href);
    if (id) out.add(id);
  });
  return [...out];
}
function installCollector() {
  // стартовая выборка
  addToPoolLS(collectFromDOM());

  // наблюдаем за добавлениями (модалки, динамика и т.д.)
  const mo = new MutationObserver((mutations) => {
    let added = [];
    for (const m of mutations) {
      if (!m.addedNodes) continue;
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return; // ELEMENT_NODE
        added = added.concat(collectFromDOM(n));
      });
    }
    if (added.length) addToPoolLS(added);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

/* -------------------- сбор итогового пула -------------------- */
function buildPool() {
  // объединяем: seed + кэш + то, что уже в DOM
  const mem = readPoolLS();
  const dom = collectFromDOM();
  const pool = uniq([...SEED_IDS, ...mem, ...dom]);
  return pool;
}

/* -------------------- радио-логика -------------------- */
function startMixRadio(player) {
  const pool = buildPool();
  if (!pool.length) return;

  // большая перемешанная очередь
  let order = shuffle(pool);

  // анти-повтор стартового: если первый совпал с прошлым — сдвигаем
  const last = localStorage.getItem(LS_KEY_LAST);
  if (last && order.length > 1 && order[0] === last) {
    order.push(order.shift());
  }
  localStorage.setItem(LS_KEY_LAST, order[0]);

  // даём плееру целую очередь, он сам пролистывает и лупит
  // (loop:true — бесконечно; shuffle:false, т.к. уже перемешали)
  player.openQueue(order, { shuffle: false, loop: true, startIndex: 0 });
}

/* -------------------- bootstrap -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  try { initArtists(); } catch {}

  const player = createMiniPlayer();

  // собираем ID на лету
  installCollector();

  // кнопка «Mix Radio / Next»
  const btn = document.querySelector("#random-radio");
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // если плеер ещё не активен — стартуем радио, иначе — Next
       if (!player.hasQueue?.()) startMixRadio(player);
      else player.next?.();
    });
  }
});
