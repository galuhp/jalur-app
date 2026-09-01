// ============================================================
//  IMPORT GPX
//  Parser ringan tanpa dependensi: mengekstrak titik lintasan
//  dari <trkpt> (prioritas), <rtept>, atau <wpt>. Aman terhadap
//  urutan atribut, kutip tunggal/ganda, dan xmlns.
// ============================================================

function scanPoints(xml, tag) {
  const pts = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>)`, 'gi');
  const latRe = /lat\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
  const lonRe = /lon\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] || '';
    const lm = attrs.match(latRe);
    const om = attrs.match(lonRe);
    if (!lm || !om) continue;
    const lat = parseFloat(lm[1] ?? lm[2]);
    const lng = parseFloat(om[1] ?? om[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    pts.push({ lng, lat });
  }
  return pts;
}

/**
 * Parse isi file GPX menjadi daftar titik [{lng, lat}].
 * Melempar Error bila tidak ada titik valid ditemukan.
 */
export function parseGpxText(xml) {
  if (!xml || xml.indexOf('<gpx') === -1) {
    throw new Error('Bukan file GPX (elemen <gpx> tidak ditemukan).');
  }
  // Prioritas: track points → route points → waypoints terpisah
  let pts = scanPoints(xml, 'trkpt');
  if (!pts.length) pts = scanPoints(xml, 'rtept');
  if (!pts.length) pts = scanPoints(xml, 'wpt');
  if (!pts.length) {
    throw new Error('GPX tidak berisi titik lintasan (trkpt/rtept/wpt).');
  }
  return pts;
}

/** Bungkus async pembacaan File dengan proteksi ukuran */
export async function readGpxFile(file, maxBytes = 10 * 1024 * 1024) {
  if (file.size > maxBytes) {
    throw new Error(`File terlalu besar (${(file.size / 1048576).toFixed(1)} MB). Maksimal 10 MB.`);
  }
  return file.text();
}