
// Оверлей зума: без искажений на моб/таб + pinch/zoom/pan + колесо/двойной клик

let overlay, dialogEl, stageEl, imgEl, linkEl, closeBtn, backdropEl;
let isPanning = false, startX = 0, startY = 0, curX = 0, curY = 0, scale = 1;
let baseW = 0, baseH = 0, stageW = 0, stageH = 0;
const activePointers = new Map();
let pinchActive = false, pinchBaseDist = 0, pinchBaseScale = 1;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/* ---------- ensure ---------- */
function ensureZoom() {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "am-zoom";
  overlay.innerHTML = `
    <div class="am-zoom__backdrop"></div>
    <div class="am-zoom__dialog" role="dialog" aria-modal="true" aria-label="Image preview">
      <div class="am-zoom__stage">
        <img class="am-zoom__img" alt="">
      </div>
      <div class="am-zoom__bar">
        <a class="am-zoom__open" href="#" target="_blank" rel="noopener noreferrer">Open original ↗</a>
        <button class="am-zoom__close" type="button" aria-label="Close">×</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // базовые стилевые фолбэки (если вдруг профильный CSS не подключен)
  Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "6000", display: "none" });
  dialogEl = overlay.querySelector(".am-zoom__dialog");
  Object.assign(dialogEl.style, {
    position: "absolute", inset: "0", display: "grid",
    gridTemplateRows: "1fr auto", gap: "12px", padding: "16px"
  });

  backdropEl = overlay.querySelector(".am-zoom__backdrop");
  Object.assign(backdropEl.style, { position: "absolute", inset: "0", background: "rgba(0,0,0,.7)" });

  stageEl = overlay.querySelector(".am-zoom__stage");
  Object.assign(stageEl.style, {
    position: "relative",
    background: "#000",
    borderRadius: "12px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "240px",
    height: "calc(100vh - 140px)",
    touchAction: "none" // жесты — нашими руками
  });

  imgEl = overlay.querySelector(".am-zoom__img");
  // важные анти-искажения + перехват global img{height:100%}
  imgEl.style.maxWidth = "100%";
  imgEl.style.maxHeight = "100%";
  imgEl.style.width = "auto";
  imgEl.style.setProperty("height", "auto", "important");
  imgEl.style.objectFit = "contain";
  imgEl.style.transformOrigin = "center center";
  imgEl.style.willChange = "transform";
  imgEl.style.userSelect = "none";
  imgEl.style.webkitUserDrag = "none";
  imgEl.style.pointerEvents = "auto";

  const bar = overlay.querySelector(".am-zoom__bar");
  Object.assign(bar.style, {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", gap: "12px"
  });

  linkEl = overlay.querySelector(".am-zoom__open");
  linkEl.style.color = "#fff";
  closeBtn = overlay.querySelector(".am-zoom__close");
  Object.assign(closeBtn.style, {
    width: "40px", height: "40px", borderRadius: "10px",
    border: "none", background: "var(--color-affair, #764191)", color: "#fff", cursor: "pointer"
  });

  // события
  backdropEl.addEventListener("click", closeZoom);
  closeBtn.addEventListener("click", closeZoom);

  overlay.addEventListener("wheel", onWheel, { passive: false });
  imgEl.addEventListener("dblclick", toggleZoom);

  imgEl.addEventListener("pointerdown", onPointerDown);
  imgEl.addEventListener("pointermove", onPointerMove);
  imgEl.addEventListener("pointerup", onPointerUpCancel);
  imgEl.addEventListener("pointercancel", onPointerUpCancel);

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isZoomOpen()) closeZoom(); });
  window.addEventListener("resize", () => { if (isZoomOpen()) { measureStage(); applyTransform(); } });
}

/* ---------- measurements ---------- */
function measureBase() {
  const prev = imgEl.style.transform;
  imgEl.style.transform = "translate3d(0,0,0) scale(1)";
  const r = imgEl.getBoundingClientRect();
  imgEl.style.transform = prev;
  baseW = r.width; baseH = r.height;
}
function measureStage() {
  const s = stageEl.getBoundingClientRect();
  stageW = s.width; stageH = s.height;
}
function clampPan() {
  if (!baseW || !baseH || !stageW || !stageH) return;
  const contentW = baseW * scale, contentH = baseH * scale;
  if (contentW <= stageW) curX = 0;
  else { const maxX = (contentW - stageW) / 2; curX = clamp(curX, -maxX, maxX); }
  if (contentH <= stageH) curY = 0;
  else { const maxY = (contentH - stageH) / 2; curY = clamp(curY, -maxY, maxY); }
}
function applyTransform() {
  clampPan();
  imgEl.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${scale})`;
  imgEl.style.cursor = scale > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in";
}

/* ---------- API ---------- */
export function openZoom(src, alt = "") {
  if (!src) return;
  ensureZoom();

  // сброс состояния
  activePointers.clear();
  pinchActive = false; pinchBaseDist = 0; pinchBaseScale = 1;
  isPanning = false; startX = startY = 0; curX = curY = 0; scale = 1;

  imgEl.src = src;
  imgEl.alt = alt || "";
  linkEl.href = src;

  overlay.style.display = "block";

  const doMeasure = () => { measureStage(); measureBase(); clampPan(); applyTransform(); };
  if (imgEl.complete && imgEl.naturalWidth > 0) requestAnimationFrame(doMeasure);
  else imgEl.onload = () => requestAnimationFrame(doMeasure);
}

export function closeZoom() {
  if (!overlay) return;
  overlay.style.display = "none";
  imgEl.src = "";
  activePointers.clear();
  pinchActive = false;
}

export function isZoomOpen() {
  return !!(overlay && overlay.style.display !== "none");
}

/* ---------- gestures ---------- */
function toggleZoom() {
  const prev = scale;
  scale = prev > 1 ? 1 : 2;
  if (scale === 1) { curX = 0; curY = 0; }
  applyTransform();
}
function onWheel(e) {
  if (!isZoomOpen()) return;
  e.preventDefault();
  const newScale = clamp(scale + (e.deltaY > 0 ? -0.15 : 0.15), 1, 3);

  const rect = imgEl.getBoundingClientRect();
  const pivot = { x: e.clientX, y: e.clientY };
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const factor = newScale / scale;
  curX += (center.x - pivot.x) * (1 - factor);
  curY += (center.y - pivot.y) * (1 - factor);

  scale = newScale;
  if (scale === 1) { curX = 0; curY = 0; }
  applyTransform();
}
function onPointerDown(e) {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  imgEl.setPointerCapture(e.pointerId);

  if (activePointers.size === 2) {
    const [p1, p2] = Array.from(activePointers.values());
    pinchActive = true;
    pinchBaseDist = dist(p1, p2) || 1;
    pinchBaseScale = scale;
    isPanning = false;
    return;
  }
  if (activePointers.size === 1 && scale > 1) {
    isPanning = true;
    startX = e.clientX - curX;
    startY = e.clientY - curY;
    applyTransform();
  }
}
function onPointerMove(e) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinchActive && activePointers.size >= 2) {
    const [p1, p2] = Array.from(activePointers.values());
    const d = dist(p1, p2) || 1;
    let newScale = clamp(pinchBaseScale * (d / pinchBaseDist), 1, 3);

    const mid = midpoint(p1, p2);
    const rect = imgEl.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const factor = newScale / scale;
    curX += (center.x - mid.x) * (1 - factor);
    curY += (center.y - mid.y) * (1 - factor);

    scale = newScale;
    if (scale === 1) { curX = 0; curY = 0; }
    applyTransform();
    return;
  }

  if (isPanning && activePointers.size === 1 && scale > 1) {
    curX = e.clientX - startX;
    curY = e.clientY - startY;
    applyTransform();
  }
}
function onPointerUpCancel(e) {
  if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);
  try { imgEl.releasePointerCapture(e.pointerId); } catch {}
  if (activePointers.size < 2) { pinchActive = false; pinchBaseDist = 0; }
  if (activePointers.size === 0) { isPanning = false; applyTransform(); }
}
