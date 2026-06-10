// ============================================================
// HeroSelectScene — výběr z 9 hrdinů (mřížka 3×3 + detail panel)
// Tok: hover/šipky = NÁHLED detailu · klik na hrdinu = ZAMKNE výběr ·
// teprve pole „CHCI HRÁT ZA …" výběr potvrdí a spustí hru. Vpravo „ZPĚT".
// Detail zobrazuje doslovné texty ze sloupců Intro 1./2. řádek.
// ============================================================
window.HeroSelectScene = class HeroSelectScene extends Phaser.Scene {
  constructor() { super('HeroSelect'); }

  // 4. pád (koho/co) — přesný spelling dle zadání, zobrazí se v poli „CHCI HRÁT ZA"
  static ACC = {
    rashid: 'Rashida', poskok: 'Poskoka', dong: 'Dona G', kaar: 'Kaara',
    fjodor: 'Fjodora Keta', extreme: 'eXtrema', fadadevada: 'fadudevadu',
    zlozik: 'Zložíka', sajmic: 'Sajmiče Uraku',
  };

  create() {
    const { width: W, height: H } = this.scale;

    PS.UI.clubBackdrop(this); // tmavá klubová atmosféra (sjednoceno s hrou)

    PS.UI.title(this, W / 2, 50, 'VYBER SI HRDINU', 30, PS.COLORS.pink);

    // ---------- mřížka 3×3 ----------
    const COLS = 3;
    const cardW = 270, cardH = 118, gap = 16;
    const gridW = COLS * cardW + (COLS - 1) * gap;          // 842
    const gridX0 = (W - gridW) / 2;                          // levý okraj mřížky
    const gridX1 = gridX0 + gridW;                           // pravý okraj mřížky
    const startX = gridX0 + cardW / 2;
    const startY = 168;
    const colStep = cardW + gap, rowStep = cardH + gap;

    this.cards = PS.HEROES.map((hero, i) => {
      const x = startX + (i % COLS) * colStep;
      const y = startY + Math.floor(i / COLS) * rowStep;

      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, cardW, cardH, hero.color, 0.04)
        .setStrokeStyle(2, PS.COLORS.cyan, 0.3);
      const portrait = this.add.image(0, -14, 'hero-' + hero.id).setScale(1.05);
      const name = this.add.text(0, 42, hero.name, {
        fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '16px', color: '#cfcfe0',
      }).setOrigin(0.5);
      const check = this.add.text(cardW / 2 - 15, -cardH / 2 + 13, '✓', {
        fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '20px', color: PS.UI.hex(PS.COLORS.green),
      }).setOrigin(0.5).setVisible(false);
      container.add([bg, portrait, name, check]);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.select(i));
      bg.on('pointerdown', () => { this.select(i); this.lock(i); });

      return { hero, container, bg, portrait, name, check };
    });

    // ---------- spodní řada: [CHCI HRÁT ZA] · [detail] · [ZPĚT] ----------
    const Hpanel = 150;
    const row2Bottom = startY + 2 * rowStep + cardH / 2;
    const bottomY = row2Bottom + gap + Hpanel / 2;
    const M = 18;                                            // okraj obrazovky pro boční pole
    const sideW = (gridX0 - gap) - M;                       // šířka bočních polí (symetrická)
    const backX = M + sideW / 2;                            // ZPĚT vlevo
    const confirmX = gridX1 + gap + sideW / 2;              // CHCI HRÁT ZA vpravo

    // detail panel (uprostřed, na šířku mřížky)
    this.add.rectangle(W / 2, bottomY, gridW, Hpanel, PS.COLORS.cyan, 0.04)
      .setStrokeStyle(2, PS.COLORS.cyan, 0.5);
    this.detailName = PS.UI.text(this, W / 2, bottomY - 50, '', 22, '#ffffff');
    this.detailIntro1 = this.add.text(W / 2, bottomY - 12, '', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BODY, fontSize: '16px', color: '#ccccdd',
      align: 'center', wordWrap: { width: gridW - 44 },
    }).setOrigin(0.5);
    this.detailIntro2 = this.add.text(W / 2, bottomY + 30, '', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BODY, fontSize: '16px', color: '#ccccdd',
      align: 'center', wordWrap: { width: gridW - 44 },
    }).setOrigin(0.5);

    // pole „CHCI HRÁT ZA …" (vlevo) — zelené, klikací jen když je hrdina zamčený
    const cPanel = this.add.container(confirmX, bottomY);
    this.confirmBg = this.add.rectangle(0, 0, sideW, Hpanel, PS.COLORS.green, 0.04)
      .setStrokeStyle(3, PS.COLORS.green, 0.25);
    this.confirmL1 = this.add.text(0, -22, 'CHCI HRÁT ZA', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '17px', color: '#5f7a5f',
    }).setOrigin(0.5);
    this.confirmL2 = this.add.text(0, 16, '', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '20px', color: '#7a7a92',
    }).setOrigin(0.5);
    cPanel.add([this.confirmBg, this.confirmL1, this.confirmL2]);
    this.confirmBg.on('pointerover', () => { if (this.confirmEnabled) { PS.Audio.ui(); this.confirmHover(true); } });
    this.confirmBg.on('pointerout', () => this.confirmHover(false));
    this.confirmBg.on('pointerdown', () => this.startGame());

    // pole „ZPĚT" (vpravo) — červené (stejně jako VZDÁVÁM v pauze)
    const bPanel = this.add.container(backX, bottomY);
    this.backBg = this.add.rectangle(0, 0, sideW, Hpanel, PS.COLORS.red, 0.05)
      .setStrokeStyle(3, PS.COLORS.red, 0.9);
    this.backTxt = this.add.text(0, 0, 'ZPĚT', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BOLD, fontSize: '24px', color: PS.UI.hex(PS.COLORS.red),
    }).setOrigin(0.5);
    this.backTxt.setShadow(0, 0, PS.UI.hex(PS.COLORS.red), 8, true, true);
    bPanel.add([this.backBg, this.backTxt]);
    this.backBg.setInteractive({ useHandCursor: true });
    this.backBg.on('pointerover', () => { PS.Audio.ui(); this.backHover(true); });
    this.backBg.on('pointerout', () => this.backHover(false));
    this.backBg.on('pointerdown', () => this.goBack());

    // ---------- stav + ovládání ----------
    this.previewIndex = 0;     // co je v náhledu (hover/šipky)
    this.lockedIndex = null;   // co je zamčené (klik) → smí potvrdit
    this.confirmEnabled = false;
    this.select(0);
    this.updateConfirm();

    this.input.keyboard.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard.on('keydown-UP', () => this.move(-COLS));
    this.input.keyboard.on('keydown-DOWN', () => this.move(COLS));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.advance(); });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) this.advance(); });
    this.input.keyboard.on('keydown-ESC', () => this.goBack());

    PS.UI.text(this, W / 2, H - 18,
      'ŠIPKY: VÝBĚR   ·   ENTER: ZAMKNOUT / HRÁT   ·   ESC: ZPĚT', 10, '#8888aa');
  }

  move(delta) {
    const n = this.cards.length;
    this.select(((this.previewIndex + delta) % n + n) % n);
  }

  // ENTER/SPACE: nejdřív zamkne náhled, podruhé (už zamčené) spustí hru
  advance() {
    if (this.lockedIndex === this.previewIndex) this.startGame();
    else this.lock(this.previewIndex);
  }

  // náhled detailu — NEzamyká, jen ukáže schopnost/útok
  select(i) {
    if (this.previewIndex !== i) PS.Audio.ui();
    this.previewIndex = i;
    this.refreshCards();
    const hero = this.cards[i].hero;
    this.detailName.setText(hero.name).setColor(PS.UI.hex(hero.color));
    this.detailIntro1.setText(hero.intro1);
    this.detailIntro2.setText(hero.intro2);
  }

  // zamčení vybraného hrdiny (klik) — povolí pole „CHCI HRÁT ZA"
  lock(i) {
    if (this.lockedIndex !== i) PS.Audio.select();
    this.lockedIndex = i;
    this.refreshCards();
    this.updateConfirm();
  }

  refreshCards() {
    this.cards.forEach((card, j) => {
      const isPrev = j === this.previewIndex;
      const isLock = j === this.lockedIndex;
      let stroke, sw, fillA, scale, depth;
      if (isLock) { stroke = PS.COLORS.green; sw = 4; fillA = 0.22; scale = isPrev ? 1.06 : 1.04; depth = 2; }
      else if (isPrev) { stroke = card.hero.color; sw = 3; fillA = 0.16; scale = 1.05; depth = 1; }
      else { stroke = PS.COLORS.cyan; sw = 2; fillA = 0.04; scale = 1; depth = 0; }
      card.bg.setFillStyle(card.hero.color, fillA);
      card.bg.setStrokeStyle(sw, stroke, (isLock || isPrev) ? 1 : 0.3);
      card.name.setColor(isLock ? PS.UI.hex(PS.COLORS.green)
        : isPrev ? PS.UI.hex(card.hero.color) : '#cfcfe0');
      card.container.setScale(scale).setDepth(depth);
      card.check.setVisible(isLock);
    });
  }

  // stav pole „CHCI HRÁT ZA" podle toho, zda je hrdina zamčený
  updateConfirm() {
    const locked = this.lockedIndex !== null;
    this.confirmEnabled = locked;
    if (locked) {
      const hero = this.cards[this.lockedIndex].hero;
      this.confirmL2.setText(HeroSelectScene.ACC[hero.id] || hero.name);
      this.confirmBg.setStrokeStyle(3, PS.COLORS.green, 0.9);
      this.confirmBg.setInteractive({ useHandCursor: true });
    } else {
      this.confirmL2.setText('klikni na hrdinu');
      this.confirmBg.setStrokeStyle(3, PS.COLORS.green, 0.25);
      this.confirmBg.disableInteractive();
    }
    this.confirmHover(false);
  }

  confirmHover(on) {
    if (on && this.confirmEnabled) {
      this.confirmBg.setFillStyle(PS.COLORS.green, 1);
      this.confirmL1.setColor(PS.UI.hex(PS.COLORS.dark));
      this.confirmL2.setColor(PS.UI.hex(PS.COLORS.dark));
    } else if (this.confirmEnabled) {
      this.confirmBg.setFillStyle(PS.COLORS.green, 0.06);
      this.confirmL1.setColor(PS.UI.hex(PS.COLORS.green));
      this.confirmL2.setColor('#ffffff');
    } else {
      this.confirmBg.setFillStyle(PS.COLORS.green, 0.04);
      this.confirmL1.setColor('#5f7a5f');
      this.confirmL2.setColor('#7a7a92');
    }
  }

  backHover(on) {
    if (on) {
      this.backBg.setFillStyle(PS.COLORS.red, 1);
      this.backTxt.setColor(PS.UI.hex(PS.COLORS.dark)).setShadow(0, 0, PS.UI.hex(PS.COLORS.red), 0);
    } else {
      this.backBg.setFillStyle(PS.COLORS.red, 0.05);
      this.backTxt.setColor(PS.UI.hex(PS.COLORS.red)).setShadow(0, 0, PS.UI.hex(PS.COLORS.red), 8, true, true);
    }
  }

  startGame() {
    if (this.lockedIndex === null) return;
    const hero = this.cards[this.lockedIndex].hero;
    PS.Audio.powerup();
    this.registry.set('heroId', hero.id);
    if (this.scene.manager.getScene('Game')) {
      this.scene.start('Game', { heroId: hero.id });
    } else {
      PS.UI.toast(this, 'SAMOTNÁ HRA PŘIJDE V DALŠÍ FÁZI');
    }
  }

  goBack() {
    PS.Audio.ui();
    this.scene.start('Menu');
  }
};
PS.scenes.push(window.HeroSelectScene);
