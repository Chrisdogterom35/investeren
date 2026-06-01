(() => {
  'use strict';

  const D = window.MAP_DATA;
  const CENTER = [52.310, 5.140];
  const INITIAL_ZOOM = 12;

  // =====================================================
  // Map + base layers
  // =====================================================
  const map = L.map('map', {
    center: CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: 9,
    maxZoom: 18,
    zoomControl: false,
    maxBounds: L.latLngBounds([52.0, 4.5], [52.6, 5.8]),
    maxBoundsViscosity: 0.7,
    zoomAnimation: true,
    fadeAnimation: true,
  });

  const baseLayers = {
    osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Tiles © Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '© OpenTopoMap (CC-BY-SA)'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '© CARTO © OpenStreetMap', subdomains: 'abcd'
    }),
  };
  let currentBase = baseLayers.osm;
  currentBase.addTo(map);

  const seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenSeaMap', opacity: 0.9
  }).addTo(map);

  // =====================================================
  // Fairways (polylines)
  // =====================================================
  const fairwayLayer = L.layerGroup().addTo(map);
  D.FAIRWAYS.forEach(fw => {
    // Casing for depth
    L.polyline(fw.coords, { color: '#ffffff', weight: 9, opacity: 0.6 }).addTo(fairwayLayer);
    const line = L.polyline(fw.coords, {
      color: fw.color, weight: 4, opacity: 0.85, dashArray: '12, 6'
    }).addTo(fairwayLayer);
    line.bindPopup(
      `<div class="popup-title">${escapeHtml(fw.name)}</div>
       <div class="popup-cat">Vaargeul</div>
       <div class="popup-desc">${escapeHtml(fw.desc || '')}</div>`
    );
  });

  // =====================================================
  // Zones (polygons by type)
  // =====================================================
  const zoneLayers = {
    speed:      L.layerGroup().addTo(map),
    nature:     L.layerGroup().addTo(map),
    swim:       L.layerGroup().addTo(map),
    nogo:       L.layerGroup().addTo(map),
    restricted: L.layerGroup().addTo(map),
  };
  D.ZONES.forEach(z => {
    const meta = D.ZONE_META[z.type] || D.ZONE_META.restricted;
    const poly = L.polygon(z.coords, {
      color: meta.color, fillColor: meta.fill, fillOpacity: 0.18,
      weight: 2, dashArray: z.type === 'nogo' ? '6, 4' : null,
    });
    poly.bindPopup(
      `<div class="popup-title">${escapeHtml(z.name)}</div>
       <div class="popup-cat">${meta.label}</div>
       <div class="popup-desc">${escapeHtml(z.desc || '')}</div>`
    );
    poly.addTo(zoneLayers[z.type]);
  });

  // =====================================================
  // Buoys
  // =====================================================
  const buoyLayer = L.layerGroup().addTo(map);
  function buoyIcon(type, id) {
    const showText = (id && id.length <= 4) ? id : '';
    return L.divIcon({
      className: '',
      html: `<div class="m-buoy ${type}">${escapeHtml(showText)}</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }
  D.BUOYS.forEach(b => {
    const meta = D.BUOY_META[b.type] || D.BUOY_META.special;
    const m = L.marker([b.lat, b.lon], { icon: buoyIcon(b.type, b.id) }).addTo(buoyLayer);
    m.bindPopup(
      `<div class="popup-title">
         <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${meta.color};border:1px solid #fff"></span>
         Boei ${escapeHtml(b.id)}
       </div>
       <div class="popup-cat">${meta.label}${b.fairway ? ' · ' + escapeHtml(b.fairway) : ''}</div>
       ${b.desc ? `<div class="popup-desc">${escapeHtml(b.desc)}</div>` : ''}
       <div class="popup-coord">${b.lat.toFixed(4)}°N, ${b.lon.toFixed(4)}°E</div>`
    );
    b._marker = m;
  });

  // =====================================================
  // POIs (per category layer)
  // =====================================================
  const poiLayers = {};
  Object.keys(D.POI_META).forEach(k => poiLayers[k] = L.layerGroup().addTo(map));
  function makePoiIcon(type) {
    const m = D.POI_META[type] || D.POI_META.poi;
    return L.divIcon({
      className: '',
      html: `<div class="m-poi" style="background:${m.color}">${m.icon}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
  D.POIS.forEach(p => {
    const meta = D.POI_META[p.type] || D.POI_META.poi;
    const m = L.marker([p.lat, p.lon], { icon: makePoiIcon(p.type) }).addTo(poiLayers[p.type]);
    const tagsHtml = (p.tags || []).map(t => `<span class="popup-tag">${escapeHtml(t)}</span>`).join('');
    m.bindPopup(
      `<div class="popup-title">${meta.icon} ${escapeHtml(p.name)}</div>
       <div class="popup-cat">${meta.label}</div>
       <div class="popup-desc">${escapeHtml(p.desc || '')}</div>
       ${tagsHtml ? `<div class="popup-tags">${tagsHtml}</div>` : ''}
       <div class="popup-coord">${p.lat.toFixed(4)}°N, ${p.lon.toFixed(4)}°E</div>`
    );
    p._marker = m;
  });

  // =====================================================
  // Waypoints + Route + Measure + Track
  // =====================================================
  const waypointLayer = L.layerGroup().addTo(map);
  const waypoints = [];
  function addWaypoint(latlng, label) {
    const ic = L.divIcon({
      className: '',
      html: '<div class="m-waypoint"></div>',
      iconSize: [22, 22], iconAnchor: [11, 22],
    });
    const m = L.marker(latlng, { icon: ic, draggable: true }).addTo(waypointLayer);
    const idx = waypoints.length;
    const name = label || `WP ${idx + 1}`;
    m.bindPopup(
      `<div class="popup-title">${escapeHtml(name)}</div>
       <div class="popup-coord">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
       <button class="popup-btn" onclick="window._removeWp(${idx})">Verwijder</button>`
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

  let routeLine = null;
  const routePoints = [];
  function updateRoute() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    const live = routePoints.filter(p => p);
    if (live.length < 2) return;
    routeLine = L.polyline(live, { color: '#0d9488', weight: 4, opacity: 0.9, dashArray: '8, 6' }).addTo(map);
    let total = 0;
    for (let i = 1; i < live.length; i++) total += map.distance(live[i-1], live[i]);
    toast(`Route ${(total/1852).toFixed(2)} NM · ${(total/1000).toFixed(2)} km · ${live.length} punten`);
  }

  let measureLine = null;
  let measurePoints = [];
  let measureMarkers = [];
  function clearMeasure() {
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    measureMarkers.forEach(m => map.removeLayer(m));
    measureMarkers = [];
    measurePoints = [];
    $('#measureInfo').classList.remove('show');
  }
  function updateMeasure() {
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    const info = $('#measureInfo');
    if (measurePoints.length >= 2) {
      measureLine = L.polyline(measurePoints, { color: '#0d9488', weight: 4, opacity: 0.95 }).addTo(map);
      let total = 0;
      for (let i = 1; i < measurePoints.length; i++) total += map.distance(measurePoints[i-1], measurePoints[i]);
      const last = measurePoints[measurePoints.length-1];
      const prev = measurePoints[measurePoints.length-2];
      const brg = bearing(prev, last).toFixed(0);
      info.textContent = `${(total/1852).toFixed(2)} NM · ${(total/1000).toFixed(2)} km · ${brg}°`;
      info.classList.add('show');
    } else if (measurePoints.length === 1) {
      info.textContent = 'Tik volgende punt';
      info.classList.add('show');
    }
  }

  let trackingActive = false;
  let trackLine = null;
  const trackPoints = [];

  // =====================================================
  // GPS
  // =====================================================
  let positionMarker = null;
  let positionAccuracy = null;
  let watchId = null;
  let lastPos = null;
  const boatIcon = L.divIcon({
    className: '',
    html: '<div class="m-boat"></div>',
    iconSize: [28, 28], iconAnchor: [14, 14],
  });

  function startGps() {
    if (!navigator.geolocation) { toast('GPS niet ondersteund'); return; }
    if (watchId !== null) return;
    toast('GPS zoeken…');
    watchId = navigator.geolocation.watchPosition(
      onGps,
      (err) => { toast('GPS fout: ' + err.message); stopGps(); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 }
    );
    $('#btnLocate').classList.add('active');
  }
  function stopGps() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    $('#btnLocate').classList.remove('active');
  }
  function onGps(pos) {
    const { latitude, longitude, accuracy, speed, heading } = pos.coords;
    const ll = L.latLng(latitude, longitude);
    if (!positionMarker) {
      positionMarker = L.marker(ll, { icon: boatIcon, zIndexOffset: 1000 }).addTo(map);
      positionAccuracy = L.circle(ll, {
        radius: accuracy, color: '#0d9488', weight: 1, fillColor: '#0d9488', fillOpacity: 0.1
      }).addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 14));
      toast('GPS gevonden');
    } else {
      positionMarker.setLatLng(ll);
      positionAccuracy.setLatLng(ll).setRadius(accuracy);
    }
    if (lastPos) {
      const computed = bearing(lastPos, ll);
      rotateBoat((heading != null && !isNaN(heading)) ? heading : computed);
    }
    lastPos = ll;

    if (speed != null && !isNaN(speed)) {
      $('#hudSpeed').innerHTML = `${(speed * 1.94384).toFixed(1)}<i>kn</i>`;
    }
    if (heading != null && !isNaN(heading)) {
      $('#hudHeading').innerHTML = `${heading.toFixed(0)}<i>°</i>`;
    }
    if (trackingActive) {
      trackPoints.push(ll);
      if (trackPoints.length >= 2) {
        if (trackLine) trackLine.setLatLngs(trackPoints);
        else trackLine = L.polyline(trackPoints, { color: '#10b981', weight: 3, opacity: 0.85 }).addTo(map);
      }
    }
  }
  function rotateBoat(deg) {
    if (!positionMarker) return;
    const el = positionMarker.getElement();
    if (!el) return;
    const inner = el.querySelector('.m-boat');
    if (inner) inner.style.transform = `rotate(${deg}deg)`;
  }

  // =====================================================
  // Helpers
  // =====================================================
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function bearing(a, b) {
    const φ1 = a.lat * Math.PI / 180, φ2 = b.lat * Math.PI / 180;
    const Δλ = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }
  function formatDist(m) {
    if (m < 1000) return `${m.toFixed(0)} m`;
    return `${(m/1000).toFixed(2)} km`;
  }
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // =====================================================
  // Modes (waypoint / measure / route)
  // =====================================================
  let waypointMode = false, measureMode = false, routeMode = false;
  function setMode(mode) {
    waypointMode = mode === 'waypoint';
    measureMode  = mode === 'measure';
    routeMode    = mode === 'route';
    $('#btnWaypoint').classList.toggle('active', waypointMode);
    $('#btnMeasure').classList.toggle('active', measureMode);
    $('#btnRoute').classList.toggle('active', routeMode);
    if (!measureMode) clearMeasure();
  }

  // =====================================================
  // Drawer (layers)
  // =====================================================
  const drawer = $('#drawer');
  const scrim = $('#scrim');
  function openDrawer() {
    drawer.classList.add('open');
    scrim.classList.add('show');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    scrim.classList.remove('show');
  }
  $('#btnLayers').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer;
  scrim.onclick = () => { closeDrawer(); closeSheet(); };

  // Base map selection
  $$('.base-tile').forEach(el => {
    el.onclick = () => {
      const key = el.dataset.base;
      const newLayer = baseLayers[key];
      if (!newLayer || newLayer === currentBase) return;
      map.removeLayer(currentBase);
      newLayer.addTo(map);
      currentBase = newLayer;
      $$('.base-tile').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.body.classList.toggle('dark-map', key === 'dark');
    };
  });

  // Layer toggles
  $$('[data-layer]').forEach(inp => {
    inp.onchange = () => {
      const key = inp.dataset.layer;
      const on = inp.checked;
      if (key === 'seamark')   on ? map.addLayer(seamarkLayer) : map.removeLayer(seamarkLayer);
      else if (key === 'buoys') on ? map.addLayer(buoyLayer) : map.removeLayer(buoyLayer);
      else if (key === 'fairways') on ? map.addLayer(fairwayLayer) : map.removeLayer(fairwayLayer);
      else if (zoneLayers[key]) on ? map.addLayer(zoneLayers[key]) : map.removeLayer(zoneLayers[key]);
    };
  });
  $$('[data-cat]').forEach(inp => {
    inp.onchange = () => {
      const key = inp.dataset.cat;
      if (!poiLayers[key]) return;
      inp.checked ? map.addLayer(poiLayers[key]) : map.removeLayer(poiLayers[key]);
    };
  });

  // VHF list
  const vhfList = $('#vhfList');
  D.VHF.forEach(v => {
    const row = document.createElement('div');
    row.className = 'vhf-item';
    row.innerHTML = `<span class="vhf-name">${escapeHtml(v.name)}</span><span class="vhf-channel">VHF ${escapeHtml(v.channel)}</span>`;
    vhfList.appendChild(row);
  });

  // =====================================================
  // Bottom sheet (locations list)
  // =====================================================
  const sheet = $('#sheet');
  const poiList = $('#poiList');
  let currentFilter = 'all';
  function openSheet() {
    buildPoiList();
    sheet.classList.add('open');
    scrim.classList.add('show');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    scrim.classList.remove('show');
  }
  $('#btnSheet').onclick = openSheet;
  $('#sheetClose').onclick = closeSheet;

  $$('#chips .chip').forEach(c => {
    c.onclick = () => {
      $$('#chips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      currentFilter = c.dataset.filter;
      buildPoiList();
    };
  });

  function buildPoiList() {
    const center = map.getCenter();
    let items = [];
    if (currentFilter === 'all') {
      items = D.POIS.slice().map(p => ({ ...p, _kind: 'poi' }));
    } else if (currentFilter === 'buoy') {
      items = D.BUOYS.slice().map(b => ({
        name: `Boei ${b.id}`,
        desc: (b.desc || '') + (b.fairway ? ` · ${b.fairway}` : ''),
        lat: b.lat, lon: b.lon, type: b.type, _kind: 'buoy', _ref: b,
      }));
    } else {
      items = D.POIS.filter(p => p.type === currentFilter).map(p => ({ ...p, _kind: 'poi' }));
    }
    items.sort((a, b) => map.distance(center, [a.lat, a.lon]) - map.distance(center, [b.lat, b.lon]));

    poiList.innerHTML = '';
    if (items.length === 0) {
      poiList.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">Geen resultaten in deze categorie</div>`;
      return;
    }
    items.forEach(p => {
      const meta = (p._kind === 'buoy')
        ? D.BUOY_META[p.type]
        : (D.POI_META[p.type] || D.POI_META.poi);
      const iconHtml = (p._kind === 'buoy')
        ? `<div class="poi-icon" style="background:${meta.color}">●</div>`
        : `<div class="poi-icon" style="background:${meta.color}">${meta.icon}</div>`;
      const d = map.distance(center, [p.lat, p.lon]);
      const tagsHtml = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      const item = document.createElement('div');
      item.className = 'poi-item';
      item.innerHTML = `
        ${iconHtml}
        <div class="poi-body">
          <div class="poi-name">${escapeHtml(p.name)}</div>
          ${tagsHtml ? `<div class="poi-meta">${tagsHtml}</div>` : ''}
          ${p.desc ? `<div class="poi-desc">${escapeHtml(p.desc)}</div>` : ''}
        </div>
        <div class="poi-dist">${formatDist(d)}</div>`;
      item.onclick = () => {
        closeSheet();
        map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15));
        const ref = p._kind === 'buoy' ? p._ref : p;
        if (ref && ref._marker) setTimeout(() => ref._marker.openPopup(), 320);
      };
      poiList.appendChild(item);
    });
  }

  // =====================================================
  // Search
  // =====================================================
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const searchClear = $('#searchClear');
  let searchIndex = [];
  D.POIS.forEach(p => searchIndex.push({
    name: p.name, desc: p.desc, lat: p.lat, lon: p.lon,
    type: p.type, kind: 'poi', ref: p,
    meta: D.POI_META[p.type] || D.POI_META.poi,
  }));
  D.BUOYS.forEach(b => searchIndex.push({
    name: `Boei ${b.id}`, desc: (b.desc || '') + (b.fairway ? ` · ${b.fairway}` : ''),
    lat: b.lat, lon: b.lon, type: b.type, kind: 'buoy', ref: b,
    meta: D.BUOY_META[b.type],
  }));
  D.FAIRWAYS.forEach(f => searchIndex.push({
    name: f.name, desc: f.desc, lat: f.coords[0][0], lon: f.coords[0][1],
    type: 'fairway', kind: 'fairway', ref: f,
    meta: { color: f.color, icon: '~', label: 'Vaargeul' },
  }));
  D.ZONES.forEach(z => {
    const c = z.coords[0];
    const m = D.ZONE_META[z.type];
    searchIndex.push({
      name: z.name, desc: z.desc, lat: c[0], lon: c[1],
      type: z.type, kind: 'zone', ref: z,
      meta: { color: m.color, icon: '◇', label: m.label },
    });
  });

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('show'); searchResults.innerHTML = ''; return; }
    const matches = searchIndex
      .filter(x => x.name.toLowerCase().includes(q) || (x.desc || '').toLowerCase().includes(q))
      .slice(0, 12);
    searchResults.innerHTML = '';
    if (matches.length === 0) {
      searchResults.innerHTML = `<div style="padding:14px;color:var(--text-muted);font-size:13px;text-align:center">Geen resultaten</div>`;
    } else {
      matches.forEach(m => {
        const row = document.createElement('div');
        row.className = 'search-result';
        row.innerHTML = `
          <div class="sr-icon" style="background:${m.meta.color}">${m.meta.icon || '●'}</div>
          <div class="sr-body">
            <div class="sr-name">${escapeHtml(m.name)}</div>
            <div class="sr-desc">${escapeHtml(m.meta.label)}${m.desc ? ' · ' + escapeHtml(m.desc).slice(0, 60) : ''}</div>
          </div>`;
        row.onclick = () => {
          map.setView([m.lat, m.lon], Math.max(map.getZoom(), 15));
          searchResults.classList.remove('show');
          searchInput.value = '';
          searchClear.style.display = 'none';
          if (m.ref && m.ref._marker) setTimeout(() => m.ref._marker.openPopup(), 320);
        };
        searchResults.appendChild(row);
      });
    }
    searchResults.classList.add('show');
  }
  searchInput.addEventListener('input', (e) => {
    const v = e.target.value;
    searchClear.style.display = v ? 'flex' : 'none';
    runSearch(v);
  });
  searchClear.onclick = () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchResults.classList.remove('show');
    searchInput.focus();
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) searchResults.classList.remove('show');
  });

  // =====================================================
  // Legend
  // =====================================================
  const legend = $('#legend');
  const legendBody = $('#legendBody');
  function buildLegend() {
    let html = '';
    html += `<div class="legend-section">Boeien</div>`;
    Object.entries(D.BUOY_META).forEach(([k, v]) => {
      html += `<div class="legend-row"><div class="swatch round" style="background:${v.color};color:${k.startsWith('cardinal')||k==='special'?'#0f172a':'#fff'}">●</div>${escapeHtml(v.label)}</div>`;
    });
    html += `<div class="legend-section">Zones</div>`;
    Object.entries(D.ZONE_META).forEach(([k, v]) => {
      html += `<div class="legend-row"><div class="swatch zone" style="border-color:${v.color}"></div>${escapeHtml(v.label)}</div>`;
    });
    html += `<div class="legend-section">Lijnen</div>`;
    html += `<div class="legend-row"><div class="swatch line" style="background:#0ea5e9"></div>Vaargeul</div>`;
    html += `<div class="legend-row"><div class="swatch line" style="background:#0d9488"></div>Route / meting</div>`;
    html += `<div class="legend-row"><div class="swatch line" style="background:#10b981"></div>GPS track</div>`;
    legendBody.innerHTML = html;
  }
  buildLegend();
  $('#legendBtn').onclick = () => legend.classList.toggle('show');
  $('#legendClose').onclick = () => legend.classList.remove('show');

  // =====================================================
  // FAB & tool buttons
  // =====================================================
  $('#btnZoomIn').onclick = () => map.zoomIn();
  $('#btnZoomOut').onclick = () => map.zoomOut();
  $('#btnLocate').onclick = () => {
    if (watchId !== null) {
      if (positionMarker) map.setView(positionMarker.getLatLng(), Math.max(map.getZoom(), 15));
      else toast('Wacht op GPS…');
    } else startGps();
  };

  $('#btnWaypoint').onclick = () => {
    if (waypointMode) { setMode(null); return; }
    setMode('waypoint');
    toast('Tik op de kaart om waypoint te plaatsen');
  };
  $('#btnMeasure').onclick = () => {
    if (measureMode) { setMode(null); return; }
    setMode('measure');
    clearMeasure();
    $('#measureInfo').textContent = 'Tik om te beginnen';
    $('#measureInfo').classList.add('show');
  };
  $('#btnRoute').onclick = () => {
    if (routeMode) { setMode(null); return; }
    setMode('route');
    toast('Tik punten om route te bouwen');
  };
  $('#btnTrack').onclick = () => {
    trackingActive = !trackingActive;
    $('#btnTrack').classList.toggle('active', trackingActive);
    if (trackingActive) {
      if (watchId === null) startGps();
      toast('Track opname gestart');
    } else toast('Track gestopt');
  };
  $('#btnClear').onclick = () => {
    waypointLayer.clearLayers();
    waypoints.length = 0;
    routePoints.length = 0;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (trackLine) { map.removeLayer(trackLine); trackLine = null; }
    trackPoints.length = 0;
    clearMeasure();
    setMode(null);
    toast('Alles gewist');
  };

  // Map click
  map.on('click', (e) => {
    if (waypointMode) {
      addWaypoint(e.latlng);
    } else if (measureMode) {
      measurePoints.push(e.latlng);
      const dot = L.circleMarker(e.latlng, {
        radius: 5, color: '#0d9488', fillColor: '#0d9488', fillOpacity: 1, weight: 2
      }).addTo(map);
      measureMarkers.push(dot);
      updateMeasure();
    } else if (routeMode) {
      routePoints.push(e.latlng);
      addWaypoint(e.latlng, `RP ${routePoints.length}`);
      updateRoute();
    }
  });

  // HUD zoom updates
  map.on('zoomend moveend', () => {
    $('#hudZoom').textContent = map.getZoom();
  });
  $('#hudZoom').textContent = map.getZoom();

  // Welcome
  setTimeout(() => toast('Welkom aan boord — tik op Locaties'), 800);
})();
