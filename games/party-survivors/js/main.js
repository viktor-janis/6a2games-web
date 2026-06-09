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
      // FIT = zachová poměr stran, NIC se neořízne (vše viditelné) — základ pro
      // PC i mobilní menu. Samotná hra (GameScene) na mobilu přepne na ENVELOP
      // (vyplní displej), aby se hrálo na celou obrazovku; menu zůstávají FIT.
      mode: Phaser.Scale.FIT,
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

    // #rotate „otoč na šířku" se ukazuje JEN během hry (běží HUD) a jen na výšku;
    // v menu (HUD neběží) se nikdy nezobrazí — menu jdou na výšku i na šířku.
    // Při zobrazení hru pauzne.
    const updateRotate = () => {
      const r = document.getElementById('rotate');
      if (!r) return;
      const g = window.__psGame;
      const inGame = !!(g && PS.isTouch && g.scene.isActive('HUD'));
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const show = inGame && portrait;
      r.style.display = show ? 'flex' : 'none';
      if (show) {
        const hud = g.scene.getScene('HUD');
        if (hud && !hud.paused) hud.togglePause();
      }
    };
    window.PS_updateRotate = updateRotate;
    window.addEventListener('orientationchange', () => setTimeout(updateRotate, 250));
    window.addEventListener('resize', updateRotate);
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
