// ============================================================
//  MICRO STORE — jembatan antara logika imperatif (main.js) dan
//  UI React/MUI. Tanpa dependensi; komponen React membaca state
//  via useSyncExternalStore (hook didefinisikan di uiRoot.jsx).
// ============================================================

const initialState = {
  // kontrol peta/route
  appMode: 'draw', // app mode aktif: 'import' (upload GPX) | 'draw' (klik peta)
  gpxFileName: null, // nama file GPX terakhir yang diimpor
  mode: 'run',
  snapToRoad: true,
  locked: false,
  hasPoints: false,

  // statistik sidebar
  distanceKm: '0.00',
  pointsCount: 0,
  gain: null,
  loss: null,
  estimate: '–',
  estimateCaption: 'pada pace default',

  // profil elevasi (string path siap-gambar, hasil ui.js)
  elevRange: '',
  elevPathD: '',
  elevAreaD: '',
  elevColor: '#3b7dd8',

  // basemap aktif: 'maplibre' | 'osm' | 'thunderforest'
  basemap: 'maplibre',

  // toast/snackbar
  toast: null, // { text }

  // progress export PDF
  pdfProgress: null, // { percent, label }

  // dialog nama file PDF
  pdfNameDialog: null, // { value, defaultName }
};

let state = initialState;
const listeners = new Set();

export function getAppState() {
  return state;
}

export function appSet(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeApp(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- Registry aksi; diisi oleh main.js saat boot ----
export const actions = {};

export function registerActions(map) {
  Object.assign(actions, map);
}
