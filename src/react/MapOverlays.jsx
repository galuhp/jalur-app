import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  Box,
  Paper,
  Fab,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  LinearProgress,
  Typography,
} from '@mui/material';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { getAppState, subscribeApp, actions } from '../store.js';

const BASEMAPS = [
  { value: 'maplibre', label: 'MapLibre' },
  { value: 'osm', label: 'OSM' },
  { value: 'thunderforest', label: 'Landscape' },
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

      {/* Progress export PDF */}
      <Dialog
        open={!!s.pdfProgress}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{ sx: { borderRadius: '14px' } }}
      >
        <DialogContent sx={{ pt: 3, pb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
            <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>
              Export PDF
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#2f4a3a' }}>
              {s.pdfProgress ? `${s.pdfProgress.percent}%` : ''}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={s.pdfProgress ? s.pdfProgress.percent : 0}
            sx={{
              height: 8,
              borderRadius: 5,
              backgroundColor: '#e7e9e2',
              '& .MuiLinearProgress-bar': { borderRadius: 5, backgroundColor: s.elevColor || '#3b7dd8' },
            }}
          />
          <Typography sx={{ mt: 1.2, fontSize: 12, color: 'text.secondary' }}>
            {(s.pdfProgress && s.pdfProgress.label) || ''}
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Dialog nama file PDF */}
      {s.pdfNameDialog && (
        <Dialog
          open
          onClose={() => actions.cancelPdfName()}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: '14px' } }}
        >
          <DialogTitle sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, pb: 1 }}>
            Nama file PDF
          </DialogTitle>
          <DialogContent sx={{ pt: 0 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
              Ekstensi .pdf ditambahkan otomatis.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Nama file"
              value={s.pdfNameDialog.value}
              onChange={(e) => actions.setPdfName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  actions.confirmPdfName();
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => actions.cancelPdfName()} sx={{ color: '#6b7a70', textTransform: 'none' }}>
              Batal
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={() => actions.confirmPdfName()}
              sx={{ bgcolor: '#1e3327', textTransform: 'none', ':hover': { bgcolor: '#2f4a3a' } }}
            >
              Buat PDF
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
