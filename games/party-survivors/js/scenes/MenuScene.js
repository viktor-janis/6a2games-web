// ============================================================
// MenuScene — hlavní menu: START / VYSVĚTLIVKY / NASTAVENÍ
// ============================================================
window.MenuScene = class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const { width: W, height: H } = this.scale;

    // mobil: menu na FIT (obnovit z herního ENVELOPu) — vše viditelné, libovolná orientace
    if (PS.isTouch) PS.applyScaleMode(this, Phaser.Scale.FIT);

    // HTML šipka „« ZPĚT" (partysurvivors.html) — jen v hlavním menu,
    // jinde by překážela (ve hře je v levém horním rohu HP bar)
    const back = document.getElementById('back-home');
    if (back) {
      back.style.display = 'block';
      this.events.once('shutdown', () => { back.style.display = 'none'; });
      // Návrat na rozcestník: přišli-li jsme z menu webu (rozcestník při odchodu do
      // hry uloží značku do sessionStorage), vrať se HISTORIÍ → rozcestník se obnoví
      // z bfcache a jeho ambient zvuk zase naběhne sám. (Čerstvé načtení by kvůli
      // autoplay pravidlu hrálo až po gestu.) Jinak nech proběhnout výchozí odkaz.
      if (!back.dataset.hubWired) {
        back.dataset.hubWired = '1';
        back.addEventListener('click', (e) => {
          try {
            if (sessionStorage.getItem('from-hub') === '1' && history.length > 1) {
              sessionStorage.removeItem('from-hub');
              e.preventDefault();
              history.back();
            }
          } catch (err) { /* nech proběhnout výchozí odkaz */ }
        });
      }
    }

    // Pozadí — tmavá klubová atmosféra (sjednoceno s vizuálem hry)
    PS.UI.clubBackdrop(this);

    // Titulek
    const title = PS.UI.title(this, W / 2, 130, 'PARTY SURVIVORS', 52, PS.COLORS.pink);
    this.tweens.add({
      targets: title, scale: { from: 1, to: 1.04 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    PS.UI.text(this, W / 2, 195, 'PŘEŽIJ TUHLE KALBU', 13, PS.UI.hex(PS.COLORS.yellow));

    // legacy úklid starého bezejmenného rekordu (osobní rekord se v menu
    // už nezobrazuje — globální výsledky jsou pod položkou LEADERBOARD)
    try { localStorage.removeItem(PS.STORAGE.best); } catch (e) { /* private mode */ }

    // Položky menu
    const labels = ['START', 'VYSVĚTLIVKY', 'NASTAVENÍ', 'LEADERBOARD'];
    const actions = [
      () => this.startGame(),
      () => this.scene.start('Help'),
      () => this.scene.start('Settings'),
      () => this.scene.start('Leaderboard'),
    ];
    this.items = labels.map((label, i) => {
      const btn = PS.UI.button(this, W / 2, 300 + i * 100, 460, 72, label);
      btn.onHover = () => this.select(i);
      btn.onClick = () => { this.select(i); actions[i](); };
      return btn;
    });
    this.actions = actions;
    this.selectedIndex = 0;
    this.select(0);

    // Ovládání klávesnicí
    this.input.keyboard.on('keydown-UP', () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard.on('keydown-W', () => this.move(-1));
    this.input.keyboard.on('keydown-S', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.confirm(); });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) this.confirm(); });

    // Nápověda dole
    PS.UI.text(this, W / 2, H - 28, 'VÝBĚR: ŠIPKY NEBO MYŠ   ·   POTVRZENÍ: ENTER   ·   M: ZVUK', 10, '#8888aa');
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) {
        PS.Audio.setMuted(!PS.Audio.muted);
        PS.UI.toast(this, PS.Audio.muted ? 'ZVUK: VYPNUTO' : 'ZVUK: ZAPNUTO');
      }
    });
  }

  move(dir) {
    this.select((this.selectedIndex + dir + this.items.length) % this.items.length);
  }

  select(i) {
    if (this.selectedIndex !== i) PS.Audio.ui();
    this.selectedIndex = i;
    this.items.forEach((btn, j) => btn.setSelected(j === i));
  }

  confirm() {
    this.actions[this.selectedIndex]();
  }

  startGame() {
    this.scene.start('Name'); // zadání herního jména → výběr hrdiny
  }
};
PS.scenes.push(window.MenuScene);
