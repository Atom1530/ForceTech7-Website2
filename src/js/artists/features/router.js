// URL-sync для секции Artists: читает состояние из query при старте,
// и поддерживает актуальный query при изменении state (replaceState).

import { getState, setState, subscribe } from "./state.js";

function parseQuery() {
  const p = new URLSearchParams(location.search);
  const q = (p.get("q") || "").trim();
  const genre = p.get("genre") || "";
  const sort = p.get("sort") || "";
  const page = Math.max(1, Number(p.get("page") || 1));
  return { q, genre, sort, page };
}

function buildQuery(s) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.genre) p.set("genre", s.genre);
  if (s.sort) p.set("sort", s.sort);
  if (s.page && s.page !== 1) p.set("page", String(s.page));
  return p.toString();
}

export function initRouter(/* root не нужен, но оставим сигнатуру единообразной */) {
  // 1) Применяем состояние из URL один раз при инициализации
  const urlState = parseQuery();
  const cur = getState();
  const patch = {};
  let changed = false;
  for (const k of ["q","genre","sort","page"]) {
    if (urlState[k] !== undefined && urlState[k] !== cur[k]) {
      patch[k] = urlState[k];
      changed = true;
    }
  }
  if (changed) setState(patch);

  // 2) Подписываемся на изменения state и обновляем URL
  let lastQS = null;
  subscribe((s) => {
    const qs = buildQuery(s);
    if (qs === lastQS) return;
    lastQS = qs;
    const url = qs ? `?${qs}` : location.pathname;
    history.replaceState(null, "", url);
  });
}
