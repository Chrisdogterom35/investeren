const OZ_TO_GRAM = 31.1034768;
const SUPABASE_URL = 'https://xlmbpohjlcwjubgiyjaw.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbWJwb2hqbGN3anViZ2l5amF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjIyODksImV4cCI6MjA5MzYzODI4OX0.BXbY5_stirCdFLuXleBHu1VouYm1cguVZd3bjkygHlo';

const END = new Date();
END.setUTCHours(0, 0, 0, 0);
const START = new Date(END);
START.setUTCDate(START.getUTCDate() - 730);

const SOURCES = {
  meesman_aandelen_wereldwijd_totaal: 'yahoo:0P0001IJJX.F/meesman.nl-seed',
  gold_eur_per_gram: 'yahoo:GC=F + frankfurter USD/EUR',
  silver_eur_per_ounce: 'yahoo:SI=F + frankfurter USD/EUR',
  btc_eur: 'yahoo:BTC-USD + frankfurter USD/EUR',
  eth_eur: 'yahoo:ETH-USD + frankfurter USD/EUR',
  paxg_eur: 'yahoo:PAXG-USD + frankfurter USD/EUR',
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toUnix(date) {
  return Math.floor(date.getTime() / 1000);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} for ${url}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

function weekKey(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function weeklyLast(points) {
  const map = new Map();
  for (const p of points) {
    if (!p?.date || !(p.nav > 0)) continue;
    const key = weekKey(p.date);
    const existing = map.get(key);
    if (!existing || p.date > existing.date) map.set(key, p);
  }
  return [...map.values()]
    .filter(p => p.date >= isoDate(START) && p.date <= isoDate(END))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function yahooHistoryToPoints(data, convert) {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((ts, i) => {
      const close = closes[i];
      if (!close) return null;
      const date = isoDate(new Date(ts * 1000));
      const nav = convert(close, date);
      return nav > 0 ? { date, nav: +nav.toFixed(8) } : null;
    })
    .filter(Boolean);
}

async function fetchYahoo(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${toUnix(START)}&period2=${toUnix(END)}&interval=1d`;
  return fetchJson(url);
}

async function fetchFxRates() {
  const path = `/v1/${isoDate(START)}..${isoDate(END)}?base=USD&symbols=EUR`;
  let data;
  try {
    data = await fetchJson(`https://api.frankfurter.dev${path}`);
  } catch {
    data = await fetchJson(`https://api.frankfurter.app${path}`);
  }
  return data.rates || {};
}

async function fetchMetalWeekly(fx) {
  const [gold, silver] = await Promise.all([
    fetchYahoo('GC=F'),
    fetchYahoo('SI=F'),
  ]);
  const fxForDate = date => fx[date]?.EUR;
  return {
    gold_eur_per_gram: weeklyLast(yahooHistoryToPoints(gold, (usdOz, date) => {
      const eur = fxForDate(date);
      return eur ? (usdOz * eur) / OZ_TO_GRAM : null;
    })),
    silver_eur_per_ounce: weeklyLast(yahooHistoryToPoints(silver, (usdOz, date) => {
      const eur = fxForDate(date);
      return eur ? usdOz * eur : null;
    })),
  };
}

async function fetchCryptoWeekly() {
  const fx = await fetchFxRates();
  const symbols = [
    ['btc_eur', 'BTC-USD'],
    ['eth_eur', 'ETH-USD'],
    ['paxg_eur', 'PAXG-USD'],
  ];
  const entries = await Promise.all(symbols.map(async ([asset, symbol]) => {
    const data = await fetchYahoo(symbol);
    return [asset, weeklyLast(yahooHistoryToPoints(data, (usd, date) => {
      const eur = fx[date]?.EUR;
      return eur ? usd * eur : null;
    }))];
  }));
  return Object.fromEntries(entries);
}

async function fetchMeesmanWeekly() {
  const points = [];
  try {
    const data = await fetchYahoo('0P0001IJJX.F');
    points.push(...yahooHistoryToPoints(data, nav => nav));
  } catch (e) {
    console.warn(`Meesman Yahoo history failed: ${e.message}`);
  }
  points.push(
    { date: '2026-04-10', nav: 96.0370 },
    { date: '2026-04-24', nav: 100.0430 },
    { date: '2026-05-05', nav: 101.1950 },
    { date: '2026-05-08', nav: 102.7860 },
  );
  return weeklyLast(points);
}

function toRows(allHistory) {
  const rows = [];
  for (const [asset, points] of Object.entries(allHistory)) {
    for (const p of points) {
      rows.push({
        asset,
        date: p.date,
        nav: p.nav,
        source: SOURCES[asset],
        updated_at: new Date().toISOString(),
      });
    }
  }
  return rows.sort((a, b) => a.asset.localeCompare(b.asset) || a.date.localeCompare(b.date));
}

async function upsertRows(rows) {
  const endpoint = `${SUPABASE_URL}/rest/v1/asset_price_history?on_conflict=asset,date`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    let res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const body = await res.text();
      if (body.includes("Could not find the 'source' column")) {
        const compatible = batch.map(({ source, updated_at, ...row }) => row);
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(compatible),
        });
      }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase upsert failed: ${res.status} ${res.statusText} ${body}`);
    }
  }
}

async function main() {
  console.log(`Fetching weekly history from ${isoDate(START)} to ${isoDate(END)}...`);
  const fx = await fetchFxRates();
  const [metals, crypto, meesman] = await Promise.all([
    fetchMetalWeekly(fx),
    fetchCryptoWeekly(),
    fetchMeesmanWeekly(),
  ]);
  const allHistory = {
    meesman_aandelen_wereldwijd_totaal: meesman,
    ...metals,
    ...crypto,
  };
  const rows = toRows(allHistory);
  console.table(Object.fromEntries(
    Object.entries(allHistory).map(([asset, points]) => [asset, points.length])
  ));
  await upsertRows(rows);
  console.log(`Upserted ${rows.length} weekly asset price rows into Supabase.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
