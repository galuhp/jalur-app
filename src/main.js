import maplibregl from 'maplibre-gl';
import './style.css';
import './uiRoot.jsx';
import { STYLES, BASEMAP_CONFIG } from './basemaps.js';
import { appSet, registerActions, getAppState } from './store.js';
import { fetchOSRMRoute, fetchElevation, fetchStraightRoute } from './routing.js';
import { downloadGpx, parseGPX, gpxElevations } from './gpx.js';
import { downloadGeotaggedPdf } from './pdfExport.js';
import { parseGpxText, readGpxFile } from './gpxImport.js';
import { samplePoints } from './geo.js';
import {
  modeColor,
  MODE_PACE,
  updateStats,
  updateElevationStats,
  drawElevationChart,
  estimateHike,
  showToast,
  hideToast,
} from './ui.js';

// ---- App state ----
const state = {
  appMode: 'draw', // 'import' = upload GPX | 'draw' = klik peta (default)
  mode: 'run',
  snapToRoad: true,
  rawPoints: [], // clicked waypoints [{lng,lat}]
  routeCoords: [], // rendered route (snapped or raw) [{lng,lat}]
  elevations: null,
  gpxFileName: null, // nama file GPX terakhir yang diimpor (default nama PDF)
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
  // Estimasi ulang begitu elevasi siap (hike → Naismith + Langmuir)
  appSet(estimateHike(state));
}

// ---- Event wiring ----
map.on('click', (e) => {
  // Klik-untuk-tambah-titik hanya aktif di app mode Draw Route.
  if (state.appMode !== 'draw') return;
  if (state.locked) return;
  state.rawPoints.push({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  computeRoute();
});

// ---- Progress bar export PDF (state pdfProgress: { percent, label }) ----
function setPdfProgress(percent, label) {
  const cur = getAppState().pdfProgress;
  const prev = (cur && cur.percent) || 0;
  appSet({
    pdfProgress: {
      // Persen tidak pernah mundur — creep/label lama sebagai jaring pengaman
      percent: Math.max(prev, Math.min(100, Math.round(percent))),
      label: label || (cur && cur.label) || 'Memproses…',
    },
  });
}
function stagePdfProgress(percent, label) {
  stopPdfProgressCreep();
  setPdfProgress(percent, label);
}
let pdfCreepTimer = null;
// Geser bar perlahan (ease-out) menuju `target` selama `ms` — memberi progres
// hidup selama menunggu tile/render yang tidak bisa diukur persis.
function creepPdfProgress(target, ms) {
  stopPdfProgressCreep();
  const start = (getAppState().pdfProgress && getAppState().pdfProgress.percent) || 0;
  const t0 = Date.now();
  pdfCreepTimer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 2);
    setPdfProgress(start + (target - start) * eased);
    if (k >= 1) stopPdfProgressCreep();
  }, 120);
}
function stopPdfProgressCreep() {
  if (pdfCreepTimer) {
    clearInterval(pdfCreepTimer);
    pdfCreepTimer = null;
  }
}

// Stamp tanggal lokal YYYY-MM-DD untuk nama file default
function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bersihkan input user menjadi nama file yang aman (Windows-safe)
function sanitizePdfName(raw) {
  const cleaned = String(raw)
    .replace(/[\\/:*?"<>|]+/g, '-') // karakter ilegal nama file Windows
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') // titik/spasi di akhir dilarang Windows
    .slice(0, 80)
    .trim();
  return cleaned || `jalur-rute-${todayStamp()}`;
}

// ---- Aksi UI: di-registrasi ke store, dipanggil komponen React/MUI ----
registerActions({
  // Ganti app mode (Import GPX ↔ Draw Route). Pilihan mode rute
  // (lari/sepeda/hiking) dan snap TIDAK direset — hanya state rute
  // yang dibersihkan supaya hasil import & gambar manual tidak tercampur.
  setAppMode(m) {
    if (m === state.appMode || (m !== 'import' && m !== 'draw')) return;
    state.appMode = m;
    state.rawPoints = [];
    state.routeCoords = [];
    state.elevations = null;
    state.gpxFileName = null;
    state.locked = false;
    appSet({ appMode: m, locked: false, gpxFileName: null, hasPoints: false });
    redrawMarkers();
    redrawLine();
    updateStats(state);
    updateElevationStats(null);
    drawElevationChart(null, state.mode);
  },

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
    state.gpxFileName = null;
    state.locked = false;
    // hasPoints: false → di mode Import footer aksi langsung tersembunyi
    // kembali setelah Hapus (redrawMarkers di bawah juga men-set nilainya
    // dari rawPoints yang sudah kosong).
    appSet({ locked: false, gpxFileName: null, hasPoints: false });
    redrawMarkers();
    redrawLine();
    updateStats(state);
    updateElevationStats(null);
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
    const p0 = state.rawPoints[0] || state.routeCoords[0]; // fallback: rute hasil import GPX
    if (!p0) return;
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

  dismissToast() {
    appSet({ toast: null });
  },

  exportGpx() {
    // Guard memakai rute yang tampil (juga berlaku untuk hasil import GPX,
    // yang tidak menyimpan rawPoints/waypoint klik).
    const coords = state.routeCoords.length > 1 ? state.routeCoords : state.rawPoints;
    if (coords.length < 2) {
      alert('Impor GPX atau gambar minimal 2 titik dulu sebelum export GPX.');
      return;
    }
    downloadGpx(coords, state.elevations, state.mode);
  },

  exportPdf() {
    if (state.routeCoords.length < 2 && state.rawPoints.length < 2) {
      alert('Impor GPX atau gambar minimal 2 titik dulu sebelum export PDF.');
      return;
    }
    // Default nama file: nama GPX yang diimpor (tanpa ekstensi .gpx),
    // atau jalur-rute-<tanggal> untuk rute yang digambar manual.
    const base = state.gpxFileName
      ? state.gpxFileName.replace(/\.gpx$/i, '')
      : `jalur-rute-${todayStamp()}`;
    appSet({ pdfNameDialog: { value: base, defaultName: base } });
  },

  setPdfName(value) {
    const d = getAppState().pdfNameDialog;
    if (d) appSet({ pdfNameDialog: { ...d, value } });
  },

  cancelPdfName() {
    appSet({ pdfNameDialog: null });
  },

  confirmPdfName() {
    const d = getAppState().pdfNameDialog;
    if (!d) return;
    appSet({ pdfNameDialog: null });
    runPdfExport((d.value || '').trim() || d.defaultName);
  },
});

// Export PDF sebenarnya — dijalankan setelah nama file dikonfirmasi di dialog.
async function runPdfExport(rawName) {
  const base = sanitizePdfName(rawName);
  const fileName = /\.pdf$/i.test(base) ? base : `${base}.pdf`;
  const prevKey = currentBasemap;
  let switched = false;
  let routeHidden = false;
  setPdfProgress(4, 'Menyiapkan basemap OSM…');
  try {
    if (prevKey !== 'osm') {
      switched = true;
      currentBasemap = 'osm';
      appSet({ basemap: 'osm' });
      map.setStyle(STYLES.osm);
    }
    // Selalu tunggu tile benar-benar selesai (juga saat basemap sudah
    // OSM) — kalau tidak, tangkapan bisa dapat peta yang masih kosong.
    creepPdfProgress(15, 20000);
    await waitForMapIdle(20000);
    stagePdfProgress(16, 'Merender basemap HD…');
    creepPdfProgress(68, 45000);
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
      fileName,
      onProgress: (pct, label) => stagePdfProgress(pct, label),
    });
    stagePdfProgress(100, 'Mengunduh…');
  } catch (err) {
    console.warn('[pdf] Export gagal', err);
    alert('Gagal membuat PDF: ' + (err && err.message ? err.message : err));
  } finally {
    stopPdfProgressCreep();
    appSet({ pdfProgress: null });
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
}

// ---- Import GPX ----
const gpxInput = document.getElementById('gpx-file-input');

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
  showToast('Memakai jalur GPX apa adanya…');
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
  // Estimasi ulang begitu elevasi siap (hike → Naismith + Langmuir)
  appSet(estimateHike(state));
}

// ---- Alur import GPX untuk app mode "Import GPX" ----
// Rute dirender apa adanya dari geometri GPX (tanpa waypoint klik yang bisa
// diedit). Jarak dihitung dari titik GPX; elevasi dipakai dari tag <ele>
// bila memadai, selain itu fallback ke Open-Meteo Elevation API.
async function importGpxAsRoute(gpxText, fileName) {
  const pts = parseGPX(gpxText); // [{lat, lng, ele}]
  if (pts.length < 2) {
    hideToast();
    alert('GPX berisi kurang dari 2 titik.');
    return;
  }
  showToast('Memakai jalur GPX apa adanya…');

  // Reset state rute — hasil import tidak boleh bercampur sisa mode draw.
  state.rawPoints = [];
  state.routeCoords = pts.map((p) => ({ lng: p.lng, lat: p.lat }));
  state.elevations = null;
  state.locked = false;
  state.gpxFileName = fileName; // dipakai sebagai default nama file PDF
  appSet({ locked: false, gpxFileName: fileName });

  redrawMarkers(); // kosongkan marker waypoint lama
  redrawLine();
  updateStats({ ...state, pointsCount: pts.length });
  fitToRoute(state.routeCoords);
  appSet({ hasPoints: state.routeCoords.length > 1 });
  hideToast();

  // Elevasi: dari <ele> GPX bila tersedia, kalau tidak → Open-Meteo.
  const gpxEle = gpxElevations(pts);
  if (gpxEle) {
    state.elevations = gpxEle;
  } else {
    showToast('Mengambil data elevasi…');
    try {
      state.elevations = await fetchElevation(state.routeCoords);
    } catch (err) {
      console.warn('Elevation fetch failed', err);
      state.elevations = null;
    }
    hideToast();
  }
  updateElevationStats(state.elevations);
  drawElevationChart(state.elevations, state.mode);
  // Estimasi ulang begitu elevasi siap (hike → Naismith + Langmuir)
  appSet(estimateHike(state));
}

gpxInput.addEventListener('change', async () => {
  const file = gpxInput.files && gpxInput.files[0];
  gpxInput.value = ''; // agar file yang sama bisa dipilih ulang
  if (!file) return;
  try {
    showToast('Membaca GPX…');
    const text = await readGpxFile(file);
    if (state.appMode === 'import') {
      // App mode Import: geometri asli GPX, elevasi dari <ele> bila ada.
      await importGpxAsRoute(text, file.name);
    } else {
      // Alur lama di mode Draw: rute apa adanya + anchor waypoint yang bisa diedit.
      const pts = parseGpxText(text);
      if (pts.length < 2) {
        hideToast();
        alert('GPX berisi kurang dari 2 titik.');
        return;
      }
      state.gpxFileName = file.name; // dipakai sebagai default nama file PDF
      // Selalu pakai jalur GPX apa adanya — tanpa dialog pilihan profil.
      await finishGpxImport(pts, 'asis');
    }
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
