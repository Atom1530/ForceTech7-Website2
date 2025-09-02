
// Мягкий «клац» (tap) и чуть иной звук для пагинации (page)
let ctx, master, comp, postLP;
let inited = false;

function init() {
  if (inited) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -26;
  comp.knee.value = 22;
  comp.ratio.value = 6;
  comp.attack.value = 0.004;
  comp.release.value = 0.08;

  postLP = ctx.createBiquadFilter();
  postLP.type = "lowpass";
  postLP.frequency.value = 2300;
  postLP.Q.value = 0.6;

  master = ctx.createGain();
  master.gain.value = 0.11;

  master.connect(postLP);
  postLP.connect(comp);
  comp.connect(ctx.destination);

  // Разблокировка на первом жесте
  const unlock = () => {
    try { ctx.resume(); } catch {}
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });

  inited = true;
}

function resume() { if (ctx && ctx.state === "suspended") ctx.resume(); }

function tap() {
  if (!inited) init();
  if (!ctx) return;
  resume();
  const now = ctx.currentTime + 0.004;

  // шумовой щелчок
  const durNoise = 0.055;
  const nsrc = ctx.createBufferSource();
  const nbuf = ctx.createBuffer(1, Math.max(32, (ctx.sampleRate * durNoise) | 0), ctx.sampleRate);
  const ch = nbuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) {
    const t = i / ch.length;
    ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
  }
  nsrc.buffer = nbuf;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 2050; bp.Q.value = 0.9;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 360; hp.Q.value = 0.7;

  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.linearRampToValueAtTime(0.45, now + 0.004);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

  nsrc.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(master);
  nsrc.start(now); nsrc.stop(now + 0.06);

  // лёгкий верхний обертон
  const osc = ctx.createOscillator();
  osc.type = "triangle"; osc.frequency.setValueAtTime(2100, now);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.linearRampToValueAtTime(0.20, now + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(og); og.connect(master);
  osc.start(now); osc.stop(now + 0.055);

  // чуть «тела»
  const low = ctx.createOscillator();
  low.type = "sine"; low.frequency.setValueAtTime(165, now);
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0.0001, now);
  lg.gain.linearRampToValueAtTime(0.05, now + 0.003);
  lg.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
  low.connect(lg); lg.connect(master);
  low.start(now); low.stop(now + 0.045);
}

function page() {
  if (!inited) init();
  if (!ctx) return;
  resume();
  const now = ctx.currentTime + 0.003;
  const osc = ctx.createOscillator();
  osc.type = "triangle"; osc.frequency.setValueAtTime(1750, now);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.17, now + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(g); g.connect(master);
  osc.start(now); osc.stop(now + 0.065);
}

export const UISound = { tap, page };
export default UISound;
