(() => {
  'use strict';

  // ========= Configuratie =========
  const CENTER = [52.310, 5.140];
  const INITIAL_ZOOM = 12;

  // ========= POI's =========
  const POIS = [
    // Havens / Marinas
    { name: "Jachthaven Naarden",         lat: 52.3043, lon: 5.1545, type: "harbor", desc: "Grote jachthaven aan het Gooimeer, met faciliteiten en restaurant." },
    { name: "WSV De Zuidwal",             lat: 52.2998, lon: 5.1490, type: "harbor", desc: "Watersportvereniging Naarderbos, ligplaatsen en helling." },
    { name: "Jachthaven Huizen",          lat: 52.3010, lon: 5.2415, type: "harbor", desc: "Grootste haven aan het Gooimeer, restaurants en winkels." },
    { name: "Old Dutch Marina Huizen",    lat: 52.3026, lon: 5.2316, type: "harbor", desc: "Moderne marina met dieselpomp en hellingen." },
    { name: "Jachthaven Naarderbos",      lat: 52.3050, lon: 5.1750, type: "harbor", desc: "Haven bij Naarderbos golfbaan en restaurant." },
    { name: "Jachthaven Muiden (KNZRV)",  lat: 52.3340, lon: 5.0710, type: "harbor", desc: "Koninklijke Nederlandse Zeil- en Roeivereniging in Muiden." },
    { name: "Stadshaven Muiden",          lat: 52.3318, lon: 5.0700, type: "harbor", desc: "Passantenhaven in historisch Muiden, dicht bij Muiderslot." },
    { name: "Jachthaven De Eendracht",    lat: 52.3325, lon: 5.0680, type: "harbor", desc: "Watersportvereniging in Muiden." },
    { name: "Marina Muiderzand",          lat: 52.3530, lon: 5.1015, type: "harbor", desc: "Grote marina aan IJmeer / Markermeerzijde van Almere." },
    { name: "Jachthaven Almere Haven",    lat: 52.3380, lon: 5.2210, type: "harbor", desc: "Centrumhaven van Almere Haven aan het Gooimeer." },

    // Ankerplaatsen
    { name: "Ankerplaats Stille Kern",    lat: 52.3275, lon: 5.1280, type: "anchor", desc: "Beschutte ankerplaats midden in het Gooimeer." },
    { name: "Ankerplaats Naarderbos",     lat: 52.3110, lon: 5.1700, type: "anchor", desc: "Populaire ankerplaats voor Naarderbos." },
    { name: "Ankerplaats Hollandse Brug", lat: 52.3340, lon: 5.1170, type: "anchor", desc: "Vlak voor de Hollandse Brug, goede ligging bij westenwind." },

    // Bruggen / sluizen
    { name: "Hollandse Brug (A6)",        lat: 52.3370, lon: 5.1085, type: "bridge", desc: "Vaste brug, doorvaarthoogte ca. 12,8 m. A6 Almere-Muiderberg." },
    { name: "Stichtse Brug (A27)",        lat: 52.2865, lon: 5.3105, type: "bridge", desc: "Vaste brug tussen Gooimeer en Eemmeer, A27." },
    { name: "Muider Sluis",               lat: 52.3340, lon: 5.0760, type: "bridge", desc: "Sluis IJmeer ↔ Vecht. Bediening via marifoon kanaal 18." },

    // Brandstof
    { name: "Brandstofsteiger Huizen",    lat: 52.3015, lon: 5.2418, type: "fuel", desc: "Dieselpomp jachthaven Huizen." },
    { name: "Brandstofsteiger Muiderzand", lat: 52.3535, lon: 5.1020, type: "fuel", desc: "Diesel + benzine, Marina Muiderzand." },

    // Bezienswaardig
    { name: "Muiderslot",                 lat: 52.3340, lon: 5.0710, type: "poi", desc: "Middeleeuws kasteel aan de monding van de Vecht." },
    { name: "Vesting Naarden",            lat: 52.2960, lon: 5.1610, type: "poi", desc: "Vestingstad met sterfort, museum en restaurants." },
    { name: "Pampus (forteiland)",        lat: 52.3680, lon: 5.0470, type: "poi", desc: "Forteiland in het IJmeer, veerpont vanuit Muiden." },

    // Strand
    { name: "Strand Naarderbos",          lat: 52.3088, lon: 5.1820, type: "beach", desc: "Zandstrand aan het Gooimeer, populair bij watersporters." },
    { name: "Strand Huizen Sijsjesberg",  lat: 52.3034, lon: 5.2520, type: "beach", desc: "Klein strand bij Huizen." },
    { name: "Strand Almere Haven",        lat: 52.3370, lon: 5.2280, type: "beach", desc: "Stadsstrand Almere Haven." },

    // Gevaarpunten / ondieptes
    { name: "Ondiepte bij Hollandse Brug", lat: 52.3320, lon: 5.1130, type: "danger", desc: "Let op: ondiep buiten de vaargeul ten zuiden van de brug." },
    { name: "Ondiepte Naarder Eng",        lat: 52.3070, lon: 5.1380, type: "danger", desc: "Stenen oever, niet te dicht naderen." },
  ];

  const POI_META = {
    harbor: { icon: "⚓", color: "#0a3d62", label: "Haven" },
    anchor: { icon: "⚓", color: "#876c00", label: "Ankerplaats" },
    bridge: { icon: "🌉", color: "#6b5638", label: "Brug / sluis" },
    fuel:   { icon: "⛽", color: "#8b1e1e", label: "Brandstof" },
    poi:    { icon: "★",  color: "#2d6a3a", label: "Bezienswaardigheid" },
    beach:  { icon: "🏖", color: "#8a6b00", label: "Strand" },
    danger: { icon: "!",  color: "#c0392b", label: "Gevaar" },
  };

  // ========= Map init =========
  const map = L.map('map', {
    center: CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: 9,
    maxZoom: 18,
    zoomControl: false,
    maxBounds: L.latLngBounds([52.0, 4.5], [52.6, 5.8]),
    maxBoundsViscosity: 0.7,
  });

  // ========= Base layers =========
  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles © Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© OpenTopoMap (CC-BY-SA)'
    }),
  };

  const seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenSeaMap',
    opacity: 0.95,
  });

  // Diepte (indicatief, voor visualisatie — NIET voor navigatie)
  const depthLayer = L.layerGroup();
  L.polygon([
    [52.2980, 5.1100],[52.3000, 5.1500],[52.3060, 5.1900],[52.3050, 5.2400],
    [52.3030, 5.2700],[52.2960, 5.2950],[52.2880, 5.3050],[52.2870, 5.2600],
    [52.2920, 5.2100],[52.2910, 5.1700],[52.2940, 5.1300]
  ], { color: '#0a3d62', weight: 1, fillColor: '#a8d5e8', fillOpacity: .25, dashArray: '4,3' })
    .bindPopup('<b>Gooimeer</b><br>Gem. diepte 1–3 m<br><small>Indicatief, niet voor navigatie</small>')
    .addTo(depthLayer);
  L.polygon([
    [52.3290, 5.0700],[52.3500, 5.0500],[52.3700, 5.0500],[52.3850, 5.0700],
    [52.3850, 5.1100],[52.3700, 5.1200],[52.3500, 5.1100],[52.3370, 5.1000]
  ], { color: '#0a3d62', weight: 1, fillColor: '#82c5e0', fillOpacity: .25, dashArray: '4,3' })
    .bindPopup('<b>IJmeer (bij Muiden)</b><br>Gem. diepte 2–4 m<br><small>Indicatief, niet voor navigatie</small>')
    .addTo(depthLayer);

  let currentBase = baseLayers.osm;
  currentBase.addTo(map);
  seamarkLayer.addTo(map);

  // ========= POI layer =========
  const poiLayer = L.layerGroup().addTo(map);

  function makePoiIcon(type) {
    const m = POI_META[type] || POI_META.poi;
    return L.divIcon({
      className: '',
      html: `<div class="marker-poi" style="background:${m.color}">${m.icon}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  POIS.forEach(p => {
    const meta = POI_META[p.type] || POI_META.poi;
    const marker = L.marker([p.lat, p.lon], { icon: makePoiIcon(p.type) }).addTo(poiLayer);
    marker.bindPopup(
      `<div style="min-width:180px">
        <div style="font-weight:700;color:#0a3d62;font-size:14px">${meta.icon} ${escapeHtml(p.name)}</div>
        <div style="font-size:11px;color:#5a7a8e;text-transform:uppercase;letter-spacing:.05em;margin:2px 0 6px">${meta.label}</div>
        <div style="font-size:12px;line-height:1.4;color:#1a1a1a">${escapeHtml(p.desc)}</div>
        <div style="font-size:10px;color:#8a98a4;margin-top:6px;font-variant-numeric:tabular-nums">${p.lat.toFixed(4)}°N, ${p.lon.toFixed(4)}°E</div>
      </div>`
    );
    p._marker = marker;
  });

  // ========= Waypoints =========
  const waypointLayer = L.layerGroup().addTo(map);
  const waypoints = [];

  function addWaypoint(latlng, label) {
    const wpIcon = L.divIcon({
      className: '',
      html: '<div class="marker-waypoint"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
    });
    const m = L.marker(latlng, { icon: wpIcon, draggable: true }).addTo(waypointLayer);
    const idx = waypoints.length + 1;
    const name = label || `WP ${idx}`;
    const wpIndex = waypoints.length;
    m.bindPopup(
      `<b>${escapeHtml(name)}</b><br>${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}
       <br><button onclick="window._removeWp(${wpIndex})"
         style="margin-top:6px;background:#c0392b;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit">
         Verwijder
       </button>`
    );
    m.on('dragend', () => updateRoute());
    waypoints.push({ marker: m, name });
    return m;
  }

  window._removeWp = (i) => {
    if (waypoints[i]) {
      waypointLayer.removeLayer(waypoints[i].marker);
      waypoints[i] = null;
      updateRoute();
    }
  };

  // ========= Route =========
  let routeLine = null;
  let routeMode = false;
  const routePoints = [];

  function updateRoute() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    const live = routePoints.filter(p => p);
    if (live.length >= 2) {
      routeLine = L.polyline(live, {
        color: '#c0392b', weight: 4, opacity: .85, dashArray: '8,6'
      }).addTo(map);
      let total = 0;
      for (let i = 1; i < live.length; i++) total += map.distance(live[i-1], live[i]);
      const nm = (total / 1852).toFixed(2);
      const km = (total / 1000).toFixed(2);
      toast(`Route: ${nm} NM (${km} km), ${live.length} punten`);
    }
  }

  // ========= Measure =========
  let measureMode = false;
  let measureLine = null;
  let measurePoints = [];
  let measureMarkers = [];

  function clearMeasure() {
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    measureMarkers.forEach(m => map.removeLayer(m));
    measureMarkers = [];
    measurePoints = [];
    document.getElementById('measureInfo').classList.remove('show');
  }

  function updateMeasure() {
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    const info = document.getElementById('measureInfo');
    if (measurePoints.length >= 2) {
      measureLine = L.polyline(measurePoints, { color: '#ffce54', weight: 4, opacity: .9 }).addTo(map);
      let total = 0;
      for (let i = 1; i < measurePoints.length; i++) total += map.distance(measurePoints[i-1], measurePoints[i]);
      const nm = (total / 1852).toFixed(2);
      const km = (total / 1000).toFixed(2);
      const last = measurePoints[measurePoints.length - 1];
      const prev = measurePoints[measurePoints.length - 2];
      const brg = bearing(prev, last).toFixed(0);
      info.textContent = `📏 ${nm} NM · ${km} km · ${brg}°`;
      info.classList.add('show');
    } else if (measurePoints.length === 1) {
      info.textContent = `📏 Tik volgende punt`;
      info.classList.add('show');
    }
  }

  // ========= GPS =========
  let positionMarker = null;
  let positionAccuracy = null;
  let watchId = null;
  let lastPos = null;
  let trackingActive = false;
  let trackLine = null;
  const trackPoints = [];

  const boatIcon = L.divIcon({
    className: '',
    html: '<div class="marker-boat"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  function startGps() {
    if (!navigator.geolocation) { toast("GPS niet ondersteund"); return; }
    if (watchId !== null) return;
    toast("GPS zoeken...");
    watchId = navigator.geolocation.watchPosition(
      onGpsUpdate,
      (err) => { toast("GPS fout: " + err.message); stopGps(); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 }
    );
    document.getElementById('btnLocate').classList.add('active');
  }
  function stopGps() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    document.getElementById('btnLocate').classList.remove('active');
  }

  function onGpsUpdate(pos) {
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    const ll = L.latLng(latitude, longitude);

    if (!positionMarker) {
      positionMarker = L.marker(ll, { icon: boatIcon, zIndexOffset: 1000 }).addTo(map);
      positionAccuracy = L.circle(ll, {
        radius: accuracy, color: '#0a3d62', weight: 1,
        fillColor: '#0a3d62', fillOpacity: .1
      }).addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 14));
      toast("GPS gevonden");
    } else {
      positionMarker.setLatLng(ll);
      positionAccuracy.setLatLng(ll).setRadius(accuracy);
    }

    if (lastPos) {
      const computed = bearing(lastPos, ll);
      rotateBoat((heading != null && !isNaN(heading)) ? heading : computed);
    }
    lastPos = ll;

    document.getElementById('hudPos').textContent =
      `${latitude.toFixed(4)}\n${longitude.toFixed(4)}`;
    if (speed != null && !isNaN(speed)) {
      const knots = (speed * 1.94384).toFixed(1);
      document.getElementById('hudSpeed').innerHTML = `${knots}<span class="unit">kn</span>`;
    }
    if (heading != null && !isNaN(heading)) {
      document.getElementById('hudHeading').innerHTML = `${heading.toFixed(0)}<span class="unit">°</span>`;
    }

    if (trackingActive) {
      trackPoints.push(ll);
      if (trackPoints.length >= 2) {
        if (trackLine) trackLine.setLatLngs(trackPoints);
        else trackLine = L.polyline(trackPoints, { color: '#27ae60', weight: 3, opacity: .8 }).addTo(map);
      }
    }
  }

  function rotateBoat(deg) {
    if (!positionMarker) return;
    const el = positionMarker.getElement();
    if (!el) return;
    const inner = el.querySelector('.marker-boat');
    if (inner) inner.style.transform = `rotate(${deg}deg)`;
  }

  // ========= Helpers =========
  function bearing(a, b) {
    const φ1 = a.lat * Math.PI / 180, φ2 = b.lat * Math.PI / 180;
    const Δλ = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function setExclusiveMode(mode) {
    waypointMode = (mode === 'waypoint');
    measureMode  = (mode === 'measure');
    routeMode    = (mode === 'route');
    document.getElementById('btnWaypoint').classList.toggle('active', waypointMode);
    document.getElementById('btnMeasure').classList.toggle('active', measureMode);
    document.getElementById('btnRoute').classList.toggle('active', routeMode);
    if (!measureMode) clearMeasure();
  }

  // ========= Event handlers =========
  document.getElementById('btnZoomIn').onclick  = () => map.zoomIn();
  document.getElementById('btnZoomOut').onclick = () => map.zoomOut();

  document.getElementById('btnLocate').onclick = () => {
    if (watchId !== null) {
      if (positionMarker) map.setView(positionMarker.getLatLng(), Math.max(map.getZoom(), 15));
      else toast("Wacht op GPS...");
    } else {
      startGps();
    }
  };

  // Layer menu
  const layerMenu = document.getElementById('layerMenu');
  document.getElementById('btnLayers').onclick = (e) => {
    e.stopPropagation();
    layerMenu.classList.toggle('show');
  };
  document.addEventListener('click', (e) => {
    if (!layerMenu.contains(e.target) && e.target.closest('#btnLayers') === null) {
      layerMenu.classList.remove('show');
    }
  });

  document.querySelectorAll('[data-base]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const key = el.dataset.base;
      const newLayer = baseLayers[key];
      if (newLayer && newLayer !== currentBase) {
        map.removeLayer(currentBase);
        newLayer.addTo(map);
        currentBase = newLayer;
        document.querySelectorAll('[data-base] input').forEach(i => i.checked = false);
        el.querySelector('input').checked = true;
      }
    };
  });

  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const inp = el.querySelector('input');
      if (e.target.tagName !== 'INPUT') inp.checked = !inp.checked;
      const key = el.dataset.toggle;
      if (key === 'seamark') inp.checked ? map.addLayer(seamarkLayer) : map.removeLayer(seamarkLayer);
      else if (key === 'poi') inp.checked ? map.addLayer(poiLayer) : map.removeLayer(poiLayer);
      else if (key === 'depth') inp.checked ? map.addLayer(depthLayer) : map.removeLayer(depthLayer);
    };
  });

  // POI sheet
  const poiSheet = document.getElementById('poiSheet');
  const poiList = document.getElementById('poiList');
  let currentFilter = 'all';

  function buildPoiList() {
    const center = map.getCenter();
    const filtered = (currentFilter === 'all')
      ? POIS.slice()
      : POIS.filter(p => p.type === currentFilter);
    filtered.sort((a, b) => map.distance(center, [a.lat, a.lon]) - map.distance(center, [b.lat, b.lon]));
    poiList.innerHTML = '';
    if (filtered.length === 0) {
      poiList.innerHTML = '<div style="padding:24px;text-align:center;color:#8a98a4;font-size:13px">Geen locaties in deze categorie</div>';
      return;
    }
    filtered.forEach(p => {
      const meta = POI_META[p.type] || POI_META.poi;
      const d = map.distance(center, [p.lat, p.lon]);
      const dStr = d < 1000 ? `${d.toFixed(0)} m` : `${(d/1000).toFixed(2)} km`;
      const div = document.createElement('div');
      div.className = 'poi-item';
      div.innerHTML = `
        <div class="poi-icon ${p.type}">${meta.icon}</div>
        <div class="poi-body">
          <div class="poi-name">${escapeHtml(p.name)}</div>
          <div class="poi-desc">${escapeHtml(p.desc)}</div>
        </div>
        <div class="poi-dist">${dStr}</div>`;
      div.onclick = () => {
        poiSheet.classList.remove('open');
        map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15));
        if (p._marker) setTimeout(() => p._marker.openPopup(), 320);
      };
      poiList.appendChild(div);
    });
  }

  document.getElementById('btnPoi').onclick = () => {
    buildPoiList();
    poiSheet.classList.add('open');
  };
  document.getElementById('closePoi').onclick = () => poiSheet.classList.remove('open');

  document.querySelectorAll('#poiFilter .chip').forEach(c => {
    c.onclick = () => {
      document.querySelectorAll('#poiFilter .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      currentFilter = c.dataset.filter;
      buildPoiList();
    };
  });

  // Tool buttons
  let waypointMode = false;
  document.getElementById('btnWaypoint').onclick = () => {
    if (waypointMode) { setExclusiveMode(null); return; }
    setExclusiveMode('waypoint');
    toast("Tik op de kaart om een waypoint te plaatsen");
  };
  document.getElementById('btnMeasure').onclick = () => {
    if (measureMode) { setExclusiveMode(null); return; }
    setExclusiveMode('measure');
    clearMeasure();
    document.getElementById('measureInfo').textContent = '📏 Tik op de kaart om te beginnen';
    document.getElementById('measureInfo').classList.add('show');
  };
  document.getElementById('btnRoute').onclick = () => {
    if (routeMode) { setExclusiveMode(null); return; }
    setExclusiveMode('route');
    toast("Tik punten om een route te bouwen");
  };

  const btnTrack = document.getElementById('btnTrack');
  btnTrack.onclick = () => {
    trackingActive = !trackingActive;
    btnTrack.classList.toggle('active', trackingActive);
    if (trackingActive) {
      if (watchId === null) startGps();
      toast("Track opnemen gestart");
    } else {
      toast("Track gestopt");
    }
  };

  document.getElementById('btnClear').onclick = () => {
    waypointLayer.clearLayers();
    waypoints.length = 0;
    routePoints.length = 0;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (trackLine) { map.removeLayer(trackLine); trackLine = null; }
    trackPoints.length = 0;
    clearMeasure();
    setExclusiveMode(null);
    toast("Alles gewist");
  };

  // Map click
  map.on('click', (e) => {
    if (waypointMode) {
      addWaypoint(e.latlng);
    } else if (measureMode) {
      measurePoints.push(e.latlng);
      const dot = L.circleMarker(e.latlng, {
        radius: 5, color: '#ffce54', fillColor: '#ffce54', fillOpacity: 1, weight: 2
      }).addTo(map);
      measureMarkers.push(dot);
      updateMeasure();
    } else if (routeMode) {
      routePoints.push(e.latlng);
      addWaypoint(e.latlng, `RP ${routePoints.length}`);
      updateRoute();
    }
  });

  // Compass: terug naar Gooimeer-centrum
  document.getElementById('compass').onclick = () => {
    map.setView(CENTER, INITIAL_ZOOM);
    toast("Terug naar Gooimeer");
  };

  // HUD updates
  function updateHud() {
    document.getElementById('hudZoom').textContent = map.getZoom();
    if (!positionMarker) {
      const c = map.getCenter();
      document.getElementById('hudPos').textContent =
        `${c.lat.toFixed(4)}\n${c.lng.toFixed(4)}`;
    }
  }
  map.on('zoomend moveend', updateHud);
  updateHud();

  // Welkom
  setTimeout(() => toast("Welkom! Tik op ⚓ Locaties"), 600);
})();
