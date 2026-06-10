// ============================================================
// HeroSelectScene — výběr z 9 hrdinů (mřížka 3×3 + detail panel)
// Detail zobrazuje doslovné texty ze sloupců Intro 1./2. řádek
// ============================================================
window.HeroSelectScene = class HeroSelectScene extends Phaser.Scene {
  constructor() { super('HeroSelect'); }

  create() {
    const { width: W, height: H } = this.scale;

    PS.UI.clubBackdrop(this); // tmavá klubová atmosféra (sjednoceno s hrou)

    PS.UI.title(this, W / 2, 52, 'VYBER SI HRDINU', 30, PS.COLORS.pink);

    // ---------- mřížka 3×3 ----------
    const COLS = 3;
    const cardW = 270, cardH = 130, gap = 18;
    const gridW = COLS * cardW + (COLS - 1) * gap;
    const startX = (W - gridW) / 2 + cardW / 2;
    const startY = 175;

    this.cards = PS.HEROES.map((hero, i) => {
      const x = startX + (i % COLS) * (cardW + gap);
      const y = startY + Math.floor(i / COLS) * (cardH + gap);

      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, cardW, cardH, hero.color, 0.04)
        .setStrokeStyle(2, PS.COLORS.cyan, 0.3);
      const portrait = this.add.image(0, -12, 'hero-' + hero.id).setScale(1.1);
      const name = this.add.text(0, 48, hero.name, {
        fontFamily: PS.UI.FONT, fontSize: '13px', color: '#ccccdd',
      }).setOrigin(0.5);
      container.add([bg, portrait, name]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.select(i));
      bg.on('pointerdown', () => { this.select(i); this.confirm(); });

      return { hero, container, bg, portrait, name };
    });

    // ---------- detail panel ----------
    const panelY = 610;
    this.add.rectangle(W / 2, panelY, 1080, 150, PS.COLORS.cyan, 0.04)
      .setStrokeStyle(2, PS.COLORS.cyan, 0.5);
    this.detailName = PS.UI.text(this, W / 2, panelY - 50, '', 22, '#ffffff');
    this.detailIntro1 = this.add.text(W / 2, panelY - 12, '', {
      fontFamily: PS.UI.FONT, fontSize: '16px', color: '#ccccdd',
      align: 'center', wordWrap: { width: 1020 },
    }).setOrigin(0.5);
    this.detailIntro2 = this.add.text(W / 2, panelY + 30, '', {
      fontFamily: PS.UI.FONT, fontSize: '16px', color: '#ccccdd',
      align: 'center', wordWrap: { width: 1020 },
    }).setOrigin(0.5);

    // ---------- ovládání ----------
    this.selectedIndex = 0;
    this.select(0);

    this.input.keyboard.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard.on('keydown-UP', () => this.move(-COLS));
    this.input.keyboard.on('keydown-DOWN', () => this.move(COLS));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.confirm(); });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) this.confirm(); });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    PS.UI.text(this, W / 2, H - 22, 'ŠIPKY: VÝBĚR   ·   ENTER: POTVRDIT   ·   ESC: ZPĚT', 10, '#8888aa');
  }

  move(delta) {
    const n = this.cards.length;
    this.select(((this.selectedIndex + delta) % n + n) % n);
  }

  select(i) {
    if (this.selectedIndex !== i) PS.Audio.ui();
    this.selectedIndex = i;
    this.cards.forEach((card, j) => {
      const sel = j === i;
      card.bg.setFillStyle(card.hero.color, sel ? 0.18 : 0.04);
      card.bg.setStrokeStyle(sel ? 3 : 2, sel ? card.hero.color : PS.COLORS.cyan, sel ? 1 : 0.3);
      card.name.setColor(sel ? PS.UI.hex(card.hero.color) : '#ccccdd');
      card.container.setScale(sel ? 1.05 : 1);
      card.container.setDepth(sel ? 1 : 0);
    });

    const hero = this.cards[i].hero;
    this.detailName.setText(hero.name).setColor(PS.UI.hex(hero.color));
    this.detailIntro1.setText(hero.intro1);
    this.detailIntro2.setText(hero.intro2);
  }

  confirm() {
    const hero = this.cards[this.selectedIndex].hero;
    this.registry.set('heroId', hero.id);
    if (this.scene.manager.getScene('Game')) {
      this.scene.start('Game', { heroId: hero.id });
    } else {
      PS.UI.toast(this, 'SAMOTNÁ HRA PŘIJDE V DALŠÍ FÁZI');
    }
  }
};
PS.scenes.push(window.HeroSelectScene);
