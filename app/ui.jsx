// Small shared UI primitives

const { useState, useEffect, useRef, useMemo } = React;

function Button({ children, variant = 'primary', onClick, type = 'button', style, ...rest }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '9px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
    lineHeight: 1,
    transition: 'all .15s ease',
    fontFamily: 'inherit',
  };
  const variants = {
    primary: {
      background: 'var(--fg)', color: 'var(--bg)', borderColor: 'var(--fg)',
    },
    secondary: {
      background: 'var(--surface)', color: 'var(--fg)',
    },
    ghost: {
      background: 'transparent', color: 'var(--fg-muted)', border: '1px solid transparent',
    },
    danger: {
      background: 'transparent', color: 'var(--negative)', borderColor: 'var(--border)',
    },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}

function Card({ children, style, onClick, hover, ...rest }) {
  const [h, setH] = useState(false);
  return (
    <div
      className="dash-card"
      onClick={onClick}
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => hover && setH(false)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        transition: 'transform .15s ease, border-color .15s ease',
        transform: h ? 'translateY(-1px)' : 'none',
        borderColor: h ? 'var(--accent)' : 'var(--border-strong)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = 'neutral', style }) {
  const tones = {
    neutral:  { bg: 'var(--surface-2)', fg: 'var(--fg-muted)', bd: 'var(--border)' },
    accent:   { bg: 'color-mix(in oklab, var(--accent) 12%, transparent)', fg: 'var(--accent)', bd: 'color-mix(in oklab, var(--accent) 30%, transparent)' },
    positive: { bg: 'color-mix(in oklab, var(--positive) 12%, transparent)', fg: 'var(--positive)', bd: 'color-mix(in oklab, var(--positive) 30%, transparent)' },
    negative: { bg: 'color-mix(in oklab, var(--negative) 12%, transparent)', fg: 'var(--negative)', bd: 'color-mix(in oklab, var(--negative) 30%, transparent)' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      fontSize: 11, fontWeight: 500,
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`,
      borderRadius: 999,
      letterSpacing: '0.02em',
      lineHeight: 1.4,
      ...style,
    }}>
      {children}
    </span>
  );
}

function Field({ label, children, hint, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 14,
  color: 'var(--fg)',
  outline: 'none',
  fontFamily: 'inherit',
};

function Input(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select({ children, ...rest }) {
  return <select {...rest} style={{ ...inputStyle, ...(rest.style || {}) }}>{children}</select>;
}
function Textarea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', minHeight: 60, ...(props.style || {}) }} />;
}

// Delta indicator
function Delta({ value, format = 'pct', decimals }) {
  if (value == null || Number.isNaN(value)) return <span style={{ color: 'var(--fg-dim)' }}>—</span>;
  const tone = value > 0 ? 'var(--positive)' : value < 0 ? 'var(--negative)' : 'var(--fg-muted)';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '·';
  const text = format === 'pct' ? fmtPct(value, { decimals: decimals ?? 2 }) : fmtEur(value, { sign: true, decimals: decimals ?? 0 });
  return (
    <span style={{ color: tone, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 500 }}>
      <span style={{ fontSize: 9, transform: 'translateY(-1px)' }}>{arrow}</span>{text}
    </span>
  );
}

// Shared style helpers — avoids repeating the same inline object literals
const dotStyle  = (color, size = 8) => ({ width: size, height: size, borderRadius: 2, background: color, flexShrink: 0 });
const labelSm   = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-dim)', marginBottom: 4 };
const monoSm    = { fontFamily: 'var(--ff-mono)', fontSize: 11 };

function assetUrl(path) {
  const base = window.__ASSET_BASE__ || '';
  return base + path;
}

function AppLogo({ size = 28, style, ...rest }) {
  return (
    <img
      src={assetUrl('icon.svg')}
      alt="Investeringen"
      width={size}
      height={size}
      style={{ borderRadius: Math.round(size * 0.22), display: 'block', flexShrink: 0, ...style }}
      {...rest}
    />
  );
}

Object.assign(window, { Button, Card, Pill, Field, Input, Select, Textarea, Delta, inputStyle, dotStyle, labelSm, monoSm, AppLogo, assetUrl });
