// ============================================================
// Party Survivors — vstupní bod: konfigurace Phaseru + start hry
// ============================================================
(function () {
  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game',
    backgroundColor: '#030008', // temná klubová čerň (postavy vystupují ze tmy)
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      // Mobil: ENVELOP = canvas vyplní celý displej (bez okrajů), přebytek se
      // ořízne. Gameplay je kamera-follow, takže ořez okrajů světa je neškodný;
      // kritický HUD se posouvá přes PS.UI.safeInset(), aby se neořízl.
      // PC: FIT = beze změny (zachová poměr stran, nic se neořízne).
      mode: PS.isTouch ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: PS.scenes, // scény se registrují samy v pořadí <script> tagů
  };

  function start() {
    if (window.__psGame) return;
    window.__psGame = new Phaser.Game(config);
    setupMobile();
  }

  // Mobil: třída pro CSS, odemčení audia po prvním doteku, pauza při otočení
  // na výšku (#rotate překryv řeší CSS @media). Vše neškodné na PC.
  function setupMobile() {
    if (PS.isTouch) {
      document.documentElement.classList.add('touch');
      window.addEventListener('contextmenu', e => e.preventDefault());
    }
    window.addEventListener('pointerdown', () => { if (PS.Audio) PS.Audio.ensure(); }, { once: true });

    const onOrient = () => {
      const g = window.__psGame;
      if (!g) return;
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const hud = g.scene.getScene('HUD');
      if (portrait && g.scene.isActive('Game') && hud && !hud.paused) hud.togglePause();
    };
    window.addEventListener('orientationchange', () => setTimeout(onOrient, 250));
    window.addEventListener('resize', onOrient);
  }

  // Počkat na font Baloo 2 (max 2,5 s), aby texty nenaskočily špatně.
  // Důležité: vzorek s českou diakritikou vynutí načtení latin-ext subsetu —
  // canvas text sám o sobě stažení subsetu nespustí. Načítáme oba tučné řezy.
  const CZ_SAMPLE = 'PŘEŽIJ ĚŠČŘŽÝÁÍÉÚŮĎŤŇ ěščřžýáíéúůďťň';
  const fontReady = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('700 16px "Baloo 2"', CZ_SAMPLE),
        document.fonts.load('800 16px "Baloo 2"', CZ_SAMPLE),
      ]).then(() => document.fonts.ready)
    : Promise.resolve();
  const timeout = new Promise(resolve => setTimeout(resolve, 2500));

  Promise.race([fontReady, timeout]).then(start, start);
})();
