// ============================================================
// NameScene — zadání herního jména po STARTu (retro psaní klávesnicí)
// Jméno se pamatuje (ps_name) a předvyplní se — stačí ENTER.
// Rekord se pak ukládá i se jménem (ps_record, viz GameScene.gameOver).
// ============================================================
window.NameScene = class NameScene extends Phaser.Scene {
  constructor() { super('Name'); }

  create() {
    const { width: W, height: H } = this.scale;

    PS.UI.glowBlob(this, W * 0.25, H * 0.25, PS.COLORS.cyan, 8, 0.08);
    PS.UI.glowBlob(this, W * 0.8, H * 0.7, PS.COLORS.pink, 8, 0.08);
    PS.UI.confetti(this, 350);

    PS.UI.title(this, W / 2, 150, 'ZADEJ HERNÍ JMÉNO', 32, PS.COLORS.cyan);
    PS.UI.text(this, W / 2, 210, 'POD TÍMHLE JMÉNEM SE ULOŽÍ TVŮJ REKORD', 11, '#ccccdd');

    // zapamatované jméno z minula — stačí potvrdit Enterem
    this.name = '';
    try { this.name = localStorage.getItem(PS.STORAGE.name) || ''; } catch (e) { /* private mode */ }

    // vstupní pole s blikajícím kurzorem
    this.add.rectangle(W / 2, 320, 560, 80, 0x111133, 0.85)
      .setStrokeStyle(2, PS.COLORS.cyan, 0.8);
    this.nameText = PS.UI.text(this, W / 2, 320, '', 22, '#ffffff');
    this.cursorOn = true;
    this.time.addEvent({
      delay: 420, loop: true,
      callback: () => { this.cursorOn = !this.cursorOn; this.refresh(); },
    });
    this.refresh();

    PS.UI.text(this, W / 2, 392, 'MAX 12 ZNAKŮ', 10, '#8888aa');

    const go = PS.UI.button(this, W / 2, 478, 460, 64, 'POKRAČOVAT');
    go.setSelected(true);
    go.onClick = () => this.confirm();

    PS.UI.text(this, W / 2, H - 36, 'PIŠ NA KLÁVESNICI   ·   ENTER: POKRAČOVAT   ·   ESC: ZPĚT', 10, '#8888aa');

    this.input.keyboard.on('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    if (e.key === 'Enter') { if (!e.repeat) this.confirm(); return; }
    if (e.key === 'Escape') { this.scene.start('Menu'); return; }
    if (e.key === 'Backspace') {
      this.name = this.name.slice(0, -1);
      this.refresh();
      return;
    }
    // jeden tisknutelný znak: písmena (vč. diakritiky), číslice, mezera, . - _
    if (e.key.length === 1 && this.name.length < 12
        && /^[0-9a-záčďéěíňóřšťúůýž .\-_]$/i.test(e.key)) {
      this.name += e.key.toUpperCase();
      PS.Audio.ui();
      this.refresh();
    }
  }

  refresh() {
    this.nameText.setText(this.name + (this.cursorOn ? '_' : ' '));
  }

  confirm() {
    const name = this.name.trim();
    if (!name) { PS.UI.toast(this, 'ZADEJ ASPOŇ JEDEN ZNAK!'); return; }
    try { localStorage.setItem(PS.STORAGE.name, name); } catch (e) { /* private mode */ }
    PS.Audio.select();
    this.scene.start('HeroSelect');
  }
};
PS.scenes.push(window.NameScene);
