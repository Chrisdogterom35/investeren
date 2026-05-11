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
  { id: 'finst-paxg',  name: 'Pax Gold',       category: 'Crypto',   subtitle: 'PAXG via Finst',          color: 'oklch(76% 0.14 85)',  unit: 'crypto', unitLabel: 'PAXG',  goal: 1500, spotKey: 'paxgSpotEur' },
  { id: 'finst-top25', name: 'Top 25 Bundel',  category: 'Crypto',   subtitle: 'Top 25 tokens via Finst', color: 'oklch(62% 0.15 195)', unit: 'bundle', unitLabel: '€',     goal: 1000 },
  { id: 'goldrepublic', name: 'Goldrepublic',  category: 'Edelmetaal',   subtitle: 'Goud & zilver in kluis',   color: 'oklch(78% 0.14 85)',  unit: 'mixed', unitLabel: 'g/oz',  goal: 5000, isMixed: true },
  { id: 'trading212',   name: 'Trading 212',   category: 'Broker',       subtitle: "Aandelen & ETF's",         color: 'oklch(55% 0.16 145)', unit: 'part',  unitLabel: 'stuks', goal: 5000 },
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

// Meesman transacties geïmporteerd vanuit Excel (Book2.xlsx)
// Normaal = gewone rekening · Pensioen = pensioenrekening (zelfde fonds, apart genoteerd)
const SEED_TX = [
  { party:'meesman', type:'koop', date:'2025-01-12', quantity:6.705,  unitPriceEur:88.2833, feeEur:1.48, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-01-13', quantity:1.1246, unitPriceEur:88.6971, feeEur:0.25, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-01-17', quantity:0.5522, unitPriceEur:90.3218, feeEur:0.12, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-01-24', quantity:1.1049, unitPriceEur:90.2836, feeEur:0.25, note:'Pensioen' },
  { party:'meesman', type:'koop', date:'2025-02-07', quantity:1.0914, unitPriceEur:91.3943, feeEur:0.25, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-02-07', quantity:1.0914, unitPriceEur:91.3943, feeEur:0.25, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-02-07', quantity:1.6371, unitPriceEur:91.3943, feeEur:0.37, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-02-14', quantity:2.4535, unitPriceEur:91.4765, feeEur:0.56, note:'Pensioen' },
  { party:'meesman', type:'koop', date:'2025-02-14', quantity:8.1783, unitPriceEur:91.4765, feeEur:1.87, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-03-07', quantity:1.1741, unitPriceEur:84.9613, feeEur:0.25, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-03-28', quantity:1.2007, unitPriceEur:83.0794, feeEur:0.25, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-05-09', quantity:1.5744, unitPriceEur:81.6632, feeEur:0.32, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-05-09', quantity:2.4430, unitPriceEur:81.6632, feeEur:0.50, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-05-09', quantity:1.3436, unitPriceEur:81.6632, feeEur:0.27, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-06-05', quantity:0.5926, unitPriceEur:84.1696, feeEur:0.12, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-06-05', quantity:2.3702, unitPriceEur:84.1696, feeEur:0.50, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-06-13', quantity:2.9775, unitPriceEur:83.7559, feeEur:0.62, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-06-23', quantity:2.9697, unitPriceEur:83.9741, feeEur:0.62, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-06-27', quantity:2.3476, unitPriceEur:84.9795, feeEur:0.50, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-07-07', quantity:0.8671, unitPriceEur:85.3903, feeEur:0.19, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-08-01', quantity:4.3108, unitPriceEur:86.4645, feeEur:0.93, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-08-01', quantity:2.3073, unitPriceEur:86.4645, feeEur:0.50, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-08-08', quantity:4.5415, unitPriceEur:87.9118, feeEur:1.00, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-08-11', quantity:0.4703, unitPriceEur:87.1998, feeEur:0.00, note:'Normaal — geen kosten' },
  { party:'meesman', type:'koop', date:'2025-08-11', quantity:0.0383, unitPriceEur:87.1998, feeEur:0.00, note:'Pensioen — geen kosten' },
  { party:'meesman', type:'koop', date:'2025-08-29', quantity:6.5211, unitPriceEur:87.9546, feeEur:1.43, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2025-09-26', quantity:3.3131, unitPriceEur:90.3241, feeEur:0.75, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2026-01-16', quantity:0.7690, unitPriceEur:97.2780, feeEur:0.19, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2026-01-30', quantity:8.7653, unitPriceEur:95.2517, feeEur:2.09, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2026-02-24', quantity:1.8653, unitPriceEur:96.9905, feeEur:0.45, note:'Normaal' },
  { party:'meesman', type:'koop', date:'2026-03-02', quantity:3.5791, unitPriceEur:97.5442, feeEur:0.87, note:'Normaal' },
];

// ===== GoldRepublic zilver-transacties (uit maandafschriften) =====
// silverUnit:'gram' → intern opgeslagen als oz via silverToOz()
// unitPriceEur = transactiewaarde / volume (€/gram)
// feeEur = fee + handling costs (volledig)
const GR_SEED_TX = [
  // ── 2025 ──
  { party:'goldrepublic', type:'koop',    date:'2025-05-01', quantity:52.530, unitPriceEur:0.9381, feeEur:0.72, metalType:'zilver', silverUnit:'gram', note:'Spaarplan zilver mei 2025' },
  { party:'goldrepublic', type:'koop',    date:'2025-06-02', quantity:51.109, unitPriceEur:0.9644, feeEur:0.71, metalType:'zilver', silverUnit:'gram', note:'Spaarplan zilver jun 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-06-16', amountEur:0.04,  note:'Opslagkosten mei 2025' },
  { party:'goldrepublic', type:'koop',    date:'2025-07-11', quantity:47.211, unitPriceEur:1.0598, feeEur:0.92, metalType:'zilver', silverUnit:'gram', note:'Market order jul 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-07-15', amountEur:0.10,  note:'Opslagkosten jun 2025' },
  { party:'goldrepublic', type:'koop',    date:'2025-07-30', quantity:45.906, unitPriceEur:1.0891, feeEur:0.91, metalType:'zilver', silverUnit:'gram', note:'Market order jul 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-08-15', amountEur:0.13,  note:'Opslagkosten jul 2025' },
  { party:'goldrepublic', type:'koop',    date:'2025-08-25', quantity:44.777, unitPriceEur:1.0966, feeEur:0.90, metalType:'zilver', silverUnit:'gram', note:'Market order aug 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-09-15', amountEur:0.22,  note:'Opslagkosten aug 2025' },
  { party:'goldrepublic', type:'koop',    date:'2025-09-24', quantity:39.661, unitPriceEur:1.2390, feeEur:0.86, metalType:'zilver', silverUnit:'gram', note:'Market order sep 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-10-15', amountEur:0.29,  note:'Opslagkosten sep 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-11-17', amountEur:0.40,  note:'Opslagkosten okt 2025' },
  { party:'goldrepublic', type:'kosten',  date:'2025-12-15', amountEur:0.40,  note:'Opslagkosten nov 2025' },
  // ── 2026 ──
  { party:'goldrepublic', type:'kosten',  date:'2026-01-16', amountEur:0.52,  note:'Opslagkosten dec 2025' },
  { party:'goldrepublic', type:'verkoop', date:'2026-01-26', quantity:281.194, unitPriceEur:2.9625, feeEur:8.33, metalType:'zilver', silverUnit:'gram', note:'Verkoop volledig zilver' },
  { party:'goldrepublic', type:'kosten',  date:'2026-02-16', amountEur:0.56,  note:'Opslagkosten jan 2026' },
  { party:'goldrepublic', type:'koop',    date:'2026-03-02', quantity:36.884, unitPriceEur:2.6752, feeEur:1.32, metalType:'zilver', silverUnit:'gram', note:'Market order mrt 2026' },
  { party:'goldrepublic', type:'koop',    date:'2026-03-24', quantity:49.362, unitPriceEur:1.9967, feeEur:1.43, metalType:'zilver', silverUnit:'gram', note:'Market order mrt 2026' },
  { party:'goldrepublic', type:'kosten',  date:'2026-04-15', amountEur:0.11,  note:'Opslagkosten mrt 2026' },
  { party:'goldrepublic', type:'koop',    date:'2026-04-26', quantity:46.101, unitPriceEur:2.1388, feeEur:1.40, metalType:'zilver', silverUnit:'gram', note:'Market order apr 2026' },
];

const MEESMAN_NAV_SEED_HISTORY = [
  ...SEED_TX.map(t => ({ date: t.date, nav: +(+t.unitPriceEur).toFixed(4) })),
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
      if (!parsed.customParties) parsed.customParties = [];
      if (!parsed.hiddenParties) parsed.hiddenParties = [];
      if (!parsed.tileMetrics)   parsed.tileMetrics   = {};
      // Migration: voeg GoldRepublic-transacties toe als ze nog niet bestaan
      const hasGR = parsed.transactions.some(t => t.party === 'goldrepublic');
      if (!hasGR) {
        const grTxs = GR_SEED_TX.map((t, i) => ({ id: makeId() + 'gr' + i, ...t }));
        parsed.transactions = [...parsed.transactions, ...grTxs];
      }
      // Migration: Meesman NAV verhuisd van tweaks naar state
      if (parsed.meesmanNavEur == null) {
        parsed.meesmanNavEur = (window.TWEAKS && window.TWEAKS.meesmanNavEur) || 100.4;
      }
      if (!parsed.meesmanNavHistory || !parsed.meesmanNavHistory.length) {
        const twHist = window.TWEAKS && window.TWEAKS.meesmanNavHistory;
        parsed.meesmanNavHistory = (twHist && twHist.length) ? twHist
          : MEESMAN_NAV_SEED_HISTORY;
      }
      const normalizedMeesman = normalizeMeesmanHistory(parsed.meesmanNavHistory);
      parsed.meesmanNavHistory = normalizedMeesman.history;
      parsed.meesmanNavEur = normalizedMeesman.currentNav;
      return parsed;
    }
  } catch (e) {}
  return {
    transactions: [
      ...SEED_TX.map((t, i) => ({ id: makeId() + i, ...t })),
      ...GR_SEED_TX.map((t, i) => ({ id: makeId() + 'gr' + i, ...t })),
    ],
    widgets:            DEFAULT_WIDGETS.map(w => ({ ...w })),
    customParties:      [],
    hiddenParties:      [],
    tileMetrics:        {},
    meesmanNavEur:      DEFAULT_MEESMAN_NAV_EUR,
    meesmanNavHistory:  MEESMAN_NAV_SEED_HISTORY,
  };
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
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

// Valuation for a party — tracks goud/zilver quantities separately for goldrepublic.
function summarizeParty(party, transactions, spots) {
  const txs = transactions
    .filter(t => t.party === party.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  let quantity = 0;
  let goldQty = 0;   // for goldrepublic
  let silverQty = 0; // for goldrepublic
  let costBasis = 0;
  let lastUnitPrice = null;
  let lastTotalValue = null;
  let lastValuationDate = null;
  let totalDividend = 0, totalFees = 0, totalIncome = 0;
  let totalCashback = 0;
  let netCashIn = 0;

  for (const t of txs) {
    // Transactiekosten tellen mee in costBasis (echte netto-investering)
    if (t.feeEur) { totalFees += +t.feeEur; costBasis += +t.feeEur; }

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
        }
        break;
      case 'koop':
      case 'cashback': {
        const qty = +t.quantity || 0;
        const px  = +t.unitPriceEur || 0;
        if (party.isMixed) {
          const mt = t.metalType || 'goud';
          if (mt === 'goud') goldQty += goldToGram(qty, t.goldUnit);
          else silverQty += silverToOz(qty, t.silverUnit);
        } else {
          quantity += qty;
        }
        costBasis += qty * px;
        if (t.type === 'cashback') totalCashback += qty * px;
        break;
      }
      case 'verkoop': {
        const qty = +t.quantity || 0;
        const avgPx = (party.isMixed ? (goldQty + silverQty) : quantity) > 0 ? costBasis / ((party.isMixed ? (goldQty + silverQty) : quantity)) : 0;
        costBasis = Math.max(0, costBasis - qty * avgPx);
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
  const pnl = currentValueEur - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return {
    party, transactions: txs,
    quantity,
    goldQty:   party.isMixed ? goldQty   : undefined,
    silverQty: party.isMixed ? silverQty : undefined,
    costBasis, avgCost,
    currentUnitPrice, currentValueEur,
    invested: costBasis,
    lastValuationDate,
    totalDividend, totalFees, totalIncome,
    totalCashback, netCashIn,
    pnl, pnlPct,
  };
}

// Per-allocation daily value time series.
function buildPartyTimeSeries(transactions, parties, spots) {
  if (!transactions.length) return { dates: [], byParty: {}, total: [], invested: [] };
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const state = {};
  for (const p of parties) state[p.id] = { qty: 0, goldQty: 0, silverQty: 0, cost: 0, lastUnitPx: null, lastTotal: null };

  const dates = [];
  const byParty = Object.fromEntries(parties.map(p => [p.id, []]));
  const total = []; const invested = [];

  const start = new Date(sorted[0].date); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(0,0,0,0);
  let ti = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    while (ti < sorted.length && sorted[ti].date <= iso) {
      const t = sorted[ti]; const s = state[t.party]; if (!s) { ti++; continue; }
      const p = parties.find(x => x.id === t.party);
      if (t.feeEur) s.cost += +t.feeEur; // fees tellen mee in investering
      switch (t.type) {
        case 'inleg':
          if (p.unit === 'eur' || p.unit === 'bundle') { s.qty += +t.amountEur||0; s.cost += +t.amountEur||0; }
          break;
        case 'opname':
          if (p.unit === 'eur' || p.unit === 'bundle') {
            const amt = +t.amountEur||0;
            if (s.qty > 0) s.cost = Math.max(0, s.cost - (s.cost * (amt / s.qty)));
            s.qty = Math.max(0, s.qty - amt);
          }
          break;
        case 'koop': case 'cashback':
          if (p.isMixed) {
            const mt = t.metalType || 'goud';
            if (mt === 'goud') s.goldQty += goldToGram(+t.quantity||0, t.goldUnit);
            else s.silverQty += silverToOz(+t.quantity||0, t.silverUnit);
          } else {
            s.qty += +t.quantity||0;
          }
          s.cost += (+t.quantity||0) * (+t.unitPriceEur||0);
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
          const totQty = p.isMixed ? s.goldQty + s.silverQty : s.qty;
          const avg = totQty > 0 ? s.cost / totQty : 0;
          s.cost = Math.max(0, s.cost - qty * avg);
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
      let v;
      if (p.isMixed) {
        const goldPx = (spots.goldHistory?.length ? findNavForDate(spots.goldHistory, iso) : null) ?? (spots.goldSpotEurPerGram||0);
        const silvPx = (spots.silverHistory?.length ? findNavForDate(spots.silverHistory, iso) : null) ?? (spots.silverSpotEurPerOunce||0);
        v = s.goldQty * goldPx + s.silverQty * silvPx;
      } else if (p.unit === 'crypto') {
        const histKey = CRYPTO_HIST_KEY[p.spotKey];
        const histPx = histKey && spots[histKey]?.length ? findNavForDate(spots[histKey], iso) : null;
        v = s.qty * (histPx ?? spots[p.spotKey] ?? 0);
      } else if (p.unit === 'bundle') {
        // Tijdelijk: toon ingelegd bedrag; winst wordt na de loop lineair verspreid
        v = s.cost;
      } else if (p.unit === 'eur') {
        v = s.lastTotal ?? s.qty;
      } else {
        let px = s.lastUnitPx;
        // Meesman: gebruik historische NAV indien beschikbaar
        if (p.id === 'meesman' && spots.meesmanNavHistory?.length) {
          const histNav = findNavForDate(spots.meesmanNavHistory, iso);
          if (histNav != null) px = histNav;
        }
        if (px == null && p.unit === 'gram')  px = (spots.goldHistory?.length   ? findNavForDate(spots.goldHistory,   iso) : null) ?? spotEurForParty(p, spots);
        if (px == null && p.unit === 'ounce') px = (spots.silverHistory?.length ? findNavForDate(spots.silverHistory, iso) : null) ?? spotEurForParty(p, spots);
        if (px == null) px = spotEurForParty(p, spots); // meesman live NAV als fallback
        if (px == null && s.qty > 0) px = s.cost / s.qty;
        v = (px || 0) * s.qty;
      }
      byParty[p.id].push(v);
      tot += v; inv += s.cost;
    }
    dates.push(iso); total.push(tot); invested.push(inv);
    cur.setDate(cur.getDate() + 1);
  }
  // Bundle-partijen: verspreid winst/verlies lineair over de gehele periode
  for (const p of parties) {
    if (p.unit !== 'bundle') continue;
    const s = state[p.id];
    if (s.lastTotal == null) continue; // nog geen herwaardering → toon alleen inleg
    const vals = byParty[p.id];
    const n = vals.length;
    if (n < 2) continue;
    const finalCost = vals[n - 1]; // cumulatief ingelegd op laatste dag
    const gain = s.lastTotal - finalCost; // totale winst of verlies
    if (gain === 0) continue;
    for (let i = 0; i < n; i++) {
      const delta = gain * (i / (n - 1));
      vals[i]  += delta;
      total[i] += delta; // pas portfolio-totaal ook aan
    }
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
  PARTIES, TX_TYPES, TX_LABELS, SEED_TX, GR_SEED_TX,
  DEFAULT_MEESMAN_NAV_EUR, MEESMAN_NAV_SEED_HISTORY, mergePriceHistory, normalizeMeesmanHistory,
  WIDGET_REGISTRY, DEFAULT_WIDGETS,
  OZ_TO_GRAM, silverToOz, goldToGram,
  loadState, saveState, makeId,
  summarizeParty, buildValueTimeSeries, buildPartyTimeSeries, buildMonthlyFlows,
  calcYTDReturn, fmtEur, fmtPct, fmtQty, fmtDate, fmtMonth,
  spotEurForParty, findNavForDate,
});
