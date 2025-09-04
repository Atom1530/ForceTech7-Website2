// src/js/artists/features/modal.js
import { lockScroll, unlockScroll } from "../lib/scroll-lock.js";
import { UISound } from "../lib/sound.js";
import { fetchArtist, fetchArtistAlbums } from "./api.js";
import { createMiniPlayer } from "./player.js";
import { openZoom } from "./zoom.js";

/* ---------- SPRITE: robust base path + helper ---------- */
function detectBasePath() {
  // 1) <base href="...">
  try {
    const baseEl = document.querySelector("base");
    if (baseEl?.href) {
      const u = new URL(baseEl.getAttribute("href"), location.href);
      return u.pathname.replace(/\/$/, "");
    }
  } catch {}

  // 2) Vite BASE_URL (заменяется на сборке)
  const viteBase =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.BASE_URL === "string")
      ? import.meta.env.BASE_URL
      : "";
  if (viteBase) return viteBase.replace(/\/$/, "");

  // 3) GitHub Pages: username.github.io/<repo>/...
  if (location.hostname.endsWith("github.io")) {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length ? `/${parts[0]}` : "";
  }

  // 4) по умолчанию — корень
  return "";
}
const BASE_URL = detectBasePath();
const SPRITE   = `${BASE_URL}/img/sprite.svg`;

const icon = (id, cls = "ico") =>
  `<svg class="${cls}" aria-hidden="true"><use href="${SPRITE}#${id}" xlink:href="${SPRITE}#${id}"></use></svg>`;

/* ----------------- helpers ----------------- */
function fmtTime(msLike) {
  const ms = Number(msLike);
  if (!Number.isFinite(ms)) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function years(d = {}) {
  const s = d.intFormedYear || d.yearStart || d.formedYear;
  const e = d.intDisbandedYear || d.intDiedYear || d.yearEnd || d.disbandedYear;
  if (s && e) return `${s}–${e}`;
  if (s) return `${s}–present`;
  return "information missing";
}
function trackRow(t = {}) {
  const title = t.strTrack || t.title || t.name || "—";
  const dur   = fmtTime(t.intDuration ?? t.duration ?? t.time);
  const link  = t.movie ?? t.youtube ?? t.youtube_url ?? t.url ?? t.strMusicVid;
  return `
    <li class="tr">
      <span>${title}</span>
      <span>${dur}</span>
      <span>${
        link
          ? `<a class="yt" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Play">
               ${icon("icon-icon_youtube_footer", "ico am-yt")}
             </a>`
          : `<span class="yt-ph"></span>`
      }</span>
    </li>`;
}

/* ---------- ensure shell (если partial не вставлен) ---------- */
function ensureModalShell(doc = document) {
  let modal = doc.querySelector("#artist-modal");
  if (modal) return modal;

  modal = doc.createElement("div");
  modal.id = "artist-modal";
  modal.className = "amodal";
  modal.setAttribute("hidden", "");
  modal.innerHTML = `
    <div class="amodal__backdrop"></div>
    <div class="amodal__dialog" role="dialog" aria-modal="true" aria-label="Artist details">
      <button id="am-close" class="amodal__close" type="button" aria-label="Close">×</button>
      <div id="am-body" class="amodal__body">
        <div class="amodal__loader loader"></div>
      </div>
    </div>`;
  doc.body.appendChild(modal);
  return modal;
}

/* ----------------- main ----------------- */
export function createArtistModal(rootEl = document) {
  const modal =
    (rootEl && rootEl.querySelector ? rootEl.querySelector("#artist-modal") : null) ||
    document.querySelector("#artist-modal") ||
    ensureModalShell(document);

  const modalBody  = modal.querySelector("#am-body");
  const modalClose = modal.querySelector("#am-close");
  const dialog     = modal.querySelector(".amodal__dialog");

  // Единый мини-плеер
  const player = createMiniPlayer();

  // -------- Scroll-to-top --------
  let scrollTopBtn = null;

  // делаем обработчики съемными и безопасными
  let placeScrollTopHandler = () => {}; // no-op по умолчанию
  let onDialogScroll = null;
  let onWinResize    = null;

  function ensureScrollTop() {
    if (scrollTopBtn) return;

    scrollTopBtn = document.createElement("button");
    scrollTopBtn.type = "button";
    scrollTopBtn.className = "amodal__scrolltop";
    scrollTopBtn.setAttribute("aria-label", "Scroll to top");
    scrollTopBtn.textContent = "↑";
    dialog.appendChild(scrollTopBtn);

    scrollTopBtn.addEventListener("click", () => {
      UISound?.tap?.();
      dialog.scrollTo({ top: 0, behavior: "smooth" });
    });

    // вычисление позиции кнопки относительно правого края диалога
    placeScrollTopHandler = () => {
      try {
        const pad = 24; // отступ внутрь от контейнера
        const r = dialog.getBoundingClientRect();
        const right = Math.max(pad, window.innerWidth - (r.left + r.width) + pad);
        scrollTopBtn.style.right  = `${right}px`;
        scrollTopBtn.style.bottom = `58px`; // поднята выше на ~30px
      } catch {}
    };

    // видимость по скроллу + актуализация позиции
    onDialogScroll = () => {
      try {
        scrollTopBtn.style.display = (dialog.scrollTop || 0) > 220 ? "flex" : "none";
        placeScrollTopHandler();
      } catch {}
    };
    dialog.addEventListener("scroll", onDialogScroll);

    // ресайз/ориентация
    onWinResize = () => { placeScrollTopHandler(); };
    window.addEventListener("resize", onWinResize);
    window.visualViewport?.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", onWinResize);

    // первичное размещение
    placeScrollTopHandler();
  }

  // -------- open/close --------
  const onEsc = (e) => {
    if (e.key === "Escape") {
      UISound?.tap?.();
      close();
    }
  };

  function open() {
    modal.removeAttribute("hidden");
    lockScroll();
    ensureScrollTop();
    if (scrollTopBtn) scrollTopBtn.style.display = "none"; // скрыта до первой прокрутки
    modalBody.innerHTML = `<div class="amodal__loader loader"></div>`;
    document.addEventListener("keydown", onEsc);
  }

  function close() {
    modal.setAttribute("hidden", "");
    unlockScroll();
    modalBody.innerHTML = "";
    document.removeEventListener("keydown", onEsc);

    // аккуратно снимаем слушатели и не оставляем висячих ссылок
    if (onDialogScroll) {
      dialog.removeEventListener("scroll", onDialogScroll);
      onDialogScroll = null;
    }
    if (onWinResize) {
      window.removeEventListener("resize", onWinResize);
      window.visualViewport?.removeEventListener("resize", onWinResize);
      window.removeEventListener("orientationchange", onWinResize);
      onWinResize = null;
    }
    // делаем обработчик безопасным no-op (на случай гонок)
    placeScrollTopHandler = () => {};

    if (scrollTopBtn) scrollTopBtn.style.display = "none";
  }

  modalClose.addEventListener("click", () => { UISound?.tap?.(); close(); });
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("amodal__backdrop")) {
      UISound?.tap?.(); close();
    }
  });

  // Делегирование кликов: YouTube => открыть наш плеер, Zoom — по картинке
  modal.addEventListener("click", (e) => {
    const a = e.target.closest("a.yt");
    if (a) {
      e.preventDefault();
      UISound?.tap?.();
      player.open(a.href);  // играем внутри сайта
      return;
    }
    const zoomImg = e.target.closest(".amodal__img");
    if (zoomImg) {
      UISound?.tap?.();
      const src =
        zoomImg.currentSrc ||
        zoomImg.getAttribute("src") ||
        zoomImg.getAttribute("data-src") ||
        "";
      openZoom(src, zoomImg.getAttribute("alt") || "");
    }
  });

  // -------- render --------
  async function render(artistId) {
    const [artist, albums] = await Promise.all([
      fetchArtist(artistId).catch(() => ({})),
      fetchArtistAlbums(artistId).catch(() => []),
    ]);

    const d = artist || {};
    const name    = d.strArtist || d.name || "Unknown artist";
    const img     = d.strArtistThumb || d.photo || d.image || "https://via.placeholder.com/960x540?text=No+Image";
    const country = d.strCountry || d.country || "N/A";
    const members = d.intMembers || d.members || "N/A";
    const sex     = d.strGender || d.sex || "N/A";
    const bio     = d.strBiographyEN || d.about || "";
    const genres  = Array.isArray(d.genres) ? d.genres : (d.genre ? [d.genre] : []);

    const albumsArr = Array.isArray(albums) ? albums : [];
    const albumsMarkup = albumsArr.map(alb => {
      const title  = alb?.strAlbum || alb?.title || alb?.name || "Album";
      const tracks = Array.isArray(alb?.tracks) ? alb.tracks :
                     (Array.isArray(alb?.songs) ? alb.songs : []);
      return `
        <div class="am-album">
          <div class="am-album__title">${title}</div>
          <ul class="tbl">
            <li class="th"><span>Track</span><span>Time</span><span>Link</span></li>
            ${tracks.map(trackRow).join("")}
          </ul>
        </div>`;
    }).join("");

    modalBody.innerHTML = `
      <h3 class="amodal__title">${name}</h3>

      <div class="amodal__content">
        <img class="amodal__img" src="${img}" alt="${name}" loading="lazy">
        <div class="amodal__info">
          <div class="am-meta">
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Years active</span><span class="val">${years(d)}</span></div>
              <div class="am-meta__item"><span class="lbl">Sex</span><span class="val">${sex}</span></div>
            </div>
            <div class="am-meta__col">
              <div class="am-meta__item"><span class="lbl">Members</span><span class="val">${members}</span></div>
              <div class="am-meta__item"><span class="lbl">Country</span><span class="val">${country}</span></div>
            </div>
          </div>

          <div class="am-bio">
            <div class="lbl">Biography</div>
            <p>${bio || "—"}</p>
          </div>

          ${genres.length ? `<div class="am-tags">${genres.map(g => `<span class="tag">${g}</span>`).join("")}</div>` : ""}
        </div>
      </div>

      <h4 class="amodal__albums-title">Albums</h4>
      <div class="amodal__albums">
        ${albumsMarkup || "<p class='muted'>No albums found for this artist.</p>"}
      </div>`;
  }

  // -------- public API --------
  async function openFor(id) {
    UISound?.tap?.();
    open();
    await render(id);
  }

  return { openFor, close };
}
