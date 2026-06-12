// ============================================================
// Party Survivors — headless balanc simulátor útoků
// ------------------------------------------------------------
// Cíl: měřit "efektivní DPS na roj" každého z 9 útoků v
// reprezentativních scénářích, aby šly útoky vyrovnat vůči sobě.
//
// Jak to funguje:
//  - Načte PS.ATTACKS / PS.BALANCE PŘÍMO z ../js/data.js (vm sandbox),
//    takže simulace je vždy v synchronu s herními konstantami.
//  - Malý deterministický engine (dt = 1/60 s) věrně portuje combat
//    math z weapons.js + GameScene.js: kužely/paprsky/zóny/odrazy
//    vajglů/orbity, DoT, knockback/slow/stun, +14/+16 px buffery
//    prostorových dotazů, akumulátory cooldownů a tiků.
//  - Hrdina krouží (kiting) konstantní rychlostí; nepřátelé ho honí
//    a zastaví se na kontaktní vzdálenosti → vzniká realistický roj
//    s radiálním gradientem (čerství daleko, namačkaní blízko).
//  - Měří se: effDPS (skutečně zasazený damage bez overkillu / s),
//    kills/s a "kontaktní tlak" (průměr nepřátel < 35 px = utility proxy).
//
// Předpoklady (vědomá zjednodušení, stejná pro všechny útoky → fér
// srovnání): úroveň zbraně 1, bez perků, bez pasivek hrdinů, bez kritů,
// hrdina nebere damage (měříme ofenzivu). 'facing' útoky se hodnotí v
// průměru dvou režimů míření — pesimistický (směr pohybu, jak to dělá
// kód) a optimistický (otočení do davu) — aby se zbraně mířené "kam jdu"
// nepenalizovaly jen volbou scénáře.
//
// Spuštění:  node tools/balance-sim.js          (souhrnná tabulka)
//            node tools/balance-sim.js --detail (rozpad po scénářích)
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- načtení herních dat (data.js) ----------
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const sandbox = {};
sandbox.window = sandbox; // window === globální objekt (jako v prohlížeči)
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataPath, 'utf8'), sandbox, { filename: 'data.js' });
const PS = sandbox.PS;

// ---------- deterministické PRNG (mulberry32) ----------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // do (-π, π]
const deg2rad = (d) => d * Math.PI / 180;

// ============================================================
// Engine jedné simulace pro jeden útok
// ============================================================
class Sim {
  constructor(weaponId, cfg) {
    this.id = weaponId;
    this.def = PS.ATTACKS[weaponId];
    this.cfg = cfg;                 // { band, faceCrowd, seed }
    this.worldRng = rng(cfg.seed);  // svět/spawny — stejné napříč zbraněmi
    this.combatRng = rng(0x9E37 ^ cfg.seed); // hody (stun) — neovlivní svět

    this.dt = 1 / 60;
    this.nowMs = 0;

    // hrdina krouží kolem počátku (kiting)
    this.px = 0; this.py = 0;
    this.kiteR = 70;
    this.kiteAngle = 0;
    // rychlost kroužení < typická rychlost nepřítele tieru → roj stíhá honit
    const eSpeed = PS.BALANCE.enemySpeed(cfg.band);
    this.kiteSpeed = 0.75 * eSpeed;
    this.faceDir = 0;   // směr pohybu (pro 'facing' útoky v kódu)
    this.moveDir = 0;

    // nepřátelé
    this.enemies = [];
    this.maxEnemies = cfg.maxEnemies || 40;
    this.spawnAcc = 0;
    this.spawnInterval = cfg.spawnInterval || 0.16; // s — menší = hustší roj
    this.spawnR = 300;
    this.contactR = 26;        // kde se nepřítel zastaví u hrdiny
    this.enemyHp = PS.BALANCE.enemyHp(cfg.band);
    this.speedMults = PS.ENEMIES.map((e) => e.speedMult);

    // zbraň — stav akumulátorů (jeden objekt pro všechny archetypy)
    this.w = { acc: 0, tickAcc: 0, streamUntil: 0, tags: [], angle: 0, dotAcc: 0 };

    // zóny (kaluže/tagy/střepy)
    this.zones = [];

    // metriky
    this.effDamage = 0;  // skutečně zasazený damage (bez overkillu)
    this.kills = 0;
    this.contactSum = 0; // suma "nepřátel < 35 px" přes měřené tiky
    this.aliveSum = 0;
    this.sampleTicks = 0;

    // statistika cooldownů (globální mult = 1: bez pasivek)
    this.cdMult = 1;
    this.areaMult = 1;
  }

  // ---------- prostorové dotazy (zrcadlí GameScene) ----------
  area(v) { return v * this.areaMult; }

  enemiesInCircle(x, y, r) {
    const rr = (r + 14) ** 2, out = [];
    for (const e of this.enemies) if (e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 <= rr) out.push(e);
    return out;
  }
  enemiesInCone(dir, half, range) {
    const rr = (range + 16) ** 2, out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if ((e.x - this.px) ** 2 + (e.y - this.py) ** 2 > rr) continue;
      const a = Math.atan2(e.y - this.py, e.x - this.px);
      if (Math.abs(wrap(a - dir)) <= half) out.push(e);
    }
    return out;
  }
  enemiesInBeam(dir, range, width) {
    const ux = Math.cos(dir), uy = Math.sin(dir), halfW = width / 2 + 14, out = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.px, dy = e.y - this.py;
      const t = dx * ux + dy * uy;
      if (t < 0 || t > range + 16) continue;
      const perp = Math.abs(dx * uy - dy * ux);
      if (perp <= halfW) { e._beamT = t; out.push(e); }
    }
    return out.sort((a, b) => a._beamT - b._beamT);
  }
  nearestEnemyTo(x, y, range, exclude) {
    let best = null, bestD = range * range;
    for (const e of this.enemies) {
      if (!e.alive || (exclude && exclude.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }
  nearestEnemy(range) { return this.nearestEnemyTo(this.px, this.py, range); }
  nearestEnemies(range, k, exclude) {
    const r2 = range * range, arr = [];
    for (const e of this.enemies) {
      if (!e.alive || (exclude && exclude.has(e))) continue;
      const d = (e.x - this.px) ** 2 + (e.y - this.py) ** 2;
      if (d <= r2) arr.push({ e, d });
    }
    arr.sort((a, b) => a.d - b.d);
    return arr.slice(0, k).map((o) => o.e);
  }

  facingDir() {
    if (this.cfg.faceCrowd) {
      const t = this.nearestEnemy(560);
      if (t) return Math.atan2(t.y - this.py, t.x - this.px);
    }
    return this.moveDir;
  }
  aimDir() {
    const t = this.nearestEnemy(560);
    if (t) return Math.atan2(t.y - this.py, t.x - this.px);
    return this.facingDir();
  }

  // ---------- centrální damage + efekty ----------
  dealDamage(e, dmg, opts = {}) {
    if (!e.alive) return;
    const eff = Math.min(dmg, e.hp > 0 ? e.hp : 0);
    if (eff > 0) this.effDamage += eff;
    e.hp -= dmg;
    if (opts.slow) this.applySlow(e, opts.slow.pct, opts.slow.dur);
    if (opts.dot) { e.dotDps = opts.dot.dps; e.dotUntil = this.nowMs + opts.dot.dur * 1000; }
    if (opts.knockback) this.knockback(e, opts.knockback);
    if (opts.stun && this.combatRng() < opts.stun.chance) e.stunUntil = this.nowMs + opts.stun.dur * 1000;
    if (e.hp <= 0) { e.alive = false; this.kills++; }
  }
  applySlow(e, pct, dur) {
    if ((e.slowUntil || 0) < this.nowMs || pct >= (e.slowPct || 0)) {
      e.slowPct = pct; e.slowUntil = this.nowMs + dur * 1000;
    }
  }
  knockback(e, strength) {
    const vel = 84 + strength * 56;
    const dur = 90 + strength * 40;
    const a = Math.atan2(e.y - this.py, e.x - this.px);
    e.kbvx = Math.cos(a) * vel; e.kbvy = Math.sin(a) * vel;
    e.kbUntil = this.nowMs + dur;
  }

  // ---------- zóny ----------
  addZone(cfg) {
    this.zones.push({
      x: cfg.x, y: cfg.y, r: cfg.r, until: this.nowMs + cfg.dur * 1000,
      tickDmg: cfg.tickDmg || 0, tick: cfg.tick || 0.4, slowPct: cfg.slowPct || 0, acc: 0,
    });
    return this.zones[this.zones.length - 1];
  }
  removeZone(z) { z.until = 0; }
  updateZones(dt) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (this.nowMs > z.until) { this.zones.splice(i, 1); continue; }
      z.acc += dt;
      if (z.acc < z.tick) continue;
      z.acc = 0;
      for (const e of this.enemiesInCircle(z.x, z.y, z.r)) {
        if (z.tickDmg) this.dealDamage(e, z.tickDmg, { noCrit: true });
        if (z.slowPct) this.applySlow(e, z.slowPct, 0.45);
      }
    }
  }
  updateDots(dt) {
    this.w.dotAcc += dt;
    if (this.w.dotAcc < 0.25) return;
    const step = this.w.dotAcc; this.w.dotAcc = 0;
    for (const e of this.enemies) {
      if (e.alive && (e.dotUntil || 0) >= this.nowMs) this.dealDamage(e, e.dotDps * step, { noCrit: true });
    }
  }

  // ============================================================
  //  Útoky — port tick_* z weapons.js (level 1, bez perků)
  // ============================================================
  weaponUpdate(dt) {
    const d = this.def, w = this.w;
    switch (d.archetype) {
      case 'cone': {
        // blití — TRVALÝ proud bez mezer (port weapons.tick_cone): tiká každých
        // d.tick (×cdMult). Bez perků (sim je level 1), takže žádné 'davka'.
        w.tickAcc += dt;
        if (w.tickAcc >= d.tick * this.cdMult) {
          w.tickAcc = 0;
          const dir = this.facingDir(), half = deg2rad(d.angle / 2), range = this.area(d.range);
          for (const e of this.enemiesInCone(dir, half, range))
            this.dealDamage(e, d.dmg, { dot: { dps: d.dot.dps, dur: d.dot.dur } });
        }
        break;
      }
      case 'beam': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        const dir = this.aimDir(), range = this.area(d.range);
        const targets = this.enemiesInBeam(dir, range, d.width).slice(0, d.pierce);
        for (const e of targets) this.dealDamage(e, d.dmg);
        const last = targets[targets.length - 1];
        const zx = last ? last.x : this.px + Math.cos(dir) * range;
        const zy = last ? last.y : this.py + Math.sin(dir) * range;
        this.addZone({ x: zx, y: zy, r: this.area(d.puddle.r), dur: d.puddle.dur, slowPct: d.puddle.slow });
        break;
      }
      case 'zone': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        w.tags = w.tags.filter((z) => z.until > this.nowMs);
        if (w.tags.length >= d.maxZones) this.removeZone(w.tags.shift());
        w.tags.push(this.addZone({
          x: this.px, y: this.py, r: this.area(d.r), dur: d.dur, tickDmg: d.dmg, tick: d.tick,
        }));
        break;
      }
      case 'lob': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        // auto-cíl: náhodný z několika nejbližších (bez perků = 1 hod)
        const range = this.area(d.targetRange);
        const pool = this.nearestEnemies(range, d.targetPool);
        let tx, ty;
        if (pool.length) { const t = pool[(this.combatRng() * pool.length) | 0]; tx = t.x; ty = t.y; }
        else { const dir = this.facingDir(); tx = this.px + Math.cos(dir) * range; ty = this.py + Math.sin(dir) * range; }
        for (const e of this.enemiesInCircle(tx, ty, this.area(d.hitR)))
          this.dealDamage(e, d.dmg, { knockback: d.knockback, stun: d.stun });
        for (const e of this.enemiesInCircle(tx, ty, this.area(d.burst.r)))
          this.dealDamage(e, d.burst.dmg);
        this.addZone({ x: tx, y: ty, r: this.area(d.shards.r), dur: d.shards.dur, tickDmg: d.shards.dmg, tick: d.shards.tick });
        break;
      }
      case 'bounce': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        const t = this.nearestEnemy(this.area(d.range));
        if (!t) break; // bez cíle letí naprázdno (v davu se nestává)
        const hitSet = new Set();
        let node = t, left = d.bounces;
        const hit = (en) => { this.dealDamage(en, d.dmg, { slow: { pct: d.slow.pct, dur: d.slow.dur } }); hitSet.add(en); };
        hit(node);
        while (left > 0) {
          const next = this.nearestEnemyTo(node.x, node.y, this.area(d.bounceRange), hitSet);
          if (!next) break;
          left--; hit(next); node = next;
        }
        break;
      }
      case 'sweep': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        const dir = this.facingDir(), half = deg2rad(d.angle / 2), range = this.area(d.range);
        for (const e of this.enemiesInCone(dir, half, range))
          this.dealDamage(e, d.dmg, { knockback: d.knockback });
        this.addZone({
          x: this.px + Math.cos(dir) * range * 0.6, y: this.py + Math.sin(dir) * range * 0.6,
          r: this.area(d.puddle.r), dur: d.puddle.dur, slowPct: d.puddle.slow,
        });
        break;
      }
      case 'ricochet': {
        // dým: periodicky vystřelí kouřovou šipku, která lítá v boxu kolem hrdiny,
        // odráží se od stěn a probodává každého (re-hit po d.rehit s). Port z
        // weapons.tick_ricochet + GameScene.updateProjectiles/projectileHit.
        w.acc += dt;
        if (w.acc >= d.cd * this.cdMult) {
          w.acc = 0;
          const t = this.nearestEnemy(this.area(d.box));
          const dir = t ? Math.atan2(t.y - this.py, t.x - this.px) : this.moveDir;
          w.dart = { x: this.px, y: this.py, vx: Math.cos(dir) * d.speed, vy: Math.sin(dir) * d.speed, life: d.life, hit: new Map() };
        }
        const dart = w.dart;
        if (dart && dart.life > 0) {
          dart.life -= dt;
          dart.x += dart.vx * dt; dart.y += dart.vy * dt;
          const half = this.area(d.box);
          const rx = dart.x - this.px, ry = dart.y - this.py;
          if (rx > half && dart.vx > 0) dart.vx = -dart.vx;
          else if (rx < -half && dart.vx < 0) dart.vx = -dart.vx;
          if (ry > half && dart.vy > 0) dart.vy = -dart.vy;
          else if (ry < -half && dart.vy < 0) dart.vy = -dart.vy;
          for (const e of this.enemiesInCircle(dart.x, dart.y, d.hitR)) {
            const last = dart.hit.get(e) || 0;
            if (this.nowMs - last < d.rehit * 1000) continue;
            dart.hit.set(e, this.nowMs);
            this.dealDamage(e, d.dmg, { slow: { pct: d.slow, dur: 0.5 } });
          }
        }
        break;
      }
      case 'orbit': {
        const period = d.period;
        w.angle += dt * TAU / (period * this.cdMult);
        const r = this.area(d.r), step = TAU / d.count;
        for (let i = 0; i < d.count; i++) {
          const a = w.angle + i * step;
          const ox = this.px + Math.cos(a) * r, oy = this.py + Math.sin(a) * r;
          for (const e of this.enemiesInCircle(ox, oy, 22)) {
            if (this.nowMs - (e.lastOrbHit || 0) < d.rehit * 1000) continue;
            e.lastOrbHit = this.nowMs;
            this.dealDamage(e, d.dmg, { knockback: d.knockback });
          }
        }
        break;
      }
      case 'slap': {
        w.acc += dt;
        if (w.acc < d.cd * this.cdMult) break;
        w.acc = 0;
        const dir = this.aimDir(), half = deg2rad(d.angle / 2), range = this.area(d.range);
        const cone = this.enemiesInCone(dir, half, range).slice(0, d.targets);
        for (const e of cone) this.dealDamage(e, d.dmg, { knockback: d.knockback, stun: d.stun });
        break;
      }
      default: throw new Error('neznámý archetyp: ' + d.archetype);
    }
  }

  // ---------- svět ----------
  spawnEnemy() {
    const a = this.worldRng() * TAU;
    const sm = this.speedMults[(this.worldRng() * this.speedMults.length) | 0];
    this.enemies.push({
      x: this.px + Math.cos(a) * this.spawnR, y: this.py + Math.sin(a) * this.spawnR,
      hp: this.enemyHp, alive: true,
      baseSpeed: PS.BALANCE.enemySpeed(this.cfg.band) * sm,
      slowUntil: 0, slowPct: 0, dotUntil: 0, dotDps: 0, stunUntil: 0,
      kbUntil: 0, kbvx: 0, kbvy: 0, lastOrbHit: 0,
    });
  }
  moveEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.nowMs < e.stunUntil) continue;
      if (this.nowMs < e.kbUntil) { e.x += e.kbvx * dt; e.y += e.kbvy * dt; continue; }
      const dx = this.px - e.x, dy = this.py - e.y, d = Math.hypot(dx, dy) || 1;
      if (d <= this.contactR) continue; // zastaví se v kontaktu
      let sp = e.baseSpeed;
      if (this.nowMs < (e.slowUntil || 0)) sp *= 1 - e.slowPct;
      const move = Math.min(sp * dt, d - this.contactR);
      e.x += dx / d * move; e.y += dy / d * move;
    }
  }

  // Separace těl (jako collider(enemies, enemies) v GameScene): nepřátelé se
  // nepřekrývají → roj má realistickou hustotu (slupka kolem hrdiny), ne stoh.
  // Bez tohoto se utopí všechny AoE-kolem-hrdiny (dým/panáky/tag) v nereálné
  // hromadě. minSep ≈ šířka těla (body 30×40 → poloměr ~15, střed-střed ~28).
  separateEnemies() {
    const minSep = 28, minSep2 = minSep * minSep;
    const a = this.enemies;
    for (let i = 0; i < a.length; i++) {
      const e = a[i]; if (!e.alive) continue;
      for (let j = i + 1; j < a.length; j++) {
        const f = a[j]; if (!f.alive) continue;
        let dx = f.x - e.x, dy = f.y - e.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minSep2 || d2 === 0) {
          if (d2 === 0) { dx = (this.worldRng() - 0.5) * 0.01; dy = (this.worldRng() - 0.5) * 0.01; }
          else continue;
        }
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const push = (minSep - d) / 2;
        const ux = dx / d * push, uy = dy / d * push;
        e.x -= ux; e.y -= uy; f.x += ux; f.y += uy;
      }
    }
  }

  step(measuring) {
    const dt = this.dt;
    // pohyb hrdiny po kruhu
    this.kiteAngle += this.kiteSpeed * dt / this.kiteR;
    const nx = Math.cos(this.kiteAngle) * this.kiteR, ny = Math.sin(this.kiteAngle) * this.kiteR;
    this.moveDir = Math.atan2(ny - this.py, nx - this.px);
    this.px = nx; this.py = ny;

    this.weaponUpdate(dt);
    this.updateZones(dt);
    this.updateDots(dt);
    this.moveEnemies(dt);
    this.separateEnemies();

    // spawn — udržuj saturaci
    this.spawnAcc += dt;
    while (this.spawnAcc >= this.spawnInterval) {
      this.spawnAcc -= this.spawnInterval;
      if (this.aliveCount() < this.maxEnemies) this.spawnEnemy();
    }
    // úklid mrtvých (a respawn drží maintenance výše)
    if (this.enemies.length > 120) this.enemies = this.enemies.filter((e) => e.alive);

    if (measuring) {
      let contact = 0, alive = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue; alive++;
        if ((e.x - this.px) ** 2 + (e.y - this.py) ** 2 < 35 * 35) contact++;
      }
      this.contactSum += contact; this.aliveSum += alive; this.sampleTicks++;
    }
    this.nowMs += dt * 1000;
  }
  aliveCount() { let n = 0; for (const e of this.enemies) if (e.alive) n++; return n; }

  run(warmup = 4, window = 20) {
    const warmSteps = Math.round(warmup / this.dt);
    const winSteps = Math.round(window / this.dt);
    for (let i = 0; i < warmSteps; i++) this.step(false);
    this.effDamage = 0; this.kills = 0;
    for (let i = 0; i < winSteps; i++) this.step(true);
    return {
      effDps: this.effDamage / window,
      killsPerSec: this.kills / window,
      contact: this.contactSum / this.sampleTicks,
      alive: this.aliveSum / this.sampleTicks,
    };
  }
}

// ============================================================
//  Spuštění napříč útoky / scénáři
// ============================================================
const WEAPONS = Object.keys(PS.ATTACKS);
const SEEDS = [1, 2, 3]; // průměr přes pár seedů

// Tři scénáře pokrývají různé osy: hustý roj (throughput strop), hustý slabý
// roj (clear/overkill) a řídký proud (odměňuje DOSAH/reach — tam vyjde najevo
// malý dosah dýmu a fixní dolet lahváče). Váhy: roj je primární metrika
// uživatele, proud dává dosahu férovou váhu.
const SCENARIOS = [
  { key: 'roj',   label: 'roj (hustý, tanky)',  band: 12, maxEnemies: 40, spawnInterval: 0.16, weight: 0.45 },
  { key: 'proud', label: 'proud (řídký, tanky)', band: 12, maxEnemies: 12, spawnInterval: 0.55, weight: 0.30 },
  { key: 'slabi', label: 'roj (hustý, slabí)',   band: 3,  maxEnemies: 40, spawnInterval: 0.16, weight: 0.25 },
];

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function evalWeapon(id) {
  const out = { sc: {} };
  // 'facing' útoky průměrujeme přes oba režimy míření (pesimistický „kam jdu" +
  // optimistický „otočím se do davu"); ostatní jsou na míření nezávislé.
  const facing = ['cone', 'sweep'].includes(PS.ATTACKS[id].archetype); // lob už auto-cílí (ne 'facing')
  const modes = facing ? [false, true] : [false];
  let score = 0;
  for (const sc of SCENARIOS) {
    const dps = [], kps = [], con = [];
    for (const faceCrowd of modes) {
      for (const seed of SEEDS) {
        const r = new Sim(id, {
          band: sc.band, maxEnemies: sc.maxEnemies, spawnInterval: sc.spawnInterval, faceCrowd, seed,
        }).run();
        dps.push(r.effDps); kps.push(r.killsPerSec); con.push(r.contact);
      }
    }
    out.sc[sc.key] = { dps: avg(dps), kps: avg(kps), contact: avg(con) };
    score += sc.weight * avg(dps);
  }
  out.score = score;
  // průměrný kontaktní tlak přes roj+proud (utility proxy: nižší = lepší kontrola)
  out.contact = (out.sc.roj.contact + out.sc.proud.contact) / 2;
  return out;
}

const results = WEAPONS.map((id) => ({ id, name: PS.ATTACKS[id].name, ...evalWeapon(id) }));
results.sort((a, b) => b.score - a.score);

const pad = (s, n) => String(s).padEnd(n);
const head = (s, n) => String(s).padStart(n);
const num = (v, n = 6) => String(Math.round(v)).padStart(n);

console.log('\n=== Party Survivors — balanc útoků (level 1, bez perků/pasivek) ===');
console.log('effDPS = skutečně zasazený damage bez overkillu / s   |   kontakt = prům. nepřátel < 35 px (utility: nižší = lepší kontrola)');
console.log('SKÓRE = vážený kompozit (roj 0,45 · proud 0,30 · slabí 0,25)\n');
console.log(pad('útok', 20) + head('SKÓRE', 7) + '  | ' +
  head('roj', 7) + head('proud', 7) + head('slabí', 7) + '  | ' + head('kontakt', 8));
console.log('-'.repeat(72));
for (const r of results) {
  console.log(
    pad(r.name, 20) + num(r.score, 7) + '  | ' +
    num(r.sc.roj.dps, 7) + num(r.sc.proud.dps, 7) + num(r.sc.slabi.dps, 7) + '  | ' +
    num(r.contact, 8));
}

// rozptyl
const scores = results.map((r) => r.score);
const hi = Math.max(...scores), lo = Math.min(...scores);
const med = scores.slice().sort((a, b) => a - b)[Math.floor(scores.length / 2)];
console.log('-'.repeat(72));
console.log(`rozptyl SKÓRE: ${Math.round(lo)}–${Math.round(hi)}  · medián ${Math.round(med)}  · poměr max/min = ${(hi / lo).toFixed(2)}×`);
console.log('');
