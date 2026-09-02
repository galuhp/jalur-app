import { totalDistanceMeters, estimateHikingTime } from './geo.js';
import { appSet } from './store.js';

export const MODE_COLORS = { run: '#3b7dd8', bike: '#d9622b', hike: '#3b8f5c' };
export const MODE_PACE = { run: 10, bike: 20, hike: 4 }; // km/h, for time estimate

export function modeColor(mode) {
  return MODE_COLORS[mode];
}

function fmtKm(m) {
  return (m / 1000).toFixed(2);
}

function fmtDuration(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${h > 0 ? h + 'j ' : ''}${m}m`;
}

// Estimasi waktu tempuh rute aktif.
// - Mode hike: Naismith + koreksi Langmuir (lihat geo.js) bila data elevasi
//   sudah tersedia; selama elevasi belum di-fetch, fallback pace konstan.
// - Mode run/bike: pace konstan MODE_PACE seperti sebelumnya (tidak berubah).
export function estimateHike({ mode, routeCoords, rawPoints, elevations }) {
  const coords = routeCoords.length > 1 ? routeCoords : rawPoints;
  const distNum = totalDistanceMeters(coords) / 1000;
  const speed = MODE_PACE[mode] || MODE_PACE.run;
  if (distNum <= 0) return { estimate: '–', estimateCaption: 'pada pace default' };
  if (mode === 'hike') {
    const mins = estimateHikingTime({
      distanceMeters: distNum * 1000,
      routeCoords: coords,
      elevationSamples: elevations,
    });
    if (mins != null) {
      return { estimate: fmtDuration(mins), estimateCaption: 'estimasi Naismith' };
    }
  }
  const totalMin = (distNum / speed) * 60;
  return { estimate: fmtDuration(totalMin), estimateCaption: `pada ${speed} km/j` };
}

export function updateStats({ routeCoords, rawPoints, mode, pointsCount, elevations }) {
  const coords = routeCoords.length > 1 ? routeCoords : rawPoints;
  const distKm = fmtKm(totalDistanceMeters(coords));

  const { estimate, estimateCaption } = estimateHike({ mode, routeCoords, rawPoints, elevations });

  appSet({
    distanceKm: distKm,
    // `pointsCount` eksplisit dipakai alur import GPX (jumlah titik GPX),
    // karena rawPoints sengaja kosong di app mode import.
    pointsCount: pointsCount != null ? pointsCount : rawPoints.length,
    estimate,
    estimateCaption,
  });
}

export function updateElevationStats(elevations) {
  if (!elevations || elevations.length < 2) {
    appSet({ gain: null, loss: null });
    return;
  }
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }
  appSet({ gain: Math.round(gain), loss: Math.round(loss) });
}

// Path SVG profil elevasi dihitung di sini; React merender string-nya.
// ViewBox konsisten 300x90 seperti versi lama.
export function drawElevationChart(elevations, mode) {
  if (!elevations || elevations.length < 2) {
    appSet({ elevRange: '', elevPathD: '', elevAreaD: '', elevColor: modeColor(mode) });
    return;
  }
  const w = 300;
  const h = 90;
  const pad = 6;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 1);

  let pathD = '';
  elevations.forEach((e, i) => {
    const x = pad + (i / (elevations.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((e - min) / range) * (h - 2 * pad);
    pathD += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  const areaD = `${pathD}L${w - pad},${h - pad} L${pad},${h - pad} Z`;

  appSet({
    elevRange: `${Math.round(min)}–${Math.round(max)} m`,
    elevPathD: pathD,
    elevAreaD: areaD,
    elevColor: modeColor(mode),
  });
}

export function showToast(text) {
  appSet({ toast: { text } });
}

export function hideToast() {
  appSet({ toast: null });
}
