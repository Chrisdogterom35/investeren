// Data model, seed data, localStorage persistence

const STORAGE_KEY = 'investeringen-v3'; // v3 = eigen data, geen demo
const OZ_TO_GRAM  = 31.1034768; // troy ounce → gram
const DEFAULT_MEESMAN_NAV_EUR = 102.7860; // Meesman site: 08-05-2026

// Zilver: converteer gram naar ounce voor interne opslag (spot is altijd €/oz)
function silverToOz(qty, silverUnit) {
  if (silverUnit === 'gram') return qty / OZ_TO_GRAM;
  return qty; // al in oz
}

// Goud: converteer ounce naar gram voor interne opslag (spot is altijd €/gram)
function goldToGram(qty, goldUnit) {
  if (goldUnit === 'ounce') return qty * OZ_TO_GRAM;
  return qty; // al in gram
}

const PARTIES = [
  { id: 'meesman',      name: 'Meesman',       category: 'Indexfondsen', subtitle: 'Wereldwijd aandelenfonds', color: 'oklch(58% 0.14 255)', unit: 'part',  unitLabel: 'part.', goal: 25000 },
  { id: 'finst-btc',   name: 'Bitcoin',        category: 'Crypto',   subtitle: 'BTC via Finst',           color: 'oklch(72% 0.18 55)',  unit: 'crypto', unitLabel: 'BTC',   goal: 5000, spotKey: 'btcSpotEur'  },
  { id: 'finst-eth',   name: 'Ethereum',       category: 'Crypto',   subtitle: 'ETH via Finst',           color: 'oklch(60% 0.12 265)', unit: 'crypto', unitLabel: 'ETH',   goal: 2500, spotKey: 'ethSpotEur'  },
  { id: 'finst-paxg',  name: 'Pax Gold',       category: 'Edelmetaal', subtitle: 'PAXG via Finst',         color: 'oklch(76% 0.14 85)',  unit: 'crypto', unitLabel: 'PAXG',  goal: 1500, spotKey: 'paxgSpotEur' },
  { id: 'finst-top25', name: 'Top 25 Bundel',  category: 'Crypto',   subtitle: 'Top 25 tokens via Finst', color: 'oklch(62% 0.15 195)', unit: 'bundle', unitLabel: '€',     goal: 1000 },
  { id: 'goldrepublic', name: 'Goldrepublic',  category: 'Edelmetaal',   subtitle: 'Goud & zilver in kluis',   color: 'oklch(78% 0.14 85)',  unit: 'mixed', unitLabel: 'g/oz',  goal: 5000, isMixed: true },
  { id: 'trading212',   name: 'Trading 212',   category: 'Broker',       subtitle: "Aandelen & ETF's",         color: 'oklch(55% 0.16 145)', unit: 'bundle',unitLabel: '€',     goal: 5000 },
  { id: 'goud',         name: 'Fysiek Goud',   category: 'Edelmetaal',   subtitle: 'Eigen bezit — gram',       color: 'oklch(75% 0.15 70)',  unit: 'gram',  unitLabel: 'g',     goal: 20 },
  { id: 'zilver',       name: 'Fysiek Zilver', category: 'Edelmetaal',   subtitle: 'Eigen bezit — ounce',      color: 'oklch(70% 0.03 240)', unit: 'ounce', unitLabel: 'oz',    goal: 30 },
  { id: 'cash',         name: 'Cash',          category: 'Liquide',      subtitle: 'Directe reserve',          color: 'oklch(55% 0.05 160)', unit: 'eur',   unitLabel: '€',     goal: 2000 },
];

// ===== Widget registry for customizable dashboard =====
const WIDGET_REGISTRY = [
  { id: 'portfolio_line',   label: 'Portfolio over tijd',   desc: 'Waarde vs. ingelegd',            chartTypes: ['lijn', 'rendement%'],  defaultSize: 'large'  },
  { id: 'allocation',       label: 'Verdeling',             desc: 'Aandeel per partij',              chartTypes: ['donut', 'balk'],        defaultSize: 'medium' },
  { id: 'party_comparison', label: 'Inleg vs. waarde',      desc: 'Vergelijking per partij',         chartTypes: ['groepsbalk'],           defaultSize: 'medium' },
  { id: 'returns',          label: 'Rendementen',           desc: '% rendement per partij',          chartTypes: ['balk', 'tabel'],        defaultSize: 'small'  },
  { id: 'monthly_inleg',    label: 'Maandelijkse inleg',    desc: 'Historisch inlegpatroon',         chartTypes: ['balk', 'lijn'],         defaultSize: 'small'  },
  { id: 'allocation_lines', label: 'Waarde per allocatie',  desc: 'Waardeontwikkeling per partij',   chartTypes: ['lijn'],                 defaultSize: 'full'   },
  { id: 'party_grid',       label: 'Partijkaarten',         desc: 'Overzichtskaarten',               chartTypes: ['kaarten'],              defaultSize: 'full'   },
  { id: 'monthly_table',    label: 'Maandoverzicht',        desc: 'P&L en cashflow per maand',       chartTypes: ['tabel'],                defaultSize: 'medium' },
  { id: 'activity_feed',    label: 'Recente activiteit',    desc: 'Laatste transacties',             chartTypes: ['lijst'],                defaultSize: 'small'  },
  { id: 'fees_summary',     label: 'Transactiekosten',      desc: 'Totale kosten betaald',           chartTypes: ['cijfers'],              defaultSize: 'small'  },
  { id: 'metal_holdings',   label: 'Edelmetalen detail',    desc: 'Hoeveelheden edelmetalen',        chartTypes: ['cijfers'],              defaultSize: 'small'  },
  { id: 'goals',            label: 'Doelen voortgang',      desc: 'Vooruitgang per doel',            chartTypes: ['voortgang'],            defaultSize: 'medium' },
];

const DEFAULT_WIDGETS = [
  { id: 'portfolio_line',   enabled: true,  chartType: 'lijn',      size: 'large'  },
  { id: 'allocation',       enabled: true,  chartType: 'donut',     size: 'medium' },
  { id: 'party_comparison', enabled: true,  chartType: 'groepsbalk',size: 'medium' },
  { id: 'returns',          enabled: true,  chartType: 'balk',      size: 'small'  },
  { id: 'monthly_inleg',    enabled: true,  chartType: 'balk',      size: 'small'  },
  { id: 'allocation_lines', enabled: true,  chartType: 'lijn',      size: 'full'   },
  { id: 'party_grid',       enabled: true,  chartType: 'kaarten',   size: 'full'   },
  { id: 'monthly_table',    enabled: true,  chartType: 'tabel',     size: 'medium' },
  { id: 'activity_feed',    enabled: true,  chartType: 'lijst',     size: 'small'  },
  { id: 'fees_summary',     enabled: true,  chartType: 'cijfers',   size: 'small'  },
  { id: 'metal_holdings',   enabled: false, chartType: 'cijfers',   size: 'small'  },
  { id: 'goals',            enabled: false, chartType: 'voortgang', size: 'medium' },
];

const today = new Date();
const d = (monthsAgo, day = 15) => {
  const dt = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
  return dt.toISOString().slice(0, 10);
};

function todayIsoLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso, days = 1) {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const MEESMAN_NAV_SEED_HISTORY = [
  { date: '2025-01-12', nav: 88.2833 },
  { date: '2025-01-13', nav: 88.6971 },
  { date: '2025-01-17', nav: 90.3218 },
  { date: '2025-01-24', nav: 90.2836 },
  { date: '2025-02-07', nav: 91.3943 },
  { date: '2025-02-14', nav: 91.4765 },
  { date: '2025-03-07', nav: 84.9613 },
  { date: '2025-03-28', nav: 83.0794 },
  { date: '2025-05-09', nav: 81.6632 },
  { date: '2025-06-05', nav: 84.1696 },
  { date: '2025-06-13', nav: 83.7559 },
  { date: '2025-06-23', nav: 83.9741 },
  { date: '2025-06-27', nav: 84.9795 },
  { date: '2025-07-07', nav: 85.3903 },
  { date: '2025-08-01', nav: 86.4645 },
  { date: '2025-08-08', nav: 87.9118 },
  { date: '2025-08-11', nav: 87.1998 },
  { date: '2025-08-29', nav: 87.9546 },
  { date: '2025-09-26', nav: 90.3241 },
  { date: '2026-01-16', nav: 97.2780 },
  { date: '2026-01-30', nav: 95.2517 },
  { date: '2026-02-24', nav: 96.9905 },
  { date: '2026-03-02', nav: 97.5442 },
  { date: '2026-04-10', nav: 96.0370 },
  { date: '2026-04-24', nav: 100.0430 },
  { date: '2026-05-05', nav: 101.1950 },
  { date: '2026-05-08', nav: DEFAULT_MEESMAN_NAV_EUR },
].reduce((acc, h) => {
  const i = acc.findIndex(x => x.date === h.date);
  if (i >= 0) acc[i] = h;
  else acc.push(h);
  acc.sort((a, b) => a.date.localeCompare(b.date));
  return acc;
}, []);

function mergePriceHistory(base = [], extra = []) {
  const map = new Map();
  [...base, ...extra].forEach(h => {
    const nav = +(h.nav ?? h.price ?? 0);
    if (h.date && nav > 0) map.set(h.date, { date: h.date, nav });
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeMeesmanHistory(history = []) {
  const officialLatest = MEESMAN_NAV_SEED_HISTORY[MEESMAN_NAV_SEED_HISTORY.length - 1];
  const normalized = mergePriceHistory(
    MEESMAN_NAV_SEED_HISTORY,
    (history || []).filter(h => h.date <= officialLatest.date || +h.nav !== 100.4)
  );
  const current = normalized.find(h => h.date === officialLatest.date) || officialLatest;
  return { history: normalized, currentNav: current.nav };
}

function makeId() { return 'tx_' + Math.random().toString(36).slice(2, 10); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.widgets)       parsed.widgets       = DEFAULT_WIDGETS.map(w => ({ ...w }));
      if (!parsed.hiddenParties) parsed.hiddenParties = [];
      if (!parsed.tileMetrics)   parsed.tileMetrics   = {};
      if (!parsed.transactions)  parsed.transactions  = [];
      if (!parsed.deletedTransactionIds) parsed.deletedTransactionIds = {};
      // Migratie: oude customParties + hardcoded PARTIES → één state.parties array
      if (!parsed.parties || !parsed.parties.length) {
        const ids = new Set();
        const merged = [];
        for (const p of [...PARTIES, ...(parsed.customParties || [])]) {
          if (!ids.has(p.id)) { ids.add(p.id); merged.push(p); }
        }
        parsed.parties = merged;
      }
      // Bewaar customParties NIET meer; alleen state.parties telt vanaf nu
      delete parsed.customParties;
      // Migratie: tweaks (spot prices, theme, API keys) verhuizen naar state.tweaks
      if (!parsed.tweaks) {
        parsed.tweaks = { ...(window.TWEAKS || {}) };
      }
      // Migratie: Meesman NAV
      if (parsed.meesmanNavEur == null) {
        parsed.meesmanNavEur = parsed.tweaks?.meesmanNavEur || DEFAULT_MEESMAN_NAV_EUR;
      }
      if (!parsed.meesmanNavHistory || !parsed.meesmanNavHistory.length) {
        const twHist = parsed.tweaks?.meesmanNavHistory;
        parsed.meesmanNavHistory = (twHist && twHist.length) ? twHist : MEESMAN_NAV_SEED_HISTORY;
      }
      const normalizedMeesman = normalizeMeesmanHistory(parsed.meesmanNavHistory);
      parsed.meesmanNavHistory = normalizedMeesman.history;
      parsed.meesmanNavEur = normalizedMeesman.currentNav;
      return parsed;
    }
  } catch (e) {}
  // Eerste keer: alle defaults uit code (zal direct naar Supabase gesyncd worden)
  return {
    transactions:       [],
    deletedTransactionIds: {},
    widgets:            DEFAULT_WIDGETS.map(w => ({ ...w })),
    parties:            [...PARTIES],
    hiddenParties:      [],
    tileMetrics:        {},
    tweaks:             { ...(window.TWEAKS || {}) },
    meesmanNavEur:      DEFAULT_MEESMAN_NAV_EUR,
    meesmanNavHistory:  MEESMAN_NAV_SEED_HISTORY,
  };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage quota: bewaar zonder grote history-arrays
    try {
      const { goldHistory, silverHistory, btcHistory, ethHistory, paxgHistory, ...slim } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {}
  }
}

const TX_TYPES = [
  { key: 'inleg',      label: 'Inleg' },
  { key: 'opname',     label: 'Opname' },
  { key: 'koop',       label: 'Koop' },
  { key: 'verkoop',    label: 'Verkoop' },
  { key: 'cashback',   label: 'Cashback / Spare Change' },
  { key: 'dividend',   label: 'Dividend' },
  { key: 'rente',      label: 'Rente / Rendement' },
  { key: 'kosten',     label: 'Kosten / Fee' },
  { key: 'waardering', label: 'Waardering' },
];
const TX_LABELS = Object.fromEntries(TX_TYPES.map(t => [t.key, t.label]));

function spotEurForParty(party, spots) {
  if (party.unit === 'gram')    return spots.goldSpotEurPerGram;
  if (party.unit === 'ounce')   return spots.silverSpotEurPerOunce;
  if (party.unit === 'crypto')  return spots[party.spotKey] || null;
  if (party.id   === 'meesman') return spots.meesmanNavEur  || null;
  return null;
}

// Zoek meest recente NAV op of voor een gegeven datum in gesorteerde history [{date, nav}]
function findNavForDate(history, date) {
  let result = null;
  for (const h of history) {
    if (h.date <= date) result = h.nav;
    else break;
  }
  return result;
}

function daysBetween(a, b) {
  const start = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function txCashAmount(t) {
  return (+t.amountEur || 0) || (+t.quantity || 0) * (+t.unitPriceEur || 0);
}

function bundleSnapshotAtDate(txs, date) {
  let balance = 0;
  let cost = 0;
  let firstActiveDate = null;
  let lastValue = null;

  for (const t of txs) {
    if (t.date > date) continue;
    const amount = txCashAmount(t);
    if (['inleg', 'koop', 'cashback'].includes(t.type)) {
      balance += amount;
      cost += amount;
      if (!firstActiveDate && balance > 0) firstActiveDate = t.date;
    } else if (['opname', 'verkoop'].includes(t.type)) {
      const reduction = balance > 0 ? Math.min(cost, cost * (amount / balance)) : 0;
      cost = Math.max(0, cost - reduction);
      balance = Math.max(0, balance - amount);
    } else if (t.type === 'kosten') {
      cost += +t.amountEur || 0;
    } else if (t.type === 'waardering') {
      const value = t.valueEur != null ? +t.valueEur : (t.unitPriceEur != null ? +t.unitPriceEur : null);
      if (value != null) {
        lastValue = value;
      }
    }
  }

  return { balance, cost, firstActiveDate, lastValue };
}

function bundleValuations(txs) {
  let balance = 0;
  let cost = 0;
  const valuations = [];
  for (const t of txs) {
    const amount = txCashAmount(t);
    if (['inleg', 'koop', 'cashback'].includes(t.type)) {
      balance += amount;
      cost += amount;
    } else if (['opname', 'verkoop'].includes(t.type)) {
      const reduction = balance > 0 ? Math.min(cost, cost * (amount / balance)) : 0;
      cost = Math.max(0, cost - reduction);
      balance = Math.max(0, balance - amount);
    } else if (t.type === 'kosten') {
      cost += +t.amountEur || 0;
    } else if (t.type === 'waardering') {
      const value = t.valueEur != null ? +t.valueEur : (t.unitPriceEur != null ? +t.unitPriceEur : null);
      if (value != null) valuations.push({ date: t.date, value, cost });
    }
  }
  return valuations;
}

function bundleWeeklyInterpolatedValue(partyTxs, date) {
  const txs = [...partyTxs].sort((a, b) => a.date.localeCompare(b.date));
  const current = bundleSnapshotAtDate(txs, date);
  if (!txs.length || current.balance <= 0 && current.cost <= 0) return 0;

  const valuations = bundleValuations(txs);
  const prevVal = valuations.filter(v => v.date <= date).slice(-1)[0] || null;
  const nextVal = valuations.find(v => v.date > date) || null;
  if (!nextVal) {
    if (!prevVal) return current.cost;
    return Math.max(0, current.cost + (prevVal.value - prevVal.cost));
  }

  const startDate = prevVal?.date || current.firstActiveDate || txs[0].date;
  const startPnl = prevVal ? prevVal.value - prevVal.cost : 0;
  const endPnl = nextVal.value - nextVal.cost;
  const totalWeeks = Math.max(1, Math.ceil(daysBetween(startDate, nextVal.date) / 7));
  const elapsedWeeks = Math.min(totalWeeks, Math.floor(daysBetween(startDate, date) / 7));
  const fraction = elapsedWeeks / totalWeeks;
  const interpolatedPnl = startPnl + (endPnl - startPnl) * fraction;
  return Math.max(0, current.cost + interpolatedPnl);
}

function weeklyInterpolatedValue(points, date, fallback = null) {
  const vals = [...points]
    .filter(p => p.date && p.value != null && Number.isFinite(+p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const prev = vals.filter(v => v.date <= date).slice(-1)[0] || null;
  const next = vals.find(v => v.date > date) || null;
  if (!next) return prev ? +prev.value : fallback;
  const startDate = prev?.date || date;
  const startValue = prev ? +prev.value : (fallback ?? +next.value);
  const endValue = +next.value;
  const totalWeeks = Math.max(1, Math.ceil(daysBetween(startDate, next.date) / 7));
  const elapsedWeeks = Math.min(totalWeeks, Math.floor(daysBetween(startDate, date) / 7));
  return startValue + (endValue - startValue) * (elapsedWeeks / totalWeeks);
}

function unitValuationPoints(partyTxs) {
  return [...partyTxs]
    .filter(t => t.type === 'waardering' && t.unitPriceEur != null)
    .map(t => ({ date: t.date, value: +t.unitPriceEur }));
}

function totalValuationPoints(partyTxs) {
  return [...partyTxs]
    .filter(t => t.type === 'waardering' && t.valueEur != null)
    .map(t => ({ date: t.date, value: +t.valueEur }));
}

// Valuation for a party — tracks goud/zilver quantities separately for goldrepublic.
function summarizeParty(party, transactions, spots) {
  const txs = transactions
    .filter(t => t.party === party.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  let quantity = 0;
  let goldQty = 0;   // for goldrepublic
  let silverQty = 0; // for goldrepublic
  let costBasis = 0;
  let realizedCostBasis = 0;
  let realizedPnl = 0;
  let realizedProceeds = 0;
  let lastUnitPrice = null;
  let lastTotalValue = null;
  let lastValuationDate = null;
  let totalDividend = 0, totalFees = 0, totalIncome = 0;
  let totalCashback = 0;
  let netCashIn = 0;

  for (const t of txs) {
    // Transactiekosten tellen mee in costBasis (echte netto-investering)
    if (t.feeEur) {
      totalFees += +t.feeEur;
      if (t.type !== 'verkoop') costBasis += +t.feeEur;
    }

    switch (t.type) {
      case 'inleg':
        netCashIn += +t.amountEur || 0;
        if (party.unit === 'eur' || party.unit === 'bundle') { quantity += +t.amountEur || 0; costBasis += +t.amountEur || 0; }
        break;
      case 'opname':
        netCashIn -= +t.amountEur || 0;
        if (party.unit === 'eur' || party.unit === 'bundle') {
          const amt = +t.amountEur || 0;
          if (quantity > 0) costBasis = Math.max(0, costBasis - (costBasis * (amt / quantity)));
          quantity = Math.max(0, quantity - amt);
        } else {
          const qty = +t.quantity || 0;
          const totalQty = party.isMixed ? (goldQty + silverQty) : quantity;
          const avgPx = totalQty > 0 ? costBasis / totalQty : 0;
          const outQty = party.isMixed
            ? ((t.metalType || 'goud') === 'goud' ? goldToGram(qty, t.goldUnit) : silverToOz(qty, t.silverUnit))
            : qty;
          costBasis = Math.max(0, costBasis - outQty * avgPx);
          if (party.isMixed) {
            const mt = t.metalType || 'goud';
            if (mt === 'goud') goldQty = Math.max(0, goldQty - goldToGram(qty, t.goldUnit));
            else silverQty = Math.max(0, silverQty - silverToOz(qty, t.silverUnit));
          } else {
            quantity = Math.max(0, quantity - qty);
          }
        }
        break;
      case 'koop':
      case 'cashback': {
        const qty = +t.quantity || 0;
        const px  = +t.unitPriceEur || 0;
        if (party.unit === 'bundle') {
          const amount = (+t.amountEur || 0) || qty * px;
          quantity += amount;
          costBasis += amount;
          if (t.type === 'cashback') totalCashback += amount;
        } else if (party.isMixed) {
          const mt = t.metalType || 'goud';
          if (mt === 'goud') goldQty += goldToGram(qty, t.goldUnit);
          else silverQty += silverToOz(qty, t.silverUnit);
          costBasis += qty * px;
        } else {
          quantity += qty;
          costBasis += qty * px;
          if (t.type === 'cashback') totalCashback += qty * px;
        }
        break;
      }
      case 'verkoop': {
        const qty = +t.quantity || 0;
        const proceeds = (+t.amountEur || 0) || qty * (+t.unitPriceEur || 0);
        const fee = +t.feeEur || 0;
        if (party.unit === 'bundle') {
          const soldCost = quantity > 0 ? Math.min(costBasis, costBasis * (proceeds / quantity)) : 0;
          realizedCostBasis += soldCost;
          realizedProceeds += proceeds;
          realizedPnl += proceeds - soldCost - fee;
          costBasis = Math.max(0, costBasis - soldCost);
          quantity = Math.max(0, quantity - proceeds);
          break;
        }
        const totalQty = party.isMixed ? (goldQty + silverQty) : quantity;
        const avgPx = totalQty > 0 ? costBasis / totalQty : 0;
        const saleQty = party.isMixed
          ? ((t.metalType || 'goud') === 'goud' ? goldToGram(qty, t.goldUnit) : silverToOz(qty, t.silverUnit))
          : qty;
        const soldCost = saleQty * avgPx;
        realizedCostBasis += soldCost;
        realizedProceeds += proceeds;
        realizedPnl += proceeds - soldCost - fee;
        costBasis = Math.max(0, costBasis - soldCost);
        if (party.isMixed) {
          const mt = t.metalType || 'goud';
          if (mt === 'goud') goldQty = Math.max(0, goldQty - goldToGram(qty, t.goldUnit));
          else silverQty = Math.max(0, silverQty - silverToOz(qty, t.silverUnit));
        } else {
          quantity = Math.max(0, quantity - qty);
        }
        break;
      }
      case 'dividend': {
        // Herbelegging dividend: participaties gratis ontvangen → toevoegen aan bezit maar NIET aan costBasis
        const qty = +t.quantity || 0;
        const px  = +t.unitPriceEur || 0;
        const divValue = (qty > 0 && px > 0) ? qty * px : (+t.amountEur || 0);
        if (qty > 0 && px > 0) {
          if (party.isMixed) {
            const mt = t.metalType || 'goud';
            if (mt === 'goud') goldQty += goldToGram(qty, t.goldUnit);
            else silverQty += silverToOz(qty, t.silverUnit);
          } else {
            quantity += qty;
          }
        }
        totalDividend += divValue;
        totalIncome   += divValue;
        break;
      }
      case 'rente':  totalIncome += +t.amountEur || 0; break;
      case 'kosten': {
        const kst = +t.amountEur || 0;
        totalFees += kst;
        costBasis += kst; // opslagkosten e.d. tellen mee als werkelijke investering
        break;
      }
      case 'waardering':
        if (t.unitPriceEur != null) lastUnitPrice  = +t.unitPriceEur;
        if (t.valueEur     != null) lastTotalValue = +t.valueEur;
        if ((party.unit === 'gram' || party.unit === 'ounce') && t.quantity != null) quantity = +t.quantity;
        lastValuationDate = t.date;
        break;
    }
  }

  // Determine current value
  let currentValueEur;
  let currentUnitPrice = null;

  if (party.isMixed) {
    // Goldrepublic: gold grams × goldSpot + silver oz × silverSpot
    currentValueEur = goldQty * (spots.goldSpotEurPerGram || 0) + silverQty * (spots.silverSpotEurPerOunce || 0);
    quantity = goldQty + silverQty; // total quantity (not meaningful unit)
  } else if (party.unit === 'crypto') {
    // Crypto: gebruik live spot prijs, val terug op laatste waardering
    currentUnitPrice = spotEurForParty(party, spots) ?? lastUnitPrice;
    currentValueEur  = (currentUnitPrice || 0) * quantity;
  } else if (party.unit === 'eur') {
    currentValueEur = lastTotalValue ?? quantity;
    currentUnitPrice = 1;
  } else if (party.unit === 'bundle') {
    // Top 25 Bundel: inleg optellen, waarde handmatig herwaarderen
    // Backwards compat: als oude transactie unitPriceEur gebruikte als totaalwaarde, accepteer dat ook
    const bundleVal = lastTotalValue ?? (lastUnitPrice != null ? lastUnitPrice : null);
    currentValueEur = bundleVal ?? quantity; // quantity = totaal ingelegd in €
    currentUnitPrice = null;
  } else if (lastTotalValue != null && lastUnitPrice == null) {
    currentValueEur = lastTotalValue;
  } else {
    if (party.unit === 'gram' || party.unit === 'ounce') {
      currentUnitPrice = lastUnitPrice ?? spotEurForParty(party, spots);
    } else {
      // Voor meesman en andere unit='part' partijen: live NAV heeft prioriteit, dan laatste waardering, dan kostprijs
      const livePx = spotEurForParty(party, spots);
      currentUnitPrice = livePx ?? lastUnitPrice ?? (quantity > 0 && lastTotalValue != null ? lastTotalValue / quantity : (quantity > 0 ? costBasis / quantity : null));
    }
    currentValueEur = currentUnitPrice != null ? quantity * currentUnitPrice : costBasis;
  }

  const avgCost = (party.isMixed ? goldQty + silverQty : quantity) > 0 ? costBasis / (party.isMixed ? goldQty + silverQty : quantity) : null;
  const invested = costBasis + realizedCostBasis;
  const pnl = currentValueEur - costBasis + realizedPnl;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

  return {
    party, transactions: txs,
    quantity,
    goldQty:   party.isMixed ? goldQty   : undefined,
    silverQty: party.isMixed ? silverQty : undefined,
    costBasis, avgCost,
    currentUnitPrice, currentValueEur,
    invested,
    lastValuationDate,
    totalDividend, totalFees, totalIncome,
    totalCashback, netCashIn,
    realizedCostBasis, realizedProceeds, realizedPnl,
    pnl, pnlPct,
  };
}

// Per-allocation daily value time series.
function buildPartyTimeSeries(transactions, parties, spots) {
  if (!transactions.length) return { dates: [], byParty: {}, total: [], invested: [] };
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const txByParty = Object.fromEntries(parties.map(p => [p.id, sorted.filter(t => t.party === p.id)]));
  const unitValuationsByParty = Object.fromEntries(parties.map(p => [p.id, unitValuationPoints(txByParty[p.id] || [])]));
  const totalValuationsByParty = Object.fromEntries(parties.map(p => [p.id, totalValuationPoints(txByParty[p.id] || [])]));
  const state = {};
  for (const p of parties) state[p.id] = { qty: 0, goldQty: 0, silverQty: 0, cost: 0, lastUnitPx: null, lastTotal: null };

  const dates = [];
  const byParty = Object.fromEntries(parties.map(p => [p.id, []]));
  const total = []; const invested = [];

  let ti = 0;
  let iso = sorted[0].date;
  const endIso = todayIsoLocal();
  while (iso <= endIso) {
    while (ti < sorted.length && sorted[ti].date <= iso) {
      const t = sorted[ti]; const s = state[t.party]; if (!s) { ti++; continue; }
      const p = parties.find(x => x.id === t.party);
      if (t.feeEur) s.cost += +t.feeEur; // fees tellen mee in investering
      switch (t.type) {
        case 'inleg':
          if (p.unit === 'eur' || p.unit === 'bundle') {
            const amt = +t.amountEur || 0;
            s.qty += amt; s.cost += amt;
            if (s.lastTotal != null) s.lastTotal += amt;
          }
          break;
        case 'opname':
          if (p.unit === 'eur' || p.unit === 'bundle') {
            const amt = +t.amountEur||0;
            if (s.qty > 0) s.cost = Math.max(0, s.cost - (s.cost * (amt / s.qty)));
            s.qty = Math.max(0, s.qty - amt);
            if (s.lastTotal != null) s.lastTotal = Math.max(0, s.lastTotal - amt);
          } else {
            const qty = +t.quantity || 0;
            const totQty = p.isMixed ? s.goldQty + s.silverQty : s.qty;
            const avg = totQty > 0 ? s.cost / totQty : 0;
            const outQty = p.isMixed
              ? ((t.metalType || 'goud') === 'goud' ? goldToGram(qty, t.goldUnit) : silverToOz(qty, t.silverUnit))
              : qty;
            s.cost = Math.max(0, s.cost - outQty * avg);
            if (s.lastTotal != null) {
              const valAvg = s.lastUnitPx ?? (totQty > 0 ? s.lastTotal / totQty : avg);
              s.lastTotal = Math.max(0, s.lastTotal - outQty * valAvg);
            }
            if (p.isMixed) {
              const mt = t.metalType || 'goud';
              if (mt === 'goud') s.goldQty = Math.max(0, s.goldQty - goldToGram(qty, t.goldUnit));
              else s.silverQty = Math.max(0, s.silverQty - silverToOz(qty, t.silverUnit));
            } else {
              s.qty = Math.max(0, s.qty - qty);
            }
          }
          break;
        case 'koop': case 'cashback':
          if (p.unit === 'bundle') {
            const amount = (+t.amountEur || 0) || (+t.quantity || 0) * (+t.unitPriceEur || 0);
            s.qty += amount;
            s.cost += amount;
            if (s.lastTotal != null) s.lastTotal += amount;
          } else if (p.isMixed) {
            const mt = t.metalType || 'goud';
            if (mt === 'goud') s.goldQty += goldToGram(+t.quantity||0, t.goldUnit);
            else s.silverQty += silverToOz(+t.quantity||0, t.silverUnit);
            s.cost += (+t.quantity||0) * (+t.unitPriceEur||0);
            if (s.lastTotal != null) s.lastTotal += (+t.quantity||0) * (+t.unitPriceEur||0);
          } else {
            s.qty += +t.quantity||0;
            s.cost += (+t.quantity||0) * (+t.unitPriceEur||0);
            if (s.lastTotal != null) s.lastTotal += (+t.quantity||0) * (+t.unitPriceEur||0);
          }
          break;
        case 'dividend': {
          // Herbelegging: participaties worden gratis bijgeschreven, GEEN cost toevoeging
          const dQty = +t.quantity||0;
          if (dQty > 0) {
            if (p.isMixed) {
              const mt = t.metalType || 'goud';
              if (mt === 'goud') s.goldQty += goldToGram(dQty, t.goldUnit);
              else s.silverQty += silverToOz(dQty, t.silverUnit);
            } else {
              s.qty += dQty;
            }
          }
          break;
        }
        case 'verkoop': {
          const qty = +t.quantity||0;
          if (p.unit === 'bundle') {
            const proceeds = (+t.amountEur || 0) || qty * (+t.unitPriceEur || 0);
            if (s.qty > 0) s.cost = Math.max(0, s.cost - (s.cost * (proceeds / s.qty)));
            s.qty = Math.max(0, s.qty - proceeds);
            if (s.lastTotal != null) s.lastTotal = Math.max(0, s.lastTotal - proceeds);
            break;
          }
          const totQty = p.isMixed ? s.goldQty + s.silverQty : s.qty;
          const avg = totQty > 0 ? s.cost / totQty : 0;
          const valAvg = s.lastUnitPx ?? (totQty > 0 && s.lastTotal != null ? s.lastTotal / totQty : avg);
          s.cost = Math.max(0, s.cost - qty * avg);
          if (s.lastTotal != null) s.lastTotal = Math.max(0, s.lastTotal - qty * valAvg);
          if (p.isMixed) {
            const mt = t.metalType || 'goud';
            if (mt === 'goud') s.goldQty = Math.max(0, s.goldQty - goldToGram(qty, t.goldUnit));
            else s.silverQty = Math.max(0, s.silverQty - silverToOz(qty, t.silverUnit));
          } else {
            s.qty = Math.max(0, s.qty - qty);
          }
          break;
        }
        case 'kosten':
          s.cost += +t.amountEur || 0; // opslagkosten in investering
          break;
        case 'waardering':
          if (t.unitPriceEur != null) s.lastUnitPx = +t.unitPriceEur;
          if (t.valueEur     != null) s.lastTotal  = +t.valueEur;
          if ((p.unit === 'gram' || p.unit === 'ounce') && t.quantity != null) s.qty = +t.quantity;
          break;
      }
      ti++;
    }

    const CRYPTO_HIST_KEY = { btcSpotEur: 'btcHistory', ethSpotEur: 'ethHistory', paxgSpotEur: 'paxgHistory' };
    let tot = 0, inv = 0;
    for (const p of parties) {
      const s = state[p.id];
      const unitValuations = unitValuationsByParty[p.id] || [];
      const totalValuations = totalValuationsByParty[p.id] || [];
      const avgCostPx = s.qty > 0 ? s.cost / s.qty : null;
      let v;
      if (p.isMixed) {
        const manualTotal = weeklyInterpolatedValue(totalValuations, iso, null);
        if (manualTotal != null) v = manualTotal;
        else {
          const goldPx = (spots.goldHistory?.length ? findNavForDate(spots.goldHistory, iso) : null) ?? (spots.goldSpotEurPerGram||0);
          const silvPx = (spots.silverHistory?.length ? findNavForDate(spots.silverHistory, iso) : null) ?? (spots.silverSpotEurPerOunce||0);
          v = s.goldQty * goldPx + s.silverQty * silvPx;
        }
      } else if (p.unit === 'crypto') {
        const manualTotal = weeklyInterpolatedValue(totalValuations, iso, null);
        if (manualTotal != null) v = manualTotal;
        else {
          const histKey = CRYPTO_HIST_KEY[p.spotKey];
          const histPx = histKey && spots[histKey]?.length ? findNavForDate(spots[histKey], iso) : null;
          const manualPx = weeklyInterpolatedValue(unitValuations, iso, avgCostPx);
          v = s.qty * (histPx ?? manualPx ?? spots[p.spotKey] ?? 0);
        }
      } else if (p.unit === 'bundle') {
        v = bundleWeeklyInterpolatedValue(txByParty[p.id] || [], iso);
      } else if (p.unit === 'eur') {
        v = weeklyInterpolatedValue(totalValuations, iso, s.qty) ?? s.qty;
      } else {
        let px = null;
        // Meesman: gebruik historische NAV indien beschikbaar
        if (px == null && p.id === 'meesman' && spots.meesmanNavHistory?.length) {
          const histNav = findNavForDate(spots.meesmanNavHistory, iso);
          if (histNav != null) px = histNav;
        }
        if (px == null && p.unit === 'gram')  px = (spots.goldHistory?.length   ? findNavForDate(spots.goldHistory,   iso) : null) ?? spotEurForParty(p, spots);
        if (px == null && p.unit === 'ounce') px = (spots.silverHistory?.length ? findNavForDate(spots.silverHistory, iso) : null) ?? spotEurForParty(p, spots);
        if (px == null) px = spotEurForParty(p, spots); // meesman live NAV als fallback
        if (px == null) px = weeklyInterpolatedValue(unitValuations, iso, avgCostPx);
        if (px == null && s.qty > 0) px = avgCostPx;
        const manualTotal = px == null ? weeklyInterpolatedValue(totalValuations, iso, null) : null;
        v = manualTotal ?? ((px || 0) * s.qty);
      }
      byParty[p.id].push(v);
      tot += v; inv += s.cost;
    }
    dates.push(iso); total.push(tot); invested.push(inv);
    iso = addDaysIso(iso, 1);
  }

  return { dates, byParty, total, invested };
}

function buildValueTimeSeries(transactions, parties, spots) {
  const ts = buildPartyTimeSeries(transactions, parties, spots);
  return ts.dates.map((d, i) => ({ date: d, total: ts.total[i], invested: ts.invested[i] }));
}

function calcYTDReturn(timeSeries) {
  if (!timeSeries.length) return { pnl: 0, pnlPct: 0, startValue: 0, currentValue: 0 };
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const current = timeSeries[timeSeries.length - 1];
  // Find value at start of year (or closest date after)
  const startPoint = timeSeries.find(t => t.date >= yearStart) || timeSeries[0];
  const startValue = startPoint.total;
  const currentValue = current.total;
  // Simple absolute return YTD (no cash-flow adjustment for now)
  const pnl = currentValue - startValue;
  const pnlPct = startValue > 0 ? (pnl / startValue) * 100 : 0;
  return { pnl, pnlPct, startValue, currentValue, since: startPoint.date };
}

function buildMonthlyFlows(transactions) {
  const map = new Map();
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    if (!map.has(key)) map.set(key, { month: key, inleg: 0, opname: 0, dividend: 0, kosten: 0, koop: 0, verkoop: 0, fees: 0 });
    const m = map.get(key);
    if (t.type === 'inleg')    m.inleg    += +t.amountEur || 0;
    if (t.type === 'opname')   m.opname   += +t.amountEur || 0;
    if (t.type === 'dividend') {
      // Herbelegging: quantity × unitPriceEur als waarde; valt terug op amountEur voor oud formaat
      const divVal = (t.quantity != null && t.unitPriceEur != null)
        ? (+t.quantity||0) * (+t.unitPriceEur||0)
        : (+t.amountEur||0);
      m.dividend += divVal;
    }
    if (t.type === 'kosten')   m.kosten   += +t.amountEur || 0;
    if (t.type === 'koop' || t.type === 'cashback')
      m.koop += (+t.quantity||0) * (+t.unitPriceEur||0);
    if (t.type === 'verkoop')  m.verkoop  += (+t.quantity||0) * (+t.unitPriceEur||0);
    if (t.feeEur)              m.fees     += +t.feeEur;
  }
  return [...map.values()].sort((a,b) => a.month.localeCompare(b.month));
}

// ===== Formatters =====
function fmtEur(n, opts = {}) {
  const { decimals = 0, sign = false } = opts;
  if (n == null || Number.isNaN(n)) return '—';
  const s = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(n));
  const prefix = sign ? (n > 0 ? '+' : n < 0 ? '−' : '') : (n < 0 ? '−' : '');
  return `${prefix}€\u202f${s}`;
}
function fmtPct(n, opts = {}) {
  const { decimals = 2, sign = true } = opts;
  if (n == null || Number.isNaN(n)) return '—';
  const s = Math.abs(n).toFixed(decimals);
  const prefix = n > 0 && sign ? '+' : n < 0 ? '−' : '';
  return `${prefix}${s}%`;
}
function fmtQty(n, unit, opts = {}) {
  if (n == null) return '—';
  const d = opts.decimals ?? (Math.abs(n) >= 100 ? 1 : 3);
  const s = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
  return unit ? `${s}\u202f${unit}` : s;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });
}

Object.assign(window, {
  PARTIES, TX_TYPES, TX_LABELS,
  DEFAULT_MEESMAN_NAV_EUR, MEESMAN_NAV_SEED_HISTORY, mergePriceHistory, normalizeMeesmanHistory,
  WIDGET_REGISTRY, DEFAULT_WIDGETS,
  OZ_TO_GRAM, silverToOz, goldToGram,
  loadState, saveState, makeId,
  summarizeParty, buildValueTimeSeries, buildPartyTimeSeries, buildMonthlyFlows,
  calcYTDReturn, fmtEur, fmtPct, fmtQty, fmtDate, fmtMonth,
  spotEurForParty, findNavForDate,
});
