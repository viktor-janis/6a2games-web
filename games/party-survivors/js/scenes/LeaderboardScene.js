// ============================================================
// LeaderboardScene — globální TOP 10 časů (online, Cloudflare Worker + D1)
// Sloupce: pořadí · jméno · hrdina · datum · čas
// ============================================================
window.LeaderboardScene = class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  create() {
    const { width: W, height: H } = this.scale;
    this._dead = false;
    this.events.once('shutdown', () => { this._dead = true; });

    PS.UI.clubBackdrop(this); // tmavá klubová atmosféra (sjednoceno s hrou)

    PS.UI.title(this, W / 2, 78, 'LEADERBOARD', 44, PS.COLORS.cyan);
    PS.UI.text(this, W / 2, 132, 'GLOBÁLNÍ TOP 10 — NEJDELŠÍ PŘEŽITÍ', 12, PS.UI.hex(PS.COLORS.yellow));

    this.statusText = this.add.text(W / 2, H / 2 - 20, 'NAČÍTÁM…', {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BODY, fontSize: '16px',
      color: '#ccccdd', align: 'center',
    }).setOrigin(0.5);

    // tlačítko zpět + klávesy
    const back = PS.UI.button(this, W / 2, H - 64, 360, 60, 'ZPĚT');
    back.setSelected(true);
    back.onClick = () => this.toMenu();
    this.input.keyboard.on('keydown-ESC', () => this.toMenu());
    this.input.keyboard.on('keydown-ENTER', () => this.toMenu());
    this.input.keyboard.on('keydown-SPACE', () => this.toMenu());

    PS.UI.text(this, W / 2, H - 18, 'ENTER / ESC: ZPĚT', 10, '#8888aa');

    this.loadScores();
  }

  toMenu() { PS.Audio.select(); this.scene.start('Menu'); }

  async loadScores() {
    const scores = await PS.LB.fetchTop();
    if (this._dead) return; // hráč už odešel z obrazovky

    if (scores === null) {
      this.statusText.setText('ŽEBŘÍČEK NENÍ DOSTUPNÝ.\nZKONTROLUJ PŘIPOJENÍ K INTERNETU.');
      return;
    }
    if (scores.length === 0) {
      this.statusText.setText('ZATÍM TU NEJSOU ŽÁDNÉ ČASY.\nBUĎ PRVNÍ V ŽEBŘÍČKU!');
      return;
    }
    this.statusText.destroy();
    this.renderRows(scores);
  }

  renderRows(scores) {
    const { width: W } = this.scale;
    const xRank = W / 2 - 470;
    const xName = W / 2 - 410;
    const xHero = W / 2 - 110;
    const xDate = W / 2 + 200;
    const xTime = W / 2 + 470;

    const headY = 188;
    this.cell(xName, headY, 'JMÉNO', '#8888aa', 0, 12);
    this.cell(xHero, headY, 'HRDINA', '#8888aa', 0, 12);
    this.cell(xDate, headY, 'DATUM', '#8888aa', 0, 12);
    this.cell(xTime, headY, 'ČAS', '#8888aa', 1, 12);

    scores.forEach((s, i) => {
      const y = headY + 36 + i * 40;
      const top3 = i < 3;
      const medal = ['#ffd700', '#c0c0c0', '#cd7f32']; // zlatá/stříbrná/bronz
      const rankCol = top3 ? medal[i] : '#8888aa';
      const mainCol = i === 0 ? PS.UI.hex(PS.COLORS.yellow) : '#ffffff';
      this.cell(xRank, y, (i + 1) + '.', rankCol, 0, 16);
      this.cell(xName, y, s.name || '???', mainCol, 0, 16);
      this.cell(xHero, y, s.hero || '', '#ccccdd', 0, 14);
      this.cell(xDate, y, this.fmtDate(s.date), '#9999aa', 0, 13);
      this.cell(xTime, y, PS.UI.fmtTime(s.time), mainCol, 1, 16);
    });
  }

  cell(x, y, str, color, originX, size) {
    return this.add.text(x, y, str, {
      fontFamily: PS.UI.FONT, fontStyle: PS.UI.W_BODY, fontSize: size + 'px', color,
    }).setOrigin(originX, 0.5);
  }

  fmtDate(ms) {
    const d = new Date(Number(ms));
    if (!ms || isNaN(d.getTime())) return '';
    return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear();
  }
};
PS.scenes.push(window.LeaderboardScene);
