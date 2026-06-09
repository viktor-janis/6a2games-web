// ============================================================
// Spawner v2 — nekonečná progrese tierů + bossové
//
// Tier n (každých tierSeconds): typ (n-1)%5, level ⌊(n-1)/5⌋+1, síla n
//   gufrau(1) kravaťáci(2) pikaři(3) rodiče(4) policisté(5) gufrau lv2(6)…
// Boss síly B se spawne při startu tieru B-2 (B = 5, 10, 15, 20, 25, 30…)
//   cyklus: Kato Rohony Churaq Haades Schýza → Kato lv2 …
// ============================================================
window.PS = window.PS || {};

// info o nepříteli podle síly
PS.tierInfo = (strength) => {
  const idx = (strength - 1) % 5;
  const level = Math.floor((strength - 1) / 5) + 1;
  return { type: PS.ENEMIES[idx], level };
};

PS.Spawner = class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.elapsed = 0;
    this.lastTier = 0;
    this.spawnAcc = 0;                  // akumulátor stálého proudu (nepřátel/s)
    const B = PS.BALANCE;
    this.surgeUntil = 0;
    this.nextSurge = B.surge.period * (0.5 + Math.random() * 0.4); // první vlnka ~25-45 s
    this.nextHorde = B.horde.period * (0.8 + Math.random() * 0.4); // první horda ~2,1-3 min
  }

  tier() {
    return Math.floor(this.elapsed / PS.BALANCE.tierSeconds) + 1;
  }

  // Nerovnoměrný spawn (VS styl): slabší STÁLÝ proud podle `spawnRate` +
  // krátké VLNKY (`surge`) + občas velká telegrafovaná HORDA (`spawnHorde`).
  update(dt) {
    this.elapsed += dt;
    const B = PS.BALANCE, now = this.elapsed;
    const tier = this.tier();
    if (tier > this.lastTier) { this.lastTier = tier; this.onNewTier(tier); }

    // malá vlnka — krátké zvýšení proudu (občasný nápor mezi klidem)
    if (now >= this.nextSurge) {
      this.surgeUntil = now + B.surge.dur;
      this.nextSurge = now + B.surge.period * (0.8 + Math.random() * 0.5);
    }
    // velká horda — jednorázový soustředěný nápor s telegrafem
    if (now >= this.nextHorde) {
      this.nextHorde = now + B.horde.period * (0.85 + Math.random() * 0.35);
      this.spawnHorde(tier);
    }

    // stálý proud podle rate (nepřátel/s); během vlnky × surge.mult
    const surge = now < this.surgeUntil ? B.surge.mult : 1;
    this.spawnAcc += B.spawnRate(now) * surge * dt;
    let budget = B.maxEnemies - this.scene.enemies.countActive(true);
    while (this.spawnAcc >= 1 && budget > 0) {
      this.spawnAcc -= 1; budget--;
      this.spawnTrickle(tier);
    }
    if (this.spawnAcc > 4) this.spawnAcc = 4; // strop akumulace (po stropu/pauze nenaskáče naráz)
  }

  onNewTier(tier) {
    if (tier > 1) {
      const info = PS.tierInfo(tier);
      this.scene.events.emit('announce', {
        text: `PŘICHÁZEJÍ: ${info.type.name.toUpperCase()}${info.level > 1 ? ' LV ' + info.level : ''}`,
        color: PS.COLORS.orange,
      });
    }
    // boss síly B = tier + 2, pokud je B násobek 5
    const B = tier + 2;
    if (B >= 5 && B % 5 === 0) this.spawnBoss(B);
  }

  // jeden nepřítel ze stálého proudu — mix sil 60/25/15 %, intercept směru pohybu
  spawnTrickle(tier) {
    const r = Math.random();
    const s = r < 0.6 ? tier : r < 0.85 ? Math.max(1, tier - 1) : Math.max(1, tier - 2);
    const pos = this.ringPosition(490, 595, true); // bias do směru pohybu — nelze utíkat donekonečna
    this.spawnEnemyAt(s, pos.x, pos.y);
  }

  // velká HORDA — soustředěný nápor z jednoho směru (přednostně kam hrdina míří,
  // aby nešel jen obejít) + telegraf (hláška, otřes kamery, zvuk). Roste s tierem.
  spawnHorde(tier) {
    const B = PS.BALANCE, m = B.mapSize, scene = this.scene;
    const count = Math.min(B.horde.size(tier), B.maxEnemies - scene.enemies.countActive(true));
    if (count <= 0) return;
    const v = scene.player.body && scene.player.body.velocity;
    const base = (v && (Math.abs(v.x) > 10 || Math.abs(v.y) > 10))
      ? Math.atan2(v.y, v.x) : Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * 1.4; // oblouk ±0,7 rad kolem směru
      const d = 470 + Math.random() * 190;
      const r = Math.random();
      const s = r < 0.5 ? tier : r < 0.8 ? Math.max(1, tier - 1) : Math.max(1, tier - 2);
      this.spawnEnemyAt(s,
        Phaser.Math.Clamp(scene.player.x + Math.cos(a) * d, 30, m - 30),
        Phaser.Math.Clamp(scene.player.y + Math.sin(a) * d, 30, m - 30));
    }
    scene.events.emit('announce', { text: 'VALÍ SE DAV!', color: PS.COLORS.orange });
    scene.cameras.main.shake(220, 0.004);
    PS.Audio.horde();
  }

  spawnEnemyAt(strength, x, y) {
    const scene = this.scene;
    const info = PS.tierInfo(strength);

    const enemy = scene.enemies.get(x, y, 'enemy-' + info.type.id);
    if (!enemy) return null;
    // POOL: group.get() při recyklaci texturu NEnastaví → jinak by recyklovaný
    // sprite zůstal se skinem předchozího typu nepřítele. Nastavit ručně.
    enemy.setTexture('enemy-' + info.type.id);
    enemy.setActive(true).setVisible(true);
    enemy.body.enable = true;
    enemy.body.reset(x, y);
    enemy.setDepth(5);

    // vizuální odlišení levelů: větší + tmavěji tónované
    const lvlScale = 1 + (info.level - 1) * 0.13;
    enemy.setScale(lvlScale);
    const tints = [null, 0xffc9c9, 0xff9e9e, 0xd49eff, 0x9effd2, 0xffe09e];
    const tint = tints[Math.min(info.level - 1, tints.length - 1)];
    if (tint) enemy.setTint(tint); else enemy.clearTint();
    enemy.body.setSize(28, 38, true);

    enemy.isBoss = false;
    enemy.strength = strength;
    enemy.hp = PS.BALANCE.enemyHp(strength);
    enemy.maxHp = enemy.hp;
    enemy.dmg = PS.BALANCE.enemyDmg(strength);
    enemy.speed = PS.BALANCE.enemySpeed(strength) * info.type.speedMult; // typová rychlost
    enemy.xp = strength; // hodnota gemu

    // reset stavových efektů (pooling!)
    enemy.slowUntil = 0; enemy.slowPct = 0;
    enemy.dotUntil = 0; enemy.dotDps = 0;
    enemy.kbUntil = 0; enemy.stunUntil = 0;
    enemy.lastOrbHit = 0;
    enemy.ringWall = false;
    return enemy;
  }

  spawnBoss(strength) {
    const scene = this.scene;
    const cycleIdx = (strength / 5 - 1) % 5;        // 0..4 → Kato..Schýza
    const level = Math.floor((strength - 5) / 25) + 1; // Kato(5)=1 … Kato(30)=2
    const def = PS.BOSSES[cycleIdx];

    // aréna: střed = pozice hráče, oříznutá tak, aby se celý ring vešel do mapy
    const r = PS.BALANCE.arenaRadius;
    const m = PS.BALANCE.mapSize;
    const cx = Phaser.Math.Clamp(scene.player.x, r + 80, m - r - 80);
    const cy = Phaser.Math.Clamp(scene.player.y, r + 80, m - r - 80);

    // 1) nejdřív se uzavře ring (boss zatím není), 2) po 2 s se boss objeví UVNITŘ.
    // Dřív boss vznikal současně s ringem a dav ho při uzavírání vytlačil ven →
    // nedostal se zpět dovnitř (nešel přes zeď nepřátel). Takhle vznikne až v aréně.
    scene.startBossFight(cx, cy);
    scene.time.delayedCall(2000, () => this.placeBoss(def, level, strength));
  }

  // boss se objeví NÁHODNĚ uvnitř už uzavřeného ringu (ne přímo na hrdinovi)
  placeBoss(def, level, strength) {
    const scene = this.scene;
    if (scene.over || !scene.bossFight) return; // hra skončila / ring se mezitím rozpadl
    const { cx, cy, r } = scene.bossFight;

    // náhodná pozice uvnitř ringu (do ~0,7r od středu), ale ne přilepená na hrdinu
    let bx, by, tries = 0;
    do {
      const ang = Math.random() * Math.PI * 2;
      const rad = (0.25 + Math.random() * 0.45) * r;
      bx = cx + Math.cos(ang) * rad;
      by = cy + Math.sin(ang) * rad;
    } while (++tries < 8 && Phaser.Math.Distance.Between(bx, by, scene.player.x, scene.player.y) < 150);

    const boss = scene.enemies.get(bx, by, 'boss-' + def.id);
    if (!boss) return;
    // POOL: group.get() při recyklaci mrtvého spritu NEnastaví texturu (jen pozici),
    // takže by boss zdědil skin po předchozím nepříteli/bossovi → nutno explicitně.
    boss.setTexture('boss-' + def.id);
    boss.setActive(true).setVisible(true);
    boss.body.enable = true;
    boss.body.reset(bx, by);
    boss.setDepth(6);
    boss.setScale(2.1 + (level - 1) * 0.25);
    if (level > 1) boss.setTint(0xff9e9e); else boss.clearTint();
    boss.body.setSize(40, 50, true);

    boss.isBoss = true;
    boss.bossDef = def;
    boss.bossLevel = level;
    boss.bossName = def.name.toUpperCase() + (level > 1 ? ' LV ' + level : '');
    boss.mechanic = def.mechanic;
    boss.atkAcc = 0;
    boss.strength = strength;
    boss.hp = PS.BALANCE.bossHp(strength);
    boss.maxHp = boss.hp;
    boss.dmg = PS.BALANCE.bossDmg(strength);
    boss.speed = 29; // ×0,7 s tempem hry
    boss.xp = strength; // killEnemy bossům rozsype víc gemů

    boss.slowUntil = 0; boss.slowPct = 0;
    boss.dotUntil = 0; boss.dotDps = 0;
    boss.kbUntil = 0; boss.stunUntil = 0;
    boss.lastOrbHit = 0;
    boss.ringWall = false;

    scene.bossFight.boss = boss; // teprve teď je v aréně skutečný boss
    scene.events.emit('announce', { text: `BOSS: ${boss.bossName}!`, color: PS.COLORS.red });
    scene.cameras.main.shake(300, 0.006);
    PS.Audio.boss();
  }

  // pozice na prstenci kolem hráče, oříznutá na hranice mapy
  // biased=true: když se hráč hýbe, spawn převážně ve směru pohybu (interception jako VS)
  ringPosition(minR, maxR, biased = false) {
    const scene = this.scene;
    let angle;
    const v = scene.player.body && scene.player.body.velocity;
    if (biased && v && (Math.abs(v.x) > 10 || Math.abs(v.y) > 10) && Math.random() < 0.65) {
      angle = Math.atan2(v.y, v.x) + (Math.random() - 0.5) * Math.PI * 1.2; // ±108° kolem směru
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    const r = minR + Math.random() * (maxR - minR);
    const m = PS.BALANCE.mapSize;
    return {
      x: Phaser.Math.Clamp(scene.player.x + Math.cos(angle) * r, 30, m - 30),
      y: Phaser.Math.Clamp(scene.player.y + Math.sin(angle) * r, 30, m - 30),
    };
  }

  // nepřátelé příliš daleko se přemístí zpět k okraji obrazovky (bossové a ring ne)
  recycleFar() {
    const scene = this.scene;
    scene.enemies.children.iterate(e => {
      if (!e || !e.active || e.isBoss || e.ringWall) return;
      const d = Phaser.Math.Distance.Between(e.x, e.y, scene.player.x, scene.player.y);
      if (d > 1050) {
        const pos = this.ringPosition(525, 595, true);
        e.body.reset(pos.x, pos.y);
      }
    });
  }
};
