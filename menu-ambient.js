// ============================================================
// menu-ambient.js — ambientní zvukové pozadí úvodního menu (jen index.html).
// ------------------------------------------------------------
// Tichý, nerušivý oldschool-arkádový ambient (tlumené „bzučení trafa") — NE hudba.
// Syntetizováno přes WebAudio (žádný externí soubor), uzly běží trvale.
// Při najetí myší / focusu na položku menu (.menu-item) se zvuk jemně zesílí
// a „rozžhaví" (otevře se barva), po odjetí klesne zpět.
//
// Autoplay policy prohlížeče: zvuk se rozezní až po 1. uživatelském gestu.
// Když je záložka skrytá, ambient se ztiší (nehučí na pozadí).
//
// Laditelné konstanty jsou pohromadě nahoře — měň je „od ucha".
// window.MenuAmbient.rms() je jen diagnostika (líně připojí analyser; v provozu
// se nevolá, takže nic nevytváří).
// ============================================================
(function () {
  'use strict';

  // ---- Laditelné konstanty (hlasitost / barva / síla swellu) -------------
  var MASTER_BASE    = 0.022;   // celková hlasitost klidového ambientu (tiše!)
  var MASTER_HOVER   = 0.05;    // hlasitost při najetí na položku menu
  var FADE_IN_TAU    = 0.30;    // náběh po 1. gestu (~0,9 s z ticha do base)
  var SWELL_TAU      = 0.07;    // rychlost swellu na hover (~0,2 s)
  var VIS_TAU        = 0.15;    // rychlost ztišení/obnovení při změně záložky

  var BUZZ_FREQ      = 100;     // Hz – základ „bzučení trafa" (harmonické 100/200/300…)
  var BUZZ_TYPE      = 'sawtooth'; // 'triangle' = měkčí
  var BUZZ_GAIN      = 0.6;
  var BUZZ_CUT_BASE  = 600;     // Hz – lowpass: nízko = tlumené
  var BUZZ_CUT_HOVER = 1100;    // mírné otevření při hover (jasnější, ne ostré)

  var SUB_FREQ       = 50;      // Hz – podkres pro dobrá repra (na malých neslyšný)
  var SUB_GAIN       = 0.5;

  var NOISE_GAIN     = 0.28;    // jemný šumový „vzduch"
  var NOISE_CUT      = 400;     // Hz – lowpass šumu

  var LFO_RATE       = 0.15;    // Hz – pomalé „dýchání" barvy
  var LFO_DEPTH      = 120;     // Hz – rozkmit cutoffu buzz filtru

  var CRT_FREQ       = 7500;    // Hz – vysoký CRT třpyt
  var CRT_GAIN       = 0;       // DEFAULTNĚ VYPNUTO (>0 = opatrně zapnout)
  // ------------------------------------------------------------------------

  var ctx = null, master = null, buzzFilter = null, analyser = null;
  var active = 0;      // kolik položek menu je teď pod myší / ve focusu
  var hidden = false;  // záložka skrytá
  var started = false;

  function masterTarget() {
    if (hidden) return 0;
    return active > 0 ? MASTER_HOVER : MASTER_BASE;
  }
  function applyMaster(tau) {
    if (master) master.gain.setTargetAtTime(masterTarget(), ctx.currentTime, tau);
  }
  function applyCutoff(tau) {
    if (buzzFilter) {
      buzzFilter.frequency.setTargetAtTime(
        active > 0 ? BUZZ_CUT_HOVER : BUZZ_CUT_BASE, ctx.currentTime, tau);
    }
  }
  // kontext bývá uspaný po návratu do menu / přepnutí záložky → znovu rozezní
  function resumeIfSuspended() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  // Uspání kontextu při odchodu/skrytí. Důvod: BĚŽÍCÍ AudioContext brání prohlížeči
  // uložit stránku do paměti (bfcache). Uspaný kontext je „bfcache-friendly“ → při
  // návratu (pageshow) se stránka obnoví z paměti a zvuk naskočí BEZ nového gesta
  // (oprávnění hrát si kontext po prvním gestu pamatuje).
  function suspendCtx() {
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { /* noop */ } }
  }

  function build() {
    master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime); // fade-in z ticha (bez lupnutí)
    master.connect(ctx.destination);

    // 1) buzz – sawtooth přes lowpass (hlavní slyšitelná vrstva)
    buzzFilter = ctx.createBiquadFilter();
    buzzFilter.type = 'lowpass';
    buzzFilter.frequency.setValueAtTime(BUZZ_CUT_BASE, ctx.currentTime);
    buzzFilter.Q.value = 0.7; // bez rezonančního píku (žádné pískání)
    var buzz = ctx.createOscillator();
    buzz.type = BUZZ_TYPE;
    buzz.frequency.value = BUZZ_FREQ;
    var buzzGain = ctx.createGain();
    buzzGain.gain.value = BUZZ_GAIN;
    buzz.connect(buzzFilter).connect(buzzGain).connect(master);
    buzz.start();

    // pomalé LFO -> rozkmit cutoffu (timbrové „dýchání", ne tremolo na hlasitosti)
    var lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = LFO_RATE;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = LFO_DEPTH;
    lfo.connect(lfoGain).connect(buzzFilter.frequency); // sčítá se s base cutoffem
    lfo.start();

    // 2) sub hum – tělo pro dobrá repra
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = SUB_FREQ;
    var subGain = ctx.createGain();
    subGain.gain.value = SUB_GAIN;
    sub.connect(subGain).connect(master);
    sub.start();

    // 3) šumový „vzduch" – loop filtrovaného white noise (white se zacyklí bez lupnutí)
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    var noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = NOISE_CUT;
    var noiseGain = ctx.createGain();
    noiseGain.gain.value = NOISE_GAIN;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();

    // 4) volitelný CRT třpyt (default vypnuto)
    if (CRT_GAIN > 0) {
      var crt = ctx.createOscillator();
      crt.type = 'sine';
      crt.frequency.value = CRT_FREQ;
      var crtGain = ctx.createGain();
      crtGain.gain.value = CRT_GAIN;
      crt.connect(crtGain).connect(master);
      crt.start();
    }

    applyMaster(FADE_IN_TAU); // náběh 0 -> base (resp. hover, je-li myš už nad položkou)
    applyCutoff(FADE_IN_TAU);
  }

  function start() {
    if (started) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; } // WebAudio nepodporováno -> tiché vzdání se
    if (!ctx) return;
    started = true;
    build();
    if (ctx.state === 'suspended') ctx.resume();
  }

  // --- start (1. gesto) / obnovení (kontext po návratu uspaný) ---
  // Posluchače ZÁMĚRNĚ neodebíráme: po návratu do menu přes čerstvé načtení
  // stránky stačí jakékoli gesto a ambient zase naskočí.
  var GESTURES = ['pointerdown', 'keydown', 'touchstart'];
  function onGesture() {
    if (!started) start();
    else resumeIfSuspended();
  }
  GESTURES.forEach(function (ev) { window.addEventListener(ev, onGesture, true); });

  // --- hover/focus swell na položkách menu ---
  function enter() { active++; applyMaster(SWELL_TAU); applyCutoff(SWELL_TAU); }
  function leave() { active = Math.max(0, active - 1); applyMaster(SWELL_TAU); applyCutoff(SWELL_TAU); }

  var items = document.querySelectorAll('.menu-item');
  for (var k = 0; k < items.length; k++) {
    items[k].addEventListener('mouseenter', enter);
    items[k].addEventListener('mouseleave', leave);
    items[k].addEventListener('focus', enter);  // klávesnice (Tab)
    items[k].addEventListener('blur', leave);
  }

  // --- skrytá záložka → uspat (ticho na pozadí + stránka jde do bfcache);
  //     návrat → zase rozeznít ---
  document.addEventListener('visibilitychange', function () {
    hidden = document.hidden;
    if (hidden) {
      applyMaster(VIS_TAU); // ztiš (pojistka, kdyby suspend selhal)
      suspendCtx();
    } else {
      resumeIfSuspended();
      applyMaster(VIS_TAU);
    }
  });

  // Odchod ze stránky (do hry i do bfcache) → uspat kontext, ať je stránka
  // znovu-použitelná z paměti prohlížeče.
  window.addEventListener('pagehide', suspendCtx);

  // Návrat na stránku (i obnova z bfcache po tlačítku Zpět / „do menu“) — skript se
  // nemusí spustit znovu a kontext bývá uspaný, tak ho tu probudíme bez dalšího gesta.
  window.addEventListener('pageshow', function () {
    if (!started) return;
    hidden = document.hidden;
    resumeIfSuspended();
    applyMaster(VIS_TAU);
  });

  // --- diagnostika (jen pro ověření; v provozu se nevolá -> analyser nevznikne) ---
  window.MenuAmbient = {
    rms: function () {
      if (!ctx || !master) return 0;
      if (!analyser) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        master.connect(analyser); // odbočka za masterem (analyser je koncový uzel)
      }
      var buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      var s = 0;
      for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    }
  };
})();
