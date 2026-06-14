// Supabase Edge Function: server-side proxy voor de Trading 212 API.
//
// WAAROM: Trading 212 staat geen browser-CORS toe en de API-key mag niet in de
// client staan. Deze functie draait server-to-server, leest de key uit het
// secret T212_API_KEY en geeft een geaggregeerd resultaat met CORS-headers terug.
//
// DEPLOY (zonder CLI): Supabase Dashboard -> Edge Functions -> Deploy a new
// function -> Via Editor -> naam "t212-proxy" -> plak deze code -> Deploy.
// Zet daarna het secret: Edge Functions -> Secrets -> T212_API_KEY.
//   - Legacy key (alleen een sleutel)        -> plak de rauwe key.
//   - Nieuwe API (key EN secret)             -> plak "KEY:SECRET" (met dubbele punt).
//
// De client roept dit aan met de publieke anon-key (verify_jwt mag aan blijven).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const T212_KEY = Deno.env.get("T212_API_KEY") ?? "";

// Veiligheidsmarge t.o.v. de 150s wall-clock van het free plan.
const WALL_CLOCK_BUDGET_MS = 135_000;

// Bepaal het Authorization-formaat op basis van wat in het secret staat:
//  - begint met "Basic "/"Bearer "  -> verbatim gebruiken
//  - bevat een ":"                  -> nieuwe API (KEY:SECRET) -> Basic base64
//  - anders                         -> legacy: rauwe key plat in de header
function buildAuthHeader(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^(Basic|Bearer)\s/i.test(v)) return v;
  if (v.includes(":")) return "Basic " + btoa(v);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pagineer een cursor-endpoint uit (T212 history = 6 req/min). Stopt op
// nextPagePath==null, bij de paginalimiet, of bij de wall-clock-deadline.
async function fetchAllPages(
  base: string,
  startPath: string,
  authHeader: string,
  deadlineMs: number,
  perPageDelayMs = 11_000,
  maxPages = 10,
): Promise<{ items: unknown[]; partial: boolean }> {
  const items: unknown[] = [];
  let path: string | null = startPath;
  let page = 0;
  let retries = 0;
  let partial = false;
  while (path && page < maxPages) {
    if (Date.now() > deadlineMs) { partial = true; break; }
    const url = path.startsWith("http") ? path : base + path;
    const res = await fetch(url, { headers: { Authorization: authHeader } });
    if (res.status === 429) {
      if (++retries > 3) throw new Error(`T212 blijft 429 (rate limit) geven op ${url}`);
      await sleep(20_000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`T212 ${res.status} op ${url}: ${body.slice(0, 200)}`);
    }
    retries = 0;
    const data = await res.json().catch(() => null);
    const pageItems = Array.isArray(data) ? data : (data?.items ?? []);
    items.push(...pageItems);
    const next = (data && !Array.isArray(data)) ? (data.nextPagePath ?? null) : null;
    page++;
    if (!next) break;
    if (page >= maxPages) { partial = true; break; }
    path = next;
    await sleep(perPageDelayMs);
  }
  if (path && page >= maxPages) partial = true;
  return { items, partial };
}

// Haal de accountwaarde op: nieuwe /summary, val terug op legacy /cash.
// Beide endpoints delen de account-bucket (1 req / 5s), dus ruim wachten.
async function fetchAccount(base: string, auth: string): Promise<
  { kind: string; data: unknown } | { error: string; status: number } | null
> {
  const r = await fetch(`${base}/equity/account/summary`, { headers: { Authorization: auth } });
  if (r.status === 401) return { error: "401 — ongeldige sleutel of verkeerd auth-formaat. Check het T212_API_KEY secret (legacy = rauwe key, nieuw = KEY:SECRET).", status: 401 };
  if (r.status === 403) return { error: "403 — sleutel mist permissie-scope. Vink bij het aanmaken account/history/portfolio aan.", status: 403 };
  if (r.ok) return { kind: "summary", data: await r.json().catch(() => null) };

  // /summary niet beschikbaar (bv. oudere key → 404) → cash-fallback, zelfde bucket.
  await sleep(5_000);
  const c = await fetch(`${base}/equity/account/cash`, { headers: { Authorization: auth } });
  if (c.status === 401) return { error: "401 — ongeldige sleutel of verkeerd auth-formaat.", status: 401 };
  if (c.status === 403) return { error: "403 — sleutel mist permissie-scope.", status: 403 };
  if (c.ok) return { kind: "cash", data: await c.json().catch(() => null) };
  return { error: `Accountwaarde niet beschikbaar (summary ${r.status}, cash ${c.status})`, status: 502 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = buildAuthHeader(T212_KEY);
    if (!auth) return json({ error: "T212_API_KEY secret ontbreekt in Supabase" }, 500);

    const { mode = "live" } = await req.json().catch(() => ({}));
    const host = mode === "demo" ? "https://demo.trading212.com" : "https://live.trading212.com";
    const base = `${host}/api/v0`;
    const deadline = Date.now() + WALL_CLOCK_BUDGET_MS;

    // 1) Accountwaarde.
    const account = await fetchAccount(base, auth);
    if (account && "error" in account) return json({ error: account.error }, account.status);

    await sleep(5_000); // account-bucket cooldown vóór de history-calls

    // 2) Volledige stortingen-/opnames-historie (de "inleg").
    const tx = await fetchAllPages(base, "/equity/history/transactions?limit=50", auth, deadline);

    return json({ account, transactions: tx.items, partial: tx.partial });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
