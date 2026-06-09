-- Party Survivors — schéma D1 databáze žebříčku
-- Spustí se jednou při nasazení (viz README.md).

CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  time       REAL    NOT NULL,   -- čas přežití v sekundách
  hero_id    TEXT    NOT NULL,   -- id hrdiny (mapuje se na jméno ve Workeru)
  ip_hash    TEXT,               -- hash IP (rate limit, nikdy ne čistá IP)
  created_at INTEGER NOT NULL    -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_scores_time ON scores (time DESC);
CREATE INDEX IF NOT EXISTS idx_scores_ip   ON scores (ip_hash, created_at);

-- Jednorázové tokeny — brání odeslání stejného runu vícekrát.
CREATE TABLE IF NOT EXISTS used_tokens (
  nonce      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
