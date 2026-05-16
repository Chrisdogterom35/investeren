// Lightweight SVG charts — no external deps

// ====== Line chart (portfolio value over time) ======
function LineChart({ data, height = 220, showInvested = true }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  if (!data.length || w === 0) return <div ref={ref} style={{ width: '100%', height }} />;

  const narrow = w < 420;
  const pad = { t: 10, r: 10, b: 24, l: narrow ? 38 : 52 };
  const W = Math.max(280, w), H = height;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const values = data.flatMap(d => [d.total, d.invested]);
  const maxV = Math.max(...values) * 1.05 || 1;
  const x = i => pad.l + (data.length > 1 ? (i / (data.length - 1)) * innerW : 0);
  const y = v => pad.t + innerH - ((v / maxV) * innerH);
  const totalPath   = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.total).toFixed(1)}`).join(' ');
  const investedPath= data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d.invested).toFixed(1)}`).join(' ');
  const areaPath = totalPath + ` L${x(data.length-1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const yTicks = narrow
    ? [0, 0.5, 1].map(f => maxV * f)
    : [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);
  const stepX = Math.max(1, Math.floor(data.length / (narrow ? 3 : 5)));
  const xTickIdx = [];
  for (let i = 0; i < data.length; i += stepX) xTickIdx.push(i);
  if (xTickIdx[xTickIdx.length-1] !== data.length-1) xTickIdx.push(data.length-1);

  const getIdx = (clientX, svgEl) => {
    const rect = svgEl.getBoundingClientRect();
    const ratio = (clientX - rect.left - pad.l) / innerW;
    return Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
  };
  const onMove  = e => setHoverIdx(getIdx(e.clientX, e.currentTarget));
  const onTouch = e => { e.preventDefault(); setHoverIdx(getIdx(e.touches[0].clientX, e.currentTarget)); };
  const hover = hoverIdx != null ? data[hoverIdx] : null;
  const fs = narrow ? '9' : '10';

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg width={W} height={H}
        onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}
        onTouchMove={onTouch} onTouchEnd={() => setHoverIdx(null)}
        style={{ display: 'block', maxWidth: '100%', touchAction: 'none' }}>
        <defs>
          <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W-pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i===0?'0':'2,3'} />
            <text x={pad.l-5} y={y(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize={fs} fontFamily="var(--ff-mono)">
              {v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':Math.round(v)}
            </text>
          </g>
        ))}
        {xTickIdx.map(i => (
          <text key={i} x={x(i)} y={H-pad.b+14} textAnchor="middle" fill="var(--fg-dim)" fontSize={fs} fontFamily="var(--ff-mono)">
            {fmtMonth(data[i].date.slice(0,7))}
          </text>
        ))}
        <path d={areaPath} fill="url(#area-fill)" />
        {showInvested && <path d={investedPath} fill="none" stroke="var(--fg-muted)" strokeWidth="1.2" strokeDasharray="3,3" opacity="0.55" />}
        <path d={totalPath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {hover && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H-pad.b} stroke="var(--border-strong)" strokeDasharray="2,2" />
            <circle cx={x(hoverIdx)} cy={y(hover.total)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div style={{ position:'absolute', left: Math.min(W - (narrow?160:200), Math.max(0, x(hoverIdx) - (narrow?60:90))), top:4,
          background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
          padding: narrow ? '5px 8px' : '8px 10px', fontSize: narrow ? 11 : 12,
          pointerEvents:'none', boxShadow:'var(--shadow)' }}>
          <div style={{ color:'var(--fg-dim)', fontSize: narrow ? 9 : 10, fontFamily:'var(--ff-mono)' }}>{fmtDate(hover.date)}</div>
          <div style={{ color:'var(--fg)', fontWeight:600, fontFamily:'var(--ff-mono)' }}>{fmtEur(hover.total)}</div>
          {!narrow && <div style={{ color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', fontSize:11 }}>inleg {fmtEur(hover.invested)}</div>}
        </div>
      )}
    </div>
  );
}

// ====== Multi-line allocation chart ======
function AllocationLineChart({ timeSeries, parties, height = 240 }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  const [hoverParty, setHoverParty] = React.useState(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const { dates, byParty } = timeSeries;

  // Memoize thinning — expensive when many data points
  const { thinDates, thinByParty } = React.useMemo(() => {
    if (!dates || !dates.length) return { thinDates: [], thinByParty: {} };
    const step = Math.max(1, Math.ceil(dates.length / 200));
    const idx = dates.reduce((acc, _, i) => {
      if (i % step === 0 || i === dates.length - 1) acc.push(i);
      return acc;
    }, []);
    return {
      thinDates:   idx.map(i => dates[i]),
      thinByParty: Object.fromEntries(parties.map(p => [p.id, idx.map(i => byParty[p.id][i])])),
    };
  }, [dates, byParty, parties]);

  if (!thinDates.length || w === 0) return <div ref={ref} style={{ width: '100%', height }} />;

  const narrow = w < 480;
  const pad = { t: 14, r: narrow ? 14 : 140, b: 28, l: 46 };
  const W = Math.max(200, w), H = height;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const allVals = parties.flatMap(p => thinByParty[p.id] || []).filter(v => v != null);
  const maxV = Math.max(1, ...allVals) * 1.08;
  const xi = i => pad.l + (thinDates.length > 1 ? (i / (thinDates.length - 1)) * innerW : 0);
  const yv = v => pad.t + innerH - (v / maxV) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => maxV * f);

  return (
    <div ref={ref} style={{ width: '100%', overflow: 'hidden' }}>
      <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={yv(v)} y2={yv(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i===0?'0':'2,3'} />
            <text x={pad.l-4} y={yv(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize="10" fontFamily="var(--ff-mono)">
              {v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}
            </text>
          </g>
        ))}
        {parties.map(p => {
          const vals = thinByParty[p.id];
          if (!vals) return null;
          const path = vals.map((v, i) => `${i===0?'M':'L'}${xi(i)} ${yv(v||0)}`).join(' ');
          const isHovered = hoverParty === p.id;
          const dimmed = hoverParty && !isHovered;
          return (
            <path key={p.id} d={path} fill="none"
              stroke={p.color} strokeWidth={isHovered ? 2.5 : 1.5}
              opacity={dimmed ? 0.2 : 1}
              style={{ transition: 'opacity .2s, stroke-width .2s', cursor: 'pointer' }}
              onMouseEnter={() => setHoverParty(p.id)}
              onMouseLeave={() => setHoverParty(null)}
            />
          );
        })}
        {/* Legend on right side — desktop only */}
        {!narrow && parties.map((p) => {
          const vals = thinByParty[p.id];
          const lastVal = vals ? vals[vals.length - 1] : 0;
          return (
            <g key={p.id} transform={`translate(${W - pad.r + 8}, ${yv(lastVal || 0)})`}
              onMouseEnter={() => setHoverParty(p.id)}
              onMouseLeave={() => setHoverParty(null)}
              style={{ cursor: 'pointer' }}>
              <circle cx="5" cy="0" r="4" fill={p.color} opacity={hoverParty && hoverParty !== p.id ? 0.3 : 1} />
              <text x="14" y="4" fill="var(--fg-muted)" fontSize="10" fontFamily="var(--ff-sans)"
                fontWeight={hoverParty === p.id ? '600' : '400'}
                opacity={hoverParty && hoverParty !== p.id ? 0.4 : 1}>
                {p.name}
              </text>
            </g>
          );
        })}
        {/* X labels */}
        {(() => {
          const stepX = Math.max(1, Math.floor(thinDates.length / (narrow ? 4 : 5)));
          const xTix = [];
          for (let i = 0; i < thinDates.length; i += stepX) xTix.push(i);
          if (xTix[xTix.length-1] !== thinDates.length-1) xTix.push(thinDates.length-1);
          return xTix.map(i => (
            <text key={i} x={xi(i)} y={H-pad.b+16} textAnchor="middle" fill="var(--fg-dim)" fontSize="10" fontFamily="var(--ff-mono)">
              {fmtMonth(thinDates[i].slice(0,7))}
            </text>
          ));
        })()}
      </svg>
      {/* Legend below chart — mobile only */}
      {narrow && (
        <div style={{ display:'flex', gap:'5px 10px', flexWrap:'wrap', marginTop:8, paddingLeft: pad.l }}>
          {parties.map(p => (
            <button key={p.id} onClick={() => setHoverParty(v => v === p.id ? null : p.id)}
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, background:'none', border:'none',
                cursor:'pointer', padding:0, opacity: hoverParty && hoverParty !== p.id ? 0.35 : 1, transition:'opacity .15s' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:p.color, flexShrink:0 }} />
              <span style={{ color:'var(--fg-muted)', fontFamily:'var(--ff-sans)' }}>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Donut chart ======
function DonutChart({ items, size = 200, thickness = 34, legendBelow = false, legendColumns = 1 }) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const r = size / 2, inner = r - thickness;
  let angle = -Math.PI / 2;
  const [hover, setHover] = React.useState(null);

  const arcs = items.map((it) => {
    const frac = it.value / total;
    const a0 = angle, a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = r + r*Math.cos(a0), y0 = r + r*Math.sin(a0);
    const x1 = r + r*Math.cos(a1), y1 = r + r*Math.sin(a1);
    const xi1 = r + inner*Math.cos(a1), yi1 = r + inner*Math.sin(a1);
    const xi0 = r + inner*Math.cos(a0), yi0 = r + inner*Math.sin(a0);
    return { d:`M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} L${xi1} ${yi1} A${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`,
      color:it.color, label:it.label, value:it.value, pct:frac*100 };
  });
  const h = hover != null ? arcs[hover] : null;

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent: legendBelow ? 'center' : 'flex-start',
      gap: legendBelow ? 14 : 24, flexWrap:'wrap', flexDirection: legendBelow ? 'column' : 'row' }}>
      <svg width={size} height={size} style={{ flexShrink:0, maxWidth:'100%' }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="var(--surface)" strokeWidth="2"
            opacity={hover==null||hover===i?1:0.3}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ transition:'opacity .15s', cursor:'pointer' }} />
        ))}
        <text x={r} y={r-6} textAnchor="middle" fill="var(--fg-muted)" fontSize="10" fontFamily="var(--ff-mono)" style={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>
          {h ? h.label : 'Totaal'}
        </text>
        <text x={r} y={r+14} textAnchor="middle" fill="var(--fg)" fontSize="16" fontWeight="600" fontFamily="var(--ff-mono)">
          {h ? fmtEur(h.value) : fmtEur(total)}
        </text>
        {h && <text x={r} y={r+30} textAnchor="middle" fill="var(--fg-dim)" fontSize="11" fontFamily="var(--ff-mono)">{h.pct.toFixed(1)}%</text>}
      </svg>
      <div style={{ width: legendBelow ? '100%' : undefined, flex: legendBelow ? undefined : 1,
        display:'grid', gridTemplateColumns: legendBelow ? `repeat(${legendColumns}, minmax(0, 1fr))` : '1fr',
        gap: legendBelow ? '7px 12px' : 6, minWidth:0 }}>
        {arcs.map((a, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display:'grid', gridTemplateColumns: legendBelow ? '10px minmax(0, 1fr) auto' : '10px minmax(0, 1fr) auto auto',
              alignItems:'center', gap: legendBelow ? 6 : 8, fontSize:12, opacity:hover==null||hover===i?1:0.5, transition:'opacity .15s', cursor:'pointer', minWidth:0 }}>
            <div style={dotStyle(a.color, 10)} />
            <div style={{ flex:1, color:'var(--fg)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.label}</div>
            <div style={{ color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', fontSize:11 }}>{a.pct.toFixed(1)}%</div>
            {!legendBelow && <div style={{ color:'var(--fg)', fontFamily:'var(--ff-mono)', fontSize:12, minWidth:72, textAlign:'right' }}>{fmtEur(a.value)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ====== Bar chart: allocation (for widget chart type switching) ======
function AllocationBarChart({ items, height = 180 }) {
  const max = Math.max(1, ...items.map(it => it.value));
  return (
    <div style={{ display:'grid', gap:10 }}>
      {items.map((it) => (
        <div key={it.label} style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(60px,3fr) 68px', alignItems:'center', gap:8, fontSize:12 }}>
          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--fg)' }}>{it.label}</div>
          <div style={{ height:14, background:'var(--surface-2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${(it.value/max)*100}%`, height:'100%', background:it.color, borderRadius:2, transition:'width .4s' }} />
          </div>
          <div style={{ textAlign:'right', fontFamily:'var(--ff-mono)', color:'var(--fg)', fontSize:11 }}>{fmtEur(it.value)}</div>
        </div>
      ))}
    </div>
  );
}

// ====== Grouped bar: Invested vs current value ======
function InvestedVsValueChart({ summaries, height = 240 }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  if (w === 0) return <div ref={ref} style={{ width:'100%', height }} />;
  const pad = { t:16, r:14, b:48, l:44 };
  const W = Math.max(200, w), H = height;
  const innerW = W-pad.l-pad.r, innerH = H-pad.t-pad.b;
  const narrow = w < 480;
  const visibleSummaries = narrow ? summaries.filter(s => s.currentValueEur > 0 || s.invested > 0) : summaries;
  const max = Math.max(...visibleSummaries.flatMap(s=>[s.invested,s.currentValueEur])) * 1.1 || 1;
  const bw = innerW / Math.max(1, visibleSummaries.length);
  const barW = Math.min(28, Math.max(4, (bw-8)/2));
  const y = v => pad.t + innerH - (v/max)*innerH;

  return (
    <div ref={ref} style={{ width:'100%', overflow:'hidden' }}>
      <svg width={W} height={H} style={{ display:'block', maxWidth:'100%' }}>
        {[0,0.25,0.5,0.75,1].map((f,i) => {
          const v = max*f;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W-pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={i===0?'0':'2,3'} />
              <text x={pad.l-4} y={y(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize="10" fontFamily="var(--ff-mono)">
                {v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}
              </text>
            </g>
          );
        })}
        {visibleSummaries.map((s, i) => {
          const cx = pad.l + bw*i + bw/2;
          const shortName = narrow ? s.party.name.split(' ')[0].slice(0,7) : s.party.name.split(' ')[0];
          return (
            <g key={s.party.id}>
              <rect x={cx-barW-1} y={y(s.invested)} width={barW} height={Math.max(0,y(0)-y(s.invested))} fill="var(--fg-dim)" opacity="0.55" rx="1" />
              <rect x={cx+1} y={y(s.currentValueEur)} width={barW} height={Math.max(0,y(0)-y(s.currentValueEur))} fill={s.party.color} rx="1" />
              <text x={cx} y={H-pad.b+14} textAnchor="middle" fill="var(--fg-muted)" fontSize={narrow?9:10} fontFamily="var(--ff-sans)">{shortName}</text>
              {!narrow && <text x={cx} y={H-pad.b+28} textAnchor="middle" fontSize="10" fontFamily="var(--ff-mono)" fill={s.pnl>=0?'var(--positive)':'var(--negative)'}>
                {s.invested>0 ? fmtPct(s.pnlPct,{decimals:1}) : '—'}
              </text>}
            </g>
          );
        })}
        <g transform={`translate(${pad.l},${pad.t-8})`}>
          <rect x="0" y="-8" width="10" height="10" fill="var(--fg-dim)" opacity="0.55" />
          <text x="14" y="1" fontSize="10" fill="var(--fg-muted)" fontFamily="var(--ff-mono)">Ingelegd</text>
          <rect x="80" y="-8" width="10" height="10" fill="var(--accent)" />
          <text x="94" y="1" fontSize="10" fill="var(--fg-muted)" fontFamily="var(--ff-mono)">Huidige waarde</text>
        </g>
      </svg>
    </div>
  );
}

// ====== Return % per party ======
function ReturnBars({ summaries }) {
  const maxAbs = Math.max(1, ...summaries.map(s => Math.abs(s.pnlPct || 0)));
  return (
    <div style={{ display:'grid', gap:10 }}>
      {summaries.map(s => {
        const pct = s.pnlPct || 0;
        const pos = pct >= 0;
        const bw = Math.abs(pct) / maxAbs * 50;
        return (
          <div key={s.party.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(60px,3fr) 68px', alignItems:'center', gap:8, fontSize:12 }}>
            <div style={{ color:'var(--fg)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.party.name}</div>
            <div style={{ position:'relative', height:14, background:'var(--surface-2)', borderRadius:2 }}>
              <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'var(--border-strong)' }} />
              <div style={{ position:'absolute', left:pos?'50%':`${50-bw}%`, width:`${bw}%`, top:2, bottom:2,
                background:pos?'var(--positive)':'var(--negative)', opacity:s.invested>0?1:0.3, borderRadius:2 }} />
            </div>
            <div style={{ textAlign:'right', fontFamily:'var(--ff-mono)', color:pos?'var(--positive)':'var(--negative)' }}>
              {s.invested>0 ? fmtPct(pct,{decimals:2}) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ====== Monthly inleg bar chart ======
function MonthlyBars({ months, height = 180 }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  if (!months.length || w === 0) return <div ref={ref} style={{ width:'100%', height }} />;
  const narrow = w < 430;
  const visibleMonths = narrow ? months.slice(-12) : months;
  const pad = { t:12, r:narrow ? 6 : 12, b:narrow ? 24 : 30, l:narrow ? 34 : 40 };
  const W = Math.max(220, w), H = height;
  const innerW = W-pad.l-pad.r, innerH = H-pad.t-pad.b;
  const max = Math.max(1, ...visibleMonths.map(m => m.inleg + m.koop));
  const bw = innerW / Math.max(1, visibleMonths.length);
  const y = v => pad.t + innerH - (v/max)*innerH;
  const tickFs = narrow ? 9 : 10;
  const labelStep = narrow ? 3 : Math.max(1, Math.floor(visibleMonths.length / 6));

  return (
    <div ref={ref} style={{ width:'100%', overflow:'hidden' }}>
      <svg width={W} height={H} style={{ display:'block', maxWidth:'100%' }}>
        {[0,0.5,1].map((f,i) => {
          const v = max*f;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W-pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={i===0?'0':'2,3'} />
              <text x={pad.l-5} y={y(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize={tickFs} fontFamily="var(--ff-mono)">
                {v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':Math.round(v)}
              </text>
            </g>
          );
        })}
        {visibleMonths.map((m, i) => {
          const cx = pad.l + bw*i + bw/2;
          const total = m.inleg + m.koop;
          return (
            <g key={m.month}>
              <rect x={cx-Math.max(1, Math.min(narrow ? 10 : 18, bw/2-2))} y={y(total)}
                width={Math.max(2, Math.min(narrow ? 20 : 36, bw-4))} height={Math.max(0,y(0)-y(total))}
                fill="var(--accent)" rx="1" opacity="0.9" />
              {(i===0||i===visibleMonths.length-1||i%labelStep===0) && (
                <text x={cx} y={H-pad.b+(narrow ? 14 : 16)} textAnchor="middle" fill="var(--fg-muted)" fontSize={tickFs} fontFamily="var(--ff-mono)">
                  {fmtMonth(m.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ====== Goals progress chart ======
function GoalsProgress({ summaries }) {
  return (
    <div style={{ display:'grid', gap:12 }}>
      {summaries.map(s => {
        const p = s.party;
        const isMetal = p.unit==='gram'||p.unit==='ounce';
        const isEur = p.unit==='eur';
        const goalPct = isMetal ? (s.quantity/p.goal)*100 : (s.currentValueEur/p.goal)*100;
        return (
          <div key={p.id}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
              <span style={{ fontWeight:500, color:'var(--fg)' }}>{p.name}</span>
              <span style={{ fontFamily:'var(--ff-mono)', fontSize:11, color:'var(--fg-muted)' }}>
                {isMetal ? fmtQty(s.quantity, p.unit) : fmtEur(s.currentValueEur)} / {isMetal ? fmtQty(p.goal, p.unit) : fmtEur(p.goal)}
              </span>
            </div>
            <div style={{ height:8, background:'var(--surface-2)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${Math.min(100,Math.max(0,goalPct))}%`, height:'100%', background:p.color,
                borderRadius:4, transition:'width .4s' }} />
            </div>
            <div style={{ fontSize:10, color:'var(--fg-dim)', marginTop:3, textAlign:'right', fontFamily:'var(--ff-mono)' }}>
              {goalPct.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ====== Portfolio return % over time ======
function ReturnLineChart({ data, height = 230 }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const filtered = data.filter(d => d.invested > 0);
  if (!filtered.length || w === 0) return <div ref={ref} style={{ width:'100%', height }} />;

  const series = filtered.map(d => ({ ...d, ret: ((d.total - d.invested) / d.invested) * 100 }));
  const pad = { t: 14, r: 14, b: 28, l: 52 };
  const W = Math.max(300, w), H = height;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const rets = series.map(d => d.ret);
  const minR = Math.min(0, ...rets) * 1.1;
  const maxR = Math.max(0, ...rets) * 1.1 || 1;
  const range = maxR - minR || 1;
  const x = i => pad.l + (series.length > 1 ? (i / (series.length - 1)) * innerW : 0);
  const y = v => pad.t + innerH - ((v - minR) / range) * innerH;
  const zero = y(0);
  const path = series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(d.ret)}`).join(' ');
  const areaPos = path + ` L${x(series.length-1)} ${zero} L${x(0)} ${zero} Z`;
  const yTicks = [minR, minR/2, 0, maxR/2, maxR].filter((v,i,a) => a.indexOf(v) === i);
  const stepX = Math.max(1, Math.floor(series.length / 5));
  const xTickIdx = [];
  for (let i = 0; i < series.length; i += stepX) xTickIdx.push(i);
  if (xTickIdx[xTickIdx.length-1] !== series.length-1) xTickIdx.push(series.length-1);

  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.querySelector('svg').getBoundingClientRect();
    const ratio = (e.clientX - rect.left - pad.l) / innerW;
    setHoverIdx(Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))));
  };
  const hover = hoverIdx != null ? series[hoverIdx] : null;

  return (
    <div ref={ref} style={{ width:'100%', position:'relative', overflow:'hidden' }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} style={{ display:'block', maxWidth:'100%' }}>
        <defs>
          <linearGradient id="ret-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W-pad.r} y1={y(v)} y2={y(v)} stroke={v===0?'var(--border-strong)':'var(--border)'} strokeWidth={v===0?1:1} strokeDasharray={v===0?'0':'2,3'} />
            <text x={pad.l-8} y={y(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize="10" fontFamily="var(--ff-mono)">{v.toFixed(1)}%</text>
          </g>
        ))}
        {xTickIdx.map(i => (
          <text key={i} x={x(i)} y={H-pad.b+16} textAnchor="middle" fill="var(--fg-dim)" fontSize="10" fontFamily="var(--ff-mono)">
            {fmtMonth(series[i].date.slice(0,7))}
          </text>
        ))}
        <path d={areaPos} fill="url(#ret-fill)" />
        <path d={path} fill="none" stroke="var(--positive)" strokeWidth="2" />
        {hover && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H-pad.b} stroke="var(--border-strong)" strokeDasharray="2,2" />
            <circle cx={x(hoverIdx)} cy={y(hover.ret)} r="4" fill="var(--positive)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div style={{ position:'absolute', left:Math.min(W-200,Math.max(0,x(hoverIdx)-90)), top:4,
          background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
          padding:'8px 10px', fontSize:12, pointerEvents:'none', boxShadow:'var(--shadow)' }}>
          <div style={{ color:'var(--fg-dim)', fontSize:10, fontFamily:'var(--ff-mono)' }}>{fmtDate(hover.date)}</div>
          <div style={{ color:hover.ret>=0?'var(--positive)':'var(--negative)', fontWeight:600, fontFamily:'var(--ff-mono)' }}>{hover.ret>=0?'+':''}{hover.ret.toFixed(2)}%</div>
          <div style={{ color:'var(--fg-muted)', fontFamily:'var(--ff-mono)', fontSize:11 }}>{fmtEur(hover.total)} totaal</div>
        </div>
      )}
    </div>
  );
}

// ====== Return table ======
function ReturnTable({ summaries }) {
  const sorted = [...summaries].sort((a, b) => (b.pnlPct||0) - (a.pnlPct||0));
  return (
    <div style={{ display:'grid', gap:0, marginTop:4 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px', fontSize:10, color:'var(--fg-muted)',
        textTransform:'uppercase', letterSpacing:'0.05em', padding:'0 4px 6px', borderBottom:'1px solid var(--border)', fontFamily:'var(--ff-mono)' }}>
        <span>Partij</span>
        <span style={{ textAlign:'right' }}>Waarde</span>
        <span style={{ textAlign:'right' }}>Rendement</span>
      </div>
      {sorted.map(s => (
        <div key={s.party.id} style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px', fontSize:13,
          padding:'8px 4px', borderBottom:'1px dashed var(--border)', fontFamily:'var(--ff-mono)', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
            <div style={dotStyle(s.party.color, 8)} />
            <span style={{ color:'var(--fg)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:12 }}>{s.party.name}</span>
          </div>
          <span style={{ textAlign:'right', color:'var(--fg)', fontSize:12 }}>{s.currentValueEur>0?fmtEur(s.currentValueEur):'—'}</span>
          <span style={{ textAlign:'right', color:s.pnlPct>=0?'var(--positive)':'var(--negative)', fontSize:12 }}>
            {s.invested>0?fmtPct(s.pnlPct,{decimals:2}):'—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ====== Monthly inleg line chart ======
function MonthlyLineChart({ months, height = 200 }) {
  const ref = React.useRef();
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => { for (const e of entries) setW(e.contentRect.width); });
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  if (!months.length || w === 0) return <div ref={ref} style={{ width:'100%', height }} />;

  const narrow = w < 430;
  const visibleMonths = narrow ? months.slice(-12) : months;
  const pad = { t: 12, r: narrow ? 6 : 12, b: narrow ? 24 : 30, l: narrow ? 34 : 40 };
  const W = Math.max(220, w), H = height;
  const innerW = W-pad.l-pad.r, innerH = H-pad.t-pad.b;
  const vals = visibleMonths.map(m => m.inleg + m.koop);
  const maxV = Math.max(1, ...vals);
  const x = i => pad.l + (visibleMonths.length > 1 ? (i / (visibleMonths.length - 1)) * innerW : 0);
  const y = v => pad.t + innerH - (v / maxV) * innerH;
  const path = visibleMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(vals[i])}`).join(' ');
  const area = path + ` L${x(visibleMonths.length-1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const tickFs = narrow ? 9 : 10;
  const labelStep = narrow ? 3 : Math.max(1, Math.floor(visibleMonths.length / 6));

  const onMove = e => {
    if (!ref.current) return;
    const rect = ref.current.querySelector('svg').getBoundingClientRect();
    const ratio = (e.clientX - rect.left - pad.l) / innerW;
    setHoverIdx(Math.max(0, Math.min(visibleMonths.length-1, Math.round(ratio*(visibleMonths.length-1)))));
  };
  const hover = hoverIdx != null ? visibleMonths[hoverIdx] : null;

  return (
    <div ref={ref} style={{ width:'100%', position:'relative', overflow:'hidden' }}>
      <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} style={{ display:'block', maxWidth:'100%' }}>
        <defs>
          <linearGradient id="inleg-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f, i) => {
          const v = maxV*f;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W-pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={i===0?'0':'2,3'} />
              <text x={pad.l-5} y={y(v)+3} textAnchor="end" fill="var(--fg-dim)" fontSize={tickFs} fontFamily="var(--ff-mono)">
                {v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':Math.round(v)}
              </text>
            </g>
          );
        })}
        {visibleMonths.map((m, i) => {
          const show = i===0 || i===visibleMonths.length-1 || i%labelStep===0;
          return show ? (
            <text key={i} x={x(i)} y={H-pad.b+(narrow ? 14 : 16)} textAnchor="middle" fill="var(--fg-muted)" fontSize={tickFs} fontFamily="var(--ff-mono)">
              {fmtMonth(m.month)}
            </text>
          ) : null;
        })}
        <path d={area} fill="url(#inleg-fill)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        {visibleMonths.map((m, i) => (
          <circle key={i} cx={x(i)} cy={y(vals[i])} r={hoverIdx===i?5:3}
            fill={hoverIdx===i?'var(--accent)':'var(--surface)'} stroke="var(--accent)" strokeWidth="1.5" style={{ transition:'r .1s' }} />
        ))}
        {hover && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H-pad.b} stroke="var(--border-strong)" strokeDasharray="2,2" />
        )}
      </svg>
      {hover && (
        <div style={{ position:'absolute', left:Math.min(W-160,Math.max(0,x(hoverIdx)-70)), top:4,
          background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:'var(--radius)',
          padding:'8px 10px', fontSize:12, pointerEvents:'none', boxShadow:'var(--shadow)' }}>
          <div style={{ color:'var(--fg-dim)', fontSize:10, fontFamily:'var(--ff-mono)' }}>{fmtMonth(hover.month)}</div>
          <div style={{ color:'var(--fg)', fontWeight:600, fontFamily:'var(--ff-mono)' }}>{fmtEur(vals[hoverIdx])}</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  LineChart, AllocationLineChart, AllocationBarChart,
  DonutChart, InvestedVsValueChart, ReturnBars, MonthlyBars, GoalsProgress,
  ReturnLineChart, ReturnTable, MonthlyLineChart,
});
