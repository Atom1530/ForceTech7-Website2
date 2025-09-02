// modal.js — модалка артиста: открытие/закрытие, разметка, мини-плеер, zoom, ScrollTop

import { lockScroll, unlockScroll } from "../lib/scroll-lock.js";
import { UISound } from "../lib/sound.js";
import { fetchArtist, fetchArtistAlbums } from "./api.js";
import { getPrefetched } from "./prefetch.js";
import { openZoom } from "./zoom.js";
import { createMiniPlayer, destroyMiniPlayer } from "./player.js";

const SPRITE = "/img/sprite.svg";

export function createArtistModal(root) {
  const modal    = root.querySelector("#artist-modal");
  const modalEl  = modal?.querySelector(".amodal__dialog");
  const bodyEl   = modal?.querySelector("#am-body");
  const closeBtn = modal?.querySelector("#am-close");
  if (!modal || !modalEl || !bodyEl || !closeBtn) {
    throw new Error("modal markup incomplete");
  }

  // Кнопка «вверх» в модалке
  let scrollTopBtn = null;
  let onScroll = null;
  function ensureScrollTopBtn() {
    if (scrollTopBtn) return;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Scroll to top");
    b.textContent = "↑";
    Object.assign(b.style, {
      position: "fixed",
      right: "24px",
      bottom: "24px",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
      lineHeight: "1",
      background: "var(--color-affair, #764191)",
      color: "var(--color-white, #fff)",
      boxShadow: "0 8px 20px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,0.1)",
      zIndex: "5",
    });
    b.addEventListener("click", () => {
      UISound.tap();
      modalEl.scrollTo({ top: 0, behavior: "smooth" });
    });
    modal.appendChild(b);
    scrollTopBtn = b;
  }

  function fmtTime(val) {
    let ms = Number(val);
    if (!isFinite(ms)) return "—";
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
  function years(d){
    const s = d?.intFormedYear || d?.yearStart || d?.formedYear;
    const e = d?.intDisbandedYear || d?.intDiedYear || d?.yearEnd || d?.disbandedYear;
    if (s && e) return `${s}–${e}`;
    if (s) return `${s}–present`;
    return "information missing";
  }
  function trackRow(t) {
    const title = t?.strTrack || t?.title || t?.name || "—";
    const dur   = fmtTime(t?.intDuration ?? t?.duration ?? t?.time);
    const link  = t?.movie ?? t?.youtube ?? t?.youtube_url ?? t?.url ?? t?.strMusicVid;
    const yIco  = `<svg class="ico am-yt" aria-hidden="true"><use href="${SPRITE}#icon-icon_youtube_footer"></use></svg>`;
    return `
      <li class="tr">
        <span>${title}</span>
        <span>${dur}</span>
        <span>${link ? `<a class="yt" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube">${yIco}</a>` : `<span class="yt-ph"></span>`}</span>
      </li>`;
  }

  async function render(id){
    // берём из кэша, если успели префетчить
    const cached = getPrefetched(id);
    let artist, albums;
    if (cached) {
      artist = cached.artist;
      albums = cached.albums || [];
    } else {
      [artist, albums] = await Promise.all([fetchArtist(id), fetchArtistAlbums(id)]);
    }

    const d = artist || {};
    const name    = d?.strArtist || d?.name || "Unknown artist";
    const img     = d?.strArtistThumb || d?.photo || d?.image || "https://via.placeholder.com/960x540?text=No+Image";
    const country = d?.strCountry || d?.country || "N/A";
    const members = d?.intMembers || d?.members || "N/A";
    const sex     = d?.strGender || d?.sex || "N/A";
    const bio     = d?.strBiographyEN || d?.about || "";
    const genres  = Array.isArray(d?.genres) ? d.genres : (d?.genre ? [d.genre] : []);

    const albumsMarkup = (albums||[]).map(alb=>{
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

    bodyEl.innerHTML = `
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
          <div class="am-bio"><div class="lbl">Biography</div><p>${bio || "—"}</p></div>
          ${genres.length ? `<div class="am-tags">${genres.map(g=>`<span class="tag">${g}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      <h4 class="amodal__albums-title">Albums</h4>
      <div class="amodal__albums">
        ${albumsMarkup || "<p class='muted'>No albums found for this artist.</p>"}
      </div>`;
  }

  function open(id) {
    modal.removeAttribute("hidden");
    lockScroll();
    bodyEl.innerHTML = `<div class="amodal__loader loader"></div>`;
    addEsc();
    ensureScrollTopBtn();
    onScroll = () => {
      const t = modalEl.scrollTop || 0;
      if (scrollTopBtn) scrollTopBtn.style.display = t > 220 ? "flex" : "none";
    };
    modalEl.addEventListener("scroll", onScroll);
    onScroll();

    // мини-плеер и zoom
    createMiniPlayer(modal);
    modal.addEventListener("click", onModalClick);
    render(id);
  }

  function close() {
    modal.setAttribute("hidden", "");
    unlockScroll();
    bodyEl.innerHTML = "";
    removeEsc();
    if (onScroll) {
      modalEl.removeEventListener("scroll", onScroll);
      onScroll = null;
    }
    if (scrollTopBtn) scrollTopBtn.style.display = "none";
    destroyMiniPlayer(); // чистим видеоплеер
    modal.removeEventListener("click", onModalClick);
  }

  function onModalClick(e) {
    // YouTube inline (мини-плеер)
    const y = e.target.closest("a.yt");
    if (y) {
      e.preventDefault();
      UISound.tap();
      // обработка происходит внутри player.js (подписан на клики)
      return;
    }
    // Зум картинок
    const img = e.target.closest(".amodal__img");
    if (img) {
      UISound.tap();
      const src = img.currentSrc || img.getAttribute("src") || "";
      openZoom(src, img.alt || "");
      return;
    }
    // Клик по фону — закрыть
    if (e.target.classList.contains("amodal__backdrop")) {
      UISound.tap();
      close();
    }
  }

  const onEsc = (e) => {
    if (e.key === "Escape" && !modal.hasAttribute("hidden")) {
      UISound.tap();
      close();
    }
  };
  function addEsc(){ document.addEventListener("keydown", onEsc); }
  function removeEsc(){ document.removeEventListener("keydown", onEsc); }

  closeBtn.addEventListener("click", () => { UISound.tap(); close(); });

  return { open, close };
}
