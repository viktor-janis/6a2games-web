// ============================================================
// GameOverScene — výsledný čas (skóre) + možnost hrát znovu
// ============================================================
window.GameOverScene = class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.result = data || {};
  }

  create() {
    const { width: W, height: H } = this.scale;
    const r = this.result;

    PS.UI.glowBlob(this, W * 0.5, H * 0.3, PS.COLORS.red, 9, 0.10);
    PS.UI.glowBlob(this, W * 0.15, H * 0.8, PS.COLORS.purple, 8, 0.08);
    PS.UI.confetti(this, 400);

    PS.UI.title(this, W / 2, 120, 'KONEC PÁRTY', 44, PS.COLORS.red);
    PS.UI.text(this, W / 2, 185, r.heroName ? `HRDINA: ${r.heroName.toUpperCase()}` : '', 13, '#ccccdd');

    PS.UI.text(this, W / 2, 250, 'PŘEŽIL JSI', 14, '#8888aa');
    const timeT = PS.UI.title(this, W / 2, 305, PS.UI.fmtTime(r.time || 0), 52, PS.COLORS.yellow);
    this.tweens.add({
      targets: timeT, scale: { from: 1, to: 1.05 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    PS.UI.text(this, W / 2, 380, `LEVEL ${r.level || 1}   ·   KILLS ${r.kills || 0}`, 13, '#ccccdd');

    // rekord
    if (r.isRecord) {
      const rec = PS.UI.title(this, W / 2, 420, 'NOVÝ REKORD!', 18, PS.COLORS.pink);
      this.tweens.add({
        targets: rec, alpha: { from: 1, to: 0.4 },
        duration: 500, yoyo: true, repeat: -1,
      });
    } else if (r.best > 0) {
      PS.UI.text(this, W / 2, 420, `REKORD: ${PS.UI.fmtTime(r.best)}`, 11, '#8888aa');
    }

    // tlačítka
    const again = PS.UI.button(this, W / 2, 490, 460, 60, 'HRÁT ZNOVU');
    const menu = PS.UI.button(this, W / 2, 575, 460, 60, 'ZPĚT DO MENU');
    this.items = [again, menu];
    const actions = [
      () => this.scene.start('HeroSelect'),
      () => this.scene.start('Menu'),
    ];
    this.items.forEach((btn, i) => {
      btn.onHover = () => this.select(i);
      btn.onClick = () => { this.select(i); actions[i](); };
    });
    this.actions = actions;
    this.select(0);

    this.input.keyboard.on('keydown-UP', () => this.select(0));
    this.input.keyboard.on('keydown-DOWN', () => this.select(1));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.actions[this.selectedIndex](); });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  select(i) {
    if (this.selectedIndex !== i) PS.Audio.ui();
    this.selectedIndex = i;
    this.items.forEach((btn, j) => btn.setSelected(j === i));
  }
};
PS.scenes.push(window.GameOverScene);
