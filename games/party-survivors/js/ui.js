// ============================================================
// Party Survivors — sdílené UI helpery + správa kláves
// ============================================================
window.PS = window.PS || {};

// Dotykové zařízení? (telefon/tablet) — řídí zobrazení dotykového ovládání.
PS.isTouch = (typeof navigator !== 'undefined') &&
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

// ---------- Nastavení kláves (localStorage) ----------
// Ukládáme KeyboardEvent.code (fyzická klávesa, nezávislé na rozložení).
// Šipky fungují vždy jako záložní ovládání pohybu.
PS.Keys = {
  defaults: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', pause: 'KeyP' },

  load() {
    try {
      const raw = localStorage.getItem(PS.STORAGE.keys);
      const saved = raw ? JSON.parse(raw) : {};
      return Object.assign({}, this.defaults, saved);
    } catch (e) {
      return Object.assign({}, this.defaults);
    }
  },

  save(keys) {
    try { localStorage.setItem(PS.STORAGE.keys, JSON.stringify(keys)); } catch (e) { /* private mode */ }
  },

  reset() {
    try { localStorage.removeItem(PS.STORAGE.keys); } catch (e) { /* private mode */ }
    return Object.assign({}, this.defaults);
  },

  // Lidsky čitelný název klávesy z e.code
  label(code) {
    if (!code) return '?';
    const map = {
      ArrowUp: 'ŠIPKA NAHORU', ArrowDown: 'ŠIPKA DOLŮ', ArrowLeft: 'ŠIPKA VLEVO', ArrowRight: 'ŠIPKA VPRAVO',
      Space: 'MEZERNÍK', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSPACE',
      ShiftLeft: 'LEVÝ SHIFT', ShiftRight: 'PRAVÝ SHIFT',
      ControlLeft: 'LEVÝ CTRL', ControlRight: 'PRAVÝ CTRL',
      AltLeft: 'LEVÝ ALT', AltRight: 'PRAVÝ ALT',
      Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
      BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=',
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
    return code.toUpperCase();
  },
};

// ---------- UI helpery ----------
PS.UI = {
  // Baloo 2 — baculaté párty písmo (signature styl hry). Diakritika je
  // plnohodnotná (háčky/čárky sedí nad písmenem, nezmenšují ho). Načítají se
  // jen tučné řezy (600/700/800), takže i bez explicitní váhy je text tučný.
  FONT: '"Baloo 2", "Trebuchet MS", system-ui, sans-serif',
  W_BODY: '700',   // běžný text
  W_BOLD: '800',   // nadpisy / tlačítka
  FONT_TAG: '"Permanent Marker", "Baloo 2", cursive', // fixa/sprej — jen nápis "DON" v tagu Don G

  hex(n) { return '#' + n.toString(16).padStart(6, '0'); },

  // Kontrastní text k barevné skvrně (tag Don G): podle jasu tintu zvol tmavý
  // nebo světlý text + opačný obrys, ať je „DON" čitelný na jakékoli barvě.
  contrastText(tint) {
    const r = (tint >> 16) & 0xff, g = (tint >> 8) & 0xff, b = tint & 0xff;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b; // 0..255
    return lum > 140
      ? { color: '#0a0010', stroke: '#ffffff' }  // světlá skvrna (cyan) → tmavý text
      : { color: '#ffffff', stroke: '#0a0010' }; // tmavá skvrna (pink/fialová) → bílý text
  },

  // sekundy -> "MM:SS"
  fmtTime(s) {
    const total = Math.floor(s);
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  },

  // Neonový nadpis s glow (jemný — text musí zůstat čitelný)
  title(scene, x, y, str, size, color) {
    const colStr = this.hex(color);
    const t = scene.add.text(x, y, str, {
      fontFamily: this.FONT, fontStyle: this.W_BOLD, fontSize: size + 'px', color: colStr,
    }).setOrigin(0.5);
    t.setShadow(0, 0, colStr, Math.max(6, Math.round(size / 4)), true, true);
    return t;
  },

  // Obyčejný text
  text(scene, x, y, str, size, colorStr, origin = 0.5) {
    return scene.add.text(x, y, str, {
      fontFamily: this.FONT, fontStyle: this.W_BODY, fontSize: size + 'px', color: colorStr, align: 'center',
    }).setOrigin(origin);
  },

  // Neonové menu tlačítko ve stylu webu (cyan rámeček, při výběru plná výplň)
  button(scene, x, y, w, h, label, opts = {}) {
    const color = opts.color !== undefined ? opts.color : PS.COLORS.cyan;
    const colStr = this.hex(color);
    const fontSize = opts.fontSize || 18;

    const container = scene.add.container(x, y);
    const bg = scene.add.rectangle(0, 0, w, h, color, 0.05).setStrokeStyle(3, color);
    const txt = scene.add.text(0, 0, label, {
      fontFamily: this.FONT, fontStyle: this.W_BOLD, fontSize: fontSize + 'px', color: colStr,
    }).setOrigin(0.5);
    txt.setShadow(0, 0, colStr, 8, true, true);
    const arrow = scene.add.text(-w / 2 + 14, 0, '>', {
      fontFamily: this.FONT, fontStyle: this.W_BOLD, fontSize: fontSize + 'px', color: this.hex(PS.COLORS.dark),
    }).setOrigin(0, 0.5).setVisible(false);
    container.add([bg, txt, arrow]);

    bg.setInteractive({ useHandCursor: true });

    const api = {
      container, bg, txt,
      selected: false,
      onClick: null,
      onHover: null,
      blinkTween: null,
      setSelected(sel) {
        this.selected = sel;
        if (sel) {
          bg.setFillStyle(color, 1);
          txt.setColor(PS.UI.hex(PS.COLORS.dark));
          txt.setShadow(0, 0, colStr, 0);
          arrow.setVisible(true);
          if (!this.blinkTween) {
            this.blinkTween = scene.tweens.add({
              targets: arrow, alpha: { from: 1, to: 0 },
              duration: 300, yoyo: true, repeat: -1, ease: 'Stepped',
            });
          }
        } else {
          bg.setFillStyle(color, 0.05);
          txt.setColor(colStr);
          txt.setShadow(0, 0, colStr, 8, true, true);
          arrow.setVisible(false);
          if (this.blinkTween) { this.blinkTween.remove(); this.blinkTween = null; arrow.setAlpha(1); }
        }
      },
      setLabel(str) { txt.setText(str); },
    };

    bg.on('pointerover', () => { if (api.onHover) api.onHover(); });
    bg.on('pointerdown', () => { if (api.onClick) api.onClick(); });

    return api;
  },

  // Krátká zpráva na obrazovce (fade out). opts: { size, hold (ms), y } — pro
  // delší/větší hlášky (např. návod na celou obrazovku na iPhonu).
  toast(scene, msg, opts = {}) {
    const { width: W, height: H } = scene.scale;
    const size = opts.size || 14;
    const hold = opts.hold != null ? opts.hold : 1600;
    const y = opts.y != null ? opts.y : H - 60;
    const t = scene.add.text(W / 2, y, msg, {
      fontFamily: this.FONT, fontStyle: this.W_BODY, fontSize: size + 'px', color: this.hex(PS.COLORS.yellow),
      backgroundColor: '#1a0033', padding: { x: 16, y: 10 },
      align: 'center', lineSpacing: 6, wordWrap: { width: W - 80 },
    }).setOrigin(0.5).setDepth(1000).setAlpha(0);
    scene.tweens.add({
      targets: t, alpha: 1, duration: 150,
      onComplete: () => scene.tweens.add({
        targets: t, alpha: 0, delay: hold, duration: 400,
        onComplete: () => t.destroy(),
      }),
    });
    return t;
  },

  // Padající konfety — party atmosféra menu obrazovek
  confetti(scene, quantityMs = 130) {
    const { width: W } = scene.scale;
    return scene.add.particles(0, 0, 'px', {
      x: { min: 0, max: W }, y: -10,
      lifespan: 9000,
      speedY: { min: 40, max: 130 }, speedX: { min: -40, max: 40 },
      rotate: { start: 0, end: 360 },
      scaleX: { min: 0.8, max: 2.4 }, scaleY: { min: 0.8, max: 2.4 },
      alpha: { start: 0.95, end: 0.4 },
      tint: PS.COLORS.confetti,
      quantity: 1, frequency: quantityMs,
    }).setDepth(-1);
  },

  // Velké rozmazané barevné "blob" světlo na pozadí
  glowBlob(scene, x, y, color, scale = 6, alpha = 0.10) {
    return scene.add.image(x, y, 'glow').setTint(color).setScale(scale).setAlpha(alpha).setDepth(-2);
  },

  // Klubová atmosféra na pozadí menu — sjednoceno s vizuálem hry: pomalu
  // bloudící barevné reflektory (ADD blend), jemné stoupající světelné částice
  // místo konfet a vinětace (text/UI vystupuje ze tmy). Vše je ZA obsahem
  // (záporné depth), takže neovlivní čitelnost ani hover tlačítek.
  clubBackdrop(scene) {
    const W = scene.scale.width, H = scene.scale.height;

    // reflektory — měkká barevná světla, pomalu bloudí a pulzují
    [[0.18, 0.22, PS.COLORS.pink], [0.84, 0.30, PS.COLORS.cyan],
     [0.50, 0.90, PS.COLORS.purple], [0.30, 0.66, PS.COLORS.pink]]
      .forEach(([fx, fy, col]) => {
        const l = scene.add.image(W * fx, H * fy, 'glow')
          .setScrollFactor(0).setDepth(-3).setBlendMode(Phaser.BlendModes.ADD)
          .setTint(col).setScale(7).setAlpha(0.10);
        scene.tweens.add({
          targets: l,
          x: l.x + Phaser.Math.Between(-120, 120), y: l.y + Phaser.Math.Between(-80, 80),
          alpha: { from: 0.05, to: 0.15 }, duration: Phaser.Math.Between(3200, 5400),
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });

    // jemné stoupající světelné částice (klubový opar) — náhrada za konfety
    scene.add.particles(0, 0, 'px', {
      x: { min: 0, max: W }, y: H + 8,
      lifespan: 9000,
      speedY: { min: -34, max: -12 }, speedX: { min: -12, max: 12 },
      scale: { min: 1.4, max: 3.6 },
      alpha: { start: 0.14, end: 0 },
      tint: [PS.COLORS.pink, PS.COLORS.cyan, PS.COLORS.purple],
      blendMode: 'ADD',
      quantity: 1, frequency: 300,
    }).setDepth(-2);

    // vinětace — ztmavené okraje jako ve hře (za obsahem)
    scene.add.image(W / 2, H / 2, 'vignette')
      .setScrollFactor(0).setDepth(-1).setDisplaySize(W + 40, H + 40);
  },

  // Bezpečné okraje v HERNÍCH souřadnicích — kolik px je u režimu ENVELOP
  // useknuto za okrajem viewportu (na každé straně). Na PC (bez ořezu) ~nuly.
  safeInset(scene) {
    const cv = scene.sys.game.canvas;
    const r = cv.getBoundingClientRect();
    const gw = scene.scale.gameSize.width, gh = scene.scale.gameSize.height;
    const sx = (r.width / gw) || 1, sy = (r.height / gh) || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      left:   Math.max(0, -r.left) / sx,
      right:  Math.max(0, r.right - vw) / sx,
      top:    Math.max(0, -r.top) / sy,
      bottom: Math.max(0, r.bottom - vh) / sy,
    };
  },
};

// Spolehlivé přepnutí scale režimu za běhu (mobil). Jen nastavit `scaleMode`
// NESTAČÍ — Phaser nepřepočítá layout, dokud se nepřenastaví i interní
// displaySize.aspectMode; jinak canvas zůstane v původním režimu (např. hra
// hlásí ENVELOP, ale reálně letterboxuje jako FIT → černé okraje, malé postavy).
PS.applyScaleMode = function (scene, mode) {
  const sm = scene.scale;
  sm.scaleMode = mode;
  if (sm.displaySize && sm.displaySize.setAspectMode) sm.displaySize.setAspectMode(mode);
  sm.refresh();
};

// Celá obrazovka + pokus o zámek orientace na šířku (mobil). Bezpečné na PC.
PS.goFullscreen = function (scene) {
  try {
    if (scene.scale.isFullscreen) {
      scene.scale.stopFullscreen();
    } else {
      scene.scale.startFullscreen();
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
  } catch (e) { /* nepodporováno */ }
};
