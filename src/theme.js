import { createTheme } from '@mui/material/styles';

// Tema MUI mengikuti identitas visual jalur-app (hijau hutan + krem)
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e3327', contrastText: '#ffffff' }, // forest-dark
    secondary: { main: '#d9622b' },
    success: { main: '#3b8f5c' },
    info: { main: '#3b7dd8' },
    warning: { main: '#d9622b' },
    background: { default: '#f3efe4', paper: '#fbf9f2' },
    text: { primary: '#1c2a22', secondary: '#6b7a70' },
    divider: 'rgba(28,42,34,0.12)',
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
    h6: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
    subtitle2: { fontFamily: "'JetBrains Mono', monospace" },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 9 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { fontSize: '12.5px', padding: '10px 8px' },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 10, borderColor: 'rgba(28,42,34,0.12)' },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { color: '#b7ad93' },
        colorPrimary: { '&.Mui-checked': { color: '#2f4a3a' } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          flexDirection: 'column',
          gap: 4,
          padding: '10px 4px 8px',
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7a70',
          borderRadius: 10,
          border: 'none',
          '&.Mui-selected': { border: 'none', color: '#fff' },
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { backgroundColor: '#1e3327', borderRadius: 20, fontWeight: 600, fontSize: 12 },
      },
    },
  },
});

export default theme;
