# Party Survivors

Klon hry **Vampire Survivors** v párty/neon stylu pro web **6&2 Games**. Hra běží **výhradně v prohlížeči** — nemá žádný build krok, žádné `package.json`, žádné `node_modules`. Zpřístupňuje se pouze přes webovou stránku `partysurvivors.html` (nalinkováno z homepage webu, `index.html`).

## O hře (logika Vampire Survivors)

- **Cíl: přežít co nejdéle.** Jediný výsledek runu je čas přežití; rekord se ukládá do `localStorage`.
- Hráč ovládá **pouze pohyb** (WASD/šipky). Útoky se spouštějí **automaticky** na cooldown — míří na nejbližšího nepřítele, případně do směru pohybu.
- Nepřátelé se valí v houstnoucích vlnách ze všech stran, při kontaktu zraňují hráče. Z mrtvol padají **XP gemy**, jejich sběrem (magnet) hráč leveluje.
- **Level-up** pozastaví hru a nabídne 3 karty: nový útok (max 6 útoků) / vylepšení vlastněného útoku (+25 % DMG, max lvl 8) / pasivka (max 5 úrovní). Výběr je **vážený jako ve VS**: vylepšení už vlastněných útoků mají vyšší pravděpodobnost výskytu — v prvních levelech výrazně (rozvíjení startovního útoku), s rostoucím levelem se váhy vyrovnávají (`PS.BALANCE.weaponUpWeight`). XP křivka je **záměrně pomalá** (VS tempo, `PS.BALANCE.xpForLevel`) — kompenzováno mírnějšími HP/DMG nepřátel a pomalejším nástupem tierů.
- Obtížnost roste **nekonečnou progresí tierů** (nový tier každých ~85 s) a pravidelnými **bossy**. Balanc cílí na to, aby hra byla ve **~13. minutě už velmi obtížná** (jako originál VS) — smrt je nevyhnutelná, jde o čas.
- **Runda panclů** (à la Treasure ve VS): velmi vzácný drop — průměrně **1 za ~10 minut** (`rundaInterval*`). Spawne se za okrajem obrazovky a **zlatá šipka na okraji HUD** vede hrdinu k ní; zůstává na mapě, dokud ji nesebere (max 1 zároveň). Obsahuje **2–4 náhodné klíče** (bez duplicit) + **1–3 stálé upgrady** (vylepšení vlastněných útoků / pasivky — žádné nové útoky, respektuje max levely). Sebrání pauzne hru a `RundaScene` postupně odhalí odměny.
- **Boss aréna („ring")**: při příchodu bosse se běžní nepřátelé seběhnou na kruh kolem hrdiny a utvoří **neprostupnou, nezranitelnou zeď** — souboj je 1v1 (jen vyvolanci Haadese bojují uvnitř). Hrdina ring nemůže prorazit (geometrický clamp), na jeho okraji dostává normální kontaktní damage. Po dobu souboje **stojí spawn vln, powerupů i časomíra tierů**; smrtí bosse se ring rozpustí a dav pokračuje v útoku.
- Průběh runu: výběr hrdiny → kiting hord + sběr XP → level-upy a build → bossové každých 5 tierů → smrt → Game Over s časem a rekordem.

## Technologie

| Co | Čím |
|---|---|
| Engine | **Phaser 3.87** (arcade physics) přes **CDN** (`jsdelivr`) |
| Jazyk | čistý **JavaScript (ES6+)** — žádný TypeScript, žádný framework, žádný bundler |
| Moduly | **žádné ES moduly** — obyčejné `<script>` tagy v pevném pořadí (funguje i z `file://`) |
| Grafika | **100% procedurální** — vše kreslí `BootScene` přes `Phaser.Graphics → generateTexture()`; v repu nejsou žádné obrázky/assety |
| Zvuk | **syntetické SFX přes WebAudio** (`js/audio.js`) — žádné audio soubory |
| Font | Press Start 2P (Google Fonts) — retro styl celého webu |
| Persistence | `localStorage`: `ps_keys` (klávesy), `ps_best` (rekord), `ps_muted` (mute) |
| Platforma | jen **PC + klávesnice** (přemapovatelné klávesy), rozlišení 1280×720 se `Scale.FIT` |

## Spuštění

Žádná instalace. Buď otevřít `partysurvivors.html` přímo, nebo (doporučeno):

```
python -m http.server   # v kořeni webu
→ http://localhost:8000/games/party-survivors/partysurvivors.html
```

Potřeba internet kvůli CDN (Phaser) a Google Fonts — jinak nic.

## Architektura

```
party-survivors/
  partysurvivors.html      kostra stránky + <script> tagy (POŘADÍ JE KRITICKÉ, viz níže)
  js/
    data.js                ⭐ jediný zdroj pravdy: všechna herní data + PS.BALANCE
    main.js                Phaser config, čekání na font, start hry
    ui.js                  PS.Keys (správa kláves) + PS.UI (sdílené text/neon helpery)
    audio.js               PS.Audio — WebAudio syntéza SFX
    systems/
      weapons.js           PS.Weapon — 9 archetypů útoků (cone/beam/zone/lob/homing/sweep/aura/orbit/slap)
      spawner.js           PS.Spawner — director: tiery, vlny, bossové
    scenes/
      BootScene.js         generování všech textur → Menu
      MenuScene.js         START / VYSVĚTLIVKY / NASTAVENÍ, rekord
      HelpScene.js         pravidla
      SettingsScene.js     přemapování kláves (localStorage)
      HeroSelectScene.js   mřížka 9 hrdinů
      GameScene.js         ⭐ herní jádro: pohyb, kolize, damage pipeline, XP, level-up pool
      HUDScene.js          overlay: čas, HP/XP bar, ikony zbraní
      LevelUpScene.js      pauza + 3 karty
      RundaScene.js        reveal odměn z Rundy panclů
      GameOverScene.js     čas + rekord
  plan.txt                 původní plán vývoje (fáze, tabulky parametrů)
  logika.xlsx → data.js    herní data vznikla přepisem z tabulky (xlsx už není ve složce)
```

## Styl programování — dodržovat při úpravách

1. **Globální namespace `window.PS`** — každý soubor začíná `window.PS = window.PS || {};` a věší na něj svoje věci (`PS.HEROES`, `PS.Weapon`, `PS.Audio`…). Scény se věší na `window` (`window.GameScene = class …`) a **samy se registrují** do `PS.scenes` — `main.js` z toho staví hru.
2. **Pořadí `<script>` tagů v `partysurvivors.html` je závazné** (data → ui → audio → systems → scenes → main). Nový soubor = přidat tag na správné místo, jinak nic nefunguje.
3. **Data-driven design**: čísla (DMG, cooldowny, dosahy, HP křivky, časování tierů) patří do `js/data.js` (`PS.ATTACKS`, `PS.BALANCE`…), ne natvrdo do logiky. Balanc se ladí výhradně tam.
4. **Komentáře a UI texty česky** (včetně diakritiky). Hlavička každého souboru = blokový komentář `// ===` s popisem role souboru.
5. **Žádné externí assety.** Nová grafika = další `make*()` metoda v `BootScene` (generateTexture). Nový zvuk = další metoda v `PS.Audio` (oscilátory).
6. **Výkon je first-class**: object pooling přes Phaser groupy s `maxSize` (enemies 400, gems 600, projectiles 120…), strop ~300 živých nepřátel (přebytek → silnější jedinci), slučování XP gemů, pool plovoucích čísel poškození, throttle hit-zvuků. Cíl: 60 FPS při 300 nepřátelích. Při recyklaci pooled objektů **nutno resetovat stavové efekty** (slow/DoT/stun — viz `spawner.js`).
7. **Defenzivní `localStorage`** — vždy v `try/catch` (private mode).
8. **Damage pipeline centrálně**: zbraně počítají jen vlastní base DMG, globální multiplikátory (dmgMult, krit, buffy) aplikuje `GameScene.dealDamage()`. Nový útok = nový archetyp v `PS.Weapon` (`init_*`/`tick_*` dle `archetype` v datech).

## Herní obsah (definovaný v `data.js`)

- **9 hrdinů** — každý má unikátní startovní útok + pasivku (Rashid/blití, Poskok/chcaní, Don G/tagování, Kaar/lahváč, Fjodor Ket/vajgly, eXtreme/pivo, fadadevada/dým, Zložík/panáky, Sajmič Uraka/list).
- **9 archetypů útoků** — každý má unikátní profil ve stylu VS (viz komentář u `PS.ATTACKS`):
  - **míření** (`aim`): na nejbližšího nepřítele (chcaní, vajgly, list) / kam je hrdina otočený (blití, pivo, lahvác) / pevný vzor kolem hrdiny (tagování, dým, panáky)
  - **DMG/CD profil**: nuke s dlouhým CD (lahvác 34/3,2 s) až rychlopalba (vajgly 8/0,5 s); každý útok má jiný base DMG
  - **multi-target**: pierce (chcaní), odrazy mezi nepřáteli (vajgly), neomezené AoE (blití, pivo, dým), limit cílů (list)
  - **control**: knockback síly 0–4 (bossové odolávají), stun (list, lahvác), slow (vajgly, dým, kaluže), DoT (blití)
- **7 pasivních upgradů** (max HP, DMG, CD, rychlost, plocha, magnet, regen).
- **7 powerupů („klíčky")** vzácně na mapě: heal, freeze, speed, damage, magnet, nesmrtelnost, čistka.
- **Runda panclů** — vzácný treasure (~1/10 min): 2–4 klíče + 1–3 stálé upgrady najednou, navigace zlatou šipkou v HUD (`GameScene.spawnRunda`, `RundaScene`, šipka v `HUDScene`).
- **5 typů nepřátel** v nekonečné tier progresi: tier *n* → typ `(n−1) % 5`, level `⌊(n−1)/5⌋+1` (gufrau → kravaťáci → pikaři → rodiče → policisté → gufrau lvl 2 → …). Každý typ má **vlastní rychlost** (`speedMult` v `PS.ENEMIES`): pikaři 1,25× (nejrychlejší) > policisté 1,1× > gufrau 1,0× > kravaťáci 0,9× > rodiče 0,85×. Strop ~101 px/s je hluboko pod rychlostí hrdiny (126 px/s) — **hrdina musí vždy zůstat nejrychlejší**.
- **5 bossů** s vlastními mechanikami (projektily, pushwave, melee swing, summoner, hypnóza), spawn při tieru `síla − 2`, cyklus donekonečna (+25 síly za cyklus). Každý boss fight probíhá v **aréně z ringu nepřátel** (`GameScene.startBossFight`, poloměr `PS.BALANCE.arenaRadius`); nepřátelé ve zdi mají flag `ringWall` — jsou nezranitelní a ignorují je všechny prostorové dotazy zbraní.

## Ovládání

- Pohyb: **WASD** (přemapovatelné v Nastavení) + **šipky** vždy jako záloha
- Pauza: **P** · Mute: **M** · Menu/výběry: klávesnice i myš

## Známé jemnosti (gotchas)

- **Globální tempo hry je ×0,7**: všechny rychlosti (hrdina 126 px/s, nepřátelé, projektily, knockbacky) **i vzdálenosti** (dosahy útoků, spawn prstence, magnet, poloměr boss arény) jsou škálované koeficientem 0,7 — časy (cooldowny, tiky, trvání) zůstaly. Hra je tím v časové doméně identická, jen pomalejší na obrazovce. **Při ladění vždy škáluj rychlost a vzdálenost spolu**, jinak se rozbije balanc (např. delší dosah + stejná rychlost nepřátel = víc času v kill zóně). Neškálují se: velikosti sprajtů/hitboxů, `arenaSlotGap`, kontaktní paddingy (+14/+16) v prostorových dotazech.

- `main.js` čeká na načtení fontu se **vzorkem české diakritiky** — canvas text sám o sobě nevynutí stažení latin-ext subsetu. Při změnách načítání fontů tohle zachovat.
- Spawn nepřátel probíhá v prstenci za okrajem kamery **s biasem do směru pohybu** — před hráčem nelze utíkat donekonečna; příliš vzdálení nepřátelé se teleportují zpět k okraji.
- Hra startuje přes guard `window.__psGame` (ochrana proti dvojí inicializaci).
- `heroId` se předává do `GameScene` přes `init(data)` s fallbackem na Phaser `registry`.
