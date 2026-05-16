// TransactionsTab + PensionTab

// ===== Transactions Tab =====
function TransactionsTab({ state, setState, spots }) {
  const allParties = React.useMemo(
    () => (state.parties && state.parties.length) ? state.parties : PARTIES,
    [state.parties]
  );
  const [filterParty, setFilterParty] = React.useState('all');
  const [filterType, setFilterType] = React.useState('all');
  const [expandedId, setExpandedId] = React.useState(null);
  const [editingTx, setEditingTx] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [preset, setPreset] = React.useState(null);

  const sorted = React.useMemo(
    () => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [state.transactions]
  );

  const filtered = React.useMemo(() => sorted.filter(t => {
    if (filterParty !== 'all' && t.party !== filterParty) return false;
    if (filterType  !== 'all' && t.type  !== filterType)  return false;
    return true;
  }), [sorted, filterParty, filterType]);

  const saveTx = tx => setState(s => {
    const exists = s.transactions.some(t => t.id === tx.id);
    return { ...s, transactions: exists
      ? s.transactions.map(t => t.id === tx.id ? tx : t)
      : [...s.transactions, tx] };
  });
  const deleteTx = id => {
    if (!confirm('Transactie verwijderen?')) return;
    setState(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
  };
  const openEdit = tx => { setEditingTx(tx); setPreset(null); setModalOpen(true); };
  const openAdd  = (p = null) => { setEditingTx(null); setPreset(p); setModalOpen(true); };

  return (
    <div className="tx-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 28px 60px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, gap:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
            {filtered.length} van {sorted.length} transacties
          </div>
          <h1 style={{ margin:0, fontFamily:'var(--ff-display)', fontWeight:500, fontSize:38, letterSpacing:'-0.02em', lineHeight:1 }}>
            Transacties
          </h1>
        </div>
        <Button variant="primary" onClick={() => openAdd()}>+ Transactie toevoegen</Button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <FilterChip active={filterParty==='all'} onClick={() => setFilterParty('all')}>Alle partijen</FilterChip>
          {allParties.map(p => (
            <FilterChip key={p.id} active={filterParty===p.id} onClick={() => setFilterParty(p.id)} color={p.color}>
              {p.name}
            </FilterChip>
          ))}
        </div>
        <div style={{ width:'1px', height:20, background:'var(--border)', margin:'0 4px' }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <FilterChip active={filterType==='all'} onClick={() => setFilterType('all')}>Alle types</FilterChip>
          {TX_TYPES.map(t => (
            <FilterChip key={t.key} active={filterType===t.key} onClick={() => setFilterType(t.key)}>
              {t.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div style={{ borderTop:'1px solid var(--border)' }}>
        {/* Table header */}
        <div className="tx-table-head" style={{ display:'grid', gridTemplateColumns:'86px 112px 104px minmax(120px,1fr) 94px 82px 96px 62px 56px',
          padding:'8px 0', fontSize:9, fontWeight:600,
          color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:'var(--ff-mono)', gap:8 }}>
          <span className="tx-col-date">Datum</span>
          <span className="tx-col-party">Partij</span>
          <span className="tx-col-type">Type</span>
          <span className="tx-col-details">Details</span>
          <span className="tx-col-amount" style={{ textAlign:'right' }}>Bedrag</span>
          <span className="tx-col-fee" style={{ textAlign:'right' }}>Kosten</span>
          <span className="tx-col-total" style={{ textAlign:'right' }}>Totaal</span>
          <span className="tx-col-note">Notitie</span>
          <span className="tx-col-actions"></span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--fg-dim)', fontSize:14 }}>
            Geen transacties gevonden.
          </div>
        )}

        {filtered.map((t, idx) => {
          const p = allParties.find(x => x.id === t.party);
          if (!p) return null;
          const expanded = expandedId === t.id;
          return (
            <div key={t.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
              {/* Main row */}
              <div className="tx-row" onClick={() => setExpandedId(expanded ? null : t.id)}
                style={{ display:'grid', gridTemplateColumns:'86px 112px 104px minmax(120px,1fr) 94px 82px 96px 62px 56px',
                  padding:'8px 0', gap:8, alignItems:'center', cursor:'pointer',
                  background: expanded ? 'var(--surface-2)' : 'transparent',
                  transition:'background .1s' }}>
                <span className="tx-col-date" style={{ fontFamily:'var(--ff-mono)', fontSize:11, color:'var(--fg-muted)' }}>
                  {fmtDate(t.date)}
                </span>
                <span className="tx-col-party" style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, minWidth:0 }}>
                  <span style={dotStyle(p.color, 6)} />
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                </span>
                <span className="tx-col-type"><Pill tone={txTone(t.type)} style={{ fontSize:9, padding:'2px 6px' }}>{TX_LABELS[t.type]||t.type}</Pill></span>
                <span className="tx-col-details" style={{ fontFamily:'var(--ff-mono)', fontSize:11, color:'var(--fg-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {formatTxDetails(t, p)}
                </span>
                <span className="tx-col-amount" style={{ textAlign:'right', fontFamily:'var(--ff-mono)', fontSize:11 }}>
                  {formatTxAmount(t, p)}
                </span>
                <span className="tx-col-fee" style={{ textAlign:'right', fontFamily:'var(--ff-mono)', fontSize:10, color: t.feeEur > 0 ? 'var(--negative)' : 'var(--fg-dim)' }}>
                  {t.feeEur > 0 ? `−${fmtEur(t.feeEur,{decimals:2})}` : '—'}
                </span>
                <span className="tx-col-total" style={{ textAlign:'right', fontFamily:'var(--ff-mono)', fontSize:11, fontWeight:600 }}>
                  {(() => {
                    if (t.quantity != null && t.unitPriceEur != null) {
                      const gross = (+t.quantity) * (+t.unitPriceEur);
                      const total = gross + (+t.feeEur || 0);
                      const isIncome = t.type === 'dividend' || t.type === 'cashback';
                      return <span style={{ color: isIncome ? 'var(--positive)' : 'var(--fg)' }}>{fmtEur(total,{decimals:2})}</span>;
                    }
                    if (t.amountEur != null) {
                      const isOut = t.type === 'opname' || t.type === 'kosten';
                      return <span style={{ color: isOut ? 'var(--negative)' : 'var(--fg-muted)' }}>{fmtEur(t.amountEur,{decimals:2})}</span>;
                    }
                    return <span style={{ color:'var(--fg-dim)' }}>—</span>;
                  })()}
                </span>
                <span className="tx-col-note" style={{ fontSize:10, color:'var(--fg-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.note || ''}
                </span>
                <span className="tx-col-actions" style={{ display:'flex', justifyContent:'flex-end', gap:0 }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(t); }}
                    style={{ background:'transparent', border:'none', color:'var(--fg-muted)', cursor:'pointer', fontSize:12, padding:'3px 4px' }}>✎</button>
                  <button onClick={e => { e.stopPropagation(); deleteTx(t.id); }}
                    style={{ background:'transparent', border:'none', color:'var(--fg-dim)', cursor:'pointer', fontSize:15, padding:'3px 4px' }}>×</button>
                </span>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding:'12px 24px 16px', background:'var(--surface-2)',
                  borderTop:'1px solid var(--border)', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:16 }}>
                  {t.quantity != null && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Aantal</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)' }}>
                        {fmtQty(t.quantity, p.isMixed ? (t.metalType==='zilver'?'ounce':'gram') : (p.unit==='eur'?'stuks':p.unit))}
                      </div>
                    </div>
                  )}
                  {t.unitPriceEur != null && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Prijs per eenheid</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)' }}>{fmtEur(t.unitPriceEur,{decimals:4})}</div>
                    </div>
                  )}
                  {t.quantity != null && t.unitPriceEur != null && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Orderbedrag</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)' }}>{fmtEur(t.quantity*t.unitPriceEur,{decimals:2})}</div>
                    </div>
                  )}
                  {t.amountEur != null && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Bedrag</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)' }}>{fmtEur(t.amountEur,{decimals:2})}</div>
                    </div>
                  )}
                  {t.feeEur > 0 && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Transactiekosten</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--negative)' }}>−{fmtEur(t.feeEur,{decimals:2})}</div>
                    </div>
                  )}
                  {t.metalType && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Metaal</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)', textTransform:'capitalize' }}>{t.metalType}</div>
                    </div>
                  )}
                  {t.valueEur != null && (
                    <div>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Totale waarde</div>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, color:'var(--fg)' }}>{fmtEur(t.valueEur,{decimals:2})}</div>
                    </div>
                  )}
                  {t.note && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--fg-dim)', marginBottom:4 }}>Notitie</div>
                      <div style={{ fontSize:13, color:'var(--fg-muted)' }}>{t.note}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTx(null); }}
        onSave={saveTx}
        parties={allParties}
        preset={preset}
        initial={editingTx}
        transactions={state.transactions}
      />
    </div>
  );
}

function formatTxDetails(t, party) {
  const prefix = t.instrument ? `${t.instrument} · ` : '';
  if (t.quantity != null && t.unitPriceEur != null) {
    const unit = party?.isMixed ? (t.metalType==='zilver'?'oz':'g') : (party?.unit==='eur'?'st':party?.unit||'');
    return `${prefix}${fmtQty(t.quantity, unit)} × ${fmtEur(t.unitPriceEur,{decimals:2})}`;
  }
  if (t.amountEur != null) return `${prefix}${fmtEur(t.amountEur, {decimals:2})}`;
  if (t.valueEur  != null) return `${prefix}= ${fmtEur(t.valueEur, {decimals:2})}`;
  if (t.unitPriceEur != null) return `${prefix}NAV ${fmtEur(t.unitPriceEur,{decimals:2})}`;
  return prefix.slice(0, -3); // trim trailing ' · ' if no other details
}

function FilterChip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick}
      style={{ padding:'4px 10px', fontSize:11, fontFamily:'inherit', cursor:'pointer',
        background: active ? 'var(--fg)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--fg-muted)',
        border: '1px solid ' + (active ? 'var(--fg)' : 'var(--border)'),
        borderRadius: 999, display:'inline-flex', alignItems:'center', gap:5 }}>
      {color && <span style={{ width:6, height:6, borderRadius:2, background:color }} />}
      {children}
    </button>
  );
}

// ===== Pension Calculator Tab =====
function PensionTab({ summaries }) {
  const currentPortfolioValue = summaries.reduce((s, x) => s + x.currentValueEur, 0);

  const [age, setAge]         = React.useState(30);
  const [retireAge, setRetire]= React.useState(65);
  const [monthly, setMonthly] = React.useState(2500);
  const [wdRate, setWdRate]   = React.useState(4);
  const [retRate, setRetRate] = React.useState(7);
  const [inflation, setInfl]  = React.useState(2.5);

  // All pension calculations in one memoized block — avoids redundant Math.pow calls on slider drag
  const calc = React.useMemo(() => {
    const years         = Math.max(0, retireAge - age);
    const realRate      = ((1 + retRate / 100) / (1 + inflation / 100) - 1) * 100;
    const neededCorpus  = wdRate > 0 ? (monthly * 12) / (wdRate / 100) : 0;
    const inflAdj       = Math.pow(1 + inflation / 100, years);
    const neededCorpusReal = neededCorpus * inflAdj;
    const fvCurrent     = currentPortfolioValue * Math.pow(1 + retRate / 100, years);
    const r = retRate / 100 / 12;
    const n = years * 12;
    const gap = neededCorpusReal - fvCurrent;
    const monthlySavings = (n > 0 && r > 0 && gap > 0)
      ? gap * r / (Math.pow(1 + r, n) - 1)
      : 0;
    const onTrack = fvCurrent >= neededCorpusReal;
    const progress = neededCorpusReal > 0 ? Math.min(100, (fvCurrent / neededCorpusReal) * 100) : 0;

    // Milestone years — iterate once, collect all 4 thresholds
    const targets  = [0.25, 0.50, 0.75, 1.00].map(f => neededCorpusReal * f);
    const achieved = new Array(4).fill(null);
    let v = currentPortfolioValue;
    for (let yr = 0; yr <= years; yr++) {
      targets.forEach((t, i) => { if (achieved[i] === null && v >= t) achieved[i] = age + yr; });
      v = v * (1 + retRate / 100) + monthlySavings * 12;
    }
    const milestones = [25, 50, 75, 100].map((pct, i) => ({
      pct,
      value: targets[i],
      achieveYear: achieved[i],
    }));

    return { years, realRate, neededCorpusReal, fvCurrent, monthlySavings, onTrack, progress, milestones };
  }, [age, retireAge, monthly, wdRate, retRate, inflation, currentPortfolioValue]);

  const { years, realRate, neededCorpusReal, fvCurrent, monthlySavings, onTrack, progress, milestones } = calc;

  const InputRow = ({ label, value, onChange, min, max, step, suffix }) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
      <label style={{ fontSize:14, color:'var(--fg)', fontWeight:400 }}>{label}</label>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)}
          style={{ width:140, accentColor:'var(--accent)' }} />
        <div style={{ fontFamily:'var(--ff-mono)', fontSize:15, fontWeight:500, minWidth:80, textAlign:'right', color:'var(--fg)' }}>
          {typeof value === 'number' && value >= 100 ? value : value}{suffix}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 28px 60px' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--fg-muted)', marginBottom:6, fontFamily:'var(--ff-mono)' }}>
          Pensioen planning
        </div>
        <h1 style={{ margin:0, fontFamily:'var(--ff-display)', fontWeight:500, fontSize:38, letterSpacing:'-0.02em', lineHeight:1 }}>
          Pensioen calculator
        </h1>
        <p style={{ margin:'10px 0 0', fontSize:14, color:'var(--fg-muted)', lineHeight:1.5 }}>
          Berekend op basis van de 4%-regel (of jouw gewenste onttrekkingspercentage). Huidige portfolio: <strong style={{ color:'var(--fg)', fontFamily:'var(--ff-mono)' }}>{fmtEur(currentPortfolioValue)}</strong>.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
        {/* Inputs */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 24px' }}>
          <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>Jouw situatie</div>
          <div style={{ fontSize:12, color:'var(--fg-muted)', marginBottom:16 }}>Pas de schuifregelaars aan</div>
          <InputRow label="Huidige leeftijd" value={age} onChange={setAge} min={18} max={70} step={1} suffix=" jaar" />
          <InputRow label="Pensioenleeftijd" value={retireAge} onChange={setRetire} min={age+1} max={85} step={1} suffix=" jaar" />
          <InputRow label="Gewenste maandelijkse onttrekking" value={monthly} onChange={setMonthly} min={500} max={10000} step={100} suffix=" €" />
          <InputRow label="Onttrekkingspercentage" value={wdRate} onChange={setWdRate} min={2} max={8} step={0.5} suffix="%" />
          <InputRow label="Verwacht rendement per jaar" value={retRate} onChange={setRetRate} min={1} max={15} step={0.5} suffix="%" />
          <InputRow label="Verwachte inflatie" value={inflation} onChange={setInfl} min={0} max={6} step={0.1} suffix="%" />
          <div style={{ marginTop:14, padding:'10px 14px', background:'var(--surface-2)', borderRadius:'var(--radius)', fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
            Reëel rendement (na inflatie): <span style={{ color:'var(--fg)', fontWeight:600 }}>{realRate.toFixed(1)}%</span> · Tijdshorizon: <span style={{ color:'var(--fg)', fontWeight:600 }}>{years} jaar</span>
          </div>
        </div>

        {/* Results */}
        <div style={{ display:'grid', gap:16 }}>
          {/* Needed corpus */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 24px' }}>
            <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--fg-muted)', marginBottom:6 }}>
              Benodigde eindwaarde (nominaal)
            </div>
            <div style={{ fontFamily:'var(--ff-display)', fontSize:40, fontWeight:500, letterSpacing:'-0.02em', lineHeight:1, color:'var(--fg)' }}>
              {fmtEur(neededCorpusReal, {decimals:0})}
            </div>
            <div style={{ fontSize:12, color:'var(--fg-dim)', marginTop:6, fontFamily:'var(--ff-mono)' }}>
              Op basis van {fmtEur(monthly,{decimals:0})}/maand bij {wdRate}% onttrekking · incl. {inflation}% inflatie
            </div>
          </div>

          {/* Status */}
          <div style={{ background:'var(--surface)', border:`1px solid ${onTrack?'var(--positive)':'var(--border)'}`, borderRadius:'var(--radius-lg)', padding:'18px 22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>Portfolio bij pensioen (proj.)</span>
              <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600,
                background: onTrack ? 'color-mix(in oklab, var(--positive) 15%, transparent)' : 'color-mix(in oklab, var(--negative) 15%, transparent)',
                color: onTrack ? 'var(--positive)' : 'var(--negative)',
                border: `1px solid ${onTrack ? 'var(--positive)' : 'var(--negative)'}` }}>
                {onTrack ? '✓ Op koers' : '⚠ Tekort'}
              </span>
            </div>
            <div style={{ fontFamily:'var(--ff-mono)', fontSize:28, fontWeight:600, color: onTrack ? 'var(--positive)' : 'var(--fg)' }}>
              {fmtEur(fvCurrent, {decimals:0})}
            </div>
            <div style={{ height:8, background:'var(--surface-2)', borderRadius:4, margin:'12px 0', overflow:'hidden' }}>
              <div style={{ width:`${progress}%`, height:'100%', background: onTrack ? 'var(--positive)' : 'var(--accent)', borderRadius:4, transition:'width .5s' }} />
            </div>
            <div style={{ fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
              {progress.toFixed(0)}% van doelstelling · {onTrack
                ? `Overschot: +${fmtEur(fvCurrent - neededCorpusReal)}`
                : `Tekort: ${fmtEur(fvCurrent - neededCorpusReal)}`}
            </div>
          </div>

          {/* Monthly savings */}
          {monthlySavings > 0 && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 22px' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--fg-muted)', marginBottom:6 }}>
                Benodigde maandelijkse inleg
              </div>
              <div style={{ fontFamily:'var(--ff-mono)', fontSize:30, fontWeight:600, color:'var(--accent)' }}>
                {fmtEur(monthlySavings, {decimals:0})} / maand
              </div>
              <div style={{ fontSize:12, color:'var(--fg-dim)', marginTop:4, fontFamily:'var(--ff-mono)' }}>
                Om de doelstelling te bereiken in {years} jaar bij {retRate}% rendement
              </div>
            </div>
          )}
          {onTrack && (
            <div style={{ background:'color-mix(in oklab, var(--positive) 8%, transparent)', border:'1px solid color-mix(in oklab, var(--positive) 25%, transparent)',
              borderRadius:'var(--radius-lg)', padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--positive)', marginBottom:4 }}>🎉 Geen extra inleg nodig!</div>
              <div style={{ fontSize:12, color:'var(--fg-muted)' }}>
                Huidige portfolio groeit naar <strong style={{ fontFamily:'var(--ff-mono)' }}>{fmtEur(fvCurrent)}</strong> — boven de doelstelling van <strong style={{ fontFamily:'var(--ff-mono)' }}>{fmtEur(neededCorpusReal)}</strong>.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div style={{ marginTop:28 }}>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:14 }}>Mijlpalen</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
          {milestones.map(m => (
            <div key={m.pct} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 18px' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--fg-muted)', marginBottom:6 }}>{m.pct}% doelstelling</div>
              <div style={{ fontFamily:'var(--ff-mono)', fontSize:18, fontWeight:600, color:'var(--fg)' }}>{fmtEur(m.value,{decimals:0})}</div>
              <div style={{ fontSize:11, color:m.achieveYear?'var(--positive)':'var(--fg-dim)', marginTop:4, fontFamily:'var(--ff-mono)' }}>
                {m.achieveYear ? `Leeftijd ~${m.achieveYear}` : 'Niet haalbaar'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assumptions */}
      <div style={{ marginTop:20, padding:'14px 18px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
        fontSize:11, color:'var(--fg-dim)', fontFamily:'var(--ff-mono)' }}>
        <strong style={{ color:'var(--fg-muted)' }}>Aannames:</strong> Berekening gebruikt de 4%-regel (Trinity Study). Rendementen zijn niet gegarandeerd. Inflatie en belastingen kunnen de werkelijke uitkomst beïnvloeden. Raadpleeg een financieel adviseur voor persoonlijk advies.
      </div>
    </div>
  );
}

Object.assign(window, { TransactionsTab, PensionTab, FilterChip, formatTxDetails });
