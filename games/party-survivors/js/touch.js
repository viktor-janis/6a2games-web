// ============================================================
// PS.Touch — dotykový joystick (styl Vampire Survivors) + sdílený stav pohybu
// ------------------------------------------------------------
// Dva režimy (volba v NASTAVENÍ):
//   'floating' — joystick se objeví tam, kam hráč ťukne (výchozí).
//   'fixed'    — pevně vpravo dole (ideální pro pravý palec), vždy viditelný;
//                ovládá se pivotem kolem pevného středu (ťuknutí jen v okolí).
// Palec sleduje prst; puštění = stop. Ovládá JEN pohyb (útoky jsou automatické).
// Pohyb je plnou rychlostí ve směru výchylky (za dead-zonou), ne analogově.
// Hostuje HUDScene (attach na začátku hry, detach při shutdown).
// GameScene.movePlayer() čte PS.Touch.vec (jednotkový směr) když PS.Touch.active.
// ============================================================
window.PS = window.PS || {};

// Dotykové volby (velikost/průhlednost/typ joysticku) — localStorage ps_touch
PS.TouchCfg = {
  defaults: { size: 1, opacity: 0.5, mode: 'floating' }, // size = násobek poloměru; mode = 'floating' | 'fixed'
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
  _mode: 'floating', // 'floating' = vznikne kam ťukneš; 'fixed' = pevně vpravo dole
  _fixedX: 0, _fixedY: 0,            // střed pevného joysticku (přepočet z rozměrů + safe area)
  _idleShown: false, _idleKey: '',   // stav vykreslené klidové základny (pevný režim)

  // Připojit k hostující scéně (HUD): grafika + input handlery.
  attach(scene) {
    this.detach();
    this._scene = scene;
    this._enabled = true;
    this._loadCfg();
    this.reset();

    this._gfx = scene.add.graphics().setDepth(900).setScrollFactor(0).setVisible(false);

    scene.input.addPointer(2); // multitouch: joystick + případné ťuknutí na tlačítko
    scene.input.on('pointerdown', this._down, this);
    scene.input.on('pointermove', this._move, this);
    scene.input.on('pointerup', this._up, this);
    scene.input.on('pointerupoutside', this._up, this);
    scene.events.once('shutdown', () => this.detach());
  },

  // načíst dotykové volby (velikost / průhlednost / typ) z localStorage
  _loadCfg() {
    const cfg = PS.TouchCfg.load();
    this._R = 90 * (cfg.size || 1);
    this._opacity = cfg.opacity != null ? cfg.opacity : 0.5;
    this._mode = cfg.mode === 'fixed' ? 'fixed' : 'floating';
  },

  // znovu načíst volby za běhu (změna v NASTAVENÍ z pauzy) + překreslit
  applyCfg() {
    if (!this._scene) return;
    this._loadCfg();
    this.reset(); // _idleShown=false → update() překreslí pevnou základnu s novou velikostí
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
    this._idleShown = false; this._idleKey = ''; // pevná základna se překreslí v update()
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

  // pevný střed joysticku — vpravo dole (pravý palec), zvednutý nad rohová
  // tlačítka pauza/zvuk; přepočítává se z rozměrů scény a bezpečných okrajů
  _computeFixed() {
    const s = this._scene;
    const W = s.scale.width, H = s.scale.height;
    const ins = PS.UI.safeInset(s);
    const SR = W - ins.right, SB = H - ins.bottom;
    this._fixedX = SR - this._R - 20;
    this._fixedY = SB - this._R - 90;
  },

  _down(pointer, currentlyOver) {
    if (this._blocked()) return;
    if (this._pointerId !== -1) return;            // jeden „pohybový" prst
    if (!this._isTouch(pointer)) return;            // myš na PC nech klávesnici
    if (currentlyOver && currentlyOver.length) return; // ťuknutí na HUD tlačítko

    if (this._mode === 'fixed') {
      this._computeFixed();
      // pevný režim: ovládej jen v okolí základny (zbytek obrazovky ignoruj)
      if (Math.hypot(pointer.x - this._fixedX, pointer.y - this._fixedY) > this._R * 2.2) return;
      this._baseX = this._fixedX; this._baseY = this._fixedY; // pivot kolem pevného středu
    } else {
      this._baseX = pointer.x; this._baseY = pointer.y; // plovoucí: kde ťukneš
    }
    this._pointerId = pointer.id;
    this.active = true;
    this._apply(pointer.x, pointer.y);
  },

  _move(pointer) {
    if (pointer.id !== this._pointerId) return;
    this._apply(pointer.x, pointer.y);
  },

  _up(pointer) {
    if (pointer.id !== this._pointerId) return;
    this.reset(); // pevná základna se znovu vykreslí v update()
  },

  // společný výpočet výchylky/směru + vykreslení (sdílí _down i _move)
  _apply(px, py) {
    let dx = px - this._baseX, dy = py - this._baseY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this._R);
    if (dist > 0) { dx /= dist; dy /= dist; }
    if (clamped / this._R < this._dead) { this.vec.x = 0; this.vec.y = 0; }
    else { this.vec.x = dx; this.vec.y = dy; } // jednotkový směr = plná rychlost
    this._draw(this._baseX + dx * clamped, this._baseY + dy * clamped);
  },

  // klidová (neovládaná) základna pevného joysticku — drží se viditelná, dokud
  // se hraje. Volá HUDScene.update() každý frame (levné: kreslí jen při změně).
  update() {
    if (!PS.isTouch || this._mode !== 'fixed' || !this._gfx) return;
    if (this.active) return; // během ovládání vlastní gfx _apply()/_draw()
    if (this._blocked()) {
      if (this._idleShown) { this._gfx.clear().setVisible(false); this._idleShown = false; this._idleKey = ''; }
      return;
    }
    this._computeFixed();
    const key = Math.round(this._fixedX) + ',' + Math.round(this._fixedY) + ',' + Math.round(this._R);
    if (this._idleShown && this._idleKey === key) return; // beze změny → nepřekreslovat
    this._idleKey = key; this._idleShown = true;
    this._drawBase(this._fixedX, this._fixedY);
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

  // klidová základna pevného joysticku (slabší) — prstenec + palec ve středu
  _drawBase(cx, cy) {
    const g = this._gfx;
    if (!g) return;
    const a = this._opacity * 0.6, R = this._R;
    g.clear().setVisible(true);
    g.fillStyle(0x00ffff, a * 0.12).fillCircle(cx, cy, R);
    g.lineStyle(4, 0x00ffff, a).strokeCircle(cx, cy, R);
    g.fillStyle(0xff2bd6, Math.min(1, a * 1.1)).fillCircle(cx, cy, R * 0.42);
    g.lineStyle(3, 0xffffff, a).strokeCircle(cx, cy, R * 0.42);
  },
};
