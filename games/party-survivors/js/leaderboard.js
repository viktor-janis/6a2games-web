// ============================================================
// PS.LB — klient globálního žebříčku (Cloudflare Worker + D1)
// Vše je „offline-safe": při výpadku sítě se tiše přeskočí a hra běží dál.
// ============================================================
window.PS = window.PS || {};

PS.LB = {
  // Adresa našeho Workeru na Cloudflare. Vyplní se po nasazení
  // (`wrangler deploy` vypíše adresu *.workers.dev). Dokud je tu PLACEHOLDER,
  // je žebříček vypnutý a hra se chová jako dřív.
  API: 'https://party-survivors-lb.viktor-janis.workers.dev',

  _token: null,

  enabled() { return !!this.API && this.API.indexOf('PLACEHOLDER') === -1; },

  // Začátek hry → vyžádat podepsaný session token (anti-cheat).
  async startRun() {
    this._token = null;
    if (!this.enabled()) return;
    try {
      const res = await fetch(this.API + '/start', { method: 'POST' });
      if (res.ok) { const d = await res.json(); this._token = d.token || null; }
    } catch (e) { /* offline — žebříček se přeskočí */ }
  },

  // Odeslání dosaženého času. Chyby tiše ignoruje, vrací TOP 10 nebo null.
  async submit(opts) {
    if (!this.enabled() || !this._token) return null;
    const body = { time: opts.time, name: opts.name, heroId: opts.heroId, token: this._token };
    this._token = null; // token je jednorázový
    try {
      const res = await fetch(this.API + '/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const d = await res.json();
      return d.scores || null;
    } catch (e) { return null; }
  },

  // Načtení TOP 10. Vrací pole (i prázdné) nebo null při chybě/offline.
  async fetchTop() {
    if (!this.enabled()) return null;
    try {
      const res = await fetch(this.API + '/leaderboard');
      if (!res.ok) return null;
      const d = await res.json();
      return d.scores || [];
    } catch (e) { return null; }
  },
};
