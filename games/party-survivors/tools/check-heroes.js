// ============================================================
// Party Survivors — kontrola parity hrdinů (data.js ↔ worker.js)
// ------------------------------------------------------------
// Mapa HERO_NAMES v leaderboard-server/src/worker.js MUSÍ odpovídat PS.HEROES
// v js/data.js (slouží i jako bílá listina id → neznámé id žebříček odmítne).
// Když se přidá/přejmenuje hrdina jen na jednom místě, žebříček ukáže místo
// jména syrové id nebo skóre odmítne. Tenhle skript to odhalí dřív.
//
// Spuštění:  node tools/check-heroes.js
//   exit 0 = vše sedí, exit 1 = nesoulad (vypíše, co je špatně).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- PS.HEROES z data.js (vm sandbox, jako ostatní nástroje) ----------
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataPath, 'utf8'), sandbox, { filename: 'data.js' });
const heroes = sandbox.PS.HEROES; // [{ id, name, ... }]

// ---------- HERO_NAMES z worker.js (parsování objektu z textu) ----------
const workerPath = path.join(__dirname, '..', 'leaderboard-server', 'src', 'worker.js');
const workerSrc = fs.readFileSync(workerPath, 'utf8');
const block = workerSrc.match(/const\s+HERO_NAMES\s*=\s*\{([\s\S]*?)\};/);
if (!block) {
  console.error('CHYBA: ve worker.js se nenašel objekt HERO_NAMES.');
  process.exit(1);
}
const heroNames = {};
for (const m of block[1].matchAll(/(\w+)\s*:\s*'([^']*)'/g)) heroNames[m[1]] = m[2];

// ---------- porovnání ----------
const problems = [];
const dataIds = new Set(heroes.map(h => h.id));
const workerIds = new Set(Object.keys(heroNames));

for (const h of heroes) {
  if (!(h.id in heroNames)) problems.push(`chybí ve worker.js HERO_NAMES: '${h.id}' (${h.name})`);
  else if (heroNames[h.id] !== h.name)
    problems.push(`jméno nesedí pro '${h.id}': data.js='${h.name}' vs worker.js='${heroNames[h.id]}'`);
}
for (const id of workerIds) {
  if (!dataIds.has(id)) problems.push(`worker.js HERO_NAMES má navíc '${id}', který v data.js PS.HEROES není`);
}

if (problems.length) {
  console.error('NESOULAD hrdinů (data.js ↔ worker.js):');
  problems.forEach(p => console.error('  ✗ ' + p));
  console.error('\nSrovnej HERO_NAMES ve worker.js s PS.HEROES v data.js.');
  process.exit(1);
}
console.log(`OK — ${heroes.length} hrdinů sedí (data.js ↔ worker.js HERO_NAMES).`);
