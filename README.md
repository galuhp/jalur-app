# Jalur — Perencana Rute Lari, Sepeda & Hiking

Aplikasi web untuk menggambar rute dengan klik di peta. Menghitung jarak,
elevasi (naik/turun), estimasi waktu tempuh, dan bisa otomatis "nempel" ke
jalan/jalur sungguhan.

## Stack

- **[Vite](https://vitejs.dev/)** — dev server & bundler
- **[MapLibre GL JS](https://maplibre.org/)** — rendering peta WebGL (open-source)
- **Pilihan basemap** (bisa dipilih user lewat toggle di peta):
  - **MapLibre** — style vektor OpenFreeMap "Liberty" (detail OSM lengkap, gratis)
  - **OSM** — tile OSM Retina via RapidAPI (`retina-tiles.p.rapidapi.com`, `local/osm@2x/v1/{z}/{x}/{y}.png`, tile 512px)
  - **Landscape** — Thunderforest Landscape retina (tile 512px)
- **Basemap provider sendiri (opsional)**: ubah `BASEMAP_CONFIG` di `src/basemaps.js` — style vektor (tombol *MapLibre*) via `apiKey` + `baseUrl` dengan placeholder `{key}`. Kosong = fallback ke basemap gratis.
- **Import GPX**: tombol "Impor" membaca file `.gpx` (track/route/waypoint, maks 10 MB), lalu pilih cara pemrosesan di dialog: **pakai jalur GPX apa adanya** (geometri asli utuh, tanpa snap) atau **snap ulang ke jalan** (mobil=Fast Routing / pejalan kaki / sepeda via OSRM). Peta otomatis pas-fit ke lintasan; statistik & PDF tetap terhitung.
- **Kembali ke titik 1**: tombol bendera di kanan-bawah peta menerbangkan kembali tampilan ke titik awal rute; otomatis nonaktif saat belum ada titik
- **Export GPX**: tombol "GPX" di sidebar mengunduh rute (hasil snap OSRM atau garis lurus) sebagai file GPX 1.1 `jalur-rute.gpx`, termasuk data elevasi bila tersedia
- **Export PDF Geotagged**: tombol "PDF" menghasilkan peta A4 lanskap presisi — **selalu memakai basemap OSM Retina** (peta dikembalikan otomatis ke basemap aktif sebelumnya) — dengan rute + titik bernomor + bar skala + panah utara + kartu statistik + koordinat tiap titik, dan **georeferensi OGC GeoPDF WGS84** tertanam (bisa dibaca Avenza Maps / QGIS). Tanpa profil elevasi.
- **Routing**: **Fast Routing API** (RapidAPI, berbasis OSRM) sebagai primer — semua mode dirutekan dengan profil `driving`, `exclude=ferry`. Bila primer gagal → otomatis fallback ke **OSRM demo publik** dengan profil sesuai mode (lari/hiking=`foot`, sepeda=`bike`)
- **[Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api)** — data ketinggian untuk profil elevasi
- Vanilla JS (ES modules) — tanpa framework UI, supaya ringan

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

## Build untuk production

```bash
npm run build
npm run preview   # untuk cek hasil build secara lokal
```

Hasil build ada di folder `dist/` — bisa di-deploy ke static hosting apa saja
(Netlify, Vercel, GitHub Pages, Cloudflare Pages, dll).

## Struktur project

```
jalur-app/
├── index.html          # markup halaman + sidebar UI
├── src/
│   ├── main.js          # entry point: state, event handlers, inisialisasi map
│   ├── basemaps.js       # definisi style basemap (maplibre/osm)
│   ├── routing.js        # panggilan API OSRM (routing) & Open-Meteo (elevasi)
│   ├── geo.js            # util geometri: haversine, sampling titik
│   ├── ui.js              # update panel statistik & gambar grafik elevasi (SVG)
│   └── style.css          # semua styling
├── package.json
└── vite.config.js
```

## Catatan

- Server OSRM & Open-Meteo yang dipakai adalah instance publik gratis —
  cocok untuk prototyping/personal use. Untuk trafik tinggi, sebaiknya
  hosting OSRM sendiri (self-hosted) atau pakai layanan berbayar seperti
  Mapbox Directions / GraphHopper.
- Toggle "Ikuti Jalan" bisa dimatikan untuk menggambar garis lurus manual —
  berguna untuk jalur hiking yang belum terpetakan di OpenStreetMap.
