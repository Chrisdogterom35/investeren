// ============================================================
// data.js — POI's, boeien, vaargeulen, zones voor Gooimeer e.o.
// Posities zijn benaderend / indicatief — niet voor primaire navigatie.
// ============================================================

window.MAP_DATA = (() => {
  // -------- Locaties (havens, bruggen, etc.) --------
  const POIS = [
    // Havens / Marinas
    { name: "Jachthaven Naarden",          lat: 52.3043, lon: 5.1545, type: "harbor",
      desc: "Grote jachthaven aan het Gooimeer met passantenplaatsen, brandstof, helling en restaurant.",
      tags: ["VHF 31", "diesel", "passanten"] },
    { name: "WSV De Zuidwal",              lat: 52.2998, lon: 5.1490, type: "harbor",
      desc: "Watersportvereniging Naarderbos. Ligplaatsen, helling en clubhuis.",
      tags: ["ligplaatsen", "helling"] },
    { name: "Jachthaven Huizen",           lat: 52.3010, lon: 5.2415, type: "harbor",
      desc: "Grootste haven aan het Gooimeer met diesel, jachtwerf en horeca.",
      tags: ["VHF 31", "diesel", "werf"] },
    { name: "Old Dutch Marina Huizen",     lat: 52.3026, lon: 5.2316, type: "harbor",
      desc: "Moderne marina met dieselpomp, hellingen en passantenplaatsen." },
    { name: "Jachthaven Naarderbos",       lat: 52.3050, lon: 5.1750, type: "harbor",
      desc: "Haven bij Naarderbos golfbaan en strandpaviljoen." },
    { name: "Jachthaven Muiden (KNZRV)",   lat: 52.3340, lon: 5.0710, type: "harbor",
      desc: "Koninklijke Nederlandse Zeil- en Roeivereniging, historische haven in Muiden." },
    { name: "Stadshaven Muiden",           lat: 52.3318, lon: 5.0700, type: "harbor",
      desc: "Passantenhaven aan de Vecht, vlak bij het Muiderslot." },
    { name: "Jachthaven De Eendracht",     lat: 52.3325, lon: 5.0680, type: "harbor",
      desc: "Watersportvereniging in Muiden." },
    { name: "Marina Muiderzand",           lat: 52.3530, lon: 5.1015, type: "harbor",
      desc: "Grote marina aan het IJmeer met alle faciliteiten.",
      tags: ["VHF 31", "diesel", "benzine", "supermarkt"] },
    { name: "Jachthaven Almere Haven",     lat: 52.3380, lon: 5.2210, type: "harbor",
      desc: "Centrumhaven van Almere Haven aan het Gooimeer." },
    { name: "WV Almere-Centrum",           lat: 52.3406, lon: 5.2122, type: "harbor",
      desc: "Watersportvereniging Almere-Centrum, vlak buiten Almere Haven." },

    // Brandstof
    { name: "Brandstof Jachthaven Huizen", lat: 52.3015, lon: 5.2418, type: "fuel",
      desc: "Diesel beschikbaar tijdens openingstijden haven." },
    { name: "Brandstof Marina Muiderzand", lat: 52.3535, lon: 5.1020, type: "fuel",
      desc: "Diesel én benzine. Een van de weinige benzine-punten in de regio." },
    { name: "Brandstof Naarden",           lat: 52.3045, lon: 5.1548, type: "fuel",
      desc: "Diesel jachthaven Naarden." },

    // Bruggen & sluizen
    { name: "Hollandse Brug (A6)",         lat: 52.3370, lon: 5.1085, type: "bridge",
      desc: "Vaste brug, doorvaarthoogte ca. 12,8 m bij NAP. Hoofdverbinding A6 Almere–Muiderberg.",
      tags: ["vast", "12,8 m"] },
    { name: "Stichtse Brug (A27)",         lat: 52.2865, lon: 5.3105, type: "bridge",
      desc: "Vaste brug tussen Gooimeer en Eemmeer, A27. Doorvaarthoogte ca. 13,3 m.",
      tags: ["vast", "13,3 m"] },
    { name: "Muiderbrug (A1)",             lat: 52.3320, lon: 5.0625, type: "bridge",
      desc: "Vaste brug over de Vecht ten zuiden van Muiden, doorvaarthoogte ca. 5,5 m." },
    { name: "Grote Zeesluis Muiden",       lat: 52.3338, lon: 5.0743, type: "lock",
      desc: "Schutsluis tussen IJmeer en Vecht. Bediening op afroep via marifoon kanaal 18.",
      tags: ["VHF 18", "schutten"] },
    { name: "Spoorbrug Muiden",            lat: 52.3287, lon: 5.0635, type: "bridge",
      desc: "Spoorbrug over de Vecht, beperkte hoogte (ca. 3,5 m)." },

    // Ankerplaatsen
    { name: "Ankerplaats Stille Kern",     lat: 52.3275, lon: 5.1280, type: "anchor",
      desc: "Beschutte ankerplek midden in het Gooimeer." },
    { name: "Ankerplaats Naarderbos",      lat: 52.3110, lon: 5.1700, type: "anchor",
      desc: "Populair ankergebied voor Naarderbos, ondiep — let op kiel." },
    { name: "Ankerplaats Hollandse Brug",  lat: 52.3340, lon: 5.1170, type: "anchor",
      desc: "Vlak voor de Hollandse Brug, goede ligging bij westenwind." },
    { name: "Ankerplaats Muiderzand",      lat: 52.3490, lon: 5.0950, type: "anchor",
      desc: "Beschutte ankerplaats ten zuiden van Muiderzand." },

    // Stranden / recreatie
    { name: "Strand Naarderbos",           lat: 52.3088, lon: 5.1820, type: "beach",
      desc: "Zandstrand met paviljoen, populair bij watersporters." },
    { name: "Strand Huizen Sijsjesberg",   lat: 52.3034, lon: 5.2520, type: "beach",
      desc: "Klein strand met grasveld." },
    { name: "Strand Almere Haven",         lat: 52.3370, lon: 5.2280, type: "beach",
      desc: "Stadsstrand van Almere Haven met horeca." },
    { name: "Strand Muiderberg",           lat: 52.3308, lon: 5.0865, type: "beach",
      desc: "Familievriendelijk strand met paviljoen aan het IJmeer." },

    // Bezienswaardigheden
    { name: "Muiderslot",                  lat: 52.3340, lon: 5.0710, type: "poi",
      desc: "Middeleeuws kasteel aan de monding van de Vecht — Rijksmuseum." },
    { name: "Vesting Naarden",             lat: 52.2960, lon: 5.1610, type: "poi",
      desc: "Vestingstad met sterfort, museum en restaurants." },
    { name: "Pampus (Forteiland)",         lat: 52.3680, lon: 5.0470, type: "poi",
      desc: "Forteiland in IJmeer — bereikbaar met eigen boot of veerpont vanuit Muiden." },
    { name: "Naardermeer (natuur)",        lat: 52.2900, lon: 5.0930, type: "poi",
      desc: "Oudste natuurmonument van Nederland. Vaargebied beperkt toegankelijk." },

    // Gevaar / aandacht
    { name: "Ondiepte Hollandse Brug",     lat: 52.3320, lon: 5.1130, type: "danger",
      desc: "Ondiep buiten de vaargeul ten zuiden van de brug — kiel/schroef risico." },
    { name: "Ondiepte Naarder Eng",        lat: 52.3070, lon: 5.1380, type: "danger",
      desc: "Stenen oever, niet te dicht naderen." },
    { name: "Stenen oever Huizermaat",     lat: 52.3055, lon: 5.2240, type: "danger",
      desc: "Stortsteen onder water — minimum 75 m uit de wal." },
  ];

  // -------- Boeien --------
  // type: lateral-port (rood) | lateral-starboard (groen) |
  //       cardinal-n | cardinal-e | cardinal-s | cardinal-w |
  //       safe-water | special | isolated-danger
  const BUOYS = [
    // Gooimeer hoofdvaargeul (GM) — van Hollandse Brug naar Stichtse Brug
    // (genummerd; even = rood/port, oneven = groen/stuurboord, opvarend)
    { id: "GM 2",  lat: 52.3320, lon: 5.1175, type: "lateral-port",       fairway: "Gooimeer", desc: "Rode ton aan de noordzijde van de vaargeul." },
    { id: "GM 1",  lat: 52.3290, lon: 5.1180, type: "lateral-starboard",  fairway: "Gooimeer", desc: "Groene ton aan de zuidzijde." },
    { id: "GM 4",  lat: 52.3280, lon: 5.1380, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 3",  lat: 52.3250, lon: 5.1390, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 6",  lat: 52.3240, lon: 5.1580, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 5",  lat: 52.3210, lon: 5.1590, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 8",  lat: 52.3210, lon: 5.1780, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 7",  lat: 52.3180, lon: 5.1790, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 10", lat: 52.3180, lon: 5.1980, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 9",  lat: 52.3150, lon: 5.1990, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 12", lat: 52.3160, lon: 5.2180, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 11", lat: 52.3130, lon: 5.2190, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 14", lat: 52.3140, lon: 5.2380, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 13", lat: 52.3110, lon: 5.2390, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 16", lat: 52.3110, lon: 5.2580, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 15", lat: 52.3080, lon: 5.2590, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 18", lat: 52.3060, lon: 5.2780, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 17", lat: 52.3030, lon: 5.2790, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 20", lat: 52.3000, lon: 5.2970, type: "lateral-port",       fairway: "Gooimeer" },
    { id: "GM 19", lat: 52.2970, lon: 5.2980, type: "lateral-starboard",  fairway: "Gooimeer" },
    { id: "GM 22", lat: 52.2940, lon: 5.3070, type: "lateral-port",       fairway: "Gooimeer", desc: "Laatste rode ton voor Stichtse Brug." },
    { id: "GM 21", lat: 52.2910, lon: 5.3080, type: "lateral-starboard",  fairway: "Gooimeer" },

    // IJmeer-vaargeul (IJ) — Hollandse Brug naar Pampus / Muiden
    { id: "IJ 2",  lat: 52.3400, lon: 5.0980, type: "lateral-port",       fairway: "IJmeer" },
    { id: "IJ 1",  lat: 52.3370, lon: 5.0990, type: "lateral-starboard",  fairway: "IJmeer" },
    { id: "IJ 4",  lat: 52.3440, lon: 5.0840, type: "lateral-port",       fairway: "IJmeer" },
    { id: "IJ 3",  lat: 52.3410, lon: 5.0850, type: "lateral-starboard",  fairway: "IJmeer" },
    { id: "IJ 6",  lat: 52.3480, lon: 5.0700, type: "lateral-port",       fairway: "IJmeer" },
    { id: "IJ 5",  lat: 52.3450, lon: 5.0710, type: "lateral-starboard",  fairway: "IJmeer" },

    // Muiderkanaal — toegang Muiden
    { id: "MK 2",  lat: 52.3360, lon: 5.0720, type: "lateral-port",       fairway: "Muiderkanaal", desc: "Toegang Grote Zeesluis." },
    { id: "MK 1",  lat: 52.3350, lon: 5.0730, type: "lateral-starboard",  fairway: "Muiderkanaal" },

    // Cardinale tonnen bij gevaren
    { id: "GM-N",  lat: 52.3320, lon: 5.1130, type: "cardinal-n", fairway: "Gooimeer",
      desc: "Noord-kardinaal: passeer ten noorden van deze boei." },
    { id: "PA-E",  lat: 52.3665, lon: 5.0510, type: "cardinal-e", fairway: "IJmeer",
      desc: "Oost-kardinaal bij Pampus — passeer ten oosten." },
    { id: "NRD-W", lat: 52.3070, lon: 5.1340, type: "cardinal-w", fairway: "Gooimeer",
      desc: "West-kardinaal Naarder Eng — passeer ten westen." },

    // Geïsoleerd gevaar
    { id: "ID-HB", lat: 52.3325, lon: 5.1100, type: "isolated-danger", fairway: "Gooimeer",
      desc: "Geïsoleerd gevaar: ondiepte vlak voor de Hollandse Brug." },

    // Veiligvarend water
    { id: "SW-GM", lat: 52.3200, lon: 5.1480, type: "safe-water", fairway: "Gooimeer",
      desc: "Veiligvarend water — vrij rondom passeren." },

    // Bijzondere boeien (gele zones, ski-baan etc.)
    { id: "SK-1", lat: 52.3450, lon: 5.0850, type: "special", fairway: "IJmeer",
      desc: "Markering snelvaargebied IJmeer." },
    { id: "SK-2", lat: 52.3490, lon: 5.0820, type: "special", fairway: "IJmeer",
      desc: "Markering snelvaargebied IJmeer." },
    { id: "ZW-N", lat: 52.3092, lon: 5.1815, type: "special", fairway: "Gooimeer",
      desc: "Markering zwemzone Naarderbos." },
    { id: "ZW-A", lat: 52.3372, lon: 5.2270, type: "special", fairway: "Gooimeer",
      desc: "Markering zwemzone Strand Almere Haven." },
  ];

  // -------- Vaargeulen (polylines) --------
  const FAIRWAYS = [
    { name: "Hoofdvaargeul Gooimeer", color: "#0ea5e9",
      desc: "Hoofdvaargeul van Hollandse Brug naar Stichtse Brug. Gem. diepte 2,5–3,5 m.",
      coords: [
        [52.3360, 5.1090], [52.3310, 5.1180], [52.3265, 5.1390],
        [52.3225, 5.1590], [52.3195, 5.1790], [52.3165, 5.1990],
        [52.3145, 5.2190], [52.3125, 5.2390], [52.3095, 5.2590],
        [52.3045, 5.2790], [52.2985, 5.2980], [52.2930, 5.3090],
        [52.2870, 5.3110],
      ]},
    { name: "IJmeer-vaargeul",        color: "#0ea5e9",
      desc: "Verbinding Hollandse Brug — Pampus — Muiden / Amsterdam.",
      coords: [
        [52.3360, 5.1090], [52.3390, 5.0980], [52.3425, 5.0850],
        [52.3465, 5.0700], [52.3550, 5.0570], [52.3680, 5.0470],
      ]},
    { name: "Muiderkanaal",           color: "#0ea5e9",
      desc: "Korte vaargeul naar Grote Zeesluis Muiden.",
      coords: [
        [52.3460, 5.0700], [52.3400, 5.0720], [52.3360, 5.0735], [52.3338, 5.0743],
      ]},
    { name: "Vechtmonding",           color: "#06b6d4",
      desc: "Vecht tussen Muiden en spoorbrug.",
      coords: [
        [52.3338, 5.0743], [52.3320, 5.0700], [52.3300, 5.0670], [52.3287, 5.0635], [52.3250, 5.0620],
      ]},
  ];

  // -------- Zones (polygons) --------
  // type: speed | restricted | nature | swim | nogo
  const ZONES = [
    // Snelvaargebieden (>20 km/h toegestaan)
    { name: "Snelvaargebied IJmeer", type: "speed",
      desc: "Snelvaren / waterskiën toegestaan. Houd minimaal 50 m van oever en andere boten.",
      coords: [[52.3440, 5.0760],[52.3540, 5.0700],[52.3580, 5.0820],[52.3490, 5.0900],[52.3440, 5.0760]] },
    { name: "Snelvaargebied Gooimeer", type: "speed",
      desc: "Aangewezen ski-/snelvaargebied. Max. snelheid elders 20 km/h.",
      coords: [[52.3200, 5.2100],[52.3240, 5.2200],[52.3200, 5.2280],[52.3160, 5.2180],[52.3200, 5.2100]] },

    // Natuurgebieden / vogelrust
    { name: "Stille Kern (natuur)", type: "nature",
      desc: "Natuurkerngebied — beperkte toegang voor recreatie, niet aanmeren, geen ankering.",
      coords: [[52.3360, 5.1300],[52.3380, 5.1700],[52.3330, 5.1900],[52.3250, 5.1850],[52.3260, 5.1450],[52.3360, 5.1300]] },
    { name: "Vogelrustgebied Eemmond", type: "nature",
      desc: "Vogelrustgebied — niet betreden tijdens broedseizoen (15 mrt – 15 jul).",
      coords: [[52.2850, 5.3200],[52.2900, 5.3320],[52.2830, 5.3380],[52.2790, 5.3260],[52.2850, 5.3200]] },
    { name: "Naardermeer", type: "nature",
      desc: "Oudste natuurreservaat van NL — vaargebied beperkt, alleen via gidsvaartochten.",
      coords: [[52.2820, 5.0830],[52.2960, 5.0900],[52.2980, 5.1080],[52.2860, 5.1130],[52.2790, 5.1000],[52.2820, 5.0830]] },

    // Zwemzones
    { name: "Zwemzone Naarderbos", type: "swim",
      desc: "Officiële zwemzone — geen gemotoriseerd verkeer, vaar buitenom.",
      coords: [[52.3082, 5.1790],[52.3098, 5.1790],[52.3100, 5.1830],[52.3082, 5.1830],[52.3082, 5.1790]] },
    { name: "Zwemzone Almere Haven", type: "swim",
      desc: "Zwemstrand — boten op afstand houden.",
      coords: [[52.3362, 5.2250],[52.3380, 5.2250],[52.3382, 5.2310],[52.3362, 5.2310],[52.3362, 5.2250]] },
    { name: "Zwemzone Muiderberg", type: "swim",
      desc: "Officieel strand — geen vaarverkeer in afgebakend gebied.",
      coords: [[52.3300, 5.0840],[52.3318, 5.0840],[52.3320, 5.0890],[52.3300, 5.0890],[52.3300, 5.0840]] },

    // Verboden vaargebieden
    { name: "Verboden zone Pampus", type: "nogo",
      desc: "Niet-aanmeerzone rond Pampus buiten aanlegsteiger.",
      coords: [[52.3700, 5.0440],[52.3700, 5.0510],[52.3660, 5.0510],[52.3660, 5.0440],[52.3700, 5.0440]] },
  ];

  // -------- Marifoonkanalen --------
  const VHF = [
    { name: "Centrale Meldpost IJsselmeergebied", channel: "1" },
    { name: "Grote Zeesluis Muiden",              channel: "18" },
    { name: "Jachthavens (algemeen)",             channel: "31" },
    { name: "Verkeerspost Amsterdam",             channel: "68" },
    { name: "Noodverkeer / DSC",                  channel: "16" },
  ];

  // Iconen + meta
  const POI_META = {
    harbor:  { icon: "⚓", color: "#0d9488", label: "Haven" },
    anchor:  { icon: "⚓", color: "#f59e0b", label: "Ankerplaats" },
    bridge:  { icon: "🌉", color: "#64748b", label: "Brug" },
    lock:    { icon: "🚪", color: "#475569", label: "Sluis" },
    fuel:    { icon: "⛽", color: "#dc2626", label: "Brandstof" },
    poi:     { icon: "★",  color: "#7c3aed", label: "Bezienswaardigheid" },
    beach:   { icon: "🏖", color: "#eab308", label: "Strand" },
    danger:  { icon: "⚠",  color: "#ef4444", label: "Gevaar" },
  };

  const BUOY_META = {
    "lateral-port":     { color: "#dc2626", label: "Lateraal rood (port)",         shape: "can" },
    "lateral-starboard":{ color: "#16a34a", label: "Lateraal groen (starboard)",   shape: "cone" },
    "cardinal-n":       { color: "#fbbf24", label: "Noord kardinaal",              shape: "cardinal", arrows: "▲▲" },
    "cardinal-e":       { color: "#fbbf24", label: "Oost kardinaal",               shape: "cardinal", arrows: "▲▼" },
    "cardinal-s":       { color: "#fbbf24", label: "Zuid kardinaal",               shape: "cardinal", arrows: "▼▼" },
    "cardinal-w":       { color: "#fbbf24", label: "West kardinaal",               shape: "cardinal", arrows: "▼▲" },
    "safe-water":       { color: "#ef4444", label: "Veiligvarend water",           shape: "sphere" },
    "isolated-danger":  { color: "#0f172a", label: "Geïsoleerd gevaar",            shape: "danger" },
    "special":          { color: "#facc15", label: "Bijzondere ton",               shape: "special" },
  };

  const ZONE_META = {
    speed:      { color: "#a855f7", fill: "#a855f7", label: "Snelvaargebied" },
    nature:     { color: "#16a34a", fill: "#16a34a", label: "Natuurgebied" },
    swim:       { color: "#0ea5e9", fill: "#0ea5e9", label: "Zwemzone" },
    nogo:       { color: "#ef4444", fill: "#ef4444", label: "Verboden gebied" },
    restricted: { color: "#f59e0b", fill: "#f59e0b", label: "Beperkt gebied" },
  };

  return { POIS, BUOYS, FAIRWAYS, ZONES, VHF, POI_META, BUOY_META, ZONE_META };
})();
