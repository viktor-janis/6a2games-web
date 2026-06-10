// ============================================================
// BootScene — procedurální generování textur (žádné externí soubory)
// Styl: temná klubová atmosféra, čistě stylizované + NASVÍCENÉ postavy
// (canvas přechody, měkké stíny, tmavý obrys + dvoutónový rim-light).
// Vše se generuje JEDNOU při bootu → za běhu nulová zátěž.
// ============================================================
window.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makePixel();
    this.makeGlow();
    this.makeSmoke();
    this.makeVignette();
    this.makeDrop();
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

  // ============ canvas helpery ============
  canvasTex(key, w, h, draw) {
    const ct = this.textures.createCanvas(key, w, h);
    if (!ct) return;
    draw(ct.getContext(), w, h);
    ct.refresh();
  }
  cssOf(intColor, a = 1) {
    const c = Phaser.Display.Color.IntegerToColor(intColor);
    return `rgba(${c.red},${c.green},${c.blue},${a})`;
  }
  light(intColor, amt) { return Phaser.Display.Color.IntegerToColor(intColor).lighten(amt).color; }
  dark(intColor, amt) { return Phaser.Display.Color.IntegerToColor(intColor).darken(amt).color; }

  // cesta zaobleného obdélníku (bez fill/stroke)
  rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // svislý přechod (objem): světlo nahoře → tma dole
  vGrad(ctx, y0, y1, topInt, botInt) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, this.cssOf(topInt));
    g.addColorStop(1, this.cssOf(botInt));
    return g;
  }
  groundShadow(ctx, cx, cy, rx, ry) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // tmavý obrys + dvoutónový klubový rim-light (vlevo cyan, vpravo magenta)
  litEdge(ctx, pathFn, w) {
    pathFn(); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(6,2,16,0.85)'; ctx.stroke();
    pathFn();
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(150,220,255,0.55)');
    g.addColorStop(0.5, 'rgba(150,220,255,0)');
    g.addColorStop(1, 'rgba(255,120,220,0.42)');
    ctx.lineWidth = 1.3; ctx.strokeStyle = g; ctx.stroke();
  }

  // 4×4 bílý čtvereček — konfety, particles (tintuje se za běhu)
  makePixel() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('px', 4, 4);
    g.destroy();
  }

  // ============ HRDINOVÉ — 'hero-<id>' 64×64 ============
  // Každý unikátní obličej/rysy + odlišná výška a tón pleti (ne jen barva).
  makeHeroTextures() {
    const LOOK = {
      rashid:     { tall: 1.10, skin: 0xe7b083, hair: 0x2a1c0e, feat: 'mustache' },
      poskok:     { tall: 1.22, skin: 0xf0c79c, hair: 0x3c2a16, feat: 'tall' },
      dong:       { tall: 1.00, skin: 0x6e4a2c, hair: 0x140d10, feat: 'afro' },
      kaar:       { tall: 1.03, skin: 0xddA374, hair: 0x4a3320, feat: 'drool' },
      fjodor:     { tall: 1.05, skin: 0xd7b187, hair: 0x1d140a, feat: 'shades' },
      extreme:    { tall: 1.02, skin: 0xe5b187, hair: 0x12101a, feat: 'jacket' },
      fadadevada: { tall: 1.00, skin: 0xd9c0a2, hair: 0x6b7079, feat: 'vape' },
      zlozik:     { tall: 1.00, skin: 0xe4a778, hair: 0x2a1408, feat: 'beer' },
      sajmic:     { tall: 1.00, skin: 0x9c6c41, hair: 0x140f0a, feat: 'backpack' },
    };
    PS.HEROES.forEach((hero) => {
      const look = LOOK[hero.id] || { tall: 1, skin: 0xe7b083, hair: 0x222222, feat: '' };
      this.canvasTex('hero-' + hero.id, 64, 64, (ctx) => this.drawHero(ctx, hero, look));
    });
  }

  drawHero(ctx, hero, look) {
    const B = 56, headR = 9, t = look.tall;
    const hx = look.feat === 'backpack' ? 35 : 32;       // sajmič mírně z profilu
    const hcy = 17 - (t - 1) * 34;                        // vyšší hrdina → hlava výš
    const body = hero.color, skin = look.skin;
    const bodyTop = hcy + headR - 3, bodyBot = 46;
    const bodyX = hx - 12, bodyW = 24;
    ctx.lineJoin = 'round';

    this.groundShadow(ctx, 32, B + 2, 16, 4.5);

    // batoh (Sajmič) — vykoukne za levým ramenem (náznak profilu)
    if (look.feat === 'backpack') {
      const bx = bodyX - 12;
      ctx.fillStyle = this.cssOf(this.dark(0x2f7d2f, 0));
      this.litEdge(ctx, () => this.rr(ctx, bx, bodyTop + 1, 15, 27, 5), 64);
      this.rr(ctx, bx, bodyTop + 1, 15, 27, 5);
      ctx.fillStyle = this.vGrad(ctx, bodyTop, bodyBot + 6, this.light(0x3a9e4a, 6), this.dark(0x3a9e4a, 14)); ctx.fill();
      ctx.fillStyle = this.cssOf(this.dark(0x3a9e4a, 26)); this.rr(ctx, bx + 3, bodyTop + 8, 9, 10, 3); ctx.fill();
    }

    // nohy (tmavé kalhoty) + boty
    const legY = bodyBot - 2, legH = B - legY;
    [hx - 9, hx + 1].forEach((lx) => {
      this.rr(ctx, lx, legY, 8, legH, 3);
      ctx.fillStyle = this.vGrad(ctx, legY, B, 0x2b2b46, 0x16162c); ctx.fill();
      ctx.fillStyle = this.cssOf(0x0c0c18); this.rr(ctx, lx - 1, B - 2, 10, 4, 2); ctx.fill();
    });

    // ruce (rukávy = tmavší odstín trika) — za tělem
    const sleeve = this.dark(body, 16);
    [[bodyX - 4, 'L'], [bodyX + bodyW - 2, 'R']].forEach(([ax]) => {
      this.rr(ctx, ax, bodyTop + 3, 6, bodyBot - bodyTop - 4, 3);
      ctx.fillStyle = this.vGrad(ctx, bodyTop, bodyBot, this.light(sleeve, 6), this.dark(sleeve, 8)); ctx.fill();
    });

    // tělo / triko (eXtreme = bunda ve 3 panelech)
    const bodyPath = () => this.rr(ctx, bodyX, bodyTop, bodyW, bodyBot - bodyTop, 6);
    if (look.feat === 'jacket') {
      ctx.save(); bodyPath(); ctx.clip();
      const cols = [0x141019, 0x1d4ed8, 0xcc2222];
      cols.forEach((col, i) => {
        ctx.fillStyle = this.vGrad(ctx, bodyTop, bodyBot, this.light(col, 10), this.dark(col, 8));
        ctx.fillRect(bodyX + (bodyW / 3) * i, bodyTop, bodyW / 3 + 1, bodyBot - bodyTop);
      });
      // zip + límec
      ctx.fillStyle = 'rgba(230,230,240,0.5)'; ctx.fillRect(hx - 0.7, bodyTop, 1.4, bodyBot - bodyTop);
      ctx.restore();
    } else {
      bodyPath();
      ctx.fillStyle = this.vGrad(ctx, bodyTop, bodyBot, this.light(body, 16), this.dark(body, 16)); ctx.fill();
      // jemný horní lesk
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; this.rr(ctx, bodyX + 3, bodyTop + 2, bodyW - 6, 6, 3); ctx.fill();
    }
    this.litEdge(ctx, bodyPath, 64);

    // pivko v ruce (Zložík) — láhev u pravé ruky
    if (look.feat === 'beer') {
      const bxx = bodyX + bodyW + 1, byy = bodyBot - 12;
      ctx.fillStyle = this.cssOf(skin); ctx.beginPath(); ctx.arc(bxx + 1, byy + 12, 3.5, 0, 7); ctx.fill(); // ruka
      this.rr(ctx, bxx, byy, 6, 13, 2);
      ctx.fillStyle = this.vGrad(ctx, byy, byy + 13, 0x6b4a1e, 0x3c2810); ctx.fill();
      ctx.fillStyle = this.cssOf(0xffe08a); ctx.fillRect(bxx + 1, byy + 5, 4, 4); // etiketa
      ctx.fillStyle = this.cssOf(0x3c2810); ctx.fillRect(bxx + 2, byy - 2, 2, 3); // hrdlo
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(bxx + 3, byy - 2, 2, 0, 7); ctx.fill(); // pěna
    }

    // hlava
    const headPath = () => { ctx.beginPath(); ctx.arc(hx, hcy, headR, 0, Math.PI * 2); ctx.closePath(); };
    headPath();
    const hg = ctx.createRadialGradient(hx - 3, hcy - 3, 1, hx, hcy, headR + 2);
    hg.addColorStop(0, this.cssOf(this.light(skin, 14)));
    hg.addColorStop(1, this.cssOf(this.dark(skin, 14)));
    ctx.fillStyle = hg; ctx.fill();
    // krk
    ctx.fillStyle = this.cssOf(this.dark(skin, 18)); ctx.fillRect(hx - 3, hcy + headR - 3, 6, 5);

    // vlasy (afro = velký objem; jinak čepice vlasů) — Fjodor brýle nemění vlasy
    if (look.feat === 'afro') {
      ctx.fillStyle = this.cssOf(look.hair);
      [[-7, -5, 7], [0, -8, 8], [7, -5, 7], [-9, 0, 6], [9, 0, 6]].forEach(([dx, dy, rr]) => {
        ctx.beginPath(); ctx.arc(hx + dx, hcy + dy, rr, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(hx - 4, hcy - 7, 3, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = this.cssOf(look.hair);
      ctx.beginPath(); ctx.arc(hx, hcy - 1, headR, Math.PI, 0, false);
      ctx.lineTo(hx + headR, hcy - 2); ctx.lineTo(hx - headR, hcy - 2); ctx.closePath(); ctx.fill();
      if (look.feat === 'tall') { // Poskok — vyšší účes (víc nahoru)
        ctx.fillRect(hx - headR + 1, hcy - headR - 2, headR * 2 - 2, 4);
      }
    }

    // obličej — oči, obočí, pusa (+ rysy)
    const eyeY = hcy + 1;
    if (look.feat === 'shades') {
      // sluneční brýle — tmavý pásek se dvěma skly + lesk
      ctx.fillStyle = this.cssOf(0x0b0b14); this.rr(ctx, hx - 7, eyeY - 3, 14, 6, 2); ctx.fill();
      ctx.fillStyle = this.cssOf(0x161628); ctx.beginPath(); ctx.arc(hx - 3.5, eyeY, 2.6, 0, 7); ctx.arc(hx + 3.5, eyeY, 2.6, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(160,230,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - 5, eyeY - 1.5); ctx.lineTo(hx - 3, eyeY + 0.5); ctx.stroke();
    } else {
      ctx.fillStyle = this.cssOf(0x10101e);
      ctx.beginPath(); ctx.arc(hx - 3.4, eyeY, 1.7, 0, 7); ctx.arc(hx + 3.4, eyeY, 1.7, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(hx - 4, eyeY - 0.6, 0.6, 0, 7); ctx.arc(hx + 2.8, eyeY - 0.6, 0.6, 0, 7); ctx.fill();
      // obočí
      ctx.strokeStyle = this.cssOf(look.hair); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx - 5, eyeY - 3); ctx.lineTo(hx - 2, eyeY - 3.5);
      ctx.moveTo(hx + 2, eyeY - 3.5); ctx.lineTo(hx + 5, eyeY - 3); ctx.stroke();
    }

    // pusa + rysy
    const mouthY = hcy + 5;
    if (look.feat === 'mustache') { // Rashid — výrazný knír (handlebar) + pusa
      ctx.fillStyle = this.cssOf(look.hair);
      ctx.beginPath(); ctx.ellipse(hx, mouthY - 1, 7, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - 7, mouthY - 1); ctx.lineTo(hx - 6.5, mouthY + 3); ctx.lineTo(hx - 3, mouthY); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx + 7, mouthY - 1); ctx.lineTo(hx + 6.5, mouthY + 3); ctx.lineTo(hx + 3, mouthY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = this.cssOf(this.dark(skin, 38)); ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - 2.5, mouthY + 4); ctx.lineTo(hx + 2.5, mouthY + 4); ctx.stroke();
    } else {
      ctx.strokeStyle = this.cssOf(this.dark(skin, 35)); ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - 2.5, mouthY); ctx.quadraticCurveTo(hx, mouthY + 1.6, hx + 2.5, mouthY); ctx.stroke();
    }
    if (look.feat === 'drool') { // Kaar — slina z koutku
      ctx.strokeStyle = 'rgba(170,225,255,0.85)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + 2.5, mouthY + 0.5); ctx.lineTo(hx + 3, mouthY + 6); ctx.stroke();
      ctx.fillStyle = 'rgba(170,225,255,0.9)'; ctx.beginPath(); ctx.arc(hx + 3, mouthY + 6.5, 1.4, 0, 7); ctx.fill();
    }
    if (look.feat === 'vape') { // fadadevada — vapovací pero + obláček dýmu
      ctx.fillStyle = this.cssOf(0x222633); this.rr(ctx, hx + 5, mouthY - 1, 9, 2.4, 1); ctx.fill();
      ctx.fillStyle = this.cssOf(0x39c6ff); ctx.fillRect(hx + 13, mouthY - 0.6, 1.4, 1.6);
      ctx.fillStyle = 'rgba(200,210,220,0.5)';
      [[hx + 16, mouthY - 3, 3], [hx + 19, mouthY - 6, 4], [hx + 16, mouthY - 9, 3.5]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      });
    }

    // rim-light hlavy navrch
    this.litEdge(ctx, headPath, 64);
  }

  // ============ NEPŘÁTELÉ — 'enemy-<id>' 48×48 ============
  makeEnemyTextures() {
    PS.ENEMIES.forEach((enemy) => {
      this.canvasTex('enemy-' + enemy.id, 48, 48, (ctx) => this.drawEnemy(ctx, enemy));
    });
  }

  drawEnemy(ctx, enemy) {
    const c = enemy.color, B = 43;
    ctx.lineJoin = 'round';
    this.groundShadow(ctx, 24, B + 1, 13, 3.5);

    const bodyFill = (x, y, w, h) => {
      this.rr(ctx, x, y, w, h, 4);
      ctx.fillStyle = this.vGrad(ctx, y, y + h, this.light(c, 14), this.dark(c, 16)); ctx.fill();
      const p = () => this.rr(ctx, x, y, w, h, 4);
      this.litEdge(ctx, p, 48);
    };
    const head = (cx, cy, r, skin) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, r + 1);
      g.addColorStop(0, this.cssOf(this.light(skin, 12))); g.addColorStop(1, this.cssOf(this.dark(skin, 14)));
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = this.cssOf(0x141022);
      ctx.beginPath(); ctx.arc(cx - 2.4, cy, 1.5, 0, 7); ctx.arc(cx + 2.4, cy, 1.5, 0, 7); ctx.fill();
    };

    if (enemy.id === 'rodice') {
      // pár — dvě menší postavy
      [[14, c, 0xe7b083], [33, 0xd98fb0, 0xeec3a0]].forEach(([cx, col, sk]) => {
        ctx.fillStyle = this.cssOf(this.dark(col, 0));
        this.rr(ctx, cx - 7, 23, 14, 15, 3);
        ctx.fillStyle = this.vGrad(ctx, 23, 38, this.light(col, 12), this.dark(col, 16)); ctx.fill();
        head(cx, 15, 6, sk);
        ctx.fillStyle = this.cssOf(this.dark(0x6a4a2c, 0));
        ctx.beginPath(); ctx.arc(cx, 13, 6, Math.PI, 0, false); ctx.fill();
      });
    } else if (enemy.id === 'pikari') {
      // ohnutá ošklivá postava — předkloněná, hlava nízko vpravo
      bodyFill(13, 21, 24, 17);
      head(35, 19, 7, 0xd9c49c);
      ctx.fillStyle = this.cssOf(this.dark(c, 12)); ctx.fillRect(30, 10, 12, 4); // mastné vlasy
    } else if (enemy.id === 'gufrau') {
      // hipster — kulich + brýle + vous
      bodyFill(12, 21, 24, 18);
      head(24, 13, 8, 0xeec3a0);
      ctx.fillStyle = this.cssOf(this.dark(c, 18)); this.rr(ctx, 15, 2, 18, 8, 3); ctx.fill(); // kulich
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(16, 4, 16, 2);
      ctx.strokeStyle = this.cssOf(0x141022); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(21, 13, 2.2, 0, 7); ctx.arc(28, 13, 2.2, 0, 7); ctx.moveTo(23, 13); ctx.lineTo(26, 13); ctx.stroke();
      ctx.fillStyle = this.cssOf(0x3a2a18); ctx.fillRect(21, 18, 7, 3); // vous
    } else if (enemy.id === 'kravataci') {
      // oblek — sako, košile, kravata
      bodyFill(12, 20, 24, 19);
      ctx.fillStyle = this.cssOf(0xf2f2f7); ctx.beginPath();
      ctx.moveTo(24, 20); ctx.lineTo(28, 24); ctx.lineTo(24, 34); ctx.lineTo(20, 24); ctx.closePath(); ctx.fill(); // košile V
      ctx.fillStyle = this.cssOf(0xcc2233); ctx.beginPath();
      ctx.moveTo(24, 22); ctx.lineTo(26, 25); ctx.lineTo(24, 33); ctx.lineTo(22, 25); ctx.closePath(); ctx.fill(); // kravata
      head(24, 12, 7, 0xeec3a0);
      ctx.fillStyle = this.cssOf(0x2a1d10); ctx.beginPath(); ctx.arc(24, 10, 7, Math.PI, 0, false); ctx.fill();
    } else {
      // policisté — modrá uniforma + čepice se štítkem
      bodyFill(12, 20, 24, 19);
      head(24, 13, 7, 0xeec3a0);
      ctx.fillStyle = this.cssOf(0x16307a); this.rr(ctx, 15, 3, 18, 6, 2); ctx.fill();
      ctx.fillRect(14, 8, 20, 2);
      ctx.fillStyle = this.cssOf(0xffe600); ctx.beginPath(); ctx.arc(24, 5.5, 2, 0, 7); ctx.fill();
      ctx.fillStyle = this.cssOf(0x141022); ctx.beginPath(); ctx.arc(21.5, 14, 1.5, 0, 7); ctx.arc(26.5, 14, 1.5, 0, 7); ctx.fill();
    }
  }

  // ============ BOSSOVÉ — 'boss-<id>' 64×64 (větší, temnější) ============
  makeBossTextures() {
    PS.BOSSES.forEach((boss) => {
      this.canvasTex('boss-' + boss.id, 64, 64, (ctx) => this.drawBoss(ctx, boss));
    });
    // zub — projektil Kata (lesklý)
    this.canvasTex('tooth', 12, 9, (ctx) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 4.5); ctx.lineTo(0, 9); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 12, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfcfc0'); ctx.fillStyle = g; ctx.fill();
    });
  }

  // Každý boss má UNIKÁTNÍ siluetu i charakter (ne sdílená šablona):
  // Kato=bezdomovec · Rohony=rapper s tetováním · Churaq=namakaný plešoun s
  // pálkou · Haades=vyžilý feťák · Schýza=beztvará černá hrouda.
  drawBoss(ctx, boss) {
    ctx.lineJoin = 'round';
    this.groundShadow(ctx, 32, 60, 21, 5);
    const id = boss.id;
    const headFill = (cx, cy, r, skin) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r + 1);
      g.addColorStop(0, this.cssOf(this.light(skin, 14))); g.addColorStop(1, this.cssOf(this.dark(skin, 16)));
      ctx.fillStyle = g; ctx.fill();
    };
    const circEdge = (cx, cy, r) => this.litEdge(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); }, 64);

    // ---------- Schýza — beztvará černá hrouda ----------
    if (id === 'schyza') {
      const blob = () => {
        ctx.beginPath();
        [[32, 38, 21], [17, 30, 12], [47, 31, 13], [22, 52, 11], [43, 50, 12], [33, 18, 13], [50, 44, 8], [14, 44, 8]]
          .forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7); });
        ctx.moveTo(20, 57); ctx.lineTo(23, 63); ctx.lineTo(26, 56);   // odkapávající cíp
        ctx.moveTo(38, 56); ctx.lineTo(41, 63); ctx.lineTo(44, 55);
        ctx.closePath();
      };
      blob();
      const g = ctx.createRadialGradient(28, 30, 3, 32, 38, 33);
      g.addColorStop(0, '#23203a'); g.addColorStop(0.6, '#10101f'); g.addColorStop(1, '#050509');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(150,110,255,0.4)'; ctx.lineWidth = 1.5; blob(); ctx.stroke();
      // tři svítící oči, asymetricky → nelidské
      [[25, 34, 3.5], [40, 33, 4], [33, 45, 2.4]].forEach(([x, y, r]) => {
        const e = ctx.createRadialGradient(x, y, 0, x, y, r + 2.5);
        e.addColorStop(0, '#eafaff'); e.addColorStop(0.5, '#9fe0ff'); e.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = e; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = '#0a0014'; ctx.beginPath(); ctx.arc(x + 0.4, y + 0.4, r * 0.3, 0, 7); ctx.fill();
      });
      return;
    }

    // ---------- Churaq Sputnik — namakaný plešoun s baseballkou ----------
    if (id === 'churaq') {
      const skin = 0xe0a878;
      [[19], [37]].forEach(([lx]) => { this.rr(ctx, lx, 50, 11, 14, 3); ctx.fillStyle = this.vGrad(ctx, 50, 63, 0x2a2030, 0x140c18); ctx.fill(); });
      // obří bicepsy
      [[8], [56]].forEach(([cx], i) => {
        ctx.beginPath(); ctx.ellipse(cx, 39, 6.5, 12, i ? -0.18 : 0.18, 0, 7);
        const g = ctx.createRadialGradient(cx, 35, 1, cx, 39, 13);
        g.addColorStop(0, this.cssOf(this.light(skin, 12))); g.addColorStop(1, this.cssOf(this.dark(skin, 18)));
        ctx.fillStyle = g; ctx.fill();
      });
      // ŠIROKÁ ramena (lichoběžník) + bílé tílko
      const bp = () => { ctx.beginPath(); ctx.moveTo(10, 31); ctx.lineTo(54, 31); ctx.lineTo(48, 55); ctx.lineTo(16, 55); ctx.closePath(); };
      bp(); ctx.fillStyle = this.vGrad(ctx, 31, 55, 0xf2f2f5, 0xc6c6d2); ctx.fill();
      ctx.fillStyle = this.cssOf(this.dark(skin, 4)); // výstřih → odhalená hruď
      ctx.beginPath(); ctx.moveTo(27, 31); ctx.lineTo(37, 31); ctx.lineTo(34, 43); ctx.lineTo(30, 43); ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.cssOf(skin); // svaly nad tílkem (ramena)
      ctx.beginPath(); ctx.ellipse(15, 32, 6, 4, 0, 0, 7); ctx.ellipse(49, 32, 6, 4, 0, 0, 7); ctx.fill();
      this.litEdge(ctx, bp, 64);
      // tlustý krk + plešatá hlava
      ctx.fillStyle = this.cssOf(this.dark(skin, 8)); ctx.fillRect(27, 21, 10, 8);
      headFill(32, 14, 11, skin);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(28, 9, 4, 2.2, -0.5, 0, 7); ctx.fill(); // lesk lebky
      ctx.strokeStyle = this.cssOf(0x3a2a1a); ctx.lineWidth = 1.6; // naštvané obočí
      ctx.beginPath(); ctx.moveTo(26, 11); ctx.lineTo(31, 13); ctx.moveTo(38, 11); ctx.lineTo(33, 13); ctx.stroke();
      ctx.fillStyle = this.cssOf(0x141022); ctx.beginPath(); ctx.arc(28, 14, 1.7, 0, 7); ctx.arc(36, 14, 1.7, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(60,40,30,0.4)'; ctx.fillRect(27, 18, 10, 3); // strniště
      circEdge(32, 14, 11);
      // velká baseballka přes rameno
      ctx.save(); ctx.translate(52, 25); ctx.rotate(-0.6);
      const bg = ctx.createLinearGradient(-4, 0, 5, 0); bg.addColorStop(0, '#b58040'); bg.addColorStop(1, '#7a4f22');
      ctx.fillStyle = bg; this.rr(ctx, -4, -30, 9, 34, 4); ctx.fill();
      ctx.fillStyle = '#5a3a18'; this.rr(ctx, -3, -1, 7, 7, 2); ctx.fill();
      ctx.restore();
      return;
    }

    // ---------- Haades — vyžilý/feťácký vyzáblý chlap ----------
    if (id === 'haades') {
      const c = boss.color, skin = 0xb7b09c; // nezdravě bledá
      [[24], [34]].forEach(([lx]) => { this.rr(ctx, lx, 50, 6, 13, 2); ctx.fillStyle = this.vGrad(ctx, 50, 63, 0x222236, 0x12121f); ctx.fill(); });
      [[16], [44]].forEach(([ax]) => { this.rr(ctx, ax, 30, 5, 22, 2.5); ctx.fillStyle = this.vGrad(ctx, 30, 52, this.light(skin, 4), this.dark(skin, 20)); ctx.fill(); }); // kostnaté ruce
      const bp = () => this.rr(ctx, 19, 28, 26, 28, 6); // úzké tělo, špinavé hadry
      bp(); ctx.fillStyle = this.vGrad(ctx, 28, 56, this.light(c, 10), this.dark(c, 16)); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1; // propadlý hrudník
      ctx.beginPath(); ctx.moveTo(24, 38); ctx.lineTo(40, 38); ctx.moveTo(25, 43); ctx.lineTo(39, 43); ctx.stroke();
      this.litEdge(ctx, bp, 64);
      ctx.fillStyle = this.cssOf(this.dark(skin, 18)); ctx.fillRect(29, 20, 6, 8); // hubený krk
      const hp = () => { ctx.beginPath(); ctx.ellipse(32, 13, 9.5, 11, 0, 0, 7); };
      hp(); const hg = ctx.createRadialGradient(29, 9, 1, 32, 13, 13);
      hg.addColorStop(0, this.cssOf(this.light(skin, 8))); hg.addColorStop(1, this.cssOf(this.dark(skin, 22)));
      ctx.fillStyle = hg; ctx.fill();
      ctx.fillStyle = 'rgba(40,30,45,0.35)'; // propadlé tváře
      ctx.beginPath(); ctx.ellipse(26, 16, 2.4, 4, 0, 0, 7); ctx.ellipse(38, 16, 2.4, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = this.cssOf(0x2a2630); // mastné stringy vlasy
      ctx.beginPath(); ctx.arc(32, 9, 10, Math.PI, 0, false); ctx.fill();
      ctx.fillRect(22, 8, 3.5, 12); ctx.fillRect(40, 8, 3.5, 11);
      // vpadlé svítící oči (tmavé důlky + zářící zorničky)
      ctx.fillStyle = 'rgba(8,6,12,0.85)';
      ctx.beginPath(); ctx.ellipse(28, 13, 3.2, 3.6, 0, 0, 7); ctx.ellipse(37, 13, 3.2, 3.6, 0, 0, 7); ctx.fill();
      [[28, 13], [37, 13]].forEach(([x, y]) => {
        const e = ctx.createRadialGradient(x, y, 0, x, y, 3); e.addColorStop(0, '#d8b0ff'); e.addColorStop(1, 'rgba(150,80,255,0)');
        ctx.fillStyle = e; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#ab44ff'; ctx.beginPath(); ctx.arc(x, y, 1.3, 0, 7); ctx.fill();
      });
      ctx.fillStyle = 'rgba(20,10,20,0.6)'; ctx.beginPath(); ctx.ellipse(32, 20, 2.4, 1.5, 0, 0, 7); ctx.fill(); // pootevřená ústa
      this.litEdge(ctx, hp, 64);
      return;
    }

    // ---------- Kato — bezdomovec (otrhaný kabát, vous, čepice, flaška) ----------
    if (id === 'kato') {
      const c = boss.color, skin = 0xceA476;
      [[22], [34]].forEach(([lx]) => { this.rr(ctx, lx, 50, 9, 13, 2); ctx.fillStyle = this.vGrad(ctx, 50, 63, 0x4a4032, 0x2a241c); ctx.fill(); });
      [[10], [47]].forEach(([ax]) => { this.rr(ctx, ax, 31, 7, 20, 3); ctx.fillStyle = this.vGrad(ctx, 31, 51, this.light(c, 4), this.dark(c, 20)); ctx.fill(); });
      // dlouhý otrhaný kabát s roztřepeným dolním okrajem
      const bp = () => {
        ctx.beginPath(); ctx.moveTo(13, 26); ctx.lineTo(51, 26); ctx.lineTo(53, 52);
        ctx.lineTo(49, 57); ctx.lineTo(46, 52); ctx.lineTo(42, 58); ctx.lineTo(38, 52);
        ctx.lineTo(34, 57); ctx.lineTo(30, 52); ctx.lineTo(26, 58); ctx.lineTo(22, 52);
        ctx.lineTo(18, 57); ctx.lineTo(11, 52); ctx.closePath();
      };
      bp(); ctx.fillStyle = this.vGrad(ctx, 26, 56, this.light(c, 8), this.dark(c, 20)); ctx.fill();
      ctx.fillStyle = this.cssOf(0x5a6a3a); this.rr(ctx, 18, 34, 9, 8, 1); ctx.fill(); // záplaty
      ctx.fillStyle = this.cssOf(0x6a4a3a); this.rr(ctx, 35, 40, 8, 7, 1); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(32, 28); ctx.lineTo(32, 50); ctx.stroke();
      this.litEdge(ctx, bp, 64);
      headFill(32, 15, 11, skin);
      ctx.fillStyle = this.cssOf(0x3a5a4a); this.rr(ctx, 21, 3, 22, 8, 3); ctx.fill(); // pletená čepice
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(22, 5, 20, 1.5);
      ctx.strokeStyle = this.cssOf(0x6a6258); ctx.lineWidth = 1.4; // chomáče vlasů
      [[20, 12], [20, 16], [44, 12], [44, 16]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x < 32 ? -3 : 3), y + 3); ctx.stroke(); });
      ctx.fillStyle = this.cssOf(0x9a9488); // velký rozcuchaný šedý vous
      ctx.beginPath(); ctx.moveTo(23, 17); ctx.quadraticCurveTo(24, 28, 32, 29); ctx.quadraticCurveTo(40, 28, 41, 17);
      ctx.quadraticCurveTo(38, 23, 32, 23); ctx.quadraticCurveTo(26, 23, 23, 17); ctx.fill();
      ctx.fillStyle = this.cssOf(0x141022); ctx.beginPath(); ctx.arc(28, 14, 1.6, 0, 7); ctx.arc(36, 14, 1.6, 0, 7); ctx.fill();
      circEdge(32, 15, 11);
      ctx.fillStyle = this.cssOf(0x6a5a3a); this.rr(ctx, 46, 40, 8, 12, 2); ctx.fill(); // flaška v pytlíku
      ctx.fillStyle = this.cssOf(0x3a6a4a); this.rr(ctx, 48, 36, 4, 6, 1); ctx.fill();
      return;
    }

    // ---------- Rohony — rapper s face tattoo (mikina, zlatý řetěz, kšiltovka) ----------
    const c = boss.color, skin = 0xc89070;
    [[22], [34]].forEach(([lx]) => { this.rr(ctx, lx, 50, 9, 13, 3); ctx.fillStyle = this.vGrad(ctx, 50, 63, 0x1a1a30, 0x0c0c18); ctx.fill(); });
    [[11], [45]].forEach(([ax]) => { this.rr(ctx, ax, 30, 8, 22, 4); ctx.fillStyle = this.vGrad(ctx, 30, 52, this.light(this.dark(c, 10), 4), this.dark(c, 24)); ctx.fill(); });
    const bp = () => this.rr(ctx, 14, 27, 36, 29, 7); // mikina s kapucí
    bp(); ctx.fillStyle = this.vGrad(ctx, 27, 56, this.light(c, 12), this.dark(c, 18)); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(c, 8)); this.rr(ctx, 22, 44, 20, 8, 3); ctx.fill(); // kapsa
    ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(28, 30); ctx.lineTo(27, 40); ctx.moveTo(36, 30); ctx.lineTo(37, 40); ctx.stroke(); // šňůrky
    this.litEdge(ctx, bp, 64);
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; // zlatý řetěz (bling)
    ctx.beginPath(); ctx.arc(32, 34, 9, 0.16 * Math.PI, 0.84 * Math.PI, false); ctx.stroke();
    ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(32, 43, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8901a'; ctx.beginPath(); ctx.arc(32, 43, 1.4, 0, 7); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 12)); ctx.fillRect(28, 21, 8, 7); // krk
    headFill(32, 14, 11, skin);
    ctx.fillStyle = this.cssOf(0x1a1a28); this.rr(ctx, 21, 2, 22, 8, 3); ctx.fill(); // snapback koruna
    ctx.fillStyle = this.cssOf(0x101018); this.rr(ctx, 30, 8, 20, 3, 1.5); ctx.fill(); // rovný kšilt do strany
    ctx.fillStyle = this.cssOf(c); ctx.fillRect(24, 4, 4, 4); // logo
    // face tattoos
    ctx.strokeStyle = this.cssOf(0x6a2a9a); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(27, 17); ctx.lineTo(27, 20); ctx.stroke(); // slza
    ctx.fillStyle = this.cssOf(0x6a2a9a); ctx.fillRect(36, 17, 1.4, 3);
    ctx.strokeStyle = this.cssOf(0x9a3ad0); ctx.beginPath(); ctx.arc(40, 15, 1.6, 0, 7); ctx.stroke(); // symbol na tváři
    ctx.fillStyle = this.cssOf(0x141022); ctx.beginPath(); ctx.arc(28, 15, 1.7, 0, 7); ctx.arc(36, 15, 1.7, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd24a'; this.rr(ctx, 29, 18, 6, 2.2, 0.6); ctx.fill(); // zlatý úsměv (grills)
    circEdge(32, 14, 11);
  }

  // ============ PODLAHA — temný klubový parket (tile 128) ============
  makeFloor() {
    this.canvasTex('floor', 128, 128, (ctx, s) => {
      ctx.fillStyle = '#070310'; ctx.fillRect(0, 0, s, s);
      // jemná mřížka dlaždic
      ctx.strokeStyle = 'rgba(120,90,200,0.10)'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
      ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, s); ctx.moveTo(0, 64); ctx.lineTo(s, 64); ctx.stroke();
      // dvě svítící dlaždice (rozsvícený parket) — měkké barevné fleky
      [[32, 32, '#ff2bd6'], [96, 96, '#00ffff']].forEach(([x, y, col]) => {
        const g = ctx.createRadialGradient(x, y, 2, x, y, 30);
        g.addColorStop(0, col + ''); ctx.globalAlpha = 0.10; ctx.fillStyle = g;
        ctx.fillRect(x - 30, y - 30, 60, 60); ctx.globalAlpha = 1;
      });
      // pár třpytek
      [[18, 70, '#ffe600'], [110, 22, '#39ff14'], [76, 50, '#b44cff']].forEach(([x, y, col]) => {
        ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.fillRect(x, y, 2, 2); ctx.globalAlpha = 1;
      });
    });
  }

  // XP gem — zářivý krystal s přechodem a leskem
  makeGem() {
    this.canvasTex('gem', 16, 16, (ctx) => {
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(16, 8); ctx.lineTo(8, 16); ctx.lineTo(0, 8); ctx.closePath();
      const g = ctx.createLinearGradient(2, 2, 14, 14);
      g.addColorStop(0, '#9bffd2'); g.addColorStop(0.5, '#00ff88'); g.addColorStop(1, '#00b865');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(190,255,225,0.9)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(8, 3); ctx.lineTo(11, 6); ctx.lineTo(8, 8); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
    });
  }

  // Klíček — lesklý (tintuje se barvou efektu)
  makeKey() {
    this.canvasTex('key', 30, 18, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(9, 9, 8, 0, 7); ctx.fill();
      ctx.fillRect(15, 7, 13, 4); ctx.fillRect(22, 11, 3, 5); ctx.fillRect(26, 11, 3, 4);
      ctx.fillStyle = 'rgba(40,40,70,0.85)'; ctx.beginPath(); ctx.arc(9, 9, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(6, 6, 2, 0, 7); ctx.fill(); // lesk
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(9, 9, 8, 0, 7); ctx.stroke();
    });
  }

  // Runda panclů — čtyři panáky na tácku
  makeRunda() {
    this.canvasTex('runda', 56, 32, (ctx) => {
      ctx.fillStyle = '#7a5e30'; this.rr(ctx, 0, 23, 56, 7, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(2, 24, 52, 1.5);
      [3, 16, 29, 42].forEach((x, i) => {
        ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 11, 4); ctx.lineTo(x + 8.5, 24); ctx.lineTo(x + 2.5, 24); ctx.closePath();
        ctx.fillStyle = 'rgba(225,238,255,0.35)'; ctx.fill();
        const g = ctx.createLinearGradient(x, 9, x, 24); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#e0902a');
        ctx.fillStyle = g; ctx.fillRect(x + 3, 9 + (i % 2) * 2, 6, 14 - (i % 2) * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 1, 5); ctx.lineTo(x + 3.5, 23); ctx.stroke();
      });
    });
  }

  // Směrová šipka k Rundě (tintuje se zlatou)
  makeArrow() {
    this.canvasTex('arrow', 26, 20, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(25, 10); ctx.lineTo(0, 19); ctx.lineTo(8, 10); ctx.closePath(); ctx.fill();
    });
  }

  // ============ projektily + zóny + efektové textury ============
  makeProjectiles() {
    // vajgl — nedopalek se žhavým koncem
    this.canvasTex('proj-vajgl', 18, 9, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 9); g.addColorStop(0, '#cdd98a'); g.addColorStop(1, '#9aa84a');
      ctx.fillStyle = g; this.rr(ctx, 0, 1.5, 13, 6, 3); ctx.fill();
      ctx.fillStyle = '#e8e0c0'; ctx.fillRect(0, 1.5, 4, 6); // filtr
      const e = ctx.createRadialGradient(15, 4.5, 0, 15, 4.5, 4);
      e.addColorStop(0, '#fff3b0'); e.addColorStop(0.5, '#ff7a00'); e.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = e; ctx.fillRect(11, 0, 7, 9);
    });

    // lahváč — pivní láhev s leskem
    this.canvasTex('proj-lahvac', 20, 11, (ctx) => {
      const g = ctx.createLinearGradient(0, 1, 0, 10); g.addColorStop(0, '#9c6a30'); g.addColorStop(1, '#4f3416');
      ctx.fillStyle = g; this.rr(ctx, 0, 1.5, 14, 8, 3); ctx.fill();
      ctx.fillStyle = '#3c2810'; this.rr(ctx, 13, 3.5, 6, 4, 1.5); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(3, 3, 6, 5); // etiketa
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(2, 2, 1.4, 7); // lesk
    });

    // dým — kouřová šipka (světlá střela s vlečkou kouře a žhavým jádrem)
    this.canvasTex('proj-sipka', 22, 10, (ctx) => {
      const t = ctx.createLinearGradient(0, 0, 22, 0);
      t.addColorStop(0, 'rgba(170,195,210,0)'); t.addColorStop(1, 'rgba(205,220,230,0.75)');
      ctx.fillStyle = t; this.rr(ctx, 0, 3, 16, 4, 2); ctx.fill(); // vlečka
      ctx.fillStyle = '#eaf0f4'; // hrot šipky
      ctx.beginPath(); ctx.moveTo(22, 5); ctx.lineTo(13, 0.5); ctx.lineTo(15.5, 5); ctx.lineTo(13, 9.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(15, 5, 1.8, 0, 7); ctx.fill(); // jádro
    });

    // panák — štamprle s chlastem
    this.canvasTex('panak', 12, 12, (ctx) => {
      ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(11, 0); ctx.lineTo(8.5, 11); ctx.lineTo(3.5, 11); ctx.closePath();
      ctx.fillStyle = 'rgba(225,238,255,0.45)'; ctx.fill();
      const g = ctx.createLinearGradient(0, 4, 0, 11); g.addColorStop(0, '#ffe9a0'); g.addColorStop(1, '#e0a020');
      ctx.fillStyle = g; ctx.fillRect(3.5, 5, 5, 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(4, 10); ctx.stroke();
    });

    // marihuanový list — 7 cípů (jasně rozpoznatelný), s žilkami
    this.canvasTex('leaf', 48, 48, (ctx) => this.drawLeaf(ctx));

    // splat — měkká kaňka (kaluže/tagy/střepy; tintuje se)
    this.canvasTex('splat', 64, 64, (ctx) => {
      const blob = () => {
        ctx.beginPath();
        [[32, 34, 20], [16, 26, 10], [48, 28, 9], [24, 50, 9], [44, 46, 10], [34, 14, 7], [50, 44, 7]]
          .forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7); });
        ctx.closePath();
      };
      const g = ctx.createRadialGradient(30, 30, 4, 32, 34, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
      ctx.fillStyle = g; blob(); ctx.fill();
    });
  }

  drawLeaf(ctx) {
    const cx = 24, by = 44; // základna stonku
    ctx.fillStyle = '#1f8c2c';
    ctx.strokeStyle = '#125a1d'; ctx.lineWidth = 1; ctx.lineJoin = 'round';
    // 7 lístků (úhel od svislice, délka)
    const leaflets = [[0, 22], [28, 19], [-28, 19], [55, 14], [-55, 14], [82, 9], [-82, 9]];
    leaflets.forEach(([deg, len]) => {
      const a = Phaser.Math.DegToRad(deg - 90); // -90 = nahoru
      const tipX = cx + Math.cos(a) * len, tipY = by + Math.sin(a) * len;
      const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
      const midX = cx + Math.cos(a) * len * 0.42, midY = by + Math.sin(a) * len * 0.42;
      const wdt = len * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx, by);
      ctx.quadraticCurveTo(midX + px * wdt, midY + py * wdt, tipX, tipY);
      ctx.quadraticCurveTo(midX - px * wdt, midY - py * wdt, cx, by);
      const g = ctx.createLinearGradient(cx, by, tipX, tipY);
      g.addColorStop(0, '#155f20'); g.addColorStop(0.5, '#2ecc40'); g.addColorStop(1, '#7be26a');
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      // žilka
      ctx.strokeStyle = 'rgba(190,255,170,0.7)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#125a1d'; ctx.lineWidth = 1;
    });
    // stonek
    ctx.strokeStyle = '#1f8c2c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, 47); ctx.stroke();
  }

  // ============ efektové textury (glow, kouř, vinětace, kapka) ============
  makeGlow() {
    this.canvasTex('glow', 128, 128, (ctx, s) => {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    });
  }

  // kouř — měkký chuchvalcovitý oblak (dým, particles)
  makeSmoke() {
    this.canvasTex('smoke', 64, 64, (ctx) => {
      [[32, 34, 20], [20, 26, 13], [44, 24, 13], [24, 46, 12], [42, 44, 13], [32, 20, 12]]
        .forEach(([x, y, r]) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, 'rgba(220,225,235,0.55)'); g.addColorStop(1, 'rgba(220,225,235,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        });
    });
  }

  // vinětace — ztmavení okrajů obrazovky (klubová atmosféra)
  makeVignette() {
    this.canvasTex('vignette', 256, 256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.72);
      g.addColorStop(0, 'rgba(3,0,8,0)'); g.addColorStop(1, 'rgba(3,0,8,0.92)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    });
  }

  // kapka — tekuté particles (blití/chcaní/pivo), tintuje se
  makeDrop() {
    this.canvasTex('drop', 10, 12, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.quadraticCurveTo(10, 7, 5, 12); ctx.quadraticCurveTo(0, 7, 5, 0); ctx.fill();
    });
  }
};
PS.scenes.push(window.BootScene);
