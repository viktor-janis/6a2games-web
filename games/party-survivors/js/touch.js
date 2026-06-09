// ============================================================
// PS.Touch — plovoucí joystick (styl Vampire Survivors) + sdílený stav pohybu
// ------------------------------------------------------------
// Joystick se objeví tam, kam hráč ťukne; palec sleduje prst; puštění = stop.
// Ovládá JEN pohyb (útoky jsou automatické). Pohyb je plnou rychlostí ve směru
// výchylky (za dead-zonou), stejně jako u originálu — ne analogové škálování.
// Hostuje HUDScene (attach na začátku hry, detach při shutdown).
// GameScene.movePlayer() čte PS.Touch.vec (jednotkový směr) když PS.Touch.active.
// ============================================================
window.PS = window.PS || {};

// Dotykové volby (velikost/průhlednost joysticku) — localStorage ps_touch
PS.TouchCfg = {
  defaults: { size: 1, opacity: 0.5 }, // size = násobek základního poloměru
  load() {
    try {
      const raw = localStorage.getItem(PS.STORAGE.touch);
      return Object.assign({}, this.defaults, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, this.defaults); }
  },
  save(cfg) {
    try { localStorage.setItem(PS.STORAGE.touch, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  },
};

PS.Touch = {
  vec: { x: 0, y: 0 }, // jednotkový směr pohybu (0 = stůj) — čte GameScene.movePlayer()
  active: false,

  _scene: null,
  _pointerId: -1,
  _baseX: 0, _baseY: 0,
  _R: 90,            // poloměr výchylky v herních px (škáluje se cfg.size)
  _dead: 0.18,       // dead-zone jako podíl R
  _opacity: 0.5,
  _gfx: null,
  _enabled: true,

  // Připojit k hostující scéně (HUD): grafika + input handlery.
  attach(scene) {
    this.detach();
    this._scene = scene;
    this._enabled = true;
    const cfg = PS.TouchCfg.load();
    this._R = 90 * (cfg.size || 1);
    this._opacity = cfg.opacity != null ? cfg.opacity : 0.5;
    this.reset();

    this._gfx = scene.add.graphics().setDepth(900).setScrollFactor(0).setVisible(false);

    scene.input.addPointer(2); // multitouch: joystick + případné ťuknutí na tlačítko
    scene.input.on('pointerdown', this._down, this);
    scene.input.on('pointermove', this._move, this);
    scene.input.on('pointerup', this._up, this);
    scene.input.on('pointerupoutside', this._up, this);
    scene.events.once('shutdown', () => this.detach());
  },

  detach() {
    const s = this._scene;
    if (s && s.input) {
      s.input.off('pointerdown', this._down, this);
      s.input.off('pointermove', this._move, this);
      s.input.off('pointerup', this._up, this);
      s.input.off('pointerupoutside', this._up, this);
    }
    if (this._gfx) { this._gfx.destroy(); this._gfx = null; }
    this._scene = null;
    this.reset();
  },

  reset() {
    this.active = false;
    this.vec.x = 0; this.vec.y = 0;
    this._pointerId = -1;
    if (this._gfx) this._gfx.setVisible(false);
  },

  setEnabled(on) {
    this._enabled = on;
    if (!on) this.reset();
  },

  _isTouch(p) { return p && (p.pointerType === 'touch' || p.wasTouch); },

  // joystick neaktivní mimo hru / během pauzy / overlayů
  _blocked() {
    const s = this._scene;
    if (!s || !this._enabled) return true;
    const g = s.scene.get('Game');
    if (!g || g.over) return true;
    if (s.paused) return true;
    if (s.scene.isActive('LevelUp') || s.scene.isActive('Runda')) return true;
    return false;
  },

  _down(pointer, currentlyOver) {
    if (this._blocked()) return;
    if (this._pointerId !== -1) return;            // jeden „pohybový" prst
    if (!this._isTouch(pointer)) return;            // myš na PC nech klávesnici
    if (currentlyOver && currentlyOver.length) return; // ťuknutí na HUD tlačítko

    this._pointerId = pointer.id;
    this.active = true;
    this._baseX = pointer.x; this._baseY = pointer.y;
    this.vec.x = 0; this.vec.y = 0;
    this._draw(this._baseX, this._baseY);
  },

  _move(pointer) {
    if (pointer.id !== this._pointerId) return;
    let dx = pointer.x - this._baseX, dy = pointer.y - this._baseY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this._R);
    if (dist > 0) { dx /= dist; dy /= dist; }
    if (clamped / this._R < this._dead) { this.vec.x = 0; this.vec.y = 0; }
    else { this.vec.x = dx; this.vec.y = dy; } // jednotkový směr = plná rychlost
    this._draw(this._baseX + dx * clamped, this._baseY + dy * clamped);
  },

  _up(pointer) {
    if (pointer.id !== this._pointerId) return;
    this.reset();
  },

  _draw(thumbX, thumbY) {
    const g = this._gfx;
    if (!g) return;
    const a = this._opacity, R = this._R;
    g.clear().setVisible(true);
    g.fillStyle(0x00ffff, a * 0.12).fillCircle(this._baseX, this._baseY, R);
    g.lineStyle(4, 0x00ffff, a).strokeCircle(this._baseX, this._baseY, R);
    g.fillStyle(0xff2bd6, Math.min(1, a * 1.2)).fillCircle(thumbX, thumbY, R * 0.42);
    g.lineStyle(3, 0xffffff, a).strokeCircle(thumbX, thumbY, R * 0.42);
  },
};
