import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  Paper,
  Button,
} from '@mui/material';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import DirectionsBikeRoundedIcon from '@mui/icons-material/DirectionsBikeRounded';
import HikingRoundedIcon from '@mui/icons-material/HikingRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { getAppState, subscribeApp, actions } from '../store.js';

const MODE_OPTIONS = [
  { value: 'run', label: 'Lari', icon: <DirectionsRunRoundedIcon sx={{ fontSize: 19 }} />, color: '#3b7dd8' },
  { value: 'bike', label: 'Sepeda', icon: <DirectionsBikeRoundedIcon sx={{ fontSize: 19 }} />, color: '#d9622b' },
  { value: 'hike', label: 'Hiking', icon: <HikingRoundedIcon sx={{ fontSize: 19 }} />, color: '#3b8f5c' },
];

// Tab app mode — ditampilkan di bawah header "Jalur"
const APP_MODE_OPTIONS = [
  { value: 'import', label: 'Import GPX', icon: <UploadFileRoundedIcon sx={{ fontSize: 19 }} /> },
  { value: 'draw', label: 'Draw Route', icon: <EditOutlinedIcon sx={{ fontSize: 19 }} /> },
];

function SectionLabel({ children }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7a70', fontWeight: 600 }}
    >
      {children}
    </Typography>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: '12px 14px', bgcolor: '#fff', borderRadius: '10px', borderColor: 'divider' }}
    >
      <SectionLabel>{label}</SectionLabel>
      <Typography component="div" sx={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: '#1c2a22', lineHeight: 1.15 }}>
        {value}
        {unit && (
          <Box component="span" sx={{ fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 500, color: '#8a9188', ml: 0.4 }}>
            {unit}
          </Box>
        )}
      </Typography>
    </Paper>
  );
}
export default function Sidebar() {
  const s = useSyncExternalStore(subscribeApp, getAppState);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <Box sx={{ p: '20px 22px 16px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2f4a3a', opacity: 0.75, mb: '6px' }}>
          Perencana Rute · v2
        </Typography>
        <Typography variant="h1" sx={{ fontSize: 26, lineHeight: 1.05, color: '#1e3327' }}>
          Jalur
        </Typography>
        <Typography sx={{ mt: '8px', fontSize: 12.5, color: '#5b6960', lineHeight: 1.5 }}>
          {s.appMode === 'import'
            ? 'Unggah file .gpx — rute, jarak, dan elevasi dihitung otomatis dari file.'
            : 'Klik di peta untuk menambah titik. Rute, jarak, dan elevasi terhitung otomatis.'}
        </Typography>
      </Box>

      {/* App mode: Import GPX / Draw Route */}
      <Box sx={{ p: '14px 22px 0' }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          className="app-mode-group"
          value={s.appMode}
          onChange={(_, v) => v && actions.setAppMode(v)}
          sx={{ gap: '6px' }}
        >
          {APP_MODE_OPTIONS.map((m) => (
            <ToggleButton key={m.value} value={m.value}>
              {m.icon}
              {m.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Panel upload GPX — hanya di app mode Import */}
      {s.appMode === 'import' && (
        <Box sx={{ p: '14px 22px 0' }}>
          <SectionLabel>File GPX</SectionLabel>
          <Button
            variant="outlined"
            fullWidth
            className="gpx-upload-btn"
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => actions.requestGpxImport()}
          >
            Pilih File GPX
          </Button>
          <Typography sx={{ pt: '6px', fontSize: 10.5, color: '#9aa39a', lineHeight: 1.4 }}>
            {s.gpxFileName ? `Terakhir diimpor: ${s.gpxFileName}` : 'Belum ada file .gpx diimpor.'}
          </Typography>
        </Box>
      )}

      {/* Pilihan mode rute + snap — hanya relevan di app mode Draw */}
      {s.appMode === 'draw' && (
        <>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={s.mode}
            onChange={(_, v) => v && actions.setMode(v)}
            sx={{ gap: '6px', p: '16px 22px 0' }}
          >
            {MODE_OPTIONS.map((m) => (
              <ToggleButton
                key={m.value}
                value={m.value}
                sx={{
                  ...(s.mode === m.value ? { bgcolor: m.color } : { bgcolor: '#fff', border: '1px solid', borderColor: 'divider' }),
                  ':hover': s.mode !== m.value ? { bgcolor: '#fffdf6' } : {},
                }}
              >
                {m.icon}
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Snap to road */}
          <Box sx={{ px: '22px', pt: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionLabel>Ikuti Jalan</SectionLabel>
            <Switch checked={s.snapToRoad} onChange={() => actions.toggleSnap()} size="small" />
          </Box>
          <Typography sx={{ px: '22px', pt: '4px', fontSize: 10.5, color: '#9aa39a', lineHeight: 1.4 }}>
            {s.snapToRoad
              ? 'Titik akan otomatis nempel ke jalan/jalur terdekat (OSRM).'
              : 'Rute mengikuti garis lurus antar titik klik.'}
          </Typography>
        </>
      )}

      {/* Hint */}
      <Paper elevation={0} sx={{ m: '14px 22px 0', p: '10px 12px', bgcolor: '#fff8ea', border: '1px solid #e8dcb8', borderRadius: '8px', fontSize: 11.5, color: '#7a6a3a', lineHeight: 1.5 }}>
        {s.appMode === 'import' ? (
          <>📄 Format .gpx (trkpt/rtept/wpt). Elevasi dari tag &lt;ele&gt; bila ada; jika tidak, diambil dari Open-Meteo.</>
        ) : (
          <>💡 Klik peta untuk tiap titik rute. Klik <b>Selesai</b> untuk mengunci, atau geser titik untuk menyesuaikan.</>
        )}
      </Paper>

      {/* Stats */}
      <Box sx={{ p: '16px 22px', borderBottom: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <StatCard label="Jarak" value={s.distanceKm} unit="km" />
        <StatCard label="Titik" value={s.pointsCount} unit={s.appMode === 'import' ? null : 'klik'} />
        <StatCard label="Elevasi Naik" value={s.gain != null ? s.gain : '–'} unit="m" />
        <StatCard label="Elevasi Turun" value={s.loss != null ? s.loss : '–'} unit="m" />
      </Box>

      {/* Estimasi waktu — hanya di mode Draw (pace mode tidak relevan untuk GPX impor) */}
      {s.appMode === 'draw' && (
        <Box sx={{ p: '14px 22px', borderBottom: '1px solid', borderColor: 'divider' }}>
          <SectionLabel>Estimasi Waktu Tempuh</SectionLabel>
          <Typography
            sx={{ fontFamily: "'Fraunces', serif", fontSize: 19, color: '#1e3327', fontWeight: 600 }}
            title={
              s.mode === 'hike'
                ? 'Naismith: 1 jam per 5 km + 30 menit per 300 m naik; koreksi Langmuir untuk turunan (−10m/300m landai 5°–12°, +10m/300m curam >12°)'
                : undefined
            }
          >
            {s.estimate}{' '}
            <Box component="span" sx={{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: '#8a9188', fontWeight: 500 }}>
              {s.estimateCaption}
            </Box>
          </Typography>
        </Box>
      )}

      {/* Profil elevasi */}
      <Box sx={{ p: '16px 22px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '8px' }}>
          <SectionLabel>Profil Elevasi</SectionLabel>
          <SectionLabel>{s.elevRange}</SectionLabel>
        </Box>
        {s.elevPathD ? (
          <svg viewBox="0 0 300 90" width="100%" height="90" role="img">
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.elevColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={s.elevColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={s.elevAreaD} fill="url(#elevGrad)" stroke="none" />
            <path d={s.elevPathD} fill="none" stroke={s.elevColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        ) : (
          <Typography sx={{ fontSize: 12, color: '#9aa39a', fontStyle: 'italic', textAlign: 'center', py: '20px' }}>
            Gambar rute untuk melihat profil elevasi
          </Typography>
        )}
      </Box>

      {/* Actions — mode Draw: selalu tampil (perilaku lama, tidak bergantung
          jumlah titik); tombol Impor dihapus karena redundan dengan tab
          "Import GPX". Mode Import: baru tampil setelah rute GPX berhasil
          diimpor (s.hasPoints), hanya PDF & Hapus. Conditional render =
          elemen dihapus penuh dari DOM (setara display:none), tidak
          menyisakan ruang kosong. Grid 2 kolom: GPX+PDF / Undo+Hapus,
          Selesai full-width. */}
      {(s.appMode === 'draw' || s.hasPoints) && (
        <Box
          sx={{
            mt: 'auto',
            p: '16px 22px',
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {s.appMode === 'draw' && (
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => actions.exportGpx()}>
              GPX
            </Button>
          )}
          <Button variant="outlined" startIcon={<PictureAsPdfRoundedIcon />} onClick={() => actions.exportPdf()}>
            PDF
          </Button>
          {s.appMode === 'draw' && (
            <Button variant="outlined" startIcon={<UndoRoundedIcon />} onClick={() => actions.undoRoute()}>
              Undo
            </Button>
          )}
          <Button variant="outlined" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => actions.clearRoute()}>
            Hapus
          </Button>
          {s.appMode === 'draw' && (
            <Button
              variant="contained"
              onClick={() => actions.toggleFinish()}
              startIcon={s.locked ? <EditOutlinedIcon /> : <CheckCircleOutlineRoundedIcon />}
              sx={{ gridColumn: '1 / -1' }}
            >
              {s.locked ? 'Edit lagi' : 'Selesai'}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
