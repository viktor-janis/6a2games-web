// ============================================================
// Party Survivors — sdílené UI helpery + správa kláves
// ============================================================
window.PS = window.PS || {};

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
  FONT: '"Press Start 2P", "Courier New", monospace',

  hex(n) { return '#' + n.toString(16).padStart(6, '0'); },

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
      fontFamily: this.FONT, fontSize: size + 'px', color: colStr,
    }).setOrigin(0.5);
    t.setShadow(0, 0, colStr, Math.max(4, Math.round(size / 6)), true, true);
    return t;
  },

  // Obyčejný text
  text(scene, x, y, str, size, colorStr, origin = 0.5) {
    return scene.add.text(x, y, str, {
      fontFamily: this.FONT, fontSize: size + 'px', color: colorStr, align: 'center',
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
      fontFamily: this.FONT, fontSize: fontSize + 'px', color: colStr,
    }).setOrigin(0.5);
    txt.setShadow(0, 0, colStr, 8, true, true);
    const arrow = scene.add.text(-w / 2 + 14, 0, '>', {
      fontFamily: this.FONT, fontSize: fontSize + 'px', color: this.hex(PS.COLORS.dark),
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

  // Krátká zpráva dole na obrazovce (fade out)
  toast(scene, msg) {
    const { width: W, height: H } = scene.scale;
    const t = scene.add.text(W / 2, H - 60, msg, {
      fontFamily: this.FONT, fontSize: '14px', color: this.hex(PS.COLORS.yellow),
      backgroundColor: '#1a0033', padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(1000).setAlpha(0);
    scene.tweens.add({
      targets: t, alpha: 1, duration: 150,
      onComplete: () => scene.tweens.add({
        targets: t, alpha: 0, delay: 1600, duration: 400,
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
};
