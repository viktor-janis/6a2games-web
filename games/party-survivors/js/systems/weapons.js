// ============================================================
// Zbraně — 9 archetypů útoků, každý s jiným profilem (VS styl)
//   míření: facingDir (kam je hrdina otočený) / aimDir (nejbližší) / pevný vzor
//   profily: nuke × rychlopalba, pierce × odrazy × AoE, knockback/stun/slow
// Každá zbraň: level (1–8, +25 % DMG za level), cooldown akumulátor
// Globální multiplikátory (dmgMult, krit…) aplikuje GameScene.dealDamage
// ============================================================
window.PS = window.PS || {};

PS.Weapon = class Weapon {
  constructor(scene, id) {
    this.scene = scene;
    this.id = id;
    this.def = PS.ATTACKS[id];
    this.level = 1;
    this.perkLevels = {}; // perky útoku (PS.WEAPON_PERKS) — druhá osa vylepšení
    this.acc = 0;        // akumulátor cooldownu
    this.tickAcc = 0;    // akumulátor tiků (aura, proud)
    this.streamUntil = 0;
    this.streamDir = 0;
    const init = this['init_' + this.def.archetype];
    if (init) init.call(this);
  }

  // úroveň perku (0 = nevlastněn)
  perk(pid) { return this.perkLevels[pid] || 0; }

  applyPerk(pid) {
    this.perkLevels[pid] = (this.perkLevels[pid] || 0) + 1;
    if (this.id === 'panaky' && pid === 'panak') this.addOrbiter();
  }

  // DMG včetně levelu zbraně
  dmg(base) {
    return (base !== undefined ? base : this.def.dmg)
      * (1 + (this.level - 1) * PS.BALANCE.weaponDmgPerLevel);
  }

  cd() { return this.def.cd * this.scene.stats.cdMult; }
  area(v) { return v * this.scene.stats.areaMult; }
  player() { return this.scene.player; }

  update(dt) { this['tick_' + this.def.archetype](dt); }

  // ============ blití — kužel ve směru pohledu s DoT (Rashid) ============
  tick_cone(dt) {
    const s = this.scene, def = this.def, now = s.time.now;
    this.acc += dt;
    if (this.acc >= this.cd() && now >= this.streamUntil) {
      // aktivace čistě na interval (VS styl) — i naprázdno
      this.acc = 0;
      this.streamUntil = now + (def.duration + 0.5 * this.perk('davka')) * 1000;
      this.tickAcc = def.tick; // první tik okamžitě
    }
    if (now < this.streamUntil) {
      this.tickAcc += dt;
      if (this.tickAcc >= def.tick) {
        this.tickAcc = 0;
        this.streamDir = s.facingDir(); // proud míří, kam je hrdina otočený
        const range = this.area(def.range);
        const half = Phaser.Math.DegToRad((def.angle + 15 * this.perk('kuzel')) / 2);
        s.enemiesInCone(this.streamDir, half, range).forEach(e =>
          s.dealDamage(e, this.dmg(), { dot: { dps: def.dot.dps, dur: def.dot.dur }, source: this.id }));
        s.fxVomit(this.streamDir, half, range);
      }
    }
  }

  // ============ chcaní — paprsek + kaluž (Poskok) ============
  tick_beam(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene;

    this.fireBeam(s.aimDir()); // střílí vždy — i naprázdno
    if (this.perk('dvojity')) {
      // druhý proud na druhého nejbližšího nepřítele
      const t1 = s.nearestEnemy(560);
      const t2 = t1 && s.nearestEnemyTo(s.player.x, s.player.y, 560, new Set([t1]));
      if (t2) this.fireBeam(Phaser.Math.Angle.Between(s.player.x, s.player.y, t2.x, t2.y));
    }
  }
  fireBeam(dir) {
    const s = this.scene, def = this.def;
    const range = this.area(def.range);
    const pierce = def.pierce + 2 * this.perk('pierce');
    const targets = s.enemiesInBeam(dir, range, def.width).slice(0, pierce);
    targets.forEach(e => s.dealDamage(e, this.dmg(), { source: this.id }));

    // kaluž na konci zásahu (poslední zasažený, jinak konec paprsku)
    const last = targets[targets.length - 1];
    const zx = last ? last.x : s.player.x + Math.cos(dir) * range;
    const zy = last ? last.y : s.player.y + Math.sin(dir) * range;
    s.addZone({
      x: zx, y: zy, r: this.area(def.puddle.r),
      dur: def.puddle.dur, slowPct: def.puddle.slow,
      tint: 0xd8c020, alpha: 0.40,
    });
    s.fxPiss(dir, range, def.width);
  }

  // ============ tagování — stacionární zóny (Don G) ============
  init_zone() { this.tags = []; }
  tick_zone(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def, now = s.time.now;

    this.tags = this.tags.filter(z => z.until > now);
    const maxZones = def.maxZones + this.perk('tag');
    if (this.tags.length >= maxZones) s.removeZone(this.tags.shift());

    const tints = [0xff2bd6, 0x00ffff, 0xb44cff];
    this.tags.push(s.addZone({
      x: s.player.x, y: s.player.y, r: this.area(def.r),
      dur: def.dur, tickDmg: this.dmg(), tick: def.tick, source: this.id,
      tint: tints[Math.floor(Math.random() * tints.length)], alpha: 0.5,
    }));
  }

  // ============ házení lahváčem — auto-cílený nuke (Kaar) ============
  // Místo pevného doletu sám zamíří na NÁHODNÉHO z několika nejbližších nepřátel
  // (opilecký hod lahvákem do davu). Perk „hod navíc" cílí každý další lahvák
  // na jiného nepřítele. Bez nepřátel se hodí naprázdno do směru pohledu (VS styl).
  tick_lob(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.targetRange);
    const count = 1 + this.perk('runda');
    const chosen = new Set();
    for (let i = 0; i < count; i++) {
      const pool = s.nearestEnemies(range, def.targetPool, chosen);
      if (pool.length) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        chosen.add(t);
        this.throwLahvac(t.x, t.y);
      } else {
        // nikde nikdo → hod naprázdno (perk hází do vějíře, ať to není na jedno místo)
        const dir = s.facingDir() + (i ? 0.42 * (i % 2 ? 1 : -1) : 0);
        this.throwLahvac(s.player.x + Math.cos(dir) * range, s.player.y + Math.sin(dir) * range);
      }
    }
  }
  throwLahvac(tx, ty) {
    const s = this.scene;
    const img = s.add.image(s.player.x, s.player.y, 'proj-lahvac').setDepth(9);
    s.tweens.add({
      targets: img, x: tx, y: ty,
      duration: 430, ease: 'Linear',
      onUpdate: (tw) => {
        img.rotation += 0.25;
        img.setScale(1 + Math.sin(tw.progress * Math.PI) * 0.9); // oblouk
      },
      onComplete: () => { img.destroy(); this.lobImpact(tx, ty); },
    });
  }
  lobImpact(x, y) {
    const s = this.scene, def = this.def;
    // přímý zásah — plný DMG, odhoz a šance na omráčení (lahváčem do hlavy)
    s.enemiesInCircle(x, y, this.area(def.hitR)).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: def.knockback, stun: def.stun, source: this.id }));
    // výbuch střepů
    s.enemiesInCircle(x, y, this.area(def.burst.r)).forEach(e =>
      s.dealDamage(e, this.dmg(def.burst.dmg), { source: this.id }));
    // střepy na zemi
    s.addZone({
      x, y, r: this.area(def.shards.r),
      dur: def.shards.dur, tickDmg: this.dmg(def.shards.dmg), tick: def.shards.tick, source: this.id,
      tint: 0x8a5a2b, alpha: 0.45,
    });
    s.fxCircle(x, y, this.area(def.burst.r), 0xc77b30);
  }

  // ============ plivání vajglů — odrážející se rychlopalba (Fjodor Ket) ============
  tick_bounce(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    // letí na nejbližšího (bez cíle rovně do směru pohledu)
    // a po zásahu se odráží na další nepřátele (viz GameScene.projectileHit)
    const t = s.nearestEnemy(this.area(def.range));
    this.spitVajgl(t, s.facingDir());
    if (this.perk('dvojite')) {
      // druhý vajgl na jiný cíl (bez cíle s rozptylem do strany)
      const t2 = t && s.nearestEnemyTo(s.player.x, s.player.y, this.area(def.range), new Set([t]));
      this.spitVajgl(t2, s.facingDir() + 0.45);
    }
  }
  spitVajgl(target, fallbackDir) {
    const s = this.scene, def = this.def;
    s.fireProjectile({
      texture: 'proj-vajgl', target, dir: fallbackDir, speed: 300, life: 1.2,
      dmg: this.dmg(), pierce: 0, homing: !!target, source: this.id,
      bounces: def.bounces + this.perk('odraz'), bounceRange: this.area(def.bounceRange),
      effects: { slow: { pct: def.slow.pct, dur: def.slow.dur } },
    });
  }

  // ============ rozlejvání piva — těžký sweep ve směru pohledu (eXtreme) ============
  tick_sweep(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene;

    const dir = s.facingDir(); // máchne kam je hrdina otočený — i naprázdno
    this.doSweep(dir);
    if (this.perk('dozadu')) this.doSweep(dir + Math.PI); // kryje i záda
  }
  doSweep(dir) {
    const s = this.scene, def = this.def;
    const range = this.area(def.range);
    const half = Phaser.Math.DegToRad((def.angle + 20 * this.perk('sirka')) / 2);
    s.enemiesInCone(dir, half, range).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: def.knockback, source: this.id }));

    // kaluž piva ve směru máchnutí
    s.addZone({
      x: s.player.x + Math.cos(dir) * range * 0.6,
      y: s.player.y + Math.sin(dir) * range * 0.6,
      r: this.area(def.puddle.r), dur: def.puddle.dur, slowPct: def.puddle.slow,
      tint: 0xffb400, alpha: 0.35,
    });
    s.fxBeerSweep(dir, half, range);
  }

  // ============ vypouštění dýmu — trvalá aura (fadadevada) ============
  // Viditelný šedý oblak: 3 vrstvy textury 'smoke', pomalu rotují a pulzují
  // → živý kouř kolem hrdiny (dřív skoro neviditelný glow).
  init_aura() {
    const s = this.scene;
    // depth 7 = NAD nepřáteli (5/6), ale pod hrdinou (10) → viditelný oblak,
    // ve kterém hrdina stojí (dřív byl pod nepřáteli a schoval se v davu)
    this.puffs = [0, 1, 2, 3].map((i) => ({
      img: s.add.image(0, 0, 'smoke').setDepth(7).setAlpha(0),
      rot: Math.random() * Math.PI * 2,
      spin: (i % 2 ? 1 : -1) * (0.22 + Math.random() * 0.26),
      sc: 0.78 + i * 0.15,
    }));
  }
  tick_aura(dt) {
    const s = this.scene, def = this.def;
    const r = this.area(def.r);
    this.puffs.forEach((p, i) => {
      p.rot += p.spin * dt;
      p.img.setPosition(s.player.x, s.player.y).setRotation(p.rot)
        .setScale(r * 2 / 64 * p.sc)
        .setAlpha(0.32 + 0.07 * Math.sin(s.time.now / 460 + i * 1.7));
    });

    this.tickAcc += dt;
    if (this.tickAcc < def.tick - 0.1 * this.perk('hustsi')) return;
    this.tickAcc = 0;
    s.enemiesInCircle(s.player.x, s.player.y, r).forEach(e =>
      s.dealDamage(e, this.dmg(), { slow: { pct: def.slow, dur: 0.6 }, noFlash: true, source: this.id }));
  }

  // ============ kopání panáků — orbitující projektily (Zložík) ============
  init_orbit() {
    this.angle = 0;
    this.orbiters = [];
    for (let i = 0; i < this.def.count; i++) this.addOrbiter();
  }
  addOrbiter() {
    if (!this.orbiters) return; // perk aplikovaný před init (nemělo by nastat)
    this.orbiters.push(this.scene.add.image(0, 0, 'panak').setDepth(9));
  }
  tick_orbit(dt) {
    const s = this.scene, def = this.def, now = s.time.now;
    // rychlejší cooldowny = rychlejší oběh; perk „rychlejší oběh" −20 % periody
    const period = def.period * (1 - 0.2 * this.perk('rotace'));
    this.angle += dt * Math.PI * 2 / (period * s.stats.cdMult);
    const r = this.area(def.r);
    const step = Math.PI * 2 / this.orbiters.length;

    this.orbiters.forEach((o, i) => {
      const a = this.angle + i * step;
      const ox = s.player.x + Math.cos(a) * r;
      const oy = s.player.y + Math.sin(a) * r;
      o.setPosition(ox, oy);
      o.rotation = a + Math.PI / 2;

      s.enemiesInCircle(ox, oy, 22).forEach(e => {
        if (now - (e.lastOrbHit || 0) < def.rehit * 1000) return;
        e.lastOrbHit = now;
        s.dealDamage(e, this.dmg(), { knockback: def.knockback, source: this.id });
      });
    });
  }

  // ============ facka listem — control: obří knockback + stun (Sajmič Uraka) ============
  tick_slap(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.range);

    const dir = s.aimDir(); // švihne po nejbližším — i naprázdno
    const half = Phaser.Math.DegToRad(def.angle / 2);
    const stun = { chance: def.stun.chance + 0.10 * this.perk('stun'), dur: def.stun.dur };
    s.enemiesInCone(dir, half, range).slice(0, def.targets + this.perk('cile')).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: def.knockback, stun, source: this.id }));

    // švih marihuanovým listem — velký a dobře viditelný (špička míří na cíl),
    // delší máchnutí + krátký dosvit; list je nad hrdinou (depth 11)
    const lx = s.player.x + Math.cos(dir) * range * 0.55;
    const ly = s.player.y + Math.sin(dir) * range * 0.55;
    const base = dir + Math.PI / 2; // textura listu míří špičkou nahoru
    const leaf = s.add.image(lx, ly, 'leaf').setDepth(11).setScale(1.5).setRotation(base - 0.85);
    s.tweens.add({
      targets: leaf, rotation: base + 0.85, scale: 1.75, duration: 320, ease: 'Cubic.easeOut',
      onComplete: () => s.tweens.add({
        targets: leaf, alpha: 0, scale: 1.9, duration: 130, onComplete: () => leaf.destroy(),
      }),
    });
    s.fxCone(dir, half, range, 0x2ecc40); // jemný náznak zásahové plochy
  }

  destroy() {
    if (this.puffs) this.puffs.forEach(p => p.img.destroy());
    if (this.orbiters) this.orbiters.forEach(o => o.destroy());
  }
};
