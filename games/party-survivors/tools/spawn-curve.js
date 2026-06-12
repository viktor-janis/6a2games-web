// ============================================================
// Party Survivors — kalibrace obtížnosti: PŘED (snapshot) vs PO (živě z data.js)
// Tiskne po minutách: tier, HP a DMG nepřítele, spawn rate (nepřátel/s),
// příchozí tlak (rate × HP = HP/s, co musí hráč zabít) a přibližný level.
//
// PO model čte PS.BALANCE PŘÍMO z ../js/data.js (vm sandbox) — vždy v synchronu
// s herními konstantami. PŘED = zafixovaný snapshot stavu před balanc-passem
// 06/2026 (zpětná vazba testerů), jen pro srovnání.
//
// Cíle (testeři): hráč se snaží od 1. minuty; většina runů končí ~13.–18. min,
// 18–23 velmi dobré, 23+ insane; tlak roste plynule (žádné zlomy); DMG nepřátel
// roste po ~6. síle výrazně pomaleji (smrt = tlak davu, ne 3 doteky).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- živé konstanty z data.js ----------
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataPath, 'utf8'), sandbox, { filename: 'data.js' });
const B = sandbox.PS.BALANCE;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avgStr = (tier) => Math.max(1, tier - 0.55); // mix 60/25/15 % tier/-1/-2

// průměrný násobič proudu: surge amortizovaná do času + horda rozpočítaná
const rateWith = (base, surge, horde, tier) => {
  const surgeAvg = 1 + (surge.mult - 1) * (surge.dur / surge.period);
  const hordeAmort = horde.size(tier) / horde.period;
  return base * surgeAvg + hordeAmort;
};

// ---------- PŘED — snapshot před balanc-passem (testeři 06/2026) ----------
const PRE = {
  tierSeconds: 85,
  tier: (t) => Math.floor(t / 85) + 1,
  baseRate: (t) => { const m = t / 60; return 0.85 + 0.20 * m + 0.0095 * m * m; },
  surge: { period: 50, dur: 7, mult: 2.4 },
  horde: { period: 160, size: (tier) => 12 + Math.round(tier * 2.4) },
  enemyHp: (s) => Math.round(7 * Math.pow(s, 1.3)),
  enemyDmg: (s) => Math.round(3 + 1.5 * s),
  xp: (n) => 8 + 9 * (n - 1) + 3 * (n - 1) * (n - 1),
  rate(t) { return rateWith(this.baseRate(t), this.surge, this.horde, this.tier(t)); },
  peakRate(t) { return this.baseRate(t) * this.surge.mult; },
};

// ---------- PO — živě z data.js ----------
const CUR = {
  tierSeconds: B.tierSeconds,
  tier: (t) => Math.floor(t / B.tierSeconds) + 1,
  baseRate: B.spawnRate,
  surge: B.surge,
  horde: B.horde,
  enemyHp: B.enemyHp,
  enemyDmg: B.enemyDmg,
  xp: B.xpForLevel,
  rate(t) { return rateWith(this.baseRate(t), this.surge, this.horde, this.tier(t)); },
  peakRate(t) { return this.baseRate(t) * this.surge.mult; },
};

// přibližné levelování: integruj XP/s (= rate × avgStr, optimisticky vše zabito)
function levelAt(model, T) {
  let xp = 0, level = 1, need = model.xp(1);
  for (let t = 0; t < T; t++) {
    const tier = model.tier(t);
    xp += model.rate(t) * avgStr(tier);
    while (xp >= need) { xp -= need; level++; need = model.xp(level); }
  }
  return level;
}

const MIN = (m) => m * 60;
const pad = (s, n) => String(s).padStart(n);

function table(name, model) {
  console.log(`\n=== ${name} ===`);
  console.log(pad('min', 4) + pad('tier', 6) + pad('HP', 6) + pad('dmg', 6) +
    pad('rate/s', 8) + pad('peak/s', 8) + pad('tlak HP/s', 11) + pad('~level', 8));
  for (let m = 0; m <= 24; m += 2) {
    const t = MIN(m), tier = model.tier(t);
    const s = Math.round(avgStr(tier));
    const hp = model.enemyHp(s), dmg = model.enemyDmg(s);
    const rate = model.rate(t);
    console.log(pad(m, 4) + pad(tier, 6) + pad(hp, 6) + pad(dmg, 6) +
      pad(rate.toFixed(1), 8) + pad(model.peakRate(t).toFixed(1), 8) +
      pad(Math.round(rate * hp), 11) + pad(levelAt(model, t), 8));
  }
}

table('PŘED (snapshot před balanc-passem)', PRE);
table('PO (živě z data.js)', CUR);

// kde PO model dosáhne tlaku, který měl PŘED model v 10. minutě („zeď" dle
// testerů: dřív bylo těžko ~od 10. min; teď má zeď přijít ~13.–15. min, ale
// PO křivka startuje výš → srovnání proti staré 10. minutě je jen orientační)
const wall = PRE.rate(MIN(10)) * PRE.enemyHp(Math.round(avgStr(PRE.tier(MIN(10)))));
let cross = null;
for (let t = 0; t < MIN(40); t++) {
  const tier = CUR.tier(t);
  if (CUR.rate(t) * CUR.enemyHp(Math.round(avgStr(tier))) >= wall) { cross = t; break; }
}
console.log(`\nStará „zeď" (tlak PŘED v 10. min) = ${Math.round(wall)} HP/s`);
console.log(cross != null
  ? `PO model ji dosáhne v ~${(cross / 60).toFixed(1)}. minutě`
  : 'PO model ji do 40. min nedosáhne');
console.log('');
