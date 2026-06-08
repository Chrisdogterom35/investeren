// Preview UI shells — three completely different layout paradigms
// Inspired by Bloomberg Terminal, Robinhood/Vault, and Vaulto cinematic fintech

const PREVIEW_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: '▣' },
  { key: 'transacties', label: 'Transacties', icon: '≡' },
  { key: 'pensioen', label: 'Pensioen', icon: '◷' },
];

function PreviewBanner({ variant }) {
  const labels = { terminal: 'Terminal', vault: 'Vault', lumina: 'Lumina' };
  return (
    <div style={{
      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
      color: '#fff', fontSize: 12, fontWeight: 600,
      padding: '6px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      position: 'sticky', top: 0, zIndex: 200,
    }}>
      <span>UI Preview — {labels[variant] || variant}</span>
      <span style={{ opacity: 0.5 }}>|</span>
      <a href="./index.html" style={{ color: '#fff', textDecoration: 'underline' }}>Alle opties</a>
      <a href="../index.html" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Huidige site</a>
    </div>
  );
}

// ── Shared ticker component ──────────────────────────────────
function SpotTicker({ spots, spotStatus }) {
  const items = [
    { l: 'BTC', v: spots.btcSpotEur, d: 0 },
    { l: 'ETH', v: spots.ethSpotEur, d: 0 },
    { l: 'AU', v: spots.goldSpotEurPerGram, d: 2, s: '/g' },
    { l: 'AG', v: spots.silverSpotEurPerOunce, d: 2, s: '/oz' },
    { l: 'MSN', v: spots.meesmanNavEur, d: 2, s: '/p' },
  ];
  return (
    <div className="preview-ticker" style={{
      display: 'flex', gap: 20, overflowX: 'auto', padding: '6px 16px',
      fontFamily: 'var(--ff-mono)', fontSize: 11, whiteSpace: 'nowrap',
      borderBottom: '1px solid var(--border)',
    }}>
      {items.map(p => (
        <span key={p.l} style={{ color: 'var(--fg-muted)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.l}</span>{' '}
          {p.v != null ? fmtEur(p.v, { decimals: p.d }) : '—'}{p.s || ''}
        </span>
      ))}
      {spotStatus?.fetchedAt && (
        <span style={{ color: 'var(--fg-dim)', marginLeft: 'auto' }}>
          {new Date(spotStatus.fetchedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// OPTIE A: TERMINAL — Bloomberg / Fortress inspired
// ══════════════════════════════════════════════════════════════
function TerminalShell({ variant, activeTab, setActiveTab, children, totals, onSettings, onRefresh, spotStatus, syncStatus, sbOk, tweaksOpen }) {
  return (
    <>
      <PreviewBanner variant={variant} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 32px)' }}>
        {/* Sidebar */}
        <aside style={{
          width: 200, flexShrink: 0, background: 'var(--surface)',
          borderRight: '1px solid var(--border-strong)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppLogo size={28} />
            <div>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>
              INVST
            </div>
            <div style={{ fontSize: 9, color: 'var(--fg-dim)', fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
              PORTFOLIO v3.0
            </div>
            </div>
          </div>
          <nav style={{ flex: 1, padding: '8px 0' }}>
            {PREVIEW_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 14px', border: 'none',
                  background: activeTab === tab.key ? 'var(--surface-2)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-muted)',
                  fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left',
                  borderLeft: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                }}>
                <span style={{ opacity: 0.6 }}>{tab.icon}</span>
                {tab.label.toUpperCase()}
              </button>
            ))}
          </nav>
          {/* Portfolio summary in sidebar */}
          {totals && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
              <div style={{ color: 'var(--fg-dim)', marginBottom: 4 }}>NAV</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>{fmtEur(totals.total, { decimals: 0 })}</div>
              <div style={{ color: totals.pnl >= 0 ? 'var(--positive)' : 'var(--negative)', marginTop: 2 }}>
                {(totals.pnl >= 0 ? '+' : '') + fmtEur(totals.pnl, { decimals: 0 })} ({totals.pnlPct >= 0 ? '+' : ''}{totals.pnlPct.toFixed(1)}%)
              </div>
            </div>
          )}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 4 }}>
            <button onClick={onRefresh} title="Ververs koersen"
              style={{ flex: 1, padding: '5px', fontSize: 11, fontFamily: 'var(--ff-mono)', cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
              ↻
            </button>
            <button onClick={onSettings} title="Instellingen"
              style={{ flex: 1, padding: '5px', fontSize: 11, fontFamily: 'var(--ff-mono)', cursor: 'pointer',
                background: tweaksOpen ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--border)', color: tweaksOpen ? '#000' : 'var(--fg-muted)' }}>
              ⚙
            </button>
            {sbOk && (
              <span title="Supabase sync" style={{ fontSize: 10, color: syncStatus?.error ? 'var(--negative)' : 'var(--positive)', alignSelf: 'center' }}>●</span>
            )}
          </div>
        </aside>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <SpotTicker spots={totals?.spots || {}} spotStatus={spotStatus} />
          <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
          <footer style={{
            padding: '4px 14px', borderTop: '1px solid var(--border)',
            fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--fg-dim)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>TERMINAL MODE · PREVIEW</span>
            <span>{new Date().toLocaleDateString('nl-NL')}</span>
          </footer>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// OPTIE B: VAULT — Robinhood / Vault inspired
// ══════════════════════════════════════════════════════════════
function VaultShell({ variant, activeTab, setActiveTab, children, totals, onSettings, onRefresh, spotStatus, syncStatus, sbOk, tweaksOpen }) {
  const NavIcon = ({ d }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d={d} />
    </svg>
  );
  const icons = {
    dashboard: 'M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9',
    transacties: 'M9 6h11M9 12h11M9 18h11M3 6h.01M3 12h.01M3 18h.01',
    pensioen: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  return (
    <>
      <PreviewBanner variant={variant} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 32px)' }}>
        <aside style={{
          width: 240, flexShrink: 0, background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '20px 12px',
        }}>
          <div style={{ padding: '0 12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <AppLogo size={36} />
            <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
              Investeringen
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>Portfolio tracker</div>
            </div>
          </div>
          <nav style={{ flex: 1, display: 'grid', gap: 4 }}>
            {PREVIEW_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '10px 12px', border: 'none', borderRadius: 12,
                  background: activeTab === tab.key ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-muted)',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 500,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <NavIcon d={icons[tab.key]} />
                {tab.label}
              </button>
            ))}
          </nav>
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
            <button onClick={onRefresh}
              style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
                color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              ↻ Koersen verversen
            </button>
            <button onClick={onSettings}
              style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                background: tweaksOpen ? 'var(--accent)' : 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 10,
                color: tweaksOpen ? '#fff' : 'var(--fg-muted)' }}>
              ⚙ Instellingen
            </button>
          </div>
        </aside>
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// OPTIE C: LUMINA — Vaulto / cinematic fintech inspired
// ══════════════════════════════════════════════════════════════
function LuminaShell({ variant, activeTab, setActiveTab, children, totals, onSettings, onRefresh, spotStatus, syncStatus, sbOk, tweaksOpen }) {
  return (
    <>
      <PreviewBanner variant={variant} />
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 32, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: 32, height: 56,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppLogo size={32} />
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
              Lumina<span style={{ color: 'var(--accent)' }}>.</span>
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {PREVIEW_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: activeTab === tab.key ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-muted)',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer',
                }}>
                {tab.label}
              </button>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {totals && (
              <div style={{ textAlign: 'right', marginRight: 12, fontFamily: 'var(--ff-mono)', fontSize: 12 }}>
                <div style={{ color: 'var(--fg-dim)' }}>Portfolio</div>
                <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{fmtEur(totals.total, { decimals: 0 })}</div>
              </div>
            )}
            <button onClick={onRefresh} title="Ververs"
              style={{ padding: '6px 10px', fontSize: 13, background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--fg-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
            <button onClick={onSettings} title="Instellingen"
              style={{ padding: '6px 10px', fontSize: 13,
                background: tweaksOpen ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--border)', borderRadius: 8,
                color: tweaksOpen ? '#fff' : 'var(--fg-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>⚙</button>
            {sbOk && <span style={{ fontSize: 8, color: syncStatus?.error ? 'var(--negative)' : 'var(--positive)' }}>●</span>}
          </div>
        </div>
        <SpotTicker spots={totals?.spots || {}} spotStatus={spotStatus} />
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', minHeight: 'calc(100vh - 120px)' }}>
        {children}
      </main>
    </>
  );
}

window.PREVIEW_SHELLS = {
  terminal: TerminalShell,
  vault: VaultShell,
  lumina: LuminaShell,
};
