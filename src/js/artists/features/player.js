// src/js/artists/features/player.js
import { UISound } from "../lib/sound.js";

const SPRITE = "/img/sprite.svg";
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Глобально переиспользуем промис загрузки YT API
let __ytReadyPromise = null;
function loadYTAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (__ytReadyPromise) return __ytReadyPromise;
  __ytReadyPromise = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => reject(new Error("YT API load failed"));
    document.head.appendChild(tag);
    const t = setTimeout(() => reject(new Error("YT API timeout")), 20000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(t); resolve(); };
  });
  return __ytReadyPromise;
}

function getYouTubeId(url) {
  try {
    const u = new URL(url);
    if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    return m ? m[2] : "";
  } catch { return ""; }
}

// Держим состояние на модалку
const instances = new WeakMap();

/**
 * Подключает мини-плеер к модалке (делегированный клик по .yt)
 * @param {HTMLElement} modalEl
 */
export function createMiniPlayer(modalEl) {
  if (!modalEl || !(modalEl instanceof HTMLElement)) {
    throw new Error("createMiniPlayer: modal element not found/invalid");
  }
  if (instances.has(modalEl)) return; // уже инициализировано

  const dialog = modalEl.querySelector(".amodal__dialog");
  if (!dialog) throw new Error("createMiniPlayer: dialog not found");

  // Док с плеером
  const dock = document.createElement("div");
  dock.className = "am-player";
  dock.innerHTML = `
    <div class="am-player__inner" role="region" aria-label="YouTube mini player">
      <div class="am-player__frame" id="am-player-frame"></div>
      <div class="am-player__bar">
        <a class="am-player__yt" href="#" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
        <div class="am-player__volwrap">
          <button class="am-player__mute" type="button" aria-label="Mute/Unmute">🔈</button>
          <input class="am-player__slider" type="range" min="0" max="100" value="60" step="1" aria-label="Volume">
        </div>
        <button class="am-player__close" type="button" aria-label="Close player">×</button>
      </div>
    </div>`;
  dialog.appendChild(dock);

  const frame    = dock.querySelector(".am-player__frame");
  const openLink = dock.querySelector(".am-player__yt");
  const volWrap  = dock.querySelector(".am-player__volwrap");
  const slider   = dock.querySelector(".am-player__slider");
  const muteBtn  = dock.querySelector(".am-player__mute");
  const closeBtn = dock.querySelector(".am-player__close");

  // Состояние
  const state = {
    player: null,
    currentVol: 60,
    muted: false,
    usingFallback: false,
    lastUrl: "",
  };

  // Делегированный клик по ссылкам .yt внутри модалки
  const onModalClick = (e) => {
    const a = e.target.closest("a.yt");
    if (!a || !modalEl.contains(a)) return;
    e.preventDefault();
    UISound.tap();
    openPlayer(a.href);
  };

  // Закрыть док
  const onClose = () => {
    UISound.tap();
    stopAndHide();
  };

  // Мьют/анмьют
  const onMute = () => {
    UISound.tap();
    state.muted = !state.muted;
    if (!state.usingFallback && state.player) {
      if (state.muted) state.player.mute();
      else state.player.unMute();
    }
    muteBtn.textContent = state.muted ? "🔇" : "🔈";
  };

  // Громкость
  const onVol = () => {
    state.currentVol = Number(slider.value) || 0;
    if (!state.usingFallback && state.player && state.player.setVolume) {
      state.player.setVolume(state.currentVol);
    }
    if (state.currentVol === 0) {
      state.muted = true;
      muteBtn.textContent = "🔇";
      if (!state.usingFallback && state.player?.mute) state.player.mute();
    } else if (state.muted) {
      state.muted = false;
      muteBtn.textContent = "🔈";
      if (!state.usingFallback && state.player?.unMute) state.player.unMute();
    }
  };

  // iOS — аппаратная регулировка
  if (isIOS) {
    slider.disabled = true;
    slider.title = "На iOS громкость регулируется только аппаратно";
  }

  closeBtn.addEventListener("click", onClose);
  muteBtn.addEventListener("click", onMute);
  slider.addEventListener("input", onVol);
  modalEl.addEventListener("click", onModalClick);

  // Храним
  instances.set(modalEl, {
    dock, frame, openLink, volWrap, slider, muteBtn, closeBtn,
    onModalClick, onClose, onMute, onVol, dialog, state
  });

  /* --- helpers внутри createMiniPlayer --- */

  function showDock() {
    dock.classList.add("am-player--active");
  }
  function hideDock() {
    dock.classList.remove("am-player--active");
  }

  // Открыть (или переключить) видео
  async function openPlayer(url) {
    const id = getYouTubeId(url);
    if (!id) { window.__toast?.error?.("Не удалось открыть видео."); return; }
    state.lastUrl = url;
    openLink.href = url;
    showDock();

    try {
      await loadYTAPI();
      // Пересоздаём контейнер YT (чистый div)
      frame.innerHTML = `<div id="am-player-yt"></div>`;
      state.usingFallback = false;

      // Если есть предыдущий экземпляр — уничтожим
      if (state.player) {
        try { state.player.stopVideo?.(); state.player.destroy?.(); } catch {}
        state.player = null;
      }

      state.player = new YT.Player("am-player-yt", {
        host: "https://www.youtube-nocookie.com",
        videoId: id,
        playerVars: {
          autoplay: 1, rel: 0, modestbranding: 1, controls: 1, enablejsapi: 1,
          origin: location.origin
        },
        events: {
          onReady: (e) => {
            if (!isIOS && e.target.setVolume) e.target.setVolume(state.currentVol);
            if (state.muted && e.target.mute) e.target.mute();
          }
        }
      });

      // Пульт громкости виден
      volWrap.style.display = "";

    } catch {
      // Фолбэк — обычный iframe (без программной громкости)
      state.usingFallback = true;
      frame.innerHTML = `
        <iframe
          title="YouTube video player"
          src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&controls=1"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          referrerpolicy="origin-when-cross-origin"
          style="width:100%; height:100%; border:0; display:block"
        ></iframe>`;
      volWrap.style.display = "none";
    }
  }

  function stopAndHide() {
    // Останавливаем и прячем, но док оставляем в DOM
    if (state.player) {
      try { state.player.stopVideo?.(); state.player.destroy?.(); } catch {}
      state.player = null;
    }
    frame.innerHTML = "";
    hideDock();
  }

  // Экспортируем наружу ссылки на методы в instance (на случай нужды)
  instances.get(modalEl).openPlayer = openPlayer;
  instances.get(modalEl).stopAndHide = stopAndHide;
}

/**
 * Полный демонтаж мини-плеера из модалки
 * (вызывается при закрытии модалки)
 * @param {HTMLElement} modalEl
 */
export function destroyMiniPlayer(modalEl) {
  const inst = instances.get(modalEl);
  if (!inst) return;

  // Снять обработчики
  try {
    inst.closeBtn.removeEventListener("click", inst.onClose);
    inst.muteBtn.removeEventListener("click", inst.onMute);
    inst.slider.removeEventListener("input", inst.onVol);
    modalEl.removeEventListener("click", inst.onModalClick);
  } catch {}

  // Остановить и разрушить плеер
  try {
    if (inst.state?.player) {
      inst.state.player.stopVideo?.();
      inst.state.player.destroy?.();
    }
  } catch {}

  // Удалить DOM док
  try { inst.dock.remove(); } catch {}

  instances.delete(modalEl);
}
