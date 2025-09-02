// src/js/artists/features/zoom.js
import { UISound } from "../lib/sound.js";

let overlay = null;
let imgEl = null;
let linkEl = null;
let stageEl = null;

// pan/zoom state
let isPanning = false;
let startX = 0, startY = 0;
let curX = 0, curY = 0;
let scale = 1;

// pinch state
const pointers = new Map(); // id -> {x,y}
let pinchActive = false;
let pinchBaseDist = 0;
let pinchBaseScale = 1;

// bounds at scale=1
let baseW = 0, baseH = 0;
let stageW = 0, stageH = 0;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const midpoint = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });

function ensureOverlay() {
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

  imgEl   = overlay.querySelector(".am-zoom__img");
  linkEl  = overlay.querySelector(".am-zoom__open");
  stageEl = overlay.querySelector(".am-zoom__stage");

  overlay.querySelector(".am-zoom__backdrop").addEventListener("click", () => { UISound.tap(); closeZoom(); });
  overlay.querySelector(".am-zoom__close").addEventListener("click", () => { UISound.tap(); closeZoom(); });

  // gestures
  imgEl.addEventListener("dblclick", () => { UISound.tap(); toggleZoom(); });
  overlay.addEventListener("wheel", onWheel, { passive: false });
  imgEl.addEventListener("pointerdown", onPointerDown);
  imgEl.addEventListener("pointermove", onPointerMove);
  imgEl.addEventListener("pointerup", onPointerUpCancel);
  imgEl.addEventListener("pointercancel", onPointerUpCancel);

  // esc key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isZoomActive()) {
      UISound.tap();
      closeZoom();
    }
  });

  // keep bounds on resize
  window.addEventListener("resize", () => {
    if (!isZoomActive()) return;
    measureStage();
    applyTransform();
  });
}

function measureBase() {
  // measure at scale=1
  const prev = imgEl.style.transform;
  imgEl.style.transform = "translate3d(0,0,0) scale(1)";
  const r = imgEl.getBoundingClientRect();
  imgEl.style.transform = prev;
  baseW = r.width;
  baseH = r.height;
}
function measureStage() {
  const r = stageEl.getBoundingClientRect();
  stageW = r.width;
  stageH = r.height;
}

function clampPan() {
  if (!baseW || !baseH || !stageW || !stageH) return;
  const w = baseW * scale;
  const h = baseH * scale;

  if (w <= stageW) curX = 0;
  else {
    const maxX = (w - stageW) / 2;
    curX = clamp(curX, -maxX, maxX);
  }

  if (h <= stageH) curY = 0;
  else {
    const maxY = (h - stageH) / 2;
    curY = clamp(curY, -maxY, maxY);
  }
}

function applyTransform() {
  clampPan();
  imgEl.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${scale})`;
  imgEl.style.cursor = scale > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in";
}

function toggleZoom() {
  scale = scale > 1 ? 1 : 2;
  if (scale === 1) { curX = 0; curY = 0; }
  applyTransform();
}

function onWheel(e) {
  if (!isZoomActive()) return;
  e.preventDefault();

  const newScale = clamp(scale + (e.deltaY > 0 ? -0.15 : 0.15), 1, 3);
  const rect = imgEl.getBoundingClientRect();
  const pivot = { x: e.clientX, y: e.clientY };
  const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  const factor = newScale / scale;

  curX += (center.x - pivot.x) * (1 - factor);
  curY += (center.y - pivot.y) * (1 - factor);

  scale = newScale;
  if (scale === 1) { curX = 0; curY = 0; }
  applyTransform();
}

function onPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  imgEl.setPointerCapture(e.pointerId);

  if (pointers.size === 2) {
    const [p1, p2] = Array.from(pointers.values());
    pinchActive = true;
    pinchBaseDist = dist(p1, p2) || 1;
    pinchBaseScale = scale;
    isPanning = false;
    return;
  }
  if (pointers.size === 1 && scale > 1) {
    isPanning = true;
    startX = e.clientX - curX;
    startY = e.clientY - curY;
    applyTransform();
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinchActive && pointers.size >= 2) {
    const values = Array.from(pointers.values());
    const p1 = values[0], p2 = values[1];
    const d = dist(p1, p2) || 1;
    let newScale = clamp(pinchBaseScale * (d / pinchBaseDist), 1, 3);

    const mid = midpoint(p1, p2);
    const rect = imgEl.getBoundingClientRect();
    const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
    const factor = newScale / scale;

    curX += (center.x - mid.x) * (1 - factor);
    curY += (center.y - mid.y) * (1 - factor);

    scale = newScale;
    if (scale === 1) { curX = 0; curY = 0; }
    applyTransform();
    return;
  }

  if (isPanning && pointers.size === 1 && scale > 1) {
    curX = e.clientX - startX;
    curY = e.clientY - startY;
    applyTransform();
  }
}

function onPointerUpCancel(e) {
  if (pointers.has(e.pointerId)) pointers.delete(e.pointerId);
  try { imgEl.releasePointerCapture(e.pointerId); } catch {}
  if (pointers.size < 2) { pinchActive = false; pinchBaseDist = 0; }
  if (pointers.size === 0) { isPanning = false; applyTransform(); }
}

/* ============ ПУБЛИЧНЫЕ API ============ */
export function isZoomActive() {
  return !!(overlay && overlay.classList.contains("am-zoom--active"));
}

export function openZoom(src, alt = "") {
  if (!src) return;
  ensureOverlay();

  // reset state
  pointers.clear();
  pinchActive = false;
  pinchBaseDist = 0;
  pinchBaseScale = 1;
  isPanning = false;
  startX = startY = 0;
  curX = curY = 0;
  scale = 1;

  imgEl.src = src;
  imgEl.alt = alt || "";
  linkEl.href = src;

  applyTransform();

  const doMeasure = () => {
    measureStage();
    measureBase();
    clampPan();
    applyTransform();
  };
  if (imgEl.complete) requestAnimationFrame(doMeasure);
  else imgEl.onload = () => requestAnimationFrame(doMeasure);

  overlay.classList.add("am-zoom--active");
}

export function closeZoom() {
  if (!overlay) return;
  overlay.classList.remove("am-zoom--active");
  imgEl.src = "";
  pointers.clear();
  pinchActive = false;
}

