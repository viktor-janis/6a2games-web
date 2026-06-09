// ============================================================
// SettingsScene — přemapování kláves (ukládá se do localStorage)
// ============================================================
window.SettingsScene = class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  init(data) {
    this.fromPause = !!(data && data.fromPause); // otevřeno jako překryv z pauzy ve hře?
  }

  // odchod: z pauzy zavřít překryv (zpět do hry), jinak do hlavního menu
  exit() {
    if (this.fromPause) this.scene.stop();
    else this.scene.start('Menu');
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.keys = PS.Keys.load();
    this.listening = null;   // id akce, pro kterou se čeká na klávesu
    this.listenTween = null;

    // z pauzy: neprůhledné pozadí, ať není vidět běžící hra pod překryvem
    if (this.fromPause) this.add.rectangle(W / 2, H / 2, W * 3, H * 3, PS.COLORS.bg, 1).setDepth(-3);

    PS.UI.clubBackdrop(this); // tmavá klubová atmosféra (sjednoceno s hrou)

    PS.UI.title(this, W / 2, 70, 'NASTAVENÍ', 36, PS.COLORS.cyan);

    // Mobil: místo přemapování kláves (na dotyku nepoužitelné) → dotykové volby.
    if (PS.isTouch) { this.createTouchSettings(W, H); return; }

    PS.UI.text(this, W / 2, 125, 'ENTER NEBO KLIK NA ŘÁDKU = ZMĚNA KLÁVESY', 11, '#8888aa');
    PS.UI.text(this, W / 2, 150, 'ŠIPKY FUNGUJÍ VE HŘE VŽDY JAKO ZÁLOŽNÍ OVLÁDÁNÍ', 11, '#8888aa');

    // Řádky akcí
    this.ACTIONS = [
      { id: 'up',    label: 'NAHORU' },
      { id: 'down',  label: 'DOLŮ' },
      { id: 'left',  label: 'VLEVO' },
      { id: 'right', label: 'VPRAVO' },
      { id: 'pause', label: 'PAUZA' },
    ];

    const rowW = 760, rowH = 58, startY = 215, gap = 68;
    this.rows = this.ACTIONS.map((action, i) => {
      const y = startY + i * gap;
      const bg = this.add.rectangle(W / 2, y, rowW, rowH, PS.COLORS.cyan, 0)
        .setStrokeStyle(2, PS.COLORS.cyan, 0.25)
        .setInteractive({ useHandCursor: true });
      const label = PS.UI.text(this, W / 2 - rowW / 2 + 30, y, action.label, 15, '#ccccdd', 0).setOrigin(0, 0.5);
      const chipBg = this.add.rectangle(W / 2 + rowW / 2 - 170, y, 300, 42, PS.COLORS.cyan, 0.06)
        .setStrokeStyle(2, PS.COLORS.cyan);
      const chipTxt = PS.UI.text(this, W / 2 + rowW / 2 - 170, y, '', 12, PS.UI.hex(PS.COLORS.cyan));

      bg.on('pointerover', () => { if (!this.listening) this.select(i); });
      bg.on('pointerdown', () => {
        if (this.listening) return;
        this.select(i);
        this.startListening(action.id);
      });

      return { action, bg, label, chipBg, chipTxt };
    });

    // Tlačítka dole
    this.btnReset = PS.UI.button(this, W / 2 - 190, H - 60, 320, 56, 'VÝCHOZÍ', { fontSize: 14 });
    this.btnBack = PS.UI.button(this, W / 2 + 190, H - 60, 320, 56, 'ZPĚT', { fontSize: 14 });
    this.btnReset.onClick = () => { if (!this.listening) this.resetKeys(); };
    this.btnBack.onClick = () => { if (!this.listening) this.exit(); };
    this.btnReset.onHover = () => { if (!this.listening) this.select(this.ACTIONS.length); };
    this.btnBack.onHover = () => { if (!this.listening) this.select(this.ACTIONS.length + 1); };

    // Navigace klávesnicí
    this.selectedIndex = 0;
    this.select(0);
    this.input.keyboard.on('keydown-UP', () => { if (!this.listening) this.move(-1); });
    this.input.keyboard.on('keydown-DOWN', () => { if (!this.listening) this.move(1); });
    this.input.keyboard.on('keydown-LEFT', () => { if (!this.listening) this.sideways(); });
    this.input.keyboard.on('keydown-RIGHT', () => { if (!this.listening) this.sideways(); });
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!this.listening && !e.repeat) this.confirm(); });
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.listening) this.stopListening();
      else this.exit();
    });

    // Zachytávání nové klávesy
    this.input.keyboard.on('keydown', (event) => {
      if (!this.listening || event.repeat) return;
      if (event.code === 'Escape') return; // řeší handler výše
      // ignoruj klávesu (ENTER), která naslouchání právě spustila —
      // Phaser pro jeden stisk emituje specifickou i generickou událost
      if (performance.now() - this.listenStart < 100) return;
      event.preventDefault();
      this.assignKey(this.listening, event.code);
      this.stopListening();
    });

    this.refreshChips();
  }

  // ---------- dotykové volby (mobil) ----------
  createTouchSettings(W, H) {
    const cfg = PS.TouchCfg.load();
    const SIZES = [['MALÝ', 0.8], ['STŘEDNÍ', 1.0], ['VELKÝ', 1.3]];
    const OPACS = [['SLABÁ', 0.3], ['STŘEDNÍ', 0.5], ['SILNÁ', 0.75]];
    const nearest = (arr, v) => {
      let bi = 0, bd = Infinity;
      arr.forEach(([, val], i) => { const d = Math.abs(val - v); if (d < bd) { bd = d; bi = i; } });
      return bi;
    };
    let si = nearest(SIZES, cfg.size != null ? cfg.size : 1);
    let oi = nearest(OPACS, cfg.opacity != null ? cfg.opacity : 0.5);
    const save = () => PS.TouchCfg.save({ size: SIZES[si][1], opacity: OPACS[oi][1] });

    PS.UI.text(this, W / 2, 125, 'DOTYKOVÉ OVLÁDÁNÍ', 11, '#8888aa');

    const sound = PS.UI.button(this, W / 2, 212, 560, 60, '');
    const fs = PS.UI.button(this, W / 2, 286, 560, 60, 'CELÁ OBRAZOVKA');
    const size = PS.UI.button(this, W / 2, 360, 560, 60, '');
    const opac = PS.UI.button(this, W / 2, 434, 560, 60, '');
    const back = PS.UI.button(this, W / 2, H - 64, 360, 58, 'ZPĚT');
    back.setSelected(true);

    const refresh = () => {
      sound.setLabel('ZVUK: ' + (PS.Audio.muted ? 'VYPNUTO' : 'ZAPNUTO'));
      size.setLabel('JOYSTICK: ' + SIZES[si][0]);
      opac.setLabel('PRŮHLEDNOST: ' + OPACS[oi][0]);
    };
    refresh();

    sound.onClick = () => { PS.Audio.setMuted(!PS.Audio.muted); refresh(); };
    fs.onClick = () => {
      // iPhone Safari nepodporuje Fullscreen API → poradit „Přidat na plochu"
      if (this.scale.fullscreen.available) PS.goFullscreen(this);
      else PS.UI.toast(this,
        'CELÁ OBRAZOVKA NA iPHONU:\nV Safari ťukni dole na SDÍLET,\npak „PŘIDAT NA PLOCHU" a spusť hru\nz nové ikony na ploše.',
        { size: 26, hold: 6500, y: H / 2 });
    };
    size.onClick = () => { si = (si + 1) % SIZES.length; save(); refresh(); };
    opac.onClick = () => { oi = (oi + 1) % OPACS.length; save(); refresh(); };
    back.onClick = () => this.exit();
    this.input.keyboard.on('keydown-ESC', () => this.exit());

    PS.UI.text(this, W / 2, H - 22, 'ŤUKNI PRO ZMĚNU', 10, '#8888aa');
  }

  // ---------- navigace ----------
  itemCount() { return this.ACTIONS.length + 2; } // řádky + 2 tlačítka

  move(dir) {
    let i = this.selectedIndex + dir;
    // z tlačítek nahoru -> poslední řádek; z řádků dolů -> první tlačítko
    if (i >= this.itemCount()) i = 0;
    if (i < 0) i = this.itemCount() - 1;
    if (dir > 0 && this.selectedIndex === this.ACTIONS.length - 1) i = this.ACTIONS.length;
    this.select(i);
  }

  sideways() {
    // přepínání mezi VÝCHOZÍ a ZPĚT, když jsme na tlačítkách
    if (this.selectedIndex === this.ACTIONS.length) this.select(this.ACTIONS.length + 1);
    else if (this.selectedIndex === this.ACTIONS.length + 1) this.select(this.ACTIONS.length);
  }

  select(i) {
    this.selectedIndex = i;
    this.rows.forEach((row, j) => {
      const sel = j === i;
      row.bg.setFillStyle(PS.COLORS.cyan, sel ? 0.10 : 0);
      row.bg.setStrokeStyle(2, PS.COLORS.cyan, sel ? 1 : 0.25);
      row.label.setColor(sel ? '#ffffff' : '#ccccdd');
    });
    this.btnReset.setSelected(i === this.ACTIONS.length);
    this.btnBack.setSelected(i === this.ACTIONS.length + 1);
  }

  confirm() {
    if (this.selectedIndex < this.ACTIONS.length) {
      this.startListening(this.ACTIONS[this.selectedIndex].id);
    } else if (this.selectedIndex === this.ACTIONS.length) {
      this.resetKeys();
    } else {
      this.exit();
    }
  }

  // ---------- přemapování ----------
  startListening(actionId) {
    this.listening = actionId;
    this.listenStart = performance.now();
    const row = this.rows.find(r => r.action.id === actionId);
    row.chipTxt.setText('STISKNI...').setColor(PS.UI.hex(PS.COLORS.yellow));
    row.chipBg.setStrokeStyle(2, PS.COLORS.yellow);
    this.listenTween = this.tweens.add({
      targets: row.chipTxt, alpha: { from: 1, to: 0.25 },
      duration: 350, yoyo: true, repeat: -1,
    });
  }

  stopListening() {
    if (this.listenTween) { this.listenTween.remove(); this.listenTween = null; }
    this.listening = null;
    this.refreshChips();
  }

  assignKey(actionId, code) {
    const old = this.keys[actionId];
    // konflikt: pokud je klávesa už použitá jinde, akce si je prohodí
    for (const a of Object.keys(this.keys)) {
      if (a !== actionId && this.keys[a] === code) this.keys[a] = old;
    }
    this.keys[actionId] = code;
    PS.Keys.save(this.keys);
  }

  resetKeys() {
    this.keys = PS.Keys.reset();
    this.refreshChips();
    PS.UI.toast(this, 'OBNOVENO VÝCHOZÍ NASTAVENÍ');
  }

  refreshChips() {
    this.rows.forEach(row => {
      row.chipTxt.setText(PS.Keys.label(this.keys[row.action.id]))
        .setColor(PS.UI.hex(PS.COLORS.cyan)).setAlpha(1);
      row.chipBg.setStrokeStyle(2, PS.COLORS.cyan);
    });
  }
};
PS.scenes.push(window.SettingsScene);
