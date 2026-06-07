// ============================================================
// RundaScene — overlay: postupné odhalení odměn z Rundy panclů
// (2–4 klíče + 1–3 stálé upgrady; aplikuje se až po potvrzení)
// ============================================================
window.RundaScene = class RundaScene extends Phaser.Scene {
  constructor() { super('Runda'); }

  init(data) {
    this.rewards = (data && data.rewards) || [];
  }

  create() {
    this.gameScene = this.scene.get('Game');
    const { width: W, height: H } = this.scale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x050010, 0.78);
    PS.UI.title(this, W / 2, 92, 'RUNDA PANCLŮ!', 36, PS.COLORS.yellow);
    const tray = this.add.image(W / 2, 156, 'runda').setScale(2.4);
    this.tweens.add({
      targets: tray, scale: { from: 2.4, to: 2.7 }, duration: 480, yoyo: true, repeat: -1,
    });
    PS.UI.text(this, W / 2, 198, 'NA EX!', 12, '#ccccdd');

    // odměny — řádky se odhalují postupně
    const startY = 244, rowH = 50;
    this.rewards.forEach((rw, i) => {
      const colStr = PS.UI.hex(rw.color);
      const head = rw.kind === 'key' ? '[KLÍČ]' : '[STÁLÝ UPGRADE]';
      const y = startY + i * rowH;
      const row = this.add.container(W / 2, y).setAlpha(0);
      row.add([
        this.add.text(0, 0, `${head} ${rw.name.toUpperCase()}`, {
          fontFamily: PS.UI.FONT, fontSize: '13px', color: colStr, align: 'center',
        }).setOrigin(0.5, 0.5),
        this.add.text(0, 16, rw.desc, {
          fontFamily: PS.UI.FONT, fontSize: '9px', color: '#ccccdd', align: 'center',
          wordWrap: { width: 780 },
        }).setOrigin(0.5, 0),
      ]);
      this.tweens.add({
        targets: row, alpha: 1, y: { from: y + 14, to: y },
        delay: 350 + i * 380, duration: 260,
        onStart: () => PS.Audio.gem(),
      });
    });

    // potvrzení až po odhalení všech odměn
    this.canClose = false;
    this.time.delayedCall(350 + this.rewards.length * 380 + 250, () => {
      this.canClose = true;
      const hint = PS.UI.text(this, W / 2, H - 52, 'ENTER / KLIK — DO TOHO!', 12, PS.UI.hex(PS.COLORS.green));
      this.tweens.add({ targets: hint, alpha: { from: 1, to: 0.35 }, duration: 500, yoyo: true, repeat: -1 });
    });

    const close = () => { if (this.canClose) this.close(); };
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) close(); });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) close(); });
    this.input.on('pointerdown', close);
  }

  close() {
    const g = this.gameScene;
    g.applyRundaRewards(this.rewards);
    PS.Audio.select();
    this.scene.stop();
    this.scene.resume('Game');
    g.cameras.main.flash(150, 255, 210, 60);
    g.burstConfetti(g.player.x, g.player.y);
  }
};
PS.scenes.push(window.RundaScene);
