// ============================================================
// HelpScene — vysvětlivky (pravidla hry)
// ============================================================
window.HelpScene = class HelpScene extends Phaser.Scene {
  constructor() { super('Help'); }

  create() {
    const { width: W, height: H } = this.scale;
    const keys = PS.Keys.load();

    PS.UI.glowBlob(this, W * 0.15, H * 0.2, PS.COLORS.yellow, 7, 0.07);
    PS.UI.glowBlob(this, W * 0.85, H * 0.75, PS.COLORS.green, 8, 0.07);
    PS.UI.confetti(this, 350);

    PS.UI.title(this, W / 2, 70, 'VYSVĚTLIVKY', 36, PS.COLORS.yellow);

    const sections = [
      ['CÍL HRY', PS.COLORS.pink,
        'Přežij co nejdéle. Tvé skóre je čas přežití.'],
      ['POHYB', PS.COLORS.cyan,
        `Pohybuj se klávesami ${PS.Keys.label(keys.up)} / ${PS.Keys.label(keys.left)} / ${PS.Keys.label(keys.down)} / ${PS.Keys.label(keys.right)} (změna v nastavení).\nŠipky fungují vždy. Pauza: ${PS.Keys.label(keys.pause)}.`],
      ['ÚTOKY', PS.COLORS.green,
        'Tvůj hrdina útočí automaticky. Ty jen manévruješ.'],
      ['XP A LEVELY', PS.COLORS.purple,
        'Z nepřátel padají XP gemy. Sbírej je — při novém levelu\nsi vybereš jedno ze tří vylepšení nebo nový útok.'],
      ['KLÍČKY (POWERUPY)', PS.COLORS.orange,
        'Vzácně leží na mapě. Každá barva = jiný bonus.\nSeber je dřív, než zmizí v davu.'],
      ['BOSSOVÉ', PS.COLORS.red,
        'Čas od času dorazí boss. Bossové jsou silní —\nale dávají velkou odměnu.'],
    ];

    let y = 135;
    sections.forEach(([head, color, body]) => {
      PS.UI.text(this, W / 2, y, head, 14, PS.UI.hex(color));
      const bodyText = this.add.text(W / 2, y + 24, body, {
        fontFamily: PS.UI.FONT, fontSize: '11px', color: '#ccccdd',
        align: 'center', lineSpacing: 8,
      }).setOrigin(0.5, 0);
      y += 34 + bodyText.height + 22;
    });

    // Zpět
    const back = PS.UI.button(this, W / 2, H - 50, 260, 56, 'ZPĚT', { fontSize: 16 });
    back.setSelected(true);
    back.onClick = () => this.scene.start('Menu');
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.scene.start('Menu'); });
  }
};
PS.scenes.push(window.HelpScene);
