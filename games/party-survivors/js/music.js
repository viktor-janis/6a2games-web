// ============================================================
// Hudba na pozadí — JEN ve hře (GameScene), NÁHODNÉ pořadí, CROSSFADE
// vždy až na konci tracku (ne v půlce). Streamuje přes 2 HTML5 Audio
// elementy (nestáhne se vše naráz — track se načítá, až když má hrát).
//
// - běží i přes pauzu / level-up (to jen `scene.pause('Game')`) → žádné
//   trhání při častých level-upech; zastaví se až při ukončení hry
//   (GameScene 'shutdown' = smrt / odchod do menu).
// - respektuje mute (klávesa M → PS.Audio.muted) — ztlumí se živě.
// - náhodně: další track je vždy jiný než právě hraný (žádný pevný playlist).
// ============================================================
window.PS = window.PS || {};

PS.Music = {
  vol: 0.225,       // cílová hlasitost (sedí pod SFX)
  crossfade: 4.5,   // s — překryv (crossfade) na konci tracku
  fadeIn: 2.0,      // s — náběh úplně prvního tracku
  preloadLead: 7,   // s před koncem začni přednačítat další track

  els: null,
  active: false,
  cur: 0,           // index aktivního Audio elementu (0/1)
  curTrack: -1,     // index právě hraného tracku v PS.MUSIC
  nextTrack: -1,    // přednačtený další (−1 = zatím nevybrán)
  state: 'idle',    // idle | fadein | playing | crossfade
  t0: 0,            // začátek aktuální fáze (performance.now)
  raf: null,

  _init() {
    if (this.els) return;
    this.els = [new Audio(), new Audio()];
    this.els.forEach((a) => { a.preload = 'auto'; a.loop = false; a.volume = 0; });
  },
  _muted() { return !!(window.PS.Audio && PS.Audio.muted); },
  _target() { return this._muted() ? 0 : this.vol; },

  // náhodný index tracku ≠ exclude (žádné dvě stejné po sobě)
  _rand(exclude) {
    const n = PS.MUSIC.length;
    if (n <= 1) return 0;
    let i;
    do { i = (Math.random() * n) | 0; } while (i === exclude);
    return i;
  },

  // nastav zdroj jen když už není nahraný (ať se zbytečně nestahuje znovu) + přehraj
  _cue(el, idx) {
    const url = PS.MUSIC[idx];
    if (!el.src || el.src.indexOf(url) === -1) el.src = url;
    try { el.currentTime = 0; } catch (e) { /* ještě bez metadat */ }
    const p = el.play();
    if (p && p.catch) p.catch(() => { /* autoplay blok — start je ale po kliknutí */ });
  },

  // ---------- veřejné API (volá GameScene) ----------
  start() {
    if (!window.PS.MUSIC || !PS.MUSIC.length) return;
    this._init();
    if (this.active) return;
    this.active = true;
    this.cur = 0;
    this.curTrack = this._rand(-1);
    this.nextTrack = -1;
    this.els[1].pause();
    const a = this.els[this.cur];
    a.volume = 0;
    this._cue(a, this.curTrack);
    a.onended = () => this._forceNext();
    this.state = 'fadein';
    this.t0 = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(() => this._tick());
  },

  stop() {
    this.active = false;
    this.state = 'idle';
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    if (this.els) this.els.forEach((a) => {
      a.onended = null;
      try { a.pause(); a.currentTime = 0; } catch (e) { /* noop */ }
    });
    this.curTrack = this.nextTrack = -1;
  },

  // ---------- vnitřní ----------
  // nouzový tvrdý přechod (track skončí dřív, než stihne crossfade — např.
  // neznámá délka). Normálně se nepoužije, crossfade naběhne před koncem.
  _forceNext() {
    if (!this.active) return;
    const idx = this._rand(this.curTrack);
    this.els[this.cur].onended = null;
    try { this.els[this.cur].pause(); } catch (e) { /* noop */ }
    this.cur = 1 - this.cur;
    this.curTrack = idx;
    this.nextTrack = -1;
    const a = this.els[this.cur];
    a.volume = this._target();
    this._cue(a, idx);
    a.onended = () => this._forceNext();
    this.state = 'playing';
    this.t0 = performance.now();
  },

  _tick() {
    if (!this.active) { this.raf = null; return; }
    const now = performance.now();
    const a = this.els[this.cur];      // aktivní (při crossfade odcházející) track
    const tgt = this._target();

    if (this.state === 'fadein') {
      a.volume = tgt * Math.min(1, (now - this.t0) / (this.fadeIn * 1000));
      if (now - this.t0 >= this.fadeIn * 1000) this.state = 'playing';

    } else if (this.state === 'playing') {
      a.volume = tgt; // živá reakce na mute (M)
      const dur = a.duration;
      if (dur && isFinite(dur)) {
        // přednačti další track s rezervou (ať crossfade nemá díru)
        if (this.nextTrack < 0 && a.currentTime >= dur - this.crossfade - this.preloadLead) {
          this.nextTrack = this._rand(this.curTrack);
          const b = this.els[1 - this.cur];
          b.src = PS.MUSIC[this.nextTrack];
          try { b.load(); } catch (e) { /* noop */ }
        }
        // crossfade VŽDY až na konci tracku
        if (a.currentTime >= dur - this.crossfade) {
          if (this.nextTrack < 0) this.nextTrack = this._rand(this.curTrack);
          const b = this.els[1 - this.cur];
          b.volume = 0;
          this._cue(b, this.nextTrack);
          a.onended = null;               // odcházející: jeho konec už přechod neřeší
          b.onended = () => this._forceNext();
          this.state = 'crossfade';
          this.t0 = now;
        }
      }

    } else if (this.state === 'crossfade') {
      const b = this.els[1 - this.cur];
      const p = Math.min(1, (now - this.t0) / (this.crossfade * 1000));
      a.volume = tgt * (1 - p);
      b.volume = tgt * p;
      if (p >= 1) {
        try { a.pause(); a.currentTime = 0; } catch (e) { /* noop */ }
        this.cur = 1 - this.cur;
        this.curTrack = this.nextTrack;
        this.nextTrack = -1;
        this.state = 'playing';
      }
    }
    this.raf = requestAnimationFrame(() => this._tick());
  },
};
