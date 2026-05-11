const OZ_TO_GRAM = 31.1034768;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xlmbpohjlcwjubgiyjaw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbWJwb2hqbGN3anViZ2l5amF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjIyODksImV4cCI6MjA5MzYzODI4OX0.BXbY5_stirCdFLuXleBHu1VouYm1cguVZd3bjkygHlo';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function fetchSpotPrices() {
  const [goldRes, silverRes, fxRes] = await Promise.all([
    fetchJson('https://api.gold-api.com/price/XAU'),
    fetchJson('https://api.gold-api.com/price/XAG'),
    fetchJson('https://api.frankfurter.app/latest?base=USD&symbols=EUR'),
  ]);
  const usdToEur = fxRes.rates?.EUR;
  if (!goldRes.price || !silverRes.price || !usdToEur) throw new Error('Ongeldige goud/zilver response');
  return {
    gold_eur_per_gram: (goldRes.price * usdToEur) / OZ_TO_GRAM,
    silver_eur_per_ounce: silverRes.price * usdToEur,
  };
}

async function fetchCryptoPrices() {
  const res = await fetchJson(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=eur'
  );
  if (!res.bitcoin?.eur || !res.ethereum?.eur || !res['pax-gold']?.eur) {
    throw new Error('Ongeldige crypto response');
  }
  return {
    btc_eur: res.bitcoin.eur,
    eth_eur: res.ethereum.eur,
    paxg_eur: res['pax-gold'].eur,
  };
}

async function fetchMeesmanPrice() {
  const html = await fetchText('https://www.meesman.nl/onze-fondsen/aandelen-wereldwijd-totaal/');
  const match = html.match(/Laatste koers[\s\S]{0,240}?(?:€|&#x20AC;|&euro;)\s*([0-9.,]+)[\s\S]{0,120}?\((\d{2}-\d{2}-\d{4})\)/i);
  if (!match) throw new Error('Meesman koers niet gevonden');
  const nav = +match[1].replace(/\./g, '').replace(',', '.');
  const [dd, mm, yyyy] = match[2].split('-');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    nav,
  };
}

async function upsertRows(rows) {
  const endpoint = `${SUPABASE_URL}/rest/v1/asset_price_history?on_conflict=asset,date`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };
  let res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("Could not find the 'source' column")) {
      const compatible = rows.map(({ source, updated_at, ...row }) => row);
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(compatible),
      });
    } else {
      throw new Error(`Supabase upsert failed: ${res.status} ${body}`);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase upsert failed: ${res.status} ${body}`);
  }
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [metals, crypto, meesman] = await Promise.allSettled([
      fetchSpotPrices(),
      fetchCryptoPrices(),
      fetchMeesmanPrice(),
    ]);
    const date = todayIso();
    const now = new Date().toISOString();
    const rows = [];

    if (metals.status === 'fulfilled') {
      rows.push(
        { asset: 'gold_eur_per_gram', date, nav: +metals.value.gold_eur_per_gram.toFixed(8), source: 'gold-api.com + frankfurter.app', updated_at: now },
        { asset: 'silver_eur_per_ounce', date, nav: +metals.value.silver_eur_per_ounce.toFixed(8), source: 'gold-api.com + frankfurter.app', updated_at: now },
      );
    }
    if (crypto.status === 'fulfilled') {
      rows.push(
        { asset: 'btc_eur', date, nav: +crypto.value.btc_eur.toFixed(8), source: 'coingecko', updated_at: now },
        { asset: 'eth_eur', date, nav: +crypto.value.eth_eur.toFixed(8), source: 'coingecko', updated_at: now },
        { asset: 'paxg_eur', date, nav: +crypto.value.paxg_eur.toFixed(8), source: 'coingecko', updated_at: now },
      );
    }
    if (meesman.status === 'fulfilled') {
      rows.push({
        asset: 'meesman_aandelen_wereldwijd_totaal',
        date: meesman.value.date,
        nav: +meesman.value.nav.toFixed(8),
        source: 'meesman.nl',
        updated_at: now,
      });
    }

    if (!rows.length) {
      const errors = [metals, crypto, meesman]
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || String(r.reason));
      return res.status(502).json({ ok: false, errors });
    }

    await upsertRows(rows);
    return res.status(200).json({
      ok: true,
      saved: rows.length,
      date,
      assets: rows.map(r => r.asset),
      warnings: [metals, crypto, meesman]
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || String(r.reason)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};
