// Preview dashboard layouts — three distinct visual paradigms
// Each reuses data layer + chart components but with unique layout

function useDashboardData({ state, setState, tweaks, spotStatus, onRefreshSpot, onUpdateMeesman, onOpenParty }) {
  const spots = React.useMemo(() => ({
    goldSpotEurPerGram:    tweaks.goldSpotEurPerGram,
    silverSpotEurPerOunce: tweaks.silverSpotEurPerOunce,
    btcSpotEur:            tweaks.btcSpotEur,
    ethSpotEur:            tweaks.ethSpotEur,
    paxgSpotEur:           tweaks.paxgSpotEur,
    meesmanNavEur:         state.meesmanNavEur ?? tweaks.meesmanNavEur ?? 100.4,
    meesmanNavHistory:     (state.meesmanNavHistory?.length ? state.meesmanNavHistory : null) ?? tweaks.meesmanNavHistory ?? [],
    goldHistory: state.goldHistory || [], silverHistory: state.silverHistory || [],
    btcHistory: state.btcHistory || [], ethHistory: state.ethHistory || [], paxgHistory: state.paxgHistory || [],
  }), [tweaks, state]);

  const allParties = React.useMemo(
    () => (state.parties?.length ? state.parties : PARTIES), [state.parties]
  );
  const summaries = React.useMemo(
    () => allParties.map(p => summarizeParty(p, state.transactions, spots)),
    [state.transactions, spots, allParties]
  );
  const portfolioSummaries = React.useMemo(
    () => summaries.filter(s => s.party.includeInPortfolio !== false), [summaries]
  );
  const total = portfolioSummaries.reduce((s, x) => s + x.currentValueEur, 0);
  const totalInvested = portfolioSummaries.reduce((s, x) => s + x.invested, 0);
  const totalPnl = portfolioSummaries.reduce((s, x) => s + x.pnl, 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const timeSeries = React.useMemo(() => {
    const supabaseSeries = (state.portfolioDailyValues || [])
      .map(p => ({ date: p.date, total: +p.total, invested: +p.invested }))
      .filter(p => p.date && Number.isFinite(p.total));
    const liveSeries = buildValueTimeSeries(state.transactions, allParties.filter(p => p.includeInPortfolio !== false), spots);
    const byDate = new Map();
    supabaseSeries.forEach(p => byDate.set(p.date, p));
    liveSeries.forEach(p => byDate.set(p.date, p));
    byDate.set(todayIsoLocal(), { date: todayIsoLocal(), total, invested: totalInvested });
    return [...byDate.values()].filter(p => p.date >= '2025-01-01').sort((a, b) => a.date.localeCompare(b.date));
  }, [state, spots, total, totalInvested, allParties]);

  const ytd = React.useMemo(() => calcYTDReturn(timeSeries), [timeSeries]);
  const sparse = React.useMemo(() => {
    if (timeSeries.length <= 180) return timeSeries;
    const step = Math.ceil(timeSeries.length / 180);
    return timeSeries.filter((_, i) => i % step === 0 || i === timeSeries.length - 1);
  }, [timeSeries]);

  const allocationItems = React.useMemo(() => {
    return portfolioSummaries
      .filter(s => s.currentValueEur > 0)
      .map(s => ({ label: s.party.name, value: s.currentValueEur, color: s.party.color, partyId: s.party.id }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioSummaries]);

  const recentTxs = React.useMemo(
    () => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [state.transactions]
  );

  return { spots, allParties, summaries, portfolioSummaries, total, totalInvested, totalPnl, totalPnlPct, timeSeries, sparse, ytd, allocationItems, recentTxs };
}

// ══════════════════════════════════════════════════════════════
// TERMINAL DASHBOARD — dense blotter table
// ══════════════════════════════════════════════════════════════
function TerminalDashboard(props) {
  const { state, setState, tweaks, onOpenParty } = props;
  const d = useDashboardData(props);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState(null);

  const openParty = id => { setDetailId(id); onOpenParty && onOpenParty(id); };
  const detailParty = detailId ? d.allParties.find(p => p.id === detailId) : null;
  const detailSummary = detailParty ? d.summaries.find(s => s.party.id === detailId) : null;

  const saveTx = tx => setState(s => {
    const stamped = { ...tx, updatedAt: new Date().toISOString() };
    const exists = s.transactions.some(t => t.id === tx.id);
    const { [tx.id]: _, ...deletedTransactionIds } = s.deletedTransactionIds || {};
    return { ...s, transactions: exists ? s.transactions.map(t => t.id === tx.id ? stamped : t) : [...s.transactions, stamped], deletedTransactionIds };
  });

  const sorted = [...d.portfolioSummaries].sort((a, b) => b.currentValueEur - a.currentValueEur);

  return (
    <div style={{ padding: '12px 16px 40px', fontFamily: 'var(--ff-mono)', fontSize: 12 }}>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8,
        padding: '6px 8px', borderBottom: '2px solid var(--accent)', color: 'var(--accent)',
        fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <span>Partij</span><span>Waarde</span><span>Ingelegd</span><span>Winst €</span><span>Winst %</span><span>Aandeel</span>
      </div>
      {/* Data rows */}
      {sorted.map(s => {
        const share = d.total > 0 ? (s.currentValueEur / d.total * 100) : 0;
        return (
          <button key={s.party.id} onClick={() => openParty(s.party.id)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8,
              width: '100%', padding: '5px 8px', border: 'none', borderBottom: '1px solid var(--border)',
              background: 'transparent', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12,
              cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ color: 'var(--accent)' }}>{s.party.name.toUpperCase()}</span>
            <span>{fmtEur(s.currentValueEur, { decimals: 0 })}</span>
            <span style={{ color: 'var(--fg-muted)' }}>{fmtEur(s.invested, { decimals: 0 })}</span>
            <span style={{ color: s.pnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
              {(s.pnl >= 0 ? '+' : '') + fmtEur(s.pnl, { decimals: 0 })}
            </span>
            <span style={{ color: s.pnlPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
              {(s.pnlPct >= 0 ? '+' : '') + s.pnlPct.toFixed(1) + '%'}
            </span>
            <span style={{ color: 'var(--fg-dim)' }}>{share.toFixed(1)}%</span>
          </button>
        );
      })}

      {/* Chart + allocation side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginTop: 20 }}>
        <div style={{ border: '1px solid var(--border)', padding: 12 }}>
          <div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.08em' }}>WAARDE OVER TIJD</div>
          <LineChart data={d.sparse} height={180} />
        </div>
        <div style={{ border: '1px solid var(--border)', padding: 12 }}>
          <div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.08em' }}>VERDELING</div>
          <DonutChart items={d.allocationItems} size={140} thickness={24} />
        </div>
      </div>

      {/* Recent transactions blotter */}
      <div style={{ marginTop: 16, border: '1px solid var(--border)' }}>
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
          RECENTE TRANSACTIES
        </div>
        {d.recentTxs.map(tx => {
          const party = d.allParties.find(p => p.id === tx.party);
          const typeInfo = TX_TYPES.find(t => t.key === tx.type);
          return (
            <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px', gap: 8,
              padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--fg-muted)' }}>
              <span>{tx.date}</span>
              <span style={{ color: 'var(--fg)' }}>{party?.name || tx.party}</span>
              <span>{typeInfo?.label || tx.type}</span>
              <span style={{ textAlign: 'right' }}>{tx.amountEur ? fmtEur(tx.amountEur) : '—'}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={() => setModalOpen(true)} style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, borderRadius: 0 }}>+ TRANSACTIE</Button>
      </div>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={saveTx}
        parties={d.allParties} transactions={state.transactions} />
      <PartyDetail open={!!detailId} onClose={() => setDetailId(null)} party={detailParty} summary={detailSummary}
        spots={d.spots} onAddTx={() => {}} onDeleteTx={() => {}} onEditTx={() => {}} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VAULT DASHBOARD — Robinhood hero + holdings list
// ══════════════════════════════════════════════════════════════
function VaultDashboard(props) {
  const { state, setState, onOpenParty } = props;
  const d = useDashboardData(props);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState(null);

  const openParty = id => { setDetailId(id); onOpenParty && onOpenParty(id); };
  const detailParty = detailId ? d.allParties.find(p => p.id === detailId) : null;
  const detailSummary = detailParty ? d.summaries.find(s => s.party.id === detailId) : null;

  const saveTx = tx => setState(s => {
    const stamped = { ...tx, updatedAt: new Date().toISOString() };
    const exists = s.transactions.some(t => t.id === tx.id);
    const { [tx.id]: _, ...deletedTransactionIds } = s.deletedTransactionIds || {};
    return { ...s, transactions: exists ? s.transactions.map(t => t.id === tx.id ? stamped : t) : [...s.transactions, stamped], deletedTransactionIds };
  });

  const sorted = [...d.portfolioSummaries].sort((a, b) => b.currentValueEur - a.currentValueEur);

  return (
    <div style={{ padding: '32px 40px 60px' }}>
      {/* Hero */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)', fontWeight: 500, marginBottom: 4 }}>Portfolio waarde</div>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--fg)' }}>
          {fmtEur(d.total, { decimals: 0 })}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: d.totalPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {(d.totalPnl >= 0 ? '+' : '') + fmtEur(d.totalPnl, { decimals: 0 })}
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: d.totalPnlPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            ({(d.totalPnlPct >= 0 ? '+' : '') + d.totalPnlPct.toFixed(1)}%)
          </span>
          <span style={{ fontSize: 13, color: 'var(--fg-dim)' }}>all-time</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24, maxWidth: 480 }}>
          {[
            { l: 'Ingelegd', v: fmtEur(d.totalInvested, { decimals: 0 }) },
            { l: 'YTD', v: `${d.ytd.pnlPct >= 0 ? '+' : ''}${d.ytd.pnlPct.toFixed(1)}%` },
            { l: 'Partijen', v: d.portfolioSummaries.filter(s => s.currentValueEur > 0).length },
          ].map(item => (
            <div key={item.l} style={{ background: 'var(--surface)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>{item.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)' }}>{item.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--fg)' }}>Waarde over tijd</div>
          <LineChart data={d.sparse} height={200} />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--fg)' }}>Verdeling</div>
          <DonutChart items={d.allocationItems} size={160} thickness={28} legendBelow />
        </div>
      </div>

      {/* Holdings list */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--fg)' }}>Holdings</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)} style={{ borderRadius: 999, fontWeight: 600 }}>+ Transactie</Button>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {sorted.map((s, i) => {
            const share = d.total > 0 ? (s.currentValueEur / d.total * 100) : 0;
            return (
              <button key={s.party.id} onClick={() => openParty(s.party.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px',
                  border: 'none', borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.party.color,
                  display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.party.name[0]}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>{s.party.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{s.party.category} · {share.toFixed(1)}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>{fmtEur(s.currentValueEur, { decimals: 0 })}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.pnlPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                    {(s.pnlPct >= 0 ? '+' : '') + s.pnlPct.toFixed(1)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={saveTx}
        parties={d.allParties} transactions={state.transactions} />
      <PartyDetail open={!!detailId} onClose={() => setDetailId(null)} party={detailParty} summary={detailSummary}
        spots={d.spots} onAddTx={() => {}} onDeleteTx={() => {}} onEditTx={() => {}} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LUMINA DASHBOARD — cinematic glass cards + wide chart
// ══════════════════════════════════════════════════════════════
function LuminaDashboard(props) {
  const { state, setState, onOpenParty } = props;
  const d = useDashboardData(props);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState(null);

  const openParty = id => { setDetailId(id); onOpenParty && onOpenParty(id); };
  const detailParty = detailId ? d.allParties.find(p => p.id === detailId) : null;
  const detailSummary = detailParty ? d.summaries.find(s => s.party.id === detailId) : null;

  const saveTx = tx => setState(s => {
    const stamped = { ...tx, updatedAt: new Date().toISOString() };
    const exists = s.transactions.some(t => t.id === tx.id);
    const { [tx.id]: _, ...deletedTransactionIds } = s.deletedTransactionIds || {};
    return { ...s, transactions: exists ? s.transactions.map(t => t.id === tx.id ? stamped : t) : [...s.transactions, stamped], deletedTransactionIds };
  });

  const sorted = [...d.portfolioSummaries].sort((a, b) => b.currentValueEur - a.currentValueEur);

  const GlassCard = ({ children, style, onClick }) => (
    <div onClick={onClick} style={{
      background: 'color-mix(in oklab, var(--surface) 80%, transparent)',
      border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)',
      borderRadius: 16, backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      ...style,
    }}>{children}</div>
  );

  return (
    <div>
      {/* Hero glass card with gradient accent */}
      <GlassCard style={{ padding: '32px 36px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent) 50%, #ec4899))' }} />
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Netto vermogen
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)', lineHeight: 1 }}>
          {fmtEur(d.total, { decimals: 0 })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'baseline' }}>
          <Delta value={d.totalPnl} format="eur" />
          <Delta value={d.totalPnlPct} />
        </div>
        {/* Allocation bar */}
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 20, gap: 2 }}>
          {d.allocationItems.map(item => (
            <div key={item.label} style={{
              flex: item.value, background: item.color, minWidth: 4,
              borderRadius: 2,
            }} title={`${item.label}: ${fmtEur(item.value)}`} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {d.allocationItems.slice(0, 5).map(item => (
            <span key={item.label} style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
              {item.label} {d.total > 0 ? (item.value / d.total * 100).toFixed(0) + '%' : ''}
            </span>
          ))}
        </div>
      </GlassCard>

      {/* Wide chart */}
      <GlassCard style={{ padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 16 }}>Portfolio performance</div>
        <LineChart data={d.sparse} height={240} />
      </GlassCard>

      {/* Stats + holdings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { l: 'Ingelegd', v: fmtEur(d.totalInvested, { decimals: 0 }) },
          { l: 'Winst', v: fmtEur(d.totalPnl, { sign: true, decimals: 0 }), color: d.totalPnl >= 0 ? 'var(--positive)' : 'var(--negative)' },
          { l: 'YTD', v: `${d.ytd.pnlPct >= 0 ? '+' : ''}${d.ytd.pnlPct.toFixed(1)}%`, color: d.ytd.pnlPct >= 0 ? 'var(--positive)' : 'var(--negative)' },
          { l: 'Partijen', v: d.portfolioSummaries.filter(s => s.currentValueEur > 0).length },
        ].map(item => (
          <GlassCard key={item.l} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>{item.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color || 'var(--fg)', fontFamily: 'var(--ff-mono)' }}>{item.v}</div>
          </GlassCard>
        ))}
      </div>

      {/* Holdings glass grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--fg)' }}>Assets</h2>
        <Button variant="primary" onClick={() => setModalOpen(true)} style={{ borderRadius: 10 }}>+ Transactie</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {sorted.map(s => {
          const share = d.total > 0 ? (s.currentValueEur / d.total * 100) : 0;
          return (
            <GlassCard key={s.party.id} style={{ padding: '18px 20px', cursor: 'pointer' }}
              onClick={() => openParty(s.party.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.party.color,
                  boxShadow: `0 0 12px color-mix(in oklab, ${s.party.color} 40%, transparent)` }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{s.party.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{s.party.category}</div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', fontFamily: 'var(--ff-mono)' }}>
                {fmtEur(s.currentValueEur, { decimals: 0 })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: s.pnlPct >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                  {(s.pnlPct >= 0 ? '+' : '') + s.pnlPct.toFixed(1)}%
                </span>
                <span style={{ color: 'var(--fg-dim)' }}>{share.toFixed(1)}% portfolio</span>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Allocation donut */}
      <GlassCard style={{ padding: '24px 28px', marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 16 }}>Allocatie</div>
        <DonutChart items={d.allocationItems} size={180} thickness={32} legendBelow legendColumns={2}
          onItemClick={item => item?.partyId && openParty(item.partyId)} />
      </GlassCard>

      <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={saveTx}
        parties={d.allParties} transactions={state.transactions} />
      <PartyDetail open={!!detailId} onClose={() => setDetailId(null)} party={detailParty} summary={detailSummary}
        spots={d.spots} onAddTx={() => {}} onDeleteTx={() => {}} onEditTx={() => {}} />
    </div>
  );
}

window.PREVIEW_DASHBOARDS = {
  terminal: TerminalDashboard,
  vault: VaultDashboard,
  lumina: LuminaDashboard,
};
