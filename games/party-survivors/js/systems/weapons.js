// ============================================================
// Zbraně — všech 9 archetypů útoků dle parametrů z logika.xlsx
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
    this.acc = 0;        // akumulátor cooldownu
    this.tickAcc = 0;    // akumulátor tiků (aura, proud)
    this.streamUntil = 0;
    this.streamDir = 0;
    const init = this['init_' + this.def.archetype];
    if (init) init.call(this);
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

  // ============ blití — kužel / proud s DoT (Rashid) ============
  tick_cone(dt) {
    const s = this.scene, def = this.def, now = s.time.now;
    this.acc += dt;
    if (this.acc >= this.cd() && now >= this.streamUntil) {
      // aktivace čistě na interval (VS styl) — i naprázdno
      this.acc = 0;
      this.streamUntil = now + def.duration * 1000;
      this.tickAcc = def.tick; // první tik okamžitě
      this.streamDir = s.aimDir();
    }
    if (now < this.streamUntil) {
      this.tickAcc += dt;
      if (this.tickAcc >= def.tick) {
        this.tickAcc = 0;
        this.streamDir = s.aimDir(); // proud se stáčí za nejbližším
        const range = this.area(def.range);
        const half = Phaser.Math.DegToRad(def.angle / 2);
        s.enemiesInCone(this.streamDir, half, range).forEach(e =>
          s.dealDamage(e, this.dmg(), { dot: { dps: def.dot.dps, dur: def.dot.dur } }));
        s.fxCone(this.streamDir, half, range, 0x39ff14);
      }
    }
  }

  // ============ chcaní — paprsek + kaluž (Poskok) ============
  tick_beam(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.range);

    const dir = s.aimDir(); // střílí vždy — i naprázdno
    const targets = s.enemiesInBeam(dir, range, def.width).slice(0, def.pierce);
    targets.forEach(e => s.dealDamage(e, this.dmg()));

    // kaluž na konci zásahu (poslední zasažený, jinak konec paprsku)
    const last = targets[targets.length - 1];
    const zx = last ? last.x : s.player.x + Math.cos(dir) * range;
    const zy = last ? last.y : s.player.y + Math.sin(dir) * range;
    s.addZone({
      x: zx, y: zy, r: this.area(def.puddle.r),
      dur: def.puddle.dur, slowPct: def.puddle.slow,
      tint: 0xd8c020, alpha: 0.40,
    });
    s.fxBeam(dir, range, def.width, 0xffe600);
  }

  // ============ tagování — stacionární zóny (Don G) ============
  init_zone() { this.tags = []; }
  tick_zone(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def, now = s.time.now;

    this.tags = this.tags.filter(z => z.until > now);
    if (this.tags.length >= def.maxZones) s.removeZone(this.tags.shift());

    const tints = [0xff2bd6, 0x00ffff, 0xb44cff];
    this.tags.push(s.addZone({
      x: s.player.x, y: s.player.y, r: this.area(def.r),
      dur: def.dur, tickDmg: this.dmg(), tick: def.tick,
      tint: tints[Math.floor(Math.random() * tints.length)], alpha: 0.5,
    }));
  }

  // ============ házení lahváčem — balistický projektil (Kaar) ============
  tick_lob(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.range);

    // hází vždy: na nejbližšího (dolet omezen dosahem), jinak do směru pohybu
    let tx, ty;
    const t = s.nearestEnemy(800);
    if (t) {
      const d = Phaser.Math.Distance.Between(s.player.x, s.player.y, t.x, t.y);
      const dir = Phaser.Math.Angle.Between(s.player.x, s.player.y, t.x, t.y);
      const dist = Math.min(d, range);
      tx = s.player.x + Math.cos(dir) * dist;
      ty = s.player.y + Math.sin(dir) * dist;
    } else {
      const dir = s.aimDir();
      const dist = range * (0.4 + Math.random() * 0.6);
      tx = s.player.x + Math.cos(dir) * dist;
      ty = s.player.y + Math.sin(dir) * dist;
    }
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
    // přímý zásah
    s.enemiesInCircle(x, y, this.area(28)).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: 1 }));
    // výbuch střepů
    s.enemiesInCircle(x, y, this.area(def.burst.r)).forEach(e =>
      s.dealDamage(e, this.dmg(def.burst.dmg)));
    // střepy na zemi
    s.addZone({
      x, y, r: this.area(def.shards.r),
      dur: def.shards.dur, tickDmg: this.dmg(def.shards.dmg), tick: def.shards.tick,
      tint: 0x8a5a2b, alpha: 0.45,
    });
    s.fxCircle(x, y, this.area(def.burst.r), 0xc77b30);
  }

  // ============ plivání vajglů — naváděcí projektil (Fjodor Ket) ============
  tick_homing(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    // střílí vždy: s cílem navádí, bez cíle letí rovně do směru pohybu
    const t = s.nearestEnemy(800);
    s.fireProjectile({
      texture: 'proj-vajgl', target: t, dir: s.aimDir(), speed: 380, life: 1.1,
      dmg: this.dmg(), pierce: def.pierce, homing: !!t,
      effects: { slow: { pct: def.slow.pct, dur: def.slow.dur } },
    });
  }

  // ============ rozlejvání piva — sweep v oblouku (eXtreme) ============
  tick_sweep(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.range);

    const dir = s.aimDir(); // máchne vždy — i naprázdno
    const half = Phaser.Math.DegToRad(def.angle / 2);
    s.enemiesInCone(dir, half, range).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: 1 }));

    // kaluž piva před hrdinou
    s.addZone({
      x: s.player.x + Math.cos(dir) * range * 0.6,
      y: s.player.y + Math.sin(dir) * range * 0.6,
      r: this.area(def.puddle.r), dur: def.puddle.dur, slowPct: def.puddle.slow,
      tint: 0xffb400, alpha: 0.35,
    });
    s.fxCone(dir, half, range, 0xffb400);
  }

  // ============ vypouštění dýmu — trvalá aura (fadadevada) ============
  init_aura() {
    this.circle = this.scene.add.image(0, 0, 'glow')
      .setTint(0x9fb8c8).setAlpha(0.22).setDepth(4);
  }
  tick_aura(dt) {
    const s = this.scene, def = this.def;
    const r = this.area(def.r);
    this.circle.setPosition(s.player.x, s.player.y).setScale(r * 2 / 128);

    this.tickAcc += dt;
    if (this.tickAcc < def.tick) return;
    this.tickAcc = 0;
    s.enemiesInCircle(s.player.x, s.player.y, r).forEach(e =>
      s.dealDamage(e, this.dmg(), { slow: { pct: def.slow, dur: 0.6 }, noFlash: true }));
  }

  // ============ kopání panáků — orbitující projektily (Zložík) ============
  init_orbit() {
    this.angle = 0;
    this.orbiters = [];
    for (let i = 0; i < this.def.count; i++) {
      this.orbiters.push(this.scene.add.image(0, 0, 'panak').setDepth(9));
    }
  }
  tick_orbit(dt) {
    const s = this.scene, def = this.def, now = s.time.now;
    // rychlejší cooldowny = rychlejší oběh
    this.angle += dt * Math.PI * 2 / (def.period * s.stats.cdMult);
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
        s.dealDamage(e, this.dmg(), { knockback: 1 });
      });
    });
  }

  // ============ facka listem — úzký oblouk + stun (Sajmič Uraka) ============
  tick_slap(dt) {
    this.acc += dt;
    if (this.acc < this.cd()) return;
    this.acc = 0;
    const s = this.scene, def = this.def;
    const range = this.area(def.range);

    const dir = s.aimDir(); // švihne vždy — i naprázdno
    const half = Phaser.Math.DegToRad(def.angle / 2);
    s.enemiesInCone(dir, half, range).slice(0, def.targets).forEach(e =>
      s.dealDamage(e, this.dmg(), { knockback: 3, stun: def.stun }));

    // švih listem
    const leaf = s.add.image(
      s.player.x + Math.cos(dir) * range * 0.5,
      s.player.y + Math.sin(dir) * range * 0.5, 'leaf'
    ).setDepth(9).setRotation(dir - 0.8).setScale(1.6);
    s.tweens.add({
      targets: leaf, rotation: dir + 0.8, alpha: 0,
      duration: 180, onComplete: () => leaf.destroy(),
    });
    s.fxCone(dir, half, range, 0x2ecc40);
  }

  destroy() {
    if (this.circle) this.circle.destroy();
    if (this.orbiters) this.orbiters.forEach(o => o.destroy());
  }
};
