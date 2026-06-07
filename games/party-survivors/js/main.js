// ============================================================
// Party Survivors — vstupní bod: konfigurace Phaseru + start hry
// ============================================================
(function () {
  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game',
    backgroundColor: '#050010',
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: PS.scenes, // scény se registrují samy v pořadí <script> tagů
  };

  function start() {
    if (window.__psGame) return;
    window.__psGame = new Phaser.Game(config);
  }

  // Počkat na font Press Start 2P (max 2,5 s), aby texty nenaskočily špatně.
  // Důležité: vzorek s českou diakritikou vynutí načtení latin-ext subsetu —
  // canvas text sám o sobě stažení subsetu nespustí.
  const CZ_SAMPLE = 'PŘEŽIJ ĚŠČŘŽÝÁÍÉÚŮĎŤŇ ěščřžýáíéúůďťň';
  const fontReady = (document.fonts && document.fonts.load)
    ? document.fonts.load('16px "Press Start 2P"', CZ_SAMPLE).then(() => document.fonts.ready)
    : Promise.resolve();
  const timeout = new Promise(resolve => setTimeout(resolve, 2500));

  Promise.race([fontReady, timeout]).then(start, start);
})();
