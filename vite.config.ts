import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standard Vite + React setup. The p2p-portal-drop SDK is consumed as a normal
// npm dependency (installed from the public registry) — no aliases, exactly how
// a third-party portal integrates it.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on the LAN so other devices can open the portal
    port: 5180,
  },
  preview: {
    host: true,
    port: 5180,
  },
});
