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
          Klik di peta untuk menambah titik. Rute, jarak, dan elevasi terhitung otomatis.
        </Typography>
      </Box>

      {/* Mode */}
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

      {/* Hint */}
      <Paper elevation={0} sx={{ m: '14px 22px 0', p: '10px 12px', bgcolor: '#fff8ea', border: '1px solid #e8dcb8', borderRadius: '8px', fontSize: 11.5, color: '#7a6a3a', lineHeight: 1.5 }}>
        💡 Klik peta untuk tiap titik rute. Klik <b>Selesai</b> untuk mengunci, atau geser titik untuk menyesuaikan.
      </Paper>

      {/* Stats */}
      <Box sx={{ p: '16px 22px', borderBottom: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <StatCard label="Jarak" value={s.distanceKm} unit="km" />
        <StatCard label="Titik" value={s.pointsCount} unit="klik" />
        <StatCard label="Elevasi Naik" value={s.gain != null ? s.gain : '–'} unit="m" />
        <StatCard label="Elevasi Turun" value={s.loss != null ? s.loss : '–'} unit="m" />
      </Box>

      {/* Estimasi waktu */}
      <Box sx={{ p: '14px 22px', borderBottom: '1px solid', borderColor: 'divider' }}>
        <SectionLabel>Estimasi Waktu Tempuh</SectionLabel>
        <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: 19, color: '#1e3327', fontWeight: 600 }}>
          {s.estimate}{' '}
          <Box component="span" sx={{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: '#8a9188', fontWeight: 500 }}>
            {s.estimateCaption}
          </Box>
        </Typography>
      </Box>

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

      {/* Actions */}
      <Box sx={{ mt: 'auto', p: '16px 22px', borderTop: '1px solid', borderColor: 'divider', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => actions.requestGpxImport()}>
          Impor
        </Button>
        <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => actions.exportGpx()}>
          GPX
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfRoundedIcon />} onClick={() => actions.exportPdf()}>
          PDF
        </Button>
        <Button variant="outlined" startIcon={<UndoRoundedIcon />} onClick={() => actions.undoRoute()}>
          Undo
        </Button>
        <Button variant="outlined" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => actions.clearRoute()}>
          Hapus
        </Button>
        <Button
          variant="contained"
          onClick={() => actions.toggleFinish()}
          startIcon={s.locked ? <EditOutlinedIcon /> : <CheckCircleOutlineRoundedIcon />}
          sx={{ gridColumn: '1 / -1' }}
        >
          {s.locked ? 'Edit lagi' : 'Selesai'}
        </Button>
      </Box>
    </Box>
  );
}
