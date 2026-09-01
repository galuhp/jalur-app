import maplibregl from 'maplibre-gl';
import './style.css';
import './uiRoot.jsx';
import { STYLES, BASEMAP_CONFIG } from './basemaps.js';
import { appSet, registerActions, getAppState } from './store.js';
import { fetchOSRMRoute, fetchElevation, fetchStraightRoute } from './routing.js';
import { downloadGpx } from './gpx.js';
import { downloadGeotaggedPdf } from './pdfExport.js';
import { parseGpxText, readGpxFile } from './gpxImport.js';
import { samplePoints } from './geo.js';
import {
  modeColor,
  MODE_PACE,
  updateStats,
  updateElevationStats,
  drawElevationChart,
  showToast,
  hideToast,
} from './ui.js';

// ---- App state ----
const state = {
  mode: 'run',
  snapToRoad: true,
  rawPoints: [], // clicked waypoints [{lng,lat}]
  routeCoords: [], // rendered route (snapped or raw) [{lng,lat}]
  elevations: null,
  locked: false,
};

let markers = [];
let mapReady = false;
let redrawRetries = 0;

// ---- Map setup ----
// RapidAPI mengautentikasi via header, bukan query string.
// transformRequest menyisipkan header X-RapidAPI-Key/Host hanya
// untuk request tile ke host RapidAPI yang dikonfigurasi.
function rapidApiTransformRequest(url, resourceType) {
  if (
    BASEMAP_CONFIG.rapidApiHost &&
    BASEMAP_CONFIG.rapidApiKey &&
    (resourceType === 'Tile' || resourceType === 'Source') &&
    (() => {
      try {
        return new URL(url).hostname === BASEMAP_CONFIG.rapidApiHost;
      } catch {
        return false;
      }
    })()
  ) {
    return {
      url,
      headers: {
        'X-RapidAPI-Key': BASEMAP_CONFIG.rapidApiKey,
        'X-RapidAPI-Host': BASEMAP_CONFIG.rapidApiHost,
      },
    };
  }
  return { url };
}

const map = new maplibregl.Map({
  container: 'map',
  style: STYLES.maplibre,
  center: [112.43, -7.55],
  zoom: 12,
  attributionControl: { compact: true },
  transformRequest: rapidApiTransformRequest,
  // Wajib untuk export PDF: tanpa ini buffer WebGL dibersihkan browser
  // setelah tiap frame → tangkapan canvas basemap hasilnya blank.
  preserveDrawingBuffer: true,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

map.on('load', () => {
  mapReady = true;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 }),
      () => {},
      { timeout: 4000 }
    );
  }
});
map.on('error', (e) => console.warn('Map error', e && e.error));

// Layer rute harus ikut terpasang ulang setiap kali style ganti
// (initial load maupun toggle basemap).
map.on('style.load', () => {
  mapReady = true;
  redrawRetries = 0;
  redrawLine();
});

function styleIsReady() {
  return map.isStyleLoaded();
}

function ensureRouteLayer() {
  // Jangan pernah addSource/addLayer saat style belum selesai dimuat,
  // karena itu melempar exception dan layer rute gagal dibuat diam-diam.
  if (!styleIsReady()) return false;
  if (!map.getSource('route')) {
    try {
      map.addSource('route', { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': modeColor(state.mode), 'line-width': 5, 'line-opacity': 0.9 },
      });
    } catch (err) {
      console.warn('[jalur] Gagal membuat layer rute, akan dicoba ulang.', err);
      return false;
    }
  }
  return true;
}
function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

// Coba gambar lagi saat peta benar-benar siap (gaya self-healing),
// dengan batas percobaan agar tidak loop spam saat basemap mati total.
function scheduleRedraw(reason) {
  if (redrawRetries > 25) {
    console.warn('[jalur] Berhenti mencoba menggambar garis: style basemap tidak kunjung siap.');
    return;
  }
  redrawRetries++;
  console.warn(`[jalur] Menunda gambar garis (${reason}) — mencoba lagi…`);
  const retry = () => {
    map.off('idle', retry);
    map.off('style.load', retry);
    clearTimeout(timer);
    redrawLine();
  };
  map.once('idle', retry);
  map.once('style.load', retry);
  const timer = setTimeout(retry, 1000);
}

function redrawLine() {
  if (!ensureRouteLayer()) {
    scheduleRedraw('style basemap belum siap');
    return;
  }
  const coords = (state.routeCoords.length > 1 ? state.routeCoords : state.rawPoints).map((p) => [
    p.lng,
    p.lat,
  ]);
  const fc =
    coords.length > 1
      ? {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }],
        }
      : emptyFC();
  map.getSource('route').setData(fc);
  if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-color', modeColor(state.mode));
  redrawRetries = 0;
}

function redrawMarkers() {
  markers.forEach((m) => m.remove());
  markers = [];
  state.rawPoints.forEach((p, i) => {
    const el = document.createElement('div');
    const bg = i === 0 ? '#1c2a22' : i === state.rawPoints.length - 1 ? modeColor(state.mode) : '#6b7a70';
    el.className = 'waypoint-num';
    el.style.background = bg;
    el.textContent = i + 1;
    const marker = new maplibregl.Marker({ element: el, draggable: !state.locked })
      .setLngLat([p.lng, p.lat])
      .addTo(map);
    if (!state.locked) {
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        state.rawPoints[i] = { lng: ll.lng, lat: ll.lat };
        computeRoute();
      });
    }
    markers.push(marker);
  });
  appSet({ hasPoints: state.rawPoints.length > 0 });
}

async function computeRoute() {
  redrawMarkers();

  if (state.rawPoints.length < 2) {
    state.routeCoords = [];
    state.elevations = null;
    redrawLine();
    updateStats(state);
    updateElevationStats(null);
    drawElevationChart(null, state.mode);
    return;
  }

  redrawLine(); // immediate straight-line feedback
  updateStats(state);

  if (state.snapToRoad) {
    showToast('Menghitung rute…');
    try {
      state.routeCoords = await fetchOSRMRoute(state.rawPoints, state.mode);
    } catch (err) {
      console.warn('OSRM failed, falling back to straight line', err);
      state.routeCoords = state.rawPoints.slice();
    }
    hideToast();
  } else {
    state.routeCoords = state.rawPoints.slice();
  }
  redrawLine();
  updateStats(state);

  showToast('Mengambil data elevasi…');
  try {
    state.elevations = await fetchElevation(state.routeCoords);
  } catch (err) {
    console.warn('Elevation fetch failed', err);
    state.elevations = null;
  }
  hideToast();
  updateElevationStats(state.elevations);
  drawElevationChart(state.elevations, state.mode);
}

// ---- Event wiring ----
map.on('click', (e) => {
  if (state.locked) return;
  state.rawPoints.push({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  computeRoute();
});

// ---- Aksi UI: di-registrasi ke store, dipanggil komponen React/MUI ----
registerActions({
  setMode(m) {
    state.mode = m;
    appSet({ mode: m });
    if (state.rawPoints.length > 1) computeRoute();
    else {
      updateStats(state);
      redrawMarkers();
    }
  },

  undoRoute() {
    if (state.locked) return;
    state.rawPoints.pop();
    computeRoute();
  },

  clearRoute() {
    state.rawPoints = [];
    state.routeCoords = [];
    state.elevations = null;
    state.locked = false;
    appSet({ locked: false });
    redrawMarkers();
    redrawLine();
    updateStats(state);
    drawElevationChart(null, state.mode);
  },

  toggleFinish() {
    if (state.rawPoints.length < 2) {
      alert('Tambahkan minimal 2 titik dulu ya.');
      return;
    }
    state.locked = !state.locked;
    appSet({ locked: state.locked });
    redrawMarkers();
  },

  backToStart() {
    if (!state.rawPoints.length) return;
    const p0 = state.rawPoints[0];
    map.flyTo({ center: [p0.lng, p0.lat], zoom: Math.max(map.getZoom(), 14), speed: 1.2 });
  },

  setBasemap(key) {
    if (!STYLES[key] || key === currentBasemap) return;
    currentBasemap = key;
    appSet({ basemap: key });
    map.setStyle(STYLES[key]);
  },

  requestGpxImport() {
    gpxInput.click();
  },

  applyGpxProfile(profile) {
    const pts = pendingGpxPts;
    pendingGpxPts = null;
    appSet({ gpxDialog: null });
    if (pts && pts.length > 0) {
      finishGpxImport(pts, profile);
    }
  },

  cancelGpxImport() {
    pendingGpxPts = null;
    appSet({ gpxDialog: null });
  },

  dismissToast() {
    appSet({ toast: null });
  },

  exportGpx() {
    if (state.rawPoints.length < 2) {
      alert('Tambahkan minimal 2 titik dulu sebelum export GPX.');
      return;
    }
    const coords = state.routeCoords.length > 1 ? state.routeCoords : state.rawPoints;
    downloadGpx(coords, state.elevations, state.mode);
  },

  exportPdf() {
    (async () => {
      if (state.rawPoints.length < 2) {
        alert('Tambahkan minimal 2 titik dulu sebelum export PDF.');
        return;
      }
      const prevKey = currentBasemap;
      let switched = false;
      let routeHidden = false;
      showToast('Menyiapkan OSM Retina…');
      try {
        if (prevKey !== 'osm') {
          switched = true;
          currentBasemap = 'osm';
          appSet({ basemap: 'osm' });
          map.setStyle(STYLES.osm);
        }
        // Selalu tunggu tile benar-benar selesai (juga saat basemap sudah
        // OSM) — kalau tidak, tangkapan bisa dapat peta yang masih kosong.
        await waitForMapIdle(20000);
        showToast('Menyusun PDF…');
        // Sembunyikan layer rute GL (warna mode — biru untuk lari). Kalau tidak,
        // garis 5px itu ikut tertangkap di frame dan tampak seperti border biru
        // mengelilingi garis oranye hasil overlay 2D pada PDF.
        if (map.getLayer('route-line')) {
          map.setLayoutProperty('route-line', 'visibility', 'none');
          routeHidden = true;
        }
        const coords = state.routeCoords.length > 1 ? state.routeCoords : state.rawPoints;
        await downloadGeotaggedPdf({
          map,
          mode: state.mode,
          color: modeColor(state.mode),
          transformRequest: rapidApiTransformRequest,
          routeCoords: coords,
          waypoints: state.rawPoints,
          elevations: state.elevations,
          speedKph: MODE_PACE[state.mode],
        });
      } catch (err) {
        console.warn('[pdf] Export gagal', err);
        alert('Gagal membuat PDF: ' + (err && err.message ? err.message : err));
      } finally {
        if (routeHidden && map.getLayer('route-line')) {
          map.setLayoutProperty('route-line', 'visibility', 'visible');
          routeHidden = false;
        }
        if (switched) {
          currentBasemap = prevKey || 'maplibre';
          appSet({ basemap: currentBasemap });
          map.setStyle(STYLES[currentBasemap]);
        }
        hideToast();
      }
    })();
  },
});

// ---- Import GPX ----
const gpxInput = document.getElementById('gpx-file-input');
let pendingGpxPts = null;

// Fit bounds ke seluruh titik dengan padding nyaman
function fitToRoute(points) {
  if (!points.length) return;
  let minX = points[0].lng, minY = points[0].lat, maxX = points[0].lng, maxY = points[0].lat;
  points.forEach((p) => {
    if (p.lng < minX) minX = p.lng;
    if (p.lat < minY) minY = p.lat;
    if (p.lng > maxX) maxX = p.lng;
    if (p.lat > maxY) maxY = p.lat;
  });
  try {
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: 60, maxZoom: 16, duration: 900 }
    );
  } catch (_) {}
}

async function finishGpxImport(gpxPts, gpxMode) {
  // Anchor visual/editable merata sepanjang lintasan (maks 80),
  // tidak dipakai untuk geometri saat mode "asis".
  const anchors = samplePoints(gpxPts, Math.min(80, gpxPts.length));
  state.rawPoints = anchors;
  state.routeCoords = [];
  state.elevations = null;
  state.locked = false;
  appSet({ locked: false });
  redrawMarkers();

  // ---- Bentuk rute sesuai pilihan user ----
  showToast(gpxMode === 'asis' ? 'Memakai jalur GPX apa adanya…' : 'Menyusun ulang rute…');
  try {
    if (gpxMode === 'asis') {
      // Tanpa routing server: geometri track asli dipertahankan utuh.
      state.routeCoords = fetchStraightRoute(gpxPts);
    } else {
      const profile = gpxMode === 'drive' ? 'driving' : gpxMode; // foot | bike
      state.routeCoords = await fetchOSRMRoute(anchors, state.mode, profile);
    }
  } catch (err) {
    console.warn('[gpx] Routing gagal, memakai geometri asli', err);
    state.routeCoords = fetchStraightRoute(gpxPts);
  }
  hideToast();
  redrawLine();
  updateStats(state);
  fitToRoute(state.routeCoords.length > 1 ? state.routeCoords : anchors);

  // Elevasi tetap di-refresh untuk statistik/PDF
  showToast('Mengambil data elevasi…');
  try {
    state.elevations = await fetchElevation(state.routeCoords.length > 1 ? state.routeCoords : anchors);
  } catch (err) {
    console.warn('Elevation fetch failed', err);
    state.elevations = null;
  }
  hideToast();
  updateElevationStats(state.elevations);
  drawElevationChart(state.elevations, state.mode);
}

gpxInput.addEventListener('change', async () => {
  const file = gpxInput.files && gpxInput.files[0];
  gpxInput.value = ''; // agar file yang sama bisa dipilih ulang
  if (!file) return;
  try {
    showToast('Membaca GPX…');
    const text = await readGpxFile(file);
    const pts = parseGpxText(text);
    if (pts.length < 2) {
      hideToast();
      alert('GPX berisi kurang dari 2 titik.');
      return;
    }
    pendingGpxPts = pts;
    // Buka dialog pilihan profil (dirender React/MUI MapOverlays)
    appSet({ gpxDialog: { fileName: file.name, pointCount: pts.length } });
  } catch (err) {
    hideToast();
    alert('Gagal mengimpor GPX: ' + (err && err.message ? err.message : err));
  } finally {
    hideToast();
  }
});

// Tunggu peta benar-benar selesai render (termasuk semua tile) — dipakai
// saat mengganti style untuk capture PDF.
function waitForMapIdle(timeoutMs = 20000) {
  return new Promise((resolve) => {
    if (map.isStyleLoaded() && (!map.areTilesLoaded || map.areTilesLoaded())) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off('idle', finish);
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(finish, timeoutMs);
    map.on('idle', finish);
  });
}

// Basemap aktif saat boot (default: maplibre). Di-sinkron via aksi setBasemap.
let currentBasemap = 'maplibre';

updateStats(state);
