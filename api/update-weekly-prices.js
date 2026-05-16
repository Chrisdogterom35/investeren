const OZ_TO_GRAM = 31.1034768;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xlmbpohjlcwjubgiyjaw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbWJwb2hqbGN3anViZ2l5amF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjIyODksImV4cCI6MjA5MzYzODI4OX0.BXbY5_stirCdFLuXleBHu1VouYm1cguVZd3bjkygHlo';

const PARTIES = [
  { id: 'meesman', unit: 'part', priceAsset: 'meesman_aandelen_wereldwijd_totaal' },
  { id: 'finst-btc', unit: 'crypto', priceAsset: 'btc_eur' },
  { id: 'finst-eth', unit: 'crypto', priceAsset: 'eth_eur' },
  { id: 'finst-paxg', unit: 'crypto', priceAsset: 'paxg_eur' },
  { id: 'finst-top25', unit: 'bundle' },
  { id: 'goldrepublic', unit: 'mixed', isMixed: true },
  { id: 'trading212', unit: 'bundle' },
  { id: 'goud', unit: 'gram', priceAsset: 'gold_eur_per_gram' },
  { id: 'zilver', unit: 'ounce', priceAsset: 'silver_eur_per_ounce' },
  { id: 'cash', unit: 'eur' },
];

function mergeById(local = [], remote = []) {
  const map = new Map();
  local.forEach(item => item?.id && map.set(item.id, item));
  remote.forEach(item => item?.id && map.set(item.id, { ...(map.get(item.id) || {}), ...item }));
  return [...map.values()];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'user-agent': 'Mozilla/5.0 (compatible; PortfolioPriceBot/1.0)',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function silverToOz(qty, unit) {
  return unit === 'gram' ? qty / OZ_TO_GRAM : qty;
}

function goldToGram(qty, unit) {
  return unit === 'ounce' ? qty * OZ_TO_GRAM : qty;
}

function findPrice(history, asset, date) {
  const rows = history[asset] || [];
  let result = null;
  for (const row of rows) {
    if (row.date > date) break;
    result = row.nav;
  }
  return result;
}

function daysBetween(a, b) {
  const start = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function txCashAmount(t) {
  return (+t.amountEur || 0) || (+t.quantity || 0) * (+t.unitPriceEur || 0);
}

function bundleSnapshotAtDate(txs, date) {
  let balance = 0;
  let cost = 0;
  let firstActiveDate = null;
  for (const t of txs) {
    if (t.date > date) continue;
    const amount = txCashAmount(t);
    if (['inleg', 'koop', 'cashback'].includes(t.type)) {
      balance += amount;
      cost += amount;
      if (!firstActiveDate && balance > 0) firstActiveDate = t.date;
    } else if (['opname', 'verkoop'].includes(t.type)) {
      const reduction = balance > 0 ? Math.min(cost, cost * (amount / balance)) : 0;
      cost = Math.max(0, cost - reduction);
      balance = Math.max(0, balance - amount);
    } else if (t.type === 'kosten') {
      cost += +t.amountEur || 0;
    }
  }
  return { balance, cost, firstActiveDate };
}

function bundleValuations(txs) {
  let balance = 0;
  let cost = 0;
  const valuations = [];
  for (const t of txs) {
    const amount = txCashAmount(t);
    if (['inleg', 'koop', 'cashback'].includes(t.type)) {
      balance += amount;
      cost += amount;
    } else if (['opname', 'verkoop'].includes(t.type)) {
      const reduction = balance > 0 ? Math.min(cost, cost * (amount / balance)) : 0;
      cost = Math.max(0, cost - reduction);
      balance = Math.max(0, balance - amount);
    } else if (t.type === 'kosten') {
      cost += +t.amountEur || 0;
    } else if (t.type === 'waardering') {
      const value = t.valueEur != null ? +t.valueEur : (t.unitPriceEur != null ? +t.unitPriceEur : null);
      if (value != null) valuations.push({ date: t.date, value, cost });
    }
  }
  return valuations;
}

function bundleWeeklyInterpolatedValue(partyTxs, date) {
  const txs = [...partyTxs].sort((a, b) => a.date.localeCompare(b.date));
  const current = bundleSnapshotAtDate(txs, date);
  if (!txs.length || current.balance <= 0 && current.cost <= 0) return 0;
  const valuations = bundleValuations(txs);
  const prevVal = valuations.filter(v => v.date <= date).slice(-1)[0] || null;
  const nextVal = valuations.find(v => v.date > date) || null;
  if (!nextVal) {
    if (!prevVal) return current.cost;
    return Math.max(0, current.cost + (prevVal.value - prevVal.cost));
  }
  const startDate = prevVal?.date || current.firstActiveDate || txs[0].date;
  const startPnl = prevVal ? prevVal.value - prevVal.cost : 0;
  const endPnl = nextVal.value - nextVal.cost;
  const totalWeeks = Math.max(1, Math.ceil(daysBetween(startDate, nextVal.date) / 7));
  const elapsedWeeks = Math.min(totalWeeks, Math.floor(daysBetween(startDate, date) / 7));
  const fraction = elapsedWeeks / totalWeeks;
  return Math.max(0, current.cost + startPnl + (endPnl - startPnl) * fraction);
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

async function fetchMeesmanPriceFromInvesting() {
  const html = await fetchText('https://nl.investing.com/funds/nl0013689110');
  const lastMatch = html.match(/id=["']last_last["'][^>]*>\s*([0-9.,]+)\s*</i);
  const fallbackMatch = html.match(/placeholder=["']([0-9]{2,3},[0-9]{3})["'][^>]*class=["'][^"']*alertValue/i);
  const timeMatch = html.match(/pid-\d+-time["'][^>]*>\s*(\d{2})\/(\d{2})\s*</i);
  const navRaw = lastMatch?.[1] || fallbackMatch?.[1];
  const day = timeMatch?.[1];
  const month = timeMatch?.[2];
  if (!navRaw) throw new Error('Investing.com koers niet gevonden');
  const nav = +navRaw.replace(/\./g, '').replace(',', '.');
  const now = new Date();
  let date = todayIso();
  if (day && month) {
    let year = now.getUTCFullYear();
    const candidate = new Date(Date.UTC(year, +month - 1, +day));
    if (candidate.getTime() - now.getTime() > 30 * 86400000) year -= 1;
    date = `${year}-${month}-${day}`;
  }
  return { date, nav };
}

async function fetchMeesmanPriceFromMeesman() {
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

async function fetchMeesmanPrice() {
  try {
    return await fetchMeesmanPriceFromInvesting();
  } catch (investingError) {
    const fallback = await fetchMeesmanPriceFromMeesman();
    fallback.warning = `Investing.com fallback: ${investingError.message}`;
    return fallback;
  }
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

async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseFetchAll(path, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await supabaseFetch(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchPortfolioParties() {
  try {
    const rows = await supabaseFetch('portfolio?select=data&id=eq.main');
    const parties = rows?.[0]?.data?.parties;
    return Array.isArray(parties) && parties.length ? mergeById(PARTIES, parties) : PARTIES;
  } catch {
    return PARTIES;
  }
}

async function upsertPortfolioValue(row) {
  await upsertPortfolioValues([row]);
}

async function upsertPortfolioValues(rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_daily_values?on_conflict=date`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Portfolio value upsert failed: ${res.status} ${await res.text()}`);
}

function rowToTx(r) {
  return {
    id: r.id,
    party: r.party,
    type: r.type,
    date: r.date,
    quantity: r.quantity == null ? null : +r.quantity,
    unitPriceEur: r.unit_price_eur == null ? null : +r.unit_price_eur,
    feeEur: r.fee_eur == null ? null : +r.fee_eur,
    amountEur: r.amount_eur == null ? null : +r.amount_eur,
    note: r.note || null,
    metalType: r.metal_type || null,
    silverUnit: r.silver_unit || null,
    goldUnit: r.gold_unit || null,
    valueEur: r.value_eur == null ? null : +r.value_eur,
  };
}

function isIgnoredLegacyTransaction(tx) {
  return tx?.party === 'finst-btc' && String(tx.id || '').startsWith('tx_finst_btc_');
}

function priceRowsByAsset(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.asset]) acc[row.asset] = [];
    acc[row.asset].push({ date: row.date, nav: +row.nav });
    return acc;
  }, {});
}

function calculatePortfolioValue(date, transactions, history, parties = PARTIES) {
  const partyMap = Object.fromEntries(parties.map(p => [p.id, p]));
  const state = Object.fromEntries(parties.map(p => [p.id, {
    qty: 0,
    goldQty: 0,
    silverQty: 0,
    cost: 0,
    lastUnitPx: null,
    lastTotal: null,
  }]));

  transactions
    .filter(t => t.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(t => {
      const p = partyMap[t.party];
      const s = state[t.party];
      if (!p || !s) return;
      if (t.feeEur) s.cost += +t.feeEur;
      switch (t.type) {
        case 'inleg': {
          if (p.unit === 'eur' || p.unit === 'bundle') {
            const amount = +t.amountEur || 0;
            s.qty += amount;
            s.cost += amount;
            if (s.lastTotal != null) s.lastTotal += amount;
          }
          break;
        }
        case 'opname': {
          if (p.unit === 'eur' || p.unit === 'bundle') {
            const amount = +t.amountEur || 0;
            if (s.qty > 0) s.cost = Math.max(0, s.cost - (s.cost * (amount / s.qty)));
            s.qty = Math.max(0, s.qty - amount);
            if (s.lastTotal != null) s.lastTotal = Math.max(0, s.lastTotal - amount);
          } else {
            const qty = +t.quantity || 0;
            const totalQty = p.isMixed ? s.goldQty + s.silverQty : s.qty;
            const outQty = p.isMixed
              ? ((t.metalType || 'goud') === 'goud' ? goldToGram(qty, t.goldUnit) : silverToOz(qty, t.silverUnit))
              : qty;
            const avg = totalQty > 0 ? s.cost / totalQty : 0;
            s.cost = Math.max(0, s.cost - outQty * avg);
            if (p.isMixed) {
              if ((t.metalType || 'goud') === 'goud') s.goldQty = Math.max(0, s.goldQty - outQty);
              else s.silverQty = Math.max(0, s.silverQty - outQty);
            } else {
              s.qty = Math.max(0, s.qty - qty);
            }
          }
          break;
        }
        case 'koop':
        case 'cashback': {
          const qty = +t.quantity || 0;
          const amount = (+t.amountEur || 0) || qty * (+t.unitPriceEur || 0);
          if (p.unit === 'bundle') {
            s.qty += amount;
            s.cost += amount;
            if (s.lastTotal != null) s.lastTotal += amount;
          } else if (p.isMixed) {
            if ((t.metalType || 'goud') === 'goud') s.goldQty += goldToGram(qty, t.goldUnit);
            else s.silverQty += silverToOz(qty, t.silverUnit);
            s.cost += qty * (+t.unitPriceEur || 0);
            if (s.lastTotal != null) s.lastTotal += qty * (+t.unitPriceEur || 0);
          } else {
            s.qty += qty;
            s.cost += qty * (+t.unitPriceEur || 0);
            if (s.lastTotal != null) s.lastTotal += qty * (+t.unitPriceEur || 0);
          }
          break;
        }
        case 'dividend': {
          const qty = +t.quantity || 0;
          if (qty > 0) {
            if (p.isMixed) {
              if ((t.metalType || 'goud') === 'goud') s.goldQty += goldToGram(qty, t.goldUnit);
              else s.silverQty += silverToOz(qty, t.silverUnit);
            } else {
              s.qty += qty;
            }
          }
          break;
        }
        case 'verkoop': {
          const qty = +t.quantity || 0;
          if (p.unit === 'bundle') {
            const proceeds = (+t.amountEur || 0) || qty * (+t.unitPriceEur || 0);
            if (s.qty > 0) s.cost = Math.max(0, s.cost - (s.cost * (proceeds / s.qty)));
            s.qty = Math.max(0, s.qty - proceeds);
            if (s.lastTotal != null) s.lastTotal = Math.max(0, s.lastTotal - proceeds);
            break;
          }
          const totalQty = p.isMixed ? s.goldQty + s.silverQty : s.qty;
          const avg = totalQty > 0 ? s.cost / totalQty : 0;
          const outQty = p.isMixed
            ? ((t.metalType || 'goud') === 'goud' ? goldToGram(qty, t.goldUnit) : silverToOz(qty, t.silverUnit))
            : qty;
          s.cost = Math.max(0, s.cost - outQty * avg);
          if (p.isMixed) {
            if ((t.metalType || 'goud') === 'goud') s.goldQty = Math.max(0, s.goldQty - outQty);
            else s.silverQty = Math.max(0, s.silverQty - outQty);
          } else {
            s.qty = Math.max(0, s.qty - qty);
          }
          break;
        }
        case 'kosten':
          s.cost += +t.amountEur || 0;
          break;
        case 'waardering':
          if (t.unitPriceEur != null) s.lastUnitPx = +t.unitPriceEur;
          if (t.valueEur != null) s.lastTotal = +t.valueEur;
          if ((p.unit === 'gram' || p.unit === 'ounce') && t.quantity != null) s.qty = +t.quantity;
          break;
      }
    });

  let total = 0;
  let invested = 0;
  for (const p of parties) {
    const s = state[p.id];
    let value = 0;
    if (p.isMixed) {
      const gold = findPrice(history, 'gold_eur_per_gram', date) || 0;
      const silver = findPrice(history, 'silver_eur_per_ounce', date) || 0;
      value = s.lastTotal ?? (s.goldQty * gold + s.silverQty * silver);
    } else if (p.unit === 'crypto' || p.unit === 'part' || p.unit === 'gram' || p.unit === 'ounce') {
      const price = s.lastUnitPx ?? (p.priceAsset ? findPrice(history, p.priceAsset, date) : null);
      value = s.lastTotal ?? ((price || 0) * s.qty);
    } else if (p.unit === 'bundle') {
      value = bundleWeeklyInterpolatedValue(transactions.filter(t => t.party === p.id), date);
    } else if (p.unit === 'eur') {
      value = s.lastTotal ?? s.qty;
    }
    total += value;
    invested += s.cost;
  }
  return {
    date,
    total_eur: +total.toFixed(2),
    invested_eur: +invested.toFixed(2),
    updated_at: new Date().toISOString(),
  };
}

async function updateWeeklyPortfolioValue(date) {
  const rows = await buildPortfolioValueRows({ dates: [date] });
  await upsertPortfolioValues(rows);
  return rows[0];
}

async function buildPortfolioValueRows({ dates, startDate = '2025-01-01', endDate = todayIso(), weeklyOnly = false } = {}) {
  const [txRows, priceRows, parties] = await Promise.all([
    supabaseFetchAll('transactions?select=*&order=date.asc'),
    supabaseFetchAll(`asset_price_history?select=asset,date,nav&date=lte.${endDate}&order=date.asc`),
    fetchPortfolioParties(),
  ]);
  const transactions = txRows.map(rowToTx).filter(tx => !isIgnoredLegacyTransaction(tx));
  const history = priceRowsByAsset(priceRows);
  const valueDates = dates || [...new Set(priceRows
    .map(r => r.date)
    .filter(date => date >= startDate && date <= endDate))]
    .filter(date => !weeklyOnly || new Date(`${date}T00:00:00Z`).getUTCDay() === 1);
  return valueDates.map(date => calculatePortfolioValue(date, transactions, history, parties));
}

async function backfillPortfolioValues({ startDate = '2025-01-01', endDate = todayIso(), weeklyOnly = false } = {}) {
  const rows = await buildPortfolioValueRows({ startDate, endDate, weeklyOnly });
  for (let i = 0; i < rows.length; i += 500) {
    await upsertPortfolioValues(rows.slice(i, i + 500));
  }
  return rows;
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
        source: meesman.value.warning ? `meesman.nl (${meesman.value.warning})` : 'investing.com',
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
    const backfillMode = req.query?.backfill;
    const portfolioRows = backfillMode
      ? await backfillPortfolioValues({ weeklyOnly: backfillMode === 'weekly' })
      : [await updateWeeklyPortfolioValue(date)];
    return res.status(200).json({
      ok: true,
      saved: rows.length,
      date,
      portfolioValue: portfolioRows[portfolioRows.length - 1],
      portfolioValuesSaved: portfolioRows.length,
      assets: rows.map(r => r.asset),
      warnings: [metals, crypto, meesman]
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || String(r.reason)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};
