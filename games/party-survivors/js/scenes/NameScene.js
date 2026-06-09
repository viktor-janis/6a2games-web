// ============================================================
// NameScene — zadání herního jména po STARTu (retro psaní klávesnicí)
// Jméno se pamatuje (ps_name) a předvyplní se — stačí ENTER.
// Rekord se pak ukládá i se jménem (ps_record, viz GameScene.gameOver).
// ============================================================
window.NameScene = class NameScene extends Phaser.Scene {
  constructor() { super('Name'); }

  create() {
    const { width: W, height: H } = this.scale;

    PS.UI.clubBackdrop(this); // tmavá klubová atmosféra (sjednoceno s hrou)

    PS.UI.title(this, W / 2, 150, 'ZADEJ HERNÍ JMÉNO', 32, PS.COLORS.cyan);
    PS.UI.text(this, W / 2, 210, 'POD TÍMHLE JMÉNEM SE ULOŽÍ TVŮJ REKORD', 11, '#ccccdd');

    // zapamatované jméno z minula — stačí potvrdit Enterem
    this.name = '';
    try { this.name = localStorage.getItem(PS.STORAGE.name) || ''; } catch (e) { /* private mode */ }

    // vstupní pole s blikajícím kurzorem
    this.add.rectangle(W / 2, 320, 560, 80, 0x111133, 0.85)
      .setStrokeStyle(2, PS.COLORS.cyan, 0.8);
    this.nameText = PS.UI.text(this, W / 2, 320, '', 22, '#ffffff');
    this.cursorOn = true;
    this.time.addEvent({
      delay: 420, loop: true,
      callback: () => { this.cursorOn = !this.cursorOn; this.refresh(); },
    });
    this.refresh();

    PS.UI.text(this, W / 2, 392, 'MAX 12 ZNAKŮ', 10, '#8888aa');

    const go = PS.UI.button(this, W / 2, 478, 460, 64, 'POKRAČOVAT');
    go.setSelected(true);
    go.onClick = () => this.confirm();

    const hint = PS.isTouch
      ? 'ŤUKNI DO POLE A NAPIŠ JMÉNO   ·   POKRAČOVAT'
      : 'PIŠ NA KLÁVESNICI   ·   ENTER: POKRAČOVAT   ·   ESC: ZPĚT';
    PS.UI.text(this, W / 2, H - 36, hint, 10, '#8888aa');

    this.input.keyboard.on('keydown', (e) => this.onKey(e));
    if (PS.isTouch) this.createMobileInput();
  }

  // Mobil: skryté HTML <input> nad polem jména → vyvolá softwarovou klávesnici;
  // hodnota se zrcadlí do retro textu na canvasu. (Na PC se nepoužije.)
  createMobileInput() {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 12;
    inp.value = this.name;
    inp.autocomplete = 'off';
    inp.autocapitalize = 'characters';
    inp.spellcheck = false;
    inp.setAttribute('autocorrect', 'off');
    inp.setAttribute('enterkeyhint', 'go');
    inp.setAttribute('aria-label', 'Herní jméno');
    Object.assign(inp.style, {
      position: 'fixed', left: '50%', top: '44%', transform: 'translate(-50%, -50%)',
      width: '50%', maxWidth: '560px', height: '80px',
      border: 'none', background: 'transparent', color: 'transparent',
      caretColor: 'transparent', textAlign: 'center', fontSize: '16px',
      outline: 'none', zIndex: '40',
    });
    document.body.appendChild(inp);
    this._inp = inp;

    const sync = () => {
      const v = inp.value.toUpperCase().replace(/[^0-9A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .\-_]/g, '').slice(0, 12);
      if (v !== inp.value) inp.value = v;
      this.name = v;
      this.refresh();
    };
    inp.addEventListener('input', sync);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.confirm(); } });

    // ťuknutí kamkoli do scény zaměří pole → otevře softwarovou klávesnici
    this.input.on('pointerdown', () => inp.focus());
    setTimeout(() => { try { inp.focus(); } catch (e) { /* noop */ } }, 50);

    this.events.once('shutdown', () => { inp.remove(); this._inp = null; });
  }

  onKey(e) {
    if (PS.isTouch) return; // na dotyku píše HTML <input>, ne Phaser
    if (e.key === 'Enter') { if (!e.repeat) this.confirm(); return; }
    if (e.key === 'Escape') { this.scene.start('Menu'); return; }
    if (e.key === 'Backspace') {
      this.name = this.name.slice(0, -1);
      this.refresh();
      return;
    }
    // jeden tisknutelný znak: písmena (vč. diakritiky), číslice, mezera, . - _
    if (e.key.length === 1 && this.name.length < 12
        && /^[0-9a-záčďéěíňóřšťúůýž .\-_]$/i.test(e.key)) {
      this.name += e.key.toUpperCase();
      PS.Audio.ui();
      this.refresh();
    }
  }

  refresh() {
    this.nameText.setText(this.name + (this.cursorOn ? '_' : ' '));
  }

  confirm() {
    const name = this.name.trim();
    if (!name) { PS.UI.toast(this, 'ZADEJ ASPOŇ JEDEN ZNAK!'); return; }
    try { localStorage.setItem(PS.STORAGE.name, name); } catch (e) { /* private mode */ }
    PS.Audio.select();
    this.scene.start('HeroSelect');
  }
};
PS.scenes.push(window.NameScene);
