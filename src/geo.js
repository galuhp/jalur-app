export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistanceMeters(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
  return d;
}

// Evenly sample n points along a polyline by cumulative distance.
// Used to keep elevation API requests small regardless of route length.
export function samplePoints(pts, n) {
  if (pts.length <= n) return pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    let idx = cum.findIndex((c) => c >= target);
    if (idx <= 0) idx = 1;
    const segStart = cum[idx - 1];
    const segEnd = cum[idx];
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
    const a = pts[idx - 1];
    const b = pts[idx];
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

// ============================================================
//  Estimasi waktu hiking — Naismith's Rule + koreksi Langmuir (1984)
//  (https://en.wikipedia.org/wiki/Naismith%27s_rule)
//  - Dasar (versi metrik modern): 1 jam per 5 km jarak datar
//    + 30 menit per 300 m elevasi naik.
//  - Langmuir untuk turunan, diklasifikasi per kemiringan segmen:
//      5°–12° → −10 menit per 300 m turun (landai mempercepat),
//      >12°   → +10 menit per 300 m turun (curam memperlambat),
//      <5°    → netral (tidak dikoreksi).
//  Mengembalikan total menit (sudah dikoreksi, floor ≥ estimasi
//  jarak-datar-saja), atau null bila data tidak cukup.
// ============================================================
export function estimateHikingTime({ distanceMeters, routeCoords, elevationSamples }) {
  const eles = Array.isArray(elevationSamples) ? elevationSamples : null;
  if (!eles || eles.length < 2) return null;
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;

  // Pasangkan tiap sampel elevasi dengan titik rutenya. Dua kasus:
  //  1) elevasi 1:1 dengan routeCoords (jalur GPX <ele>, atau Open-Meteo saat
  //     jumlah titik rute ≤ 60 — fetchElevation memakai sampel apa adanya);
  //  2) elevasi hasil samplePoints(routeCoords, 60) seperti di fetchElevation.
  // Bila tidak cocok juga, fallback: asumsi jarak antar sampel seragam.
  let samples = null;
  if (Array.isArray(routeCoords) && routeCoords.length === eles.length) {
    samples = routeCoords;
  } else if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
    const s = samplePoints(routeCoords, 60);
    if (s.length === eles.length) samples = s;
  }
  let segDist;
  if (samples) {
    segDist = (i) => haversine(samples[i], samples[i + 1]);
  } else {
    const uniform = distanceMeters / (eles.length - 1);
    segDist = () => uniform;
  }

  const NAISMITH_KM_PER_HOUR = 5; // 1 jam per 5 km
  const GAIN_MIN_PER_300M = 30; // +30 menit per 300 m naik
  const LANGMUIR_MIN_PER_300M = 10; // ∓10 menit per 300 m turun
  let gainM = 0;
  let gentleDropM = 0; // turunan 5°–12°
  let steepDropM = 0; // turunan >12°
  for (let i = 0; i < eles.length - 1; i++) {
    const diff = eles[i + 1] - eles[i];
    if (diff > 0) {
      gainM += diff;
    } else if (diff < 0) {
      const drop = -diff;
      const slopeDeg = (Math.atan2(drop, Math.max(segDist(i), 1)) * 180) / Math.PI;
      if (slopeDeg >= 5 && slopeDeg <= 12) gentleDropM += drop;
      else if (slopeDeg > 12) steepDropM += drop;
      // slope < 5° → netral
    }
  }

  const distKm = distanceMeters / 1000;
  const baseMin =
    (distKm / NAISMITH_KM_PER_HOUR) * 60 + (gainM / 300) * GAIN_MIN_PER_300M;
  const langmuirMin =
    (steepDropM / 300) * LANGMUIR_MIN_PER_300M -
    (gentleDropM / 300) * LANGMUIR_MIN_PER_300M;
  // Safety: koreksi turunan tidak boleh membuat estimasi lebih kecil
  // dari jarak-datar-saja (dan tentu tidak negatif).
  const flatOnlyMin = (distKm / NAISMITH_KM_PER_HOUR) * 60;
  return Math.max(baseMin + langmuirMin, flatOnlyMin);
}
