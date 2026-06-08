// ============================================================
// Party Survivors — kalibrace obtížnosti: STARÝ vs NOVÝ spawn model
// Tiskne po minutách: tier, HP nepřítele, spawn rate (nepřátel/s),
// příchozí tlak (rate × HP = HP/s, co musí hráč zabít) a přibližný level.
// Cíl: posunout „zeď" z ~5-6 min na ~10 min, plynulý progres, smrt nakonec
// nevyhnutelná (tlak roste rychleji než jakýkoli DPS hráče).
// ============================================================
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const enemyHp = (s) => Math.round(7 * Math.pow(s, 1.3));
const xpOld = (n) => 8 + 10 * (n - 1) + 4 * (n - 1) * (n - 1);
const xpNew = (n) => 8 + 9 * (n - 1) + 3 * (n - 1) * (n - 1); // mírně snazší (víc levelů)
const avgStr = (tier) => Math.max(1, tier - 0.55); // mix 60/25/15 % tier/-1/-2

// ---------- STARÝ model ----------
const OLD = {
  tier: (t) => Math.floor(t / 70) + 1,
  rate: (t) => {
    const tier = OLD.tier(t);
    const interval = clamp(1.6 - tier * 0.10 - t / 950, 0.4, 1.6);
    const waveSize = 2 + Math.floor(tier * 0.5) + Math.floor(t / 270);
    return waveSize / interval; // nepřátel/s (bez stropu)
  },
};

// ---------- NOVÝ model ----------
const NEW = {
  tierSeconds: 85,
  tier: (t) => Math.floor(t / 85) + 1,
  baseRate: (t) => { const m = t / 60; return 0.85 + 0.20 * m + 0.0095 * m * m; },
  surge: { period: 50, dur: 7, mult: 2.4 },
  horde: { period: 160, size: (tier) => 12 + Math.round(tier * 2.4) },
  rate: (t) => {
    const surgeAvg = 1 + (NEW.surge.mult - 1) * (NEW.surge.dur / NEW.surge.period);
    const hordeAmort = NEW.horde.size(NEW.tier(t)) / NEW.horde.period;
    return NEW.baseRate(t) * surgeAvg + hordeAmort;
  },
  peakRate: (t) => NEW.baseRate(t) * NEW.surge.mult, // špička během vlnky
};

// přibližné levelování: integruj XP/s (= rate × avgStr, optimisticky vše zabito)
function levelAt(model, T, xpFn) {
  let xp = 0, level = 1, need = xpFn(1);
  for (let t = 0; t < T; t++) {
    const tier = model.tier(t);
    xp += model.rate(t) * avgStr(tier);
    while (xp >= need) { xp -= need; level++; need = xpFn(level); }
  }
  return level;
}

const MIN = (m) => m * 60;
const pad = (s, n) => String(s).padStart(n);

function table(name, model, xpFn) {
  console.log(`\n=== ${name} ===`);
  console.log(pad('min', 4) + pad('tier', 6) + pad('HP', 6) + pad('rate/s', 8) +
    (model.peakRate ? pad('peak/s', 8) : '') + pad('tlak HP/s', 11) + pad('~level', 8));
  for (let m = 0; m <= 24; m += 2) {
    const t = MIN(m), tier = model.tier(t), hp = enemyHp(Math.round(avgStr(tier)));
    const rate = model.rate(t);
    const press = rate * hp;
    console.log(pad(m, 4) + pad(tier, 6) + pad(hp, 6) + pad(rate.toFixed(1), 8) +
      (model.peakRate ? pad(model.peakRate(t).toFixed(1), 8) : '') +
      pad(Math.round(press), 11) + pad(levelAt(model, t, xpFn), 8));
  }
}

table('STARÝ (zeď ~5-6 min)', OLD, xpOld);
table('NOVÝ (eased XP)', NEW, xpNew);

// kde NOVÝ překročí „starou zeď" (tlak starého modelu v 5,5 min)
const wall = OLD.rate(MIN(5.5)) * enemyHp(Math.round(avgStr(OLD.tier(MIN(5.5)))));
let cross = 0;
for (let t = 0; t < MIN(30); t++) {
  const tier = NEW.tier(t);
  if (NEW.rate(t) * enemyHp(Math.round(avgStr(tier))) >= wall) { cross = t; break; }
}
console.log(`\nStará „zeď" (tlak v 5,5 min) = ${Math.round(wall)} HP/s`);
console.log(`NOVÝ model ji dosáhne v ~${(cross / 60).toFixed(1)}. minutě`);
console.log('');
