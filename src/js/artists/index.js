// src/js/artists/index.js
// --------------------------------------------------
// Точка входа секции Artists.
// Ничего не трогаем в твоём player.js — только подключаем
// минимальный патч (features/player-patch.js) ПОСЛЕ создания плеера,
// и добавляем "Mix Radio / Next" на кнопку #random-radio.
// --------------------------------------------------

import { initArtists } from "./features/init.js";
import { createMiniPlayer } from "./features/player.js";
import mountPlayerPatch from "./features/player-patch.js";

/* =========================
   Утилиты
   ========================= */

/** Достаёт YouTube ID из ID или URL (включая youtu.be, /embed, /shorts, ?v=) */
function getYouTubeId(urlOrId) {
  if (!urlOrId) return "";
  // уже готовый ID вида xxxxxxxxxxx
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;

  // пытаемся разобрать как URL
  try {
    const u = new URL(urlOrId, location.href);

    // короткая форма
    if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1);

    // обычная форма ?v=
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;

    // варианты путей: /embed/ID, /v/ID, /shorts/ID
    const m = u.pathname.match(/\/(?:embed|v|shorts)\/([^/?#]+)/i);
    if (m && m[1] && /^[\w-]{11}$/.test(m[1])) return m[1];
  } catch {
    /* ignore */
  }
  return "";
}

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* =========================
   Seed-пул видео (можно дополнять)
   ========================= */

const SEED_IDS = uniq([
  // базовый набор
  "Zi_XLOBDo_Y","3JZ_D3ELwOQ","fRh_vgS2dFE","OPf0YbXqDm0","60ItHLz5WEA",
  "2Vv-BfVoq4g","kXYiU_JCYtU","UceaB4D0jpo","RubBzkZzpUA","kJQP7kiw5Fk",
  "CevxZvSJLk8","pRpeEdMmmQ0","IcrbM1l_BoI","YVkUvmDQ3HY","hT_nvWreIhg",
  "09R8_2nJtjg","uelHwf8o7_U","JGwWNGJdvx8","YQHsXMglC9A","NmugSMBh_iI",
  "LrUvu1mlWco","hLQl3WQQoQ0","RgKAFK5djSk","SlPhMPnQ58k","oRdxUFDoQe0",
  "Pkh8UtuejGw","tt2k8PGm-TI","lY2yjAdbvdQ","pXRviuL6vMY","nfs8NYg7yQM",
  "nCkpzqqog4k","M7lc1UVf-VE",
  // расширение
  "fLexgOxsZu0","2vjPBrBU-TM","9bZkp7q19f0","e-ORhEE9VVg","gCYcHz2k5x0",
  "ktvTqknDobU","ub82Xb1C8os","fKopy74weus","Qv5fqunQ_4I","vNoKguSdy4Y",
  "0KSOMA3QBU0","lp-EO5I60KA","DK_0jXPuIr0","tVj0ZTS4WF4","6fVE8kSM43I",
  "6Ejga4kJUts","gGdGFtwCNBE","rYEDA3JcQqw","AtKZKl7Bgu0","eVTXPUF4Oz4",
  "kffacxfA7G4"
]);

/* =========================
   localStorage: кэш пула
   ========================= */

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
  } catch { /* ignore */ }
}
function addToPoolLS(ids) {
  if (!ids?.length) return;
  const cur = new Set(readPoolLS());
  ids.forEach((id) => cur.add(id));
  savePoolLS([...cur]);
}

/* =========================
   Сбор ID из DOM
   ========================= */

function collectFromDOM(root = document) {
  const out = new Set();

  // Ссылки на YouTube
  root.querySelectorAll('a[href*="youtu"], a.yt').forEach((a) => {
    const href = a.getAttribute("href") || "";
    const id = getYouTubeId(href);
    if (id) out.add(id);
  });

  // Возможные data-атрибуты
  root.querySelectorAll("[data-yt],[data-youtube],[data-ytid]").forEach((el) => {
    const raw = el.getAttribute("data-yt") || el.getAttribute("data-youtube") || el.getAttribute("data-ytid") || "";
    const id = getYouTubeId(raw);
    if (id) out.add(id);
  });

  return [...out];
}

function installCollector() {
  // стартовая выборка
  addToPoolLS(collectFromDOM());

  // наблюдаем за добавлениями (модалки, подгрузки и т.п.)
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

/* =========================
   Построение итогового пула
   ========================= */

function buildPool() {
  const mem = readPoolLS();
  const dom = collectFromDOM();
  return uniq([...SEED_IDS, ...mem, ...dom]);
}

/* =========================
   Mix Radio
   ========================= */

function startMixRadio(player) {
  const pool = buildPool();
  if (!pool.length || !player) return;

  // большая перемешанная очередь
  let order = shuffle(pool);

  // анти-повтор стартового
  const last = localStorage.getItem(LS_KEY_LAST);
  if (last && order.length > 1 && order[0] === last) {
    order.push(order.shift());
  }
  localStorage.setItem(LS_KEY_LAST, order[0]);

  // отдаём очередь плееру
  player.openQueue?.(order, { shuffle: false, loop: true, startIndex: 0 });
}

/* =========================
   Bootstrap
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  // Инициализация секции/грида/модалок (как было)
  try { initArtists(); } catch { /* ignore */ }

  // Создаём мини-плеер
  const player = createMiniPlayer?.();

  // Ставим минимальный патч — строго после создания плеера
  try { mountPlayerPatch(player); } catch { /* ignore */ }

  // Сбор ID на лету (модалки, динамика)
  installCollector();

  // Кнопка «Mix Radio / Next»
  const btn = document.querySelector("#random-radio");
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      // Если свернут (пузырь) — просто next, не раскрывая плеер
      if (player?.isMinimized?.()) {
        player.next?.();
        return;
      }

      // Если ещё не активен — стартуем радио или next по готовой очереди
      if (!player?.isActive?.()) {
        if (player?.hasQueue?.()) player.next?.();
        else startMixRadio(player);
        return;
      }

      // Если активен — просто next
      player.next?.();
    }, { passive: false });
  }
});
