// ============================================================
// Party Survivors — generátor přehledu VŠECH textů (wording.xlsx)
// ------------------------------------------------------------
// Účel: vyexportovat veškerý wording, který hráč ve hře potká, do xlsx s
// vícero záložkami (kategorie), aby šel ručně upravit a změny pak vrátit zpět
// do kódu. Herní obsah se čte PŘÍMO z ../js/data.js (vm sandbox) → 1:1, žádné
// překlepy přepisováním. Flavour hlášky/texty obrazovek jsou ručně vypsané
// (s odkazem na zdrojový soubor).
//
// Sloupce každého listu:
//   Klíč | Pole | Zdroj | Viditelné hráči | Aktuální text | Nový text | Poznámka
// „Nový text" je prázdný — sem píšeš úpravy; importovat se budou jen vyplněné.
//
// Spuštění:  node tools/build-wording.js   → zapíše ../wording.xlsx
// Závislosti: žádné (xlsx se skládá ručně přes zlib-free ZIP + OOXML).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- načtení herních dat (data.js) ----------
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(dataPath, 'utf8'), sandbox, { filename: 'data.js' });
const PS = sandbox.PS;

const DATA = 'js/data.js';
const HDR = ['Klíč', 'Pole', 'Zdroj', 'Viditelné hráči', 'Aktuální text', 'Nový text', 'Poznámka'];
const row = (klic, pole, zdroj, vis, text, pozn) => [klic, pole, zdroj, vis, text, '', pozn];

// 4. pád jmen hrdinů (pole „CHCI HRÁT ZA …") — z HeroSelectScene.ACC
const ACC = {
  rashid: 'Rashida', poskok: 'Poskoka', dong: 'Dona G', kaar: 'Kaara',
  fjodor: 'Fjodora Keta', extreme: 'eXtrema', fadadevada: 'fadudevadu',
  zlozik: 'Zložíka', sajmic: 'Sajmiče Uraku',
};

// ============ záložky herního obsahu (z data.js) ============
const sHeroes = [HDR];
PS.HEROES.forEach(h => {
  sHeroes.push(row(`HEROES.${h.id}.name`, 'name', DATA, 'ANO', h.name, 'jméno hrdiny — výběr, statistiky, žebříček'));
  sHeroes.push(row(`HEROES.${h.id}.intro1`, 'intro1', DATA, 'ANO', h.intro1, 'detail hrdiny — 1. řádek (primární útok)'));
  sHeroes.push(row(`HEROES.${h.id}.intro2`, 'intro2', DATA, 'ANO', h.intro2, 'detail hrdiny — 2. řádek (speciální schopnost)'));
  sHeroes.push(row(`HEROES.${h.id}.acc`, 'acc (4. pád)', 'js/scenes/HeroSelectScene.js', 'ANO', ACC[h.id] || '', 'pole „CHCI HRÁT ZA …"'));
});

const sAttacks = [HDR];
Object.keys(PS.ATTACKS).forEach(id => {
  const a = PS.ATTACKS[id];
  sAttacks.push(row(`ATTACKS.${id}.name`, 'name', DATA, 'ANO', a.name, 'název útoku — level-up karta, HUD, statistiky'));
  sAttacks.push(row(`ATTACKS.${id}.desc`, 'desc', DATA, 'ANO', a.desc, 'popis na level-up kartě'));
  sAttacks.push(row(`ATTACKS.${id}.anim`, 'anim', DATA, 'NE', a.anim, 'interní popis animace (nezobrazuje se)'));
});

const sPerks = [HDR];
Object.keys(PS.WEAPON_PERKS).forEach(id => {
  PS.WEAPON_PERKS[id].forEach(p => {
    sPerks.push(row(`PERKS.${id}.${p.id}.name`, 'name', DATA, 'ANO', p.name, `perk útoku „${PS.ATTACKS[id].name}" — level-up karta`));
    sPerks.push(row(`PERKS.${id}.${p.id}.desc`, 'desc', DATA, 'ANO', p.desc, `perk útoku „${PS.ATTACKS[id].name}" — popis`));
  });
});

const sUpgrades = [HDR];
PS.UPGRADES.forEach(u => {
  sUpgrades.push(row(`UPGRADES.${u.id}.name`, 'name', DATA, 'ANO', u.name, 'pasivní upgrade — level-up karta / Runda'));
  sUpgrades.push(row(`UPGRADES.${u.id}.desc`, 'desc', DATA, 'ANO', u.desc, 'pasivní upgrade — popis'));
});

const sPowerups = [HDR];
PS.POWERUPS.forEach(p => {
  sPowerups.push(row(`POWERUPS.${p.id}.name`, 'name', DATA, 'ANO', p.name, 'klíč — hláška při sebrání'));
  sPowerups.push(row(`POWERUPS.${p.id}.colorName`, 'colorName', DATA, 'ANO', p.colorName, 'barva klíče (slovně)'));
  sPowerups.push(row(`POWERUPS.${p.id}.desc`, 'desc', DATA, 'ANO', p.desc, 'popis efektu klíče'));
});

const sEnemies = [HDR];
PS.ENEMIES.forEach(e => {
  sEnemies.push(row(`ENEMIES.${e.id}.name`, 'name', DATA, 'ANO', e.name, 'jméno nepřítele — hláška „PŘICHÁZEJÍ…"'));
  sEnemies.push(row(`ENEMIES.${e.id}.vis`, 'vis', DATA, 'NE', e.vis, 'interní popis vzhledu (nezobrazuje se)'));
});

const sBosses = [HDR];
PS.BOSSES.forEach(b => {
  sBosses.push(row(`BOSSES.${b.id}.name`, 'name', DATA, 'ANO', b.name, 'jméno bosse — hlášky, HP bar'));
  sBosses.push(row(`BOSSES.${b.id}.vis`, 'vis', DATA, 'NE', b.vis, 'interní popis vzhledu (nezobrazuje se)'));
  sBosses.push(row(`BOSSES.${b.id}.attackName`, 'attackName', DATA, 'NE', b.attackName, 'interní název útoku (nezobrazuje se)'));
  sBosses.push(row(`BOSSES.${b.id}.mech`, 'mech', DATA, 'NE', b.mech, 'interní popis mechaniky (nezobrazuje se)'));
});

// ============ záložka: hlášky ve hře ============
const SP = 'js/systems/spawner.js', GS = 'js/scenes/GameScene.js', HU = 'js/scenes/HUDScene.js';
const sAnn = [HDR,
  row('ANN.tier', 'announce', SP, 'ANO', 'PŘICHÁZEJÍ: {TYP}{ LV n}', 'nový tier; {TYP} = jméno nepřítele (list Nepřátelé)'),
  row('ANN.horde', 'announce', SP, 'ANO', 'VALÍ SE DAV!', 'velká horda'),
  row('ANN.bossArrive', 'announce', SP, 'ANO', 'BOSS: {JMÉNO}!', 'příchod bosse; {JMÉNO} = jméno bosse'),
  row('ANN.bossDead', 'announce', GS, 'ANO', '{JMÉNO} PORAŽEN!', 'po zabití bosse'),
  row('ANN.ringClose', 'announce', GS, 'ANO', 'RING SE UZAVÍRÁ!', 'začátek boss fightu'),
  row('ANN.ringBreak', 'announce', GS, 'ANO', 'RING SE ROZPADL!', 'po poražení bosse'),
  row('ANN.runda', 'announce', GS, 'ANO', 'NĚKDO OBJEDNAL RUNDU PANCLŮ!', 'spawn Rundy panclů'),
  row('ANN.powerup', 'announce', GS, 'ANO', '{POWERUP}!', 'sebrání klíče; {POWERUP} = název (list Powerupy)'),
  row('HUD.bossFight', 'label', HU, 'ANO', 'PROBÍHÁ BOSS FIGHT', 'štítek místo časomíry během fightu'),
  row('HUD.pauseTitle', 'label', HU, 'ANO', 'PAUZA', 'titulek pauzy'),
  row('HUD.concede', 'button', HU, 'ANO', 'TUHLE RYCHTU VZDÁVÁM', 'tlačítko v pauze (vzdát hru)'),
  row('HUD.confirmTitle', 'label', HU, 'ANO', 'OPRAVDU VZDÁVÁŠ HRU?', 'potvrzení vzdání'),
  row('HUD.confirmYes', 'button', HU, 'ANO', 'ANO, VZDÁVÁM', 'potvrzení vzdání — ano'),
  row('HUD.confirmNo', 'button', HU, 'ANO', 'NE, ZPĚT DO PAUZY', 'potvrzení vzdání — ne'),
  row('TOAST.soundOn', 'toast', 'více scén', 'ANO', 'ZVUK: ZAPNUTO', 'přepnutí zvuku'),
  row('TOAST.soundOff', 'toast', 'více scén', 'ANO', 'ZVUK: VYPNUTO', 'přepnutí zvuku'),
];

// ============ záložka: texty obrazovek ============
const ME = 'js/scenes/MenuScene.js', HE = 'js/scenes/HelpScene.js', NA = 'js/scenes/NameScene.js';
const HS = 'js/scenes/HeroSelectScene.js', LU = 'js/scenes/LevelUpScene.js', RU = 'js/scenes/RundaScene.js';
const GO = 'js/scenes/GameOverScene.js', SE = 'js/scenes/SettingsScene.js';
const sScreens = [HDR,
  // --- hlavní menu ---
  row('MENU.title', 'title', ME, 'ANO', 'PARTY SURVIVORS', 'titulek hry'),
  row('MENU.tagline', 'text', ME, 'ANO', 'PŘEŽIJ TUHLE KALBU', 'podtitulek menu'),
  row('MENU.item.start', 'button', ME, 'ANO', 'START', 'menu (navigace)'),
  row('MENU.item.help', 'button', ME, 'ANO', 'VYSVĚTLIVKY', 'menu (navigace)'),
  row('MENU.item.settings', 'button', ME, 'ANO', 'NASTAVENÍ', 'menu (navigace)'),
  row('MENU.item.leaderboard', 'button', ME, 'ANO', 'LEADERBOARD', 'menu (navigace)'),
  // --- vysvětlivky ---
  row('HELP.title', 'title', HE, 'ANO', 'VYSVĚTLIVKY', 'titulek nápovědy'),
  row('HELP.cil.head', 'head', HE, 'ANO', 'CÍL HRY', 'sekce nápovědy'),
  row('HELP.cil.body', 'body', HE, 'ANO', 'Přežij co nejdéle. Tvé skóre je čas přežití.', 'sekce nápovědy'),
  row('HELP.pohyb.head', 'head', HE, 'ANO', 'POHYB', 'sekce nápovědy'),
  row('HELP.pohyb.body', 'body', HE, 'ANO', 'Pohybuj se klávesami {nahoru} / {vlevo} / {dolů} / {vpravo} (změna v nastavení).\nŠipky fungují vždy. Pauza: {pauza}.', '{…} = aktuální klávesy (doplní se za běhu)'),
  row('HELP.utoky.head', 'head', HE, 'ANO', 'ÚTOKY', 'sekce nápovědy'),
  row('HELP.utoky.body', 'body', HE, 'ANO', 'Hrdina útočí automaticky, ty jen manévruješ. Některé útoky\nmíří na nejbližšího nepřítele, jiné kam je hrdina otočený.', 'sekce nápovědy'),
  row('HELP.xp.head', 'head', HE, 'ANO', 'XP A LEVELY', 'sekce nápovědy'),
  row('HELP.xp.body', 'body', HE, 'ANO', 'Z nepřátel padají XP gemy. Sbírej je — při novém levelu\nsi vybereš jedno ze tří vylepšení nebo nový útok.', 'sekce nápovědy'),
  row('HELP.klicky.head', 'head', HE, 'ANO', 'KLÍČKY (POWERUPY)', 'sekce nápovědy'),
  row('HELP.klicky.body', 'body', HE, 'ANO', 'Vzácně leží na mapě. Každá barva = jiný bonus.\nSeber je dřív, než zmizí v davu. Velmi vzácně někdo\nobjedná RUNDU PANCLŮ — balík odměn, jdi za zlatou šipkou!', 'sekce nápovědy'),
  row('HELP.boss.head', 'head', HE, 'ANO', 'BOSSOVÉ', 'sekce nápovědy'),
  row('HELP.boss.body', 'body', HE, 'ANO', 'Když dorazí boss, nepřátelé utvoří neprostupný ring —\nbojuješ jen s bossem. Poraž ho a získáš velkou odměnu.', 'sekce nápovědy'),
  // --- zadání jména ---
  row('NAME.title', 'title', NA, 'ANO', 'ZADEJ HERNÍ JMÉNO', 'obrazovka jména'),
  row('NAME.sub', 'text', NA, 'ANO', 'POD TÍMHLE JMÉNEM SE ULOŽÍ TVŮJ REKORD', 'obrazovka jména'),
  row('NAME.max', 'text', NA, 'ANO', 'MAX 12 ZNAKŮ', 'obrazovka jména'),
  row('NAME.empty', 'toast', NA, 'ANO', 'ZADEJ ASPOŇ JEDEN ZNAK!', 'prázdné jméno'),
  // --- výběr hrdiny ---
  row('HS.title', 'title', HS, 'ANO', 'VYBER SI HRDINU', 'výběr hrdiny'),
  row('HS.confirmL1', 'label', HS, 'ANO', 'CHCI HRÁT ZA', 'potvrzovací pole (nad jménem ve 4. pádě)'),
  row('HS.placeholder', 'label', HS, 'ANO', 'klikni na hrdinu', 'potvrzovací pole, dokud není hrdina zamčený'),
  // --- level-up ---
  row('LU.title', 'title', LU, 'ANO', 'LEVEL {n}!', 'titulek level-upu'),
  row('LU.sub', 'text', LU, 'ANO', 'VYBER SI VYLEPŠENÍ', 'level-up'),
  row('LU.head.new', 'head', LU, 'ANO', 'NOVÝ ÚTOK', 'záhlaví karty'),
  row('LU.head.weaponUp', 'head', LU, 'ANO', 'VYLEPŠENÍ ÚTOKU', 'záhlaví karty'),
  row('LU.head.perk', 'head', LU, 'ANO', 'PERK ÚTOKU', 'záhlaví karty'),
  row('LU.head.upgrade', 'head', LU, 'ANO', 'UPGRADE', 'záhlaví karty'),
  row('LU.weaponUp.desc', 'desc', LU, 'ANO', 'Poškození +25 %\n(LV {x} > {y})', 'popis karty „vylepšení útoku" (šablona)'),
  // --- Runda panclů ---
  row('RUNDA.title', 'title', RU, 'ANO', 'RUNDA PANCLŮ!', 'overlay Rundy'),
  row('RUNDA.sub', 'text', RU, 'ANO', 'NA EX!', 'overlay Rundy'),
  row('RUNDA.tag.key', 'tag', RU, 'ANO', '[KLÍČ]', 'štítek odměny — klíč'),
  row('RUNDA.tag.upgrade', 'tag', RU, 'ANO', '[STÁLÝ UPGRADE]', 'štítek odměny — upgrade'),
  row('RUNDA.hint', 'hint', RU, 'ANO', 'ENTER / KLIK — DO TOHO!', 'výzva k potvrzení'),
  // --- konec hry ---
  row('GO.title', 'title', GO, 'ANO', 'KONEC PÁRTY', 'obrazovka konce'),
  row('GO.hero', 'text', GO, 'ANO', 'HRDINA: {JMÉNO}', 'konec — hrdina'),
  row('GO.survived', 'text', GO, 'ANO', 'PŘEŽIL JSI', 'konec — nad časem'),
  row('GO.levelKills', 'text', GO, 'ANO', 'LEVEL {l}   ·   KILLS {k}', 'konec — level a killy'),
  row('GO.record', 'text', GO, 'ANO', 'NOVÝ REKORD!', 'konec — nový rekord'),
  row('GO.recordPrev', 'text', GO, 'ANO', 'REKORD: {čas}{ — jméno}', 'konec — stávající rekord'),
  row('GO.again', 'button', GO, 'ANO', 'HRÁT ZNOVU', 'konec — tlačítko'),
  row('GO.menu', 'button', GO, 'ANO', 'ZPĚT DO MENU', 'konec — tlačítko'),
  row('GO.stat.weapons', 'head', GO, 'ANO', 'ZBRANĚ', 'statistiky výbavy'),
  row('GO.stat.upgrades', 'head', GO, 'ANO', 'UPGRADY', 'statistiky výbavy'),
  row('GO.stat.none', 'text', GO, 'ANO', 'ŽÁDNÉ', 'statistiky — žádné upgrady'),
  // --- nastavení (flavour) ---
  row('SET.title', 'title', SE, 'ANO', 'NASTAVENÍ', 'obrazovka nastavení'),
  row('SET.touchHead', 'text', SE, 'ANO', 'DOTYKOVÉ OVLÁDÁNÍ', 'nadpis dotykových voleb'),
  row('SET.reset', 'toast', SE, 'ANO', 'OBNOVENO VÝCHOZÍ NASTAVENÍ', 'reset kláves'),
];

const SHEETS = [
  { name: 'Hrdinové', rows: sHeroes },
  { name: 'Útoky', rows: sAttacks },
  { name: 'Perky útoků', rows: sPerks },
  { name: 'Upgrady', rows: sUpgrades },
  { name: 'Powerupy', rows: sPowerups },
  { name: 'Nepřátelé', rows: sEnemies },
  { name: 'Bossové', rows: sBosses },
  { name: 'Hlášky ve hře', rows: sAnn },
  { name: 'Texty obrazovek', rows: sScreens },
];

// ============================================================
//  OOXML (xlsx) — ruční sestavení, bez závislostí
// ============================================================
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const colLetter = (i) => String.fromCharCode(65 + i); // 0..6 → A..G

function sheetXml(rows) {
  let body = '';
  rows.forEach((cells, r) => {
    const ri = r + 1;
    let cs = '';
    cells.forEach((val, c) => {
      const ref = colLetter(c) + ri;
      const style = r === 0 ? 1 : (c >= 4 ? 2 : 0); // záhlaví tučně; textové sloupce wrap
      cs += `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
    });
    body += `<row r="${ri}">${cs}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>
<col min="1" max="1" width="26"/><col min="2" max="2" width="12"/><col min="3" max="3" width="20"/>
<col min="4" max="4" width="15"/><col min="5" max="5" width="62"/><col min="6" max="6" width="62"/><col min="7" max="7" width="36"/>
</cols>
<sheetData>${body}</sheetData>
</worksheet>`;
}

const files = [];
files.push({ name: '[Content_Types].xml', data: Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${SHEETS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`, 'utf8') });

files.push({ name: '_rels/.rels', data: Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`, 'utf8') });

files.push({ name: 'xl/workbook.xml', data: Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${SHEETS.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n')}
</sheets>
</workbook>`, 'utf8') });

files.push({ name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${SHEETS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`, 'utf8') });

files.push({ name: 'xl/styles.xml', data: Buffer.from(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`, 'utf8') });

SHEETS.forEach((s, i) => {
  files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheetXml(s.rows), 'utf8') });
});

// ---------- ZIP (store, bez komprese) + CRC32 ----------
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

function zipStore(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const f of entries) {
    const name = Buffer.from(f.name, 'utf8'), data = f.data, crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, name, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + data.length;
  }
  const localBuf = Buffer.concat(local), centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(localBuf.length, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, end]);
}

const out = path.join(__dirname, '..', 'wording.xlsx');
fs.writeFileSync(out, zipStore(files));
const total = SHEETS.reduce((n, s) => n + s.rows.length - 1, 0);
console.log(`OK → ${out}`);
console.log(`Listů: ${SHEETS.length}, řádků s textem: ${total}`);
SHEETS.forEach(s => console.log(`  ${s.name}: ${s.rows.length - 1}`));
