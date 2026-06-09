// ============================================================
// Party Survivors — globální žebříček (Cloudflare Worker + D1)
// ------------------------------------------------------------
// Endpointy:
//   GET  /leaderboard  -> { scores: [{ rank, name, time, hero, date }] }
//   POST /start        -> { token }            (anti-cheat session token)
//   POST /score        -> { scores: [...] }    (odeslání dosaženého času)
//
// Úložiště: D1 (SQLite, binding "DB").
// Tajný klíč: env.LB_SECRET (nastavuje se přes `wrangler secret put LB_SECRET`,
//             NIKDY není v repozitáři).
// ============================================================

// CORS: žebříček je veřejný (data jsou veřejná, zápis chrání anti-cheat token,
// ne CORS — ten stejně neochrání API před přímými dotazy mimo prohlížeč).
// Proto povolujeme jakýkoliv původ, ať to funguje i z file:// při lokálním
// testování i z ostrého webu 6a2games.cz.
const ALLOW_ORIGIN = '*';

// Mapa id hrdiny -> zobrazované jméno (musí sedět s js/data.js PS.HEROES).
// Slouží i jako bílá listina — neznámé id se odmítne (anti-cheat).
const HERO_NAMES = {
  rashid: 'Rashid', poskok: 'Poskok', dong: 'Don G', kaar: 'Kaar',
  fjodor: 'Fjodor Ket', extreme: 'eXtreme', fadadevada: 'fadadevada',
  zlozik: 'Zložík', sajmic: 'Sajmič Uraka',
};

const MAX_TIME = 4 * 60 * 60;            // 4 h strop — delší run = zjevný podvod
const TOKEN_MAX_AGE = 6 * 60 * 60 * 1000; // token platí max 6 h
const TIME_TOLERANCE = 8;                // s — povolená odchylka real vs. nárokovaný čas
const RATE_LIMIT = 30;                    // max odeslání z jedné IP za okno
const RATE_WINDOW = 10 * 60 * 1000;       // 10 min

// ---------- CORS ----------
function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// ---------- HMAC podpis (Web Crypto) ----------
async function hmac(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// porovnání odolné proti měření času
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function clientIpHash(request, secret) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  return (await hmac(secret, 'ip:' + ip)).slice(0, 32);
}

// ---------- TOP 10 ----------
async function handleLeaderboard(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT name, time, hero_id, created_at FROM scores
     ORDER BY time DESC, created_at ASC LIMIT 10`).all();
  const scores = (results || []).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    time: r.time,
    hero: HERO_NAMES[r.hero_id] || r.hero_id,
    date: r.created_at,
  }));
  return json(request, { scores });
}

// ---------- start runu: vydá podepsaný token ----------
async function handleStart(request, env) {
  const iat = Date.now();
  const nonce = crypto.randomUUID();
  const payload = `${iat}.${nonce}`;
  const sig = await hmac(env.LB_SECRET, payload);
  return json(request, { token: `${payload}.${sig}` });
}

// ---------- odeslání času ----------
async function handleScore(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json(request, { error: 'bad json' }, 400); }
  let { name, time, heroId, token } = body || {};

  // --- token ---
  if (typeof token !== 'string') return json(request, { error: 'no token' }, 400);
  const parts = token.split('.');
  if (parts.length !== 3) return json(request, { error: 'bad token' }, 400);
  const [iatStr, nonce, sig] = parts;
  const expected = await hmac(env.LB_SECRET, `${iatStr}.${nonce}`);
  if (!safeEqual(sig, expected)) return json(request, { error: 'bad signature' }, 403);
  const iat = parseInt(iatStr, 10);
  const ageMs = Date.now() - iat;
  if (!(ageMs >= 0) || ageMs > TOKEN_MAX_AGE) return json(request, { error: 'token expired' }, 403);

  // --- čas ---
  time = Number(time);
  if (!isFinite(time) || time <= 0 || time > MAX_TIME) return json(request, { error: 'bad time' }, 400);
  // reálně uplynulý čas od startu musí pokrýt nárokované přežití (anti-cheat:
  // nejde poslat obří čas hned po startu hry)
  if (ageMs / 1000 < time - TIME_TOLERANCE) return json(request, { error: 'too fast' }, 403);

  // --- hrdina (bílá listina) ---
  if (!HERO_NAMES[heroId]) return json(request, { error: 'bad hero' }, 400);

  // --- jméno: odstranit řídicí znaky, oříznout na 12 znaků ---
  name = String(name == null ? '' : name).replace(/[\x00-\x1f]/g, '').trim().slice(0, 12);
  if (!name) name = 'HRÁČ';

  const now = Date.now();
  const ipHash = await clientIpHash(request, env.LB_SECRET);

  // --- rate limit podle IP ---
  const { results: rl } = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM scores WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - RATE_WINDOW).all();
  if (rl && rl[0] && rl[0].c >= RATE_LIMIT) return json(request, { error: 'rate limit' }, 429);

  // --- jednorázový token: stejný run nejde odeslat dvakrát ---
  try {
    await env.DB.prepare('INSERT INTO used_tokens (nonce, created_at) VALUES (?, ?)')
      .bind(nonce, now).run();
  } catch (e) {
    return json(request, { error: 'token already used' }, 409);
  }

  await env.DB.prepare(
    'INSERT INTO scores (name, time, hero_id, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(name, time, heroId, ipHash, now).run();

  return handleLeaderboard(request, env);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/leaderboard') return await handleLeaderboard(request, env);
      if (request.method === 'POST' && url.pathname === '/start') return await handleStart(request, env);
      if (request.method === 'POST' && url.pathname === '/score') return await handleScore(request, env);
      return json(request, { error: 'not found' }, 404);
    } catch (e) {
      return json(request, { error: 'server error' }, 500);
    }
  },
};
