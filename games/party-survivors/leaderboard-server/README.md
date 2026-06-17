# Party Survivors — globální žebříček (Cloudflare Worker + D1)

> **Kanonický zdroj pro nasazení backendu.** Kořenový [`CLAUDE.md`](../../../CLAUDE.md) odkazuje sem; měníš-li deploy postup nebo bindings, zkontroluj soulad i tam.

Malé backendové API pro online TOP 10 časů. Běží zdarma na Cloudflare Workers,
data v Cloudflare D1 (SQLite). Frontend (hra na GitHub Pages) volá tři endpointy:

- `GET  /leaderboard` — vrátí TOP 10.
- `POST /start` — na začátku hry vydá podepsaný anti-cheat token.
- `POST /score` — odešle dosažený čas (`{ name, time, heroId, token }`).

## Nasazení (jednorázově)

V této složce (`leaderboard-server/`):

```bash
# 1) přihlášení k Cloudflare (otevře prohlížeč)
npx wrangler login

# 2) vytvoření databáze — z výstupu zkopíruj "database_id" do wrangler.toml
npx wrangler d1 create party-survivors-lb

# 3) vytvoření tabulek
npx wrangler d1 execute party-survivors-lb --remote --file schema.sql

# 4) nastavení tajného klíče (zadej dlouhý náhodný řetězec)
npx wrangler secret put LB_SECRET

# 5) nasazení — vypíše veřejnou adresu *.workers.dev
npx wrangler deploy
```

Adresu `*.workers.dev` z kroku 5 vlož do `js/leaderboard.js` (konstanta `PS.LB.API`).

## Poznámky

- `LB_SECRET` se nastavuje jen přes `wrangler secret put`, **není v repozitáři**.
- Anti-cheat: HMAC podpis tokenu, kontrola reálně uplynulého času, jednorázové
  tokeny, rate limiting podle hashe IP, bílá listina hrdinů, strop času.
  Hra v prohlížeči nejde zabezpečit 100 % — tohle ztěžuje běžné podvody.
- Mapa `HERO_NAMES` ve `src/worker.js` musí odpovídat `js/data.js` (`PS.HEROES`).
