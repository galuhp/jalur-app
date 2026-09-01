import React from 'react';
import { createRoot } from 'react-dom/client';
import { useSyncExternalStore } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme.js';
import Sidebar from './react/Sidebar.jsx';
import MapOverlays from './react/MapOverlays.jsx';
import { getAppState, subscribeApp } from './store.js';

export function useAppStore() {
  return useSyncExternalStore(subscribeApp, getAppState);
}

const sidebarEl = document.getElementById('sidebar-root');
if (sidebarEl) {
  createRoot(sidebarEl).render(
    <ThemeProvider theme={theme}>
      <Sidebar />
    </ThemeProvider>
  );
}

const overlayEl = document.getElementById('map-ui-root');
if (overlayEl) {
  createRoot(overlayEl).render(
    <ThemeProvider theme={theme}>
      <MapOverlays />
    </ThemeProvider>
  );
}