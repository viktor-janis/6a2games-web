// ============================================================
// hub-music.js — sdílená hudba na pozadí pro 6&2 Games.
// ------------------------------------------------------------
// Hraje jako smyčka v "menu" kontextech webu (rozcestník + menu obou her) a
// utichne, jakmile začne samotná hra (volá HubMusic.stopForGame()). Po návratu
// do menu (HubMusic.play()) naváže DALŠÍM trackem ve smyčce.
//
// Stav (track + pozice + ztlumení) je v localStorage, takže se pamatuje napříč
// stránkami (stejný origin). Streamuje vždy JEN aktuální track (jeden <audio>,
// mění se src) — nestáhne se všech 7 naráz.
//
// Cesty k MP3 se počítají vůči umístění TOHOTO skriptu (document.currentScript),
// takže fungují z rozcestníku i z games/*/ , lokálně (file://) i na 6a2games.cz.
//
// Veřejné API (window.HubMusic):
//   play()         – přehraj/naváž v menu kontextu (po 1. gestu kvůli autoplay)
//   pause()        – pozastav a ulož pozici (bez posunu)
//   stopForGame()  – odchod do hry: zastav a posuň na DALŠÍ track
//   toggleMute()   – přepni ztlumení (vrací nový stav); isMuted()
// ============================================================
(function () {
  // pořadí dle abecedy (viz hudba/compressed/) — pevná smyčka
  var TRACKS = [
    'bazina-mix2.mp3',
    'bon-apetit-mix5.mp3',
    'fotbalky-mix2.mp3',
    'haribo-mix4.mp3',
    'nikdy-se-nevyseru-na-brachu-mix2.mp3',
    'shake-mix4.mp3',
    'sladarna-mix-3.mp3',
  ];
  var VOLUME = 0.5;
  var K_IDX = 'hub_music_idx', K_POS = 'hub_music_pos', K_MUTE = 'hub_music_muted';
  var N = TRACKS.length;

  // základ pro cesty = složka tohoto skriptu (currentScript platí při parsování)
  var base = (document.currentScript && document.currentScript.src) || location.href;
  function urlFor(name) { return new URL('hudba/compressed/' + name, base).href; }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ } }

  function getIdx() { var v = parseInt(lsGet(K_IDX), 10); return (v >= 0 && v < N) ? v : 0; }
  function getPos() { var v = parseFloat(lsGet(K_POS)); return (isFinite(v) && v > 0) ? v : 0; }
  function isMuted() { return lsGet(K_MUTE) === '1'; }

  var audio = new Audio();
  audio.preload = 'auto';
  audio.loop = false;
  audio.volume = VOLUME;
  audio.muted = isMuted();

  var started = false;      // už načten/hraje aktuální track
  var gestureArmed = false;

  function saveProgress() {
    if (!started) return;
    var t = audio.currentTime;
    if (t > 0 && isFinite(t)) lsSet(K_POS, t);
  }

  function loadTrack(i, pos) {
    audio.src = urlFor(TRACKS[i]);
    if (pos > 0) {
      var seek = function () {
        try { audio.currentTime = pos; } catch (e) { /* noop */ }
        audio.removeEventListener('loadedmetadata', seek);
      };
      audio.addEventListener('loadedmetadata', seek);
    }
  }

  function tryPlay() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { armGesture(); });
  }

  // autoplay je do 1. gesta blokované → spustit po prvním kliknutí/ťuknutí/klávese
  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    var evs = ['pointerdown', 'keydown', 'touchstart'];
    var go = function () {
      gestureArmed = false;
      evs.forEach(function (ev) { window.removeEventListener(ev, go, true); });
      var p = audio.play(); if (p && p.catch) p.catch(function () { /* stále blok */ });
    };
    evs.forEach(function (ev) { window.addEventListener(ev, go, true); });
  }

  audio.addEventListener('ended', function () {
    var i = (getIdx() + 1) % N;
    lsSet(K_IDX, i); lsSet(K_POS, 0);
    loadTrack(i, 0);
    tryPlay();
  });

  // průběžné ukládání pozice (škrceno na ~2 s)
  var lastSave = 0;
  audio.addEventListener('timeupdate', function () {
    var t = Date.now();
    if (t - lastSave > 2000) { lastSave = t; saveProgress(); }
  });

  var HubMusic = {
    play: function () {
      audio.muted = isMuted();
      if (started && !audio.paused) return;          // už hraje
      if (!started) { started = true; loadTrack(getIdx(), getPos()); }
      tryPlay();
    },
    pause: function () {
      saveProgress();
      try { audio.pause(); } catch (e) { /* noop */ }
    },
    // přechod z menu DO hry: zastav a posuň na další track (po návratu zahraje další)
    stopForGame: function () {
      try { audio.pause(); } catch (e) { /* noop */ }
      var i = (getIdx() + 1) % N;
      lsSet(K_IDX, i); lsSet(K_POS, 0);
      started = false; // příští play() nahraje nový track od začátku
    },
    toggleMute: function () {
      var m = !isMuted();
      lsSet(K_MUTE, m ? '1' : '0');
      audio.muted = m;
      return m;
    },
    isMuted: isMuted,
  };
  window.HubMusic = HubMusic;

  // uložit pozici při odchodu / skrytí stránky
  window.addEventListener('pagehide', saveProgress);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveProgress(); });

  // auto-start: každá stránka s tímto skriptem startuje v "menu" kontextu
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { HubMusic.play(); });
  } else {
    HubMusic.play();
  }
})();
