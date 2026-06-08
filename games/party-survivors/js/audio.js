// ============================================================
// Audio — syntetické SFX přes WebAudio (žádné externí soubory)
// Mute: klávesa M (persistuje v localStorage)
// ============================================================
window.PS = window.PS || {};

PS.Audio = {
  ctx: null,
  muted: (() => {
    try { return localStorage.getItem('ps_muted') === '1'; } catch (e) { return false; }
  })(),
  hitThrottle: 0,

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('ps_muted', m ? '1' : '0'); } catch (e) { /* private mode */ }
  },

  // základní tón s envelope, volitelný sklouznutí frekvence
  tone(freq, dur = 0.1, type = 'square', vol = 0.12, slideTo = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  },

  seq(notes, step = 0.08, type = 'square', vol = 0.11) {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, step * 1.5, type, vol), i * step * 1000));
  },

  // ---------- konkrétní zvuky ----------
  ui() { this.tone(660, 0.04, 'square', 0.04); },
  select() { this.tone(880, 0.07, 'square', 0.07, 1100); },
  gem() { this.tone(880, 0.06, 'square', 0.05, 1320); },
  kill() { this.tone(220, 0.08, 'triangle', 0.09, 80); },
  hit() {
    const t = performance.now();
    if (t - this.hitThrottle < 60) return; // zásahy létají často — šetříme uši
    this.hitThrottle = t;
    this.tone(160, 0.04, 'sawtooth', 0.04, 100);
  },
  playerHit() { this.tone(110, 0.18, 'sawtooth', 0.18, 55); },
  levelup() { this.seq([523, 659, 784, 1047], 0.08, 'square', 0.11); },
  runda() { this.seq([392, 523, 659, 784, 1047, 1319], 0.09, 'square', 0.1); }, // fanfára Rundy panclů
  powerup() { this.seq([784, 988, 1175], 0.07, 'triangle', 0.13); },
  boss() {
    this.tone(98, 0.5, 'sawtooth', 0.2, 196);
    setTimeout(() => this.tone(98, 0.5, 'sawtooth', 0.2, 196), 550);
  },
  horde() { // varování před velkou hordou — krátký nízký growl
    this.tone(150, 0.26, 'sawtooth', 0.16, 72);
    setTimeout(() => this.tone(116, 0.30, 'sawtooth', 0.15, 60), 150);
  },
  bossDead() { this.seq([1047, 784, 1047, 1319], 0.09, 'square', 0.13); },
  death() { this.seq([392, 330, 262, 196, 131], 0.16, 'triangle', 0.16); },
};
