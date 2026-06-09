// ============================================================
// HUDScene — overlay nad hrou: čas, HP, XP, level, killy, pauza
// + dotykové ovládání (plovoucí joystick, tlačítka pauza/zvuk) na mobilu.
// Rozmístění respektuje PS.UI.safeInset() — v režimu ENVELOP (mobil) se kritické
// prvky neořežou; na PC (FIT) vrací inset ~0, takže layout je beze změny.
// ============================================================
window.HUDScene = class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create() {
    this.gameScene = this.scene.get('Game');
    const W = this.scale.width, H = this.scale.height;

    // ---------- XP bar přes celou šířku nahoře ----------
    this.xpBg = this.add.rectangle(W / 2, 12, W - 16, 16, 0x111133, 0.85)
      .setStrokeStyle(1, PS.COLORS.purple);
    this.xpBar = this.add.rectangle(10, 12, W - 20, 10, PS.COLORS.green, 0.9).setOrigin(0, 0.5);
    this.xpBar.scaleX = 0;
    this.levelText = PS.UI.text(this, W - 14, 36, 'LVL 1', 12, PS.UI.hex(PS.COLORS.green), 1).setOrigin(1, 0);

    // ---------- časomíra (hlavní skóre) ----------
    this.timeText = PS.UI.text(this, W / 2, 44, '00:00', 26, '#ffffff');
    this.timeText.setShadow(0, 0, '#000000', 6, true, true);
    this.bossFightLabel = PS.UI.text(this, W / 2, 64, 'PROBÍHÁ BOSS FIGHT', 9, PS.UI.hex(PS.COLORS.red))
      .setVisible(false);

    // ---------- HP bar vlevo nahoře ----------
    this.hpBg = this.add.rectangle(14, 36, 240, 18, 0x111133, 0.85)
      .setOrigin(0, 0).setStrokeStyle(1, PS.COLORS.red);
    this.hpBar = this.add.rectangle(16, 38, 236, 14, PS.COLORS.red, 0.95).setOrigin(0, 0);
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
    this.bossBg = this.add.rectangle(W / 2, 94, 424, 14, 0x111133, 0.85).setStrokeStyle(1, PS.COLORS.red);
    this.bossBar = this.add.rectangle(W / 2 - 210, 94, 420, 10, PS.COLORS.red, 0.95).setOrigin(0, 0.5);
    this.bossUi.add([this.bossName, this.bossBg, this.bossBar]);

    // ---------- šipka k Rundě panclů (jen když je mimo obrazovku) ----------
    this.rundaArrow = this.add.image(0, 0, 'arrow').setTint(0xffd24a).setDepth(60).setVisible(false);

    // ---------- oznámení (nový tier, boss) ----------
    this.announceQueue = [];
    this.gameScene.events.on('announce', this.onAnnounce, this);

    // ---------- pauza ----------
    this.paused = false;
    const binds = PS.Keys.load();
    this.pauseUi = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.pauseBg = this.add.rectangle(W / 2, H / 2, W * 3, H * 3, 0x050010, 0.7); // přesah kryje i ořez
    this.pauseTitle = PS.UI.title(this, W / 2, H / 2 - 90, 'PAUZA', 40, PS.COLORS.cyan);
    this.pauseHint = PS.UI.text(this, W / 2, H / 2 + 150,
      `${PS.Keys.label(binds.pause)}: POKRAČOVAT   ·   ESC: DO MENU   ·   M: ZVUK`, 11, '#8888aa');
    // dotyková tlačítka v pauze (fungují i myší na PC)
    this.pResume = PS.UI.button(this, W / 2, H / 2 - 10, 360, 56, 'POKRAČOVAT');
    this.pMenu = PS.UI.button(this, W / 2, H / 2 + 58, 360, 56, 'DO MENU');
    this.pMute = PS.UI.button(this, W / 2, H / 2 + 126, 360, 48, 'ZVUK: ZAP', { fontSize: 14 });
    this.pResume.onClick = () => this.togglePause();
    this.pMenu.onClick = () => this.quitToMenu();
    this.pMute.onClick = () => this.toggleMute();
    this.pauseUi.add([this.pauseBg, this.pauseTitle, this.pauseHint,
      this.pResume.container, this.pMenu.container, this.pMute.container]);

    // ---------- dotyková tlačítka pauza / zvuk (roh, jen na dotyk) ----------
    if (PS.isTouch) {
      this.pauseBtn = this.iconButton(0, 0, 'II', () => this.togglePause());
      this.muteBtn = this.iconButton(0, 0, PS.Audio.muted ? '🔇' : '🔊', () => this.toggleMute());
    }

    // ---------- klávesy (PC) ----------
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === binds.pause && !e.repeat) this.togglePause();
      else if (e.code === 'Escape' && this.paused) this.quitToMenu();
      else if (e.code === 'KeyM' && !e.repeat) this.toggleMute();
    });

    // ---------- plovoucí joystick (host = tato scéna) ----------
    if (PS.Touch) PS.Touch.attach(this);

    // ---------- rozmístění + reakce na změnu velikosti / celé obrazovky ----------
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.gameScene.events.off('announce', this.onAnnounce, this);
    });
  }

  // malé kruhové ikonové tlačítko (pauza/zvuk) v rohu HUD
  iconButton(x, y, glyph, onTap) {
    const bg = this.add.circle(x, y, 26, 0x111133, 0.7)
      .setStrokeStyle(2, PS.COLORS.cyan, 0.8).setDepth(80).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const tx = this.add.text(x, y, glyph, {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(81).setScrollFactor(0);
    bg.on('pointerdown', () => onTap());
    return { bg, tx, setGlyph: g => tx.setText(g) };
  }

  // přepočítá pozice prvků podle bezpečných okrajů (mobil: ENVELOP ořez)
  layout() {
    const W = this.scale.width, H = this.scale.height;
    const ins = PS.UI.safeInset(this);
    const SX = ins.left, SY = ins.top, SR = W - ins.right, SB = H - ins.bottom;
    const SCX = (SX + SR) / 2, SW = SR - SX;
    this.safe = { x: SX, y: SY, r: SR, b: SB, cx: SCX, w: SW };

    this.xpBg.setSize(SW - 16, 16).setPosition(SCX, SY + 12);
    this.xpBar.setSize(SW - 20, 10).setPosition(SX + 10, SY + 12);
    this.levelText.setPosition(SR - 14, SY + 36);
    this.timeText.setPosition(SCX, SY + 44);
    this.bossFightLabel.setPosition(SCX, SY + 64);
    this.hpBg.setPosition(SX + 14, SY + 36);
    this.hpBar.setPosition(SX + 16, SY + 38);
    this.hpText.setPosition(SX + 134, SY + 45);
    this.buffText.setPosition(SX + 14, SY + 62);
    this.killsText.setPosition(SR - 14, SY + 64);
    this.weaponsText.setPosition(SX + 14, SB - 14);
    this.bossName.setPosition(SCX, SY + 76);
    this.bossBg.setPosition(SCX, SY + 94);
    this.bossBar.setPosition(SCX - 210, SY + 94);

    // pauza — vycentrovat do bezpečné oblasti
    const pcy = (SY + SB) / 2;
    this.pauseBg.setPosition(W / 2, H / 2);
    this.pauseTitle.setPosition(SCX, pcy - 110);
    this.pResume.container.setPosition(SCX, pcy - 10);
    this.pMenu.container.setPosition(SCX, pcy + 58);
    this.pMute.container.setPosition(SCX, pcy + 122);
    this.pauseHint.setPosition(SCX, pcy + 170);

    // dotyková tlačítka — pravý dolní roh bezpečné oblasti
    if (this.pauseBtn) {
      this.pauseBtn.bg.setPosition(SR - 40, SB - 40); this.pauseBtn.tx.setPosition(SR - 40, SB - 42);
      this.muteBtn.bg.setPosition(SR - 104, SB - 40); this.muteBtn.tx.setPosition(SR - 104, SB - 40);
    }
  }

  toggleMute() {
    PS.Audio.setMuted(!PS.Audio.muted);
    if (this.muteBtn) this.muteBtn.setGlyph(PS.Audio.muted ? '🔇' : '🔊');
    if (this.pMute) this.pMute.setLabel(PS.Audio.muted ? 'ZVUK: VYP' : 'ZVUK: ZAP');
    PS.UI.toast(this, PS.Audio.muted ? 'ZVUK: VYPNUTO' : 'ZVUK: ZAPNUTO');
  }

  togglePause() {
    if (this.scene.isActive('LevelUp') || this.scene.isActive('Runda')) return; // během overlayů nepauzovat
    this.paused = !this.paused;
    this.pauseUi.setVisible(this.paused);
    if (this.pMute) this.pMute.setLabel(PS.Audio.muted ? 'ZVUK: VYP' : 'ZVUK: ZAP');
    if (PS.Touch) PS.Touch.reset();
    if (this.paused) this.scene.pause('Game');
    else this.scene.resume('Game');
  }

  quitToMenu() {
    if (PS.Touch) PS.Touch.reset();
    this.scene.stop('Game');
    this.scene.start('Menu'); // start z HUD zároveň HUD ukončí
  }

  onAnnounce({ text, color }) {
    const s = this.safe || { cx: this.scale.width / 2, y: 0 };
    const t = PS.UI.text(this, s.cx, s.y + 130, text, 15, PS.UI.hex(color));
    t.setShadow(0, 0, PS.UI.hex(color), 8, true, true);
    t.setAlpha(0).setDepth(50);
    this.tweens.add({
      targets: t, alpha: 1, duration: 200,
      onComplete: () => this.tweens.add({
        targets: t, alpha: 0, y: s.y + 110, delay: 1800, duration: 500,
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
    // boss fight: časomíra stojí + pulzující štítek
    if (g.bossFight) {
      this.bossFightLabel.setVisible(true).setAlpha(0.55 + 0.45 * Math.sin(this.time.now / 200));
      this.timeText.setColor('#ff8888');
    } else {
      this.bossFightLabel.setVisible(false);
      this.timeText.setColor('#ffffff');
    }
    const hpFrac = Phaser.Math.Clamp(g.hp / g.stats.maxHp, 0, 1);
    this.hpBar.scaleX = hpFrac;
    this.hpText.setText(Math.max(0, Math.ceil(g.hp)) + ' / ' + g.stats.maxHp);
    this.killsText.setText('KILLS: ' + g.kills);
    if (g.weapons) {
      this.weaponsText.setText(g.weapons.map(w => `${w.def.name.toUpperCase()} ${w.level}`).join('\n'));
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
    g.enemies.children.iterate(e => { if (!boss && e && e.active && e.isBoss) boss = e; });
    if (boss) {
      this.bossUi.setVisible(true);
      this.bossName.setText(boss.bossName);
      this.bossBar.scaleX = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    } else {
      this.bossUi.setVisible(false);
    }

    // šipka k Rundě panclů — přilepená k okraji bezpečné oblasti
    const s = this.safe;
    if (g.runda && s) {
      const cam = g.cameras.main;
      const W = this.scale.width, H = this.scale.height;
      const dx = g.runda.x - (cam.scrollX + W / 2);
      const dy = g.runda.y - (cam.scrollY + H / 2);
      const halfW = s.w / 2 - 56, halfH = (s.b - s.y) / 2 - 56;
      if (Math.abs(dx) < halfW && Math.abs(dy) < halfH) {
        this.rundaArrow.setVisible(false);
      } else {
        const t = Math.min(halfW / Math.abs(dx || 1e-6), halfH / Math.abs(dy || 1e-6));
        this.rundaArrow.setVisible(true)
          .setPosition(s.cx + dx * t, (s.y + s.b) / 2 + dy * t)
          .setRotation(Math.atan2(dy, dx))
          .setAlpha(0.65 + 0.35 * Math.sin(this.time.now / 150));
      }
    } else {
      this.rundaArrow.setVisible(false);
    }
  }
};
PS.scenes.push(window.HUDScene);
