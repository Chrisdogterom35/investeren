// App root: state, theme, tabs, tweaks

const THEMES = [
  { key: 'minimal',    label: 'Minimalistisch', className: 'theme-minimal'    },
  { key: 'dark',       label: 'Premium Dark',   className: 'theme-dark'       },
  { key: 'warm',       label: 'Warm & rustig',  className: 'theme-warm'       },
  { key: 'terminal',   label: 'Bloomberg',      className: 'theme-terminal'   },
  { key: 'nord',       label: 'Nord',           className: 'theme-nord'       },
  { key: 'solarized',  label: 'Solarized',      className: 'theme-solarized'  },
  { key: 'nebula',     label: 'Nebula',         className: 'theme-nebula'     },
];

const TABS = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'transacties',  label: 'Transacties' },
  { key: 'pensioen',     label: 'Pensioen' },
];

const OZ_TO_GRAM = 31.1034768;

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

async function fetchMeesmanNav() {
  const end   = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);
  const url = `https://tools.morningstar.co.uk/api/rest.svc/timeseries_price/t92wz0sj7c?id=0P0001IJJX%24%242%24%241&currencyId=EUR&idtype=Morningstar&frequency=daily&startDate=${start}&endDate=${end}&outputType=COMPACTJSON`;
  const res = await fetch(url).then(r => r.json());
  const security = res?.TimeSeries?.Security?.[0];
  const history  = security?.HistoryDetail || [];
  if (!history.length) throw new Error('Geen NAV-data ontvangen');
  const navHistory = history
    .map(h => ({ date: h.EndDate.slice(0, 10), nav: +h.Value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = navHistory[navHistory.length - 1];
  return { meesmanNavEur: latest.nav, meesmanNavHistory: navHistory };
}

const T212_PROXY = 'https://corsproxy.io/?url=';

// T212 gebruikt alleen de Secret Key in de Authorization header
function buildT212Auth(keyId, secret) {
  // Gebruik altijd alleen de Secret Key — nooit combineren
  const s = (secret || '').trim();
  const k = (keyId || '').trim();
  return s || k; // secret heeft prioriteit, keyId als fallback
}

async function fetchT212Orders(authHeader, cursor) {
  const base = cursor
    ? `https://live.trading212.com/api/v0/equity/history/orders?cursor=${encodeURIComponent(cursor)}&limit=50`
    : 'https://live.trading212.com/api/v0/equity/history/orders?limit=50';
  const url = T212_PROXY + encodeURIComponent(base);
  let res;
  try {
    res = await fetch(url, { headers: { 'Authorization': authHeader } });
  } catch (e) {
    throw new Error('Netwerkfout — controleer je verbinding of probeer opnieuw');
  }
  if (res.status === 401) throw new Error('Niet geautoriseerd (401) — controleer je API-sleutel(s)');
  if (res.status === 403) throw new Error('Geen toegang (403) — sleutel heeft mogelijk onvoldoende rechten');
  if (!res.ok) throw new Error(`T212 API fout: HTTP ${res.status}`);
  return await res.json();
}

function mapT212Order(order) {
  const typeMap = { LIMIT_BUY: 'koop', MARKET_BUY: 'koop', LIMIT_SELL: 'verkoop', MARKET_SELL: 'verkoop',
                    STOP_BUY: 'koop', STOP_SELL: 'verkoop' };
  const qty   = +(order.filledQuantity  || order.orderedQuantity || 0);
  const price = +(order.filledPrice     || (qty > 0 ? (order.filledValue / qty) : 0) || 0);
  const fee   = (order.taxes || []).reduce((s, t) => s + +(t.quantity || 0), 0);
  const ticker = (order.ticker || '').replace(/_[A-Z0-9]+$/, '');
  return {
    id:           makeId(),
    party:        'trading212',
    type:         typeMap[order.type] || 'koop',
    date:         (order.dateCreated || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    quantity:     qty,
    unitPriceEur: +price.toFixed(4),
    feeEur:       fee > 0 ? +fee.toFixed(4) : undefined,
    instrument:   ticker,
    note:         `T212:${order.id || ''}`,
    _t212Id:      String(order.id || ''),
  };
}

function App() {
  const [state, setState]           = React.useState(() => loadState());
  const [tweaks, setTweaks]         = React.useState(() => ({ ...window.TWEAKS }));
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [activeTab, setActiveTab]   = React.useState('dashboard');
  const [spotStatus, setSpotStatus] = React.useState({ loading: false, error: null, fetchedAt: null });
  const [t212Status, setT212Status] = React.useState({ loading: false, error: null, imported: 0, done: false });
  const [importMsg, setImportMsg]   = React.useState(null); // { ok, text }

  React.useEffect(() => { saveState(state); }, [state]);

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
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*'); } catch (e) {}
      return next;
    });
  }, []);

  const refreshSpot = React.useCallback(async () => {
    setSpotStatus(s => ({ ...s, loading: true, error: null }));
    const [metals, crypto, meesman] = await Promise.allSettled([
      fetchSpotPrices(),
      fetchCryptoPrices(),
      fetchMeesmanNav(),
    ]);
    const updates = {};
    if (metals.status  === 'fulfilled') {
      updates.goldSpotEurPerGram    = +metals.value.goldSpotEurPerGram.toFixed(2);
      updates.silverSpotEurPerOunce = +metals.value.silverSpotEurPerOunce.toFixed(2);
    }
    if (crypto.status  === 'fulfilled') {
      updates.btcSpotEur  = +crypto.value.btcSpotEur.toFixed(2);
      updates.ethSpotEur  = +crypto.value.ethSpotEur.toFixed(2);
      updates.paxgSpotEur = +crypto.value.paxgSpotEur.toFixed(2);
    }
    if (meesman.status === 'fulfilled') {
      updates.meesmanNavEur     = +meesman.value.meesmanNavEur.toFixed(4);
      updates.meesmanNavHistory = meesman.value.meesmanNavHistory;
    }
    if (Object.keys(updates).length) updateTweaks(tw => ({ ...tw, ...updates }));
    const errors = [
      metals.status  === 'rejected' ? `Goud/zilver: ${metals.reason?.message}`  : null,
      crypto.status  === 'rejected' ? `Crypto: ${crypto.reason?.message}`        : null,
      meesman.status === 'rejected' ? `Meesman: ${meesman.reason?.message}`      : null,
    ].filter(Boolean);
    setSpotStatus({ loading: false, error: errors.length ? errors.join(' · ') : null, fetchedAt: new Date().toISOString() });
  }, [updateTweaks]);

  const importT212 = React.useCallback(async () => {
    const auth = buildT212Auth(tweaks.t212KeyId, tweaks.t212ApiKey);
    if (!auth) return;
    setT212Status({ loading: true, error: null, imported: 0, done: false });
    try {
      const data = await fetchT212Orders(auth);
      const items = Array.isArray(data) ? data : (data.items || []);
      const existingIds = new Set(
        state.transactions.filter(t => t._t212Id).map(t => t._t212Id)
      );
      const newTxs = items
        .filter(o => (o.status === 'FILLED' || !o.status) && !existingIds.has(String(o.id || '')))
        .map(mapT212Order);
      if (newTxs.length > 0) {
        setState(s => ({ ...s, transactions: [...s.transactions, ...newTxs] }));
      }
      setT212Status({ loading: false, error: null, imported: newTxs.length, done: true });
    } catch (e) {
      setT212Status({ loading: false, error: e.message || 'Importfout', imported: 0, done: false });
    }
  }, [tweaks.t212KeyId, tweaks.t212ApiKey, state.transactions]);

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

  // ── Export: download state als JSON-bestand ──
  const exportData = React.useCallback(() => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `investeringen-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  // ── Import: laad JSON-bestand en vervang state ──
  const importData = React.useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.transactions || !Array.isArray(data.transactions)) {
          setImportMsg({ ok: false, text: 'Ongeldig bestand — geen transacties gevonden' });
          return;
        }
        // Zorg voor widgets-key
        if (!data.widgets) data.widgets = DEFAULT_WIDGETS.map(w => ({ ...w }));
        setState(data);
        setImportMsg({ ok: true, text: `${data.transactions.length} transacties geladen` });
      } catch {
        setImportMsg({ ok: false, text: 'Kon bestand niet lezen — is het een geldig JSON-bestand?' });
      }
    };
    reader.readAsText(file);
  }, []);

  // Stable spots object
  const spots = React.useMemo(() => ({
    goldSpotEurPerGram:    tweaks.goldSpotEurPerGram,
    silverSpotEurPerOunce: tweaks.silverSpotEurPerOunce,
    btcSpotEur:            tweaks.btcSpotEur,
    ethSpotEur:            tweaks.ethSpotEur,
    paxgSpotEur:           tweaks.paxgSpotEur,
    meesmanNavEur:         tweaks.meesmanNavEur,
    meesmanNavHistory:     tweaks.meesmanNavHistory,
  }), [tweaks.goldSpotEurPerGram, tweaks.silverSpotEurPerOunce,
       tweaks.btcSpotEur, tweaks.ethSpotEur, tweaks.paxgSpotEur,
       tweaks.meesmanNavEur, tweaks.meesmanNavHistory]);

  const summaries = React.useMemo(
    () => PARTIES.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots]
  );

  return (
    <>
      {/* Global nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 0 }}>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)', marginRight: 4 }}>Thema</span>
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
            <button onClick={() => setTweaksOpen(o => !o)} title="Instellingen"
              style={{
                marginLeft: 8, padding: '5px 10px', fontFamily: 'inherit', fontSize: 15,
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

      {activeTab === 'dashboard' && (
        <Dashboard
          state={state} setState={setState}
          tweaks={tweaks} setTweaks={updateTweaks}
          spotStatus={spotStatus} onRefreshSpot={refreshSpot}
        />
      )}
      {activeTab === 'transacties' && (
        <TransactionsTab state={state} setState={setState} spots={spots} />
      )}
      {activeTab === 'pensioen' && (
        <PensionTab summaries={summaries} />
      )}

      {tweaksOpen && (
        <TweaksPanel
          tweaks={tweaks} setTweaks={updateTweaks}
          onReset={resetData}
          onExport={exportData} onImport={importData} importMsg={importMsg}
          spotStatus={spotStatus} onRefreshSpot={refreshSpot}
          t212Status={t212Status} onImportT212={importT212}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </>
  );
}

function TweaksPanel({ tweaks, setTweaks, onReset, onClose,
                       spotStatus, onRefreshSpot,
                       t212Status, onImportT212,
                       onExport, onImport, importMsg }) {

  const fileRef = React.useRef(null);

  const priceRow = (label, key, step = '0.01') => (
    <label key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, fontSize:12 }}>
      <span style={{ color:'var(--fg-muted)', flexShrink:0 }}>{label}</span>
      <input type="number" step={step} value={tweaks[key] ?? ''}
        onChange={e => setTweaks(tw => ({...tw, [key]: +e.target.value}))}
        style={{ ...inputStyle, width:108, padding:'5px 8px', fontFamily:'var(--ff-mono)', fontSize:12 }} />
    </label>
  );

  const hasT212Auth = !!(tweaks.t212KeyId || tweaks.t212ApiKey);

  return (
    <div style={{ position:'fixed', bottom:20, right:20, width:320,
      background:'var(--surface)', border:'1px solid var(--border-strong)',
      borderRadius:'var(--radius-lg)', boxShadow:'0 20px 40px rgba(0,0,0,0.25)', zIndex:90, overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'13px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontFamily:'var(--ff-display)', fontSize:17, fontWeight:500 }}>Instellingen</div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--fg-muted)', fontSize:18, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      <div style={{ padding:'14px 16px', display:'grid', gap:16, maxHeight:'80vh', overflowY:'auto' }}>

        {/* ── Live prijzen ── */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <SectionLabel>Live prijzen</SectionLabel>
            <button onClick={onRefreshSpot} disabled={spotStatus?.loading}
              style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--fg-muted)',
                padding:'3px 8px', borderRadius:'var(--radius)', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
              {spotStatus?.loading ? '…' : '↻ Alles verversen'}
            </button>
          </div>
          <div style={{ display:'grid', gap:7 }}>
            {priceRow('Goud (€/g)',          'goldSpotEurPerGram')}
            {priceRow('Zilver (€/oz)',        'silverSpotEurPerOunce')}
            {priceRow('Bitcoin (€/BTC)',      'btcSpotEur', '1')}
            {priceRow('Ethereum (€/ETH)',     'ethSpotEur', '0.01')}
            {priceRow('Pax Gold (€/PAXG)',   'paxgSpotEur', '0.01')}
            {priceRow('Meesman NAV (€/part)', 'meesmanNavEur', '0.0001')}
          </div>
          <div style={{ fontSize:10, marginTop:7, fontFamily:'var(--ff-mono)',
            color: spotStatus?.error ? 'var(--negative)' : 'var(--fg-dim)' }}>
            {spotStatus?.error
              ? '⚠ ' + spotStatus.error
              : spotStatus?.fetchedAt
              ? 'Bijgewerkt ' + new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL')
              : spotStatus?.loading ? 'ophalen…' : 'handmatig'}
          </div>
        </div>

        {/* ── Trading 212 ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <SectionLabel style={{ marginBottom:10 }}>Trading 212 import</SectionLabel>
          <div style={{ display:'grid', gap:8 }}>

            {/* Secret Key */}
            <label style={{ fontSize:12 }}>
              <div style={{ color:'var(--fg-muted)', marginBottom:4 }}>API Key <span style={{ color:'var(--fg-dim)', fontWeight:400 }}>(T212 → Instellingen → API)</span></div>
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
              {t212Status?.loading ? '…bezig met importeren' : '↓ Importeer transacties'}
            </button>

            {(t212Status?.error || t212Status?.done) && (
              <div style={{ fontSize:10, fontFamily:'var(--ff-mono)',
                color: t212Status.error ? 'var(--negative)' : 'var(--positive)' }}>
                {t212Status.error
                  ? '⚠ ' + t212Status.error
                  : `✓ ${t212Status.imported} nieuwe transacties geïmporteerd`}
              </div>
            )}
            <div style={{ fontSize:10, color:'var(--fg-dim)', lineHeight:1.5 }}>
              Genereer een key via T212 app → Instellingen → API. Kopieer de volledige key en plak hem hier. Duplicaten worden automatisch overgeslagen.
            </div>
          </div>
        </div>

        {/* ── Data opslaan ── */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
          <SectionLabel style={{ marginBottom:10 }}>Data opslaan</SectionLabel>
          <div style={{ display:'grid', gap:8 }}>
            {/* Export */}
            <button onClick={onExport}
              style={{ padding:'8px 12px', fontSize:12, background:'var(--surface-2)',
                border:'1px solid var(--border)', borderRadius:'var(--radius)',
                cursor:'pointer', color:'var(--fg)', fontFamily:'inherit', textAlign:'left' }}>
              ↓ Exporteer data als JSON
            </button>

            {/* Import */}
            <input
              ref={fileRef}
              type="file" accept=".json"
              style={{ display:'none' }}
              onChange={e => { onImport(e.target.files?.[0]); e.target.value = ''; }}
            />
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
              Data wordt automatisch opgeslagen in je browser. Exporteer regelmatig als backup, of om te verplaatsen naar een ander apparaat.
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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
