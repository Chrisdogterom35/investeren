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

function Dashboard({ state, setState, tweaks, setTweaks, spotStatus, onRefreshSpot }) {
  const [modalOpen, setModalOpen]               = React.useState(false);
  const [modalPreset, setModalPreset]           = React.useState(null);
  const [editingTx, setEditingTx]               = React.useState(null);
  const [detailPartyId, setDetailPartyId]       = React.useState(null);
  const [filterCategory, setFilterCategory]     = React.useState('all');
  const [editMode, setEditMode]                 = React.useState(false);
  const [addPartyOpen, setAddPartyOpen]         = React.useState(false);
  const [editParty, setEditParty]               = React.useState(null);

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

  // Merge built-in + custom parties
  const allParties = React.useMemo(
    () => [...PARTIES, ...(state.customParties || [])],
    [state.customParties]
  );

  const summaries = React.useMemo(
    () => allParties.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots, allParties]
  );

  const hiddenParties  = state.hiddenParties  || [];
  const tileMetrics    = state.tileMetrics    || {};

  const setHiddenParties = React.useCallback(ids => {
    setState(s => ({ ...s, hiddenParties: ids }));
  }, [setState]);

  const setTileMetric = React.useCallback((partyId, metric) => {
    setState(s => ({ ...s, tileMetrics: { ...(s.tileMetrics || {}), [partyId]: metric } }));
  }, [setState]);

  const total        = summaries.reduce((s, x) => s + x.currentValueEur, 0);
  const totalInvested= summaries.reduce((s, x) => s + x.invested, 0);
  const totalPnl     = total - totalInvested;
  const totalPnlPct  = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const totalFees    = state.transactions.reduce((s, t) => s + (+t.feeEur || 0) + (t.type === 'kosten' ? (+t.amountEur || 0) : 0), 0);

  const timeSeries = React.useMemo(
    () => buildValueTimeSeries(state.transactions, allParties, spots),
    [state.transactions, spots, allParties]
  );
  const partyTimeSeries = React.useMemo(
    () => buildPartyTimeSeries(state.transactions, allParties, spots),
    [state.transactions, spots, allParties]
  );
  const monthly = React.useMemo(() => buildMonthlyFlows(state.transactions), [state.transactions]);

  const ytd = React.useMemo(() => calcYTDReturn(timeSeries), [timeSeries]);

  const sparse = React.useMemo(() => {
    if (timeSeries.length <= 180) return timeSeries;
    const step = Math.ceil(timeSeries.length / 180);
    return timeSeries.filter((_, i) => i % step === 0 || i === timeSeries.length - 1);
  }, [timeSeries]);

  const detailParty   = detailPartyId ? allParties.find(p => p.id === detailPartyId) : null;
  const detailSummary = detailParty ? summaries.find(s => s.party.id === detailParty.id) : null;

  const openAdd  = (preset = null) => { setModalPreset(preset); setEditingTx(null); setModalOpen(true); };
  const openEdit = (tx)            => { setEditingTx(tx); setModalPreset(null); setModalOpen(true); };
  const saveTx   = (tx) => setState(s => {
    const exists = s.transactions.some(t => t.id === tx.id);
    return { ...s, transactions: exists ? s.transactions.map(t => t.id === tx.id ? tx : t) : [...s.transactions, tx] };
  });
  const deleteTx = (id) => setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));

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

  const donutItems = summaries
    .filter(s => s.currentValueEur > 0)
    .map(s => ({ label: s.party.name, value: s.currentValueEur, color: s.party.color }));

  const saveCustomParty = React.useCallback(p => {
    setState(s => {
      const exists = (s.customParties || []).some(x => x.id === p.id);
      return { ...s, customParties: exists
        ? (s.customParties || []).map(x => x.id === p.id ? p : x)
        : [...(s.customParties || []), p] };
    });
  }, [setState]);

  const deleteCustomParty = React.useCallback(id => {
    if (!confirm('Partij verwijderen? Bijbehorende transacties blijven bestaan.')) return;
    setState(s => ({ ...s, customParties: (s.customParties || []).filter(p => p.id !== id) }));
  }, [setState]);

  // Render a widget by id
  const renderWidget = (wCfg) => {
    const reg = WIDGET_REGISTRY.find(r => r.id === wCfg.id);
    if (!reg) return null;
    const ct = wCfg.chartType;

    const header = (title, sub) => (
      <SectionTitle title={title} subtitle={sub} right={
        editMode && (
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

    switch (wCfg.id) {
      case 'portfolio_line':
        return (
          <Card style={{ padding:22 }}>
            {header('Waarde over tijd', 'Huidige waarde vs. ingelegd')}
            <LineChart data={sparse} height={230} />
          </Card>
        );
      case 'allocation':
        return (
          <Card style={{ padding:22 }}>
            {header('Verdeling', 'Aandeel per partij')}
            {ct === 'donut'
              ? <DonutChart items={donutItems} size={180} thickness={30} />
              : <AllocationBarChart items={donutItems} />}
          </Card>
        );
      case 'party_comparison':
        return (
          <Card style={{ padding:22 }}>
            {header('Inleg vs. waarde', 'Per partij')}
            <InvestedVsValueChart summaries={summaries} height={240} />
          </Card>
        );
      case 'returns':
        return (
          <Card style={{ padding:22 }}>
            {header('Rendement', '% per partij')}
            <div style={{ marginTop:8 }}><ReturnBars summaries={summaries} /></div>
          </Card>
        );
      case 'monthly_inleg':
        return (
          <Card style={{ padding:22 }}>
            {header('Maandelijkse inleg', 'Incl. koopbedragen')}
            <MonthlyBars months={monthly} height={200} />
          </Card>
        );
      case 'allocation_lines': {
        const visibleParties = allParties.filter(p => !hiddenParties.includes(p.id));
        return (
          <Card style={{ padding:22 }}>
            {header('Waarde per allocatie', 'Ontwikkeling per partij')}
            {/* Visibility toggles */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {allParties.map(p => {
                const hidden = hiddenParties.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setHiddenParties(
                    hidden ? hiddenParties.filter(id => id !== p.id) : [...hiddenParties, p.id]
                  )} style={{
                    padding:'3px 9px', fontSize:11, fontFamily:'inherit', cursor:'pointer', borderRadius:999,
                    background: hidden ? 'transparent' : p.color,
                    color: hidden ? 'var(--fg-dim)' : '#fff',
                    border: `1px solid ${hidden ? 'var(--border)' : p.color}`,
                    opacity: hidden ? 0.5 : 1, transition:'all .15s',
                  }}>{p.name}</button>
                );
              })}
            </div>
            <AllocationLineChart timeSeries={partyTimeSeries} parties={visibleParties} height={260} />
          </Card>
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {summaries
                .filter(s => filterCategory==='all' || s.party.category === filterCategory)
                .map(s => (
                  <PartyCard key={s.party.id} summary={s} total={total} spots={spots}
                    metric={tileMetrics[s.party.id] || 'pnl_eur'}
                    onMetricChange={m => setTileMetric(s.party.id, m)}
                    onClick={() => setDetailPartyId(s.party.id)}
                    onQuickAdd={() => openAdd({ party: s.party.id })}
                    isCustom={!!(state.customParties||[]).find(p => p.id === s.party.id)}
                    onEditParty={() => { setEditParty(s.party); setAddPartyOpen(true); }}
                    onDeleteParty={() => deleteCustomParty(s.party.id)}
                  />
                ))}
            </div>
          </div>
        );
      case 'monthly_table':
        return (
          <Card style={{ padding:22 }}>
            {header('Maandelijks overzicht', 'P&L en cashflow per maand')}
            <MonthlyTable months={monthly} />
          </Card>
        );
      case 'activity_feed':
        return (
          <Card style={{ padding:22 }}>
            {header('Recente activiteit', `${state.transactions.length} transacties totaal`)}
            <ActivityFeed txs={recentTxs} parties={allParties} onClick={tx => setDetailPartyId(tx.party)} />
          </Card>
        );
      case 'fees_summary':
        return (
          <Card style={{ padding:22 }}>
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
          </Card>
        );
      case 'metal_holdings': {
        const metalSummaries = summaries.filter(s => s.party.unit==='gram'||s.party.unit==='ounce'||s.party.isMixed);
        return (
          <Card style={{ padding:22 }}>
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
          </Card>
        );
      }
      case 'goals':
        return (
          <Card style={{ padding:22 }}>
            {header('Doelen voortgang', 'Per partij')}
            <GoalsProgress summaries={summaries} />
          </Card>
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
    <div style={{ maxWidth:1360, margin:'0 auto', padding:'28px 28px 60px' }}>
      {/* HEADER */}
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, gap:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
            Portfolio · bijgewerkt {fmtDate(new Date().toISOString().slice(0,10))}
          </div>
          <h1 style={{ margin:0, fontFamily:'var(--ff-display)', fontWeight:500, fontSize:44, letterSpacing:'-0.02em', lineHeight:1 }}>
            Investeringen
          </h1>
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

      {/* Widget panel (edit mode) */}
      {editMode && (
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
      <Card style={{ padding:28, marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 1fr 1fr 1fr', gap:28, alignItems:'center', flexWrap:'wrap' }}>
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
          <HeroStat label="Dividenden & rente" value={fmtEur(summaries.reduce((s,x)=>s+x.totalIncome,0))} sub={`${PARTIES.length} partijen actief`} />
          <HeroStat label="Transactiekosten" value={totalFees > 0 ? `−${fmtEur(totalFees,{decimals:2})}` : '—'}
            sub={`${state.transactions.length} transacties`} valueColor={totalFees > 0 ? 'var(--negative)' : undefined} />
        </div>
      </Card>

      {/* Spot rates bar */}
      <div style={{ marginBottom:20, padding:'12px 20px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
        display:'flex', gap:24, alignItems:'center', fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', flexWrap:'wrap' }}>
        <span style={{ color:'var(--fg-dim)', textTransform:'uppercase', letterSpacing:'0.06em', fontSize:10 }}>
          Spot ·{' '}
          {spotStatus?.error ? <span style={{ color:'var(--negative)' }}>offline</span>
            : spotStatus?.fetchedAt ? <span style={{ color:'var(--positive)' }}>live</span>
            : spotStatus?.loading ? 'ophalen…' : 'handmatig'}
        </span>
        <SpotEditor label="Goud (€/g)" value={tweaks.goldSpotEurPerGram} onChange={v => setTweaks(t => ({...t,goldSpotEurPerGram:v}))} step="0.01" />
        <SpotEditor label="Zilver (€/oz)" value={tweaks.silverSpotEurPerOunce} onChange={v => setTweaks(t => ({...t,silverSpotEurPerOunce:v}))} step="0.01" />
        <button onClick={onRefreshSpot} disabled={spotStatus?.loading}
          style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--fg)',
            padding:'5px 12px', borderRadius:'var(--radius)', fontSize:11, cursor:'pointer',
            fontFamily:'inherit', opacity:spotStatus?.loading?0.5:1 }}>
          {spotStatus?.loading ? 'Ophalen…' : '↻ Ververs'}
        </button>
        <span style={{ marginLeft:'auto', color:'var(--fg-dim)' }}>
          {spotStatus?.fetchedAt
            ? `Bijgewerkt ${new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})} · gold-api.com`
            : spotStatus?.error ? `⚠ ${spotStatus.error}`
            : 'Auto-ververs elke 10 min'}
        </span>
      </div>

      {/* Render widget rows */}
      {groupedWidgets.map((row, ri) => (
        <div key={ri} style={{ display:'grid', gridTemplateColumns:rowTemplate(row), gap:20, marginBottom:20 }}>
          {row.map(wCfg => (
            <div key={wCfg.id}>{renderWidget(wCfg)}</div>
          ))}
        </div>
      ))}

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
        onSave={saveCustomParty} initial={editParty}
      />
    </div>
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
          <Pill tone="neutral">{p.category}</Pill>
          {isCustom && (
            <>
              <button onClick={e => { e.stopPropagation(); onEditParty && onEditParty(); }}
                title="Bewerken" style={{ background:'transparent', border:'none', color:'var(--fg-muted)', cursor:'pointer', fontSize:11, padding:'2px 4px' }}>✎</button>
              <button onClick={e => { e.stopPropagation(); onDeleteParty && onDeleteParty(); }}
                title="Verwijderen" style={{ background:'transparent', border:'none', color:'var(--fg-dim)', cursor:'pointer', fontSize:13, padding:'2px 4px' }}>×</button>
            </>
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
  { value:'eur',    label:'Euro (€) — cash/sparen' },
  { value:'part',   label:'Participaties / aandelen' },
  { value:'gram',   label:'Gram goud' },
  { value:'ounce',  label:'Ounce zilver' },
  { value:'crypto', label:'Crypto token' },
  { value:'bundle', label:'Bundel (totaalwaarde)' },
];
const CATEGORY_OPTIONS = ['Indexfondsen','Crypto','Edelmetaal','Broker','Liquide','Overig'];
const COLOR_PRESETS = [
  'oklch(58% 0.14 255)','oklch(72% 0.18 55)','oklch(60% 0.12 265)',
  'oklch(76% 0.14 85)','oklch(62% 0.15 195)','oklch(55% 0.16 145)',
  'oklch(70% 0.03 240)','oklch(65% 0.18 320)','oklch(68% 0.15 30)',
  'oklch(62% 0.13 170)','oklch(72% 0.22 310)','oklch(55% 0.05 160)',
];

function AddPartyModal({ open, onClose, onSave, initial }) {
  const blank = p => ({
    name:     p?.name     || '',
    subtitle: p?.subtitle || '',
    category: p?.category || 'Overig',
    unit:     p?.unit     || 'eur',
    unitLabel:p?.unitLabel|| '€',
    goal:     p?.goal     || '',
    color:    p?.color    || COLOR_PRESETS[0],
    spotKey:  p?.spotKey  || '',
  });
  const [form, setForm] = React.useState(() => blank(initial));
  React.useEffect(() => { if (open) setForm(blank(initial)); }, [open, initial]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.name.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    const id = initial?.id || 'custom_' + Date.now().toString(36);
    onSave({ id, name:form.name.trim(), subtitle:form.subtitle.trim(),
      category:form.category, unit:form.unit, unitLabel:form.unitLabel||'€',
      goal: +form.goal || 0, color:form.color,
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
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Type eenheid">
            <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
              {PARTY_UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
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
    <div style={{ display:'grid', gap:6 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', fontSize:10, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing:'0.05em', padding:'0 4px 6px', borderBottom:'1px solid var(--border)', fontFamily:'var(--ff-mono)' }}>
        <span>Maand</span>
        <span style={{ textAlign:'right' }}>Inleg</span>
        <span style={{ textAlign:'right' }}>Koop</span>
        <span style={{ textAlign:'right' }}>Inkomsten</span>
        <span style={{ textAlign:'right' }}>Kosten</span>
        <span style={{ textAlign:'right' }}>Transactiekosten</span>
      </div>
      {rows.map(m => (
        <div key={m.month} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', fontSize:13,
          padding:'8px 4px', borderBottom:'1px dashed var(--border)', fontFamily:'var(--ff-mono)' }}>
          <span style={{ color:'var(--fg)' }}>{fmtMonth(m.month)}</span>
          <span style={{ textAlign:'right', color:m.inleg>0?'var(--fg)':'var(--fg-dim)' }}>{m.inleg>0?fmtEur(m.inleg):'—'}</span>
          <span style={{ textAlign:'right', color:m.koop>0?'var(--fg)':'var(--fg-dim)' }}>{m.koop>0?fmtEur(m.koop):'—'}</span>
          <span style={{ textAlign:'right', color:m.dividend>0?'var(--positive)':'var(--fg-dim)' }}>{m.dividend>0?`+${fmtEur(m.dividend,{decimals:2})}`:'—'}</span>
          <span style={{ textAlign:'right', color:(m.opname+m.kosten)>0?'var(--negative)':'var(--fg-dim)' }}>{(m.opname+m.kosten)>0?`−${fmtEur(m.opname+m.kosten)}`:'—'}</span>
          <span style={{ textAlign:'right', color:m.fees>0?'var(--negative)':'var(--fg-dim)' }}>{m.fees>0?`−${fmtEur(m.fees,{decimals:2})}`:'—'}</span>
        </div>
      ))}
      {rows.length===0 && <div style={{ color:'var(--fg-dim)', fontSize:13, padding:20, textAlign:'center' }}>Geen data.</div>}
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
