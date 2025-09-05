// Кнопка "Radio Menu": кликом открывает поповер под кнопкой, шириной = ширине кнопки.
// Экспорт: installMixRadioMenu(selector, player)

export function installMixRadioMenu(buttonSelector = "#mixradio-menu-btn", player) {
  const btn = document.querySelector(buttonSelector);
  if (!btn || btn.dataset.mrxInited) return;
  btn.dataset.mrxInited = "1";

  // ---- Inline CSS (один раз) ----
  const STYLE_ID = "mixradio-menu-style";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .am-mrx-pop{
        position:fixed; z-index:3000; background:#0f0f10;
        border:1px solid rgba(255,255,255,.12); border-radius:12px;
        box-shadow:0 12px 32px rgba(0,0,0,.4); padding:8px; color:#e8e8ec;
        font:500 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif
      }
      .am-mrx-pop__grp{padding:6px 6px 4px 6px}
      .am-mrx-pop__hdr{font-weight:700;color:#fff;margin:4px 6px 6px}
      .am-mrx-pop__btn{display:flex;align-items:center;gap:8px;width:100%;
        padding:8px 10px;border:0;background:transparent;color:#e8e8ec;border-radius:8px;cursor:pointer}
      .am-mrx-pop__btn:hover,.am-mrx-pop__btn:focus-visible{background:rgba(255,255,255,.08);outline:none}
      .am-mrx-pop__sep{height:1px;background:rgba(255,255,255,.12);margin:6px 0}
      .am-mrx-pop__row{display:flex;gap:6px;flex-wrap:wrap}
      .am-mrx-pop__chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);
        background:transparent;color:#fff;cursor:pointer}
      .am-mrx-pop__chip:hover,.am-mrx-pop__chip:focus-visible{background:rgba(255,255,255,.08);outline:none}
      .am-mrx-pop__muted{opacity:.8}
    `;
    document.head.appendChild(st);
  }

  let pop = null;
  let sleepTimer = null;

  function closePop() {
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    pop = null;
    document.removeEventListener("click", onDocClick, true);
    window.removeEventListener("scroll", placeUnderButton);
    window.removeEventListener("resize", placeUnderButton);
    document.removeEventListener("keydown", onEsc);
  }
  function onEsc(e){ if(e.key==="Escape") closePop(); }
  function onDocClick(e){
    if (!pop) return;
    if (e.target === btn) return;          // повторный клик по кнопке — пусть обрабатывается её хэндлером
    if (!pop.contains(e.target)) closePop();
  }

  function placeUnderButton() {
    if (!pop) return;
    const r = btn.getBoundingClientRect();
    const w = Math.max(160, Math.round(r.width));
    pop.style.width = w + "px";
    pop.style.minWidth = w + "px";

    const vw = window.innerWidth;
    const px8 = 8;
    const left = Math.min(Math.max(px8, r.left), vw - w - px8);
    const top  = r.bottom + 6;

    // ВАЖНО: позиционирование fixed — координаты по вьюпорту, БЕЗ скролл-офсетов
    pop.style.left = left + "px";
    pop.style.top  = top + "px";
  }

  function setSleep(minutes) {
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
    if (!minutes) { closePop(); return; }
    sleepTimer = setTimeout(() => {
      try {
        if (player?.pause) player.pause();
        else if (player?.stop) player.stop();
        else if (player?.close) player.close();
      } catch {}
      sleepTimer = null;
    }, minutes * 60 * 1000);
    closePop();
  }

  function clickGenre(name) {
    const li =
      document.querySelector(`#dd-genre-list li[data-val="${name}"]`) ||
      Array.from(document.querySelectorAll("#dd-genre-list li"))
        .find(x => (x.textContent||"").trim().toLowerCase() === String(name).toLowerCase());
    if (li) li.click();
    closePop();
  }

  function buildPop() {
    closePop();
    pop = document.createElement("div");
    pop.className = "am-mrx-pop";
    pop.innerHTML = `
      <div class="am-mrx-pop__grp">
        <div class="am-mrx-pop__hdr">Popular styles</div>
        <div class="am-mrx-pop__row">
          ${["Pop","Rock","Jazz","Hip-Hop","Electronic","Classical"].map(g =>
            `<button type="button" class="am-mrx-pop__chip" data-genre="${g}">${g}</button>`
          ).join("")}
        </div>
      </div>
      <div class="am-mrx-pop__sep"></div>
      <div class="am-mrx-pop__grp">
        <div class="am-mrx-pop__hdr">Sleep timer</div>
        <button type="button" class="am-mrx-pop__btn" data-sleep="20">Stop after 20 min</button>
        <button type="button" class="am-mrx-pop__btn" data-sleep="40">Stop after 40 min</button>
        <button type="button" class="am-mrx-pop__btn" data-sleep="60">Stop after 60 min</button>
        <button type="button" class="am-mrx-pop__btn am-mrx-pop__muted" data-sleep="0">Cancel timer</button>
      </div>
    `;
    document.body.appendChild(pop);

    pop.addEventListener("click", (e) => {
      const chip = e.target.closest(".am-mrx-pop__chip");
      if (chip) { clickGenre(chip.dataset.genre); return; }
      const b = e.target.closest("[data-sleep]");
      if (b) { setSleep(Number(b.dataset.sleep) || 0); return; }
    });

    // позиционируем и подписываемся на изменения
    requestAnimationFrame(placeUnderButton);
    window.addEventListener("scroll", placeUnderButton, { passive: true });
    window.addEventListener("resize", placeUnderButton);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onEsc);
  }

  // Клик по кнопке — открыть/закрыть
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    if (pop) { closePop(); return; }
    buildPop();
  });
}
