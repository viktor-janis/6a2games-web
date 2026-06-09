// ============================================================
// tools/build-music.js — komprese hudby na pozadí + generování seznamu
// ------------------------------------------------------------
// Co dělá:
//   1) Projde MASTERY přímo ve složce  music/  (ne podsložky), seřazené podle
//      názvu — pořadí řídí číselný prefix (01_, 02_, …).
//   2) Každý zkomprimuje na 128 kbps MP3 do  music/compressed/<slug>.mp3
//      (přeskočí, když výstup existuje a je novější než master → rychlé znovu-spuštění).
//   3) Smaže v  music/compressed/  osiřelé MP3 (jejichž master už neexistuje).
//   4) Vygeneruje  js/playlist.js  se seznamem tracků v tom pořadí.
//
// Spuštění:  node tools/build-music.js   (nebo dvojklik na tools/compress-music.bat)
// Potřebuje: ffmpeg v PATH.
//
// Přidání dalšího tracku později: hoď master (wav/mp3/…) do music/ s číselným
// prefixem (např. 05_nazev.wav) a spusť skript — zařadí se sám do rotace.
// ============================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MUSIC_DIR = path.join(ROOT, 'music');
const OUT_DIR = path.join(MUSIC_DIR, 'compressed');
const PLAYLIST = path.join(ROOT, 'js', 'playlist.js');
const BITRATE = '128k';
const SRC_EXT = new Set(['.wav', '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.aif', '.aiff', '.wma']);

function slugify(name) {
  let out = '';
  for (const c of name.normalize('NFD')) {
    const code = c.codePointAt(0);
    if (code >= 0x300 && code <= 0x36f) continue; // pryč kombinující diakritika
    out += c;
  }
  return out.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function fail(msg) { console.error('CHYBA: ' + msg); process.exit(1); }

// ffmpeg dostupný?
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch (e) { fail('ffmpeg není v PATH. Nainstaluj ffmpeg a zkus znovu.'); }

if (!fs.existsSync(MUSIC_DIR)) fail('Složka music/ neexistuje.');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 1) mastery = soubory přímo v music/ (ne podsložky) s audio příponou, seřazené
const masters = fs.readdirSync(MUSIC_DIR, { withFileTypes: true })
  .filter(d => d.isFile() && SRC_EXT.has(path.extname(d.name).toLowerCase()))
  .map(d => d.name)
  .sort((a, b) => a.localeCompare(b, 'cs'));

if (!masters.length) console.warn('Pozor: ve složce music/ nejsou žádné zdrojové skladby.');

// název výstupu = slug masteru (.mp3), s ošetřením kolize slugů
const wanted = new Map(); // outName -> srcPath (pořadí = pořadí masterů)
for (const m of masters) {
  const slug = slugify(path.basename(m, path.extname(m))) || 'track';
  let out = slug + '.mp3', n = 2;
  while (wanted.has(out)) { out = slug + '-' + n + '.mp3'; n++; }
  wanted.set(out, path.join(MUSIC_DIR, m));
}

// 2) komprese (jen chybějící / zastaralé výstupy)
for (const [out, src] of wanted) {
  const dst = path.join(OUT_DIR, out);
  const fresh = fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;
  if (fresh) { console.log('=  ' + out + '  (aktuální, přeskakuji)'); continue; }
  console.log('♪  komprese → ' + out);
  execFileSync('ffmpeg',
    ['-y', '-i', src, '-vn', '-map_metadata', '-1', '-ar', '44100', '-ac', '2', '-b:a', BITRATE, dst],
    { stdio: 'ignore' });
}

// 3) prune osiřelých výstupů
for (const f of fs.readdirSync(OUT_DIR)) {
  if (path.extname(f).toLowerCase() === '.mp3' && !wanted.has(f)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
    console.log('✗  smazán osiřelý  ' + f);
  }
}

// 4) playlist.js
const list = [...wanted.keys()].map(o => "  'music/compressed/" + o + "',").join('\n');
fs.writeFileSync(PLAYLIST,
`// ============================================================
// AUTOGENEROVÁNO skriptem tools/build-music.js — needituj ručně.
// Seznam hudby na pozadí; přehrává js/music.js sekvenčně podle abecedy (smyčka).
// Přidání tracku: hoď master do music/ s číselným prefixem a spusť skript.
// ============================================================
window.PS = window.PS || {};
PS.MUSIC = [
${list}
];
`);
console.log('→  ' + path.relative(ROOT, PLAYLIST) + '  (' + wanted.size + ' tracků)');
console.log('Hotovo.');
