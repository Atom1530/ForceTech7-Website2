// ГЛОБАЛЬНЫЕ SFX ДЛЯ ВСЕГО САЙТА
// Подключите один раз в main.js:  import "./js/global-sfx.js";
import { UISound } from "./artists/lib/sound.js"; // путь под ваш проект

// ===== Конфиг =====
const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'summary',
  '.sfx-click'          // опциональный «маркер-класс»
].join(',');

// Где НЕ играть (ползунки, драг-зоны и т.п.)
const IGNORE_SELECTOR = [
  '.no-sfx',
  '[data-sfx="off"]',
  '[disabled],[aria-disabled="true"]',
  'input[type="range"]',
  '.am-player__dragzone', // ваша верхняя зона перетаскивания плеера
].join(',');

// ===== Сервис =====
const SFX = {
  enabled: localStorage.getItem('sfx') !== 'off',
  lastAt: 0,
  playOnce() {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastAt < 80) return; // анти-дубль
    this.lastAt = now;
    try {
      UISound?.tap?.(); // ваш текущий звук
    } catch {
      // Фолбэк мини-бипом (если вдруг UISound не инициализирован)
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = 660;
        g.gain.setValueAtTime(0.06, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
        o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.07);
      } catch {}
    }
  },
};

// Глобальный обработчик кликов
document.addEventListener('click', (e) => {
  // только «настоящие» левые клики
  if (!e.isTrusted || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return;

  const el = e.target.closest(CLICKABLE_SELECTOR);
  if (!el) return;
  if (el.matches(IGNORE_SELECTOR)) return;

  // Если элемент тащили (drag), браузер обычно не кидает click — но на всякий случай:
  if (Math.abs((e.movementX || 0)) > 2 || Math.abs((e.movementY || 0)) > 2) return;

  SFX.playOnce();
}, { capture: true });

// Клавиатурная активация (Enter/Space) — для a11y
document.addEventListener('keydown', (e) => {
  if (!SFX.enabled) return;
  if (!(e.key === 'Enter' || e.key === ' ')) return;

  const el = e.target.closest(CLICKABLE_SELECTOR);
  if (!el || el.matches(IGNORE_SELECTOR)) return;

  SFX.playOnce();
}, { capture: true });

// Публичный тумблер (можно привязать к настройкам)
window.SFX = {
  enable()  { SFX.enabled = true;  localStorage.setItem('sfx', 'on');  },
  disable() { SFX.enabled = false; localStorage.setItem('sfx', 'off'); },
  toggle()  { SFX.enabled ? this.disable() : this.enable(); },
};
