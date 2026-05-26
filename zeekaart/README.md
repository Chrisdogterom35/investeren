# Zeekaart Gooimeer · Naarderbos · Muiden

Navionics-achtige nautische kaart-app voor het Gooimeer, Naarderbos, Muiden en het IJmeer.

Apart project — los van het Investeren dashboard in deze repo.

## Openen
Open `index.html` direct in een browser, of host de `zeekaart/` map statisch.
Werkt op telefoon en desktop, installeerbaar als PWA via "Toevoegen aan beginscherm".

## Functies
- Standaard / Satelliet / Topo basiskaart, met OpenSeaMap overlay (boeien, lichten, havens)
- POI-laag met havens, ankerplaatsen, bruggen, sluizen, brandstofsteigers, stranden en gevaarpunten in de regio
- Filterbare locatielijst, gesorteerd op afstand vanaf kaartmiddelpunt
- GPS-positie met snelheid (knopen) en koers
- Waypoints plaatsen, sleepbaar en verwijderbaar
- Route-modus: meerdere punten verbinden, totale afstand in NM/km
- Meten-modus: lengte tussen punten + peiling laatste segment
- Track opname (groene lijn van GPS-pad)
- Indicatieve dieptelagen voor Gooimeer en IJmeer

## Bestanden
- `index.html` — markup
- `styles.css` — alle styling
- `app.js` — Leaflet logica, POI's, GPS, tools
- `manifest.webmanifest` — PWA manifest
- `icon.svg` — app-icoon

## Disclaimer
Dieptes en POI-locaties zijn indicatief. Gebruik nooit voor primaire navigatie — raadpleeg officiële kaarten van Vaarweginformatie.nl en Rijkswaterstaat.
