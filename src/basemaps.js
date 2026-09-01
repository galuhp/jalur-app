function rasterStyle(tiles, attribution, maxzoom, tileSize) {
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles,
        tileSize: tileSize || 256,
        attribution,
        maxzoom: maxzoom || 19,
      },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

// ============================================================
//  KONFIGURASI BASEMAP PROVIDER
//  1) Tombol "MapLibre"   → style vektor provider (MapTiler, dll)
//  2) Tombol "OSM"        → tile OSM Retina via RapidAPI (MapTilesApi)
//  3) Tombol "Landscape"  → Thunderforest Landscape
//  Slot yang dikosongkan otomatis fallback ke basemap gratis.
// ============================================================
export const BASEMAP_CONFIG = {
  // --- 1) Style vektor provider (tombol "MapLibre") ---
  apiKey: '', // ← paste API key provider di sini
  baseUrl: '', // ← URL style, sisipkan {key} pada posisi key
  // Contoh: https://api.maptiler.com/maps/streets-v2/style.json?key={key}

  // --- 2) OSM Retina via RapidAPI (tombol "OSM") ---
  // Pola resmi: https://retina-tiles.p.rapidapi.com/local/osm{r}/v1/{z}/{x}/{y}.png
  // ({r} = @2x pada layar retina). Di sini @2x di-hardcode + key via
  // query param sesuai dokumentasi MapTilesApi.
  rapidApiKey: 'bdf7bbb357msh57656d822259d54p17452ejsn4a3b7033d4f3',
  rapidApiHost: 'retina-tiles.p.rapidapi.com',
  osmRetinaTileUrl: 'https://retina-tiles.p.rapidapi.com/local/osm@2x/v1/{z}/{x}/{y}.png?rapidapi-key={key}',

  // --- 3) Thunderforest Landscape (tombol "Landscape") ---
  thunderforestKey: 'd21fbfbae8324ee9815417d37a367cb5',
};

const isProviderConfigured = () => Boolean(BASEMAP_CONFIG.baseUrl && BASEMAP_CONFIG.apiKey);

// OSM Retina aktif bila URL tile terisi DAN key tersedia
// (via placeholder {key} di URL atau header X-RapidAPI-Key)
const isRetinaConfigured = () =>
  Boolean(
    BASEMAP_CONFIG.osmRetinaTileUrl &&
      (BASEMAP_CONFIG.rapidApiKey || BASEMAP_CONFIG.osmRetinaTileUrl.includes('{key}'))
  );

// Peringatkan konfigurasi setengah jadi agar tidak bingung saat peta kosong
if (BASEMAP_CONFIG.baseUrl && !BASEMAP_CONFIG.apiKey) {
  console.warn('[basemaps] baseUrl terisi tapi apiKey kosong — lengkapi BASEMAP_CONFIG di src/basemaps.js');
}
if (!BASEMAP_CONFIG.baseUrl && BASEMAP_CONFIG.apiKey) {
  console.warn('[basemaps] apiKey terisi tapi baseUrl kosong — lengkapi BASEMAP_CONFIG di src/basemaps.js');
}
if (BASEMAP_CONFIG.osmRetinaTileUrl && !BASEMAP_CONFIG.rapidApiHost && !BASEMAP_CONFIG.osmRetinaTileUrl.includes('{key}')) {
  console.warn(
    '[basemaps] osmRetinaTileUrl terisi tanpa rapidApiHost & tanpa {key} di URL — API key tidak akan terkirim. ' +
      'Isi rapidApiHost (key via header) atau sisipkan {key} di URL.'
  );
}
if (BASEMAP_CONFIG.rapidApiKey && !BASEMAP_CONFIG.osmRetinaTileUrl) {
  console.warn('[basemaps] rapidApiKey terisi tapi osmRetinaTileUrl kosong — tombol OSM masih pakai tile OSM gratis.');
}
if (!BASEMAP_CONFIG.thunderforestKey) {
  console.warn('[basemaps] thunderforestKey kosong — tombol Landscape fallback ke tile OSM gratis.');
}

// Ganti placeholder {key} dengan API key (aman walau placeholder tak ada)
function applyKey(template) {
  return template.replace('{key}', encodeURIComponent(BASEMAP_CONFIG.apiKey || BASEMAP_CONFIG.rapidApiKey || ''));
}

const OSM_ATTR = '© OpenStreetMap contributors';

export const STYLES = {
  // Tombol "MapLibre": style vektor provider (jika dikonfigurasi),
  // jika tidak → OpenFreeMap "Liberty" gratis (detail OSM lengkap)
  maplibre: isProviderConfigured()
    ? applyKey(BASEMAP_CONFIG.baseUrl)
    : 'https://tiles.openfreemap.org/styles/liberty',
  // Tombol "OSM": tile retina RapidAPI (jika dikonfigurasi),
  // jika tidak → tile raster OpenStreetMap standar
  osm: isRetinaConfigured()
    ? rasterStyle(
        [applyKey(BASEMAP_CONFIG.osmRetinaTileUrl)],
        'Tiles © Retina Tiles API, Map data © OpenStreetMap contributors',
        19,
        512 // tile retina = 512px per tile
      )
    : rasterStyle(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], OSM_ATTR, 19),
  // Tombol "Landscape": Thunderforest Landscape retina
  // (jika key dikosongkan → fallback tile OSM standar)
  thunderforest: BASEMAP_CONFIG.thunderforestKey
    ? rasterStyle(
        [`https://tile.thunderforest.com/landscape/{z}/{x}/{y}@2x.png?apikey=${BASEMAP_CONFIG.thunderforestKey}`],
        'Maps © Thunderforest, Data © OpenStreetMap contributors',
        19,
        512
      )
    : rasterStyle(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], OSM_ATTR, 19),
};
