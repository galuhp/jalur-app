// ============================================================
//  EXPORT PDF GEOTAGGED (OGC GeoPDF) — layout A4 portrait
//  Basemap peta: selalu OSM Retina (ditangani main.js sebelum
//  memanggil modul ini). Tanpa profil elevasi.
// ============================================================
import { PDFDocument, StandardFonts, rgb, PDFName, PDFArray, PDFDict, PDFNumber } from 'pdf-lib';
import maplibregl from 'maplibre-gl';
import { totalDistanceMeters } from './geo.js';

// ---- Geometri halaman (pt), satu sumber kebenaran ----
const PW = 595.28; // A4 portrait width
const PH = 841.89; // A4 portrait height
const M = 30; // margin semua sisi
const IW = PW - M * 2; // lebar konten

const C = {
  paper: rgb(0.984, 0.976, 0.949), // #FBF9F2
  ink: rgb(0.11, 0.165, 0.133), // #1C2A22
  subtle: rgb(0.42, 0.478, 0.439), // #6B7A70
  faint: rgb(0.604, 0.639, 0.612), // #9AA39A
  hair: rgb(0.855, 0.827, 0.749), // #DAD3BF
  card: rgb(0.788, 0.753, 0.659), // #C9C0A8
  darkChip: rgb(0.078, 0.09, 0.078),
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// Web-Mercator Y — linear di ruang EPSG:3857 (bukan derajat)
function mercY(latDeg) {
  const r = (Math.max(-85.05112878, Math.min(85.05112878, latDeg)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
// Invers Web-Mercator: ubah koordinat Mercator kembali ke latitude.
function latFromMerc(y) {
  const t = Math.exp(y);
  return (2 * Math.atan(t) - Math.PI / 2) * (180 / Math.PI);
}

export function sumGainLoss(elevations) {
  if (!elevations || elevations.length < 2) return { gain: null, loss: null };
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - elevations[i - 1];
    if (d > 0) gain += d;
    else loss += Math.abs(d);
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

// Tangkap frame WebGL + gambar ulang rute & waypoint di atasnya.
// JPEG kualitas tinggi (tile fotorealistik → file ringan & tajam).
// `dstW/dstH` adalah ukuran (dalam pt) area peta di PDF; kita center-crop
// (able:fill, tanpa stretch) agar rasio gambar map mengikuti area target.
// Deteksi frame "kosong" (tile belum tergambar): salin ke 32x32 lalu cek
// apakah seluruhnya transparan atau satu warna flat tanpa variasi.
function frameIsBlank(src) {
  const s = document.createElement('canvas');
  s.width = s.height = 32;
  const sc = s.getContext('2d');
  sc.drawImage(src, 0, 0, 32, 32);
  const d = sc.getImageData(0, 0, 32, 32).data;
  let minL = 255;
  let maxL = 0;
  let transparent = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) {
      transparent++;
      continue;
    }
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }
  return transparent === 1024 || maxL - minL < 6;
}

// Render frame HD: peta ekspor tersembunyi berukuran presisi ~300 DPI dengan
// cakupan geografis yang sama seperti tampilan utama. Karena canvas jauh lebih
// besar untuk wilayah yang sama, zoom naik otomatis beberapa level → tile yang
// diambil lebih detail → PDF tetap tajam saat di-zoom. Ukuran canvas dibuat
// persis rasio area peta PDF → hasil 1:1 tanpa crop & tanpa upscale.
async function renderHiResFrame(mainMap, dstW, dstH, transformRequest) {
  const pxPerPt = 300 / 72; // target cetak 300 DPI
  let outW = Math.round(dstW * pxPerPt);
  let outH = Math.round(dstH * pxPerPt);
  // Batasi sisi terpanjang agar aman untuk semua GPU/WebGL
  const MAXSIDE = 4096;
  const shrink = Math.min(1, MAXSIDE / Math.max(outW, outH));
  outW = Math.round(outW * shrink);
  outH = Math.round(outH * shrink);

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${outW}px;height:${outH}px;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(host);

  let m = null;
  try {
    const style = mainMap.getStyle();
    // Buang layer rute & sumbernya — garis mode (biru) tidak boleh ikut ke PDF
    if (style.layers) style.layers = style.layers.filter((l) => l.id !== 'route-line');
    if (style.sources && style.sources.route) delete style.sources.route;

    m = new maplibregl.Map({
      container: host,
      style,
      center: mainMap.getCenter(),
      zoom: mainMap.getZoom(),
      bearing: mainMap.getBearing(),
      pitch: mainMap.getPitch(),
      attributionControl: false,
      interactive: false,
      transformRequest,
    });
    // 1 px CSS = 1 px canvas → ukuran output terkontrol penuh
    if (typeof m.setPixelRatio === 'function') m.setPixelRatio(1);

    // Tunggu style siap → terapkan cakupan geografis yang sama
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout menunggu style peta ekspor')), 30000);
      m.once('load', () => {
        clearTimeout(t);
        m.fitBounds(mainMap.getBounds(), { padding: 0, duration: 0, linear: true });
        resolve();
      });
    });

    // Tunggu semua tile pada resolusi baru selesai dimuat
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout menunggu tile HD')), 30000);
      m.once('idle', () => {
        clearTimeout(t);
        resolve();
      });
    });

    // Salin frame (di dalam handler render) — ulangi bila masih kosong
    let src = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      src = await new Promise((resolve) => {
        m.once('render', () => {
          const gl = m.getCanvas();
          const c = document.createElement('canvas');
          c.width = gl.width;
          c.height = gl.height;
          c.getContext('2d').drawImage(gl, 0, 0);
          resolve(c);
        });
        m.triggerRepaint();
      });
      if (!frameIsBlank(src)) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 800));
    }
    return { src, bounds: m.getBounds(), hiRes: true };
  } finally {
    if (m) m.remove();
    host.remove();
  }
}

async function captureComposedMap(map, routeCoords, waypoints, dstW, dstH, exportOpts = {}) {
  // Utamakan render HD via peta ekspor; bila gagal → fallback tangkapan layar.
  let frame = null;
  try {
    frame = await renderHiResFrame(map, dstW, dstH, exportOpts.transformRequest);
  } catch (err) {
    console.warn('[pdf] Render HD gagal, memakai tangkapan layar:', err);
  }
  if (!frame) {
    // Salin frame WebGL ke canvas 2D **di dalam** handler event 'render' —
    // satu-satunya cara aman membaca buffer GL (di luar frame hasil bisa blank).
    // Frame kosong (tile lambat masuk) → diulang beberapa kali sebelum lanjut.
    for (let attempt = 0; attempt < 6; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      frame = await new Promise((resolve) => {
        map.once('render', () => {
          const glCanvas = map.getCanvas();
          const src = document.createElement('canvas');
          src.width = glCanvas.width;
          src.height = glCanvas.height;
          src.getContext('2d').drawImage(glCanvas, 0, 0);
          resolve({ src, bounds: map.getBounds() });
        });
        map.triggerRepaint();
      });
      if (!frameIsBlank(frame.src)) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  const srcW = frame.src.width;
  const srcH = frame.src.height;
  const b = frame.bounds;
  // Output mengikuti resolusi sumber — tidak pernah meng-upscale.
  // Fallback layar: paksa ≥2x agar cetakan tetap tajam di layar non-retina.
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const W = frame.hiRes ? srcW : Math.round(dstW * dpr);
  const H = frame.hiRes ? srcH : Math.round(dstH * dpr);
  const dstAspect = W / H;
  const srcAspect = srcW / srcH;

  // Cover (aspect-fill, tanpa stretch): sumber lebih lebar dari target →
  // potong kiri/kanan; sumber lebih sempit → potong atas/bawah.
  let sx = 0;
  let sy = 0;
  let sw;
  let sh;
  if (srcAspect > dstAspect) {
    sh = srcH;
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
  } else {
    sw = srcW;
    sh = srcW / dstAspect;
    sy = (srcH - sh) / 2;
  }

  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(frame.src, sx, sy, sw, sh, 0, 0, W, H);

  // Wilayah yang benar-benar tergambar setalah crop (untuk lat long mapping).
  const west = b.getWest();
  const east = b.getEast();
  const t0 = sx / srcW;
  const t1 = (sx + sw) / srcW;
  const viewWest = west + (east - west) * t0;
  const viewEast = west + (east - west) * t1;
  const mN = mercY(b.getNorth());
  const mS = mercY(b.getSouth());
  const viewMercTop = mN - (sy / srcH) * (mN - mS);
  const viewMercBot = mN - ((sy + sh) / srcH) * (mN - mS);
  const viewNorth = latFromMerc(viewMercTop);
  const viewSouth = latFromMerc(viewMercBot);
  const dM = viewMercTop - viewMercBot || 1;
  const X = (lng) => ((lng - viewWest) / (viewEast - viewWest)) * W;
  const Y = (lat) => ((viewMercTop - mercY(lat)) / dM) * H;

  // Garis rute: oranye solid, tanpa casing/border putih
  const ROUTE_ORANGE = '#FF7A00';
  const line = routeCoords.length > 1 ? routeCoords : waypoints;
  if (line.length > 1) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Tebal cetak tetap (≈1pt) di segala resolusi output
    ctx.lineWidth = Math.max(1, W / dstW);
    ctx.strokeStyle = ROUTE_ORANGE;
    ctx.beginPath();
    line.forEach((p, i) => (i ? ctx.lineTo(X(p.lng), Y(p.lat)) : ctx.moveTo(X(p.lng), Y(p.lat))));
    ctx.stroke();
  }

  return {
    dataUrl: cvs.toDataURL('image/jpeg', 0.94),
    bounds: { west: viewWest, south: viewSouth, east: viewEast, north: viewNorth },
  };
}
// ============================================================
//  PENYISIPAN GEOREFERENSI OGC GeoPDF
//  /VP → /Measure subtype /GEO, /GPTS = sudut WGS84 halaman.
//  Urutan titik OGC: SW, NW, NE, SE.
// ============================================================
export function attachGeoReference(page, bounds, widthPts, heightPts) {
  const ctx = page.doc.context;
  const geoPairs = [
    [bounds.south, bounds.west],
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
  ];
  const unitPairs = [[0, 0], [0, 1], [1, 1], [1, 0]];
  const pairsArr = (pairs) => {
    const a = PDFArray.withContext(ctx);
    for (const [x, y] of pairs) {
      a.push(PDFNumber.of(x));
      a.push(PDFNumber.of(y));
    }
    return a;
  };
  const measure = PDFDict.withContext(ctx);
  measure.set(PDFName.of('Type'), PDFName.of('Measure'));
  measure.set(PDFName.of('Subtype'), PDFName.of('GEO'));
  measure.set(PDFName.of('GPTS'), pairsArr(geoPairs));
  measure.set(PDFName.of('LPTS'), pairsArr(unitPairs));
  measure.set(PDFName.of('Description'), ctx.obj('WGS84 (EPSG:4326) — dihasilkan jalur-app'));

  const bbox = PDFArray.withContext(ctx);
  bbox.push(PDFNumber.of(0));
  bbox.push(PDFNumber.of(0));
  bbox.push(PDFNumber.of(widthPts));
  bbox.push(PDFNumber.of(heightPts));

  const vp = PDFDict.withContext(ctx);
  vp.set(PDFName.of('Type'), PDFName.of('VP'));
  vp.set(PDFName.of('BBox'), bbox);
  vp.set(PDFName.of('Name'), PDFName.of('Main'));
  vp.set(PDFName.of('Measure'), measure);
  page.node.set(PDFName.of('VP'), vp);
}

// ---- Elemen dekoratif di atas peta ----

// Bar skala klasik dua-warna; pilih panjang bulat yang pas
function niceScaleBar(metersPerPt, maxPx) {
  for (const m of [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]) {
    const px = m / metersPerPt;
    if (px >= 60 && px <= maxPx) return { meters: m, px };
  }
  return null;
}

function drawScaleBar(page, fontB, mapRectY, metersPerPt) {
  const sb = niceScaleBar(metersPerPt, IW * 0.25);
  if (!sb) return;
  const sx = M + 10;
  const sy = mapRectY + 16;
  page.drawRectangle({ x: sx - 1, y: sy - 3.5, width: sb.px + 2, height: 8, color: rgb(1, 1, 1), opacity: 0.75 });
  page.drawRectangle({ x: sx, y: sy - 2, width: sb.px / 2, height: 5, color: rgb(0.13, 0.19, 0.15) });
  page.drawRectangle({ x: sx + sb.px / 2, y: sy - 2, width: sb.px / 2, height: 5, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: sx, y: sy - 2, width: sb.px, height: 5, borderColor: rgb(0.13, 0.19, 0.15), borderWidth: 0.9 });
  const label = sb.meters >= 1000 ? `${sb.meters / 1000} km` : `${sb.meters} m`;
  const lw = fontB.widthOfTextAtSize(label, 8);
  page.drawRectangle({ x: sx + sb.px + 6, y: sy - 4, width: lw + 7, height: 11, color: C.darkChip, opacity: 0.62 });
  page.drawText(label, { x: sx + sb.px + 9.5, y: sy - 1, size: 8, font: fontB, color: rgb(1, 1, 1) });
}

function drawNorthArrow(page, mapRectY, mapH) {
  const nx = M + IW - 20;
  const ny = mapRectY + mapH - 21;
  page.drawCircle({ x: nx, y: ny, size: 9.5, color: rgb(1, 1, 1), opacity: 0.85, borderWidth: 0.9, borderColor: rgb(0.62, 0.58, 0.5) });
  page.drawSvgPath('M 0 5.2 L 3.1 -3 L 0 -1.4 L -3.1 -3 Z', { x: nx, y: ny + 0.8, color: rgb(0.13, 0.19, 0.15) });
}

function drawAttributionChip(page, font, mapRectY, mapH) {
  const text = '© OpenStreetMap contributors';
  const tw = font.widthOfTextAtSize(text, 5.5);
  const x = M + IW - tw - 12;
  const y = mapRectY + 6;
  page.drawRectangle({ x, y, width: tw + 8, height: 10, color: C.darkChip, opacity: 0.55 });
  page.drawText(text, { x: x + 4, y: y + 2.8, size: 5.5, font, color: rgb(1, 1, 1) });
}
export async function buildPdfBytes({ map, mode, color, routeCoords, waypoints, elevations, speedKph, transformRequest, onProgress }) {
  // ---- Vertikal grid (dari atas): header → peta → statistik → footer
  const TOP = PH - M;
  const HEADER_H = 33; // title+accent+hairline zone di bawah TOP
  const mapTopY = TOP - HEADER_H - 8;
  const BOTTOM_LIMIT = M + 26; // footer text duduk di y≈13

  // Layout maksimal (mepet full): peta memakan SELURUH sisa area konten —
  // hanya menyisakan pita statistik ringkas (JARAK / ELEVASI / ESTIMASI)
  // tepat di atas footer. Tanpa ruang kosong terbuang.
  const STATS_H = 42; // 12 jarak dari tepi peta + label (9) + nilai (24)
  const contentH = mapTopY - BOTTOM_LIMIT;
  const mapH = contentH - STATS_H;
  const mapRectY = mapTopY - mapH;

  // Tangkap frame map: center-crop agar mengisi area peta (rasio IW:mapH)
  // tanpa distorsi, lalu gambar ulang rute & waypoint di atasnya.
  const { dataUrl, bounds } = await captureComposedMap(map, routeCoords, waypoints, IW, mapH, { transformRequest });
  if (onProgress) onProgress(70, 'Menggambar rute & overlay…');

  // ---- Dokumen & font ----
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  if (onProgress) onProgress(85, 'Menyusun halaman PDF…');
  const jpg = await doc.embedJpg(dataUrl);
  if (onProgress) onProgress(92, 'Menyimpan GeoPDF…');
  const acc = hexToRgb(color);
  const accent = rgb(acc.r, acc.g, acc.b);

  const page = doc.addPage([PW, PH]);
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: C.paper });

  // ---- Header ----
  const modeName = mode === 'bike' ? 'Sepeda' : mode === 'hike' ? 'Hiking' : 'Lari';
  const title = `Rute ${modeName} — Jalur`;
  page.drawText(title, { x: M, y: TOP - 16, size: 18, font: fontB, color: C.ink });
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText(dateStr, {
    x: PW - M - font.widthOfTextAtSize(dateStr, 9.5),
    y: TOP - 13.5,
    size: 9.5,
    font,
    color: C.subtle,
  });
  page.drawRectangle({ x: M, y: TOP - 25, width: 44, height: 3, color: accent });
  page.drawLine({
    start: { x: M, y: TOP - HEADER_H },
    end: { x: PW - M, y: TOP - HEADER_H },
    thickness: 0.75,
    color: C.hair,
  });

  // ---- Peta + georeferensi ----
  page.drawRectangle({
    x: M - 1,
    y: mapRectY - 1,
    width: IW + 2,
    height: mapH + 2,
    borderColor: C.card,
    borderWidth: 1,
  });
  page.drawImage(jpg, { x: M, y: mapRectY, width: IW, height: mapH });
  attachGeoReference(page, bounds, IW, mapH);
  drawNorthArrow(page, mapRectY, mapH);
  drawAttributionChip(page, font, mapRectY, mapH);

  let metersPerPt = 0;
  try {
    const midLat = (bounds.north + bounds.south) / 2;
    const metersWide = totalDistanceMeters([
      { lng: bounds.west, lat: midLat },
      { lng: bounds.east, lat: midLat },
    ]);
    metersPerPt = metersWide / IW;
    drawScaleBar(page, fontB, mapRectY, metersPerPt);
  } catch (_) {}
  // ---- Baris statistik: kartu JARAK · ELEVASI · ESTIMASI ----
  const distKm = (totalDistanceMeters(routeCoords.length > 1 ? routeCoords : waypoints) / 1000).toFixed(2);
  const { gain, loss } = sumGainLoss(elevations);
  const mins = (parseFloat(distKm) / speedKph) * 60;
  const durTxt = `${Math.floor(mins / 60)}j ${Math.round(mins % 60)}m`;
  const statsTopY = mapRectY - 12;
  const cells = [
    { label: 'JARAK', value: `${distKm} km` },
    { label: 'ELEVASI', value: gain != null ? `${gain} up / ${loss} down m` : '–' },
    { label: 'ESTIMASI', value: `±${durTxt}` },
  ];
  const cellW = IW / cells.length;
  cells.forEach((c0, i) => {
    const x = M + i * cellW;
    page.drawText(c0.label, { x, y: statsTopY - 9, size: 6.5, font: fontB, color: C.faint });
    page.drawText(c0.value, { x, y: statsTopY - 24, size: 13, font: fontB, color: C.ink });
    if (i > 0) {
      page.drawLine({
        start: { x: x - 8, y: statsTopY - 26 },
        end: { x: x - 8, y: statsTopY - 4 },
        thickness: 0.75,
        color: C.hair,
      });
    }
  });

  // ---- Footer ----
  page.drawText(
    'Peta: OSM Retina (Retina Tiles API via RapidAPI) · Data © OpenStreetMap contributors · Elevasi: Open-Meteo',
    { x: M, y: 14, size: 6.5, font, color: C.faint }
  );
  const geoNote = 'GeoPDF geotagged · WGS84 (EPSG:4326)';
  page.drawText(geoNote, {
    x: PW - M - font.widthOfTextAtSize(geoNote, 6.5),
    y: 14,
    size: 6.5,
    font,
    color: C.faint,
  });

  doc.setTitle(title);
  doc.setSubject('Rute perencanaan dengan peta georeferensi');
  doc.setProducer('jalur-app (MapLibre + pdf-lib)');
  doc.setKeywords(['GeoPDF', 'geotagged', modeName.toLowerCase(), 'OpenStreetMap']);
  if (onProgress) onProgress(96, 'Menyimpan GeoPDF…');
  return doc.save();
}

export async function downloadGeotaggedPdf(opts) {
  const bytes = await buildPdfBytes(opts);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `jalur-rute-${stamp}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}



