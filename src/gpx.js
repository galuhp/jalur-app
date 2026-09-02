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

// ============================================================
//  PARSER GPX (DOMParser bawaan browser — tanpa dependensi)
//  Mengekstrak semua titik lintasan sebagai [{lat, lng, ele}],
//  prioritas <trkpt> → <rtept> → <wpt>. `ele` bernilai null bila
//  tag <ele> tidak ada / tidak valid pada titik tersebut.
// ============================================================
export function parseGPX(fileText) {
  if (!fileText || fileText.indexOf('<gpx') === -1) {
    throw new Error('Bukan file GPX (elemen <gpx> tidak ditemukan).');
  }
  const doc = new DOMParser().parseFromString(fileText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('File GPX tidak dapat dibaca (XML tidak valid).');
  }
  // getElementsByTagName mencocokkan qualified name; fallback ke
  // localName untuk GPX dengan prefix namespace yang tidak lazim.
  const pick = (name) => {
    let els = Array.from(doc.getElementsByTagName(name));
    if (!els.length) {
      els = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === name);
    }
    return els;
  };
  for (const tag of ['trkpt', 'rtept', 'wpt']) {
    const pts = [];
    for (const node of pick(tag)) {
      const lat = parseFloat(node.getAttribute('lat'));
      const lng = parseFloat(node.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      let ele = null;
      const eleEl = Array.from(node.children).find((c) => c.localName === 'ele');
      if (eleEl) {
        const v = parseFloat(eleEl.textContent);
        if (Number.isFinite(v)) ele = v;
      }
      pts.push({ lat, lng, ele });
    }
    if (pts.length) return pts;
  }
  throw new Error('GPX tidak berisi titik lintasan (trkpt/rtept/wpt).');
}

/**
 * Deret elevasi dari hasil parseGPX bila data <ele> memadai
 * (≥ 2 titik dan mencakup ≥ setengah jumlah titik). Titik tanpa
 * <ele> diisi dari tetangga terdekat. Bila tidak memadai,
 * kembalikan null agar pemanggil fallback ke Open-Meteo.
 */
export function gpxElevations(pts) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const raw = pts.map((p) => (Number.isFinite(p && p.ele) ? p.ele : null));
  const count = raw.filter((e) => e != null).length;
  if (count < 2 || count < raw.length / 2) return null;
  const out = raw.slice();
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) last = out[i];
    else if (last != null) out[i] = last;
  }
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] != null) last = out[i];
    else out[i] = last;
  }
  return out.every((e) => e != null) ? out : null;
}