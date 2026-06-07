// ============================================================
// HUDScene — overlay nad hrou: čas, HP, XP, level, killy, pauza
// ============================================================
window.HUDScene = class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create() {
    this.gameScene = this.scene.get('Game');
    const W = this.scale.width, H = this.scale.height;

    // ---------- XP bar přes celou šířku nahoře ----------
    this.add.rectangle(W / 2, 12, W - 16, 16, 0x111133, 0.85)
      .setStrokeStyle(1, PS.COLORS.purple);
    this.xpBar = this.add.rectangle(10, 12, W - 20, 10, PS.COLORS.green, 0.9)
      .setOrigin(0, 0.5);
    this.xpBar.scaleX = 0;
    this.levelText = PS.UI.text(this, W - 14, 36, 'LVL 1', 12, PS.UI.hex(PS.COLORS.green), 1)
      .setOrigin(1, 0);

    // ---------- časomíra (hlavní skóre) ----------
    this.timeText = PS.UI.text(this, W / 2, 44, '00:00', 26, '#ffffff');
    this.timeText.setShadow(0, 0, '#000000', 6, true, true);

    // ---------- HP bar vlevo nahoře ----------
    this.add.rectangle(14, 36, 240, 18, 0x111133, 0.85)
      .setOrigin(0, 0).setStrokeStyle(1, PS.COLORS.red);
    this.hpBar = this.add.rectangle(16, 38, 236, 14, PS.COLORS.red, 0.95)
      .setOrigin(0, 0);
    this.hpText = PS.UI.text(this, 134, 45, '', 10, '#ffffff');

    // ---------- aktivní buffy z klíčků ----------
    this.buffText = this.add.text(14, 62, '', {
      fontFamily: PS.UI.FONT, fontSize: '9px', color: PS.UI.hex(PS.COLORS.yellow),
    }).setOrigin(0, 0);

    // ---------- killy ----------
    this.killsText = PS.UI.text(this, W - 14, 64, 'KILLS: 0', 11, '#ccccdd', 1).setOrigin(1, 0);

    // ---------- seznam zbraní vlevo dole ----------
    this.weaponsText = this.add.text(14, H - 14, '', {
      fontFamily: PS.UI.FONT, fontSize: '10px', color: '#ccccdd', lineSpacing: 6,
    }).setOrigin(0, 1);

    // ---------- boss HP bar (viditelný jen když boss žije) ----------
    this.bossUi = this.add.container(0, 0).setVisible(false);
    this.bossName = PS.UI.text(this, W / 2, 76, '', 11, PS.UI.hex(PS.COLORS.red));
    const bossBg = this.add.rectangle(W / 2, 94, 424, 14, 0x111133, 0.85)
      .setStrokeStyle(1, PS.COLORS.red);
    this.bossBar = this.add.rectangle(W / 2 - 210, 94, 420, 10, PS.COLORS.red, 0.95)
      .setOrigin(0, 0.5);
    this.bossUi.add([this.bossName, bossBg, this.bossBar]);

    // ---------- oznámení (nový tier, boss) ----------
    this.announceQueue = [];
    this.gameScene.events.on('announce', this.onAnnounce, this);
    this.events.on('shutdown', () => {
      this.gameScene.events.off('announce', this.onAnnounce, this);
    });

    // ---------- pauza ----------
    this.paused = false;
    const binds = PS.Keys.load();
    this.pauseUi = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.pauseUi.add([
      this.add.rectangle(W / 2, H / 2, W, H, 0x050010, 0.65),
      PS.UI.title(this, W / 2, H / 2 - 40, 'PAUZA', 40, PS.COLORS.cyan),
      PS.UI.text(this, W / 2, H / 2 + 40,
        `${PS.Keys.label(binds.pause)}: POKRAČOVAT   ·   ESC: ZPĚT DO MENU   ·   M: ZVUK`, 12, '#ccccdd'),
    ]);

    this.input.keyboard.on('keydown', (e) => {
      if (e.code === binds.pause && !e.repeat) this.togglePause();
      else if (e.code === 'Escape' && this.paused) this.quitToMenu();
      else if (e.code === 'KeyM' && !e.repeat) {
        PS.Audio.setMuted(!PS.Audio.muted);
        PS.UI.toast(this, PS.Audio.muted ? 'ZVUK: VYPNUTO' : 'ZVUK: ZAPNUTO');
      }
    });
  }

  togglePause() {
    if (this.scene.isActive('LevelUp')) return; // během výběru vylepšení nepauzovat
    this.paused = !this.paused;
    this.pauseUi.setVisible(this.paused);
    if (this.paused) this.scene.pause('Game');
    else this.scene.resume('Game');
  }

  quitToMenu() {
    this.scene.stop('Game');
    this.scene.start('Menu'); // start z HUD zároveň HUD ukončí
  }

  onAnnounce({ text, color }) {
    const W = this.scale.width;
    const t = PS.UI.text(this, W / 2, 140, text, 15, PS.UI.hex(color));
    t.setShadow(0, 0, PS.UI.hex(color), 8, true, true);
    t.setAlpha(0).setDepth(50);
    this.tweens.add({
      targets: t, alpha: 1, duration: 200,
      onComplete: () => this.tweens.add({
        targets: t, alpha: 0, y: 120, delay: 1800, duration: 500,
        onComplete: () => t.destroy(),
      }),
    });
  }

  update() {
    const g = this.gameScene;
    if (!g || !g.stats) return;

    this.xpBar.scaleX = Phaser.Math.Clamp(g.xp / g.xpNext, 0, 1);
    this.levelText.setText('LVL ' + g.level);
    this.timeText.setText(PS.UI.fmtTime(g.elapsed));
    const hpFrac = Phaser.Math.Clamp(g.hp / g.stats.maxHp, 0, 1);
    this.hpBar.scaleX = hpFrac;
    this.hpText.setText(Math.max(0, Math.ceil(g.hp)) + ' / ' + g.stats.maxHp);
    this.killsText.setText('KILLS: ' + g.kills);
    if (g.weapons) {
      this.weaponsText.setText(
        g.weapons.map(w => `${w.def.name.toUpperCase()} ${w.level}`).join('\n'));
    }

    // aktivní buffy z klíčků
    const now = g.time.now;
    const buffs = [];
    if (now < g.buffDmgUntil) buffs.push(`DMG+30% ${Math.ceil((g.buffDmgUntil - now) / 1000)}s`);
    if (now < g.buffSpeedUntil) buffs.push(`SPEED+20% ${Math.ceil((g.buffSpeedUntil - now) / 1000)}s`);
    if (now < g.immortalUntil) buffs.push(`NESMRTELNÝ ${Math.ceil((g.immortalUntil - now) / 1000)}s`);
    if (now < g.freezeUntil) buffs.push(`FREEZE ${Math.ceil((g.freezeUntil - now) / 1000)}s`);
    this.buffText.setText(buffs.join('   '));

    // boss bar — první aktivní boss
    let boss = null;
    g.enemies.children.iterate(e => {
      if (!boss && e && e.active && e.isBoss) boss = e;
    });
    if (boss) {
      this.bossUi.setVisible(true);
      this.bossName.setText(boss.bossName);
      this.bossBar.scaleX = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    } else {
      this.bossUi.setVisible(false);
    }
  }
};
PS.scenes.push(window.HUDScene);
