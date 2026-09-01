import { totalDistanceMeters } from './geo.js';
import { appSet } from './store.js';

export const MODE_COLORS = { run: '#3b7dd8', bike: '#d9622b', hike: '#3b8f5c' };
export const MODE_PACE = { run: 10, bike: 20, hike: 4 }; // km/h, for time estimate

export function modeColor(mode) {
  return MODE_COLORS[mode];
}

function fmtKm(m) {
  return (m / 1000).toFixed(2);
}

export function updateStats({ routeCoords, rawPoints, mode }) {
  const coords = routeCoords.length > 1 ? routeCoords : rawPoints;
  const distKm = fmtKm(totalDistanceMeters(coords));

  const speed = MODE_PACE[mode];
  let estimate = '–';
  let estimateCaption = 'pada pace default';
  const distNum = parseFloat(distKm);
  if (distNum > 0) {
    const totalMin = (distNum / speed) * 60;
    const h = Math.floor(totalMin / 60);
    const m = Math.round(totalMin % 60);
    estimate = `${h > 0 ? h + 'j ' : ''}${m}m`;
    estimateCaption = `pada ${speed} km/j`;
  }

  appSet({
    distanceKm: distKm,
    pointsCount: rawPoints.length,
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
    elevPathD,
    elevAreaD,
    elevColor: modeColor(mode),
  });
}

export function showToast(text) {
  appSet({ toast: { text } });
}

export function hideToast() {
  appSet({ toast: null });
}
