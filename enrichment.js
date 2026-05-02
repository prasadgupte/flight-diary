/* enrichment.js — lazy fetch + localStorage cache for public enrichment APIs */
window.Enrichment = {
  _mem: {},

  async country(iso2) {
    if (!iso2) return null;
    const key = iso2.toUpperCase();
    if (this._mem[key]) return this._mem[key];
    const storageKey = `enr_c:${key}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() < parsed.e) {
          this._mem[key] = parsed.d;
          return parsed.d;
        }
      }
      const r = await fetch(
        `https://restcountries.com/v3.1/alpha/${key}?fields=name,capital,population,area,currencies,languages,borders,region,subregion`
      );
      if (!r.ok) return null;
      const d = await r.json();
      localStorage.setItem(storageKey, JSON.stringify({ d, e: Date.now() + 7 * 86400 * 1000 }));
      this._mem[key] = d;
      return d;
    } catch (e) {
      return null;
    }
  },
};
