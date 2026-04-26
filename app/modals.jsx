// Modals: add/edit transaction, party detail

function Modal({ open, onClose, children, width = 520 }) {
  React.useEffect(() => {
    if (!open) return;
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,10,10,0.45)',
      backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)',
        border:'1px solid var(--border-strong)', borderRadius:'var(--radius-lg)',
        width, maxWidth:'100%', maxHeight:'92vh', overflow:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
        {children}
      </div>
    </div>
  );
}

function TransactionModal({ open, onClose, onSave, preset, parties, initial, transactions = [] }) {
  const blank = (i, p) => ({
    party:       i?.party       || p?.party       || parties[0].id,
    type:        i?.type        || p?.type        || 'koop',
    date:        i?.date        || new Date().toISOString().slice(0, 10),
    amountEur:   i?.amountEur   ?? '',
    quantity:    i?.quantity    ?? '',
    unitPriceEur:i?.unitPriceEur ?? '',
    valueEur:    i?.valueEur    ?? '',
    metalType:   i?.metalType   || 'goud',
    silverUnit:  i?.silverUnit  || 'ounce',
    goldUnit:    i?.goldUnit    || 'gram',
    instrument:  i?.instrument  || '',
    feeMode:     'eur',
    feeEur:      i?.feeEur      ?? '',
    note:        i?.note        || '',
  });

  const [form, setForm] = React.useState(() => blank(initial, preset));

  React.useEffect(() => {
    if (open) setForm(blank(initial, preset));
  }, [open, preset, initial]);

  const party = parties.find(p => p.id === form.party) || parties[0];
  const isMetal   = party.unit === 'gram' || party.unit === 'ounce';
  const isMixed   = !!party.isMixed;
  const isT212    = party.id === 'trading212';
  const isUnitParty = party.unit === 'part'; // participaties / aandelen (use unitPriceEur for waardering)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // What fields are required for this transaction type?
  const needs = (() => {
    switch (form.type) {
      case 'inleg': case 'opname': case 'rente': case 'kosten':
        return ['amountEur'];
      case 'koop': case 'verkoop': case 'cashback': case 'dividend':
        return ['quantity', 'unitPriceEur'];
      case 'waardering':
        if (party.unit === 'bundle') return ['valueEur'];  // altijd totale portefeuillewaarde, nooit per stuk
        if (isMetal || isMixed) return ['quantity'];
        if (isUnitParty || party.unit === 'crypto') return ['unitPriceEur'];
        return ['valueEur'];
      default: return [];
    }
  })();

  // Compute fee EUR from form (convert % → EUR if needed)
  const orderValue = (+form.quantity || 0) * (+form.unitPriceEur || 0);
  const feeEurCalc = form.feeMode === 'pct' && orderValue > 0
    ? (orderValue * (+form.feeEur || 0)) / 100
    : +form.feeEur || 0;

  const valid = form.party && form.type && form.date
    && needs.every(n => form[n] !== '' && !Number.isNaN(+form[n]));

  // Unique instruments used in T212 transactions, sorted alphabetically
  const t212Instruments = React.useMemo(() => {
    const names = transactions
      .filter(t => t.party === 'trading212' && t.instrument)
      .map(t => t.instrument);
    return [...new Set(names)].sort();
  }, [transactions]);

  const submit = () => {
    if (!valid) return;
    const tx = { id: initial?.id || makeId(), party: form.party, type: form.type, date: form.date };
    if (form.note)         tx.note = form.note;
    if (form.instrument)   tx.instrument = form.instrument.trim();
    if (isMixed && (form.type === 'koop' || form.type === 'verkoop' || form.type === 'waardering' || form.type === 'dividend')) {
      tx.metalType = form.metalType;
      if (form.metalType === 'zilver') tx.silverUnit = form.silverUnit;
      if (form.metalType === 'goud')   tx.goldUnit   = form.goldUnit;
    }
    for (const k of needs) tx[k] = +form[k];
    if (feeEurCalc > 0) tx.feeEur = +feeEurCalc.toFixed(4);
    onSave(tx);
    onClose();
  };

  const showFee = ['koop','verkoop','cashback'].includes(form.type);
  const unitLabel = isMixed
    ? (form.metalType === 'goud'
        ? (form.goldUnit === 'ounce' ? 'ounce' : 'gram')
        : (form.silverUnit === 'gram' ? 'gram' : 'ounce'))
    : isMetal ? party.unit
    : party.unit === 'crypto'  ? party.unitLabel
    : party.unit === 'bundle'  ? '€'
    : 'stuks';

  // Filter types for Trading 212 (cashback makes most sense there)
  const typeOptions = TX_TYPES.filter(t => {
    if (t.key === 'cashback' && !isT212) return false;
    // Bundle (Top 25): alleen inleg / opname / waardering
    if (party.unit === 'bundle' && ['koop','verkoop','cashback','dividend','rente'].includes(t.key)) return false;
    return true;
  });

  // Waardering for Meesman — show NAV per participatie field
  const isMeesman = party.id === 'meesman';

  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div style={{ padding:'20px 22px 10px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontFamily:'var(--ff-display)', fontSize:24, fontWeight:500, letterSpacing:'-0.01em' }}>
          {initial ? 'Transactie bewerken' : 'Nieuwe transactie'}
        </div>
        <div style={{ fontSize:13, color:'var(--fg-muted)', marginTop:4 }}>
          Leg inleg, koop, verkoop of een waardering-update vast.
        </div>
      </div>

      <div style={{ padding:22, display:'grid', gap:14 }}>
        {/* Party + Type */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Partij">
            <Select value={form.party} onChange={e => set('party', e.target.value)}>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => set('type', e.target.value)}>
              {typeOptions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </Field>
        </div>

        {/* Date */}
        <Field label="Datum">
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </Field>

        {/* Trading 212: instrument selector */}
        {isT212 && ['koop','verkoop','cashback','dividend'].includes(form.type) && (
          <Field label="Instrument (aandeel / ETF)" hint="Typ een ticker of naam. Eerder gebruikte instrumenten verschijnen als suggesties.">
            <div style={{ position:'relative' }}>
              <input
                list="t212-instruments"
                value={form.instrument}
                onChange={e => set('instrument', e.target.value)}
                placeholder="bijv. VWCE, AAPL, VOO..."
                style={{ ...inputStyle, width:'100%' }}
              />
              <datalist id="t212-instruments">
                {t212Instruments.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </Field>
        )}

        {/* Goldrepublic: metal type selector */}
        {isMixed && (form.type === 'koop' || form.type === 'verkoop' || form.type === 'waardering') && (
          <>
            <Field label="Metaal">
              <div style={{ display:'flex', gap:8 }}>
                {[{k:'goud',l:'Goud'},{k:'zilver',l:'Zilver'}].map(opt => (
                  <button key={opt.k} onClick={() => set('metalType', opt.k)} type="button"
                    style={{ flex:1, padding:'9px 12px', background:form.metalType===opt.k?'var(--fg)':'var(--surface-2)',
                      color:form.metalType===opt.k?'var(--bg)':'var(--fg)',
                      border:'1px solid '+(form.metalType===opt.k?'var(--fg)':'var(--border)'),
                      borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500 }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </Field>
            {/* Zilver: eenheidskeuze gram of ounce */}
            {form.metalType === 'zilver' && (
              <Field label="Zilver eenheid" hint="1 troy ounce = 31,1 gram">
                <div style={{ display:'flex', gap:8 }}>
                  {[{k:'ounce',l:'Ounce (oz)'},{k:'gram',l:'Gram (g)'}].map(opt => (
                    <button key={opt.k} onClick={() => set('silverUnit', opt.k)} type="button"
                      style={{ flex:1, padding:'9px 12px', background:form.silverUnit===opt.k?'var(--fg)':'var(--surface-2)',
                        color:form.silverUnit===opt.k?'var(--bg)':'var(--fg)',
                        border:'1px solid '+(form.silverUnit===opt.k?'var(--fg)':'var(--border)'),
                        borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500 }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {/* Goud: eenheidskeuze gram of ounce */}
            {form.metalType === 'goud' && (
              <Field label="Goud eenheid" hint="1 troy ounce = 31,1 gram">
                <div style={{ display:'flex', gap:8 }}>
                  {[{k:'gram',l:'Gram (g)'},{k:'ounce',l:'Ounce (oz)'}].map(opt => (
                    <button key={opt.k} onClick={() => set('goldUnit', opt.k)} type="button"
                      style={{ flex:1, padding:'9px 12px', background:form.goldUnit===opt.k?'var(--fg)':'var(--surface-2)',
                        color:form.goldUnit===opt.k?'var(--bg)':'var(--fg)',
                        border:'1px solid '+(form.goldUnit===opt.k?'var(--fg)':'var(--border)'),
                        borderRadius:'var(--radius)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500 }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}

        {/* Cash flows: inleg / opname / rente / kosten */}
        {['inleg','opname','rente','kosten'].includes(form.type) && (
          <Field label="Bedrag (€)">
            <Input type="number" step="0.01" placeholder="0,00" value={form.amountEur} onChange={e => set('amountEur', e.target.value)} />
          </Field>
        )}

        {/* koop / verkoop / cashback / dividend — quantity + unit price */}
        {['koop','verkoop','cashback','dividend'].includes(form.type) && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label={`Aantal (${unitLabel})`}>
                <Input type="number" step="0.0001" placeholder="0" value={form.quantity}
                  onChange={e => set('quantity', e.target.value)} />
              </Field>
              <Field label={`Prijs per ${unitLabel} (€)`}>
                <Input type="number" step="0.01" placeholder="0,00" value={form.unitPriceEur}
                  onChange={e => set('unitPriceEur', e.target.value)} />
              </Field>
            </div>
            {/* Order total preview */}
            {orderValue > 0 && (
              <div style={{ fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)',
                background:'var(--surface-2)', padding:'8px 12px', borderRadius:'var(--radius)' }}>
                {form.type === 'dividend' ? 'Herbelegging: ' : 'Orderbedrag: '}
                <span style={{ color: form.type === 'dividend' ? 'var(--positive)' : 'var(--fg)', fontWeight:500 }}>
                  {fmtEur(orderValue, {decimals:2})}
                </span>
                {form.type === 'dividend' && (
                  <span style={{ marginLeft:8, opacity:0.65 }}>· telt niet mee als inleg</span>
                )}
              </div>
            )}
          </>
        )}

        {/* Waardering */}
        {form.type === 'waardering' && (
          party.unit === 'bundle' ? (
            <Field label="Totale portefeuillewaarde (€)" hint="Vul de huidige totale waarde van je gehele Top 25 bundel in. Winst/verlies wordt automatisch berekend.">
              <Input type="number" step="0.01" value={form.valueEur} onChange={e => set('valueEur', e.target.value)} />
            </Field>
          ) : (isMetal || isMixed) ? (
            <Field
              label={`Totaal ${unitLabel} in bezit`}
              hint="Huidige waarde wordt berekend via spot-prijs.">
              <Input type="number" step="0.0001" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </Field>
          ) : (isUnitParty || party.unit === 'crypto') ? (
            <Field label="Koers / NAV per stuk (€)" hint="De huidige marktkoers of NAV per participatie/aandeel/token.">
              <Input type="number" step="0.0001" value={form.unitPriceEur} onChange={e => set('unitPriceEur', e.target.value)} />
            </Field>
          ) : (
            <Field label="Huidige totale waarde (€)" hint="Vervangt de laatste waardering voor deze partij.">
              <Input type="number" step="0.01" value={form.valueEur} onChange={e => set('valueEur', e.target.value)} />
            </Field>
          )
        )}

        {/* Transaction fee */}
        {showFee && (
          <div>
            <div style={{ fontSize:11, fontWeight:500, color:'var(--fg-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              Transactiekosten (optioneel)
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>
              {/* Toggle € / % */}
              <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                {['eur','pct'].map(m => (
                  <button key={m} onClick={() => set('feeMode', m)} type="button"
                    style={{ padding:'9px 14px', background:form.feeMode===m?'var(--fg)':'var(--surface-2)',
                      color:form.feeMode===m?'var(--bg)':'var(--fg-muted)',
                      border:'none', cursor:'pointer', fontFamily:'var(--ff-mono)', fontSize:12, fontWeight:500 }}>
                    {m === 'eur' ? '€' : '%'}
                  </button>
                ))}
              </div>
              <div style={{ flex:1 }}>
                <Input type="number" step="0.01" min="0"
                  placeholder={form.feeMode==='eur' ? '0,00' : '0.50'}
                  value={form.feeEur} onChange={e => set('feeEur', e.target.value)} />
              </div>
              {form.feeMode === 'pct' && orderValue > 0 && +form.feeEur > 0 && (
                <div style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', whiteSpace:'nowrap', paddingLeft:4 }}>
                  = {fmtEur(feeEurCalc, {decimals:2})}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Note */}
        <Field label="Notitie (optioneel)">
          <Textarea rows="2" value={form.note} onChange={e => set('note', e.target.value)} />
        </Field>
      </div>

      <div style={{ padding:'14px 22px 20px', display:'flex', justifyContent:'space-between', gap:10,
        borderTop:'1px solid var(--border)', background:'var(--surface-2)' }}>
        <Button variant="ghost" onClick={onClose}>Annuleren</Button>
        <Button variant="primary" onClick={submit} style={{ opacity:valid?1:0.4 }}>
          {initial ? 'Opslaan' : 'Toevoegen'}
        </Button>
      </div>
    </Modal>
  );
}

// ===== Party detail drawer =====
function PartyDetail({ open, onClose, party, summary, onAddTx, onDeleteTx, onEditTx, spots }) {
  if (!open || !party) return null;
  return (
    <Modal open={open} onClose={onClose} width={740}>
      <div style={{ padding:'22px 26px 16px', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'start', justifyContent:'space-between', gap:18 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:party.color }} />
            <Pill tone="neutral">{party.category}</Pill>
          </div>
          <div style={{ fontFamily:'var(--ff-display)', fontSize:28, fontWeight:500, letterSpacing:'-0.02em', lineHeight:1 }}>
            {party.name}
          </div>
          <div style={{ fontSize:13, color:'var(--fg-muted)', marginTop:4 }}>{party.subtitle}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <Button variant="secondary" onClick={() => onAddTx({ party: party.id, type: 'waardering' })}>Waarde updaten</Button>
          <Button variant="primary"   onClick={() => onAddTx({ party: party.id })}>+ Transactie</Button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding:22, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, borderBottom:'1px solid var(--border)' }}>
        <Stat label="Huidige waarde" value={fmtEur(summary.currentValueEur)} />
        <Stat label="Ingelegd"       value={fmtEur(summary.invested)} />
        <Stat label="Rendement €"    value={<Delta value={summary.pnl} format="eur" />} />
        <Stat label="Rendement %"    value={<Delta value={summary.pnlPct} />} />
      </div>

      {/* Metal detail for gram/ounce parties */}
      {(party.unit === 'gram' || party.unit === 'ounce') && (
        <div style={{ padding:'12px 22px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)',
          display:'flex', gap:24, fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
          <span>Bezit: <span style={{ color:'var(--fg)' }}>{fmtQty(summary.quantity, party.unit)}</span></span>
          <span>Spot: <span style={{ color:'var(--fg)' }}>{fmtEur(spotEurForParty(party, spots), {decimals:2})} / {party.unit}</span></span>
          {summary.avgCost && <span>Gem. aankoop: <span style={{ color:'var(--fg)' }}>{fmtEur(summary.avgCost, {decimals:2})} / {party.unit}</span></span>}
        </div>
      )}

      {/* Goldrepublic mixed metals */}
      {party.isMixed && (
        <div style={{ padding:'12px 22px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)',
          display:'flex', gap:24, fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
          <span>Goud: <span style={{ color:'oklch(78% 0.14 85)' }}>{fmtQty(summary.goldQty || 0, 'g')}</span></span>
          <span>Zilver: <span style={{ color:'oklch(70% 0.03 240)' }}>{fmtQty(summary.silverQty || 0, 'oz')}</span></span>
          <span>Spot goud: <span style={{ color:'var(--fg)' }}>{fmtEur(spots.goldSpotEurPerGram, {decimals:2})}/g</span></span>
          <span>Spot zilver: <span style={{ color:'var(--fg)' }}>{fmtEur(spots.silverSpotEurPerOunce, {decimals:2})}/oz</span></span>
        </div>
      )}

      {/* Fees + cashback summary */}
      {(summary.totalFees > 0 || summary.totalCashback > 0) && (
        <div style={{ padding:'10px 22px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)',
          display:'flex', gap:24, fontSize:12, color:'var(--fg-muted)', fontFamily:'var(--ff-mono)' }}>
          {summary.totalFees > 0 && <span>Kosten betaald: <span style={{ color:'var(--negative)' }}>−{fmtEur(summary.totalFees, {decimals:2})}</span></span>}
          {summary.totalCashback > 0 && <span>Via cashback: <span style={{ color:'var(--positive)' }}>{fmtEur(summary.totalCashback, {decimals:2})}</span></span>}
        </div>
      )}

      <div style={{ padding:22 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Transacties ({summary.transactions.length})
          </div>
        </div>
        <TxTable txs={[...summary.transactions].reverse()} party={party} onDelete={onDeleteTx} onEdit={onEditTx} />
      </div>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--fg-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontFamily:'var(--ff-mono)', fontWeight:500, color:'var(--fg)' }}>{value}</div>
    </div>
  );
}

function TxTable({ txs, party, onDelete, onEdit }) {
  if (!txs.length) return <div style={{ fontSize:13, color:'var(--fg-dim)', padding:'24px 0' }}>Nog geen transacties.</div>;
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ background:'var(--surface-2)', color:'var(--fg-muted)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            <th style={th}>Datum</th>
            <th style={th}>Type</th>
            <th style={{ ...th, textAlign:'right' }}>Bedrag / Aantal</th>
            <th style={{ ...th, textAlign:'right' }}>Kosten</th>
            <th style={th}>Notitie</th>
            <th style={{ ...th, width:80, textAlign:'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {txs.map(t => (
            <tr key={t.id} style={{ borderTop:'1px solid var(--border)' }}>
              <td style={{ ...td, fontFamily:'var(--ff-mono)', color:'var(--fg-muted)' }}>{fmtDate(t.date)}</td>
              <td style={td}><Pill tone={txTone(t.type)}>{TX_LABELS[t.type] || t.type}</Pill></td>
              <td style={{ ...td, textAlign:'right', fontFamily:'var(--ff-mono)' }}>{formatTxAmount(t, party)}</td>
              <td style={{ ...td, textAlign:'right', fontFamily:'var(--ff-mono)', fontSize:11, color:'var(--negative)' }}>
                {t.feeEur > 0 ? `−${fmtEur(t.feeEur, {decimals:2})}` : ''}
              </td>
              <td style={{ ...td, color:'var(--fg-muted)', fontSize:11 }}>{t.note || ''}</td>
              <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
                {onEdit && (
                  <button onClick={() => onEdit(t)} title="Bewerken"
                    style={{ background:'transparent', border:'none', color:'var(--fg-muted)', cursor:'pointer', fontSize:12, padding:'4px 6px', fontFamily:'inherit' }}>✎</button>
                )}
                <button onClick={() => onDelete(t.id)} title="Verwijder"
                  style={{ background:'transparent', border:'none', color:'var(--fg-dim)', cursor:'pointer', fontSize:16, padding:'4px 6px' }}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding:'10px 12px', textAlign:'left', fontWeight:500 };
const td = { padding:'10px 12px', verticalAlign:'middle' };

function txTone(type) {
  if (['inleg','dividend','rente','cashback'].includes(type)) return 'positive';
  if (['opname','kosten','verkoop'].includes(type)) return 'negative';
  if (type === 'waardering') return 'accent';
  return 'neutral';
}

function formatTxAmount(t, party) {
  const rawUnit = party?.isMixed ? (t.metalType === 'zilver' ? 'ounce' : 'gram') : party?.unit;
  const unit = rawUnit === 'crypto' ? (party?.unitLabel || rawUnit) : rawUnit;
  switch (t.type) {
    case 'inleg': case 'rente':
      return <span style={{ color:'var(--positive)' }}>+{fmtEur(t.amountEur)}</span>;
    case 'dividend':
      if (t.quantity != null && t.unitPriceEur != null)
        return <span style={{ color:'var(--positive)' }}>{fmtQty(t.quantity, unit==='eur'?'stuks':unit)} × {fmtEur(t.unitPriceEur,{decimals:2})} <span style={{ fontSize:10, color:'var(--positive)', opacity:0.7 }}>div.</span></span>;
      return <span style={{ color:'var(--positive)' }}>+{fmtEur(t.amountEur)}</span>;
    case 'cashback':
      if (t.quantity != null) return <span style={{ color:'var(--positive)' }}>{fmtQty(t.quantity, unit==='eur'?'stuks':unit)} × {fmtEur(t.unitPriceEur,{decimals:2})}</span>;
      return <span style={{ color:'var(--positive)' }}>+{fmtEur(t.amountEur)}</span>;
    case 'opname': case 'kosten':
      return <span style={{ color:'var(--negative)' }}>−{fmtEur(t.amountEur)}</span>;
    case 'koop':
      return <span>{fmtQty(t.quantity, unit==='eur'?'stuks':unit)} × {fmtEur(t.unitPriceEur,{decimals:2})}</span>;
    case 'verkoop':
      return <span>−{fmtQty(t.quantity, unit==='eur'?'stuks':unit)} × {fmtEur(t.unitPriceEur,{decimals:2})}</span>;
    case 'waardering':
      if (unit==='gram'||unit==='ounce') return fmtQty(t.quantity, unit);
      if (t.unitPriceEur != null) return `NAV ${fmtEur(t.unitPriceEur,{decimals:2})}`;
      return fmtEur(t.valueEur);
    default: return '';
  }
}

Object.assign(window, { Modal, TransactionModal, PartyDetail, Stat, TxTable, th, td, txTone, formatTxAmount });
