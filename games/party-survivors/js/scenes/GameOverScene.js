// ============================================================
// GameOverScene — výsledek běhu: čas/level/killy + statistiky výbavy
// (zbraně: level, odvedený damage a killy formou damage-meteru;
//  vlastněné upgrady jako barevné čipy) + možnost hrát znovu
// ============================================================
window.GameOverScene = class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.result = data || {};
  }

  create() {
    const { width: W, height: H } = this.scale;
    const r = this.result;

    // mobil: zpět na FIT (po herním ENVELOPu) — celá výsledková obrazovka viditelná
    if (PS.isTouch) { this.scale.scaleMode = Phaser.Scale.FIT; this.scale.refresh(); }

    // ---------- pozadí ----------
    PS.UI.glowBlob(this, W * 0.5, H * 0.32, PS.COLORS.red, 9, 0.10).setDepth(-3);
    PS.UI.glowBlob(this, W * 0.12, H * 0.82, PS.COLORS.purple, 8, 0.08).setDepth(-3);
    PS.UI.confetti(this, 400).setDepth(-3);

    // ---------- titulek ----------
    PS.UI.title(this, W / 2, 54, 'KONEC PÁRTY', 40, PS.COLORS.red);
    if (r.heroName) PS.UI.text(this, W / 2, 96, `HRDINA: ${r.heroName.toUpperCase()}`, 12, '#ccccdd');

    // ---------- levý sloupec: skóre + tlačítka ----------
    const LX = 322;
    PS.UI.text(this, LX, 166, 'PŘEŽIL JSI', 13, '#8888aa');
    const timeT = PS.UI.title(this, LX, 220, PS.UI.fmtTime(r.time || 0), 50, PS.COLORS.yellow);
    this.tweens.add({
      targets: timeT, scale: { from: 1, to: 1.05 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    PS.UI.text(this, LX, 284, `LEVEL ${r.level || 1}   ·   KILLS ${r.kills || 0}`, 13, '#ccccdd');

    if (r.isRecord) {
      const rec = PS.UI.title(this, LX, 326, 'NOVÝ REKORD!', 17, PS.COLORS.pink);
      this.tweens.add({ targets: rec, alpha: { from: 1, to: 0.4 }, duration: 500, yoyo: true, repeat: -1 });
    } else if (r.best > 0) {
      PS.UI.text(this, LX, 326,
        `REKORD: ${PS.UI.fmtTime(r.best)}${r.bestName ? ' — ' + r.bestName : ''}`, 11, '#8888aa');
    }

    const again = PS.UI.button(this, LX, 432, 430, 56, 'HRÁT ZNOVU');
    const menu = PS.UI.button(this, LX, 502, 430, 56, 'ZPĚT DO MENU');
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

    // ---------- pravý sloupec: statistiky výbavy ----------
    this.buildStats(r.weapons || [], r.passives || []);
  }

  // ---------- malé textové/měřící helpery ----------
  statText(x, y, str, size, color, ox = 0, oy = 0.5) {
    return this.add.text(x, y, str, {
      fontFamily: PS.UI.FONT, fontSize: size + 'px', color,
    }).setOrigin(ox, oy);
  }
  measureW(str, size) {
    const t = this.add.text(0, 0, str, { fontFamily: PS.UI.FONT, fontSize: size + 'px' });
    const w = t.width; t.destroy(); return w;
  }
  fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : '' + n; }

  // ---------- panel statistik (damage-meter + čipy upgradů) ----------
  buildStats(weapons, passives) {
    const PANEL_L = 582, PANEL_R = 1242;
    const X0 = PANEL_L + 22, X1 = PANEL_R - 24;
    const cx = (PANEL_L + PANEL_R) / 2;
    const cyan = PS.COLORS.cyan;

    // sloupce vpravo (zarovnané doprava) + konec nejdelšího baru
    const killX = X1, dmgX = X1 - 78, lvX = X1 - 162, barMaxX = lvX - 60;
    const barX = X0;

    const headerY = 168;
    const rowTop = headerY + 36;
    const rowH = 38;
    const n = weapons.length;
    const maxDmg = Math.max(1, ...weapons.map(w => w.damage));

    // --- rozvržení čipů upgradů (předpočítat kvůli výšce panelu) ---
    const upHeaderY = rowTop + Math.max(0, n - 1) * rowH + rowH / 2 + 22;
    const chipY0 = upHeaderY + 30, chipH = 24, chipGap = 8, lineH = chipH + 8;
    const chips = [];
    let chx = X0, chy = chipY0;
    passives.forEach(p => {
      const str = `${p.name.toUpperCase()}  ×${p.level}`;
      const w = this.measureW(str, 10) + 22;
      if (chx + w > X1 && chx > X0) { chx = X0; chy += lineH; }
      chips.push({ str, x: chx, y: chy, w });
      chx += w + chipGap;
    });
    const contentBottom = passives.length ? (chy + chipH / 2) : (chipY0 + 4);

    // --- podkladový panel (nakreslit PŘED obsah) ---
    const panelTop = headerY - 28, panelBottom = contentBottom + 16;
    this.add.rectangle(cx, (panelTop + panelBottom) / 2, PANEL_R - PANEL_L, panelBottom - panelTop, cyan, 0.04)
      .setStrokeStyle(2, cyan, 0.45);

    // --- hlavička sekce zbraní + sloupců ---
    this.statText(X0, headerY, 'ZBRANĚ', 14, PS.UI.hex(cyan), 0, 0.5);
    this.statText(lvX, headerY, 'LV', 9, '#8888aa', 1, 0.5);
    this.statText(dmgX, headerY, 'DMG', 9, '#8888aa', 1, 0.5);
    this.statText(killX, headerY, 'KILL', 9, '#8888aa', 1, 0.5);

    // --- řádky zbraní (damage-meter) ---
    weapons.forEach((w, i) => {
      const yc = rowTop + i * rowH;
      const colStr = PS.UI.hex(w.color);
      const fillW = Math.max(10, (barMaxX - barX) * (w.damage / maxDmg));

      // barevný pruh řádku + bar dle damage + levý accent
      this.add.rectangle(cx, yc, PANEL_R - PANEL_L - 24, rowH - 6, w.color, 0.07);
      this.add.rectangle(barX, yc, fillW, rowH - 12, w.color, 0.34).setOrigin(0, 0.5);
      this.add.rectangle(barX, yc, 4, rowH - 12, w.color, 1).setOrigin(0, 0.5);

      // jméno na baru + číselné sloupce
      this.statText(barX + 14, yc, w.name.toUpperCase(), 11, colStr, 0, 0.5)
        .setShadow(0, 0, colStr, 6, true, true);
      this.statText(lvX, yc, 'Lv' + w.level, 10, PS.UI.hex(PS.COLORS.yellow), 1, 0.5);
      this.statText(dmgX, yc, this.fmtNum(w.damage), 10, '#ffffff', 1, 0.5);
      this.statText(killX, yc, '' + w.kills, 10, '#ff7a7a', 1, 0.5);
    });

    // --- sekce upgradů (čipy) ---
    this.statText(X0, upHeaderY, 'UPGRADY', 14, PS.UI.hex(cyan), 0, 0.5);
    if (!passives.length) {
      this.statText(X0, chipY0, 'ŽÁDNÉ', 10, '#8888aa', 0, 0.5);
    } else {
      chips.forEach(c => {
        this.add.rectangle(c.x + c.w / 2, c.y, c.w, chipH, cyan, 0.12).setStrokeStyle(1, cyan, 0.5);
        this.statText(c.x + 11, c.y, c.str, 10, PS.UI.hex(cyan), 0, 0.5);
      });
    }
  }

  select(i) {
    if (this.selectedIndex !== i) PS.Audio.ui();
    this.selectedIndex = i;
    this.items.forEach((btn, j) => btn.setSelected(j === i));
  }
};
PS.scenes.push(window.GameOverScene);
