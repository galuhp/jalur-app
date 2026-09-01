import { samplePoints } from './geo.js';

// ============================================================
//  KONFIGURASI ROUTING PROVIDER
//  Primer : Fast Routing API via RapidAPI (berbasis OSRM).
//           Server ini HANYA menyediakan profil "driving", jadi
//           semua mode (lari/sepeda/hiking) dirutekan sebagai mobil.
//  Cadangan: bila primer gagal (limit/error/jaringan), otomatis
//           memakai OSRM demo publik dengan profil sesuai mode.
// ============================================================
const FAST_ROUTING = {
  key: 'bdf7bbb357msh57656d822259d54p17452ejsn4a3b7033d4f3',
  host: 'fast-routing.p.rapidapi.com',
  profile: 'driving', // satu-satunya profil yang didukung server ini
};

const OSRM_PROFILE = { run: 'foot', bike: 'bike', hike: 'foot' };

let warnedDrivingOnly = false;

async function requestRoute(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Routing HTTP ${res.status}`);
  const data = await res.json();
  if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
    return data.routes[0].geometry.coordinates.map((c) => ({ lng: c[0], lat: c[1] }));
  }
  throw new Error('Routing: rute tidak ditemukan');
}

// Snap a sequence of clicked waypoints to the nearest real road/path.
// Primer: Fast Routing (RapidAPI, profil driving saja).
// `profileOverride` memaksa profil ('driving'|'foot'|'bike') —
// foot/bike langsung ke OSRM demo karena Fast Routing tak mendukungnya.
export async function fetchOSRMRoute(pts, mode, profileOverride) {
  const coordStr = pts.map((p) => `${p.lng},${p.lat}`).join(';');

  if (FAST_ROUTING.key && FAST_ROUTING.host && (!profileOverride || profileOverride === 'driving')) {
    if (!warnedDrivingOnly) {
      warnedDrivingOnly = true;
      console.info(
        '[routing] Fast Routing hanya punya profil "driving" — semua mode dirutekan sebagai mobil.'
      );
    }
    const url = `https://${FAST_ROUTING.host}/route/v1/${FAST_ROUTING.profile}/${coordStr}?overview=full&geometries=geojson&exclude=ferry`;
    try {
      return await requestRoute(url, {
        'X-RapidAPI-Key': FAST_ROUTING.key,
        'X-RapidAPI-Host': FAST_ROUTING.host,
      });
    } catch (err) {
      console.warn('[routing] Fast Routing gagal, mencoba OSRM demo…', err);
    }
  }

  const profile = profileOverride || OSRM_PROFILE[mode] || 'foot';
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;
  return requestRoute(url);
}

// Garis lurus antar titik tanpa server — dipakai mode "apa adanya"
// saat import GPX (geometri track asli dipertahankan).
export function fetchStraightRoute(coords) {
  return coords.map((c) => ({ lng: c.lng, lat: c.lat }));
}

// Fetch elevation (meters) for up to 60 evenly-sampled points along the route.
export async function fetchElevation(coords) {
  if (coords.length < 2) return null;
  const sampled = samplePoints(coords, 60);
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${sampled
    .map((p) => p.lat)
    .join(',')}&longitude=${sampled.map((p) => p.lng).join(',')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Elevation HTTP ${res.status}`);
  const data = await res.json();
  return data && data.elevation ? data.elevation : null;
}
