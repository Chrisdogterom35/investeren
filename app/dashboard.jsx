// Main dashboard with customizable widget system

// Metric options for party tiles
const TILE_METRICS = [
  { key: 'pnl_eur',   label: 'Winst €',         short: '€' },
  { key: 'pnl_pct',   label: 'Winst %',          short: '%' },
  { key: 'ytd_pct',   label: 'YTD %',            short: 'YTD' },
  { key: 'value',     label: 'Huidige waarde',   short: 'val' },
  { key: 'invested',  label: 'Ingelegd',         short: 'inleg' },
  { key: 'share',     label: 'Aandeel portfolio', short: 'share' },
];

function Dashboard({ state, setState, tweaks, setTweaks, spotStatus, onRefreshSpot, addTrigger = 0, isMobile = false, onUpdateMeesman = () => {}, onOpenParty }) {
  const [modalOpen, setModalOpen]               = React.useState(false);
  const [modalPreset, setModalPreset]           = React.useState(null);
  const [editingTx, setEditingTx]               = React.useState(null);
  const [detailPartyId, setDetailPartyId]       = React.useState(null);
  const [filterCategory, setFilterCategory]     = React.useState('all');
  const [editMode, setEditMode]                 = React.useState(false);
  const [addPartyOpen, setAddPartyOpen]         = React.useState(false);
  const [editParty, setEditParty]               = React.useState(null);
  const [allocationMode, setAllocationMode]     = React.useState('parties');

  const spots = React.useMemo(() => ({
    goldSpotEurPerGram:    tweaks.goldSpotEurPerGram,
    silverSpotEurPerOunce: tweaks.silverSpotEurPerOunce,
    btcSpotEur:            tweaks.btcSpotEur,
    ethSpotEur:            tweaks.ethSpotEur,
    paxgSpotEur:           tweaks.paxgSpotEur,
    // Meesman NAV zit nu in state, tweaks als fallback
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

  // state.parties = dé bron van waarheid (gesynchroniseerd via Supabase)
  const allParties = React.useMemo(
    () => (state.parties && state.parties.length) ? state.parties : PARTIES,
    [state.parties]
  );

  // Set van seed-IDs om "custom" (toegevoegd door gebruiker) te detecteren
  const SEED_PARTY_IDS = React.useMemo(() => new Set(PARTIES.map(p => p.id)), []);

  const summaries = React.useMemo(
    () => allParties.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots, allParties]
  );
  // Twee aparte vlaggen, met fallback op het oude includeInPortfolio.
  // - includeInTotal:    telt mee in totale waarde, YTD, P&L en allocatie-donut
  // - includeInTimeChart: telt mee in de waarde-over-tijd grafiek
  const includedParties = React.useMemo(
    () => allParties.filter(p => (p.includeInTotal ?? p.includeInPortfolio) !== false),
    [allParties]
  );
  const portfolioSummaries = React.useMemo(
    () => summaries.filter(s => (s.party.includeInTotal ?? s.party.includeInPortfolio) !== false),
    [summaries]
  );
  const timeChartParties = React.useMemo(
    () => allParties.filter(p => (p.includeInTimeChart ?? p.includeInPortfolio) !== false),
    [allParties]
  );

  const hiddenParties  = state.hiddenParties  || [];
  const tileMetrics    = state.tileMetrics    || {};

  const setHiddenParties = React.useCallback(ids => {
    setState(s => ({ ...s, hiddenParties: ids }));
  }, [setState]);

  const setTileMetric = React.useCallback((partyId, metric) => {
    setState(s => ({ ...s, tileMetrics: { ...(s.tileMetrics || {}), [partyId]: metric } }));
  }, [setState]);

  const total        = portfolioSummaries.reduce((s, x) => s + x.currentValueEur, 0);
  const totalInvested= portfolioSummaries.reduce((s, x) => s + x.invested, 0);
  const totalPnl     = portfolioSummaries.reduce((s, x) => s + x.pnl, 0);
  const totalPnlPct  = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const totalFees    = state.transactions.reduce((s, t) => s + (+t.feeEur || 0) + (t.type === 'kosten' ? (+t.amountEur || 0) : 0), 0);

  const timeSeries = React.useMemo(() => {
    const supabaseSeries = (state.portfolioDailyValues || [])
      .map(p => ({ date: p.date, total: +p.total, invested: +p.invested }))
      .filter(p => p.date && Number.isFinite(p.total) && Number.isFinite(p.invested))
      .sort((a, b) => a.date.localeCompare(b.date));
    const liveSeries = buildValueTimeSeries(state.transactions, timeChartParties, spots);
    const byDate = new Map();
    supabaseSeries.forEach(p => byDate.set(p.date, p));
    liveSeries.forEach(p => byDate.set(p.date, p));
    const todayPoint = {
      date: todayIsoLocal(),
      total,
      invested: totalInvested,
    };
    byDate.set(todayPoint.date, todayPoint);
    return [...byDate.values()]
      .filter(p => p.date >= '2025-01-01')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.portfolioDailyValues, state.transactions, spots, timeChartParties, total, totalInvested]);
  const partyTimeSeries = React.useMemo(
    () => buildPartyTimeSeries(state.transactions, timeChartParties, spots),
    [state.transactions, spots, timeChartParties]
  );
  const allocationGroups = React.useMemo(() => {
    const knownCategories = new Set(CATEGORY_OPTIONS);
    const groupForParty = p => {
      if (p.id === 'cash' || p.category === 'Liquide') return { id:'cash', name:'Cash', color:'oklch(55% 0.05 160)' };
      if (p.category === 'Crypto') return { id:'crypto', name:'Crypto', color:'oklch(62% 0.15 195)' };
      if (p.category === 'Edelmetaal' || ['goldrepublic', 'goud', 'zilver'].includes(p.id)) return { id:'commodities', name:'Commodities', color:'oklch(76% 0.14 85)' };
      if (p.category && !knownCategories.has(p.category)) return { id:`allocation:${p.category}`, name:p.category, color:p.color };
      return { id:'aandelen', name:'Aandelen', color:'oklch(58% 0.14 255)' };
    };
    const groups = new Map();
    timeChartParties.forEach(p => {
      const group = groupForParty(p);
      if (!groups.has(group.id)) groups.set(group.id, group);
    });
    return [...groups.values()];
  }, [timeChartParties]);
  const allocationTimeSeries = React.useMemo(() => {
    const startDate = '2025-01-01';
    const firstPoint = partyTimeSeries.dates.findIndex(d => d >= startDate);
    const sliceAt = firstPoint > 0 ? firstPoint : 0;
    const dates = partyTimeSeries.dates.slice(sliceAt);
    const byAllocation = Object.fromEntries(allocationGroups.map(g => [g.id, dates.map(() => 0)]));
    const knownCategories = new Set(CATEGORY_OPTIONS);
    const groupIdForParty = p => {
      if (p.id === 'cash' || p.category === 'Liquide') return 'cash';
      if (p.category === 'Crypto') return 'crypto';
      if (p.category === 'Edelmetaal' || ['goldrepublic', 'goud', 'zilver'].includes(p.id)) return 'commodities';
      if (p.category && !knownCategories.has(p.category)) return `allocation:${p.category}`;
      return 'aandelen';
    };
    timeChartParties.forEach(p => {
      const groupId = groupIdForParty(p);
      const values = (partyTimeSeries.byParty[p.id] || []).slice(sliceAt);
      if (!byAllocation[groupId]) byAllocation[groupId] = dates.map(() => 0);
      values.forEach((value, i) => { byAllocation[groupId][i] += value || 0; });
    });
    return {
      dates,
      total: partyTimeSeries.total.slice(sliceAt),
      invested: partyTimeSeries.invested.slice(sliceAt),
      byParty: byAllocation,
    };
  }, [partyTimeSeries, timeChartParties, allocationGroups]);
  const monthly = React.useMemo(() => buildMonthlyFlows(state.transactions), [state.transactions]);

  const ytd = React.useMemo(() => calcYTDReturn(timeSeries), [timeSeries]);

  const chartTimeSeries = React.useMemo(() => {
    const startDate = '2025-01-01';
    const firstPoint = timeSeries.findIndex(p => p.date >= startDate);
    return firstPoint > 0 ? timeSeries.slice(firstPoint) : timeSeries;
  }, [timeSeries]);

  const sparse = React.useMemo(() => {
    if (chartTimeSeries.length <= 180) return chartTimeSeries;
    const step = Math.ceil(chartTimeSeries.length / 180);
    return chartTimeSeries.filter((_, i) => i % step === 0 || i === chartTimeSeries.length - 1);
  }, [chartTimeSeries]);

  const detailParty   = detailPartyId ? allParties.find(p => p.id === detailPartyId) : null;
  const detailSummary = detailParty ? summaries.find(s => s.party.id === detailParty.id) : null;

  const openAdd  = (preset = null) => { setModalPreset(preset); setEditingTx(null); setModalOpen(true); };
  const openEdit = (tx)            => { setEditingTx(tx); setModalPreset(null); setModalOpen(true); };

  React.useEffect(() => { if (addTrigger > 0) openAdd(); }, [addTrigger]);
  const saveTx   = (tx) => setState(s => {
    const stampedTx = { ...tx, updatedAt: new Date().toISOString() };
    const exists = s.transactions.some(t => t.id === tx.id);
    const { [tx.id]: _deleted, ...deletedTransactionIds } = s.deletedTransactionIds || {};
    return {
      ...s,
      transactions: exists ? s.transactions.map(t => t.id === tx.id ? stampedTx : t) : [...s.transactions, stampedTx],
      deletedTransactionIds,
    };
  });
  const deleteTx = (id) => setState(s => ({
    ...s,
    transactions: s.transactions.filter(t => t.id !== id),
    deletedTransactionIds: { ...(s.deletedTransactionIds || {}), [id]: new Date().toISOString() },
  }));

  const recentTxs = React.useMemo(
    () => [...state.transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10),
    [state.transactions]
  );

  const firstTxDate = state.transactions.length
    ? [...state.transactions].sort((a,b) => a.date.localeCompare(b.date))[0].date
    : null;

  // Widget system
  const widgets = state.widgets || DEFAULT_WIDGETS.map(w => ({ ...w }));
  const updateWidget = (id, changes) => setState(s => ({
    ...s,
    widgets: (s.widgets || DEFAULT_WIDGETS).map(w => w.id === id ? { ...w, ...changes } : w)
  }));
  const toggleWidget = (id)    => updateWidget(id, { enabled: !widgets.find(w => w.id === id)?.enabled });
  const setChartType = (id, t) => updateWidget(id, { chartType: t });

  const activeWidgets = widgets.filter(w => w.enabled);

  const allocationItems = React.useMemo(() => {
    const groupMeta = {
      aandelen:    { label: 'Aandelen',    color: 'oklch(58% 0.14 255)' },
      crypto:      { label: 'Crypto',      color: 'oklch(62% 0.15 195)' },
      commodities: { label: 'Commodities', color: 'oklch(76% 0.14 85)' },
      cash:        { label: 'Cash',        color: 'oklch(55% 0.05 160)' },
    };
    const knownCategories = new Set(CATEGORY_OPTIONS);
    const groupForParty = p => {
      if (p.id === 'cash' || p.category === 'Liquide') return 'cash';
      if (p.category === 'Crypto') return 'crypto';
      if (p.category === 'Edelmetaal' || ['goldrepublic', 'goud', 'zilver'].includes(p.id)) return 'commodities';
      if (p.category && !knownCategories.has(p.category)) return `custom:${p.category}`;
      return 'aandelen';
    };
    if (allocationMode === 'groups') {
      const grouped = {};
      const customMeta = {};
      portfolioSummaries.forEach(s => {
        if (s.currentValueEur <= 0) return;
        const key = groupForParty(s.party);
        grouped[key] = (grouped[key] || 0) + s.currentValueEur;
        if (key.startsWith('custom:') && !customMeta[key]) {
          customMeta[key] = { label: s.party.category, color: s.party.color };
        }
      });
      return Object.entries(grouped)
        .map(([key, value]) => {
          const meta = groupMeta[key] || customMeta[key] || { label: key.replace(/^custom:/, ''), color: 'var(--accent)' };
          return { label: meta.label, value, color: meta.color };
        })
        .sort((a, b) => b.value - a.value);
    }
    return portfolioSummaries
      .filter(s => s.currentValueEur > 0)
      .map(s => ({ label: s.party.name, value: s.currentValueEur, color: s.party.color, partyId: s.party.id }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioSummaries, allocationMode]);

  const saveCustomParty = React.useCallback(p => {
    setState(s => {
      const stampedParty = { ...p, updatedAt: new Date().toISOString() };
      const list = (s.parties && s.parties.length) ? s.parties : [...PARTIES];
      const exists = list.some(x => x.id === p.id);
      return { ...s, parties: exists
        ? list.map(x => x.id === p.id ? { ...x, ...stampedParty } : x)
        : [...list, stampedParty] };
    });
  }, [setState]);

  const deleteCustomParty = React.useCallback(id => {
    if (!confirm('Partij verwijderen? Bijbehorende transacties blijven bestaan.')) return;
    setState(s => ({ ...s, parties: (s.parties || []).filter(p => p.id !== id) }));
  }, [setState]);

  // Render a widget by id
  const renderWidget = (wCfg) => {
    const reg = WIDGET_REGISTRY.find(r => r.id === wCfg.id);
    if (!reg) return null;
    const ct = wCfg.chartType;

    const header = (title, sub) => (
      <SectionTitle title={title} subtitle={sub} right={
        editMode && !isMobile && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            {reg.chartTypes.length > 1 && reg.chartTypes.map(type => (
              <button key={type} onClick={() => setChartType(wCfg.id, type)}
                style={{ padding:'3px 8px', fontSize:10, fontFamily:'var(--ff-mono)', cursor:'pointer', borderRadius:'var(--radius)',
                  background: ct===type?'var(--fg)':'transparent',
                  color: ct===type?'var(--bg)':'var(--fg-muted)',
                  border:'1px solid '+(ct===type?'var(--fg)':'var(--border)') }}>
                {type}
              </button>
            ))}
            <button onClick={() => toggleWidget(wCfg.id)}
              style={{ padding:'3px 8px', fontSize:10, cursor:'pointer', borderRadius:'var(--radius)',
                background:'transparent', border:'1px solid var(--negative)', color:'var(--negative)', fontFamily:'inherit' }}>
              Verberg
            </button>
          </div>
        )
      } />
    );

    const WidgetShell = ({ children, pad = 22 }) => (
      isMobile
        ? <section style={{ padding:'0 2px 14px', borderBottom:'1px solid var(--border)' }}>{children}</section>
        : <Card style={{ padding: pad }}>{children}</Card>
    );

    switch (wCfg.id) {
      case 'portfolio_line':
        return (
          <WidgetShell>
            {header('Waarde over tijd', ct === 'rendement%' ? 'Rendement % over tijd' : 'Huidige waarde vs. ingelegd')}
            {ct === 'rendement%'
              ? <ReturnLineChart data={sparse} height={isMobile ? 175 : 230} />
              : <LineChart data={sparse} height={isMobile ? 175 : 230} />}
          </WidgetShell>
        );
      case 'allocation':
        return (
          <WidgetShell>
            {header('Verdeling', allocationMode === 'groups' ? 'Aandeel per allocatie' : 'Aandeel per partij')}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {[
                { key:'parties', label:'Partijen' },
                { key:'groups',  label:'Allocatie' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setAllocationMode(opt.key)}
                  style={{ padding:'4px 10px', fontSize:11, fontFamily:'inherit', cursor:'pointer', borderRadius:999,
                    background: allocationMode === opt.key ? 'var(--fg)' : 'transparent',
                    color: allocationMode === opt.key ? 'var(--bg)' : 'var(--fg-muted)',
                    border:'1px solid ' + (allocationMode === opt.key ? 'var(--fg)' : 'var(--border)') }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {ct === 'balk'
              ? <AllocationBarChart items={allocationItems} onItemClick={item => item?.partyId && onOpenParty && onOpenParty(item.partyId)} />
              : <DonutChart items={allocationItems} size={isMobile ? 250 : 180} thickness={isMobile ? 38 : 30} legendBelow={isMobile} legendColumns={isMobile ? 2 : 1}
                  onItemClick={item => item?.partyId && onOpenParty && onOpenParty(item.partyId)} />}
          </WidgetShell>
        );
      case 'party_comparison':
        return (
          <WidgetShell>
            {header('Inleg vs. waarde', 'Per partij')}
            <InvestedVsValueChart summaries={portfolioSummaries} height={isMobile ? 210 : 240} />
          </WidgetShell>
        );
      case 'returns':
        return (
          <WidgetShell>
            {header('Rendement', ct === 'tabel' ? 'Overzicht per partij' : '% per partij')}
            {ct === 'tabel'
              ? <ReturnTable summaries={portfolioSummaries} />
              : <div style={{ marginTop:8 }}><ReturnBars summaries={portfolioSummaries} /></div>}
          </WidgetShell>
        );
      case 'monthly_inleg':
        return (
          <WidgetShell>
            {header('Maandelijkse inleg', 'Incl. koopbedragen')}
            {ct === 'lijn'
              ? <MonthlyLineChart months={monthly} height={isMobile ? 170 : 200} />
              : <MonthlyBars months={monthly} height={isMobile ? 170 : 200} />}
          </WidgetShell>
        );
      case 'allocation_lines': {
        const visibleAllocations = allocationGroups.filter(group => !hiddenParties.includes(group.id));
        return (
          <WidgetShell>
            {header('Waarde per allocatie', 'Ontwikkeling per allocatiegroep')}
            {/* Visibility toggles */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {allocationGroups.map(group => {
                const hidden = hiddenParties.includes(group.id);
                return (
                  <button key={group.id} onClick={() => setHiddenParties(
                    hidden ? hiddenParties.filter(id => id !== group.id) : [...hiddenParties, group.id]
                  )} style={{
                    padding:'3px 9px', fontSize:11, fontFamily:'inherit', cursor:'pointer', borderRadius:999,
                    background: hidden ? 'transparent' : group.color,
                    color: hidden ? 'var(--fg-dim)' : '#fff',
                    border: `1px solid ${hidden ? 'var(--border)' : group.color}`,
                    opacity: hidden ? 0.5 : 1, transition:'all .15s',
                  }}>{group.name}</button>
                );
              })}
            </div>
            <AllocationLineChart timeSeries={allocationTimeSeries} parties={visibleAllocations} height={isMobile ? 220 : 260} />
          </WidgetShell>
        );
      }
      case 'party_grid':
        return (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
              <h2 style={{ margin:0, fontFamily:'var(--ff-display)', fontSize:26, fontWeight:500, letterSpacing:'-0.015em' }}>Partijen</h2>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {['all', ...Array.from(new Set(allParties.map(p => p.category)))].map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)}
                    style={{ fontFamily:'inherit', padding:'5px 11px', fontSize:12,
                      background: filterCategory===c?'var(--fg)':'transparent',
                      color: filterCategory===c?'var(--bg)':'var(--fg-muted)',
                      border:'1px solid '+(filterCategory===c?'var(--fg)':'var(--border)'),
                      borderRadius:999, cursor:'pointer' }}>
                    {c === 'all' ? 'Alle' : c}
                  </button>
                ))}
                <button onClick={() => { setEditParty(null); setAddPartyOpen(true); }}
                  style={{ fontFamily:'inherit', padding:'5px 11px', fontSize:12, cursor:'pointer', borderRadius:999,
                    background:'var(--accent)', color:'#fff', border:'1px solid var(--accent)' }}>
                  + Partij toevoegen
                </button>
                {editMode && <button onClick={() => toggleWidget(wCfg.id)}
                  style={{ padding:'5px 11px', fontSize:12, cursor:'pointer', borderRadius:999,
                    background:'transparent', border:'1px solid var(--negative)', color:'var(--negative)', fontFamily:'inherit' }}>
                  Verberg
                </button>}
              </div>
            </div>
            <div className="party-grid-inner" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {summaries
                .filter(s => filterCategory==='all' || s.party.category === filterCategory)
                .map(s => (
                  <PartyCard key={s.party.id} summary={s} total={total} spots={spots}
                    metric={tileMetrics[s.party.id] || 'pnl_eur'}
                    onMetricChange={m => setTileMetric(s.party.id, m)}
                    onClick={() => setDetailPartyId(s.party.id)}
                    onQuickAdd={() => openAdd({ party: s.party.id })}
                    isCustom={!SEED_PARTY_IDS.has(s.party.id)}
                    onEditParty={() => { setEditParty(s.party); setAddPartyOpen(true); }}
                    onDeleteParty={() => deleteCustomParty(s.party.id)}
                  />
                ))}
            </div>
          </div>
        );
      case 'monthly_table':
        return (
          <WidgetShell>
            {header('Maandelijks overzicht', 'P&L en cashflow per maand')}
            <MonthlyTable months={monthly} />
          </WidgetShell>
        );
      case 'activity_feed':
        return (
          <WidgetShell>
            {header('Recente activiteit', `${state.transactions.length} transacties totaal`)}
            <ActivityFeed txs={recentTxs} parties={allParties} onClick={tx => setDetailPartyId(tx.party)} />
          </WidgetShell>
        );
      case 'fees_summary':
        return (
          <WidgetShell>
            {header('Transactiekosten', 'Totaal betaald')}
            <div style={{ display:'grid', gap:10, marginTop:8 }}>
              <div style={{ fontFamily:'var(--ff-mono)', fontSize:28, fontWeight:600, color:totalFees>0?'var(--negative)':'var(--fg-dim)' }}>
                {totalFees > 0 ? `−${fmtEur(totalFees, {decimals:2})}` : '—'}
              </div>
              <div style={{ fontSize:12, color:'var(--fg-muted)' }}>
                {state.transactions.filter(t => t.feeEur > 0).length} transacties met kosten
              </div>
              {totalInvested > 0 && totalFees > 0 && (
                <div style={{ fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
                  {((totalFees / totalInvested) * 100).toFixed(2)}% van totaal ingelegd
                </div>
              )}
            </div>
          </WidgetShell>
        );
      case 'metal_holdings': {
        const metalSummaries = portfolioSummaries.filter(s => s.party.unit==='gram'||s.party.unit==='ounce'||s.party.isMixed);
        return (
          <WidgetShell>
            {header('Edelmetalen', 'Bezit & waarden')}
            <div style={{ display:'grid', gap:10, marginTop:8 }}>
              {metalSummaries.map(s => (
                <div key={s.party.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={dotStyle(s.party.color)} />
                    <span>{s.party.name}</span>
                  </div>
                  <div style={{ textAlign:'right', fontFamily:'var(--ff-mono)', fontSize:12 }}>
                    {s.party.isMixed
                      ? <span>{fmtQty(s.goldQty||0,'g')} + {fmtQty(s.silverQty||0,'oz')}</span>
                      : <span>{fmtQty(s.quantity, s.party.unit)}</span>}
                    <div style={{ color:'var(--fg-muted)', fontSize:11 }}>{fmtEur(s.currentValueEur)}</div>
                  </div>
                </div>
              ))}
            </div>
          </WidgetShell>
        );
      }
      case 'goals':
        return (
          <WidgetShell>
            {header('Doelen voortgang', 'Per partij')}
            <GoalsProgress summaries={portfolioSummaries} />
          </WidgetShell>
        );
      default: return null;
    }
  };

  // Grid layout: group widgets by size — memoized so it only re-runs when active widgets change
  const groupedWidgets = React.useMemo(() => {
    const rows = [];
    let i = 0;
    while (i < activeWidgets.length) {
      const w = activeWidgets[i];
      if (w.size === 'full') { rows.push([w]); i++; continue; }
      if (w.size === 'large') {
        const next = activeWidgets[i + 1];
        if (next && next.size !== 'full' && next.size !== 'large') {
          rows.push([w, next]); i += 2;
        } else {
          rows.push([w]); i++;
        }
        continue;
      }
      // small / medium: pack up to 3 per row
      const row = [w]; i++;
      while (i < activeWidgets.length && row.length < 3) {
        const nw = activeWidgets[i];
        if (nw.size === 'full' || nw.size === 'large') break;
        row.push(nw); i++;
      }
      rows.push(row);
    }
    return rows;
  }, [activeWidgets]);

  const rowTemplate = (row) => {
    if (row.length === 1)  return '1fr';
    if (row.length === 2)  return row[0].size === 'large' ? '1.65fr 1fr' : '1fr 1fr';
    return '1.3fr 1fr 1fr';
  };

  return (
    <div className="dash-wrap" style={{ maxWidth:1360, margin:'0 auto', padding: isMobile ? '16px 12px 100px' : '28px 28px 60px' }}>
      {/* HEADER — desktop only */}
      {!isMobile && (
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, gap:20, flexWrap:'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AppLogo size={44} />
            <div>
            <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
              Portfolio · bijgewerkt {fmtDate(new Date().toISOString().slice(0,10))}
            </div>
            <h1 style={{ margin:0, fontFamily:'var(--ff-display)', fontWeight:500, fontSize:44, letterSpacing:'-0.02em', lineHeight:1 }}>
              Investeringen
            </h1>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <Button variant="ghost" onClick={() => setEditMode(!editMode)}
              style={{ borderColor: editMode ? 'var(--accent)' : undefined, color: editMode ? 'var(--accent)' : undefined }}>
              {editMode ? '✓ Klaar' : '⊞ Dashboard aanpassen'}
            </Button>
            <Button variant="secondary" onClick={() => openAdd({ type: 'waardering' })}>↻ Waardering updaten</Button>
            <Button variant="primary" onClick={() => openAdd()}>+ Transactie toevoegen</Button>
          </div>
        </header>
      )}

      {/* Widget panel (edit mode) — desktop only */}
      {editMode && !isMobile && (
        <div style={{ marginBottom:20, padding:'16px 20px', background:'var(--surface)', border:'1px solid var(--accent)',
          borderRadius:'var(--radius-lg)', display:'grid', gap:10 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
            Dashboard aanpassen — klik om widgets in/uit te schakelen
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {WIDGET_REGISTRY.map(reg => {
              const wCfg = widgets.find(w => w.id === reg.id);
              const enabled = wCfg?.enabled;
              return (
                <button key={reg.id} onClick={() => toggleWidget(reg.id)}
                  title={reg.desc}
                  style={{ padding:'6px 12px', fontSize:12, fontFamily:'inherit', cursor:'pointer', borderRadius:'var(--radius)',
                    background: enabled?'var(--fg)':'var(--surface-2)',
                    color: enabled?'var(--bg)':'var(--fg-muted)',
                    border:'1px solid '+(enabled?'var(--fg)':'var(--border)') }}>
                  {enabled ? '✓ ' : '+ '}{reg.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* HERO TOTALS */}
      {isMobile ? (
        <section style={{ padding:'4px 2px 12px', marginBottom:10, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--fg-muted)', marginBottom:5, fontFamily:'var(--ff-mono)' }}>
                Totale waarde
              </div>
              <div style={{ fontFamily:'var(--ff-display)', fontSize:38, fontWeight:500, lineHeight:1, letterSpacing:'-0.02em' }}>
                {fmtEur(total, {decimals:0})}
              </div>
            </div>
            <div style={{ textAlign:'right', paddingTop:16 }}>
              <Delta value={totalPnl} format="eur" />
              <div style={{ marginTop:3 }}><Delta value={totalPnlPct} /></div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', marginTop:14, borderTop:'1px solid var(--border)' }}>
            {[
              { label:'Ingelegd', value:fmtEur(totalInvested, { decimals:0 }), sub:firstTxDate ? fmtDate(firstTxDate) : '—' },
              { label:'YTD', value:<Delta value={ytd.pnlPct} />, sub:fmtEur(ytd.pnl, { sign:true, decimals:0 }) },
              { label:'Partijen', value:portfolioSummaries.filter(s=>s.currentValueEur>0).length, sub:`${state.transactions.length} tx` },
            ].map((item, idx) => (
              <div key={item.label} style={{ minWidth:0, padding:'9px 8px 0',
                borderLeft: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize:9, color:'var(--fg-dim)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>
                  {item.label}
                </div>
                <div style={{ fontFamily:'var(--ff-mono)', fontSize:12, fontWeight:650, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {item.value}
                </div>
                <div style={{ fontSize:9, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ── Desktop hero: 5-column grid ── */
        <Card style={{ padding:28, marginBottom:20 }}>
          <div className="hero-grid" style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr 1fr 1fr', gap:28, alignItems:'start' }}>
            <div>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--fg-muted)', marginBottom:8, fontFamily:'var(--ff-mono)' }}>
                Totale portfolio waarde
              </div>
              <div style={{ fontFamily:'var(--ff-display)', fontSize:52, fontWeight:500, letterSpacing:'-0.025em', lineHeight:1 }}>
                {fmtEur(total, {decimals:0})}
              </div>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginTop:10, flexWrap:'wrap' }}>
                <Delta value={totalPnl} format="eur" />
                <Delta value={totalPnlPct} />
                <span style={{ fontSize:12, color:'var(--fg-dim)' }}>all-time</span>
              </div>
            </div>
            <HeroStat label="Totaal ingelegd" value={fmtEur(totalInvested)} sub={firstTxDate ? `vanaf ${fmtDate(firstTxDate)}` : '—'} />
            <HeroStat label="YTD rendement"
              value={<Delta value={ytd.pnlPct} />}
              sub={`${fmtEur(ytd.pnl, {sign:true})} sinds 1 jan`} />
            <HeroStat label="Dividenden & rente" value={fmtEur(portfolioSummaries.reduce((s,x)=>s+x.totalIncome,0))} sub={`${portfolioSummaries.filter(s=>s.currentValueEur>0).length} partijen actief`} />
            <HeroStat label="Transactiekosten" value={totalFees > 0 ? `−${fmtEur(totalFees,{decimals:2})}` : '—'}
              sub={`${state.transactions.length} transacties`} valueColor={totalFees > 0 ? 'var(--negative)' : undefined} />
          </div>
        </Card>
      )}

      <CurrentPricesList spots={spots} spotStatus={spotStatus} isMobile={isMobile} />

      {/* Render widget rows */}
      {isMobile ? (
        /* Mobile: alle widgets in één kolom; party_grid vervangen door compacte rijen */
        <div style={{ display:'grid', gap:14 }}>
          {activeWidgets
            .filter(w => w.id !== 'party_grid')
            .map(wCfg => (
              <React.Fragment key={wCfg.id}>
                <div>{renderWidget(wCfg)}</div>
                {/* Compacte partijrijen direct na de waarde-over-tijd grafiek */}
                {wCfg.id === 'portfolio_line' && (
                  <MobilePartyRows summaries={portfolioSummaries} total={total} onOpenParty={onOpenParty} />
                )}
              </React.Fragment>
            ))}
          {/* Fallback: als portfolio_line niet actief is, toon rijen bovenaan */}
          {!activeWidgets.find(w => w.id === 'portfolio_line') && (
            <MobilePartyRows summaries={portfolioSummaries} total={total} onOpenParty={onOpenParty} />
          )}

          {/* Koersen bijwerken — onderaan de pagina */}
          <MobileSpotBar
            tweaks={tweaks} setTweaks={setTweaks}
            spots={spots} state={state}
            onUpdateMeesman={onUpdateMeesman}
            onRefreshSpot={onRefreshSpot}
            spotStatus={spotStatus}
          />
        </div>
      ) : (
        <>
          {groupedWidgets.map((row, ri) => (
            <div key={ri} className="widget-row" style={{ display:'grid', gridTemplateColumns:rowTemplate(row), gap:20, marginBottom:20 }}>
              {row.map(wCfg => (
                <div key={wCfg.id}>{renderWidget(wCfg)}</div>
              ))}
            </div>
          ))}
          <DesktopSpotPanel
            tweaks={tweaks} setTweaks={setTweaks}
            spots={spots} state={state}
            onUpdateMeesman={onUpdateMeesman}
            onRefreshSpot={onRefreshSpot}
            spotStatus={spotStatus}
          />
        </>
      )}

      {/* Empty state */}
      {activeWidgets.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--fg-dim)', fontSize:14 }}>
          Geen widgets actief.{' '}
          <button onClick={() => setEditMode(true)}
            style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
            Dashboard aanpassen
          </button>
        </div>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTx(null); }}
        onSave={saveTx} parties={allParties} preset={modalPreset} initial={editingTx}
        transactions={state.transactions}
      />
      <PartyDetail
        open={!!detailPartyId} onClose={() => setDetailPartyId(null)}
        party={detailParty} summary={detailSummary} spots={spots}
        onAddTx={preset => { setDetailPartyId(null); openAdd(preset); }}
        onDeleteTx={deleteTx} onEditTx={tx => { setDetailPartyId(null); openEdit(tx); }}
      />
      <AddPartyModal
        open={addPartyOpen} onClose={() => { setAddPartyOpen(false); setEditParty(null); }}
        onSave={saveCustomParty} initial={editParty} parties={allParties}
      />
    </div>
  );
}

function CurrentPricesList({ spots, spotStatus, isMobile }) {
  const prices = [
    { label: 'Bitcoin',  value: spots.btcSpotEur,            suffix: '/BTC',  decimals: 0 },
    { label: 'Ethereum', value: spots.ethSpotEur,            suffix: '/ETH',  decimals: 0 },
    { label: 'Pax Gold', value: spots.paxgSpotEur,           suffix: '/PAXG', decimals: 0 },
    { label: 'Goud',     value: spots.goldSpotEurPerGram,    suffix: '/g',    decimals: 2 },
    { label: 'Zilver',   value: spots.silverSpotEurPerOunce, suffix: '/oz',   decimals: 2 },
    { label: 'Meesman',  value: spots.meesmanNavEur,         suffix: '/part', decimals: 4 },
  ];

  return (
    <div style={{ padding: isMobile ? '0 2px 10px' : undefined, marginBottom: isMobile ? 10 : 0,
      borderBottom: isMobile ? '1px solid var(--border)' : undefined }}>
    <Card style={{ padding: isMobile ? 0 : '14px 18px', marginBottom: isMobile ? 0 : 20,
      background: isMobile ? 'transparent' : undefined, border: isMobile ? 'none' : undefined, boxShadow: isMobile ? 'none' : undefined }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12, marginBottom:isMobile ? 8 : 10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Huidige koersen
        </div>
        <div style={{ fontSize:10, color: spotStatus?.error ? 'var(--negative)' : 'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>
          {spotStatus?.fetchedAt ? new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }) : 'live'}
        </div>
      </div>
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        overflowX: isMobile ? 'auto' : undefined,
        gridTemplateColumns: isMobile ? undefined : 'repeat(6, minmax(0, 1fr))',
        gap: isMobile ? 8 : 10,
        paddingBottom: isMobile ? 1 : 0,
      }}>
        {prices.map(p => (
          <div key={p.label} style={{
            minWidth:0,
            flex: isMobile ? '0 0 118px' : undefined,
            padding: isMobile ? '2px 10px 2px 0' : '8px 9px',
            background: isMobile ? 'transparent' : 'var(--surface-2)',
            border: isMobile ? 'none' : '1px solid var(--border)',
            borderRight: isMobile ? '1px solid var(--border)' : undefined,
            borderRadius: isMobile ? 0 : 'var(--radius)',
          }}>
            <div style={{ fontSize:10, color:'var(--fg-dim)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>
              {p.label}
            </div>
            <div style={{ fontFamily:'var(--ff-mono)', fontSize:isMobile ? 12 : 13, color:'var(--fg)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {p.value != null ? fmtEur(p.value, { decimals: p.decimals }) : '—'}<span style={{ color:'var(--fg-dim)', fontSize:10 }}> {p.suffix}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
    </div>
  );
}

// Compacte partijrijen voor mobiel home-scherm
function MobilePartyRows({ summaries, total, onOpenParty }) {
  const [metric, setMetric] = React.useState('all_eur');
  const METRICS = [
    { key: 'all_eur', label: 'Winst €' },
    { key: 'all_pct', label: 'Winst %' },
    { key: 'value',   label: 'Waarde' },
  ];

  const rows = [...summaries]
    .filter(s => s.currentValueEur > 0 || s.invested > 0)
    .sort((a, b) => {
      if (metric === 'value')   return (b.currentValueEur || 0) - (a.currentValueEur || 0);
      if (metric === 'all_pct') return (b.pnlPct || 0) - (a.pnlPct || 0);
      return (b.pnl || 0) - (a.pnl || 0);
    });

  return (
    <section style={{ padding: '0 2px 4px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.01em' }}>Partijen</div>
        <div style={{ display:'flex', gap:4 }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              style={{ padding:'3px 9px', fontSize:11, fontFamily:'inherit', cursor:'pointer',
                borderRadius:999,
                border:'1px solid '+(metric===m.key?'var(--fg)':'var(--border)'),
                background: metric===m.key?'var(--fg)':'transparent',
                color:       metric===m.key?'var(--bg)':'var(--fg-muted)' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ borderTop:'1px solid var(--border)' }}>
        {rows.map((s, i) => {
          const val   = metric === 'all_pct' ? s.pnlPct : metric === 'all_eur' ? s.pnl : s.currentValueEur;
          const isPct = metric === 'all_pct';
          const isVal = metric === 'value';
          const share = total > 0 ? (s.currentValueEur / total * 100) : 0;
          return (
            <button key={s.party.id} onClick={() => onOpenParty && onOpenParty(s.party.id)}
              style={{ display:'flex', alignItems:'center', gap:9, width:'100%', textAlign:'left',
              padding:'9px 0', border:'none', borderBottom: i < rows.length-1 ? '1px solid var(--border)' : 'none',
              background:'transparent', color:'inherit', fontFamily:'inherit', cursor:'pointer' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.party.color, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {s.party.name}
                </div>
                <div style={{ fontSize:10, fontFamily:'var(--ff-mono)',
                  color: isVal
                    ? (s.pnl||0)>=0 ? 'var(--positive)' : 'var(--negative)'
                    : 'var(--fg-dim)' }}>
                  {isVal
                    ? `${(s.pnl||0)>=0?'+':'−'}${fmtEur(Math.abs(s.pnl||0))} · ${(s.pnlPct||0)>=0?'+':''}${(s.pnlPct||0).toFixed(1)}%`
                    : `${fmtEur(s.currentValueEur)} · ${share.toFixed(0)}%`}
                </div>
              </div>
              <div style={{ fontFamily:'var(--ff-mono)', fontSize:13, fontWeight:600, flexShrink:0,
                color: isVal ? 'var(--fg)' : (val||0)>0?'var(--positive)':(val||0)<0?'var(--negative)':'var(--fg-muted)' }}>
                {isVal
                  ? fmtEur(val||0)
                  : isPct
                  ? `${(val||0)>=0?'+':''}${(val||0).toFixed(1)}%`
                  : `${(val||0)>=0?'+':'−'}${fmtEur(Math.abs(val||0))}`}
              </div>
              <div aria-hidden="true" style={{ color:'var(--fg-dim)', fontSize:17, lineHeight:1, flexShrink:0 }}>›</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Koersen bijwerken — onderaan het mobiele home-scherm
function MobileSpotBar({ tweaks, setTweaks, spots, state, onUpdateMeesman, onRefreshSpot, spotStatus }) {
  const [meesmanInput, setMeesmanInput] = React.useState('');
  const lastNav = spots.meesmanNavEur ?? state.meesmanNavEur ?? 100.4;
  const lastDate = (state.meesmanNavHistory || []).slice(-1)[0]?.date || '—';

  const inpStyle = {
    width: 92, padding: '6px 8px', fontSize: 14, fontFamily: 'var(--ff-mono)',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--fg)', outline: 'none', textAlign: 'right',
  };
  const row = (label, sub, input) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'10px 0',
      borderBottom:'1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>{sub}</div>}
      </div>
      {input}
    </div>
  );

  const handleSaveMeesman = () => {
    const v = parseFloat((meesmanInput || '').replace(',', '.'));
    if (v > 0) { onUpdateMeesman(v); setMeesmanInput(''); }
  };

  return (
    <Card style={{ padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Koersen
        </div>
        <button onClick={onRefreshSpot} disabled={spotStatus?.loading}
          style={{ padding:'3px 9px', fontSize:11, fontFamily:'inherit', cursor:'pointer',
            borderRadius:'var(--radius)', border:'1px solid var(--border)',
            background:'transparent', color:'var(--fg)', opacity: spotStatus?.loading ? 0.5 : 1 }}>
          {spotStatus?.loading ? '↻…' : '↻ Live'}
        </button>
      </div>
      {row('Goud', `€/gram · nu ${tweaks.goldSpotEurPerGram?.toFixed(2) || '—'}`,
        <input type="number" step="0.01" style={inpStyle}
          value={tweaks.goldSpotEurPerGram || ''}
          onChange={e => setTweaks(t => ({...t, goldSpotEurPerGram: +e.target.value}))} />
      )}
      {row('Zilver', `€/oz · nu ${tweaks.silverSpotEurPerOunce?.toFixed(2) || '—'}`,
        <input type="number" step="0.01" style={inpStyle}
          value={tweaks.silverSpotEurPerOunce || ''}
          onChange={e => setTweaks(t => ({...t, silverSpotEurPerOunce: +e.target.value}))} />
      )}
      <div style={{ padding:'10px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>Meesman</div>
            <div style={{ fontSize:10, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>
              €/aandeel · nu {lastNav.toFixed(2)} · {lastDate}
            </div>
          </div>
          <input type="number" step="0.01" style={inpStyle}
            value={meesmanInput}
            onChange={e => setMeesmanInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveMeesman()}
            placeholder={lastNav.toFixed(2)} />
        </div>
        {meesmanInput.length > 0 && (
          <button onClick={handleSaveMeesman}
            style={{ marginTop:8, width:'100%', padding:'8px', fontSize:13, fontWeight:600,
              fontFamily:'inherit', cursor:'pointer', borderRadius:'var(--radius)',
              background:'var(--accent)', color:'#fff', border:'none' }}>
            Meesman opslaan — €{parseFloat(meesmanInput.replace(',','.'))||0}
          </button>
        )}
      </div>
      {spotStatus?.fetchedAt && (
        <div style={{ fontSize:10, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)', marginTop:4 }}>
          Live bijgewerkt {new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}
        </div>
      )}
    </Card>
  );
}

function DesktopSpotPanel({ tweaks, setTweaks, spots, state, onUpdateMeesman, onRefreshSpot, spotStatus }) {
  const [meesmanInput, setMeesmanInput] = React.useState('');
  const lastNav = spots.meesmanNavEur ?? state.meesmanNavEur ?? DEFAULT_MEESMAN_NAV_EUR;
  const lastDate = (state.meesmanNavHistory || []).slice(-1)[0]?.date || '—';
  const saveMeesman = () => {
    const v = parseFloat((meesmanInput || '').replace(',', '.'));
    if (v > 0) { onUpdateMeesman(v); setMeesmanInput(''); }
  };
  return (
    <Card style={{ padding:'16px 20px', marginTop:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap', marginBottom:12 }}>
        <SectionTitle title="Koersen" subtitle="Goud, zilver en Meesman onderaan het dashboard" />
        <button onClick={onRefreshSpot} disabled={spotStatus?.loading}
          style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--fg)',
            padding:'6px 12px', borderRadius:'var(--radius)', fontSize:12, cursor:'pointer',
            fontFamily:'inherit', opacity:spotStatus?.loading?0.5:1 }}>
          {spotStatus?.loading ? 'Ophalen...' : 'Ververs live'}
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(180px, 1fr))', gap:14 }}>
        <SpotPriceField
          label="Goud" sub={`€/gram · ${state.goldHistory?.length || 0} historische punten`}
          value={tweaks.goldSpotEurPerGram}
          onChange={v => setTweaks(t => ({...t, goldSpotEurPerGram:v}))}
        />
        <SpotPriceField
          label="Zilver" sub={`€/oz · ${state.silverHistory?.length || 0} historische punten`}
          value={tweaks.silverSpotEurPerOunce}
          onChange={v => setTweaks(t => ({...t, silverSpotEurPerOunce:v}))}
        />
        <div>
          <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
            Meesman
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input type="number" step="0.01" value={meesmanInput}
              onChange={e => setMeesmanInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveMeesman()}
              placeholder={lastNav.toFixed(4)}
              style={{ ...inputStyle, padding:'7px 9px', fontFamily:'var(--ff-mono)' }} />
            <button onClick={saveMeesman} disabled={!meesmanInput}
              style={{ padding:'7px 11px', borderRadius:'var(--radius)', border:'1px solid var(--border)',
                background: meesmanInput ? 'var(--accent)' : 'var(--surface-2)',
                color: meesmanInput ? '#fff' : 'var(--fg-dim)', cursor:meesmanInput?'pointer':'default', fontFamily:'inherit' }}>
              Opslaan
            </button>
          </div>
          <div style={{ marginTop:5, fontSize:11, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>
            nu €{lastNav.toFixed(4)} · {lastDate} · {(state.meesmanNavHistory || []).length} punten
          </div>
        </div>
      </div>
      <div style={{ marginTop:10, fontSize:10, color:spotStatus?.error?'var(--negative)':'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>
        {spotStatus?.fetchedAt
          ? `Bijgewerkt ${new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`
          : spotStatus?.error ? spotStatus.error : 'Auto-ververs elke 30 sec · opslag dagelijks'}
      </div>
    </Card>
  );
}

function SpotPriceField({ label, sub, value, onChange }) {
  return (
    <label>
      <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
        {label}
      </div>
      <input type="number" step="0.01" value={value || ''}
        onChange={e => onChange(+e.target.value)}
        style={{ ...inputStyle, padding:'7px 9px', fontFamily:'var(--ff-mono)' }} />
      <div style={{ marginTop:5, fontSize:11, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>{sub}</div>
    </label>
  );
}

function HeroStat({ label, value, sub, valueColor }) {
  return (
    <div style={{ borderLeft:'1px solid var(--border)', paddingLeft:22 }}>
      <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--fg-muted)', marginBottom:8, fontFamily:'var(--ff-mono)' }}>
        {label}
      </div>
      <div style={{ fontFamily:'var(--ff-mono)', fontSize:22, fontWeight:500, color: valueColor || 'var(--fg)' }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--fg-dim)', marginTop:4 }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14, gap:14, flexWrap:'wrap' }}>
      <div>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--fg)', letterSpacing:'-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize:11, color:'var(--fg-muted)', marginTop:2, fontFamily:'var(--ff-mono)' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function SpotEditor({ label, value, onChange, step }) {
  return (
    <label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <span style={{ color:'var(--fg-dim)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
      <input type="number" step={step} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width:90, padding:'4px 8px', border:'1px solid var(--border)', background:'var(--surface-2)',
          color:'var(--fg)', borderRadius:'var(--radius)', fontFamily:'var(--ff-mono)', fontSize:12 }} />
    </label>
  );
}

function formatHoldingQty(summary) {
  const p = summary.party;
  const unit = p.unitLabel || p.unit;
  const decimals = p.unit === 'crypto' ? 8 : undefined;
  return fmtQty(summary.quantity || 0, unit, { decimals });
}

function PartyCard({ summary, total, spots, onClick, onQuickAdd, metric = 'pnl_eur', onMetricChange, isCustom, onEditParty, onDeleteParty }) {
  const p = summary.party;
  const [metricOpen, setMetricOpen] = React.useState(false);
  const share   = total > 0 ? (summary.currentValueEur / total) * 100 : 0;
  const goalPct = p.isMixed
    ? (summary.currentValueEur / (p.goal||1)) * 100
    : (p.unit==='gram'||p.unit==='ounce')
      ? (summary.quantity / (p.goal||1)) * 100
      : (summary.currentValueEur / (p.goal||1)) * 100;

  // Metric display
  const metricLabel = TILE_METRICS.find(m => m.key === metric)?.short || '%';
  const metricNode = (() => {
    switch (metric) {
      case 'pnl_eur':  return <><Delta value={summary.pnl} format="eur" /> <span style={{ fontSize:10, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>winst</span></>;
      case 'pnl_pct':  return <><Delta value={summary.pnlPct} /> <span style={{ fontSize:10, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>all-time</span></>;
      case 'ytd_pct':  return <span style={{ fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>YTD — zie grafiek</span>;
      case 'value':    return <span style={{ fontFamily:'var(--ff-mono)', fontSize:13, color:'var(--fg)' }}>{fmtEur(summary.currentValueEur,{decimals:2})}</span>;
      case 'invested': return <span style={{ fontFamily:'var(--ff-mono)', fontSize:13, color:'var(--fg-muted)' }}>inleg {fmtEur(summary.invested,{decimals:0})}</span>;
      case 'share':    return <span style={{ fontFamily:'var(--ff-mono)', fontSize:13, color:'var(--fg-muted)' }}>{share.toFixed(1)}% van portfolio</span>;
      default:         return <Delta value={summary.pnlPct} />;
    }
  })();

  return (
    <Card hover onClick={onClick} style={{ padding:18, display:'flex', flexDirection:'column', gap:12, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:p.color, borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start' }}>
        <div>
          <div style={{ fontFamily:'var(--ff-display)', fontSize:18, fontWeight:500, letterSpacing:'-0.01em', lineHeight:1.2 }}>{p.name}</div>
          <div style={{ fontSize:11, color:'var(--fg-muted)', marginTop:3 }}>{p.subtitle}</div>
        </div>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          {(p.includeInTotal     ?? p.includeInPortfolio) === false && <Pill tone="neutral">Niet in totaal</Pill>}
          {(p.includeInTimeChart ?? p.includeInPortfolio) === false && <Pill tone="neutral">Niet in grafiek</Pill>}
          <Pill tone="neutral">{p.category}</Pill>
          <button onClick={e => { e.stopPropagation(); onEditParty && onEditParty(); }}
            title="Bewerken" style={{ background:'transparent', border:'none', color:'var(--fg-muted)', cursor:'pointer', fontSize:11, padding:'2px 4px' }}>✎</button>
          {isCustom && (
            <button onClick={e => { e.stopPropagation(); onDeleteParty && onDeleteParty(); }}
              title="Verwijderen" style={{ background:'transparent', border:'none', color:'var(--fg-dim)', cursor:'pointer', fontSize:13, padding:'2px 4px' }}>×</button>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontFamily:'var(--ff-mono)', fontSize:22, fontWeight:500, color:'var(--fg)', letterSpacing:'-0.01em' }}>
          {fmtEur(summary.currentValueEur, {decimals:0})}
        </div>
        <div style={{ display:'flex', gap:10, marginTop:4, alignItems:'center', flexWrap:'wrap' }}>
          {metricNode}
        </div>
      </div>

      {/* Metal quantity */}
      {(p.unit==='gram'||p.unit==='ounce') && (
        <div style={{ fontSize:11, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', display:'flex', justifyContent:'space-between' }}>
          <span>{fmtQty(summary.quantity, p.unit)}</span>
          <span>spot {fmtEur(spotEurForParty(p, spots), {decimals:2})}/{p.unit}</span>
        </div>
      )}
      {p.isMixed && (
        <div style={{ fontSize:11, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <span>Au: {fmtQty(summary.goldQty||0,'g')}</span>
          <span>Ag: {fmtQty((summary.silverQty||0) * OZ_TO_GRAM,'g')}</span>
        </div>
      )}
      {p.unit==='part' && summary.quantity > 0 && (
        <div style={{ fontSize:11, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', display:'flex', justifyContent:'space-between' }}>
          <span>{fmtQty(summary.quantity, p.unitLabel)}</span>
          {summary.currentUnitPrice && <span>koers {fmtEur(summary.currentUnitPrice,{decimals:2})}</span>}
        </div>
      )}
      {p.unit==='crypto' && summary.quantity > 0 && (
        <div style={{ fontSize:11, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', display:'flex', justifyContent:'space-between', gap:8 }}>
          <span>bezit {formatHoldingQty(summary)}</span>
          {summary.currentUnitPrice && <span>koers {fmtEur(summary.currentUnitPrice,{decimals:2})}</span>}
        </div>
      )}

      {/* Goal bar */}
      {p.goal > 0 && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--fg-dim)', marginBottom:4, fontFamily:'var(--ff-mono)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            <span>Doel</span>
            <span>{p.isMixed || p.unit==='eur' || p.unit==='part' ? fmtEur(p.goal) : fmtQty(p.goal, p.unit)} · {goalPct.toFixed(0)}%</span>
          </div>
          <div style={{ height:4, background:'var(--surface-2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${Math.min(100,Math.max(0,goalPct))}%`, height:'100%', background:p.color, transition:'width .3s' }} />
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'auto', paddingTop:6, borderTop:'1px solid var(--border)', position:'relative' }}>
        {/* Metric picker */}
        <div style={{ position:'relative' }}>
          <button onClick={e => { e.stopPropagation(); setMetricOpen(o => !o); }}
            style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)',
              padding:'3px 8px', fontSize:10, color:'var(--fg-muted)', cursor:'pointer', fontFamily:'var(--ff-mono)' }}>
            {metricLabel} ▾
          </button>
          {metricOpen && (
            <div onClick={e => e.stopPropagation()} style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0,
              background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
              boxShadow:'0 8px 24px rgba(0,0,0,0.2)', zIndex:50, minWidth:160, overflow:'hidden' }}>
              {TILE_METRICS.map(m => (
                <button key={m.key} onClick={() => { onMetricChange && onMetricChange(m.key); setMetricOpen(false); }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', fontSize:12, fontFamily:'inherit',
                    background: metric===m.key ? 'var(--surface-2)' : 'transparent',
                    color: metric===m.key ? 'var(--fg)' : 'var(--fg-muted)',
                    border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                  {metric===m.key ? '✓ ' : '  '}{m.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onQuickAdd(); }}
          style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius)',
            padding:'4px 10px', fontSize:11, color:'var(--fg-muted)', cursor:'pointer', fontFamily:'inherit' }}>
          + tx
        </button>
      </div>
    </Card>
  );
}

// ===== Modal: voeg aangepaste partij toe / bewerk =====
const PARTY_UNIT_OPTIONS = [
  { value:'bundle', label:'Totale waarde — zoals Top 25 / Trading 212', defaultLabel:'€' },
  { value:'part',   label:'Aantal × prijs — normale aandelen / participaties', defaultLabel:'st.' },
  { value:'eur',    label:'Eurobedrag — cash / sparen', defaultLabel:'€' },
  { value:'crypto', label:'Token × koers — Bitcoin / Ethereum / PAXG', defaultLabel:'TOKEN' },
  { value:'gram',   label:'Gram × spotprijs — goud', defaultLabel:'g' },
  { value:'ounce',  label:'Ounce × spotprijs — zilver', defaultLabel:'oz' },
];
const CATEGORY_OPTIONS = ['Indexfondsen','Crypto','Edelmetaal','Broker','Liquide','Overig'];
const CUSTOM_CATEGORY_VALUE = '__custom_category__';
const COLOR_PRESETS = [
  'oklch(58% 0.14 255)','oklch(72% 0.18 55)','oklch(60% 0.12 265)',
  'oklch(76% 0.14 85)','oklch(62% 0.15 195)','oklch(55% 0.16 145)',
  'oklch(70% 0.03 240)','oklch(65% 0.18 320)','oklch(68% 0.15 30)',
  'oklch(62% 0.13 170)','oklch(72% 0.22 310)','oklch(55% 0.05 160)',
];

function AddPartyModal({ open, onClose, onSave, initial, parties = [] }) {
  const blank = p => ({
    name:     p?.name     || '',
    subtitle: p?.subtitle || '',
    category: p?.category || 'Overig',
    customCategory: '',
    unit:     p?.unit     || 'eur',
    unitLabel:p?.unitLabel|| '€',
    goal:     p?.goal     || '',
    color:    p?.color    || COLOR_PRESETS[0],
    spotKey:  p?.spotKey  || '',
    // Twee aparte vlaggen, met fallback op het oude includeInPortfolio voor bestaande partijen
    includeInTotal:     (p?.includeInTotal     ?? p?.includeInPortfolio) !== false,
    includeInTimeChart: (p?.includeInTimeChart ?? p?.includeInPortfolio) !== false,
  });
  const [form, setForm] = React.useState(() => blank(initial));
  React.useEffect(() => { if (open) setForm(blank(initial)); }, [open, initial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const categoryOptions = React.useMemo(() => {
    const seen = new Set();
    return [...CATEGORY_OPTIONS, ...(parties || []).map(p => p.category).filter(Boolean), initial?.category]
      .filter(Boolean)
      .filter(c => {
        if (seen.has(c)) return false;
        seen.add(c);
        return true;
      });
  }, [parties, initial]);
  const selectedCategory = categoryOptions.includes(form.category) ? form.category : CUSTOM_CATEGORY_VALUE;
  const finalCategory = selectedCategory === CUSTOM_CATEGORY_VALUE
    ? (form.customCategory || form.category || '').trim()
    : form.category;
  const setUnit = value => {
    const option = PARTY_UNIT_OPTIONS.find(o => o.value === value);
    setForm(f => ({
      ...f,
      unit: value,
      unitLabel: option?.defaultLabel || f.unitLabel || '€',
      spotKey: value === 'crypto' ? f.spotKey : '',
    }));
  };

  const valid = form.name.trim().length > 0 && finalCategory.length > 0;

  const submit = () => {
    if (!valid) return;
    const id = initial?.id || 'custom_' + Date.now().toString(36);
    onSave({ id, name:form.name.trim(), subtitle:form.subtitle.trim(),
      category:finalCategory, unit:form.unit, unitLabel:form.unitLabel||'€',
      goal: +form.goal || 0, color:form.color,
      includeInTotal:     form.includeInTotal     !== false,
      includeInTimeChart: form.includeInTimeChart !== false,
      ...(form.unit==='crypto' && form.spotKey ? { spotKey:form.spotKey } : {}),
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width={480}>
      <div style={{ padding:'20px 22px 12px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontFamily:'var(--ff-display)', fontSize:22, fontWeight:500 }}>
          {initial ? 'Partij bewerken' : 'Partij toevoegen'}
        </div>
        <div style={{ fontSize:12, color:'var(--fg-muted)', marginTop:4 }}>
          Maak een eigen beleggingscategorie aan.
        </div>
      </div>
      <div style={{ padding:22, display:'grid', gap:13 }}>
        <Field label="Naam">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="bijv. Pensioenfonds ABP" />
        </Field>
        <Field label="Omschrijving (optioneel)">
          <Input value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="bijv. Werkgeverspensioenfonds" />
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Categorie">
            <Select value={selectedCategory} onChange={e => {
              const value = e.target.value;
              if (value === CUSTOM_CATEGORY_VALUE) setForm(f => ({ ...f, category: CUSTOM_CATEGORY_VALUE, customCategory: '' }));
              else setForm(f => ({ ...f, category: value, customCategory: '' }));
            }}>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              <option value={CUSTOM_CATEGORY_VALUE}>Nieuwe allocatie…</option>
            </Select>
          </Field>
          <Field label="Waarderingsmethode">
            <Select value={form.unit} onChange={e => setUnit(e.target.value)}>
              {PARTY_UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
        {selectedCategory === CUSTOM_CATEGORY_VALUE && (
          <Field label="Nieuwe allocatie" hint="Deze naam blijft daarna beschikbaar als allocatie.">
            <Input value={form.customCategory} onChange={e => set('customCategory', e.target.value)} placeholder="bijv. Pensioen, Vastgoed, Obligaties" />
          </Field>
        )}
        {form.unit === 'crypto' && (
          <Field label="Spot-prijs sleutel (optioneel)" hint="bijv. btcSpotEur, ethSpotEur, paxgSpotEur">
            <Input value={form.spotKey} onChange={e => set('spotKey', e.target.value)} placeholder="btcSpotEur" />
          </Field>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Eenheid label (bijv. part. / BTC)">
            <Input value={form.unitLabel} onChange={e => set('unitLabel', e.target.value)} placeholder="€" />
          </Field>
          <Field label="Doel (€ of eenheden)">
            <Input type="number" value={form.goal} onChange={e => set('goal', e.target.value)} placeholder="5000" />
          </Field>
        </div>
        <Field label="Kleur">
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => set('color', c)} type="button"
                style={{ width:26, height:26, borderRadius:'50%', background:c, border:form.color===c?'3px solid var(--fg)':'2px solid transparent', cursor:'pointer' }} />
            ))}
          </div>
        </Field>
        <div style={{ display:'grid', gap:8 }}>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'11px 12px',
            border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface-2)', cursor:'pointer' }}>
            <input type="checkbox" checked={form.includeInTotal !== false}
              onChange={e => set('includeInTotal', e.target.checked)}
              style={{ marginTop:2, accentColor:'var(--accent)' }} />
            <span>
              <span style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg)' }}>Meenemen in totale waarde</span>
              <span style={{ display:'block', fontSize:11, color:'var(--fg-muted)', marginTop:2 }}>
                Telt mee in totale waarde, ingelegd, P&amp;L, YTD en de verdeling-donut.
              </span>
            </span>
          </label>
          <label style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'11px 12px',
            border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'var(--surface-2)', cursor:'pointer' }}>
            <input type="checkbox" checked={form.includeInTimeChart !== false}
              onChange={e => set('includeInTimeChart', e.target.checked)}
              style={{ marginTop:2, accentColor:'var(--accent)' }} />
            <span>
              <span style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg)' }}>Meenemen in waarde-over-tijd grafiek</span>
              <span style={{ display:'block', fontSize:11, color:'var(--fg-muted)', marginTop:2 }}>
                Telt mee in de portfolio-tijdlijn en de allocatie-grafiek. Onafhankelijk van bovenstaande keuze.
              </span>
            </span>
          </label>
        </div>
      </div>
      <div style={{ padding:'12px 22px 18px', display:'flex', justifyContent:'space-between', gap:10, borderTop:'1px solid var(--border)', background:'var(--surface-2)' }}>
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button variant="primary" onClick={submit} style={{ opacity:valid?1:0.4 }}>
          {initial ? 'Opslaan' : 'Toevoegen'}
        </Button>
      </div>
    </Modal>
  );
}

function MonthlyTable({ months }) {
  const rows = [...months].reverse().slice(0, 8);
  return (
    <div className="monthly-table-wrap" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
    <div className="monthly-table" style={{ display:'grid', gap:6, minWidth:620 }}>
      <div className="monthly-row monthly-head" style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr 1fr 1fr 1fr 1fr', fontSize:10, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing:'0.05em', padding:'0 4px 6px', borderBottom:'1px solid var(--border)', fontFamily:'var(--ff-mono)' }}>
        <span className="monthly-cell monthly-month">Maand</span>
        <span className="monthly-cell monthly-inleg" style={{ textAlign:'right' }}>Inleg</span>
        <span className="monthly-cell monthly-koop" style={{ textAlign:'right' }}>Koop</span>
        <span className="monthly-cell monthly-income" style={{ textAlign:'right' }}>Inkomsten</span>
        <span className="monthly-cell monthly-costs" style={{ textAlign:'right' }}>Kosten</span>
        <span className="monthly-cell monthly-fees" style={{ textAlign:'right' }}>Tx-kosten</span>
      </div>
      {rows.map(m => (
        <div className="monthly-row" key={m.month} style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr 1fr 1fr 1fr 1fr', fontSize:13,
          padding:'8px 4px', borderBottom:'1px dashed var(--border)', fontFamily:'var(--ff-mono)' }}>
          <span className="monthly-cell monthly-month" style={{ color:'var(--fg)' }}>{fmtMonth(m.month)}</span>
          <span className="monthly-cell monthly-inleg" data-label="Inleg" style={{ textAlign:'right', color:m.inleg>0?'var(--fg)':'var(--fg-dim)' }}>{m.inleg>0?fmtEur(m.inleg):'—'}</span>
          <span className="monthly-cell monthly-koop" data-label="Koop" style={{ textAlign:'right', color:m.koop>0?'var(--fg)':'var(--fg-dim)' }}>{m.koop>0?fmtEur(m.koop):'—'}</span>
          <span className="monthly-cell monthly-income" data-label="Ink." style={{ textAlign:'right', color:m.dividend>0?'var(--positive)':'var(--fg-dim)' }}>{m.dividend>0?`+${fmtEur(m.dividend,{decimals:2})}`:'—'}</span>
          <span className="monthly-cell monthly-costs" data-label="Kosten" style={{ textAlign:'right', color:(m.opname+m.kosten)>0?'var(--negative)':'var(--fg-dim)' }}>{(m.opname+m.kosten)>0?`−${fmtEur(m.opname+m.kosten)}`:'—'}</span>
          <span className="monthly-cell monthly-fees" data-label="Tx" style={{ textAlign:'right', color:m.fees>0?'var(--negative)':'var(--fg-dim)' }}>{m.fees>0?`−${fmtEur(m.fees,{decimals:2})}`:'—'}</span>
        </div>
      ))}
      {rows.length===0 && <div style={{ color:'var(--fg-dim)', fontSize:13, padding:20, textAlign:'center' }}>Geen data.</div>}
    </div>
    </div>
  );
}

function ActivityFeed({ txs, parties, onClick }) {
  const partyList = parties || PARTIES;
  if (!txs.length) return <div style={{ color:'var(--fg-dim)', fontSize:13, padding:'24px 0' }}>Geen activiteit.</div>;
  return (
    <div style={{ display:'grid', gap:2 }}>
      {txs.map(t => {
        const p = partyList.find(x => x.id === t.party);
        return (
          <div key={t.id} onClick={() => onClick(t)} style={{ display:'grid', gridTemplateColumns:'8px 1fr auto',
            gap:10, alignItems:'center', padding:'10px 2px', borderBottom:'1px dashed var(--border)', cursor:'pointer' }}>
            <div style={dotStyle(p?.color||'var(--fg-dim)', 6)} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, color:'var(--fg)', display:'flex', gap:6, alignItems:'center' }}>
                <span>{p?.name}</span>
                <Pill tone={txTone(t.type)} style={{ fontSize:10, padding:'1px 6px' }}>{TX_LABELS[t.type]}</Pill>
              </div>
              <div style={{ fontSize:11, color:'var(--fg-dim)', marginTop:2, fontFamily:'var(--ff-mono)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {fmtDate(t.date)}{t.note ? ` · ${t.note}` : ''}
              </div>
            </div>
            <div style={{ fontFamily:'var(--ff-mono)', fontSize:13, textAlign:'right' }}>
              {formatTxAmount(t, p)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { Dashboard, PartyCard, MonthlyTable, ActivityFeed, SectionTitle, HeroStat, SpotEditor, AddPartyModal, TILE_METRICS });
