# 6&2 Games

Webové arkádové hry s retro CRT estetikou. Každá hra je samostatná a běží přímo v prohlížeči bez build kroků.

## Struktura projektu

```
/
├── index.html          # Hlavní stránka s menu her
├── favicon.png
└── games/
    └── <nazev-hry>/    # Každá hra má vlastní složku
        └── index.html
```

## Zásady vývoje

- **Hratelnost na prvním místě** — hra musí být zábavná a intuitivní, bez frustrace z bugů
- **Žádný build krok** — žádný Webpack, Vite ani bundler; hry se načítají přímo v prohlížeči
- **Minimální závislosti** — pro jednoduché hry čistý HTML/CSS/JS; pro komplexní hry je Phaser 3 přes CDN přijatelný
- **Retro vibe, moderní kvalita** — CRT estetika, ale kód čistý a robustní

## Přidání nové hry

1. Vytvořit složku `games/<nazev>/`
2. Implementovat hru — jednodušší hry v jednom `index.html`, komplexnější mohou mít podsložky pro assety a JS soubory
3. Přidat odkaz do `index.html` (hlavní menu)

## Vývoj s Claude Code

V kořeni je [`CLAUDE.md`](CLAUDE.md) — operační příručka pro AI agenta (příkazy, deploy, cross-file vazby) a rozcestník po všech README v repu. **Toto README zůstává kanonickým zdrojem pro vizi a zásady vývoje.** Měníš-li je zásadně, zkontroluj, jestli změna nepatří i do `CLAUDE.md` (viz tam oddíl „Zdroje pravdy").
