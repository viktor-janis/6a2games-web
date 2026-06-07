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
    this.acc = 0;
    this.lastTier = 0;
  }

  tier() {
    return Math.floor(this.elapsed / PS.BALANCE.tierSeconds) + 1;
  }

  // interval mezi vlnami — pomalý rozjezd, ke 13. minutě maximální tlak
  interval() {
    return Phaser.Math.Clamp(2.0 - this.tier() * 0.12 - this.elapsed / 900, 0.4, 2.0);
  }

  // velikost vlny — mírný růst v mid-game, strmý až v pozdních tierech
  waveSize() {
    return 1 + Math.floor(this.tier() * 0.6) + Math.floor(this.elapsed / 240);
  }

  update(dt) {
    this.elapsed += dt;
    const tier = this.tier();
    if (tier > this.lastTier) {
      this.lastTier = tier;
      this.onNewTier(tier);
    }
    this.acc += dt;
    if (this.acc >= this.interval()) {
      this.acc = 0;
      this.spawnWave(tier);
    }
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

  // mix vlny: 60 % aktuální tier, 25 % tier-1, 15 % tier-2
  spawnWave(tier) {
    const alive = this.scene.enemies.countActive(true);
    const count = Math.min(this.waveSize(), PS.BALANCE.maxEnemies - alive);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const strength = r < 0.6 ? tier : r < 0.85 ? Math.max(1, tier - 1) : Math.max(1, tier - 2);
      const pos = this.ringPosition(490, 595, true); // bias do směru pohybu — nelze utíkat donekonečna
      this.spawnEnemyAt(strength, pos.x, pos.y);
    }
  }

  spawnEnemyAt(strength, x, y) {
    const scene = this.scene;
    const info = PS.tierInfo(strength);

    const enemy = scene.enemies.get(x, y, 'enemy-' + info.type.id);
    if (!enemy) return null;
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
    // boss nastoupí uvnitř arény, na protější stranu než stojí hrdina
    const a = Phaser.Math.Angle.Between(cx, cy, scene.player.x, scene.player.y) + Math.PI;
    const pos = { x: cx + Math.cos(a) * r * 0.55, y: cy + Math.sin(a) * r * 0.55 };

    const boss = scene.enemies.get(pos.x, pos.y, 'boss-' + def.id);
    if (!boss) return;
    boss.setActive(true).setVisible(true);
    boss.body.enable = true;
    boss.body.reset(pos.x, pos.y);
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

    scene.events.emit('announce', { text: `BOSS: ${boss.bossName}!`, color: PS.COLORS.red });
    scene.cameras.main.shake(300, 0.006);
    PS.Audio.boss();

    // nepřátelé utvoří ring — souboj 1v1 v aréně (viz GameScene.startBossFight)
    scene.startBossFight(boss, cx, cy);
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
