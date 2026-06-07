// ============================================================
// LevelUpScene — overlay: výběr jednoho ze 3 vylepšení
// (nový útok / +25 % DMG vlastněného útoku / pasivní upgrade)
// ============================================================
window.LevelUpScene = class LevelUpScene extends Phaser.Scene {
  constructor() { super('LevelUp'); }

  create() {
    this.gameScene = this.scene.get('Game');
    const { width: W, height: H } = this.scale;

    this.add.rectangle(W / 2, H / 2, W, H, 0x050010, 0.72);
    this.titleText = PS.UI.title(this, W / 2, 110, `LEVEL ${this.gameScene.level}!`, 36, PS.COLORS.yellow);
    PS.UI.text(this, W / 2, 165, 'VYBER SI VYLEPŠENÍ', 13, '#ccccdd');

    this.cardObjs = [];
    this.showChoices(this.gameScene.buildChoices());

    this.input.keyboard.on('keydown-LEFT', () => this.select((this.selectedIndex + 2) % this.choices.length));
    this.input.keyboard.on('keydown-RIGHT', () => this.select((this.selectedIndex + 1) % this.choices.length));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.pick(this.selectedIndex); });
    this.input.keyboard.on('keydown-ONE', () => this.pick(0));
    this.input.keyboard.on('keydown-TWO', () => this.pick(1));
    this.input.keyboard.on('keydown-THREE', () => this.pick(2));

    PS.UI.text(this, W / 2, H - 36, 'ŠIPKY + ENTER · KLIK · KLÁVESY 1/2/3', 10, '#8888aa');
  }

  // popis karty podle typu volby
  cardData(choice) {
    const g = this.gameScene;
    if (choice.type === 'newWeapon') {
      const def = PS.ATTACKS[choice.id];
      return {
        head: 'NOVÝ ÚTOK', color: PS.COLORS.pink,
        name: def.name, desc: def.desc || def.anim,
      };
    }
    if (choice.type === 'weaponUp') {
      const w = g.weapons.find(x => x.id === choice.id);
      return {
        head: 'VYLEPŠENÍ ÚTOKU', color: PS.COLORS.yellow,
        name: w.def.name,
        desc: `Poškození +25 %\n(LV ${w.level} > ${w.level + 1})`,
      };
    }
    if (choice.type === 'weaponPerk') {
      const w = g.weapons.find(x => x.id === choice.id);
      const p = PS.WEAPON_PERKS[choice.id].find(x => x.id === choice.perkId);
      const lvl = w.perk(p.id);
      return {
        head: 'PERK ÚTOKU', color: PS.COLORS.green,
        name: `${w.def.name} — ${p.name}`,
        desc: p.desc + (p.cap > 1 ? `\n(LV ${lvl} > ${lvl + 1})` : ''),
      };
    }
    const u = PS.UPGRADES.find(x => x.id === choice.id);
    const lvl = g.passiveLevels[u.id] || 0;
    return {
      head: 'UPGRADE', color: PS.COLORS.cyan,
      name: u.name,
      desc: `${u.desc}\n(LV ${lvl} > ${lvl + 1})`,
    };
  }

  showChoices(choices) {
    this.choices = choices;
    this.cardObjs.forEach(c => c.container.destroy());
    this.cardObjs = [];

    const { width: W } = this.scale;
    const cardW = 350, cardH = 280, gap = 30;
    const total = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (W - total) / 2 + cardW / 2;

    choices.forEach((choice, i) => {
      const data = this.cardData(choice);
      const x = startX + i * (cardW + gap);
      const y = 400;

      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, cardW, cardH, data.color, 0.06)
        .setStrokeStyle(2, data.color, 0.5);
      const head = PS.UI.text(this, 0, -cardH / 2 + 34, data.head, 11, PS.UI.hex(data.color));
      const name = this.add.text(0, -cardH / 2 + 80, data.name.toUpperCase(), {
        fontFamily: PS.UI.FONT, fontSize: '15px', color: '#ffffff',
        align: 'center', wordWrap: { width: cardW - 40 },
      }).setOrigin(0.5);
      const desc = this.add.text(0, 30, data.desc, {
        fontFamily: PS.UI.FONT, fontSize: '10px', color: '#ccccdd',
        align: 'center', lineSpacing: 8, wordWrap: { width: cardW - 44 },
      }).setOrigin(0.5);
      const num = PS.UI.text(this, -cardW / 2 + 22, -cardH / 2 + 22, String(i + 1), 12, '#8888aa');
      container.add([bg, head, name, desc, num]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.select(i));
      bg.on('pointerdown', () => this.pick(i));

      this.cardObjs.push({ container, bg, data });
    });

    this.select(0);
  }

  select(i) {
    if (i >= this.choices.length) return;
    this.selectedIndex = i;
    this.cardObjs.forEach((c, j) => {
      const sel = j === i;
      c.bg.setFillStyle(c.data.color, sel ? 0.18 : 0.06);
      c.bg.setStrokeStyle(sel ? 3 : 2, c.data.color, sel ? 1 : 0.5);
      c.container.setScale(sel ? 1.05 : 1);
    });
  }

  pick(i) {
    if (i >= this.choices.length) return;
    const g = this.gameScene;
    g.applyChoice(this.choices[i]);
    g.pendingLevelUps--;
    PS.Audio.select();

    if (g.pendingLevelUps > 0) {
      // další nastřádaný level — rovnou další výběr
      this.titleText.setText(`LEVEL ${g.level}!`);
      this.showChoices(g.buildChoices());
    } else {
      g.levelUpOpen = false;
      this.scene.stop();
      this.scene.resume('Game');
      g.cameras.main.flash(150, 80, 255, 120);
      g.burstConfetti(g.player.x, g.player.y);
    }
  }
};
PS.scenes.push(window.LevelUpScene);
