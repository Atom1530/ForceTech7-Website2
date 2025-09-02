
let box = null;

function ensureBox() {
  if (box) return box;
  box = document.createElement("div");
  box.className = "toast-container";
  document.body.appendChild(box);
  return box;
}

function show(message, kind = "info", timeout = 3000) {
  ensureBox();
  const item = document.createElement("div");
  item.className = `toast toast--${kind}`;
  item.setAttribute("role", "status");
  item.textContent = String(message || "");
  box.appendChild(item);

  const t = setTimeout(() => hide(item), timeout);
  item.addEventListener("click", () => { clearTimeout(t); hide(item); });
}

function hide(item) {
  item.classList.add("toast--hide");
  item.addEventListener("animationend", () => item.remove(), { once: true });
}

export const toast = {
  show,
  info: (m, t) => show(m, "info", t),
  success: (m, t) => show(m, "success", t),
  error: (m, t) => show(m, "error", t),
};

// Для обратной совместимости, если что-то ещё дергает window.__toast
if (!window.__toast) window.__toast = toast;

export default toast;
