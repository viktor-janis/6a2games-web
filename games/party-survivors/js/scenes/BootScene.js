// ============================================================
// BootScene — procedurální generování textur (žádné externí soubory)
// ============================================================
window.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makePixel();
    this.makeGlow();
    this.makeHeroTextures();
    this.makeEnemyTextures();
    this.makeBossTextures();
    this.makeFloor();
    this.makeGem();
    this.makeKey();
    this.makeRunda();
    this.makeArrow();
    this.makeProjectiles();
    this.scene.start('Menu');
  }

  // 4×4 bílý čtvereček — konfety, particles (tintuje se za běhu)
  makePixel() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('px', 4, 4);
    g.destroy();
  }

  // Procedurální postavičky hrdinů — texture 'hero-<id>' (64×64)
  // Používá se jako portrét ve výběru a později jako herní sprite
  makeHeroTextures() {
    PS.HEROES.forEach((hero, idx) => {
      const g = this.add.graphics();
      const dark = Phaser.Display.Color.IntegerToColor(hero.color).darken(35).color;

      // nohy
      g.fillStyle(0x1a1a33, 1);
      g.fillRect(23, 50, 7, 11);
      g.fillRect(34, 50, 7, 11);
      // tělo (barva hrdiny)
      g.fillStyle(hero.color, 1);
      g.fillRoundedRect(19, 28, 26, 25, 5);
      // ruce
      g.fillStyle(dark, 1);
      g.fillRect(14, 31, 6, 16);
      g.fillRect(44, 31, 6, 16);
      // hlava
      g.fillStyle(0xffd9b3, 1);
      g.fillCircle(32, 17, 10);
      // vlasy / čepice (tmavší odstín barvy hrdiny, ať se liší)
      g.fillStyle(dark, 1);
      g.beginPath();
      g.arc(32, 16, 10, Math.PI, 0, false);
      g.fillPath();
      g.fillRect(22, 13, 20, 3 + (idx % 3)); // mírná variace účesu
      // oči
      g.fillStyle(0x111122, 1);
      g.fillRect(27, 17, 3, 3);
      g.fillRect(34, 17, 3, 3);

      g.generateTexture('hero-' + hero.id, 64, 64);
      g.destroy();
    });
  }

  // Nepřátelé — texture 'enemy-<id>' (48×48), vizuál dle popisu v tabulce
  makeEnemyTextures() {
    PS.ENEMIES.forEach(enemy => {
      const g = this.add.graphics();
      const c = enemy.color;
      const dark = Phaser.Display.Color.IntegerToColor(c).darken(40).color;

      if (enemy.id === 'rodice') {
        // pár — dvě menší postavy vedle sebe
        [[14, c], [34, 0xd8a0b8]].forEach(([cx, col]) => {
          g.fillStyle(0x1a1a33, 1); g.fillRect(cx - 6, 38, 5, 8); g.fillRect(cx + 1, 38, 5, 8);
          g.fillStyle(col, 1); g.fillRoundedRect(cx - 8, 22, 16, 17, 3);
          g.fillStyle(0xffd9b3, 1); g.fillCircle(cx, 14, 7);
          g.fillStyle(dark, 1); g.beginPath(); g.arc(cx, 13, 7, Math.PI, 0, false); g.fillPath();
        });
      } else if (enemy.id === 'pikari') {
        // ohnutá ošklivá postava — hlava nízko, předkloněné tělo
        g.fillStyle(0x1a1a33, 1); g.fillRect(18, 38, 6, 9); g.fillRect(28, 38, 6, 9);
        g.fillStyle(c, 1); g.fillRoundedRect(14, 22, 24, 18, 4);
        g.fillStyle(0xe8c9a0, 1); g.fillCircle(36, 18, 8);
        g.fillStyle(dark, 1); g.fillRect(30, 9, 13, 4);
        g.fillStyle(0x111122, 1); g.fillRect(38, 16, 3, 3);
      } else {
        // základní postava
        g.fillStyle(0x1a1a33, 1); g.fillRect(17, 38, 6, 9); g.fillRect(27, 38, 6, 9);
        g.fillStyle(c, 1); g.fillRoundedRect(13, 20, 24, 19, 4);
        g.fillStyle(0xffd9b3, 1); g.fillCircle(25, 12, 8);
        if (enemy.id === 'gufrau') {
          // hipster — kulich + brýle
          g.fillStyle(dark, 1); g.fillRect(17, 2, 16, 7);
          g.fillStyle(0x111122, 1); g.fillRect(18, 11, 14, 2);
        } else if (enemy.id === 'kravataci') {
          // oblek — košile + kravata
          g.fillStyle(0xffffff, 1); g.fillRect(22, 21, 6, 10);
          g.fillStyle(0xcc2222, 1); g.fillRect(24, 21, 2, 12);
          g.fillStyle(dark, 1); g.beginPath(); g.arc(25, 11, 8, Math.PI, 0, false); g.fillPath();
        } else if (enemy.id === 'policiste') {
          // policejní čepice se štítkem
          g.fillStyle(0x16307a, 1); g.fillRect(15, 3, 20, 6);
          g.fillRect(15, 8, 24, 2);
          g.fillStyle(0xffe600, 1); g.fillRect(23, 4, 4, 3);
        }
        g.fillStyle(0x111122, 1); g.fillRect(21, 11, 3, 3); g.fillRect(28, 11, 3, 3);
      }

      g.generateTexture('enemy-' + enemy.id, 48, 48);
      g.destroy();
    });
  }

  // Bossové — texture 'boss-<id>' (64×64), výrazně větší a temnější
  makeBossTextures() {
    PS.BOSSES.forEach(boss => {
      const g = this.add.graphics();

      if (boss.id === 'schyza') {
        // černá hmota, která není postava
        g.fillStyle(0x0a0a14, 1);
        g.fillCircle(32, 36, 22);
        g.fillCircle(16, 28, 13); g.fillCircle(48, 30, 14);
        g.fillCircle(24, 50, 12); g.fillCircle(42, 48, 13); g.fillCircle(32, 16, 12);
        g.fillStyle(0x1a1a2e, 1);
        g.fillCircle(26, 34, 8); g.fillCircle(42, 38, 7);
        // bílé oči
        g.fillStyle(0xffffff, 1);
        g.fillCircle(26, 32, 4); g.fillCircle(40, 33, 4);
        g.fillStyle(0x000000, 1);
        g.fillCircle(27, 33, 2); g.fillCircle(41, 34, 2);
      } else {
        const c = boss.color;
        const dark = Phaser.Display.Color.IntegerToColor(c).darken(35).color;
        // nohy
        g.fillStyle(0x14142a, 1);
        g.fillRect(20, 50, 9, 13); g.fillRect(35, 50, 9, 13);
        // tělo
        g.fillStyle(c, 1);
        g.fillRoundedRect(14, 26, 36, 28, 6);
        // ruce
        g.fillStyle(dark, 1);
        g.fillRect(8, 30, 7, 20); g.fillRect(49, 30, 7, 20);
        // hlava
        g.fillStyle(boss.id === 'haades' ? dark : 0xffd9b3, 1);
        g.fillCircle(32, 14, 11);

        if (boss.id === 'kato') {
          // bezdomovec — vousy + nakřivo klobouk
          g.fillStyle(0x999988, 1);
          g.fillRect(24, 16, 16, 7); // vousy
          g.fillStyle(0x4a3a20, 1);
          g.fillRect(20, 1, 22, 6); g.fillRect(17, 5, 28, 3);
        } else if (boss.id === 'rohony') {
          // tetování na obličeji
          g.fillStyle(dark, 1);
          g.beginPath(); g.arc(32, 13, 11, Math.PI, 0, false); g.fillPath();
          g.fillStyle(0xb44cff, 1);
          g.fillRect(26, 12, 2, 8); g.fillRect(36, 14, 6, 2); g.fillRect(30, 18, 4, 2);
        } else if (boss.id === 'churaq') {
          // kšiltovka + baseballka přes rameno
          g.fillStyle(0x222244, 1);
          g.fillRect(21, 2, 22, 7); g.fillRect(21, 8, 28, 3);
          g.fillStyle(0x8a5a2b, 1);
          g.save(); // pálka — šikmý obdélník
          g.translateCanvas(50, 22); g.rotateCanvas(-0.7);
          g.fillRect(-3, -22, 7, 26);
          g.restore();
        } else if (boss.id === 'haades') {
          // kápě se svítícíma očima
          g.fillStyle(dark, 1);
          g.fillCircle(32, 14, 12);
          g.fillStyle(0x9933ff, 1);
          g.fillRect(26, 12, 4, 4); g.fillRect(35, 12, 4, 4);
        }
        if (boss.id !== 'haades') {
          g.fillStyle(0x111122, 1);
          g.fillRect(27, 11, 3, 3); g.fillRect(35, 11, 3, 3);
        }
      }

      g.generateTexture('boss-' + boss.id, 64, 64);
      g.destroy();
    });

    // zub — projektil Kata
    const g = this.add.graphics();
    g.fillStyle(0xfffff0, 1);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(10, 4); g.lineTo(0, 8);
    g.closePath(); g.fillPath();
    g.generateTexture('tooth', 10, 8);
    g.destroy();
  }

  // Podlaha — taneční parket (tmavý checker, tile 128×128 pro TileSprite)
  makeFloor() {
    const size = 128, half = 64;
    const canvas = this.textures.createCanvas('floor', size, size);
    const ctx = canvas.getContext();
    ctx.fillStyle = '#0d0521';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#140a2e';
    ctx.fillRect(half, 0, half, half);
    ctx.fillRect(0, half, half, half);
    // jemné "konfety" na podlaze
    const dots = [[18, 30, '#ff2bd6'], [90, 14, '#00ffff'], [52, 88, '#ffe600'], [108, 104, '#39ff14'], [30, 112, '#b44cff']];
    dots.forEach(([x, y, col]) => {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 4, 4);
    });
    ctx.globalAlpha = 1;
    canvas.refresh();
  }

  // XP gem — zářivý diamant
  makeGem() {
    const g = this.add.graphics();
    g.fillStyle(0x00ff88, 1);
    g.beginPath();
    g.moveTo(8, 0); g.lineTo(16, 8); g.lineTo(8, 16); g.lineTo(0, 8);
    g.closePath(); g.fillPath();
    g.fillStyle(0xbfffe0, 1);
    g.beginPath();
    g.moveTo(8, 4); g.lineTo(12, 8); g.lineTo(8, 12); g.lineTo(4, 8);
    g.closePath(); g.fillPath();
    g.generateTexture('gem', 16, 16);
    g.destroy();
  }

  // Klíček — powerup (bílý, tintuje se barvou efektu)
  makeKey() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 7);          // hlava klíče
    g.fillStyle(0x555566, 1);
    g.fillCircle(8, 8, 3);          // otvor
    g.fillStyle(0xffffff, 1);
    g.fillRect(14, 6, 12, 4);       // dřík
    g.fillRect(20, 10, 3, 5);       // zub 1
    g.fillRect(25, 10, 3, 4);       // zub 2
    g.generateTexture('key', 28, 16);
    g.destroy();
  }

  // Runda panclů — čtyři panáky vedle sebe na tácku (vzácný treasure)
  makeRunda() {
    const g = this.add.graphics();
    // tácek
    g.fillStyle(0x8a6d3b, 1);
    g.fillRoundedRect(0, 22, 56, 6, 3);
    // 4 panáky, mírně různá hladina chlastu
    [3, 16, 29, 42].forEach((x, i) => {
      g.fillStyle(0xddeeff, 0.95);
      g.beginPath();
      g.moveTo(x, 4); g.lineTo(x + 11, 4); g.lineTo(x + 8.5, 23); g.lineTo(x + 2.5, 23);
      g.closePath(); g.fillPath();
      g.fillStyle(0xffd24a, 0.95);
      g.fillRect(x + 3, 10 + (i % 2) * 2, 6, 12 - (i % 2) * 2);
    });
    g.generateTexture('runda', 56, 30);
    g.destroy();
  }

  // Směrová šipka k Rundě panclů (HUD, tintuje se zlatou)
  makeArrow() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(24, 9); g.lineTo(0, 18); g.lineTo(7, 9);
    g.closePath(); g.fillPath();
    g.generateTexture('arrow', 24, 18);
    g.destroy();
  }

  // Projektily útoků
  makeProjectiles() {
    // vajgl — zelenožlutý nedopalek
    let g = this.add.graphics();
    g.fillStyle(0xa8c020, 1);
    g.fillRoundedRect(0, 1, 14, 6, 3);
    g.fillStyle(0xff6a00, 1);
    g.fillRect(12, 2, 2, 4); // žhavý konec
    g.generateTexture('proj-vajgl', 16, 8);
    g.destroy();

    // lahváč — hnědá láhev
    g = this.add.graphics();
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(0, 1, 13, 8, 3);
    g.fillStyle(0x6e4520, 1);
    g.fillRect(13, 3, 5, 4); // hrdlo
    g.fillStyle(0xffe600, 1);
    g.fillRect(3, 3, 5, 4); // etiketa
    g.generateTexture('proj-lahvac', 18, 10);
    g.destroy();

    // panák — štamprle
    g = this.add.graphics();
    g.fillStyle(0xddeeff, 0.95);
    g.beginPath();
    g.moveTo(1, 0); g.lineTo(9, 0); g.lineTo(7, 9); g.lineTo(3, 9);
    g.closePath(); g.fillPath();
    g.fillStyle(0xffe9a0, 0.9);
    g.fillRect(3, 4, 4, 4); // chlast uvnitř
    g.generateTexture('panak', 10, 10);
    g.destroy();

    // marihuanový list — pět cípů
    g = this.add.graphics();
    g.fillStyle(0x2ecc40, 1);
    const cx = 12, cy = 14;
    [[-90, 11], [-45, 9], [-135, 9], [0, 7], [180, 7]].forEach(([deg, len]) => {
      const a = Phaser.Math.DegToRad(deg);
      const tipX = cx + Math.cos(a) * len, tipY = cy + Math.sin(a) * len;
      const perp = a + Math.PI / 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(perp) * 2.5, cy + Math.sin(perp) * 2.5);
      g.lineTo(tipX, tipY);
      g.lineTo(cx - Math.cos(perp) * 2.5, cy - Math.sin(perp) * 2.5);
      g.closePath(); g.fillPath();
    });
    g.fillStyle(0x1f8c2c, 1);
    g.fillRect(11, 14, 2, 9); // stonek
    g.generateTexture('leaf', 24, 24);
    g.destroy();

    // splat — bílá kaňka (tintuje se: moč, pivo, tag, střepy)
    g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 32, 20);
    g.fillCircle(16, 24, 9); g.fillCircle(48, 26, 8);
    g.fillCircle(24, 48, 8); g.fillCircle(44, 44, 9); g.fillCircle(32, 12, 6);
    g.generateTexture('splat', 64, 64);
    g.destroy();
  }

  // Měkký radiální gradient — glow efekty, světla na pozadí
  makeGlow() {
    const size = 128;
    const canvas = this.textures.createCanvas('glow', size, size);
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
};
PS.scenes.push(window.BootScene);
