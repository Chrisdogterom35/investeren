# Investeringen

Persoonlijk financieel dashboard (PWA) — portfolio, transacties en pensioen in één overzicht. Live via **GitHub Pages** (auto-deploy vanaf `main`, zie https://cjjdogterom.github.io/investeren/).

## Structuur

| Pad | Wat |
|---|---|
| `index.html` | Hoofdapp (shell, thema's, mobiele nav) |
| `app/*.jsx` | React-modules: `data` (model/berekeningen), `ui` (primitieven), `charts`, `modals`, `dashboard`, `tabs`, `main` (app-root, sync) |
| `preview/` | Design-varianten (Lumina, Terminal, Vault) |
| `zeekaart/` | Losse zeekaart-PWA |
| `api/`, `supabase/` | Koers-updates (Vercel function + Supabase Edge Function) |
| `scripts/build.mjs` | Productie-build (zie hieronder) |
| `*.sql` | Supabase schema & migraties |

## Ontwikkelen

Geen tooling nodig: de pagina's laden `.jsx` rechtstreeks via Babel-standalone in de browser.

```sh
python3 -m http.server 8732   # open http://localhost:8732
```

Bewerk je een `.jsx`-bestand, bump dan de `?v=`-querystring in `index.html` zodat browsers 'm opnieuw ophalen.

**Let op:** de app-modules delen functies/consts via het globale bereik (`Object.assign(window, …)` + top-level declaraties). Houd top-level namen uniek per bestand.

## Productie-build & deploy

Elke push naar `main` draait `.github/workflows/deploy.yml`:

1. `npm ci && npm run build` → `scripts/build.mjs` compileert alle JSX vooraf (Babel), minificeert (esbuild), wisselt React dev-builds om voor production-builds en verwijdert Babel-standalone uit de HTML.
2. De `_site/`-output gaat naar GitHub Pages.

Resultaat: geen in-browser compilatie meer in productie (~7× snellere start). Lokaal testen van de productie-build:

```sh
npm install && npm run build
python3 -m http.server 8733 -d _site
```

## Data & sync

- Portfolio-state synchroniseert via Supabase (configuratie in de app onder ⚙ → Sync).
- Koersen: server-side refresh via Supabase/Vercel, met browser-fallback.
- Trading 212-import loopt via een Supabase Edge Function als CORS-proxy.
