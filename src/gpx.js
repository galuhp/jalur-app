// Bangun string GPX 1.1 dari koordinat rute.
// Elevasi hanya dilampirkan bila jumlah sampel elevasi
// sama dengan jumlah titik rute (satu-e-ke-satu).
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildGpx(coords, elevations, mode) {
  const pts = coords || [];
  const hasEle = Array.isArray(elevations) && elevations.length === pts.length;
  const modeNames = { run: 'Lari', bike: 'Sepeda', hike: 'Hiking' };
  const name = `Rute ${modeNames[mode] || mode || 'Jalur'} — Jalur`;

  const trkpts = pts
    .map((p, i) => {
      const lat = p.lat.toFixed(6);
      const lon = p.lng.toFixed(6);
      const ele = hasEle && Number.isFinite(elevations[i]) ? `<ele>${elevations[i].toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${lat}" lon="${lon}">${ele}</trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Jalur — Perencana Rute" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${xmlEscape(name)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${xmlEscape(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

// Picu unduhan file .gpx di browser
export function downloadGpx(coords, elevations, mode) {
  const gpx = buildGpx(coords, elevations, mode);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jalur-rute.gpx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}