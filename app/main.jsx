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
const T212_PROXY     = 'https://corsproxy.io/?url=';
const GIST_API       = 'https://api.github.com/gists';
const GIST_CFG_KEY   = 'investeringen-gist-v1';

// ── Price history helper ──────────────────────────────────────
function appendToHistory(existing, date, price) {
  if (!price) return existing || [];
  const arr = (existing || []).filter(h => h.date !== date);
  arr.push({ date, nav: +price });
  arr.sort((a, b) => a.date.localeCompare(b.date));
  return arr.slice(-1095); // 3 jaar max
}

// ── GitHub Gist helpers ───────────────────────────────────────
function loadGistConfig() {
  try { return JSON.parse(localStorage.getItem(GIST_CFG_KEY)) || { pat: '', gistId: '' }; }
  catch { return { pat: '', gistId: '' }; }
}

function gistHeaders(pat) {
  return { Authorization: `Bearer ${pat.trim()}`, 'X-GitHub-Api-Version': '2022-11-28' };
}

async function gistLoad(pat, gistId) {
  const res = await fetch(`${GIST_API}/${gistId}`, { headers: gistHeaders(pat) });
  if (res.status === 401) throw new Error('401 — Ongeldig token. Gebruik een classic PAT (ghp_…) met "gist" scope.');
  if (!res.ok) throw new Error(`Laden mislukt (HTTP ${res.status})`);
  const data = await res.json();
  const content = data.files?.['portfolio.json']?.content;
  if (!content) throw new Error('portfolio.json niet gevonden in gist');
  return JSON.parse(content);
}

async function gistSave(pat, gistId, payload) {
  const res = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: { ...gistHeaders(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { 'portfolio.json': { content: JSON.stringify(payload) } } }),
  });
  if (res.status === 401) throw new Error('401 — Ongeldig token. Gebruik een classic PAT (ghp_…) met "gist" scope.');
  if (!res.ok) throw new Error(`Opslaan mislukt (HTTP ${res.status})`);
}

async function gistCreate(pat) {
  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: { ...gistHeaders(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Investeringen Dashboard',
      public: false,
      files: { 'portfolio.json': { content: '{}' } },
    }),
  });
  if (res.status === 401) throw new Error('401 — Ongeldig token. Gebruik een classic PAT (ghp_…) met "gist" scope.');
  if (!res.ok) throw new Error(`Aanmaken mislukt (HTTP ${res.status})`);
  return (await res.json()).id;
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
  const [tweaks, setTweaks]         = React.useState(() => ({ ...window.TWEAKS }));
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [activeTab, setActiveTab]   = React.useState('dashboard');
  const [spotStatus, setSpotStatus] = React.useState({ loading: false, error: null, fetchedAt: null });
  const [t212Status, setT212Status] = React.useState({ loading: false, error: null, imported: 0, done: false });
  const [importMsg, setImportMsg]   = React.useState(null);
  const [gistConfig, setGistConfig] = React.useState(loadGistConfig);
  const [syncStatus, setSyncStatus] = React.useState({ loading: false, error: null, syncedAt: null });
  const syncTimerRef = React.useRef(null);
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileTab, setMobileTab] = React.useState('home');
  const [mobileAddTrigger, setMobileAddTrigger] = React.useState(0);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const h = e => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Persist state to localStorage
  React.useEffect(() => { saveState(state); }, [state]);

  // Persist gist config to localStorage (PAT nooit in HTML)
  React.useEffect(() => {
    try { localStorage.setItem(GIST_CFG_KEY, JSON.stringify(gistConfig)); } catch {}
  }, [gistConfig]);

  // Lees Gist config uit URL-hash bij opstarten
  // #pat=xxx&gist=yyy → volledige beginscherm-link, URL bewaren zodat shortcut blijft werken
  // #gist=yyy         → setup-link (alleen Gist ID), URL opschonen, instellingen openen voor PAT
  React.useEffect(() => {
    const hash = window.location.hash;
    const patM  = hash.match(/[#&]pat=([^&#\s]+)/);
    const gistM = hash.match(/[#&]gist=([a-zA-Z0-9]+)/);
    if (patM && gistM) {
      // Volledige beginscherm-URL: stil configureren, URL laten staan zodat shortcut altijd werkt
      setGistConfig({ pat: decodeURIComponent(patM[1]), gistId: gistM[1] });
    } else if (gistM) {
      // Alleen Gist ID: opschonen + instellingen openen voor PAT-invoer
      setGistConfig(c => ({ ...c, gistId: c.gistId || gistM[1] }));
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setTweaksOpen(true);
    }
  }, []);

  // Laad data van gist bij opstarten (of zodra config via URL-hash binnenkomt)
  const didInitialGistLoad = React.useRef(false);
  React.useEffect(() => {
    if (!gistConfig.pat || !gistConfig.gistId) return;
    if (didInitialGistLoad.current) return;
    didInitialGistLoad.current = true;
    setSyncStatus({ loading: true, error: null, syncedAt: null });
    gistLoad(gistConfig.pat, gistConfig.gistId)
      .then(data => {
        if (data?.transactions) setState(data);
        setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
      })
      .catch(e => setSyncStatus({ loading: false, error: e.message, syncedAt: null }));
  }, [gistConfig.pat, gistConfig.gistId]); // herstart wanneer config verandert (bijv. via URL-hash)

  // Haal 1 jaar crypto-geschiedenis op als de history leeg is
  React.useEffect(() => {
    if ((state.btcHistory || []).length > 10) return;
    fetchCryptoHistory()
      .then(h => setState(s => ({ ...s, ...h })))
      .catch(() => {});
  }, []); // eenmalig bij mount

  // Automatisch opslaan in gist 3 seconden na elke state-wijziging
  React.useEffect(() => {
    if (!gistConfig.pat || !gistConfig.gistId) return;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      gistSave(gistConfig.pat, gistConfig.gistId, state)
        .then(() => setSyncStatus(s => ({ ...s, error: null, syncedAt: new Date().toISOString() })))
        .catch(e => setSyncStatus(s => ({ ...s, error: e.message })));
    }, 3000);
  }, [state]); // eslint-disable-line

  // Apply theme class to <html>
  React.useEffect(() => {
    const el = document.documentElement;
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

  const updateTweaks = React.useCallback(updater => {
    setTweaks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*'); } catch {}
      return next;
    });
  }, []);

  const refreshSpot = React.useCallback(async () => {
    setSpotStatus(s => ({ ...s, loading: true, error: null }));
    const [metals, crypto] = await Promise.allSettled([
      fetchSpotPrices(),
      fetchCryptoPrices(),
    ]);
    const updates = {};
    if (metals.status === 'fulfilled') {
      updates.goldSpotEurPerGram    = +metals.value.goldSpotEurPerGram.toFixed(2);
      updates.silverSpotEurPerOunce = +metals.value.silverSpotEurPerOunce.toFixed(2);
    }
    if (crypto.status === 'fulfilled') {
      updates.btcSpotEur  = +crypto.value.btcSpotEur.toFixed(2);
      updates.ethSpotEur  = +crypto.value.ethSpotEur.toFixed(2);
      updates.paxgSpotEur = +crypto.value.paxgSpotEur.toFixed(2);
    }
    if (Object.keys(updates).length) updateTweaks(tw => ({ ...tw, ...updates }));

    // Sla dagelijkse spot-prijzen op in state (persistent via localStorage + gist)
    const today = new Date().toISOString().slice(0, 10);
    setState(s => {
      const hist = {};
      if (metals.status === 'fulfilled') {
        hist.goldHistory   = appendToHistory(s.goldHistory,   today, updates.goldSpotEurPerGram);
        hist.silverHistory = appendToHistory(s.silverHistory, today, updates.silverSpotEurPerOunce);
      }
      if (crypto.status === 'fulfilled') {
        hist.btcHistory  = appendToHistory(s.btcHistory,  today, updates.btcSpotEur);
        hist.ethHistory  = appendToHistory(s.ethHistory,  today, updates.ethSpotEur);
        hist.paxgHistory = appendToHistory(s.paxgHistory, today, updates.paxgSpotEur);
      }
      return Object.keys(hist).length ? { ...s, ...hist } : s;
    });

    const errors = [
      metals.status === 'rejected' ? `Goud/zilver: ${metals.reason?.message}` : null,
      crypto.status === 'rejected' ? `Crypto: ${crypto.reason?.message}`       : null,
    ].filter(Boolean);
    setSpotStatus({ loading: false, error: errors.length ? errors.join(' · ') : null, fetchedAt: new Date().toISOString() });
  }, [updateTweaks]);

  // Meesman NAV handmatig bijwerken (opgeslagen in state → Gist-sync)
  const updateMeesmanNav = React.useCallback((nav) => {
    const today = new Date().toISOString().slice(0, 10);
    setState(s => ({
      ...s,
      meesmanNavEur:     +nav,
      meesmanNavHistory: appendToHistory(s.meesmanNavHistory || [], today, +nav),
    }));
  }, []);

  // Haal historische Meesman data op via Yahoo Finance
  const [meesmanHistStatus, setMeesmanHistStatus] = React.useState({ loading: false, error: null, done: false });
  const loadMeesmanHistory = React.useCallback(async () => {
    setMeesmanHistStatus({ loading: true, error: null, done: false });
    try {
      const result = await fetchMeesmanHistory();
      setState(s => {
        // Samenvoegen: bestaande handmatige entries bewaren, Yahoo-data als basis
        const merged = [...result.meesmanNavHistory];
        (s.meesmanNavHistory || []).forEach(h => {
          if (!merged.find(m => m.date === h.date)) merged.push(h);
        });
        merged.sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, meesmanNavEur: result.meesmanNavEur, meesmanNavHistory: merged };
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
      if (newTxs.length > 0) setState(s => ({ ...s, transactions: [...s.transactions, ...newTxs] }));
      setT212Status({ loading: false, error: null, imported: newTxs.length, done: true });
    } catch (e) {
      setT212Status({ loading: false, error: e.message || 'Importfout', imported: 0, done: false });
    }
  }, [tweaks.t212ApiKey, tweaks.t212Mode, state.transactions]);

  React.useEffect(() => {
    refreshSpot();
    const t = setInterval(refreshSpot, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [refreshSpot]);

  const resetData = React.useCallback(() => {
    if (!confirm('Alle transacties wissen en terug naar de seed data?')) return;
    localStorage.removeItem('investeringen-v3');
    setState(loadState());
  }, []);

  const deleteT212Txs = React.useCallback(() => {
    const count = state.transactions.filter(t => t.party === 'trading212').length;
    if (!confirm(`${count} Trading 212 transacties verwijderen?`)) return;
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.party !== 'trading212') }));
    setT212Status({ loading: false, error: null, imported: 0, done: false });
  }, [state.transactions]);

  // Maak nieuwe gist aan en sla huidige data op
  const createGistAndSave = React.useCallback(async () => {
    if (!gistConfig.pat) return;
    setSyncStatus({ loading: true, error: null, syncedAt: null });
    try {
      const id = await gistCreate(gistConfig.pat);
      const newCfg = { ...gistConfig, gistId: id };
      setGistConfig(newCfg);
      await gistSave(gistConfig.pat, id, state);
      setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
    } catch (e) {
      setSyncStatus({ loading: false, error: e.message, syncedAt: null });
    }
  }, [gistConfig, state]);

  const syncNow = React.useCallback(async () => {
    if (!gistConfig.pat || !gistConfig.gistId) return;
    setSyncStatus({ loading: true, error: null, syncedAt: null });
    try {
      await gistSave(gistConfig.pat, gistConfig.gistId, state);
      setSyncStatus({ loading: false, error: null, syncedAt: new Date().toISOString() });
    } catch (e) {
      setSyncStatus({ loading: false, error: e.message, syncedAt: null });
    }
  }, [gistConfig, state]);

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
        if (!data.customParties) data.customParties = [];
        if (!data.hiddenParties) data.hiddenParties = [];
        if (!data.tileMetrics)   data.tileMetrics   = {};
        setState(data);
        setImportMsg({ ok: true, text: `${data.transactions.length} transacties geladen` });
      } catch { setImportMsg({ ok: false, text: 'Kon bestand niet lezen — geldig JSON?' }); }
    };
    reader.readAsText(file);
  }, []);

  // spots: huidige prijzen + historische reeksen (uit state, persistent via Gist)
  const spots = React.useMemo(() => ({
    goldSpotEurPerGram:    tweaks.goldSpotEurPerGram,
    silverSpotEurPerOunce: tweaks.silverSpotEurPerOunce,
    btcSpotEur:            tweaks.btcSpotEur,
    ethSpotEur:            tweaks.ethSpotEur,
    paxgSpotEur:           tweaks.paxgSpotEur,
    // Meesman: uit state (Gist-synced), tweaks als fallback
    meesmanNavEur:         state.meesmanNavEur     ?? tweaks.meesmanNavEur     ?? 100.4,
    meesmanNavHistory:     (state.meesmanNavHistory?.length ? state.meesmanNavHistory : null)
                           ?? tweaks.meesmanNavHistory ?? [],
    goldHistory:           state.goldHistory   || [],
    silverHistory:         state.silverHistory || [],
    btcHistory:            state.btcHistory    || [],
    ethHistory:            state.ethHistory    || [],
    paxgHistory:           state.paxgHistory   || [],
  }), [tweaks.goldSpotEurPerGram, tweaks.silverSpotEurPerOunce,
       tweaks.btcSpotEur, tweaks.ethSpotEur, tweaks.paxgSpotEur,
       tweaks.meesmanNavEur, tweaks.meesmanNavHistory,
       state.meesmanNavEur, state.meesmanNavHistory,
       state.goldHistory, state.silverHistory,
       state.btcHistory, state.ethHistory, state.paxgHistory]);

  const allParties = React.useMemo(
    () => [...PARTIES, ...(state.customParties || [])],
    [state.customParties]
  );
  const summaries = React.useMemo(
    () => allParties.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots, allParties]
  );

  const gistOk = !!(gistConfig.pat && gistConfig.gistId);

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
            {gistOk && (
              <span title={syncStatus.error ? syncStatus.error : syncStatus.syncedAt ? 'Gesynchroniseerd' : 'Sync actief'}
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
          </div>
        </div>
      </nav>

      {isMobile ? (
        <>
          {mobileTab === 'home' && (
            <Dashboard state={state} setState={setState}
              tweaks={tweaks} setTweaks={updateTweaks}
              spotStatus={spotStatus} onRefreshSpot={refreshSpot}
              addTrigger={mobileAddTrigger} isMobile={true}
              onUpdateMeesman={updateMeesmanNav} />
          )}
          {mobileTab === 'partijen' && (
            <MobilePartijenView summaries={summaries}
              onQuickAdd={() => { setMobileTab('home'); setMobileAddTrigger(t => t + 1); }}
            />
          )}
          {mobileTab === 'transacties' && (
            <TransactionsTab state={state} setState={setState} spots={spots} />
          )}
        </>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <Dashboard state={state} setState={setState}
              tweaks={tweaks} setTweaks={updateTweaks}
              spotStatus={spotStatus} onRefreshSpot={refreshSpot} />
          )}
          {activeTab === 'transacties' && (
            <TransactionsTab state={state} setState={setState} spots={spots} />
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

      {tweaksOpen && (
        <TweaksPanel
          tweaks={tweaks} setTweaks={updateTweaks}
          onReset={resetData}
          onExport={exportData} onImport={importData} importMsg={importMsg}
          spotStatus={spotStatus} onRefreshSpot={refreshSpot}
          t212Status={t212Status} onImportT212={importT212} onDeleteT212={deleteT212Txs}
          gistConfig={gistConfig} setGistConfig={setGistConfig}
          syncStatus={syncStatus} onCreateGist={createGistAndSave} onSyncNow={syncNow}
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
                       gistConfig, setGistConfig, syncStatus, onCreateGist, onSyncNow,
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
  const gistReady   = !!(gistConfig?.pat && gistConfig?.gistId);
  const [copyDone, setCopyDone]         = React.useState(false);
  const [homeCopyDone, setHomeCopyDone] = React.useState(false);

  const copyShareUrl = () => {
    const url = `${location.origin}${location.pathname}#gist=${gistConfig.gistId}`;
    navigator.clipboard.writeText(url)
      .then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2500); })
      .catch(() => { prompt('Kopieer deze link:', url); });
  };

  const copyHomeUrl = () => {
    const url = `${location.origin}${location.pathname}#pat=${encodeURIComponent(gistConfig.pat)}&gist=${gistConfig.gistId}`;
    navigator.clipboard.writeText(url)
      .then(() => { setHomeCopyDone(true); setTimeout(() => setHomeCopyDone(false), 2500); })
      .catch(() => { prompt('Kopieer beginscherm-link (alleen voor eigen apparaat):', url); });
  };

  return (
    <div className="tweaks-panel" style={{ position:'fixed', bottom:20, right:20, width:320,
      background:'var(--surface)', border:'1px solid var(--border-strong)',
      borderRadius:'var(--radius-lg)', boxShadow:'0 20px 40px rgba(0,0,0,0.25)', zIndex:90, overflow:'hidden' }}>

      <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'var(--ff-display)', fontSize:17, fontWeight:500 }}>Instellingen</div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--fg-muted)', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'14px 16px', display:'grid', gap:16, maxHeight:'80vh', overflowY:'auto' }}>

        {/* ── Cloud sync ── */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <SectionLabel>Cloud sync</SectionLabel>
            {gistReady && (
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
                GitHub PAT <span style={{ color:'var(--fg-dim)' }}>(gist scope — opgeslagen lokaal)</span>
              </div>
              <input type="password" value={gistConfig?.pat || ''}
                onChange={e => setGistConfig(c => ({...c, pat: e.target.value}))}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                style={{ ...inputStyle, width:'100%', padding:'7px 10px', fontSize:12, fontFamily:'var(--ff-mono)' }} />
            </label>
            <label style={{ fontSize:12 }}>
              <div style={{ color:'var(--fg-muted)', marginBottom:4 }}>
                Gist ID <span style={{ color:'var(--fg-dim)' }}>(leeg = nieuw aanmaken)</span>
              </div>
              <input value={gistConfig?.gistId || ''}
                onChange={e => setGistConfig(c => ({...c, gistId: e.target.value}))}
                placeholder="automatisch na aanmaken"
                style={{ ...inputStyle, width:'100%', padding:'7px 10px', fontSize:12, fontFamily:'var(--ff-mono)' }} />
            </label>
            {gistConfig?.pat && !gistConfig?.gistId && (
              <button onClick={onCreateGist} disabled={syncStatus?.loading}
                style={{ padding:'8px 12px', fontSize:12, background:'var(--surface-2)',
                  border:'1px solid var(--border)', borderRadius:'var(--radius)',
                  cursor:'pointer', color:'var(--fg)', fontFamily:'inherit' }}>
                {syncStatus?.loading ? '…bezig' : '✦ Maak nieuwe gist aan'}
              </button>
            )}
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
            {/* Links voor ander apparaat / beginscherm */}
            {gistReady && (
              <div style={{ display:'grid', gap:10, padding:'12px', background:'var(--surface-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Ander apparaat of beginscherm
                </div>

                {/* Beginscherm-link (met PAT) */}
                <div>
                  <div style={{ fontSize:12, color:'var(--fg)', fontWeight:500, marginBottom:3 }}>⌂ Beginscherm-link</div>
                  <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.5, marginBottom:6 }}>
                    Open deze link op je telefoon en kies <b>"Zet op beginscherm"</b>. De app is daarna direct gesynchroniseerd — geen PAT invoeren nodig.
                  </div>
                  <button onClick={copyHomeUrl}
                    style={{ width:'100%', padding:'8px 12px', fontSize:12, borderRadius:'var(--radius)',
                      cursor:'pointer', fontFamily:'inherit', fontWeight:600, border:'none',
                      background: homeCopyDone ? 'var(--positive)' : 'var(--accent)', color:'#fff', transition:'background .2s' }}>
                    {homeCopyDone ? '✓ Gekopieerd!' : '⌂ Kopieer beginscherm-link'}
                  </button>
                </div>

                {/* Setup-link (alleen Gist ID) */}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
                  <div style={{ fontSize:12, color:'var(--fg)', fontWeight:500, marginBottom:3 }}>⎘ Setup-link (ander apparaat)</div>
                  <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.5, marginBottom:6 }}>
                    Gist ID wordt automatisch ingevuld. Je moet op het andere apparaat nog je PAT invoeren.
                  </div>
                  <button onClick={copyShareUrl}
                    style={{ width:'100%', padding:'7px 12px', fontSize:12, borderRadius:'var(--radius)',
                      cursor:'pointer', fontFamily:'inherit', border:'1px solid var(--border)',
                      background: copyDone ? 'var(--positive)' : 'transparent',
                      color: copyDone ? '#fff' : 'var(--fg)', transition:'background .2s, color .2s' }}>
                    {copyDone ? '✓ Gekopieerd!' : '⎘ Kopieer setup-link'}
                  </button>
                </div>
              </div>
            )}
            {!gistReady && (
              <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.6 }}>
                Maak een GitHub PAT aan via <b>github.com → Settings → Developer settings → Personal access tokens (classic)</b> met <b>gist</b> scope. Plak hem hierboven — hij wordt alleen lokaal opgeslagen. Daarna sync je automatisch op elk apparaat én je beginscherm.
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

function MobilePartijenView({ summaries, onQuickAdd }) {
  const METRICS = [
    { key: 'all_pct', label: 'All-time %' },
    { key: 'all_eur', label: 'All-time €' },
    { key: 'yr_pct',  label: 'Per jaar %' },
    { key: 'yr_eur',  label: 'Per jaar €' },
  ];
  const [metric, setMetric] = React.useState('all_pct');

  const enriched = summaries
    .filter(s => s.currentValueEur > 0 || s.invested > 0)
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
    .sort((a, b) => {
      if (metric === 'all_pct') return (b.pnlPct  || 0) - (a.pnlPct  || 0);
      if (metric === 'all_eur') return (b.pnl      || 0) - (a.pnl      || 0);
      if (metric === 'yr_pct')  return (b.cagr     || 0) - (a.cagr     || 0);
      return (b.yearlyEur || 0) - (a.yearlyEur || 0);
    });

  return (
    <div style={{ padding: '16px 14px 100px' }}>
      {/* Metric toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
              borderRadius: 999,
              border: '1px solid ' + (metric === m.key ? 'var(--fg)' : 'var(--border)'),
              background: metric === m.key ? 'var(--fg)' : 'transparent',
              color: metric === m.key ? 'var(--bg)' : 'var(--fg-muted)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Totaalregel */}
      {(() => {
        const totalVal  = enriched.reduce((s, x) => s + x.currentValueEur, 0);
        const totalPnl  = enriched.reduce((s, x) => s + x.pnl, 0);
        const totalInv  = enriched.reduce((s, x) => s + x.invested, 0);
        const totalPct  = totalInv > 0 ? (totalPnl / totalInv) * 100 : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 10,
            border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--ff-mono)' }}>Totaal</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 15, fontWeight: 600 }}>
                {fmtEur(totalVal)}
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
      <div style={{ display: 'grid', gap: 6 }}>
        {enriched.map(s => {
          const isPct = metric === 'all_pct' || metric === 'yr_pct';
          const val   = metric === 'all_pct' ? s.pnlPct
                      : metric === 'all_eur' ? s.pnl
                      : metric === 'yr_pct'  ? s.cagr
                      : s.yearlyEur;
          const displayVal = isPct
            ? `${val >= 0 ? '+' : ''}${(val || 0).toFixed(1)}%`
            : `${val >= 0 ? '+' : '−'}${fmtEur(Math.abs(val || 0))}`;

          return (
            <div key={s.party.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.party.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.party.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--ff-mono)' }}>
                  {fmtEur(s.currentValueEur)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600,
                color: (val || 0) > 0 ? 'var(--positive)' : (val || 0) < 0 ? 'var(--negative)' : 'var(--fg-muted)',
                flexShrink: 0 }}>
                {displayVal}
                {metric === 'yr_pct' && <div style={{ fontSize: 9, color: 'var(--fg-dim)', fontWeight: 400 }}>
                  CAGR {s.years.toFixed(1)}j
                </div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
