// App root: state, theme, tabs, tweaks, gist sync, price history

const THEMES = [
  { key: 'minimal',     label: 'Minimalistisch', className: 'theme-minimal'     },
  { key: 'dark',        label: 'Premium Dark',   className: 'theme-dark'        },
  { key: 'warm',        label: 'Warm & rustig',  className: 'theme-warm'        },
  { key: 'terminal',    label: 'Bloomberg',      className: 'theme-terminal'    },
  { key: 'nord',        label: 'Nord',           className: 'theme-nord'        },
  { key: 'solarized',   label: 'Solarized',      className: 'theme-solarized'   },
  { key: 'nebula',      label: 'Nebula',         className: 'theme-nebula'      },
  { key: 'catppuccin',  label: 'Catppuccin',     className: 'theme-catppuccin'  },
  { key: 'gruvbox',     label: 'Gruvbox',        className: 'theme-gruvbox'     },
  { key: 'rosepine',    label: 'Rose Pine',      className: 'theme-rosepine'    },
];

const TABS = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'transacties',  label: 'Transacties' },
  { key: 'pensioen',     label: 'Pensioen' },
];

const OZ_TO_GRAM     = 31.1034768;
const T212_PROXY        = 'https://corsproxy.io/?url=';
const SUPABASE_CFG_KEY  = 'investeringen-supabase-v1';
const SUPABASE_CFG_VERSION = 2;
const SUPABASE_PULL_INTERVAL_MS = 8000;
const SERVER_PRICE_REFRESH_KEY = 'investeringen-server-price-refresh-v1';
const SERVER_PRICE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// ── Price history helper ──────────────────────────────────────
function appendToHistory(existing, date, price) {
  if (!price) return existing || [];
  const arr = (existing || []).filter(h => h.date !== date);
  arr.push({ date, nav: +price });
  arr.sort((a, b) => a.date.localeCompare(b.date));
  return arr.slice(-1095); // 3 jaar max
}

// ── Supabase helpers ──────────────────────────────────────────
const SUPABASE_DEFAULTS = {
  configVersion: SUPABASE_CFG_VERSION,
  url:     'https://xlmbpohjlcwjubgiyjaw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbWJwb2hqbGN3anViZ2l5amF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjIyODksImV4cCI6MjA5MzYzODI4OX0.BXbY5_stirCdFLuXleBHu1VouYm1cguVZd3bjkygHlo',
};

function loadSupabaseConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(SUPABASE_CFG_KEY));
    if (stored?.configVersion === SUPABASE_CFG_VERSION && stored?.url && stored?.anonKey) return stored;
  } catch {}
  return { ...SUPABASE_DEFAULTS };
}

let lastAutomaticServerPriceRefreshAt = 0;

function claimAutomaticServerPriceRefresh() {
  const now = Date.now();
  let stored = 0;
  try { stored = +(localStorage.getItem(SERVER_PRICE_REFRESH_KEY) || 0); } catch {}
  if (now - Math.max(stored, lastAutomaticServerPriceRefreshAt) < SERVER_PRICE_REFRESH_INTERVAL_MS) return false;
  lastAutomaticServerPriceRefreshAt = now;
  try { localStorage.setItem(SERVER_PRICE_REFRESH_KEY, String(now)); } catch {}
  return true;
}

let supabaseClientCache = { key: null, client: null };

function getSupabaseClient(cfg) {
  if (!cfg?.url || !cfg?.anonKey) return null;
  const url = cfg.url.trim();
  const anonKey = cfg.anonKey.trim();
  const key = `${url}|${anonKey}`;
  if (supabaseClientCache.key === key && supabaseClientCache.client) {
    return supabaseClientCache.client;
  }
  try {
    const client = window.supabase?.createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    supabaseClientCache = { key, client };
    return client;
  }
  catch { return null; }
}

const PORTFOLIO_SETTINGS_EXCLUDED_KEYS = new Set([
  'transactions',
  'portfolioDailyValues',
  'goldHistory',
  'silverHistory',
  'btcHistory',
  'ethHistory',
  'paxgHistory',
  'meesmanNavHistory',
  'lastWeeklySpotSave',
  'customParties',
]);

function portfolioSettingsFromState(state = {}) {
  return Object.fromEntries(
    Object.entries(state || {}).filter(([key]) => !PORTFOLIO_SETTINGS_EXCLUDED_KEYS.has(key))
  );
}

async function supabaseSelectAll(makeQuery, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

// camelCase <-> snake_case helpers voor de transactions tabel
let transactionUpdatedAtColumnAvailable = true;

function txToRow(t, includeUpdatedAt = true) {
  const row = {
    id:             t.id,
    party:          t.party,
    type:           t.type,
    date:           t.date,
    quantity:       t.quantity     != null ? +t.quantity     : null,
    unit_price_eur: t.unitPriceEur != null ? +t.unitPriceEur : null,
    fee_eur:        t.feeEur       != null ? +t.feeEur       : null,
    amount_eur:     t.amountEur    != null ? +t.amountEur    : null,
    note:           t.note         || null,
    metal_type:     t.metalType    || null,
    silver_unit:    t.silverUnit   || null,
    gold_unit:      t.goldUnit     || null,
    instrument:     t.instrument   || null,
    t212_id:        t._t212Id      || null,
    value_eur:      t.valueEur     != null ? +t.valueEur     : null,
  };
  if (includeUpdatedAt && t.updatedAt) row.updated_at = t.updatedAt;
  return row;
}

function rowToTx(r) {
  const t = { id: r.id, party: r.party, type: r.type, date: r.date };
  if (r.quantity       != null) t.quantity     = +r.quantity;
  if (r.unit_price_eur != null) t.unitPriceEur = +r.unit_price_eur;
  if (r.fee_eur        != null) t.feeEur       = +r.fee_eur;
  if (r.amount_eur     != null) t.amountEur    = +r.amount_eur;
  if (r.note)                   t.note         = r.note;
  if (r.metal_type)             t.metalType    = r.metal_type;
  if (r.silver_unit)            t.silverUnit   = r.silver_unit;
  if (r.gold_unit)              t.goldUnit     = r.gold_unit;
  if (r.instrument)             t.instrument   = r.instrument;
  if (r.t212_id)                t._t212Id      = r.t212_id;
  if (r.value_eur      != null) t.valueEur     = +r.value_eur;
  if (r.updated_at || r.created_at) t.updatedAt = r.updated_at || r.created_at;
  return t;
}

const CANONICAL_BTC_TRANSACTIONS = [
  { id: 'btc-2024-02-29-buy-50',       party: 'finst-btc', date: '2024-02-29', type: 'koop',    quantity: 0.00085623, amountEur: 50,     feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-03-04-buy-70',       party: 'finst-btc', date: '2024-03-04', type: 'koop',    quantity: 0.00113883, amountEur: 70,     feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-03-12-buy-5738',     party: 'finst-btc', date: '2024-03-12', type: 'koop',    quantity: 0.00086852, amountEur: 57.38,  feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-03-12-buy-4001',     party: 'finst-btc', date: '2024-03-12', type: 'koop',    quantity: 0.00060528, amountEur: 40.01,  feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-04-10-buy-100',      party: 'finst-btc', date: '2024-04-10', type: 'koop',    quantity: 0.00159005, amountEur: 100,    feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-04-10-buy-300',      party: 'finst-btc', date: '2024-04-10', type: 'koop',    quantity: 0.00476801, amountEur: 300,    feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-04-10-buy-35',       party: 'finst-btc', date: '2024-04-10', type: 'koop',    quantity: 0.00055565, amountEur: 35,     feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2024-04-11-sell-435',     party: 'finst-btc', date: '2024-04-11', type: 'verkoop', quantity: 0.00663876, amountEur: 435,    feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2025-02-05-buy-100',      party: 'finst-btc', date: '2025-02-05', type: 'koop',    quantity: 0.00107528, amountEur: 100,    feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2025-02-25-buy-50',       party: 'finst-btc', date: '2025-02-25', type: 'koop',    quantity: 0.00058139, amountEur: 50,     feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2025-04-06-withdraw-5',   party: 'finst-btc', date: '2025-04-06', type: 'opname',  quantity: 0.0001,     amountEur: 5,      feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2026-02-08-buy-10001',    party: 'finst-btc', date: '2026-02-08', type: 'koop',    quantity: 0.0016594,  amountEur: 100.01, feeEur: 0, note: 'Screenshot Finst BTC' },
  { id: 'btc-2026-04-13-withdraw-048', party: 'finst-btc', date: '2026-04-13', type: 'opname',  quantity: 0.00005,    amountEur: 0.48,   feeEur: 0, note: 'Screenshot Finst BTC' },
];

function isIgnoredLegacyTransaction(tx) {
  return tx?.party === 'finst-btc' && String(tx.id || '').startsWith('tx_finst_btc_');
}

function normalizeTransactions(transactions = []) {
  const cleaned = transactions.filter(tx => !isIgnoredLegacyTransaction(tx));
  return mergeById(cleaned, CANONICAL_BTC_TRANSACTIONS)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function mergeById(local = [], remote = []) {
  const m = new Map();
  (local || []).forEach(item => item?.id && m.set(item.id, item));
  (remote || []).forEach(item => item?.id && m.set(item.id, item));
  return [...m.values()];
}

function updatedAtMs(item) {
  const t = Date.parse(item?.updatedAt || item?.updated_at || '');
  return Number.isFinite(t) ? t : 0;
}

function mergeByNewest(...lists) {
  const m = new Map();
  lists.forEach(list => (list || []).forEach(item => {
    if (!item?.id) return;
    const current = m.get(item.id);
    if (!current || updatedAtMs(item) >= updatedAtMs(current)) {
      m.set(item.id, item);
    }
  }));
  return [...m.values()];
}

function mergeDeletedIds(...sources) {
  const merged = {};
  sources.forEach(source => Object.entries(source || {}).forEach(([id, deletedAt]) => {
    if (!merged[id] || updatedAtMs({ updatedAt: deletedAt }) >= updatedAtMs({ updatedAt: merged[id] })) {
      merged[id] = deletedAt;
    }
  }));
  return merged;
}

function isDeletedByTombstone(item, deletedIds = {}) {
  const deletedAt = deletedIds[item?.id];
  return deletedAt && updatedAtMs({ updatedAt: deletedAt }) >= updatedAtMs(item);
}

function normalizeParties(parties = []) {
  return (parties || []).map(p => (
    p?.id === 'finst-paxg' && p.category === 'Crypto'
      ? { ...p, category: 'Edelmetaal' }
      : p
  ));
}

function priceRowsToState(rows = []) {
  const byAsset = rows.reduce((acc, row) => {
    if (!row?.asset || !row.date || row.nav == null) return acc;
    if (!acc[row.asset]) acc[row.asset] = [];
    acc[row.asset].push({ date: row.date, nav: +row.nav });
    return acc;
  }, {});
  return {
    goldHistory:       byAsset.gold_eur_per_gram || [],
    silverHistory:     byAsset.silver_eur_per_ounce || [],
    btcHistory:        byAsset.btc_eur || [],
    ethHistory:        byAsset.eth_eur || [],
    paxgHistory:       byAsset.paxg_eur || [],
    meesmanNavHistory: normalizeMeesmanHistory(byAsset.meesman_aandelen_wereldwijd_totaal || []).history,
  };
}

// Laad alles uit Supabase: instellingen, transacties en prijs-historie.
async function supabaseLoadAll(client) {
  const [portfolioRes, txRes, priceRes, valueRes] = await Promise.all([
    client.from('portfolio').select('data').eq('id', 'main').maybeSingle(),
    supabaseSelectAll(() => client.from('transactions').select('*').order('date', { ascending: true })),
    supabaseSelectAll(() => client.from('asset_price_history').select('asset,date,nav').gte('date', '2025-01-01').order('date', { ascending: true }).order('asset', { ascending: true })),
    supabaseSelectAll(() => client.from('portfolio_daily_values').select('date,total_eur,invested_eur').gte('date', '2025-01-01').order('date', { ascending: true })),
  ]);

  if (portfolioRes.error && txRes.error && priceRes.error && valueRes.error) {
    console.warn('[Supabase] laden mislukt:', portfolioRes.error?.message || txRes.error?.message);
    return null;
  }

  const portfolioData = portfolioRes.data?.data || {};
  const {
    transactions: _legacyTransactions,
    portfolioDailyValues: _legacyValues,
    goldHistory: _legacyGold,
    silverHistory: _legacySilver,
    btcHistory: _legacyBtc,
    ethHistory: _legacyEth,
    paxgHistory: _legacyPaxg,
    meesmanNavHistory: _legacyMeesman,
    lastWeeklySpotSave: _legacyWeekly,
    ...settings
  } = portfolioData;

  const transactionsLoaded = !txRes.error;
  const transactions = transactionsLoaded
    ? normalizeTransactions((txRes.data || []).map(rowToTx))
    : normalizeTransactions(_legacyTransactions || []);

  const priceState = priceRes.error ? {} : priceRowsToState(priceRes.data || []);
  const portfolioDailyValues = valueRes.error ? [] : (valueRes.data || []).map(row => ({
    date: row.date,
    total: +row.total_eur,
    invested: +row.invested_eur,
  }));

  return {
    ...settings,
    ...priceState,
    transactions,
    portfolioDailyValues,
    _transactionsLoaded: transactionsLoaded,
  };
}

// Sla alleen instellingen op in portfolio; transacties en koershistorie hebben eigen tabellen.
async function supabaseSaveSettings(client, state) {
  const settings = portfolioSettingsFromState(state);
  const { data: current } = await client
    .from('portfolio')
    .select('data')
    .eq('id', 'main')
    .maybeSingle();
  const currentParties = current?.data?.parties;
  if (Array.isArray(currentParties) && currentParties.length) {
    settings.parties = normalizeParties(mergeByNewest(currentParties, settings.parties || []));
  }
  const { error } = await client
    .from('portfolio')
    .upsert({ id: 'main', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

async function supabaseSyncTransactions(client, transactions = [], deletedTransactionIds = {}) {
  const txs = transactions
    .filter(t => t.id && t.party && t.type && t.date && !isIgnoredLegacyTransaction(t));
  for (let i = 0; i < txs.length; i += 200) {
    const chunk = txs.slice(i, i + 200);
    const rows = chunk.map(t => txToRow(t, transactionUpdatedAtColumnAvailable));
    let { error } = await client
      .from('transactions')
      .upsert(rows, { onConflict: 'id' });
    if (error?.code === 'PGRST204' && String(error.message || '').includes('updated_at')) {
      transactionUpdatedAtColumnAvailable = false;
      const retryRows = chunk.map(t => txToRow(t, false));
      ({ error } = await client
        .from('transactions')
        .upsert(retryRows, { onConflict: 'id' }));
    }
    if (error) throw new Error(error.message);
  }
  const deletedIds = Object.keys(deletedTransactionIds || {});
  for (let i = 0; i < deletedIds.length; i += 200) {
    const { error } = await client
      .from('transactions')
      .delete()
      .in('id', deletedIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}

async function supabaseUpsertAssetPriceRows(client, rows = []) {
  if (!client) return false;
  const cleanRows = rows
    .filter(r => r?.asset && r.date && +r.nav > 0)
    .map(r => ({
      asset: r.asset,
      date: r.date,
      nav: +r.nav,
      source: r.source || 'app',
      updated_at: r.updated_at || new Date().toISOString(),
    }));
  if (!cleanRows.length) return false;

  let { error } = await client
    .from('asset_price_history')
    .upsert(cleanRows, { onConflict: 'asset,date' });
  if (error?.code === 'PGRST204' && /source|updated_at/i.test(error.message || '')) {
    const legacyRows = cleanRows.map(({ source, updated_at, ...row }) => row);
    ({ error } = await client
      .from('asset_price_history')
      .upsert(legacyRows, { onConflict: 'asset,date' }));
  }
  if (error) throw new Error(error.message);
  return true;
}

// ── Spot price fetchers ───────────────────────────────────────
async function fetchSpotPrices() {
  const [goldRes, silverRes, fxRes] = await Promise.all([
    fetch('https://api.gold-api.com/price/XAU').then(r => r.json()),
    fetch('https://api.gold-api.com/price/XAG').then(r => r.json()),
    fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR').then(r => r.json()),
  ]);
  const goldUsdOz   = goldRes.price;
  const silverUsdOz = silverRes.price;
  const usdToEur    = fxRes.rates?.EUR;
  if (!goldUsdOz || !silverUsdOz || !usdToEur) throw new Error('Ongeldige response');
  return {
    goldSpotEurPerGram:    (goldUsdOz * usdToEur) / OZ_TO_GRAM,
    silverSpotEurPerOunce: silverUsdOz * usdToEur,
  };
}

async function fetchCryptoPrices() {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=eur'
  ).then(r => r.json());
  if (!res.bitcoin || !res.ethereum || !res['pax-gold']) throw new Error('Ongeldige CoinGecko response');
  return {
    btcSpotEur:  res.bitcoin.eur,
    ethSpotEur:  res.ethereum.eur,
    paxgSpotEur: res['pax-gold'].eur,
  };
}

// Haal 1 jaar dagelijkse crypto-prijzen op (vul history bij eerste gebruik)
async function fetchCryptoHistory() {
  const toDays = prices => prices
    .map(([ts, p]) => ({ date: new Date(ts).toISOString().slice(0, 10), nav: +p.toFixed(2) }))
    .filter((h, i, arr) => i === 0 || h.date !== arr[i - 1].date);

  const [btc, eth, paxg] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=365&interval=daily').then(r => r.json()),
    fetch('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=eur&days=365&interval=daily').then(r => r.json()),
    fetch('https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=eur&days=365&interval=daily').then(r => r.json()),
  ]);
  return {
    btcHistory:  toDays(btc.prices  || []),
    ethHistory:  toDays(eth.prices  || []),
    paxgHistory: toDays(paxg.prices || []),
  };
}

async function fetchJsonWithFallback(url, wrappers) {
  for (const wrap of wrappers) {
    try {
      const res = await fetch(wrap(url));
      if (!res.ok) continue;
      return await res.json();
    } catch {}
  }
  throw new Error('Geen data ontvangen');
}

async function fetchMetalHistory() {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 730 * 86400;
  const wrappers = [
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy/?quest=${u}`,
    u => u,
  ];
  const yahoo = symbol =>
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;
  const fxUrl = `https://api.frankfurter.dev/v1/${new Date(start * 1000).toISOString().slice(0,10)}..${new Date(end * 1000).toISOString().slice(0,10)}?base=USD&symbols=EUR`;
  const [gold, silver, fx] = await Promise.all([
    fetchJsonWithFallback(yahoo('GC=F'), wrappers),
    fetchJsonWithFallback(yahoo('SI=F'), wrappers),
    fetch(fxUrl).then(r => r.json()),
  ]);
  const fxRates = fx.rates || {};
  const toHistory = (data, converter) => {
    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    return ts
      .map((t, i) => {
        const date = new Date(t * 1000).toISOString().slice(0, 10);
        const eur = fxRates[date]?.EUR;
        const close = closes[i];
        if (!eur || !close) return null;
        return { date, nav: +converter(close, eur).toFixed(2) };
      })
      .filter(Boolean)
      .filter((h, i, arr) => i === 0 || h.date !== arr[i - 1].date);
  };
  return {
    goldHistory: toHistory(gold, (usdOz, eur) => (usdOz * eur) / OZ_TO_GRAM),
    silverHistory: toHistory(silver, (usdOz, eur) => usdOz * eur),
  };
}

async function fetchMeesmanLatestFromWebsite() {
  const url = 'https://www.meesman.nl/onze-fondsen/aandelen-wereldwijd-totaal/';
  const wrappers = [
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy/?quest=${u}`,
    u => u,
  ];
  for (const wrap of wrappers) {
    try {
      const html = await fetch(wrap(url)).then(r => r.text());
      const normalizedHtml = html
        .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
        .replace(/&#x20AC;|&#8364;|&euro;/gi, '€');
      const m = normalizedHtml.match(/Laatste\s+koers[\s\S]{0,360}?(?:€|EUR)\s*([0-9.,]+)[\s\S]{0,160}?\((\d{2}-\d{2}-\d{4})\)/i);
      if (!m) continue;
      const nav = +m[1].replace(/\./g, '').replace(',', '.');
      const [dd, mm, yyyy] = m[2].split('-');
      return { meesmanNavEur: nav, meesmanNavHistory: [{ date: `${yyyy}-${mm}-${dd}`, nav }] };
    } catch {}
  }
  throw new Error('Meesman website niet bereikbaar');
}

async function refreshPricesViaServer() {
  const res = await fetch(`/api/update-weekly-prices?ts=${Date.now()}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const type = res.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok || !body?.ok) {
    const msg = body?.error || body?.errors?.join(' · ') || `Koers-update HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

// Haal 2 jaar Meesman NAV-geschiedenis op via Yahoo Finance (0P0001IJJX.F)
async function fetchMeesmanHistory() {
  const yf = 'https://query2.finance.yahoo.com/v8/finance/chart/0P0001IJJX.F?interval=1d&range=2y';
  // Probeer meerdere CORS-proxies na elkaar
  const wrappers = [
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy/?quest=${u}`,
    u => u, // direct (laatste poging, browser kan dit blokkeren)
  ];
  for (const wrap of wrappers) {
    try {
      const res = await fetch(wrap(yf));
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result?.timestamp?.length) continue;
      const ts      = result.timestamp;
      const closes  = result.indicators?.quote?.[0]?.close || [];
      const history = ts
        .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), nav: closes[i] ? +closes[i].toFixed(4) : null }))
        .filter(h => h.nav != null)
        .filter((h, i, arr) => i === 0 || h.date !== arr[i - 1].date);
      if (history.length < 10) continue;
      return { meesmanNavEur: history[history.length - 1].nav, meesmanNavHistory: history };
    } catch {}
  }
  throw new Error('Geen historische data beschikbaar via Yahoo Finance');
}

async function fetchMeesmanNav() {
  const end   = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
  const id    = '0P0001IJJX%24%242%24%241';
  const qs    = `id=${id}&currencyId=EUR&idtype=Morningstar&frequency=daily&startDate=${start}&endDate=${end}&outputType=COMPACTJSON`;
  const hosts = ['tools.morningstar.nl', 'tools.morningstar.be', 'lt.morningstar.com', 'tools.morningstar.co.uk'];
  const token = 't92wz0sj7c';
  for (const host of hosts) {
    try {
      const endpoint = `https://${host}/api/rest.svc/timeseries_price/${token}?${qs}`;
      const res = await fetch(T212_PROXY + encodeURIComponent(endpoint)).then(r => r.json());
      const history = res?.TimeSeries?.Security?.[0]?.HistoryDetail || [];
      if (!history.length) continue;
      const navHistory = history
        .map(h => ({ date: h.EndDate.slice(0, 10), nav: +h.Value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { meesmanNavEur: navHistory[navHistory.length - 1].nav, meesmanNavHistory: navHistory };
    } catch (_) {}
  }
  throw new Error('Geen NAV-data ontvangen (alle Morningstar-endpoints geprobeerd)');
}

function buildT212Auth(secret) { return (secret || '').trim(); }

async function fetchT212Orders(authHeader, cursor, mode = 'live') {
  const host = mode === 'demo' ? 'demo.trading212.com' : 'live.trading212.com';
  const base = cursor
    ? `https://${host}/api/v0/equity/history/orders?cursor=${encodeURIComponent(cursor)}&limit=50`
    : `https://${host}/api/v0/equity/history/orders?limit=50`;
  let res;
  try { res = await fetch(T212_PROXY + encodeURIComponent(base), { headers: { Authorization: authHeader } }); }
  catch { throw new Error('Netwerkfout — controleer je verbinding'); }
  if (res.status === 401) { const b = await res.text().catch(() => ''); throw new Error(`401 — ${b || 'ongeldige sleutel'}`); }
  if (res.status === 403) throw new Error('Geen toegang (403) — sleutel heeft mogelijk onvoldoende rechten');
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`T212 HTTP ${res.status}: ${b || 'onbekend'}`); }
  return res.json();
}

function mapT212Order(order) {
  const typeMap = { LIMIT_BUY:'koop', MARKET_BUY:'koop', LIMIT_SELL:'verkoop', MARKET_SELL:'verkoop', STOP_BUY:'koop', STOP_SELL:'verkoop' };
  const qty   = +(order.filledQuantity || order.orderedQuantity || 0);
  const price = +(order.filledPrice || (qty > 0 ? (order.filledValue / qty) : 0) || 0);
  const fee   = (order.taxes || []).reduce((s, t) => s + +(t.quantity || 0), 0);
  const ticker = (order.ticker || '').replace(/_[A-Z0-9]+$/, '');
  return {
    id: makeId(), party: 'trading212',
    type: typeMap[order.type] || 'koop',
    date: (order.dateCreated || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    quantity: qty, unitPriceEur: +price.toFixed(4),
    feeEur: fee > 0 ? +fee.toFixed(4) : undefined,
    instrument: ticker, note: `T212:${order.id || ''}`, _t212Id: String(order.id || ''),
  };
}

// ─────────────────────────────────────────────────────────────
function App() {
  const [state, setState]           = React.useState(() => loadState());
  // tweaks zit nu binnen state.tweaks (gesynchroniseerd via Supabase).
  // Deze afgeleide variabele houdt bestaande UI-code werkend.
  const tweaks = state.tweaks || {};
  const [liveSpot, setLiveSpot]     = React.useState({});
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [activeTab, setActiveTab]   = React.useState('dashboard');
  const [spotStatus, setSpotStatus] = React.useState({ loading: false, error: null, fetchedAt: null });
  const [t212Status, setT212Status] = React.useState({ loading: false, error: null, imported: 0, done: false });
  const [importMsg, setImportMsg]   = React.useState(null);
  const [supabaseConfig, setSupabaseConfig] = React.useState(loadSupabaseConfig);
  const [syncStatus, setSyncStatus] = React.useState({ loading: false, error: null, syncedAt: null });
  const syncTimerRef = React.useRef(null);
  const supabaseLoadedRef = React.useRef(false);
  const transactionsLoadedRef = React.useRef(false);
  const stateRef       = React.useRef(state);
  const pendingSaveRef = React.useRef(false);
  const saveQueueRef   = React.useRef(Promise.resolve());
  const skipNextAutosaveRef = React.useRef(false);
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileTab, setMobileTab] = React.useState('home');
  const [mobileAddTrigger, setMobileAddTrigger] = React.useState(0);
  const [mobileDetailPartyId, setMobileDetailPartyId] = React.useState(null);
  const [mobileTxOpen, setMobileTxOpen] = React.useState(false);
  const [mobileTxPreset, setMobileTxPreset] = React.useState(null);
  const [mobileEditingTx, setMobileEditingTx] = React.useState(null);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const h = e => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Persist state to localStorage
  React.useEffect(() => { saveState(state); }, [state]);
  React.useEffect(() => { stateRef.current = state; }, [state]);

  // Persist Supabase config to localStorage
  React.useEffect(() => {
    try { localStorage.setItem(SUPABASE_CFG_KEY, JSON.stringify(supabaseConfig)); } catch {}
  }, [supabaseConfig]);

  const applyRemoteData = React.useCallback(remoteData => {
    if (!remoteData) {
      transactionsLoadedRef.current = false;
      return;
    }
    const { _transactionsLoaded, ...remote } = remoteData;
    transactionsLoadedRef.current = _transactionsLoaded !== false;
    setState(s => {
      const meesman = normalizeMeesmanHistory(
        mergePriceHistory(s.meesmanNavHistory, remote.meesmanNavHistory)
      );
      const mergedDeletedTransactionIds = mergeDeletedIds(remote.deletedTransactionIds, s.deletedTransactionIds);
      const remoteTxs = normalizeTransactions(remote.transactions || [])
        .filter(t => !isDeletedByTombstone(t, mergedDeletedTransactionIds));
      const mergedTxs = normalizeTransactions(mergeByNewest(remoteTxs, s.transactions || [])
        .filter(t => !isDeletedByTombstone(t, mergedDeletedTransactionIds)))
        .sort((a, b) => a.date.localeCompare(b.date));

      const mergedParties = normalizeParties(mergeByNewest(remote.parties, s.parties));
      const mergedTweaks = { ...(s.tweaks || {}), ...(remote.tweaks || {}) };

      return {
        ...s,
        ...remote,
        transactions:      mergedTxs,
        deletedTransactionIds: mergedDeletedTransactionIds,
        parties:           mergedParties.length ? mergedParties : normalizeParties(s.parties || []),
        tweaks:            mergedTweaks,
        meesmanNavEur:     meesman.currentNav,
        meesmanNavHistory: meesman.history,
        goldHistory:       mergePriceHistory(s.goldHistory,   remote.goldHistory),
        silverHistory:     mergePriceHistory(s.silverHistory, remote.silverHistory),
        btcHistory:        mergePriceHistory(s.btcHistory,    remote.btcHistory),
        ethHistory:        mergePriceHistory(s.ethHistory,    remote.ethHistory),
        paxgHistory:       mergePriceHistory(s.paxgHistory,   remote.paxgHistory),
        portfolioDailyValues: remote.portfolioDailyValues?.length ? remote.portfolioDailyValues : (s.portfolioDailyValues || []),
      };
    });
  }, []);

  // Laad data van Supabase bij opstarten
  const didInitialLoad = React.useRef(false);
  React.useEffect(() => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) return;
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    const client = getSupabaseClient(supabaseConfig);
    if (!client) return;
    setSyncStatus({ loading: true, error: null, syncedAt: null });
    supabaseLoadAll(client)
      .then(remoteData => {
        skipNextAutosaveRef.current = true;
        applyRemoteData(remoteData);
        supabaseLoadedRef.current = true;
        setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
      })
      .catch(e => {
        supabaseLoadedRef.current = true;
        transactionsLoadedRef.current = false;
        setSyncStatus({ loading: false, error: e.message, syncedAt: null });
      });
  }, [supabaseConfig.url, supabaseConfig.anonKey, applyRemoteData]);

  // Haal 1 jaar crypto-geschiedenis op als de history leeg is
  React.useEffect(() => {
    if ((state.btcHistory || []).length > 10) return;
    fetchCryptoHistory()
      .then(h => setState(s => ({ ...s, ...h })))
      .catch(() => {});
  }, []); // eenmalig bij mount

  // Haal 2 jaar goud/zilver historie op voor de waarde-over-tijd grafiek
  React.useEffect(() => {
    if ((state.goldHistory || []).length > 20 && (state.silverHistory || []).length > 20) return;
    fetchMetalHistory()
      .then(h => setState(s => ({
        ...s,
        goldHistory: mergePriceHistory(s.goldHistory, h.goldHistory),
        silverHistory: mergePriceHistory(s.silverHistory, h.silverHistory),
      })))
      .catch(() => {});
  }, []); // eenmalig bij mount

  const runSaveSnapshotToSupabase = React.useCallback(snapshot => {
    const client = getSupabaseClient(supabaseConfig);
    if (!client) return Promise.resolve(false);
    const jobs = [supabaseSaveSettings(client, snapshot)];
    jobs.push(supabaseSyncTransactions(client, snapshot.transactions || [], snapshot.deletedTransactionIds || {}));
    return Promise.all(jobs)
      .then(() => setSyncStatus(s => ({ ...s, error: null, syncedAt: new Date().toISOString() })))
      .then(() => true);
  }, [supabaseConfig]);

  const saveSnapshotToSupabase = React.useCallback(snapshot => {
    const job = saveQueueRef.current
      .catch(() => {})
      .then(() => runSaveSnapshotToSupabase(snapshot));
    saveQueueRef.current = job;
    return job;
  }, [runSaveSnapshotToSupabase]);

  const setSyncedState = React.useCallback(updater => {
    let shouldSave = false;
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next !== prev && !shouldSave) {
        shouldSave = true;
        skipNextAutosaveRef.current = true;
        pendingSaveRef.current = true;
        clearTimeout(syncTimerRef.current);
        Promise.resolve().then(() => {
          pendingSaveRef.current = false;
          return saveSnapshotToSupabase(next)
            .catch(e => {
              pendingSaveRef.current = true;
              setSyncStatus(s => ({ ...s, error: e.message }));
              return false;
            });
        });
      }
      return next;
    });
  }, [saveSnapshotToSupabase]);

  // Save NU (gebruikt bij pagehide/visibilitychange/focus).
  const flushSave = React.useCallback(() => {
    if (!pendingSaveRef.current) return Promise.resolve(false);
    clearTimeout(syncTimerRef.current);
    pendingSaveRef.current = false;
    return saveSnapshotToSupabase(stateRef.current)
      .catch(e => {
        pendingSaveRef.current = true;
        setSyncStatus(s => ({ ...s, error: e.message }));
        return false;
      });
  }, [saveSnapshotToSupabase]);

  const reloadSupabase = React.useCallback(() => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) return Promise.resolve(false);
    const client = getSupabaseClient(supabaseConfig);
    if (!client) return Promise.resolve(false);
    setSyncStatus(s => ({ ...s, loading: true, error: null }));
    return supabaseLoadAll(client)
      .then(remoteData => {
        skipNextAutosaveRef.current = true;
        applyRemoteData(remoteData);
        supabaseLoadedRef.current = true;
        setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
        return true;
      })
      .catch(e => {
        setSyncStatus(s => ({ ...s, loading: false, error: e.message }));
        return false;
      });
  }, [supabaseConfig, applyRemoteData]);

  // Houd geopende laptop- en telefoontabs gelijk zonder handmatig herladen.
  React.useEffect(() => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) return;
    const pullWhenVisible = () => {
      if (document.visibilityState === 'hidden') return;
      reloadSupabase();
    };
    const timer = setInterval(pullWhenVisible, SUPABASE_PULL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [supabaseConfig.url, supabaseConfig.anonKey, reloadSupabase]);

  // Automatisch opslaan: korte debounce. Markeer als "pending" zodat flush kan vuren.
  React.useEffect(() => {
    const client = getSupabaseClient(supabaseConfig);
    if (!client) return;
    if (!supabaseLoadedRef.current) return; // wacht op eerste load zodat we niets overschrijven
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    pendingSaveRef.current = true;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      pendingSaveRef.current = false;
      saveSnapshotToSupabase(state)
        .catch(e => {
          pendingSaveRef.current = true;
          setSyncStatus(s => ({ ...s, error: e.message }));
        });
    }, 350);
  }, [state]); // eslint-disable-line

  // Flush bij wegnavigeren — kritiek voor mobiel waar de app vaak in achtergrond verdwijnt
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    const onPageHide = () => flushSave();
    const onShow = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      flushSave().finally(() => reloadSupabase());
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('online', onShow);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('online', onShow);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [flushSave, reloadSupabase]);

  // Apply theme class to <html>
  React.useEffect(() => {
    const el = document.documentElement;
    if (window.__PREVIEW_VARIANT__) {
      THEMES.forEach(t => el.classList.remove(t.className));
      el.classList.add(`preview-${window.__PREVIEW_VARIANT__}`);
      return;
    }
    THEMES.forEach(t => el.classList.remove(t.className));
    const t = THEMES.find(t => t.key === tweaks.theme) || THEMES[0];
    el.classList.add(t.className);
  }, [tweaks.theme]);

  // Tweaks host integration
  React.useEffect(() => {
    const onMessage = e => {
      const d = e.data || {};
      if (d.type === '__activate_edit_mode')   setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Schrijft tweaks naar state.tweaks → wordt automatisch naar Supabase gesynchroniseerd
  const updateTweaks = React.useCallback(updater => {
    setState(s => {
      const prev = s.tweaks || {};
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*'); } catch {}
      return { ...s, tweaks: next };
    });
  }, []);

  const displayTweaks = React.useMemo(() => ({ ...tweaks, ...liveSpot }), [tweaks, liveSpot]);

  const refreshSpot = React.useCallback(async (options = {}) => {
    const manual = options?.manual === true || options?.type === 'click';
    const autoServerRefresh = !manual && claimAutomaticServerPriceRefresh();
    setSpotStatus(s => ({ ...s, loading: true, error: null }));

    let serverRefreshFailed = false;
    if (manual || autoServerRefresh) {
      try {
        const serverResult = await refreshPricesViaServer();
        await reloadSupabase();
        if (manual) {
          const warnings = (serverResult.warnings || []).filter(Boolean);
          setSpotStatus({
            loading: false,
            error: warnings.length ? warnings.join(' · ') : null,
            fetchedAt: new Date().toISOString(),
          });
          return;
        }
      } catch (e) {
        serverRefreshFailed = true;
        console.warn('[prijzen] server-refresh mislukt, probeer browser fallback:', e.message);
      }
    }

    const refreshMeesmanInBrowser = manual || serverRefreshFailed;
    const [metals, crypto, meesman] = await Promise.allSettled([
      fetchSpotPrices(),
      fetchCryptoPrices(),
      refreshMeesmanInBrowser ? fetchMeesmanLatestFromWebsite() : Promise.resolve(null),
    ]);
    const updates = {};
    const priceRows = [];
    const today = new Date().toISOString().slice(0, 10);
    if (metals.status === 'fulfilled') {
      updates.goldSpotEurPerGram    = +metals.value.goldSpotEurPerGram.toFixed(2);
      updates.silverSpotEurPerOunce = +metals.value.silverSpotEurPerOunce.toFixed(2);
      priceRows.push(
        { asset: 'gold_eur_per_gram', date: today, nav: +metals.value.goldSpotEurPerGram.toFixed(8), source: 'browser refresh' },
        { asset: 'silver_eur_per_ounce', date: today, nav: +metals.value.silverSpotEurPerOunce.toFixed(8), source: 'browser refresh' },
      );
    }
    if (crypto.status === 'fulfilled') {
      updates.btcSpotEur  = +crypto.value.btcSpotEur.toFixed(2);
      updates.ethSpotEur  = +crypto.value.ethSpotEur.toFixed(2);
      updates.paxgSpotEur = +crypto.value.paxgSpotEur.toFixed(2);
      priceRows.push(
        { asset: 'btc_eur', date: today, nav: +crypto.value.btcSpotEur.toFixed(8), source: 'browser refresh' },
        { asset: 'eth_eur', date: today, nav: +crypto.value.ethSpotEur.toFixed(8), source: 'browser refresh' },
        { asset: 'paxg_eur', date: today, nav: +crypto.value.paxgSpotEur.toFixed(8), source: 'browser refresh' },
      );
    }
    const meesmanEntry = meesman.status === 'fulfilled' ? meesman.value?.meesmanNavHistory?.[0] : null;
    if (refreshMeesmanInBrowser && meesmanEntry?.date && +meesmanEntry.nav > 0) {
      priceRows.push({
        asset: 'meesman_aandelen_wereldwijd_totaal',
        date: meesmanEntry.date,
        nav: +meesmanEntry.nav,
        source: 'meesman.nl',
      });
    }
    if (Object.keys(updates).length || (refreshMeesmanInBrowser && meesmanEntry?.date && +meesmanEntry.nav > 0)) {
      // Sla op in liveSpot (directe weergave) én tweaks (persistent na refresh)
      if (Object.keys(updates).length) {
        setLiveSpot(prev => ({ ...prev, ...updates }));
        updateTweaks(tw => ({ ...tw, ...updates }));
      }
      // Sla vandaag's spot op in de history voor de grafiek
      setState(s => {
        const hist = {};
        if (updates.goldSpotEurPerGram)    hist.goldHistory   = appendToHistory(s.goldHistory,   today, updates.goldSpotEurPerGram);
        if (updates.silverSpotEurPerOunce) hist.silverHistory = appendToHistory(s.silverHistory, today, updates.silverSpotEurPerOunce);
        if (updates.btcSpotEur)            hist.btcHistory    = appendToHistory(s.btcHistory,    today, updates.btcSpotEur);
        if (updates.ethSpotEur)            hist.ethHistory    = appendToHistory(s.ethHistory,    today, updates.ethSpotEur);
        if (updates.paxgSpotEur)           hist.paxgHistory   = appendToHistory(s.paxgHistory,   today, updates.paxgSpotEur);
        if (refreshMeesmanInBrowser && meesmanEntry?.date && +meesmanEntry.nav > 0) {
          const normalized = normalizeMeesmanHistory(mergePriceHistory(s.meesmanNavHistory, [meesmanEntry]));
          hist.meesmanNavHistory = normalized.history;
          hist.meesmanNavEur = normalized.currentNav;
        }
        return Object.keys(hist).length ? { ...s, ...hist } : s;
      });
    }

    let priceSaveError = null;
    if ((manual || serverRefreshFailed) && priceRows.length) {
      const client = getSupabaseClient(supabaseConfig);
      if (client) {
        try {
          await supabaseUpsertAssetPriceRows(client, priceRows);
          await reloadSupabase();
        } catch (e) {
          priceSaveError = `Koersopslag: ${e.message}`;
          setSyncStatus(s => ({ ...s, error: e.message }));
        }
      }
    }

    const errors = [
      metals.status === 'rejected' ? `Goud/zilver: ${metals.reason?.message}` : null,
      crypto.status === 'rejected' ? `Crypto: ${crypto.reason?.message}`       : null,
      refreshMeesmanInBrowser && meesman.status === 'rejected' ? `Meesman: ${meesman.reason?.message}` : null,
      priceSaveError,
    ].filter(Boolean);

    setSpotStatus({ loading: false, error: errors.length ? errors.join(' · ') : null, fetchedAt: new Date().toISOString() });
  }, [updateTweaks, supabaseConfig, reloadSupabase]);

  // Meesman NAV handmatig bijwerken
  const updateMeesmanNav = React.useCallback((nav) => {
    const today = new Date().toISOString().slice(0, 10);
    const entry = { date: today, nav: +nav };
    setSyncedState(s => {
      const normalized = normalizeMeesmanHistory(mergePriceHistory(s.meesmanNavHistory, [entry]));
      return { ...s, meesmanNavEur: normalized.currentNav, meesmanNavHistory: normalized.history };
    });
    const client = getSupabaseClient(supabaseConfig);
    if (client) {
      supabaseUpsertAssetPriceRows(client, [{
        asset: 'meesman_aandelen_wereldwijd_totaal',
        date: today,
        nav: +nav,
        source: 'handmatig',
      }])
        .then(() => reloadSupabase())
        .catch(e => setSyncStatus(s => ({ ...s, error: e.message })));
    }
  }, [setSyncedState, supabaseConfig, reloadSupabase]);

  // Haal historische Meesman data op via Yahoo Finance
  const [meesmanHistStatus, setMeesmanHistStatus] = React.useState({ loading: false, error: null, done: false });
  const loadMeesmanHistory = React.useCallback(async () => {
    setMeesmanHistStatus({ loading: true, error: null, done: false });
    try {
      const result = await fetchMeesmanHistory();
      const latest = await fetchMeesmanLatestFromWebsite().catch(() => null);
      setState(s => {
        // Samenvoegen: bestaande handmatige entries bewaren, Yahoo-data als basis
        const officialLatest = latest?.meesmanNavHistory?.[0] || MEESMAN_NAV_SEED_HISTORY[MEESMAN_NAV_SEED_HISTORY.length - 1];
        const merged = mergePriceHistory(
          result.meesmanNavHistory.filter(h => h.date <= officialLatest.date),
          [...(s.meesmanNavHistory || []), ...(latest?.meesmanNavHistory || [])]
        );
        const normalized = normalizeMeesmanHistory(merged);
        return { ...s, meesmanNavEur: officialLatest.nav || normalized.currentNav, meesmanNavHistory: normalized.history };
      });
      setMeesmanHistStatus({ loading: false, error: null, done: true });
    } catch (e) {
      setMeesmanHistStatus({ loading: false, error: e.message, done: false });
    }
  }, []);

  // Auto-fetch bij eerste keer opstarten als history leeg/schaars is
  React.useEffect(() => {
    if ((state.meesmanNavHistory || []).length < 20) loadMeesmanHistory();
  }, []); // eslint-disable-line

  const importT212 = React.useCallback(async () => {
    const auth = buildT212Auth(tweaks.t212ApiKey);
    if (!auth) return;
    setT212Status({ loading: true, error: null, imported: 0, done: false });
    try {
      const data = await fetchT212Orders(auth, null, tweaks.t212Mode || 'live');
      const items = Array.isArray(data) ? data : (data.items || []);
      const existingIds = new Set(state.transactions.filter(t => t._t212Id).map(t => t._t212Id));
      const newTxs = items
        .filter(o => {
          if (existingIds.has(String(o.id || ''))) return false;
          if (o.status && o.status !== 'FILLED') return false;
          const qty = +(o.filledQuantity || o.orderedQuantity || 0);
          const price = +(o.filledPrice || 0) || (qty > 0 ? (+(o.filledValue || 0) / qty) : 0);
          return qty > 0 && price > 0;
        })
        .map(mapT212Order);
      if (newTxs.length > 0) {
        const now = new Date().toISOString();
        setSyncedState(s => {
          const stamped = newTxs.map(tx => ({ ...tx, updatedAt: now }));
          const deletedTransactionIds = { ...(s.deletedTransactionIds || {}) };
          stamped.forEach(tx => { delete deletedTransactionIds[tx.id]; });
          return { ...s, transactions: [...s.transactions, ...stamped], deletedTransactionIds };
        });
      }
      setT212Status({ loading: false, error: null, imported: newTxs.length, done: true });
    } catch (e) {
      setT212Status({ loading: false, error: e.message || 'Importfout', imported: 0, done: false });
    }
  }, [tweaks.t212ApiKey, tweaks.t212Mode, state.transactions, setSyncedState]);

  React.useEffect(() => {
    refreshSpot();
    const t = setInterval(refreshSpot, 30 * 1000);
    return () => clearInterval(t);
  }, [refreshSpot]);

  const resetData = React.useCallback(() => {
    if (!confirm('Alle transacties wissen en terug naar de seed data?')) return;
    localStorage.removeItem('investeringen-v3');
    setState(loadState());
  }, []);

  const deleteT212Txs = React.useCallback(() => {
    const ids = state.transactions.filter(t => t.party === 'trading212').map(t => t.id);
    const count = ids.length;
    if (!confirm(`${count} Trading 212 transacties verwijderen?`)) return;
    setSyncedState(s => {
      const deletedAt = new Date().toISOString();
      const deletedTransactionIds = { ...(s.deletedTransactionIds || {}) };
      ids.forEach(id => { deletedTransactionIds[id] = deletedAt; });
      return { ...s, transactions: s.transactions.filter(t => t.party !== 'trading212'), deletedTransactionIds };
    });
    setT212Status({ loading: false, error: null, imported: 0, done: false });
  }, [state.transactions, setSyncedState]);

  const syncNow = React.useCallback(async () => {
    const client = getSupabaseClient(supabaseConfig);
    if (!client) return;
    setSyncStatus({ loading: true, error: null, syncedAt: null });
    try {
      await Promise.all([
        supabaseSaveSettings(client, state),
        supabaseSyncTransactions(client, state.transactions || [], state.deletedTransactionIds || {}),
      ]);
      setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
    } catch (e) {
      setSyncStatus({ loading: false, error: e.message, syncedAt: null });
    }
  }, [supabaseConfig, state]);

  const exportData = React.useCallback(() => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `investeringen-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [state]);

  const importData = React.useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.transactions || !Array.isArray(data.transactions)) {
          setImportMsg({ ok: false, text: 'Ongeldig bestand — geen transacties gevonden' }); return;
        }
        if (!data.widgets)       data.widgets       = DEFAULT_WIDGETS.map(w => ({ ...w }));
        if (!data.parties || !data.parties.length) {
          // Migreer legacy customParties + seed defaults
          const ids = new Set();
          const merged = [];
          for (const p of [...PARTIES, ...(data.customParties || [])]) {
            if (!ids.has(p.id)) { ids.add(p.id); merged.push(p); }
          }
          data.parties = merged;
        }
        delete data.customParties;
        if (!data.hiddenParties) data.hiddenParties = [];
        if (!data.tileMetrics)   data.tileMetrics   = {};
        if (!data.deletedTransactionIds) data.deletedTransactionIds = {};
        if (!data.tweaks)        data.tweaks        = { ...(window.TWEAKS || {}) };
        setSyncedState(data);
        setImportMsg({ ok: true, text: `${data.transactions.length} transacties geladen` });
      } catch { setImportMsg({ ok: false, text: 'Kon bestand niet lezen — geldig JSON?' }); }
    };
    reader.readAsText(file);
  }, [setSyncedState]);

  // spots: live prijzen + historische reeksen uit state/Supabase
  const spots = React.useMemo(() => ({
    goldSpotEurPerGram:    displayTweaks.goldSpotEurPerGram,
    silverSpotEurPerOunce: displayTweaks.silverSpotEurPerOunce,
    btcSpotEur:            displayTweaks.btcSpotEur,
    ethSpotEur:            displayTweaks.ethSpotEur,
    paxgSpotEur:           displayTweaks.paxgSpotEur,
    // Meesman: uit state, tweaks als fallback
    meesmanNavEur:         state.meesmanNavEur     ?? displayTweaks.meesmanNavEur     ?? 100.4,
    meesmanNavHistory:     (state.meesmanNavHistory?.length ? state.meesmanNavHistory : null)
                           ?? displayTweaks.meesmanNavHistory ?? [],
    goldHistory:           state.goldHistory   || [],
    silverHistory:         state.silverHistory || [],
    btcHistory:            state.btcHistory    || [],
    ethHistory:            state.ethHistory    || [],
    paxgHistory:           state.paxgHistory   || [],
  }), [displayTweaks.goldSpotEurPerGram, displayTweaks.silverSpotEurPerOunce,
       displayTweaks.btcSpotEur, displayTweaks.ethSpotEur, displayTweaks.paxgSpotEur,
       displayTweaks.meesmanNavEur, displayTweaks.meesmanNavHistory,
       state.meesmanNavEur, state.meesmanNavHistory,
       state.goldHistory, state.silverHistory,
       state.btcHistory, state.ethHistory, state.paxgHistory]);

  // state.parties is dé bron van waarheid (gesynced via Supabase).
  // Bij allereerste run vóór migratie van loadState: fallback op de seed PARTIES.
  const allParties = React.useMemo(
    () => (state.parties && state.parties.length) ? state.parties : PARTIES,
    [state.parties]
  );
  const summaries = React.useMemo(
    () => allParties.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots, allParties]
  );
  const mobileDetailParty = mobileDetailPartyId ? allParties.find(p => p.id === mobileDetailPartyId) : null;
  const mobileDetailSummary = mobileDetailParty ? summaries.find(s => s.party.id === mobileDetailParty.id) : null;
  const saveMobileTx = React.useCallback(tx => {
    const updatedAt = new Date().toISOString();
    const stampedTx = { ...tx, updatedAt };
    setSyncedState(s => {
      const exists = s.transactions.some(t => t.id === tx.id);
      const { [tx.id]: _deleted, ...deletedTransactionIds } = s.deletedTransactionIds || {};
      return { ...s, transactions: exists
        ? s.transactions.map(t => t.id === tx.id ? stampedTx : t)
        : [...s.transactions, stampedTx],
        deletedTransactionIds };
    });
  }, [setSyncedState]);
  const deleteMobileTx = React.useCallback(id => {
    if (!confirm('Transactie verwijderen?')) return;
    setSyncedState(s => ({
      ...s,
      transactions: s.transactions.filter(t => t.id !== id),
      deletedTransactionIds: { ...(s.deletedTransactionIds || {}), [id]: new Date().toISOString() },
    }));
  }, [setSyncedState]);
  const openMobileTx = React.useCallback((preset = null) => {
    setMobileEditingTx(null);
    setMobileTxPreset(preset);
    setMobileTxOpen(true);
  }, []);
  const editMobileTx = React.useCallback(tx => {
    setMobileEditingTx(tx);
    setMobileTxPreset(null);
    setMobileTxOpen(true);
  }, []);

  const sbOk = !!(supabaseConfig.url && supabaseConfig.anonKey);

  const previewVariant = window.__PREVIEW_VARIANT__;
  const PreviewShell = previewVariant && window.PREVIEW_SHELLS?.[previewVariant];
  const PreviewDashboard = previewVariant && window.PREVIEW_DASHBOARDS?.[previewVariant];
  const usePreview = !!(previewVariant && PreviewShell && PreviewDashboard);

  const previewTotals = React.useMemo(() => {
    if (!usePreview) return null;
    const included = summaries.filter(s => s.party.includeInPortfolio !== false);
    const total = included.reduce((s, x) => s + x.currentValueEur, 0);
    const invested = included.reduce((s, x) => s + x.invested, 0);
    const pnl = included.reduce((s, x) => s + x.pnl, 0);
    return {
      total, invested, pnl,
      pnlPct: invested > 0 ? (pnl / invested) * 100 : 0,
      spots: displayTweaks,
    };
  }, [usePreview, summaries, displayTweaks]);

  if (usePreview) {
    const shellProps = {
      variant: previewVariant,
      activeTab, setActiveTab,
      totals: previewTotals,
      onSettings: () => setTweaksOpen(o => !o),
      onRefresh: refreshSpot,
      spotStatus, syncStatus, sbOk, tweaksOpen,
    };
    return (
      <>
        <PreviewShell {...shellProps}>
          {activeTab === 'dashboard' && (
            <PreviewDashboard state={state} setState={setSyncedState}
              tweaks={displayTweaks} setTweaks={updateTweaks}
              spotStatus={spotStatus} onRefreshSpot={refreshSpot}
              onUpdateMeesman={updateMeesmanNav} />
          )}
          {activeTab === 'transacties' && (
            <TransactionsTab state={state} setState={setSyncedState} spots={spots} />
          )}
          {activeTab === 'pensioen' && (
            <PensionTab summaries={summaries} />
          )}
        </PreviewShell>
        {tweaksOpen && (
          <TweaksPanel
            tweaks={displayTweaks} setTweaks={updateTweaks}
            onReset={resetData}
            onExport={exportData} onImport={importData} importMsg={importMsg}
            spotStatus={spotStatus} onRefreshSpot={refreshSpot}
            t212Status={t212Status} onImportT212={importT212} onDeleteT212={deleteT212Txs}
            supabaseConfig={supabaseConfig} setSupabaseConfig={setSupabaseConfig}
            syncStatus={syncStatus} onSyncNow={syncNow}
            onClose={() => setTweaksOpen(false)}
            meesmanNav={state.meesmanNavEur} meesmanHistory={state.meesmanNavHistory}
            onUpdateMeesman={updateMeesmanNav}
            histStatus={meesmanHistStatus} onLoadHistory={loadMeesmanHistory}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Global nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="nav-inner" style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 0 }}>
          <span className="nav-mobile-brand" style={{ display: 'none' }}>Investeringen</span>
          <div className="nav-tab-btns" style={{ display: 'flex' }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 18px', fontFamily: 'inherit', fontSize: 14,
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? 'var(--fg)' : 'var(--fg-muted)',
                  background: 'transparent', border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--fg)' : '2px solid transparent',
                  cursor: 'pointer', letterSpacing: '-0.01em',
                  transition: 'color .15s, border-color .15s', marginBottom: -1,
                }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isMobile && (
              <>
                <button onClick={() => flushSave().finally(() => reloadSupabase())} disabled={syncStatus?.loading}
                  title="Alles opnieuw ophalen uit Supabase"
                  style={{
                    padding: '5px 10px', fontFamily: 'inherit', fontSize: 13,
                    background: 'transparent',
                    color: syncStatus?.loading ? 'var(--fg-dim)' : 'var(--fg-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', cursor: syncStatus?.loading ? 'default' : 'pointer',
                    lineHeight: 1, transition: 'all .15s',
                  }}>
                  {syncStatus?.loading ? '…' : '⇄'}
                </button>
                <button onClick={refreshSpot} disabled={spotStatus?.loading} title="Live koersen verversen"
                  style={{
                    padding: '5px 10px', fontFamily: 'inherit', fontSize: 13,
                    background: 'transparent',
                    color: spotStatus?.loading ? 'var(--fg-dim)' : 'var(--fg-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', cursor: spotStatus?.loading ? 'default' : 'pointer',
                    lineHeight: 1, transition: 'all .15s',
                  }}>
                  {spotStatus?.loading ? '…' : '↻'}
                </button>
              </>
            )}
            <span className="nav-theme-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)', marginRight: 4 }}>Thema</span>
            <div className="nav-themes-row" style={{ display: 'contents' }}>
              {THEMES.map(t => (
                <button key={t.key} onClick={() => updateTweaks(tw => ({ ...tw, theme: t.key }))}
                  title={t.label}
                  style={{
                    padding: '5px 10px', fontFamily: 'inherit', fontSize: 11,
                    fontWeight: tweaks.theme === t.key ? 600 : 400,
                    background: tweaks.theme === t.key ? 'var(--fg)' : 'transparent',
                    color: tweaks.theme === t.key ? 'var(--bg)' : 'var(--fg-muted)',
                    border: '1px solid ' + (tweaks.theme === t.key ? 'var(--fg)' : 'var(--border)'),
                    borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <select className="nav-theme-select" value={tweaks.theme}
              onChange={e => updateTweaks(tw => ({ ...tw, theme: e.target.value }))}>
              {THEMES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            {/* Sync indicator */}
            {sbOk && (
              <span title={syncStatus.error ? syncStatus.error : syncStatus.syncedAt ? 'Supabase: gesynchroniseerd' : 'Supabase: sync actief'}
                style={{ fontSize: 14, color: syncStatus.error ? 'var(--negative)' : syncStatus.loading ? 'var(--fg-dim)' : 'var(--positive)', lineHeight: 1 }}>
                {syncStatus.loading ? '↻' : syncStatus.error ? '⚠' : '●'}
              </span>
            )}
            <button onClick={() => setTweaksOpen(o => !o)} title="Instellingen"
              style={{
                marginLeft: 4, padding: '5px 10px', fontFamily: 'inherit', fontSize: 15,
                background: tweaksOpen ? 'var(--fg)' : 'transparent',
                color: tweaksOpen ? 'var(--bg)' : 'var(--fg-muted)',
                border: '1px solid ' + (tweaksOpen ? 'var(--fg)' : 'var(--border)'),
                borderRadius: 'var(--radius)', cursor: 'pointer', lineHeight: 1, transition: 'all .15s',
              }}>
              ⚙
            </button>
            <a href="./preview/index.html" title="UI Preview — 3 nieuwe designs"
              style={{
                marginLeft: 4, padding: '5px 10px', fontFamily: 'inherit', fontSize: 11,
                color: 'var(--fg-dim)', textDecoration: 'none',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                lineHeight: 1, transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
              Preview
            </a>
          </div>
        </div>
      </nav>

      {isMobile ? (
        <>
          {mobileTab === 'home' && (
            <Dashboard state={state} setState={setSyncedState}
              tweaks={displayTweaks} setTweaks={updateTweaks}
              spotStatus={spotStatus} onRefreshSpot={refreshSpot}
              addTrigger={mobileAddTrigger} isMobile={true}
              onOpenParty={partyId => setMobileDetailPartyId(partyId)}
              onUpdateMeesman={updateMeesmanNav} />
          )}
          {mobileTab === 'partijen' && (
            <MobilePartijenView summaries={summaries}
              onOpenParty={partyId => setMobileDetailPartyId(partyId)}
              onQuickAdd={() => { setMobileTab('home'); setMobileAddTrigger(t => t + 1); }}
            />
          )}
          {mobileTab === 'transacties' && (
            <TransactionsTab state={state} setState={setSyncedState} spots={spots} />
          )}
        </>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <Dashboard state={state} setState={setSyncedState}
              tweaks={displayTweaks} setTweaks={updateTweaks}
              spotStatus={spotStatus} onRefreshSpot={refreshSpot}
              onUpdateMeesman={updateMeesmanNav} />
          )}
          {activeTab === 'transacties' && (
            <TransactionsTab state={state} setState={setSyncedState} spots={spots} />
          )}
          {activeTab === 'pensioen' && (
            <PensionTab summaries={summaries} />
          )}
        </>
      )}

      {isMobile && (
        <MobileNav
          tab={mobileTab}
          onTab={setMobileTab}
          onAdd={() => { setMobileTab('home'); setMobileAddTrigger(t => t + 1); }}
          onSettings={() => setTweaksOpen(o => !o)}
          tweaksOpen={tweaksOpen}
        />
      )}

      {isMobile && (
        <>
          <PartyDetail
            open={!!mobileDetailPartyId}
            onClose={() => setMobileDetailPartyId(null)}
            party={mobileDetailParty}
            summary={mobileDetailSummary}
            spots={spots}
            onAddTx={preset => { setMobileDetailPartyId(null); openMobileTx(preset); }}
            onDeleteTx={deleteMobileTx}
            onEditTx={tx => { setMobileDetailPartyId(null); editMobileTx(tx); }}
          />
          <TransactionModal
            open={mobileTxOpen}
            onClose={() => { setMobileTxOpen(false); setMobileEditingTx(null); }}
            onSave={saveMobileTx}
            parties={allParties}
            preset={mobileTxPreset}
            initial={mobileEditingTx}
            transactions={state.transactions}
          />
        </>
      )}

      {tweaksOpen && (
        <TweaksPanel
          tweaks={displayTweaks} setTweaks={updateTweaks}
          onReset={resetData}
          onExport={exportData} onImport={importData} importMsg={importMsg}
          spotStatus={spotStatus} onRefreshSpot={refreshSpot}
          t212Status={t212Status} onImportT212={importT212} onDeleteT212={deleteT212Txs}
          supabaseConfig={supabaseConfig} setSupabaseConfig={setSupabaseConfig}
          syncStatus={syncStatus} onSyncNow={syncNow}
          onClose={() => setTweaksOpen(false)}
          meesmanNav={state.meesmanNavEur} meesmanHistory={state.meesmanNavHistory}
          onUpdateMeesman={updateMeesmanNav}
          histStatus={meesmanHistStatus} onLoadHistory={loadMeesmanHistory}
        />
      )}
    </>
  );
}

function MeesmanTweakRow({ meesmanNav, meesmanHistory, onUpdateMeesman, histStatus, onLoadHistory }) {
  const [inp, setInp] = React.useState('');
  const lastEntry = (meesmanHistory || []).slice(-1)[0];
  const save = () => {
    const v = parseFloat((inp || '').replace(',', '.'));
    if (v > 0) { onUpdateMeesman(v); setInp(''); }
  };
  return (
    <div style={{ display:'grid', gap:6 }}>
      <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:12 }}>
        <span style={{ color:'var(--fg-muted)', flexShrink:0 }}>
          Meesman (€/aandeel)
          {lastEntry && <span style={{ color:'var(--fg-dim)', fontSize:10, display:'block' }}>{lastEntry.date} · {(meesmanHistory||[]).length} punten</span>}
        </span>
        <input type="number" step="0.01" value={inp}
          onChange={e => setInp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder={(meesmanNav || 100.4).toFixed(2)}
          style={{ ...inputStyle, width:108, padding:'5px 8px', fontFamily:'var(--ff-mono)', fontSize:12 }} />
      </label>
      {inp.length > 0 && (
        <button onClick={save}
          style={{ padding:'5px 10px', fontSize:11, background:'var(--accent)', color:'#fff', border:'none',
            borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          Opslaan €{parseFloat((inp||'').replace(',','.'))||0}
        </button>
      )}
      <button onClick={onLoadHistory} disabled={histStatus?.loading}
        style={{ padding:'5px 10px', fontSize:11, background:'var(--surface-2)',
          border:'1px solid var(--border)', borderRadius:'var(--radius)',
          cursor:'pointer', fontFamily:'inherit', opacity: histStatus?.loading ? 0.6 : 1,
          color: histStatus?.done ? 'var(--positive)' : 'var(--fg)' }}>
        {histStatus?.loading ? '↻ Laden…' : histStatus?.done ? '✓ 2j history geladen' : '↓ Laad 2j history (Yahoo Finance)'}
      </button>
      {histStatus?.error && <div style={{ fontSize:10, color:'var(--negative)', fontFamily:'var(--ff-mono)' }}>⚠ {histStatus.error}</div>}
    </div>
  );
}

function TweaksPanel({ tweaks, setTweaks, onReset, onClose,
                       spotStatus, onRefreshSpot,
                       t212Status, onImportT212, onDeleteT212,
                       onExport, onImport, importMsg,
                       supabaseConfig, setSupabaseConfig, syncStatus, onSyncNow,
                       meesmanNav, meesmanHistory, onUpdateMeesman,
                       histStatus, onLoadHistory }) {

  const fileRef = React.useRef(null);

  const priceRow = (label, key, step = '0.01') => (
    <label key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:12 }}>
      <span style={{ color:'var(--fg-muted)', flexShrink:0 }}>{label}</span>
      <input type="number" step={step} value={tweaks[key] ?? ''}
        onChange={e => setTweaks(tw => ({...tw, [key]: +e.target.value}))}
        style={{ ...inputStyle, width:108, padding:'5px 8px', fontFamily:'var(--ff-mono)', fontSize:12 }} />
    </label>
  );

  const hasT212Auth = !!(tweaks.t212ApiKey || '').trim();
  const sbReady     = !!(supabaseConfig?.url && supabaseConfig?.anonKey);

  return (
    <div className="tweaks-panel" style={{ position:'fixed', bottom:20, right:20, width:320,
      background:'var(--surface)', border:'1px solid var(--border-strong)',
      borderRadius:'var(--radius-lg)', boxShadow:'0 20px 40px rgba(0,0,0,0.25)', zIndex:90, overflow:'hidden' }}>

      <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'var(--ff-display)', fontSize:17, fontWeight:500 }}>Instellingen</div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--fg-muted)', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'14px 16px', display:'grid', gap:16, maxHeight:'80vh', overflowY:'auto' }}>

        {/* ── Supabase sync ── */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <SectionLabel>☁ Supabase sync</SectionLabel>
            {sbReady && (
              <button onClick={onSyncNow} disabled={syncStatus?.loading}
                style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--fg-muted)',
                  padding:'3px 8px', borderRadius:'var(--radius)', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
                {syncStatus?.loading ? '…' : '↑↓ Nu syncen'}
              </button>
            )}
          </div>
          <div style={{ display:'grid', gap:8 }}>
            <label style={{ fontSize:12 }}>
              <div style={{ color:'var(--fg-muted)', marginBottom:4 }}>
                Project URL <span style={{ color:'var(--fg-dim)' }}>(https://xxxx.supabase.co)</span>
              </div>
              <input value={supabaseConfig?.url || ''}
                onChange={e => setSupabaseConfig(c => ({...c, url: e.target.value}))}
                placeholder="https://abcdefgh.supabase.co"
                style={{ ...inputStyle, width:'100%', padding:'7px 10px', fontSize:12, fontFamily:'var(--ff-mono)' }} />
            </label>
            <label style={{ fontSize:12 }}>
              <div style={{ color:'var(--fg-muted)', marginBottom:4 }}>
                Anon key <span style={{ color:'var(--fg-dim)' }}>(opgeslagen lokaal)</span>
              </div>
              <input type="password" value={supabaseConfig?.anonKey || ''}
                onChange={e => setSupabaseConfig(c => ({...c, anonKey: e.target.value}))}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                style={{ ...inputStyle, width:'100%', padding:'7px 10px', fontSize:12, fontFamily:'var(--ff-mono)' }} />
            </label>
            {syncStatus?.error && (
              <div style={{ fontSize:10, fontFamily:'var(--ff-mono)', color:'var(--negative)' }}>
                ⚠ {syncStatus.error}
              </div>
            )}
            {syncStatus?.syncedAt && !syncStatus.error && (
              <div style={{ fontSize:10, fontFamily:'var(--ff-mono)', color:'var(--positive)' }}>
                ✓ Gesynchroniseerd {new Date(syncStatus.syncedAt).toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'})}
              </div>
            )}
            {!sbReady && (
              <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.6, padding:'8px', background:'var(--surface-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                <b>Setup:</b> Maak een gratis project aan op <b>supabase.com</b>. Voer de volgende SQL uit in de <b>SQL Editor</b> van je project:<br/><br/>
                <code style={{ fontFamily:'var(--ff-mono)', display:'block', whiteSpace:'pre-wrap', fontSize:10, color:'var(--fg-muted)' }}>
                  {`create table if not exists portfolio (\n  id text primary key,\n  data jsonb not null default '{}',\n  updated_at timestamptz default now()\n);\nalter table portfolio enable row level security;\ndrop policy if exists "allow all" on portfolio;\ncreate policy "allow all" on portfolio\n  for all using (true) with check (true);`}
                </code><br/>
                Kopieer dan je <b>Project URL</b> en <b>anon public key</b> uit <b>Project Settings → API</b>.
              </div>
            )}
          </div>
        </div>

        {/* ── Live prijzen ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <SectionLabel>Live prijzen</SectionLabel>
            <button onClick={onRefreshSpot} disabled={spotStatus?.loading}
              style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--fg-muted)',
                padding:'3px 8px', borderRadius:'var(--radius)', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
              {spotStatus?.loading ? '…' : '↻ Verversen'}
            </button>
          </div>
          <div style={{ display:'grid', gap:7 }}>
            {priceRow('Goud (€/g)',          'goldSpotEurPerGram')}
            {priceRow('Zilver (€/oz)',        'silverSpotEurPerOunce')}
            {priceRow('Bitcoin (€/BTC)',      'btcSpotEur', '1')}
            {priceRow('Ethereum (€/ETH)',     'ethSpotEur', '0.01')}
            {priceRow('Pax Gold (€/PAXG)',   'paxgSpotEur', '0.01')}
            {/* Meesman NAV — apart bijwerken zodat history correct blijft */}
            <MeesmanTweakRow
              meesmanNav={meesmanNav} meesmanHistory={meesmanHistory}
              onUpdateMeesman={onUpdateMeesman}
              histStatus={histStatus} onLoadHistory={onLoadHistory} />
          </div>
          <div style={{ fontSize:10, marginTop:7, fontFamily:'var(--ff-mono)',
            color: spotStatus?.error ? 'var(--negative)' : 'var(--fg-dim)' }}>
            {spotStatus?.error ? '⚠ ' + spotStatus.error
              : spotStatus?.fetchedAt ? 'Bijgewerkt ' + new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL')
              : spotStatus?.loading ? 'ophalen…' : 'handmatig'}
          </div>
        </div>

        {/* ── Trading 212 ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <SectionLabel style={{ marginBottom:10 }}>Trading 212 import</SectionLabel>
          <div style={{ display:'grid', gap:8 }}>
            <div style={{ display:'flex', gap:6 }}>
              {['live','demo'].map(m => (
                <button key={m} onClick={() => setTweaks(tw => ({...tw, t212Mode: m}))} type="button"
                  style={{ flex:1, padding:'7px', fontSize:12,
                    background: (tweaks.t212Mode||'live')===m ? 'var(--fg)' : 'var(--surface-2)',
                    color:      (tweaks.t212Mode||'live')===m ? 'var(--bg)' : 'var(--fg)',
                    border:'1px solid '+((tweaks.t212Mode||'live')===m ? 'var(--fg)' : 'var(--border)'),
                    borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                  {m === 'live' ? '🟢 Live' : '🧪 Paper'}
                </button>
              ))}
            </div>
            <label style={{ fontSize:12 }}>
              <div style={{ color:'var(--fg-muted)', marginBottom:4 }}>API Key <span style={{ color:'var(--fg-dim)' }}>(T212 → Instellingen → API)</span></div>
              <input type="password" value={tweaks.t212ApiKey || ''}
                onChange={e => setTweaks(tw => ({...tw, t212ApiKey: e.target.value}))}
                placeholder="Plak je T212 API Key..."
                style={{ ...inputStyle, width:'100%', padding:'7px 10px', fontSize:12, fontFamily:'var(--ff-mono)' }} />
            </label>
            <button onClick={onImportT212} disabled={!hasT212Auth || t212Status?.loading}
              style={{ padding:'8px 12px', fontSize:12, background:'var(--surface-2)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                cursor: hasT212Auth ? 'pointer' : 'default',
                color: hasT212Auth ? 'var(--fg)' : 'var(--fg-dim)',
                fontFamily:'inherit', opacity: hasT212Auth ? 1 : 0.5 }}>
              {t212Status?.loading ? '…bezig' : '↓ Importeer transacties'}
            </button>
            {(t212Status?.error || t212Status?.done) && (
              <div style={{ fontSize:10, fontFamily:'var(--ff-mono)',
                color: t212Status.error ? 'var(--negative)' : 'var(--positive)' }}>
                {t212Status.error ? '⚠ ' + t212Status.error : `✓ ${t212Status.imported} nieuwe transacties geïmporteerd`}
              </div>
            )}
            <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.5 }}>
              Genereer een key via T212 → Instellingen → API. Duplicaten worden overgeslagen.
            </div>
            <button onClick={onDeleteT212}
              style={{ padding:'7px 12px', fontSize:11, background:'transparent',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                color:'var(--negative)', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
              ✕ Verwijder alle T212 transacties
            </button>
          </div>
        </div>

        {/* ── Data opslaan ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <SectionLabel style={{ marginBottom:10 }}>Data opslaan</SectionLabel>
          <div style={{ display:'grid', gap:8 }}>
            <button onClick={onExport}
              style={{ padding:'8px 12px', fontSize:12, background:'var(--surface-2)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                cursor:'pointer', color:'var(--fg)', fontFamily:'inherit', textAlign:'left' }}>
              ↓ Exporteer data als JSON
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }}
              onChange={e => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ padding:'8px 12px', fontSize:12, background:'var(--surface-2)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                cursor:'pointer', color:'var(--fg)', fontFamily:'inherit', textAlign:'left' }}>
              ↑ Importeer data uit JSON
            </button>
            {importMsg && (
              <div style={{ fontSize:10, fontFamily:'var(--ff-mono)',
                color: importMsg.ok ? 'var(--positive)' : 'var(--negative)' }}>
                {importMsg.ok ? '✓ ' : '⚠ '}{importMsg.text}
              </div>
            )}
            <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.5 }}>
              Data wordt automatisch opgeslagen in je browser. Exporteer als backup of voor overdracht naar ander apparaat.
            </div>
          </div>
        </div>

        {/* ── Visuele stijl ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <SectionLabel style={{ marginBottom:10 }}>Visuele stijl</SectionLabel>
          <div style={{ display:'grid', gap:6 }}>
            {THEMES.map(t => (
              <button key={t.key} onClick={() => setTweaks(tw => ({...tw, theme:t.key}))}
                style={{ textAlign:'left', padding:'8px 12px',
                  background: tweaks.theme===t.key ? 'var(--fg)' : 'var(--surface-2)',
                  color:      tweaks.theme===t.key ? 'var(--bg)' : 'var(--fg)',
                  border:'1px solid '+(tweaks.theme===t.key ? 'var(--fg)' : 'var(--border)'),
                  borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500,
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>{t.label}</span>
                {tweaks.theme===t.key && <span style={{ fontSize:11 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Reset ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <button onClick={onReset}
            style={{ width:'100%', padding:'8px 12px', fontSize:12, background:'transparent',
              border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--negative)',
              cursor:'pointer', fontFamily:'inherit' }}>
            ↺ Reset naar begindata
          </button>
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize:10, fontWeight:600, color:'var(--fg-muted)', textTransform:'uppercase',
      letterSpacing:'0.08em', ...style }}>
      {children}
    </div>
  );
}

function MobileNav({ tab, onTab, onAdd, onSettings, tweaksOpen }) {
  const active = key => tab === key;

  const HomeIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
    </svg>
  );
  const GridIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  const GearIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
  const ListIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>
      <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none"/>
      <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );

  return (
    <div className="mob-nav">
      <button className={`mob-nav-btn${active('home') ? ' mob-active' : ''}`} onClick={() => onTab('home')}>
        <HomeIcon /><span>Home</span>
      </button>
      <button className={`mob-nav-btn${active('partijen') ? ' mob-active' : ''}`} onClick={() => onTab('partijen')}>
        <GridIcon /><span>Partijen</span>
      </button>
      <div className="mob-nav-plus-wrap">
        <button className="mob-nav-plus" onClick={onAdd}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <button className={`mob-nav-btn${tweaksOpen ? ' mob-active' : ''}`} onClick={onSettings}>
        <GearIcon /><span>Instellingen</span>
      </button>
      <button className={`mob-nav-btn${active('transacties') ? ' mob-active' : ''}`} onClick={() => onTab('transacties')}>
        <ListIcon /><span>Transacties</span>
      </button>
    </div>
  );
}

function MeesmanPriceBanner({ state, onUpdate, histStatus, onLoadHistory }) {
  const [input, setInput]         = React.useState('');
  const [dismissed, setDismissed] = React.useState(false);

  const history   = state.meesmanNavHistory || [];
  const lastEntry = history.length ? history[history.length - 1] : null;
  const lastDate  = lastEntry?.date || null;
  const daysSince = lastDate
    ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
    : 999;

  // Verberg banner als recent bijgewerkt en history heeft genoeg punten
  if (dismissed || (daysSince < 7 && history.length >= 20)) return null;

  const handleSave = () => {
    const v = parseFloat((input || '').replace(',', '.'));
    if (v > 0) { onUpdate(v); setDismissed(true); }
  };

  const needsHistory = history.length < 20;

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '2px solid oklch(72% 0.16 75)',
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      zIndex: 40, position: 'relative' }}>
      <span style={{ fontSize: 15 }}>📈</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Meesman</span>
      {lastEntry ? (
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--ff-mono)' }}>
          €{lastEntry.nav.toFixed(2)} · {daysSince > 0 ? `${daysSince}d geleden` : 'vandaag'}
          {history.length > 1 && ` · ${history.length} punten`}
        </span>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Geen history</span>
      )}

      {/* Historische data ophalen van Yahoo Finance */}
      {needsHistory && (
        <button onClick={onLoadHistory} disabled={histStatus?.loading}
          style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            background: histStatus?.done ? 'var(--positive)' : 'var(--surface-2)',
            color: histStatus?.done ? '#fff' : 'var(--fg)', opacity: histStatus?.loading ? 0.6 : 1 }}>
          {histStatus?.loading ? '↻ Laden…' : histStatus?.done ? '✓ Geladen' : '↓ Laad 2j history'}
        </button>
      )}
      {histStatus?.error && (
        <span style={{ fontSize: 10, color: 'var(--negative)', fontFamily: 'var(--ff-mono)' }}>
          ⚠ {histStatus.error}
        </span>
      )}

      {/* Handmatige weekelijkse prijs-update */}
      {daysSince >= 7 && (
        <>
          <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>· Nieuwe koers:</span>
          <input
            type="number" step="0.01" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={lastEntry ? lastEntry.nav.toFixed(2) : '100.40'}
            style={{ width: 80, padding: '4px 7px', fontSize: 13, fontFamily: 'var(--ff-mono)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--fg)', outline: 'none' }}
          />
          <button onClick={handleSave}
            style={{ padding: '4px 12px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
            Opslaan
          </button>
        </>
      )}

      <button onClick={() => setDismissed(true)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)',
          fontSize: 18, lineHeight: 1, marginLeft: 'auto', padding: '0 2px' }}>
        ×
      </button>
    </div>
  );
}

function formatMobileHolding(summary) {
  const p = summary.party;
  if (p.isMixed) {
    return `Au ${fmtQty(summary.goldQty || 0, 'g')} · Ag ${fmtQty((summary.silverQty || 0) * OZ_TO_GRAM, 'g')}`;
  }
  if (p.unit === 'crypto') return fmtQty(summary.quantity || 0, p.unitLabel || p.unit, { decimals: 8 });
  if (p.unit === 'part') return fmtQty(summary.quantity || 0, p.unitLabel || 'part.');
  if (p.unit === 'bundle') return fmtEur(summary.quantity || 0, { decimals: 2 });
  if (p.unit === 'eur') return fmtEur(summary.currentValueEur || 0, { decimals: 2 });
  return fmtQty(summary.quantity || 0, p.unitLabel || p.unit);
}

function mobilePartyDisplay(summary, mode) {
  if (mode === 'holding') return { text: formatMobileHolding(summary), tone: 'muted', label: 'Hoeveelheid' };
  if (mode === 'value') return { text: fmtEur(summary.currentValueEur), tone: 'neutral', label: 'Waarde' };
  if (mode === 'invested') return { text: fmtEur(summary.invested), tone: 'neutral', label: 'Ingelegd' };
  if (mode === 'pnl_eur') {
    const value = summary.pnl || 0;
    return { text: `${value >= 0 ? '+' : '−'}${fmtEur(Math.abs(value))}`, tone: value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted', label: 'Winst' };
  }
  if (mode === 'pnl_pct') {
    const value = summary.pnlPct || 0;
    return { text: `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, tone: value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted', label: 'Winst' };
  }
  if (mode === 'yr_pct') {
    const value = summary.cagr || 0;
    return { text: `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, tone: value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted', label: 'Per jaar', sub: `CAGR ${summary.years.toFixed(1)}j` };
  }
  return { text: fmtEur(summary.currentValueEur), tone: 'neutral', label: 'Waarde' };
}

function MobilePartijenView({ summaries, onOpenParty, onQuickAdd }) {
  const DISPLAY_OPTIONS = [
    { key: 'holding', label: 'Hoeveelheid' },
    { key: 'value',   label: 'Waarde' },
    { key: 'pnl_eur', label: 'Winst €' },
    { key: 'pnl_pct', label: 'Winst %' },
    { key: 'invested', label: 'Ingelegd' },
    { key: 'yr_pct',  label: 'Per jaar' },
  ];
  const [displayMode, setDisplayMode] = React.useState('pnl_eur');

  const enriched = summaries
    .map(s => {
      const dates = (s.transactions || []).map(t => t.date).sort();
      const firstDate = dates[0];
      const years = firstDate
        ? Math.max((Date.now() - new Date(firstDate).getTime()) / (365.25 * 86400000), 1/12)
        : 1;
      const yearlyEur = s.pnl / years;
      // CAGR: alleen berekenen als invested > 0 en years >= 1 maand
      const cagr = (s.invested > 0 && s.currentValueEur > 0 && years > 0.08)
        ? (Math.pow(s.currentValueEur / s.invested, 1 / years) - 1) * 100
        : 0;
      return { ...s, years, yearlyEur, cagr };
    })
    .sort((a, b) => (b.currentValueEur || 0) - (a.currentValueEur || 0));
  const includedEnriched = enriched.filter(s => s.party.includeInPortfolio !== false);

  return (
    <div style={{ padding: '16px 14px 100px' }}>
      {/* Display toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {DISPLAY_OPTIONS.map(m => (
          <button key={m.key} onClick={() => setDisplayMode(m.key)}
            style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
              borderRadius: 999,
              border: '1px solid ' + (displayMode === m.key ? 'var(--fg)' : 'var(--border)'),
              background: displayMode === m.key ? 'var(--fg)' : 'transparent',
              color: displayMode === m.key ? 'var(--bg)' : 'var(--fg-muted)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Totaalregel */}
      {(() => {
        const totalVal  = includedEnriched.reduce((s, x) => s + x.currentValueEur, 0);
        const totalPnl  = includedEnriched.reduce((s, x) => s + x.pnl, 0);
        const totalInv  = includedEnriched.reduce((s, x) => s + x.invested, 0);
        const totalPct  = totalInv > 0 ? (totalPnl / totalInv) * 100 : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
            background: 'linear-gradient(180deg, var(--surface), var(--surface-2))',
            borderRadius: 'var(--radius-lg)', marginBottom: 10,
            border: '1px solid var(--border)', boxShadow: '0 8px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--ff-mono)' }}>Totaal</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, fontWeight: 600 }}>
                {fmtEur(totalVal)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
                {includedEnriched.length} partijen in totaal
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--ff-mono)', fontSize: 13,
              color: totalPnl >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
              {totalPnl >= 0 ? '+' : ''}{fmtEur(totalPnl)}<br/>
              <span style={{ fontSize: 11 }}>{totalPct >= 0 ? '+' : ''}{totalPct.toFixed(1)}%</span>
            </div>
          </div>
        );
      })()}

      {/* Party list */}
      <div style={{ display: 'grid', gap: 8 }}>
        {enriched.map(s => {
          const shown = mobilePartyDisplay(s, displayMode);
          const color = shown.tone === 'positive' ? 'var(--positive)'
            : shown.tone === 'negative' ? 'var(--negative)'
            : shown.tone === 'muted' ? 'var(--fg-muted)'
            : 'var(--fg)';

          return (
            <button key={s.party.id} onClick={() => onOpenParty && onOpenParty(s.party.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
              padding: '12px 13px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
              cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.party.color,
                flexShrink: 0, display:'grid', placeItems:'center', boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.35)' }}>
                <span style={{ width: 8, height: 8, borderRadius:'50%', background:'#fff', opacity:0.85 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.party.name}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3, minWidth:0 }}>
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--ff-mono)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.party.category || 'Partij'}
                  </span>
                  {s.party.includeInPortfolio === false && (
                    <>
                      <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--fg-dim)', flexShrink:0 }} />
                      <span style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)', whiteSpace:'nowrap' }}>
                        niet in totaal
                      </span>
                    </>
                  )}
                  <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--fg-dim)', flexShrink:0 }} />
                  <span style={{ fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)' }}>
                    {fmtEur(s.currentValueEur, { decimals: 0 })}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 650,
                color, flexShrink: 0, maxWidth: 155 }}>
                <div style={{ fontSize: 9, color:'var(--fg-dim)', fontWeight: 500, marginBottom: 2 }}>
                  {shown.label}
                </div>
                <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shown.text}</div>
                {shown.sub && <div style={{ fontSize: 9, color: 'var(--fg-dim)', fontWeight: 400 }}>{shown.sub}</div>}
              </div>
              <div aria-hidden="true" style={{ color:'var(--fg-dim)', fontSize:18, lineHeight:1, marginLeft:-3 }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
