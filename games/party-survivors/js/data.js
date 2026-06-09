// ============================================================
// Party Survivors — herní data (přepis z logika.xlsx)
// + balanc konstanty (finální ladění ve Fázi 6)
// ============================================================
window.PS = window.PS || {};

// Registr scén — každý soubor scény se sem přidá, main.js z toho staví hru
PS.scenes = [];

// ---------- Paleta (ladí s neonovým stylem webu) ----------
PS.COLORS = {
  bg:      0x030008, // temná klubová čerň
  pink:    0xff2bd6,
  cyan:    0x00ffff,
  yellow:  0xffe600,
  green:   0x39ff14,
  orange:  0xff9100,
  purple:  0xb44cff,
  red:     0xff3b3b,
  white:   0xffffff,
  dark:    0x030008,
  confetti: [0xff2bd6, 0x00ffff, 0xffe600, 0x39ff14, 0xff9100, 0xb44cff],
};

PS.STORAGE = {
  keys: 'ps_keys',     // nastavení kláves
  best: 'ps_best',     // LEGACY — starý rekord bez jména; v menu se maže
  record: 'ps_record', // rekord — JSON { time, name } (od zavedení jmen)
  name: 'ps_name',     // naposledy zadané herní jméno (předvyplňuje se)
};

// ---------- Hudba na pozadí ----------
// Seznam tracků (PS.MUSIC) je v js/playlist.js — AUTOGENEROVANÝ skriptem
// tools/build-music.js (komprese masterů z music/ na 128k MP3 + tento seznam).
// Přehrávání řeší js/music.js (sekvenčně podle abecedy, ve smyčce, s crossfade).

// ---------- Hrdinové (list „Hrdinové") ----------
// intro1/intro2 = doslovné texty ze sloupců „Intro 1. řádek" / „Intro 2. řádek"
PS.HEROES = [
  {
    id: 'rashid', name: 'Rashid', attackId: 'bliti', color: 0x39ff14,
    intro1: 'Primární útok: blití',
    intro2: 'Speciální schopnost: Každý XP point mu přidá o 5 % více XP',
    passive: { type: 'xpGain', value: 0.05 },
  },
  {
    id: 'poskok', name: 'Poskok', attackId: 'chcani', color: 0xffe600,
    intro1: 'Primární útok: chcaní',
    intro2: 'Speciální schopnost: Pohybuje se o 12 % rychleji.',
    passive: { type: 'moveSpeed', value: 0.12 },
  },
  {
    id: 'dong', name: 'Don G', attackId: 'tagovani', color: 0xff2bd6,
    intro1: 'Primární útok: tagování',
    intro2: 'Speciální schopnost: Sbírá XP a powerupy z o 30 % větší vzdálenosti (větší dosah magnetu).',
    passive: { type: 'magnet', value: 0.30 },
  },
  {
    id: 'kaar', name: 'Kaar', attackId: 'lahvac', color: 0xc77b30,
    intro1: 'Primární útok: házení lahváčem',
    intro2: 'Speciální schopnost: Udílí o 10 % vyšší poškození.',
    passive: { type: 'damage', value: 0.10 },
  },
  {
    id: 'fjodor', name: 'Fjodor Ket', attackId: 'vajgly', color: 0xa8c020,
    intro1: 'Primární útok: plivání vaglů',
    intro2: 'Speciální schopnost: Všechny jeho útoky mají o 8 % kratší cooldown (rychlejší útoky).',
    passive: { type: 'cooldown', value: 0.08 },
  },
  {
    id: 'extreme', name: 'eXtreme', attackId: 'pivo', color: 0xffb400,
    intro1: 'Primární útok: rozlejvání piva',
    intro2: 'Speciální schopnost: Má o 20 % vyšší maximální HP.',
    passive: { type: 'maxHp', value: 0.20 },
  },
  {
    id: 'fadadevada', name: 'fadadevada', attackId: 'dym', color: 0x9fb8c8,
    intro1: 'Primární útok: vypouštění dýmu',
    intro2: 'Speciální schopnost: Regeneruje navíc 1 HP každou sekundu.',
    passive: { type: 'regen', value: 1 },
  },
  {
    id: 'zlozik', name: 'Zložík', attackId: 'panaky', color: 0xff3b3b,
    intro1: 'Primární útok: kopání panáků',
    intro2: 'Speciální schopnost: Má 10 % šanci na kritický zásah za dvojnásobné poškození.',
    passive: { type: 'crit', value: 0.10, mult: 2 },
  },
  {
    id: 'sajmic', name: 'Sajmič Uraka', attackId: 'list', color: 0x2ecc40,
    intro1: 'Primární útok: facka listem',
    intro2: 'Speciální schopnost: Pohlcuje 15 % příchozího poškození (pasivní brnění).',
    passive: { type: 'armor', value: 0.15 },
  },
];

// ---------- Útoky — rebalanc ve stylu Vampire Survivors ----------
// Každý útok má unikátní profil. Osy různorodosti:
//   aim:   'facing'  = míří kam je hrdina otočený (blití, pivo)
//          'nearest' = míří na nejbližšího nepřítele (chcaní, vajgly, list);
//                      lahvác = náhodný z několika nejbližších (auto-cíl)
//          'self'    = pevný vzor kolem hrdiny (tagování, dým, panáky)
//   DMG/CD profil: nuke (lahvác 34 / 3,2 s) … rychlopalba (vajgly 8 / 0,5 s)
//   multi-target:  pierce (chcaní) / odrazy mezi nepřáteli (vajgly) /
//                  neomezené AoE (blití, pivo, dým) / limit cílů (list)
//   control:       knockback 0–4, stun (list, lahvác), slow (vajgly, dým, kaluže)
// desc = text na level-up kartě (gameplay), anim = popis vizuálu
// POZN. tempo hry: všechny rychlosti i vzdálenosti ve hře jsou globálně ×0,7
// (zpomalení hry); časy (CD, tiky, trvání) zůstaly — balanc v časové doméně
// je beze změny. Při ladění drž poměr rychlost:vzdálenost.
PS.ATTACKS = {
  bliti: {
    name: 'blití', archetype: 'cone', aim: 'facing',
    anim: 'zelený proud směrem od hlavy hrdiny',
    desc: 'Kužel ve směru pohledu hrdiny. Nižší DMG, ale zasažené otravuje — dostávají poškození v čase.',
    dmg: 7, tick: 0.35, angle: 62, range: 95, cd: 2.4, duration: 1.4,
    dot: { dps: 4, dur: 2.5 }, knockback: 0, pierce: Infinity,
  },
  chcani: {
    name: 'chcaní', archetype: 'beam', aim: 'nearest',
    anim: 'žlutý proud z pasu hrdiny mířící k nejbližšímu nepříteli; zanechává kaluž',
    desc: 'Nejdelší dosah: paprsek na nejbližšího nepřítele probodne až 5 v řadě. Kaluž zpomaluje.',
    dmg: 16, cd: 1.0, range: 145, width: 22, pierce: 5,
    puddle: { r: 28, dur: 3, slow: 0.30 }, knockback: 0,
  },
  tagovani: {
    name: 'tagování', archetype: 'zone', aim: 'self',
    anim: 'hrdina sprejem stříkne barevný tag na zem, kde právě stojí',
    desc: 'Položí zónu v místě, kde hrdina stojí. Kdo v ní je, dostává tikající DMG. Max 2 zóny.',
    cd: 3.8, r: 46, dur: 6, dmg: 6, tick: 0.5, maxZones: 2, knockback: 0,
  },
  lahvac: {
    name: 'házení lahváčem', archetype: 'lob', aim: 'nearest',
    anim: 'hrdina obloukem hodí plný lahváč, který se po dopadu roztříští na střepy',
    desc: 'Nuke: nejvyšší DMG, dlouhý cooldown. Sám zamíří na náhodného z několika nejbližších nepřátel; přímý zásah omračuje, střepy plošně zasáhnou okolí dopadu.',
    dmg: 34, cd: 3.2,
    targetRange: 240, targetPool: 4, // auto-cíl: náhodný z N nejbližších v dosahu
    hitR: 16,                        // poloměr přímého zásahu (plný DMG + stun)
    burst: { r: 52, dmg: 13 },
    shards: { r: 40, dur: 4, dmg: 4, tick: 0.5 },
    knockback: 2, // střední
    stun: { chance: 0.20, dur: 0.6 },
  },
  vajgly: {
    name: 'plivání vajglů', archetype: 'bounce', aim: 'nearest',
    anim: 'zelenožlutý vajgl vystřelený od úst hrdiny, odrážející se mezi nepřáteli',
    desc: 'Rychlopalba: nejkratší cooldown, malý DMG. Vajgl se odráží až mezi 4 nepřáteli a zpomaluje je.',
    dmg: 8, cd: 0.5, range: 180, bounces: 3, bounceRange: 125,
    slow: { pct: 0.20, dur: 1.2 }, knockback: 0,
  },
  pivo: {
    name: 'rozlejvání piva', archetype: 'sweep', aim: 'facing',
    anim: 'pohnutí půllitrem plného piva směrem od hrdiny a jeho vylití',
    desc: 'Těžké máchnutí ve směru pohledu: široký oblouk, vysoký DMG a velký odhoz. Kaluž zpomaluje.',
    dmg: 20, cd: 1.6, angle: 140, range: 105, pierce: Infinity,
    puddle: { r: 38, dur: 2.5, slow: 0.20 }, knockback: 3, // velký
  },
  dym: {
    name: 'vypouštění dýmu', archetype: 'aura', aim: 'self',
    anim: 'šedý oblak dýmu z vaporizéru trvale obklopující hrdinu',
    desc: 'Trvalá aura kolem hrdiny: nejnižší DMG, ale bez cooldownu — tiká pořád a zpomaluje.',
    dmg: 3, tick: 0.5, r: 108, slow: 0.15, cd: 0, knockback: 0,
  },
  panaky: {
    name: 'kopání panáků', archetype: 'orbit', aim: 'self',
    anim: 'štamprlata (panáky) vykopnutá do orbitu, krouží kolem hrdiny',
    desc: 'Obranný perimetr: 2 panáky krouží kolem hrdiny — stálý kontaktní DMG a malý odhoz.',
    count: 2, r: 56, period: 1.4, dmg: 8, rehit: 0.95, knockback: 1, // malý
  },
  list: {
    name: 'facka listem', archetype: 'slap', aim: 'nearest',
    anim: 'hrdina švihne velkým marihuanovým listem do nejbližšího nepřítele',
    desc: 'Rychlé facky nejbližšímu (max 2 cíle): obrovský knockback a 25% šance na stun. Krátký dosah.',
    dmg: 22, cd: 0.78, angle: 50, range: 78, targets: 2,
    knockback: 4, // obrovský
    stun: { chance: 0.25, dur: 0.5 },
  },
};

// ---------- Perky útoků — druhá osa vylepšování vedle „+25 % DMG" ----------
// Každý vlastněný útok nabízí při level-upu kromě DMG i perk(y) s vlastním
// malým stropem (cap). Důraz na počty: projektily/odrazy/cíle/zóny navíc.
// Efekty čte PS.Weapon přes this.perk(id) — viz weapons.js.
PS.WEAPON_PERKS = {
  bliti: [
    { id: 'davka', name: 'větší dávka',  cap: 2, desc: 'Proud blití trvá o 0,5 s déle — víc tiků za aktivaci.' },
    { id: 'kuzel', name: 'širší kužel',  cap: 2, desc: 'Kužel blití je o 15° širší.' },
  ],
  chcani: [
    { id: 'pierce',  name: 'silnější proud', cap: 2, desc: 'Paprsek probodne o 2 nepřátele víc.' },
    { id: 'dvojity', name: 'dvojitý proud',  cap: 1, desc: 'Zasáhne i druhého nejbližšího nepřítele.' },
  ],
  tagovani: [
    { id: 'tag', name: 'další tag', cap: 2, desc: 'Na zemi může ležet o 1 tag víc.' },
  ],
  lahvac: [
    { id: 'runda', name: 'hod navíc', cap: 2, desc: 'Hází o 1 lahváč víc (na dalšího nepřítele).' },
  ],
  vajgly: [
    { id: 'odraz',   name: 'lepivý vajgl',     cap: 2, desc: 'Vajgl se odrazí o 1 nepřítele dál.' },
    { id: 'dvojite', name: 'dvojité plivnutí', cap: 1, desc: 'Plivne 2 vajgly najednou, každý na jiný cíl.' },
  ],
  pivo: [
    { id: 'dozadu', name: 'máchnutí dozadu', cap: 1, desc: 'Druhé máchnutí pokryje i prostor za hrdinou.' },
    { id: 'sirka',  name: 'širší oblouk',    cap: 2, desc: 'Oblouk máchnutí je o 20° širší.' },
  ],
  dym: [
    { id: 'hustsi', name: 'hustší dým', cap: 2, desc: 'Dým tiká o 0,1 s rychleji.' },
  ],
  panaky: [
    { id: 'panak',  name: 'další panák',    cap: 2, desc: 'Přidá 1 orbitující panák.' },
    { id: 'rotace', name: 'rychlejší oběh', cap: 1, desc: 'Panáky obíhají o 20 % rychleji.' },
  ],
  list: [
    { id: 'cile', name: 'víc plácanců',      cap: 2, desc: 'Facka zasáhne o 1 cíl víc.' },
    { id: 'stun', name: 'jistější plácnutí', cap: 1, desc: 'Šance na omráčení +10 %.' },
  ],
};

// ---------- Upgrady (list „Upgrady") — pasivky při level-upu ----------
PS.UPGRADES = [
  { id: 'odpocinek',  name: 'odpočinek',           desc: 'navýšení max HP o 20 %',                              effect: { type: 'maxHp', value: 0.20 } },
  { id: 'naslapnuto', name: 'našlápnuto',          desc: 'Navýšení udíleného poškození o 15 %.',                effect: { type: 'damage', value: 0.15 } },
  { id: 'rozjezd',    name: 'rozjezd',             desc: 'Zkrácení cooldownu všech útoků o 10 %.',              effect: { type: 'cooldown', value: 0.10 } },
  { id: 'poldove',    name: 'utíkám před poldama', desc: 'Zvýšení rychlosti pohybu hrdiny o 12 %.',             effect: { type: 'moveSpeed', value: 0.12 } },
  { id: 'pracky',     name: 'delší pracky',        desc: 'Zvětšení zásahové plochy a dosahu všech útoků o 15 %.', effect: { type: 'area', value: 0.15 } },
  { id: 'nenasyta',   name: 'nenasyta',            desc: 'Zvětšení dosahu sběru XP a powerupů (magnet) o 25 %.', effect: { type: 'magnet', value: 0.25 } },
  { id: 'kebab',      name: 'kebab v 5 ráno',      desc: 'Regenerace 2 HP každou sekundu.',                     effect: { type: 'regen', value: 2 } },
];

// ---------- Powerupy (list „Powerups") — klíčky volně na mapě ----------
PS.POWERUPS = [
  { id: 'heal',     name: 'klíč - heal',         color: 0xff3b3b, colorName: 'červený',  desc: 'vyléčí 30 % životů (instaheal)',                          effect: { type: 'heal', value: 0.30 } },
  { id: 'freeze',   name: 'klíč - freeze',       color: 0x3b6cff, colorName: 'modrý',    desc: 'zmrazí všechny nepřátele na 8 sekund',                    effect: { type: 'freeze', dur: 8 } },
  { id: 'speed',    name: 'klíč - speed',        color: 0xffffff, colorName: 'bílý',     desc: 'zvýší rychlost pohybu hrdiny o 20 % na 27 sekund',        effect: { type: 'speed', value: 0.20, dur: 27 } },
  { id: 'damage',   name: 'klíč - damage',       color: 0x39ff14, colorName: 'zelený',   desc: 'zvýší udílený damage o 30 % na 17 sekund',                effect: { type: 'damage', value: 0.30, dur: 17 } },
  { id: 'magnet',   name: 'klíč - magnet',       color: 0xffe600, colorName: 'žlutý',    desc: 'okamžitě přitáhne všechny ležící XP a powerupy k hrdinovi', effect: { type: 'magnet' } },
  { id: 'immortal', name: 'klíč - nesmrtelnost', color: 0xb44cff, colorName: 'fialový',  desc: 'hrdina je 10 sekund nezranitelný',                        effect: { type: 'immortal', dur: 10 } },
  { id: 'cistka',   name: 'klíč - čistka',       color: 0xff9100, colorName: 'oranžový', desc: 'okamžitě zasáhne všechny nepřátele na obrazovce za 200 poškození', effect: { type: 'nuke', dmg: 200 } },
];

// ---------- Nepřátelé (list „Nepřátelé") ----------
// Tier n => typ = (n-1) % 5, level = floor((n-1)/5) + 1, síla = n (nekonečná progrese)
// speedMult: diverzifikace rychlosti typů — pikaři nejrychlejší, rodiče nejpomalejší.
// Strop: base max ~80 px/s × 1.25 ≈ 101 px/s « hrdina 126 px/s (a na hrdinu ve hře
// žádné zpomalení neexistuje) => hrdina je VŽDY nejrychlejší — neměnit bez rozmyslu!
PS.ENEMIES = [
  { id: 'gufrau',    name: 'gufrau',    vis: 'hipstersky vypadající postavy',                 color: 0x4ecdc4, strength: 1, speedMult: 1.0 },
  { id: 'kravataci', name: 'kravaťáci', vis: 'postavy v obleku s kravatou',                   color: 0x3b5bdb, strength: 2, speedMult: 0.9 },
  { id: 'pikari',    name: 'pikaři',    vis: 'ohnuté postavy ošklivě vypadající',             color: 0x7a9e2e, strength: 3, speedMult: 1.25 },
  { id: 'rodice',    name: 'rodiče',    vis: 'mužská a ženská postava v páru středního věku', color: 0xc98a5a, strength: 4, speedMult: 0.85 },
  { id: 'policiste', name: 'policisté', vis: 'postavy s policejní čepicí',                    color: 0x2255cc, strength: 5, speedMult: 1.1 },
];

// ---------- Bossové (list „Bossové") ----------
// Boss síly B se spawne ve chvíli, kdy začne tier (B - 2).
// Po Schýzovi cyklus pokračuje: Kato lvl 2 (síla 30) atd. (+25 síly za cyklus)
PS.BOSSES = [
  { id: 'kato',   name: 'Kato',           strength: 5,  vis: 'postava co vypadá jak bezdomovec',        color: 0x8a6d3b,
    attackName: 'plive zuby',                 mechanic: 'projectiles', mech: 'jednotlivé šipky (zuby), damage jen při přímém zásahu' },
  { id: 'rohony', name: 'Rohony',         strength: 10, vis: 'divná postava s tetováním na obličeji',   color: 0xb44cff,
    attackName: 'vysílá negativní zvukové vlny', mechanic: 'pushwave',  mech: 'trychtýř odhazuje hrdinu, nedává damage' },
  { id: 'churaq', name: 'Churaq Sputnik', strength: 15, vis: 'inspirováno rapperem Churaq Sputnik',     color: 0xff9100,
    attackName: 'útok baseballovou holí',     mechanic: 'meleeswing',  mech: 'švih do okolí — odhodí hrdinu a dá střední damage, jen na blízko' },
  { id: 'haades', name: 'Haades',         strength: 20, vis: 'inspirováno rapperem Haades',             color: 0x666688,
    attackName: 'vyvolává Pikaře lvl 2 a 3',  mechanic: 'summoner',    mech: 'sám neútočí, vyvolává další nepřátele' },
  { id: 'schyza', name: 'Schýza',         strength: 25, vis: 'černá hmota, která není postava',         color: 0x1a1a2e,
    attackName: 'hypnotizace',                mechanic: 'hypnosis',    mech: 'zmrazí hrdinu na 0,5 s a dá mu menší damage' },
];

// ---------- Balanc — výchozí rámec ----------
PS.BALANCE = {
  // baseRegen = velmi slabá základní regenerace HP/s, kterou mají VŠICHNI hrdinové
  // (0,5 = 1 HP za 2 s). Pasivka/upgrade regenerace se přičítá nad tento základ.
  player: { hp: 100, speed: 126, magnet: 35, baseRegen: 0.5 }, // rychlosti+vzdálenosti globálně ×0,7

  // Nepřítel síly s (7× — síla 1 umírá na jeden zásah většiny útoků).
  // HP/DMG mírně sníženy jako kompenzace pomalejší XP křivky (hrdina má
  // v daném čase méně levelů) — hra musí zůstat hratelná.
  enemyHp:   (s) => Math.round(7 * Math.pow(s, 1.3)),
  enemyDmg:  (s) => Math.round(3 + 1.5 * s),
  enemySpeed:(s) => (55 + Math.min(60, s * 4)) * 0.7, // base ×0,7; násobí se speedMult typu (spawner)

  // Boss síly B
  bossHp:  (B) => 90 * B,
  bossDmg: (B) => 8 + 2 * B,

  // Časová osa obtížnosti: nový tier každých ~85 s => pomalejší růst síly
  // nepřátel (HP/dmg), aby hra nezhoustla moc brzy; bossové à ~7 min
  // (boss síly B se spawne při tieru B−2, tj. tiery 3/8/13… → ~2,8 / 9,5 / 16 min).
  tierSeconds: 85,

  // XP potřebné na level N — mírně snazší než dřív (8, 20, 38, 62…), protože
  // nepřátel je teď méně (nižší příjem XP). Přírůstek pořád roste s každým
  // levelem (kvadraticky) => tempo levelování klesá celou hru, nikdy se
  // „nerozjede" do nesmrtelnosti (VS styl).
  xpForLevel: (n) => 8 + 9 * (n - 1) + 3 * (n - 1) * (n - 1),

  // ---------- Spawn — NEROVNOMĚRNÝ proud (VS styl) ----------
  // Slabší STÁLÝ proud `spawnRate` (nepřátel/s) + krátké VLNKY (`surge`) +
  // občas velká telegrafovaná HORDA (`horde`). Cíl: lehčí early, obtížné až
  // ~10. min, dobrý hráč 15-20 min. Tlak (rate × HP nepřátel) roste rychleji
  // než jakýkoli DPS hráče → smrt je nakonec nevyhnutelná (žádné nesmrtelné
  // kombo). Ladí se v tools/spawn-curve.js.
  spawnRate: (t) => { const m = t / 60; return 0.85 + 0.20 * m + 0.0095 * m * m; },
  surge: { period: 50, dur: 7, mult: 2.4 },                          // vlnka ~à 50 s, ×2,4 na 7 s
  horde: { period: 160, size: (tier) => 12 + Math.round(tier * 2.4) }, // horda ~à 2,7 min

  // Level-up volby
  maxWeapons: 6,          // max útoků na hrdinu (jako VS)
  weaponMaxLevel: 8,      // max level útoku
  weaponDmgPerLevel: 0.25,// +25 % DMG za level útoku
  passiveMaxLevel: 5,     // max úroveň pasivky

  // Váha nabídky „vylepšení už vlastněného útoku" při level-upu (VS styl):
  // žádné pevné pravidlo, jen vyšší pravděpodobnost. V prvních levelech
  // výrazná (hráč rozvíjí svůj útok od začátku), s levelem klesá k 1.6;
  // ostatní volby (nový útok, pasivka) mají váhu 1.
  weaponUpWeight: (lvl) => Math.max(1.6, 7 - (lvl - 2) * 0.5),

  // Mapa a výkon
  mapSize: 8000,
  maxEnemies: 300,

  // Boss aréna: při příchodu bosse utvoří běžní nepřátelé neprostupný ring
  arenaRadius: 450,   // poloměr ringu kolem hrdiny
  arenaSlotGap: 46,   // rozestup nepřátel ve zdi (sprite-based, neškáluje se) → ~61 slotů

  // Powerupy: vzácné, ~1 spawn za 60–90 s
  powerupIntervalMin: 60,
  powerupIntervalMax: 90,

  // Runda panclů — vzácný „treasure" (VS styl): průměrně 1 za ~5 minut.
  // Zůstává na mapě, dokud ji hrdina nesebere (max 1 zároveň); HUD šipka vede k ní.
  rundaIntervalMin: 240,             // s
  rundaIntervalMax: 360,             // s
  rundaSpawnMin: 800,                // spawn vzdálenost od hrdiny (vždy za okrajem obrazovky)
  rundaSpawnMax: 1300,
  rundaKeys:     { min: 2, max: 4 }, // časově omezené klíče (náhodné, bez duplicit)
  rundaUpgrades: { min: 1, max: 3 }, // stálé upgrady: vylepšení vlastněných útoků + pasivky
};
