import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  Box,
  Paper,
  Fab,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import DirectionsBikeRoundedIcon from '@mui/icons-material/DirectionsBikeRounded';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { getAppState, subscribeApp, actions } from '../store.js';

const BASEMAPS = [
  { value: 'maplibre', label: 'MapLibre' },
  { value: 'osm', label: 'OSM' },
  { value: 'thunderforest', label: 'Landscape' },
];

const GPX_OPTIONS = [
  {
    mode: 'asis',
    icon: <RouteRoundedIcon />,
    title: 'Pakai jalur GPX apa adanya',
    sub: 'Geometri asli dipertahankan — tanpa snap ke jalan',
  },
  {
    mode: 'drive',
    icon: <DirectionsCarRoundedIcon />,
    title: 'Snap ulang ke jalan (mobil)',
    sub: 'Fast Routing, profil driving',
  },
  {
    mode: 'foot',
    icon: <DirectionsWalkRoundedIcon />,
    title: 'Snap ulang ke jalan (pejalan kaki)',
    sub: 'OSRM foot — cocok untuk hiking',
  },
  {
    mode: 'bike',
    icon: <DirectionsBikeRoundedIcon />,
    title: 'Snap ulang ke jalan (sepeda)',
    sub: 'OSRM bike',
  },
];
export default function MapOverlays() {
  const s = useSyncExternalStore(subscribeApp, getAppState);

  return (
    <>
      {/* Toggle basemap — kanan bawah */}
      <Box className="map-ui-item" sx={{ position: 'absolute', bottom: 16, left: 10, zIndex: 5 }}>
        <Paper elevation={3} sx={{ p: '4px', borderRadius: '10px' }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={s.basemap}
            onChange={(_, v) => v && actions.setBasemap(v)}
          >
            {BASEMAPS.map((b) => (
              <ToggleButton
                key={b.value}
                value={b.value}
                sx={{ px: 1.4, py: '5px', fontSize: 11, fontWeight: 600, textTransform: 'none' }}
              >
                {b.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Paper>
      </Box>

      {/* Kembali ke titik 1 — kanan bawah */}
      <Box className="map-ui-item" sx={{ position: 'absolute', bottom: 16, right: 10, zIndex: 5 }}>
        <Tooltip title="Kembali ke titik 1">
          <span>
            <Fab
              size="small"
              disabled={!s.hasPoints}
              onClick={() => actions.backToStart()}
              sx={{
                bgcolor: '#fbf9f2',
                color: '#6b7a70',
                ':hover': { bgcolor: '#1e3327', color: '#fff' },
                ':disabled': { opacity: 0.35 },
              }}
            >
              <FlagOutlinedIcon fontSize="small" />
            </Fab>
          </span>
        </Tooltip>
      </Box>

      {/* Toast progress → Snackbar */}
      <Snackbar
        open={!!s.toast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => actions.dismissToast()}
        autoHideDuration={null}
        message={(s.toast && s.toast.text) || ''}
      />

      {/* Dialog impor GPX */}
      <Dialog
        open={!!s.gpxDialog}
        onClose={() => actions.cancelGpxImport()}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}
      >
        <DialogTitle sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Impor GPX</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {s.gpxDialog && (
            <Alert severity="info" variant="outlined" sx={{ mb: 1.5, fontSize: 12 }}>
              {s.gpxDialog.fileName} — {s.gpxDialog.pointCount.toLocaleString('id-ID')} titik terbaca
            </Alert>
          )}
          <List disablePadding>
            {GPX_OPTIONS.map((o) => (
              <ListItemButton
                key={o.mode}
                onClick={() => actions.applyGpxProfile(o.mode)}
                sx={{ borderRadius: '10px', mb: '7px', border: '1px solid', borderColor: 'divider' }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: '#2f4a3a' }}>{o.icon}</ListItemIcon>
                <ListItemText primary={<b style={{ fontSize: 13 }}>{o.title}</b>} secondary={o.sub} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}
