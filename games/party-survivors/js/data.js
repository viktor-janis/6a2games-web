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
  touch: 'ps_touch',   // dotykové volby — JSON { size, opacity } (joystick)
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
    intro2: 'Speciální schopnost: Udílí o 16 % vyšší poškození.',
    passive: { type: 'damage', value: 0.16 },
  },
  {
    id: 'poskok', name: 'Poskok', attackId: 'chcani', color: 0xffe600,
    intro1: 'Primární útok: chcaní',
    intro2: 'Speciální schopnost: Pohybuje se o 22 % rychleji.',
    passive: { type: 'moveSpeed', value: 0.22 },
  },
  {
    id: 'dong', name: 'Don G', attackId: 'tagovani', color: 0xff2bd6,
    intro1: 'Primární útok: tagování',
    intro2: 'Speciální schopnost: Každý XP point mu přidá o 6 % více XP.',
    passive: { type: 'xpGain', value: 0.06 },
  },
  {
    id: 'kaar', name: 'Kaar', attackId: 'lahvac', color: 0xc77b30,
    intro1: 'Primární útok: házení lahváčem',
    intro2: 'Speciální schopnost: Regeneruje navíc 1 HP každou sekundu.',
    passive: { type: 'regen', value: 1 },
  },
  {
    id: 'fjodor', name: 'Fjodor Ket', attackId: 'vajgly', color: 0xa8c020,
    intro1: 'Primární útok: plivání vajglů',
    intro2: 'Speciální schopnost: Všechny jeho útoky mají o 12 % kratší cooldown (rychlejší útoky).',
    passive: { type: 'cooldown', value: 0.12 },
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
    intro2: 'Speciální schopnost: Má 12 % šanci na kritický zásah za dvojnásobné poškození.',
    passive: { type: 'crit', value: 0.12, mult: 2 },
  },
  {
    id: 'zlozik', name: 'Zložík', attackId: 'panaky', color: 0xff3b3b,
    intro1: 'Primární útok: kopání panáků',
    intro2: 'Speciální schopnost: Sbírá XP a powerupy z o 20 % větší vzdálenosti (větší dosah magnetu).',
    passive: { type: 'magnet', value: 0.20 },
  },
  {
    id: 'sajmic', name: 'Sajmič Uraka', attackId: 'list', color: 0x2ecc40,
    intro1: 'Primární útok: facka listem',
    intro2: 'Speciální schopnost: Pohlcuje 12 % příchozího poškození (pasivní brnění).',
    passive: { type: 'armor', value: 0.12 },
  },
];

// ---------- Útoky — rebalanc ve stylu Vampire Survivors ----------
// Každý útok má unikátní profil. Osy různorodosti:
//   aim:   'facing'  = míří kam je hrdina otočený (blití, pivo)
//          'nearest' = míří na nejbližšího nepřítele (chcaní, vajgly, list);
//                      lahvác = náhodný z několika nejbližších (auto-cíl)
//          'self'    = pevný vzor kolem hrdiny (tagování, dým, panáky)
//   DMG/CD profil: nuke (lahvác 27 / 3,9 s) … rychlopalba (vajgly 6 / 0,62 s)
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
    anim: 'nepřetržitý zelený proud chrlený směrem chůze hrdiny',
    desc: 'Nepřetržitý proud blitek ve směru chůze. Slabší jednotlivý zásah, ale zasažené navíc otravuje (poškození v čase). Rychlopalba na blízko ve směru chůze.',
    // TRVALÝ proud (žádný cd/duration): tiká každých `tick` s. Laděno na ~medián
    // přes tools/balance-sim.js (plynulý proud má vyšší uptime → per-tik DMG nízký).
    dmg: 6, tick: 0.32, angle: 62, range: 95,
    dot: { dps: 4, dur: 2.5 }, knockback: 0, pierce: Infinity,
  },
  chcani: {
    name: 'chcaní', archetype: 'beam', aim: 'nearest',
    anim: 'žlutý proud z pasu hrdiny mířící k nejbližšímu nepříteli; zanechává kaluž',
    desc: 'Nejdelší dosah: proud chcaní na nejbližšího nepřítele probodne až 4 v řadě. Kaluž zpomaluje.',
    // Nerf na dálku („daň za bezpečí") — pořád nejdelší reach, ale platí za něj.
    dmg: 15, cd: 1.05, range: 125, width: 22, pierce: 4,
    puddle: { r: 28, dur: 3, slow: 0.30 }, knockback: 0,
  },
  tagovani: {
    name: 'tagování', archetype: 'zone', aim: 'self',
    anim: 'hrdina sprejem stříkne barevný tag na zem, kde právě stojí',
    desc: 'Položí tag v místě, kde hrdina stojí. Kdo v něm je, dostává tikající DMG. Max 2 zóny.',
    cd: 3.8, r: 46, dur: 6, dmg: 6, tick: 0.5, maxZones: 2, knockback: 0,
  },
  lahvac: {
    name: 'házení lahváčem', archetype: 'lob', aim: 'nearest',
    anim: 'hrdina obloukem hodí plný lahváč, který se po dopadu roztříští na střepy',
    desc: 'Nuke: nejvyšší DMG, dlouhý cooldown. Sám zamíří na náhodného z několika nejbližších nepřátel; přímý zásah omračuje, střepy plošně zasáhnou okolí dopadu.',
    // Nerf na dálku („daň za bezpečí"): kratší dolet, delší CD, nižší DMG —
    // hráč s ním drží distanc bez rizika, takže nesmí konkurovat melee DPS.
    dmg: 18, cd: 4.2,
    targetRange: 170, targetPool: 4, // auto-cíl: náhodný z N nejbližších v dosahu
    hitR: 16,                        // poloměr přímého zásahu (plný DMG + stun)
    burst: { r: 52, dmg: 8 },
    shards: { r: 40, dur: 4, dmg: 3, tick: 0.5 },
    knockback: 2, // střední
    stun: { chance: 0.20, dur: 0.6 },
  },
  vajgly: {
    name: 'plivání vajglů', archetype: 'bounce', aim: 'nearest',
    anim: 'zelenožlutý vajgl vystřelený od úst hrdiny, odrážející se mezi nepřáteli',
    desc: 'Rychlopalba: nejkratší cooldown, malý DMG. Vajgl se odráží až mezi 4 nepřáteli a zpomaluje je.',
    // Nerf na dálku („daň za bezpečí") — slabší a kratší, pořád nejrychlejší.
    dmg: 7, cd: 0.55, range: 110, bounces: 3, bounceRange: 110,
    slow: { pct: 0.20, dur: 1.2 }, knockback: 0,
  },
  pivo: {
    name: 'rozlejvání piva', archetype: 'sweep', aim: 'facing',
    anim: 'pohnutí půllitrem plného piva směrem od hrdiny a jeho vylití',
    desc: 'Těžké máchnutí ve směru pohledu: široký oblouk, vysoký DMG a odhoz. Kaluž zpomaluje.',
    // Nerf (anti-AFK): s perky „dozadu"+„šířka" tvořilo neprůchodnou 360° zeď
    // s odhozem — užší oblouk, slabší odhoz, delší CD. Coverage perk zůstal.
    dmg: 23, cd: 1.7, angle: 120, range: 105, pierce: Infinity,
    puddle: { r: 38, dur: 2.5, slow: 0.20 }, knockback: 2, // střední
  },
  dym: {
    name: 'vypouštění dýmu', archetype: 'ricochet', aim: 'self',
    anim: 'obláček dýmu z vaporizéru se líně převaluje kolem hrdiny a odráží se od neviditelných stěn',
    desc: 'Obláček dýmu se převaluje v poli kolem hrdiny, odráží se od neviditelných stěn a dusí každého, kým prostoupí. Za sebou nechává zpomalující clonu.',
    // Pomalý valivý obláček (ne střela) + slow stopa (trail v GameScene
    // .updateProjectiles): část DPS nahrazuje utilita clony.
    dmg: 9, cd: 1.8, speed: 200, life: 2.4, box: 115, hitR: 13, rehit: 0.55,
    slow: 0.2, knockback: 0,
    trail: { every: 0.25, r: 26, slow: 0.25, dur: 1.6 }, // zpomalující clona za obláčkem
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
    desc: 'Rychlé facky do oblouku (až 4 cíle): KAŽDÝ zásah odráží + 25% šance na stun.',
    dmg: 24, cd: 0.68, angle: 72, range: 96, targets: 4,
    knockback: 4, // obrovský — odrazí každého zasaženého
    dmgPerLevel: 0.35, // strmější růst DMG než globál (0,25) → efektivní late-game na blízko
    stun: { chance: 0.25, dur: 0.5 },
  },
};

// ---------- Perky útoků — druhá osa vylepšování vedle „+25 % DMG" ----------
// Každý vlastněný útok nabízí při level-upu kromě DMG i perk(y) s vlastním
// malým stropem (cap). Důraz na počty: projektily/odrazy/cíle/zóny navíc.
// Efekty čte PS.Weapon přes this.perk(id) — viz weapons.js.
PS.WEAPON_PERKS = {
  bliti: [
    { id: 'davka', name: 'hustší proud', cap: 2, desc: 'Blití chrlí rychleji (kratší prodleva mezi útoky).' },
    { id: 'kuzel', name: 'širší kužel',  cap: 2, desc: 'Kužel blití je o 15° širší.' },
  ],
  chcani: [
    { id: 'pierce',  name: 'silnější proud', cap: 2, desc: 'Proud chcanek probodne o 2 nepřátele víc.' },
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
    { id: 'sirka',  name: 'širší oblouk',    cap: 2, desc: 'Oblouk máchnutí je o 15° širší.' },
  ],
  dym: [
    { id: 'sipka',  name: 'další obláček', cap: 2, desc: 'Vypustí o 1 obláček dýmu víc (na jiný směr).' },
    { id: 'odrazy', name: 'hustší dým',  cap: 1, desc: 'Obláček vydrží dýmit o 1 s déle — víc odrazů a zásahů.' },
  ],
  panaky: [
    { id: 'panak',  name: 'další panák',    cap: 2, desc: 'Přidá 1 orbitující panák.' },
    { id: 'rotace', name: 'rychlejší oběh', cap: 1, desc: 'Panáky obíhají o 20 % rychleji.' },
  ],
  list: [
    { id: 'cile', name: 'víc plácanců',      cap: 3, desc: 'Facka zasáhne o 1 cíl víc.' },
    { id: 'stun', name: 'jistější plácnutí', cap: 1, desc: 'Šance na omráčení +10 %.' },
  ],
};

// ---------- Upgrady (list „Upgrady") — pasivky při level-upu ----------
PS.UPGRADES = [
  { id: 'odpocinek',  name: 'odpočinek',           desc: 'navýšení max HP o 30 %',                              effect: { type: 'maxHp', value: 0.30 } },
  { id: 'naslapnuto', name: 'našlápnuto',          desc: 'Všechny útoky udílí o 15 % větší damage.',             effect: { type: 'damage', value: 0.15 } },
  { id: 'rozjezd',    name: 'rozjezd',             desc: 'Všechny útoky mají zkrácený cooldown o 10 %.',        effect: { type: 'cooldown', value: 0.10 } },
  { id: 'poldove',    name: 'utíkám před poldama', desc: 'Zvýšení rychlosti pohybu hrdiny o 16 %.',             effect: { type: 'moveSpeed', value: 0.16 } },
  { id: 'pracky',     name: 'delší pracky',        desc: 'Všechny útoky mají zvětšenou zásahovou plochu a dosah o 25 %.', effect: { type: 'area', value: 0.25 } },
  { id: 'nenasyta',   name: 'nenasyta',            desc: 'Zvětšení dosahu sběru XP a powerupů (magnet) o 40 %.', effect: { type: 'magnet', value: 0.40 } },
  { id: 'kebab',      name: 'kebab v 5 ráno',      desc: 'Regenerace 1,5 HP každou sekundu.',                   effect: { type: 'regen', value: 1.5 } },
  { id: 'krusta',     name: 'poblitá mikina',      desc: 'Mikina tak nasáklá pivem a blitkama, že ztvrdla na krunýř. Pohlcuje 8 % příchozího poškození.', effect: { type: 'armor', value: 0.08 } },
  { id: 'beef',       name: 'beef s headlinerem',  desc: 'Osobní spor s každou hvězdou večera. +25 % poškození bossům.', effect: { type: 'bossDmg', value: 0.25 } },
  { id: 'ruleta',     name: 'panáková ruleta',     desc: 'Co panák, to risk. +7 % šance na kritický zásah za dvojnásobné poškození.', effect: { type: 'crit', value: 0.07 } },
  { id: 'smelina',    name: 'šmelina u baru',      desc: 'Vrací cizí kelímky na baru. +8 % XP ze všech gemů.', effect: { type: 'xpGain', value: 0.08 } },
  { id: 'mrchozrout', name: 'dokalování cizích piv', desc: 'Doráží nedopité drinky po padlých. 8% šance na +1 HP za každý kill.', effect: { type: 'killHeal', value: 0.08 } },
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
  { id: 'gufrau',    name: 'gufrau',    vis: 'vtipně vypadající hipsteři, vypadají jako ta kapela Gufrau', color: 0x4ecdc4, strength: 1, speedMult: 1.0 },
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
    attackName: 'plive zuby',                 mechanic: 'projectiles', mech: 'vějíř vyplivnutých zubů, damage jen při přímém zásahu' },
  { id: 'rohony', name: 'Rohony',         strength: 10, vis: 'divná postava s tetováním na obličeji',   color: 0xb44cff,
    attackName: 'vysílá negativní zvukové vlny', mechanic: 'pushwave',  mech: 'trychtýř odhazuje hrdinu, nedává damage' },
  { id: 'churaq', name: 'Churaq Sputnik', strength: 15, vis: 'inspirováno rapperem Churaq Sputnik',     color: 0xff9100,
    attackName: 'útok baseballovou holí',     mechanic: 'meleeswing',  mech: 'velký telegrafovaný švih pálkou do oblouku — odhodí hrdinu a dá střední damage' },
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

  // Nepřítel síly s. HP zvednuto (9×): ani síla 1 neumírá na jeden zásah
  // slabých útoků → early game vyžaduje snahu, ne jen sběr XP.
  enemyHp:   (s) => Math.round(9 * Math.pow(s, 1.3)),
  // DMG: do síly 6 jako dřív (early OK dle testerů), pak VÝRAZNĚ pomalejší
  // růst (+0,55/síla místo +1,5) — late game smrt přichází z TLAKU davu,
  // ne z toho, že 3 doteky zabijí (s20: 20 dmg místo 33; s30: 25 místo 48).
  enemyDmg:  (s) => Math.round(3 + 1.5 * Math.min(s, 6) + 0.55 * Math.max(0, s - 6)),
  enemySpeed:(s) => (55 + Math.min(60, s * 4)) * 0.7, // base ×0,7; násobí se speedMult typu (spawner)

  // Boss síly B — bossové mají být VÝZVA, ne heal pauza (zpětná vazba testerů)
  bossHp:  (B) => 150 * B,
  bossDmg: (B) => Math.round(10 + 2.6 * B),

  // Aréna se během souboje POMALU stahuje (časový tlak — fight nejde
  // beztrestně natahovat a healovat se): po `arenaShrinkDelay` s od začátku
  // se poloměr lineárně zmenší z `arenaRadius` na `arenaMinRadius` během
  // `arenaShrinkDur` s, pak drží.
  arenaMinRadius: 260,
  arenaShrinkDelay: 10,
  arenaShrinkDur: 45,

  // Boss schedule — n-tý boss má sílu 5n (zachová cyklus skinů a škálování).
  // Dřív vázáno na tier (boss à ~7 min od ~2:50); teď samostatný časový plán.
  bossFirst:    150, // s — první boss (~2:30)
  bossInterval: 270, // s — rozestup mezi bossy (~4:30)

  // Časová osa obtížnosti: nový tier každých ~80 s — plynulý růst síly
  // nepřátel bez zlomů.
  tierSeconds: 80,

  // XP potřebné na level N — ZÁMĚRNĚ strmé (10, 28, 56, 94…): levelování je
  // pomalejší, hráč za run NEMÁ šanci vymaxovat vše → volba karet je
  // strategická. Kvadratický růst => tempo levelování klesá celou hru,
  // nikdy se „nerozjede" do nesmrtelnosti (VS styl).
  xpForLevel: (n) => 10 + 13 * (n - 1) + 5 * (n - 1) * (n - 1),

  // ---------- Spawn — NEROVNOMĚRNÝ proud (VS styl) ----------
  // Slabší STÁLÝ proud `spawnRate` (nepřátel/s) + krátké VLNKY (`surge`) +
  // občas velká telegrafovaná HORDA (`horde`). Cíl: hráč se snaží od první
  // minuty; většina runů končí ~13.–18. min, 18–23 velmi dobré, 23+ insane.
  // Tlak (rate × HP nepřátel) roste rychleji než jakýkoli DPS hráče → smrt
  // je nakonec nevyhnutelná (žádné nesmrtelné kombo). Ladí se v
  // tools/spawn-curve.js (čte tyhle konstanty přímo).
  spawnRate: (t) => { const m = t / 60; return 1.05 + 0.22 * m + 0.012 * m * m; },
  surge: { period: 50, dur: 7, mult: 2.4 },                          // vlnka ~à 50 s, ×2,4 na 7 s
  horde: { period: 160, size: (tier) => 14 + Math.round(tier * 2.8) }, // horda ~à 2,7 min

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

  // Mapa a výkon — velká mapa, ať hrdina prakticky nedojde na okraj (5× původní
  // 8000). Hustota nepřátel se NEMĚNÍ: spawn je relativní k hrdinovi (viz
  // Spawner.ringPosition / recycleFar), ne k velikosti mapy. Podlaha se dláždí
  // nekonečně (tileSprite se scrollFactor 0), takže velikost neovlivní výkon.
  mapSize: 40000,
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
  // Spawn vzdálenost od HRDINY (NE od mapy) — drží se relativně k němu, takže se
  // ani na velké mapě nikdy neobjeví přes půl mapy. ~obrazovku daleko: pár sekund
  // cesty, HUD šipka k ní vede.
  rundaSpawnMin: 1100,
  rundaSpawnMax: 1700,
  rundaKeys:     { min: 2, max: 4 }, // časově omezené klíče (náhodné, bez duplicit)
  rundaUpgrades: { min: 1, max: 3 }, // stálé upgrady: vylepšení vlastněných útoků + pasivky
};
