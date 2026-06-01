# Zeekaart Gooimeer · Naarderbos · Muiden

Moderne nautische kaart-app voor Gooimeer, Naarderbos, Muiden en IJmeer.
Apart project — staat los van het Investeren dashboard.

## Openen
Open `index.html` in de browser, of host `zeekaart/` statisch.
Op `/zeekaart` na deploy naar Vercel. Installeerbaar als PWA.

## Features
- 4 basiskaarten: standaard, satelliet, topografisch, donker
- OpenSeaMap overlay (boeien, lichten, havens)
- **Boeien**: laterale rood/groen, kardinale N/E/S/W, veiligvarend water, geïsoleerd gevaar, bijzondere boeien
- **Vaargeulen**: Hoofdvaargeul Gooimeer, IJmeer-geul, Muiderkanaal, Vechtmonding
- **Zones**: snelvaargebieden, natuurgebieden, zwemzones, verboden gebieden
- **Locaties**: havens, ankerplaatsen, bruggen, sluizen, brandstof, stranden, bezienswaardigheden, gevaarpunten
- **VHF-marifoonkanalen** lijst
- Zoekfunctie over alle objecten
- Filterbare locatielijst per categorie
- GPS-positie met SOG/COG en track-opname
- Waypoints (sleepbaar), route met afstandsberekening
- Meten met afstand en peiling
- Legenda

## Bestanden
- `index.html` — markup
- `styles.css` — modern teal-thema, glassmorphism
- `app.js` — Leaflet logica
- `data.js` — POI's, boeien, vaargeulen, zones
- `manifest.webmanifest` — PWA manifest
- `icon.svg` — app-icoon

## Disclaimer
Alle data is indicatief. Niet voor primaire navigatie — raadpleeg officiële kaarten van Vaarweginformatie.nl en Rijkswaterstaat.
