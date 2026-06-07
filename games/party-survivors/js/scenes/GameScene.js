// ============================================================
// GameScene — samotná hra: mapa, pohyb, nepřátelé, XP, level
// Fáze 4: všech 9 útoků, efekty (DoT/slow/stun/knockback), zóny,
//         level-up s výběrem ze 3 karet
// ============================================================
window.GameScene = class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.heroId = (data && data.heroId) || this.registry.get('heroId') || PS.HEROES[0].id;
  }

  create() {
    const M = PS.BALANCE.mapSize;
    this.hero = PS.HEROES.find(h => h.id === this.heroId) || PS.HEROES[0];

    // ---------- svět a podlaha ----------
    this.physics.world.setBounds(0, 0, M, M);
    this.floor = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'floor')
      .setOrigin(0).setScrollFactor(0).setDepth(0);
    this.add.rectangle(M / 2, M / 2, M, M)
      .setStrokeStyle(12, PS.COLORS.pink, 0.7).setDepth(1); // viditelný okraj mapy

    // ---------- hráč ----------
    this.player = this.physics.add.sprite(M / 2, M / 2, 'hero-' + this.hero.id);
    this.player.setCollideWorldBounds(true).setDepth(10);
    this.player.body.setSize(30, 40);

    // ---------- statistiky (základ + pasivka hrdiny) ----------
    const p = this.hero.passive;
    const B = PS.BALANCE.player;
    this.stats = {
      maxHp: Math.round(B.hp * (p.type === 'maxHp' ? 1 + p.value : 1)),
      speed: B.speed * (p.type === 'moveSpeed' ? 1 + p.value : 1),
      magnet: B.magnet * (p.type === 'magnet' ? 1 + p.value : 1),
      dmgMult: p.type === 'damage' ? 1 + p.value : 1,
      cdMult: p.type === 'cooldown' ? 1 - p.value : 1,
      areaMult: 1,
      regen: p.type === 'regen' ? p.value : 0,
      xpMult: p.type === 'xpGain' ? 1 + p.value : 1,
      critChance: p.type === 'crit' ? p.value : 0,
      critMult: p.type === 'crit' ? p.mult : 2,
      armorMult: p.type === 'armor' ? 1 - p.value : 1,
    };
    this.hp = this.stats.maxHp;
    this.level = 1;
    this.xp = 0;
    this.xpNext = PS.BALANCE.xpForLevel(1);
    this.kills = 0;
    this.elapsed = 0;
    this.invulnUntil = 0;
    this.regenAcc = 0;
    this.dotAcc = 0;
    this.over = false;
    this.pendingLevelUps = 0;
    this.levelUpOpen = false;
    this.passiveLevels = {};
    this.playerKbUntil = 0;   // hráč odhozen (Rohony, Churaq)
    this.playerStunUntil = 0; // hráč zmrazen (Schýza)
    this.freezeUntil = 0;     // klíč-freeze: všichni nepřátelé stojí
    this.buffSpeedUntil = 0;  // klíč-speed: +20 % rychlost
    this.buffDmgUntil = 0;    // klíč-damage: +30 % damage
    this.immortalUntil = 0;   // klíč-nesmrtelnost
    this.overflowXp = 0;      // XP z gemů, na které nezbyl pool
    this.facing = { x: 1, y: 0 }; // poslední směr pohybu — fallback míření útoků

    // ---------- klávesy (nastavené + šipky vždy) ----------
    this.bind = PS.Keys.load();
    this.pressed = new Set();
    this.input.keyboard.on('keydown', (e) => this.pressed.add(e.code));
    this.input.keyboard.on('keyup', (e) => this.pressed.delete(e.code));
    this.events.on('resume', () => this.pressed.clear()); // po pauze nezůstanou "viset" klávesy

    // ---------- skupiny ----------
    this.enemies = this.physics.add.group({ maxSize: 400 });
    this.gems = this.physics.add.group({ maxSize: 600 });
    this.projectiles = this.physics.add.group({ maxSize: 120 });
    this.enemyProjectiles = this.physics.add.group({ maxSize: 80 }); // zuby Kata
    this.zones = []; // kaluže, tagy, střepy — ručně spravované

    this.physics.add.collider(this.enemies, this.enemies); // tlačenice davu
    this.physics.add.overlap(this.player, this.enemies, (_pl, en) => this.touchEnemy(en));
    this.physics.add.overlap(this.projectiles, this.enemies, (pr, en) => this.projectileHit(pr, en));
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_pl, pr) => {
      if (!pr.active) return;
      this.hitPlayer(pr.dmg);
      this.recycle(pr);
    });
    this.powerups = this.physics.add.group({ maxSize: 20 }); // klíčky
    this.physics.add.overlap(this.player, this.powerups, (_pl, p) => this.collectPowerup(p));

    // ---------- kamera ----------
    this.cameras.main.setBounds(0, 0, M, M);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // ---------- zbraně (hrdina startuje se svým útokem) ----------
    this.weapons = [new PS.Weapon(this, this.hero.attackId)];

    // ---------- spawner + HUD ----------
    this.spawner = new PS.Spawner(this);
    this.time.addEvent({ delay: 3000, loop: true, callback: () => this.spawner.recycleFar() });
    this.scene.launch('HUD');

    // ---------- VFX ----------
    this.killEmitter = this.add.particles(0, 0, 'px', {
      speed: { min: 60, max: 170 }, lifespan: 350,
      scale: { start: 1.6, end: 0 }, tint: PS.COLORS.confetti,
      emitting: false,
    }).setDepth(6);
    this.confettiEmitter = this.add.particles(0, 0, 'px', {
      speed: { min: 80, max: 280 }, lifespan: 750, gravityY: 320,
      scale: { start: 2, end: 0.5 }, rotate: { start: 0, end: 360 },
      tint: PS.COLORS.confetti, emitting: false,
    }).setDepth(20);
    this.dmgPool = []; // pool plovoucích čísel poškození

    // ---------- powerupy (klíčky) ----------
    this.schedulePowerup();
  }

  update(_time, delta) {
    if (this.over) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    this.movePlayer();
    this.floor.setTilePosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.spawner.update(dt);
    this.moveEnemies();
    this.updateBosses(dt);
    this.updateGems();
    this.updatePowerups();
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.weapons.forEach(w => w.update(dt));
    this.updateZones(dt);
    this.updateDots(dt);
    this.updateRegen(dt);

    // vizuál nesmrtelnosti — zlaté pulzování
    if (this.time.now < this.immortalUntil) {
      this.player.setAlpha(0.65 + 0.35 * Math.sin(this.time.now / 60));
      this.player.setTint(0xffe600);
    } else if (this.player.alpha !== 1) {
      this.player.setAlpha(1);
      this.player.clearTint();
    }
  }

  // ---------- pohyb ----------
  movePlayer() {
    const now = this.time.now;
    if (now < this.playerStunUntil) { this.player.setVelocity(0, 0); return; } // hypnóza
    if (now < this.playerKbUntil) return; // letí od odhození
    const k = this.bind, P = this.pressed;
    const left = P.has(k.left) || P.has('ArrowLeft');
    const right = P.has(k.right) || P.has('ArrowRight');
    const up = P.has(k.up) || P.has('ArrowUp');
    const down = P.has(k.down) || P.has('ArrowDown');

    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(vx, vy) || 1;
    const spd = this.stats.speed * (now < this.buffSpeedUntil ? 1.2 : 1);
    this.player.setVelocity(vx / len * spd, vy / len * spd);
    if (vx !== 0) this.player.setFlipX(vx < 0);
    if (vx !== 0 || vy !== 0) {
      this.facing.x = vx / len;
      this.facing.y = vy / len;
    }
  }

  // směr míření útoků (VS styl): nejbližší nepřítel na obrazovce, jinak směr pohybu
  aimDir(maxDist = 800) {
    const t = this.nearestEnemy(maxDist);
    if (t) return Phaser.Math.Angle.Between(this.player.x, this.player.y, t.x, t.y);
    return Math.atan2(this.facing.y, this.facing.x);
  }

  moveEnemies() {
    const px = this.player.x, py = this.player.y;
    const now = this.time.now;
    const frozen = now < this.freezeUntil; // klíč-freeze
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      if (frozen || now < (e.stunUntil || 0)) { e.setVelocity(0, 0); return; }
      if (now < (e.kbUntil || 0)) return; // letí od knockbacku
      let sp = e.speed;
      if (now < (e.slowUntil || 0)) sp *= 1 - e.slowPct;
      const dx = px - e.x, dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.setVelocity(dx / d * sp, dy / d * sp);
      e.setFlipX(dx < 0);
    });
  }

  // ---------- centrální poškození a efekty ----------
  dealDamage(enemy, base, opts = {}) {
    if (!enemy || !enemy.active) return;
    let dmg = base * this.stats.dmgMult;
    if (this.time.now < this.buffDmgUntil) dmg *= 1.3; // klíč-damage
    let crit = false;
    if (!opts.noCrit && Math.random() < this.stats.critChance) {
      dmg *= this.stats.critMult;
      crit = true;
    }
    enemy.hp -= dmg;
    if (!opts.noFlash) {
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(60, () => { if (enemy.active) enemy.clearTint(); });
      this.showDamage(enemy.x, enemy.y, dmg, crit);
      PS.Audio.hit();
    }
    if (opts.slow) this.applySlow(enemy, opts.slow.pct, opts.slow.dur);
    if (opts.dot) {
      enemy.dotDps = opts.dot.dps;
      enemy.dotUntil = this.time.now + opts.dot.dur * 1000;
    }
    if (opts.knockback) this.knockback(enemy, opts.knockback);
    if (opts.stun && Math.random() < opts.stun.chance) {
      enemy.stunUntil = this.time.now + opts.stun.dur * 1000;
    }
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  applySlow(enemy, pct, dur) {
    const now = this.time.now;
    // zpomalení se nekumuluje — platí nejsilnější
    if ((enemy.slowUntil || 0) < now || pct >= (enemy.slowPct || 0)) {
      enemy.slowPct = pct;
      enemy.slowUntil = now + dur * 1000;
    }
  }

  knockback(enemy, strength) {
    const big = strength >= 3;
    const vel = big ? 420 : 190;
    const dur = big ? 220 : 130;
    const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    enemy.setVelocity(Math.cos(a) * vel, Math.sin(a) * vel);
    enemy.kbUntil = this.time.now + dur;
  }

  updateDots(dt) {
    this.dotAcc += dt;
    if (this.dotAcc < 0.25) return;
    const step = this.dotAcc;
    this.dotAcc = 0;
    const now = this.time.now;
    this.enemies.children.iterate(e => {
      if (!e || !e.active || (e.dotUntil || 0) < now) return;
      this.dealDamage(e, e.dotDps * step, { noCrit: true, noFlash: true });
    });
  }

  // ---------- zóny (kaluže, tagy, střepy) ----------
  addZone(cfg) {
    const z = {
      x: cfg.x, y: cfg.y, r: cfg.r,
      until: this.time.now + cfg.dur * 1000,
      tickDmg: cfg.tickDmg || 0,
      tick: cfg.tick || 0.4,
      slowPct: cfg.slowPct || 0,
      acc: 0,
      img: this.add.image(cfg.x, cfg.y, 'splat')
        .setTint(cfg.tint).setAlpha(cfg.alpha || 0.4)
        .setScale(cfg.r * 2 / 64).setDepth(2),
    };
    this.zones.push(z);
    return z;
  }

  removeZone(zone) { zone.until = 0; }

  updateZones(dt) {
    const now = this.time.now;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (now > z.until) {
        z.img.destroy();
        this.zones.splice(i, 1);
        continue;
      }
      z.acc += dt;
      if (z.acc < z.tick) continue;
      z.acc = 0;
      this.enemiesInCircle(z.x, z.y, z.r).forEach(e => {
        if (z.tickDmg) this.dealDamage(e, z.tickDmg, { noCrit: true, noFlash: true });
        if (z.slowPct) this.applySlow(e, z.slowPct, 0.45);
      });
    }
  }

  // ---------- prostorové dotazy ----------
  nearestEnemy(range) {
    const px = this.player.x, py = this.player.y;
    let best = null, bestD = range * range;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  enemiesInCircle(x, y, r) {
    const out = [];
    const rr = (r + 14) ** 2;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= rr) out.push(e);
    });
    return out;
  }

  enemiesInCone(dir, halfAngle, range) {
    const out = [];
    const px = this.player.x, py = this.player.y;
    const rr = (range + 16) ** 2;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      if ((e.x - px) ** 2 + (e.y - py) ** 2 > rr) return;
      const a = Phaser.Math.Angle.Between(px, py, e.x, e.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - dir)) <= halfAngle) out.push(e);
    });
    return out;
  }

  enemiesInBeam(dir, range, width) {
    const out = [];
    const px = this.player.x, py = this.player.y;
    const ux = Math.cos(dir), uy = Math.sin(dir);
    const halfW = width / 2 + 14;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      const dx = e.x - px, dy = e.y - py;
      const t = dx * ux + dy * uy;           // průmět na osu paprsku
      if (t < 0 || t > range + 16) return;
      const perp = Math.abs(dx * uy - dy * ux); // kolmá vzdálenost
      if (perp <= halfW) { e._beamT = t; out.push(e); }
    });
    return out.sort((a, b) => a._beamT - b._beamT);
  }

  // ---------- projektily ----------
  fireProjectile(cfg) {
    const p = this.projectiles.get(this.player.x, this.player.y, cfg.texture);
    if (!p) return;
    p.setActive(true).setVisible(true);
    p.body.enable = true;
    p.body.reset(this.player.x, this.player.y);
    p.setDepth(8);
    p.dmg = cfg.dmg;
    p.pierce = cfg.pierce;
    p.life = cfg.life;
    p.homing = !!cfg.homing;
    p.target = cfg.target || null;
    p.effects = cfg.effects || {};
    p.hitSet = new Set();
    if (cfg.target) {
      this.physics.moveToObject(p, cfg.target, cfg.speed);
    } else {
      // bez cíle letí rovně daným směrem (VS styl)
      p.setVelocity(Math.cos(cfg.dir) * cfg.speed, Math.sin(cfg.dir) * cfg.speed);
    }
    p.setRotation(Math.atan2(p.body.velocity.y, p.body.velocity.x));
  }

  updateProjectiles(dt) {
    this.projectiles.children.iterate(p => {
      if (!p || !p.active) return;
      p.life -= dt;
      if (p.life <= 0) { this.recycle(p); return; }
      if (p.homing && p.target && p.target.active) {
        const desired = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        const ang = Phaser.Math.Angle.RotateTo(p.body.velocity.angle(), desired, 3.0 * dt);
        const sp = p.body.velocity.length();
        p.setVelocity(Math.cos(ang) * sp, Math.sin(ang) * sp);
        p.setRotation(ang);
      }
    });
  }

  projectileHit(proj, enemy) {
    if (!proj.active || !enemy.active) return;
    if (proj.hitSet.has(enemy)) return; // stejný cíl jen jednou
    proj.hitSet.add(enemy);
    this.dealDamage(enemy, proj.dmg, proj.effects);
    proj.pierce -= 1;
    if (proj.pierce < 0) this.recycle(proj);
  }

  recycle(obj) { obj.disableBody(true, true); }

  // ---------- efektové vizuály ----------
  fxCone(dir, halfAngle, range, color) {
    const g = this.add.graphics().setDepth(7);
    g.fillStyle(color, 0.28);
    g.slice(this.player.x, this.player.y, range, dir - halfAngle, dir + halfAngle, false);
    g.fillPath();
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  fxBeam(dir, range, width, color) {
    const g = this.add.graphics().setDepth(7);
    g.lineStyle(width, color, 0.5);
    g.beginPath();
    g.moveTo(this.player.x, this.player.y);
    g.lineTo(this.player.x + Math.cos(dir) * range, this.player.y + Math.sin(dir) * range);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
  }

  fxCircle(x, y, r, color) {
    const g = this.add.graphics().setDepth(7);
    g.fillStyle(color, 0.3);
    g.fillCircle(x, y, r);
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  // ---------- souboj s hráčem ----------
  touchEnemy(enemy) {
    if (!enemy.active) return;
    this.hitPlayer(enemy.dmg);
  }

  hitPlayer(dmg) {
    if (this.over) return;
    const now = this.time.now;
    if (now < this.immortalUntil) return; // klíč-nesmrtelnost
    if (now < this.invulnUntil) return;
    PS.Audio.playerHit();
    this.invulnUntil = now + 400; // krátké i-frames

    this.hp -= dmg * this.stats.armorMult;
    this.player.setTintFill(0xff4444);
    this.time.delayedCall(120, () => { if (this.player.active) this.player.clearTint(); });
    this.cameras.main.shake(90, 0.004);
    if (this.hp <= 0) this.gameOver();
  }

  killEnemy(enemy) {
    this.kills++;
    this.killEmitter.explode(6, enemy.x, enemy.y);
    if (enemy.isBoss) {
      // boss rozsype kruh gemů
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        this.dropGem(enemy.x + Math.cos(a) * 45, enemy.y + Math.sin(a) * 45, enemy.strength);
      }
      this.events.emit('announce', { text: `${enemy.bossName} PORAŽEN!`, color: PS.COLORS.yellow });
      this.cameras.main.shake(250, 0.008);
      this.fxCircle(enemy.x, enemy.y, 110, PS.COLORS.yellow);
      this.confettiEmitter.explode(50, enemy.x, enemy.y);
      PS.Audio.bossDead();
    } else {
      this.dropGem(enemy.x, enemy.y, enemy.xp);
      PS.Audio.kill();
    }
    enemy.disableBody(true, true);
  }

  // plovoucí čísla poškození (pool, jen přímé zásahy)
  showDamage(x, y, dmg, crit) {
    let t = this.dmgPool.find(o => !o.visible);
    if (!t) {
      if (this.dmgPool.length >= 48) return; // pool vyčerpán — číslo zahodíme
      t = this.add.text(0, 0, '', {
        fontFamily: PS.UI.FONT, fontSize: '11px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(25).setVisible(false);
      this.dmgPool.push(t);
    }
    t.setText(String(Math.round(dmg)));
    t.setFontSize(crit ? 15 : 11);
    t.setColor(crit ? '#ffe600' : '#ffffff');
    t.setPosition(x + Phaser.Math.Between(-10, 10), y - 14);
    t.setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: t, y: t.y - 26, alpha: 0, duration: 550,
      onComplete: () => t.setVisible(false),
    });
  }

  // poškození bez multiplikátorů (klíč-čistka)
  rawDamage(enemy, dmg) {
    if (!enemy || !enemy.active) return;
    enemy.hp -= dmg;
    enemy.setTintFill(0xffffff);
    this.time.delayedCall(60, () => { if (enemy.active) enemy.clearTint(); });
    this.showDamage(enemy.x, enemy.y, dmg, false);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  // ---------- bossové ----------
  updateBosses(dt) {
    if (this.time.now < this.freezeUntil) return; // zmražení bossové neútočí
    const px = this.player.x, py = this.player.y;
    this.enemies.children.iterate(e => {
      if (!e || !e.active || !e.isBoss) return;
      e.atkAcc += dt;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, px, py);

      switch (e.mechanic) {
        case 'projectiles': // Kato — plive zuby
          if (e.atkAcc >= 2.5 && dist < 600) { e.atkAcc = 0; this.bossSpitTeeth(e); }
          break;
        case 'pushwave': // Rohony — zvuková vlna (bez damage)
          if (e.atkAcc >= 3.0 && dist < 300) { e.atkAcc = 0; this.bossPushwave(e); }
          break;
        case 'meleeswing': // Churaq — baseballka jen na blízko
          if (e.atkAcc >= 2.0 && dist < 150) { e.atkAcc = 0; this.bossSwing(e); }
          break;
        case 'summoner': // Haades — vyvolává Pikaře
          if (e.atkAcc >= 4.0) { e.atkAcc = 0; this.bossSummon(e); }
          break;
        case 'hypnosis': // Schýza — zmrazí hráče
          if (e.atkAcc >= 5.0 && dist < 420) { e.atkAcc = 0; this.bossHypnosis(e); }
          break;
      }
    });
  }

  bossSpitTeeth(boss) {
    const base = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
    [-0.25, 0, 0.25].forEach(off => {
      const p = this.enemyProjectiles.get(boss.x, boss.y, 'tooth');
      if (!p) return;
      p.setActive(true).setVisible(true);
      p.body.enable = true;
      p.body.reset(boss.x, boss.y);
      p.setDepth(8);
      p.dmg = boss.dmg * 0.7;
      p.life = 3;
      const a = base + off;
      p.setVelocity(Math.cos(a) * 240, Math.sin(a) * 240);
      p.setRotation(a);
    });
  }

  bossPushwave(boss) {
    // expandující prstenec (kreslíme lokálně na 0,0 — scaluje se od originu graphics)
    const ring = this.add.graphics({ x: boss.x, y: boss.y }).setDepth(7);
    ring.lineStyle(6, 0xb44cff, 0.7);
    ring.strokeCircle(0, 0, 40);
    this.tweens.add({
      targets: ring, scaleX: 7, scaleY: 7, alpha: 0,
      duration: 450,
      onComplete: () => ring.destroy(),
    });

    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 300) {
      const a = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
      this.player.setVelocity(Math.cos(a) * 640, Math.sin(a) * 640);
      this.playerKbUntil = this.time.now + 280; // odhození, ale žádný damage
    }
  }

  bossSwing(boss) {
    this.fxCircle(boss.x, boss.y, 150, 0xff9100);
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 160) {
      this.hitPlayer(boss.dmg);
      const a = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
      this.player.setVelocity(Math.cos(a) * 520, Math.sin(a) * 520);
      this.playerKbUntil = this.time.now + 250;
    }
  }

  bossSummon(boss) {
    this.fxCircle(boss.x, boss.y, 90, 0x9933ff);
    // Pikaři lv2 a lv3 (u vyšších cyklů bosse o cyklus víc): síla = 3 + 5×(lv−1)
    const c = boss.bossLevel - 1;
    const strengths = [3 + 5 * (1 + c), 3 + 5 * (1 + c), 3 + 5 * (2 + c)];
    strengths.forEach((s, i) => {
      const a = Math.random() * Math.PI * 2;
      this.spawner.spawnEnemyAt(s,
        Phaser.Math.Clamp(boss.x + Math.cos(a) * 70, 30, PS.BALANCE.mapSize - 30),
        Phaser.Math.Clamp(boss.y + Math.sin(a) * 70, 30, PS.BALANCE.mapSize - 30));
    });
  }

  bossHypnosis(boss) {
    this.playerStunUntil = this.time.now + 500;
    this.hitPlayer(boss.dmg * 0.4); // menší damage
    this.player.setTintFill(0xb44cff);
    this.time.delayedCall(500, () => { if (this.player.active) this.player.clearTint(); });
    this.cameras.main.flash(300, 120, 40, 200);
  }

  updateEnemyProjectiles(dt) {
    this.enemyProjectiles.children.iterate(p => {
      if (!p || !p.active) return;
      p.life -= dt;
      if (p.life <= 0) this.recycle(p);
    });
  }

  // ---------- XP ----------
  dropGem(x, y, value) {
    const gem = this.gems.get(x, y, 'gem');
    if (!gem) {
      this.overflowXp += value; // pool plný — XP se přičte k příštímu gemu
      return;
    }
    gem.setActive(true).setVisible(true);
    gem.body.enable = true;
    gem.body.reset(x, y);
    gem.value = value + this.overflowXp;
    this.overflowXp = 0;
    gem.magnetized = false;
    gem.setDepth(3);
  }

  updateGems() {
    const px = this.player.x, py = this.player.y;
    const magnetSq = this.stats.magnet * this.stats.magnet;
    this.gems.children.iterate(g => {
      if (!g || !g.active) return;
      const dSq = (g.x - px) ** 2 + (g.y - py) ** 2;
      if (dSq < 26 * 26) { this.collectGem(g); return; }
      if (g.magnetized) this.physics.moveToObject(g, this.player, 540);
      else if (dSq < magnetSq) this.physics.moveToObject(g, this.player, 340);
      else g.setVelocity(0, 0);
    });
  }

  collectGem(gem) {
    this.xp += gem.value * this.stats.xpMult;
    gem.disableBody(true, true);
    PS.Audio.gem();
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = PS.BALANCE.xpForLevel(this.level);
      this.pendingLevelUps++;
    }
    if (this.pendingLevelUps > 0 && !this.levelUpOpen) this.openLevelUp();
  }

  // ---------- powerupy (klíčky) ----------
  schedulePowerup() {
    const delay = Phaser.Math.Between(
      PS.BALANCE.powerupIntervalMin * 1000, PS.BALANCE.powerupIntervalMax * 1000);
    this.time.delayedCall(delay, () => {
      if (this.over) return;
      this.spawnPowerup();
      this.schedulePowerup();
    });
  }

  spawnPowerup() {
    const def = Phaser.Utils.Array.GetRandom(PS.POWERUPS);
    const a = Math.random() * Math.PI * 2;
    const r = Phaser.Math.Between(380, 650);
    const m = PS.BALANCE.mapSize;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * r, 40, m - 40);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * r, 40, m - 40);

    const p = this.powerups.get(x, y, 'key');
    if (!p) return;
    p.setActive(true).setVisible(true);
    p.body.enable = true;
    p.body.reset(x, y);
    p.setTint(def.color).setDepth(4);
    p.def = def;
    p.magnetized = false;
    if (p.pulseTween) p.pulseTween.stop();
    p.setScale(1.2);
    p.pulseTween = this.tweens.add({
      targets: p, scale: { from: 1.2, to: 1.7 }, duration: 450, yoyo: true, repeat: -1,
    });
  }

  updatePowerups() {
    const px = this.player.x, py = this.player.y;
    const magnetSq = this.stats.magnet ** 2;
    this.powerups.children.iterate(p => {
      if (!p || !p.active) return;
      const dSq = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (p.magnetized) this.physics.moveToObject(p, this.player, 540);
      else if (dSq < magnetSq) this.physics.moveToObject(p, this.player, 340);
      else p.setVelocity(0, 0);
    });
  }

  collectPowerup(p) {
    if (!p.active) return;
    if (p.pulseTween) p.pulseTween.stop();
    const def = p.def;
    p.disableBody(true, true);
    this.applyPowerup(def);
    this.events.emit('announce', { text: def.name.toUpperCase() + '!', color: def.color });
    this.confettiEmitter.explode(20, this.player.x, this.player.y);
    PS.Audio.powerup();
  }

  applyPowerup(def) {
    const now = this.time.now;
    switch (def.effect.type) {
      case 'heal':
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * def.effect.value);
        break;
      case 'freeze':
        this.freezeUntil = now + def.effect.dur * 1000;
        this.cameras.main.flash(250, 80, 140, 255);
        break;
      case 'speed':
        this.buffSpeedUntil = now + def.effect.dur * 1000;
        break;
      case 'damage':
        this.buffDmgUntil = now + def.effect.dur * 1000;
        break;
      case 'magnet':
        this.gems.children.iterate(g => { if (g && g.active) g.magnetized = true; });
        this.powerups.children.iterate(pp => { if (pp && pp.active) pp.magnetized = true; });
        break;
      case 'immortal':
        this.immortalUntil = now + def.effect.dur * 1000;
        break;
      case 'nuke': {
        // čistka — všichni na obrazovce za 200 (bez multiplikátorů, silní bossové přežijí)
        const view = this.cameras.main.worldView;
        const targets = [];
        this.enemies.children.iterate(e => {
          if (e && e.active && view.contains(e.x, e.y)) targets.push(e);
        });
        targets.forEach(e => this.rawDamage(e, def.effect.dmg));
        this.cameras.main.flash(300, 255, 145, 0);
        this.cameras.main.shake(200, 0.008);
        break;
      }
    }
  }

  // ---------- level-up: výběr ze 3 karet ----------
  openLevelUp() {
    this.levelUpOpen = true;
    // flash se dělá až po zavření overlaye — uprostřed pauzy by zamrzl
    this.scene.pause();
    this.scene.launch('LevelUp');
    PS.Audio.levelup();
  }

  buildChoices() {
    const pool = [];
    if (this.weapons.length < PS.BALANCE.maxWeapons) {
      Object.keys(PS.ATTACKS).forEach(id => {
        if (!this.weapons.find(w => w.id === id)) pool.push({ type: 'newWeapon', id });
      });
    }
    this.weapons.forEach(w => {
      if (w.level < PS.BALANCE.weaponMaxLevel) pool.push({ type: 'weaponUp', id: w.id });
    });
    PS.UPGRADES.forEach(u => {
      if ((this.passiveLevels[u.id] || 0) < PS.BALANCE.passiveMaxLevel) {
        pool.push({ type: 'passive', id: u.id });
      }
    });
    Phaser.Utils.Array.Shuffle(pool);
    return pool.slice(0, 3);
  }

  applyChoice(c) {
    if (c.type === 'newWeapon') {
      this.weapons.push(new PS.Weapon(this, c.id));
    } else if (c.type === 'weaponUp') {
      this.weapons.find(w => w.id === c.id).level++;
    } else if (c.type === 'passive') {
      this.passiveLevels[c.id] = (this.passiveLevels[c.id] || 0) + 1;
      this.applyPassive(PS.UPGRADES.find(u => u.id === c.id).effect);
    }
  }

  applyPassive(eff) {
    const s = this.stats;
    switch (eff.type) {
      case 'maxHp': {
        const add = Math.round(s.maxHp * eff.value);
        s.maxHp += add;
        this.hp += add; // navíc HP rovnou doplní
        break;
      }
      case 'damage': s.dmgMult *= 1 + eff.value; break;
      case 'cooldown': s.cdMult *= 1 - eff.value; break;
      case 'moveSpeed': s.speed *= 1 + eff.value; break;
      case 'area': s.areaMult *= 1 + eff.value; break;
      case 'magnet': s.magnet *= 1 + eff.value; break;
      case 'regen': s.regen += eff.value; break;
    }
  }

  updateRegen(dt) {
    this.regenAcc += dt;
    if (this.regenAcc >= 1) {
      this.regenAcc -= 1;
      if (this.stats.regen > 0) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen);
    }
  }

  // ---------- konec ----------
  gameOver() {
    if (this.over) return;
    this.over = true;
    this.hp = 0;
    this.player.setVelocity(0, 0);
    PS.Audio.death();

    // rekord — nejdelší čas přežití
    let best = 0;
    try { best = parseFloat(localStorage.getItem(PS.STORAGE.best)) || 0; } catch (e) { /* private mode */ }
    const isRecord = this.elapsed > best;
    if (isRecord) {
      try { localStorage.setItem(PS.STORAGE.best, String(this.elapsed)); } catch (e) { /* private mode */ }
    }

    this.scene.stop('HUD');
    if (this.levelUpOpen) this.scene.stop('LevelUp'); // pojistka — overlay nesmí přežít hru
    this.scene.start('GameOver', {
      time: this.elapsed,
      kills: this.kills,
      level: this.level,
      heroName: this.hero.name,
      heroId: this.hero.id,
      best: isRecord ? this.elapsed : best,
      isRecord,
    });
  }

  burstConfetti(x, y) {
    this.confettiEmitter.explode(40, x, y);
  }
};
PS.scenes.push(window.GameScene);
