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
  // Realistické stylizované postavy do temného klubu: štíhlejší lidské proporce
  // (menší hlava vůči tělu), tělo z měkkých přechodů a záhybů, klubový dvoutónový
  // rim-light (cyan zleva / magenta zprava). Každý hrdina má VLASTNÍ siluetu,
  // postavu i pózu — viz tabulka LOOK + větve uvnitř drawHero.
  makeHeroTextures() {
    PS.HEROES.forEach((hero) => {
      this.canvasTex('hero-' + hero.id, 64, 64, (ctx) => this.drawHero(ctx, hero));
    });
  }

  // tělová „klobása" (capsule) mezi dvěma body — paže/končetiny pod úhlem
  capsule(ctx, x0, y0, x1, y1, r) {
    const a = Math.atan2(y1 - y0, x1 - x0), h = Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x0, y0, r, a + h, a - h);
    ctx.arc(x1, y1, r, a - h, a + h);
    ctx.closePath();
  }

  drawHero(ctx, hero) {
    // pleť / vlasy / výška / šířka ramen (build) / poloměr hlavy / poznávací rys
    const LOOK = {
      rashid:     { tall: 1.25, skin: 0xe7b083, hair: 0x2a1c0e, build: 21, headR: 6.6, feat: 'mustache' },
      poskok:     { tall: 1.40, skin: 0xf0c79c, hair: 0x3c2a16, build: 15, headR: 6.0, feat: 'tall' },
      dong:       { tall: 1.00, skin: 0x6e4a2c, hair: 0x140d10, build: 22, headR: 6.6, feat: 'afro' },
      kaar:       { tall: 1.03, skin: 0xddA374, hair: 0x4a3320, build: 20, headR: 6.6, feat: 'drool' },
      fjodor:     { tall: 1.05, skin: 0xd7b187, hair: 0x1d140a, build: 21, headR: 6.6, feat: 'shades' },
      extreme:    { tall: 1.02, skin: 0xe5b187, hair: 0x12101a, build: 23, headR: 6.6, feat: 'jacket' },
      fadadevada: { tall: 1.00, skin: 0xd9c0a2, hair: 0x6b7079, build: 19, headR: 6.6, feat: 'cap' },
      zlozik:     { tall: 1.00, skin: 0xe4a778, hair: 0x2a1408, build: 20, headR: 6.6, feat: 'beer' },
      sajmic:     { tall: 1.00, skin: 0x9c6c41, hair: 0x140f0a, build: 20, headR: 6.6, feat: 'backpack' },
    };
    const L = LOOK[hero.id] || { tall: 1, skin: 0xe7b083, hair: 0x222222, build: 20, headR: 6.6, feat: '' };

    // ---- geometrie: vyšší = delší trup + nohy, NE větší hlava; postava
    //      vycentrovaná v 64px (kvůli zarovnání s hitboxem hráče) ----
    const tall = L.tall, headR = L.headR, neck = 3;
    const profile = L.feat === 'backpack' ? 3 : 0;       // Sajmič stojí mírně z profilu
    const hx = 32 + profile;
    const headStack = headR * 2 + neck;                  // temeno → ramena
    const torsoLen = 12 * tall, legsLen = 16 * tall;
    const figureH = headStack + torsoLen + legsLen;
    const topY = 31 - figureH / 2;
    const headCY = topY + headR;
    const shoulderY = topY + headStack;
    const hipY = shoulderY + torsoLen;
    const footY = hipY + legsLen;
    const shoulderW = L.build, waistW = shoulderW * 0.74;
    const sLx = hx - shoulderW / 2, sRx = hx + shoulderW / 2;
    const wLx = hx - waistW / 2, wRx = hx + waistW / 2;
    const sy = shoulderY + 1;
    const body = hero.color, skin = L.skin, hair = L.hair;
    const eyeY = headCY + 0.6, noseY = headCY + 3.0, mouthY = headCY + 5.0;
    const armR = Math.max(2.3, shoulderW * 0.12);
    const isJacket = L.feat === 'jacket';
    const sleeveTop = isJacket ? 0x20202e : this.dark(body, 10);
    const sleeveBot = isJacket ? 0x0e0e16 : this.dark(body, 26);

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    this.groundShadow(ctx, 32, footY + 1, 14, 4);

    // batoh za zády (Sajmič) — vykoukne za levým ramenem
    if (L.feat === 'backpack') this.heroBackpack(ctx, sLx, shoulderY, hipY);

    // nohy (tmavé kalhoty) + boty
    this.heroLegs(ctx, hx, hipY, footY, waistW);

    // zadní (levá) paže — visí svisle podél boku
    this.heroArm(ctx, sLx + 1.5, sy + 3, sLx + 1, hipY + 7, armR, sleeveTop, sleeveBot, skin);

    // ----- tělo / triko (zúžené v pase, zaoblená ramena) -----
    const torsoPath = () => {
      ctx.beginPath();
      ctx.moveTo(sLx + 1.5, sy);
      ctx.quadraticCurveTo(sLx - 0.5, sy + 0.5, sLx, sy + 3.5);
      ctx.lineTo(wLx, hipY - 1.5);
      ctx.quadraticCurveTo(wLx, hipY + 1, wLx + 2.5, hipY + 1);
      ctx.lineTo(wRx - 2.5, hipY + 1);
      ctx.quadraticCurveTo(wRx, hipY + 1, wRx, hipY - 1.5);
      ctx.lineTo(sRx, sy + 3.5);
      ctx.quadraticCurveTo(sRx + 0.5, sy + 0.5, sRx - 1.5, sy);
      ctx.closePath();
    };
    if (isJacket) {
      // eXtreme — sportovní bunda ve 3 svislých panelech (černá / modrá / červená) + zip
      ctx.save(); torsoPath(); ctx.clip();
      const cols = [0x141019, 0x1d4ed8, 0xcc2222], tw = sRx - sLx;
      cols.forEach((col, i) => {
        ctx.fillStyle = this.vGrad(ctx, sy, hipY + 1, this.light(col, 12), this.dark(col, 6));
        ctx.fillRect(sLx + (tw / 3) * i - 0.5, sy - 2, tw / 3 + 1, hipY - sy + 6);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sLx + 2, sy + 2, tw - 4, 3);          // lesk
      ctx.fillStyle = 'rgba(225,228,240,0.55)'; ctx.fillRect(hx - 0.7, sy, 1.4, hipY - sy);        // zip
      ctx.restore();
      ctx.strokeStyle = this.cssOf(0x05050b); ctx.lineWidth = 2;                                   // stojáček
      ctx.beginPath(); ctx.moveTo(hx - 4, sy + 1); ctx.lineTo(hx, sy + 4); ctx.lineTo(hx + 4, sy + 1); ctx.stroke();
    } else {
      torsoPath();
      ctx.fillStyle = this.vGrad(ctx, sy, hipY + 1, this.light(body, 14), this.dark(body, 20)); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';                                                    // klubový lesk na hrudi
      this.rr(ctx, sLx + 3, sy + 2, shoulderW - 6, 4, 2); ctx.fill();
      ctx.fillStyle = this.cssOf(this.dark(body, 30), 0.35);                                        // spodní stín
      this.rr(ctx, wLx + 1, hipY - 6, waistW - 2, 6, 2); ctx.fill();
      ctx.strokeStyle = this.cssOf(this.dark(body, 26), 0.5); ctx.lineWidth = 1;                    // záhyby látky
      ctx.beginPath();
      ctx.moveTo(hx - 3, sy + 5); ctx.lineTo(hx - 4.5, hipY - 3);
      ctx.moveTo(hx + 3, sy + 5); ctx.lineTo(hx + 4.5, hipY - 3);
      ctx.moveTo(hx, sy + 6); ctx.lineTo(hx, hipY - 2); ctx.stroke();
      ctx.fillStyle = this.cssOf(this.dark(skin, 8));                                               // výstřih (náznak krku)
      ctx.beginPath(); ctx.moveTo(hx - 3, sy); ctx.lineTo(hx, sy + 3.5); ctx.lineTo(hx + 3, sy); ctx.closePath(); ctx.fill();
    }
    this.litEdge(ctx, torsoPath, 64);

    // přední (pravá) paže — visí svisle podél boku; Zložík v ní drží lahváč
    this.heroArm(ctx, sRx - 1.5, sy + 3, sRx - 1, hipY + 7, armR, sleeveTop, sleeveBot, skin);
    if (L.feat === 'beer') this.heroBeer(ctx, sRx - 1, hipY + 7, skin);

    // ----- krk -----
    ctx.fillStyle = this.cssOf(this.dark(skin, 16));
    this.rr(ctx, hx - 2.4, headCY + headR - 2, 4.8, neck + 3, 1.6); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 30), 0.5);                                           // stín pod bradou
    ctx.fillRect(hx - 2.4, headCY + headR - 2, 4.8, 1.6);

    // ----- hlava (objem radiálním přechodem + stín čelisti + uši) -----
    const headPath = () => { ctx.beginPath(); ctx.arc(hx, headCY, headR, 0, 7); ctx.closePath(); };
    headPath();
    const hg = ctx.createRadialGradient(hx - headR * 0.4, headCY - headR * 0.45, 1, hx, headCY, headR + 2);
    hg.addColorStop(0, this.cssOf(this.light(skin, 16)));
    hg.addColorStop(1, this.cssOf(this.dark(skin, 16)));
    ctx.fillStyle = hg; ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 22), 0.32);
    ctx.beginPath(); ctx.ellipse(hx, headCY + headR * 0.55, headR * 0.66, headR * 0.4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 10));
    ctx.beginPath(); ctx.arc(hx - headR + 0.4, headCY + 0.6, 1.3, 0, 7); ctx.arc(hx + headR - 0.4, headCY + 0.6, 1.3, 0, 7); ctx.fill();

    // ----- vlasy / čepice -----
    if (L.feat === 'afro') {
      ctx.fillStyle = this.cssOf(this.dark(hair, 2));
      [[-7, -4, 7], [0, -8, 8], [7, -4, 7], [-9, 1, 6], [9, 1, 6], [0, -3, 8.5]].forEach(([dx, dy, r2]) => {
        ctx.beginPath(); ctx.arc(hx + dx, headCY + dy, r2, 0, 7); ctx.fill();
      });
      ctx.fillStyle = this.cssOf(this.light(hair, 16), 0.45);
      [[-4, -7, 2.4], [3, -6, 2], [-7, -1, 1.8], [6, -1, 1.8]].forEach(([dx, dy, r2]) => {
        ctx.beginPath(); ctx.arc(hx + dx, headCY + dy, r2, 0, 7); ctx.fill();
      });
    } else if (L.feat === 'cap') {
      this.heroCap(ctx, hx, headCY, headR, hair);                                                   // fadadevada — kšiltovka
    } else {
      this.hairCap(ctx, hx, headCY, headR, hair, -headR * 0.22);
      if (L.feat === 'tall') {                                                                      // Poskok — vysoká vyčesaná ofina
        ctx.fillStyle = this.cssOf(hair);
        ctx.beginPath();
        ctx.moveTo(hx - headR + 1, headCY - headR + 1);
        ctx.quadraticCurveTo(hx - headR - 1, headCY - headR - 4, hx + 1, headCY - headR - 3);
        ctx.quadraticCurveTo(hx + headR + 2, headCY - headR - 2, hx + headR - 1, headCY - headR + 1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = this.cssOf(this.light(hair, 16), 0.5);
        ctx.beginPath(); ctx.moveTo(hx - 1, headCY - headR); ctx.lineTo(hx - 2.4, headCY - headR - 2.5); ctx.lineTo(hx + 0.6, headCY - headR - 2.5); ctx.closePath(); ctx.fill();
      }
      if (hero.id === 'kaar') {                                                                     // krátké rozcuchané chmýří
        ctx.strokeStyle = this.cssOf(this.light(hair, 4)); ctx.lineWidth = 1.5;
        [[-3.5, -1.4], [-1, -1.8], [1.5, -1.6], [3.8, -1.2]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(hx + dx, headCY - headR + 1.5); ctx.lineTo(hx + dx + dy * 0.5, headCY - headR - 1.3); ctx.stroke(); });
      }
      if (hero.id === 'fjodor') {                                                                   // sčesané dozadu (lesk pramenů)
        ctx.strokeStyle = this.cssOf(this.light(hair, 22), 0.5); ctx.lineWidth = 0.8;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 2.2, headCY - headR + 1.5); ctx.lineTo(hx + i * 2.2 + 1, headCY - 1); ctx.stroke(); }
      }
    }

    // ----- obličej -----
    if (L.feat === 'shades') {
      this.heroShades(ctx, hx, eyeY);
    } else {
      this.heroEyes(ctx, hx, eyeY, L.feat === 'drool');                                             // Kaar má přivřené oči
      ctx.strokeStyle = this.cssOf(this.dark(hair, 2)); ctx.lineWidth = 1.3;                        // obočí
      ctx.beginPath();
      ctx.moveTo(hx - 4.6, eyeY - 2.6); ctx.lineTo(hx - 1.6, eyeY - 3.1);
      ctx.moveTo(hx + 1.6, eyeY - 3.1); ctx.lineTo(hx + 4.6, eyeY - 2.6); ctx.stroke();
    }
    // nos (stín + nozdry)
    ctx.strokeStyle = this.cssOf(this.dark(skin, 20), 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx - 0.2, eyeY + 0.6); ctx.lineTo(hx - 0.8, noseY + 0.4); ctx.stroke();
    ctx.fillStyle = this.cssOf(this.dark(skin, 28), 0.5);
    ctx.beginPath(); ctx.arc(hx - 1, noseY + 0.8, 0.6, 0, 7); ctx.arc(hx + 1, noseY + 0.8, 0.6, 0, 7); ctx.fill();
    // pusa / knír
    if (L.feat === 'mustache') {
      this.heroMustache(ctx, hx, mouthY, hair, skin);                                               // Rashid — handlebar knír
    } else {
      ctx.strokeStyle = this.cssOf(this.dark(skin, 34)); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx - 2.4, mouthY); ctx.quadraticCurveTo(hx, mouthY + 1.5, hx + 2.4, mouthY); ctx.stroke();
    }
    if (L.feat === 'drool') this.heroDrool(ctx, hx, mouthY);                                        // Kaar — slina z koutku
    if (L.feat === 'cap') this.heroVape(ctx, hx, mouthY);                                           // fadadevada — vape + dým

    // rim-light hlavy navrch (klubový obrys)
    this.litEdge(ctx, headPath, 64);
  }

  // ============ dílčí helpery pro hrdiny ============
  heroLegs(ctx, hx, hipY, footY, hipW) {
    const legW = Math.max(4.4, hipW * 0.32), gap = 1.2;
    [hx - gap - legW, hx + gap].forEach((lx) => {
      this.rr(ctx, lx, hipY - 1, legW, footY - hipY + 1, 3);
      ctx.fillStyle = this.vGrad(ctx, hipY, footY, 0x2c2c4a, 0x14142c); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(lx + 1, hipY, legW - 2, 2);             // záhyb nohavice
      ctx.fillStyle = this.cssOf(0x0b0b16); this.rr(ctx, lx - 1, footY - 2.5, legW + 2, 4.5, 2); ctx.fill(); // bota
    });
  }

  heroArm(ctx, sx, sy, hxp, hy, r, sleeveTop, sleeveBot, skin) {
    // rukáv končí těsně nad zápěstím → ruka je užší (ne „lízátko")
    const wy = hy - r * 0.7;
    this.capsule(ctx, sx, sy, hxp, wy, r);
    ctx.fillStyle = this.vGrad(ctx, sy, hy, this.light(sleeveTop, 4), sleeveBot); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 4));                                                  // dlaň
    ctx.beginPath(); ctx.arc(hxp, hy, r * 0.72, 0, 7); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(skin, 16), 0.5);                                            // stín zápěstí
    ctx.beginPath(); ctx.arc(hxp, wy, r * 0.6, 0, 7); ctx.fill();
  }

  hairCap(ctx, hx, cy, r, hair, foreheadY) {
    ctx.fillStyle = this.cssOf(hair);
    ctx.beginPath();
    ctx.arc(hx, cy, r + 0.3, Math.PI, 0, false);
    ctx.lineTo(hx + r + 0.3, cy + foreheadY + 1);
    ctx.quadraticCurveTo(hx, cy + foreheadY - 1.6, hx - r - 0.3, cy + foreheadY + 1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.cssOf(this.light(hair, 16), 0.55);                                          // odlesk vlasů
    ctx.beginPath(); ctx.ellipse(hx - r * 0.35, cy - r * 0.6, r * 0.4, r * 0.2, -0.5, 0, 7); ctx.fill();
  }

  // KŠILTOVKA (baseball cap): kulatá koruna + výrazný kšilt dopředu přes čelo,
  // širší než hlava → na první pohled jasně čepice s kšiltem, ne beanie/vlasy.
  heroCap(ctx, hx, cy, r, hair) {
    ctx.fillStyle = this.cssOf(hair);                                                                // prošedivělé vlasy u uší
    ctx.fillRect(hx - r, cy - 0.5, 2, r * 0.9); ctx.fillRect(hx + r - 2, cy - 0.5, 2, r * 0.9);

    const cap = 0x2a3552;                  // tmavě modrá kšiltovka (kontrast vůči pleti i triku)
    const by = cy - r * 0.42;              // čelní hrana koruny / kořen kšiltu

    // ----- KŠILT (bill) — výrazný klenutý kšilt dopředu přes čelo, širší než hlava -----
    ctx.fillStyle = this.vGrad(ctx, by - 1.6, by + 4, this.light(cap, 14), this.dark(cap, 10));
    ctx.beginPath();
    ctx.moveTo(hx - r * 1.6, by + 0.6);
    ctx.quadraticCurveTo(hx, by - 1.8, hx + r * 1.6, by + 0.6);                                       // horní (klenutá) hrana
    ctx.quadraticCurveTo(hx + r * 0.7, by + 4.4, hx, by + 4.2);                                       // špička kšiltu dopředu
    ctx.quadraticCurveTo(hx - r * 0.7, by + 4.4, hx - r * 1.6, by + 0.6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;                                    // lesklá přední hrana
    ctx.beginPath(); ctx.moveTo(hx - r * 1.48, by + 0.4); ctx.quadraticCurveTo(hx, by - 1.5, hx + r * 1.48, by + 0.4); ctx.stroke();
    ctx.strokeStyle = this.cssOf(this.dark(cap, 28)); ctx.lineWidth = 1.4;                            // tmavá spodní hrana (oddělí od tváře)
    ctx.beginPath(); ctx.moveTo(hx - r * 1.4, by + 1.3); ctx.quadraticCurveTo(hx, by + 4.6, hx + r * 1.4, by + 1.3); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';                                                               // stín kšiltu vržený na čelo
    ctx.beginPath(); ctx.ellipse(hx, by + 3.0, r * 0.9, 1.2, 0, 0, Math.PI); ctx.fill();

    // ----- KORUNA (crown) — dóm nad hlavou, mírně nabobtnalý -----
    ctx.fillStyle = this.vGrad(ctx, cy - r - 5, by, this.light(cap, 14), this.dark(cap, 4));
    ctx.beginPath();
    ctx.moveTo(hx - r - 0.4, by + 0.6);
    ctx.bezierCurveTo(hx - r - 1.6, cy - r - 1.5, hx - r * 0.5, cy - r - 5, hx, cy - r - 5);
    ctx.bezierCurveTo(hx + r * 0.5, cy - r - 5, hx + r + 1.6, cy - r - 1.5, hx + r + 0.4, by + 0.6);
    ctx.closePath(); ctx.fill();

    // švy panelů (6-panel cap)
    ctx.strokeStyle = this.cssOf(this.dark(cap, 16), 0.7); ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx, cy - r - 5); ctx.lineTo(hx, by);
    ctx.moveTo(hx - r * 0.6, cy - r - 2.4); ctx.lineTo(hx - r * 0.45, by);
    ctx.moveTo(hx + r * 0.6, cy - r - 2.4); ctx.lineTo(hx + r * 0.45, by);
    ctx.stroke();

    ctx.fillStyle = this.cssOf(this.light(cap, 18));                                                  // knoflík na temeni
    ctx.beginPath(); ctx.arc(hx, cy - r - 4.6, 1.4, 0, 7); ctx.fill();
    ctx.fillStyle = this.cssOf(0x39c6ff);                                                             // logo (svítivý akcent jako vape dioda)
    ctx.beginPath(); ctx.arc(hx, by - r * 0.5, 1.7, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';                                                         // klubový lesk koruny
    ctx.beginPath(); ctx.ellipse(hx - r * 0.35, cy - r * 0.75, r * 0.42, r * 0.22, -0.5, 0, 7); ctx.fill();
  }

  heroEyes(ctx, hx, eyeY, sleepy) {
    if (sleepy) {                                                                                    // přivřená opilá víčka
      ctx.strokeStyle = this.cssOf(0x140f0a); ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - 5, eyeY); ctx.quadraticCurveTo(hx - 3.4, eyeY + 1.3, hx - 1.8, eyeY);
      ctx.moveTo(hx + 1.8, eyeY); ctx.quadraticCurveTo(hx + 3.4, eyeY + 1.3, hx + 5, eyeY); ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(236,236,242,0.92)';                                                        // bělmo
    ctx.beginPath(); ctx.ellipse(hx - 3.3, eyeY, 2, 1.6, 0, 0, 7); ctx.ellipse(hx + 3.3, eyeY, 2, 1.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = this.cssOf(0x171019);                                                            // zornice
    ctx.beginPath(); ctx.arc(hx - 3, eyeY + 0.2, 1.15, 0, 7); ctx.arc(hx + 3.6, eyeY + 0.2, 1.15, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';                                                         // odlesk
    ctx.beginPath(); ctx.arc(hx - 3.4, eyeY - 0.4, 0.5, 0, 7); ctx.arc(hx + 3.2, eyeY - 0.4, 0.5, 0, 7); ctx.fill();
  }

  heroShades(ctx, hx, eyeY) {
    ctx.fillStyle = this.cssOf(0x05050b); this.rr(ctx, hx - 6.2, eyeY - 2.6, 12.4, 5.2, 2); ctx.fill();
    const g = ctx.createLinearGradient(hx - 6, eyeY, hx + 6, eyeY);
    g.addColorStop(0, '#10131f'); g.addColorStop(0.5, '#263042'); g.addColorStop(1, '#0d1018');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx - 3.2, eyeY, 2.6, 2.1, 0, 0, 7); ctx.ellipse(hx + 3.2, eyeY, 2.6, 2.1, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = this.cssOf(0x05050b); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx - 0.6, eyeY - 1); ctx.lineTo(hx + 0.6, eyeY - 1); ctx.stroke(); // můstek
    ctx.strokeStyle = 'rgba(150,230,255,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - 4.6, eyeY - 1.2); ctx.lineTo(hx - 2.6, eyeY + 0.6); ctx.stroke(); // cyan odlesk
    ctx.strokeStyle = 'rgba(255,140,225,0.7)'; ctx.beginPath(); ctx.moveTo(hx + 2.2, eyeY - 1.2); ctx.lineTo(hx + 4.2, eyeY + 0.6); ctx.stroke(); // magenta odlesk
  }

  heroMustache(ctx, hx, mouthY, hair, skin) {
    ctx.strokeStyle = this.cssOf(this.dark(skin, 34)); ctx.lineWidth = 1;                             // pusa pod knírem
    ctx.beginPath(); ctx.moveTo(hx - 2, mouthY + 2.4); ctx.lineTo(hx + 2, mouthY + 2.4); ctx.stroke();
    ctx.fillStyle = this.cssOf(hair);
    ctx.beginPath(); ctx.ellipse(hx, mouthY, 4.6, 1.9, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = this.cssOf(hair);                                          // zatočené konce nahoru
    ctx.beginPath();
    ctx.moveTo(hx - 4.2, mouthY); ctx.quadraticCurveTo(hx - 6.6, mouthY - 0.4, hx - 6, mouthY - 2.6);
    ctx.moveTo(hx + 4.2, mouthY); ctx.quadraticCurveTo(hx + 6.6, mouthY - 0.4, hx + 6, mouthY - 2.6); ctx.stroke();
    ctx.fillStyle = this.cssOf(this.light(hair, 14), 0.5); ctx.fillRect(hx - 2, mouthY - 1, 4, 0.8);
  }

  heroDrool(ctx, hx, mouthY) {
    ctx.strokeStyle = 'rgba(180,228,255,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx + 2.2, mouthY + 0.8); ctx.lineTo(hx + 2.6, mouthY + 5.5); ctx.stroke();
    ctx.fillStyle = 'rgba(180,228,255,0.9)'; ctx.beginPath(); ctx.arc(hx + 2.6, mouthY + 6, 1.3, 0, 7); ctx.fill();
  }

  heroVape(ctx, hx, mouthY) {
    ctx.fillStyle = this.cssOf(0x20242f); this.rr(ctx, hx + 4, mouthY - 1, 8.5, 2.4, 1); ctx.fill();   // pero
    ctx.fillStyle = this.cssOf(0x39c6ff); ctx.fillRect(hx + 12, mouthY - 0.6, 1.3, 1.6);               // svítící dioda
    ctx.fillStyle = 'rgba(205,214,224,0.42)';                                                          // obláček dýmu
    [[hx + 15, mouthY - 3, 3], [hx + 18, mouthY - 6, 3.8], [hx + 15.5, mouthY - 9, 3.2], [hx + 20, mouthY - 9.5, 2.6]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    });
  }

  heroBeer(ctx, hxp, hyp, skin) {
    const bx = hxp - 2.5, by = hyp - 16;                                                              // láhev nad rukou
    this.rr(ctx, bx, by + 5, 6, 12, 2);
    ctx.fillStyle = this.vGrad(ctx, by + 5, by + 17, 0x7a531f, 0x3c2810); ctx.fill();
    ctx.fillStyle = this.cssOf(0xffe08a); ctx.fillRect(bx + 1, by + 9, 4, 4);                          // etiketa
    ctx.fillStyle = this.cssOf(0x2f200c); ctx.fillRect(bx + 2, by, 2, 6);                              // hrdlo
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(bx + 3, by, 1.6, 0, 7); ctx.fill(); // pěna
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 1, by + 7); ctx.lineTo(bx + 1, by + 15); ctx.stroke(); // odlesk skla
    ctx.fillStyle = this.cssOf(this.dark(skin, 4)); this.rr(ctx, bx - 1, by + 11, 8, 4, 2); ctx.fill(); // ruka přes láhev
  }

  heroBackpack(ctx, sLx, shoulderY, hipY) {
    const bx = sLx - 11, by = shoulderY + 3, bw = 13, bh = hipY - shoulderY + 8;
    const path = () => this.rr(ctx, bx, by, bw, bh, 4);
    path(); ctx.fillStyle = this.vGrad(ctx, by, by + bh, this.light(0x2f7d3a, 6), this.dark(0x2f7d3a, 16)); ctx.fill();
    ctx.fillStyle = this.cssOf(this.dark(0x2f7d3a, 24)); this.rr(ctx, bx + 2.5, by + bh * 0.42, bw - 5, bh * 0.4, 3); ctx.fill(); // kapsa
    ctx.fillStyle = this.cssOf(0x14140e); ctx.fillRect(bx + bw / 2 - 3, by + bh * 0.4, 6, 2);          // přezka
    this.litEdge(ctx, path, 64);
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
