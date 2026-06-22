# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Konvence repa: kód, komentáře i UI texty jsou **česky** (s plnou diakritikou). Drž se toho i v nových souborech.

## Co to je

**6&2 Games** (`6a2games.cz`) — web s retro arkádovými hrami, jedna hra = jedna složka v `games/`. **Žádný build krok pro web ani žádná CI**: hry běží přímo v prohlížeči a GitHub Pages servíruje repo **přímo z větve `main`** (doména přes `CNAME`), takže **deploy = `git push` na `main`**. Jediné build/CLI kroky jsou pomocné (komprese hudby, leaderboard worker) — viz níže.

Orientačně: `index.html` = rozcestník (+ `menu-ambient.js` = syntetizovaný ambient zvuk menu), `games/party-survivors/` = hlavní hra (Phaser 3, vlastní detailní `README.md`), `games/pong/` = menší hra (celá v jednom `index.html`).

## Zdroje pravdy (a jak je držet v synchronu)

Repo má kvalitní README; aby se s tímhle souborem nerozjely, má každá oblast **jediného vlastníka** a CLAUDE.md jeho obsah **needuplikuje — odkazuje**.

| Oblast | Kanonický zdroj |
|---|---|
| Vize, zásady vývoje, „přidání nové hry" | `README.md` (kořen) |
| Vnitřek Party Survivors (architektura, **balanc-mechaniky a čísla**, gotchas) | `games/party-survivors/README.md` |
| Nasazení leaderboard backendu | `games/party-survivors/leaderboard-server/README.md` |
| Operační pokyny pro agenta: příkazy, deploy webu, cross-file vazby | **tenhle soubor** |
| **Pracovní preference/metoda uživatele** (jak balancovat, jak s ním pracovat) | **tenhle soubor** |

**Pravidlo při významné změně:** uprav nejdřív vlastníka oblasti. Dotkne-li se změna i protějšku (nový build skript, změna deploye/struktury, nová celorepoová konvence), promítni ji i tam — ať nevzniknou dvě verze pravdy. Jako pojistka při editaci `CLAUDE.md` nebo kteréhokoli `README.md` to připomene lokální Claude Code hook (`.claude/settings.local.json`, PostToolUse) — ten je ale jen osobní (složka `.claude/` je v `.gitignore`); závazný pro všechny je tenhle commitnutý kontrakt, ne hook.

## Operační pravidla pro celý web (co README nepokrývá)

> Designové zásady (žádný build, minimální závislosti, hratelnost, retro) vlastní kořenový `README.md`. Tady jen to, co z nich plyne operačně:

- **Žádný bundler ani ES moduly.** Čisté HTML/CSS/JS přes `<script>` tagy, musí jet i z `file://`. Phaser 3 jen přes CDN (jsdelivr).
- **Žádné binární assety v repu** (obrázky/zvuky): grafika se kreslí proceduálně do Canvas textur, SFX se syntetizují přes WebAudio. Výjimka jsou **komprimované MP3** hudby (mastery zůstávají lokálně, `.gitignore`).
- **Žádná hudba na pozadí webu.** Úvodní rozcestník (`index.html`) má jen jemný **syntetizovaný ambient zvuk** (`menu-ambient.js`, WebAudio, ne hudba — tlumené „bzučení", zesílí při hoveru na položku menu, spustí se po 1. gestu). Jediná hudba je Party Survivors in-game (`js/music.js` = `PS.Music`, jen v `GameScene`); Pong má vlastní syntetizované SFX. (Dřívější sdílená hub hudba menu byla zrušena.)
- **Mobil na šířku je first-class** (dotyk, fullscreen, výzva k otočení). Nový UI prvek řeš i pro touch.

## Lokální spuštění

Stačí otevřít HTML přímo, nebo (kvůli relativním cestám a CDN doporučeno) statický server z kořene:

```
python -m http.server
# → http://localhost:8000/index.html
# → http://localhost:8000/games/party-survivors/partysurvivors.html
```

## Party Survivors (`games/party-survivors/`)

Klon Vampire Survivors v Phaser 3 a zdaleka nejsložitější část repa. **Kanonická dokumentace je `games/party-survivors/README.md`** (architektura, balanc, kompletní gotchas) — při jakékoli netriviální práci ji čti, neřiď se jen tímhle výtahem. Níže jen pár min, které kousnou i u malé editace, a věci nezdokumentované jinde:

- **Pořadí `<script>` tagů v `partysurvivors.html` je závazné** (data → ui → audio → music → systems → scenes → main) — žádné ES moduly. Nový soubor = tag na správné místo, jinak nic nejede.
- **Vše visí na `window.PS`** (každý soubor začíná `window.PS = window.PS || {};`); scény se na `window` samy registrují do `PS.scenes` a `main.js` z toho staví hru.
- **Balanc je data-driven:** všechna čísla jdou do `js/data.js` (`PS.ATTACKS`, `PS.BALANCE`, `PS.HEROES`, `PS.ENEMIES`, `PS.WEAPON_PERKS`), ne natvrdo do logiky.
- **Gotcha — globální tempo ×0,7:** rychlosti *i vzdálenosti* jsou škálované 0,7 (časy ne). Lad rychlost a vzdálenost **spolu**, jinak se rozbije balanc.

### Pomocné Node skripty (`tools/`, spustitelné z kořene repa)

Všechny čtou herní data přímo z `js/data.js` (vm sandbox), takže jsou vždy v synchronu.

```bash
node games/party-survivors/tools/balance-sim.js    # headless DPS simulátor útoků
node games/party-survivors/tools/spawn-curve.js     # křivka tlaku spawnu v čase
node games/party-survivors/tools/build-wording.js   # export VŠECH herních textů → wording.xlsx (ruční úpravy, pak read-wording.js zpět)
node games/party-survivors/tools/build-music.js     # komprese hudby (potřebuje ffmpeg v PATH); dvojklik tools/compress-music.bat
```

`build-music.js` zkomprimuje mastery z `music/` → `music/compressed/*.mp3` (128k) a **autogeneruje `js/playlist.js`** (`PS.MUSIC`) — ten needituj ručně. Přidání tracku: master s číselným prefixem (`05_nazev.wav`) do `music/` + spustit skript.

### Balancování útoků — jak to chce uživatel

Uživatel ladí podle **pocitu ze hry**; cíl je **užší rozptyl** mezi 9 útoky, ne plochý. Dohodnutá metoda (drž se jí):

- **Slabé útoky vybuff** na konkurenceschopné, ale **ne nejsilnější**; silné jen jemně srovnej, **žádné velké nerfy** toho, co už je dobré.
- **Metrika = efektivní DPS na roj**, přičemž **slow/stun/knockback se počítají jako utility bonus** (control-heavy útoky smí mít ~20–35 % nižší surové DPS). Lad útoky **samostatně** — ignoruj pasivky hrdinů, protože jakýkoli útok si může vzít kdokoli přes level-up.
- Útoky **na dálku** mají mít v simu **záměrně ~25–35 % nižší skóre než melee** (sim neumí změřit bezpečí distance).
- **Pravidlo inverzní pasivky:** silný primární útok hrdiny ⇒ slabá startovní pasivka a naopak (hodnoty v `PS.HEROES`).
- **Anti-AFK:** nepřátelé vyšších úrovní odolávají odhozu (knockbacku) → žádná builda neudrží perimetr donekonečna.
- Všechny gameplay časy běží proti **`GameScene.gameTime`** (akumulovaná delta), **ne `this.time.now`** (ten po pauze skočí dopředu a rozbíjí buffy z klíčů).
- **Cílová sim-pásma (preference uživatele):** melee/self ~90–125, ranged ~55–85, control-heavy ~45.
- **Cílovou délku runu** drží `js/data.js` (a popisuje PS README) — neduplikuj sem konkrétní číslo, ať nevznikne třetí verze pravdy.

Postup: uprav čísla v `js/data.js` → `node tools/balance-sim.js` → iteruj (měří effDPS ve 3 scénářích: hustý roj / řídký proud / slabí nepřátelé). Aktuální hodnoty a mechaniky vlastní PS README + `data.js`.

## Leaderboard backend (`games/party-survivors/leaderboard-server/`)

Cloudflare Worker + D1 (SQLite), globální TOP 10. **Jediná část repa s `package.json`/`node_modules`.** Frontend volá z `js/leaderboard.js` (`PS.LB.API`).

```bash
cd games/party-survivors/leaderboard-server
npm run deploy    # wrangler deploy
npm run tail      # wrangler tail (živé logy)
```

Detaily nasazení (D1 create, schema, `LB_SECRET`) jsou v `leaderboard-server/README.md`. Pozn.: mapa `HERO_NAMES` v `src/worker.js` musí odpovídat `PS.HEROES` v `js/data.js`. `LB_SECRET` se nastavuje jen přes `wrangler secret put`, není v repu.

Žebříček je **globální online** TOP 10 nejdelších časů (ne localStorage), živý od 9. 6. 2026 na free tieru; klient je offline-safe. Živá adresa Workeru `https://party-survivors-lb.viktor-janis.workers.dev` (= `PS.LB.API` v `js/leaderboard.js`). Účtová/provozní fakta (Cloudflare účet, D1 region) jsou v `CLAUDE.local.md` (negitováno, lokální).
