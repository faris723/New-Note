import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Catatan: plugin VitePWA sengaja TIDAK dipakai lagi di sini.
// PWA (manifest, service worker, prompt install) sudah dikelola manual
// lewat public/manifest.json, public/sw.js, dan src/modules/pwa.js.
// Memakai VitePWA (registerType: 'autoUpdate') bersamaan dengan sw.js
// custom menyebabkan dua service worker berebut nama file 'sw.js' saat
// build, sehingga cache/update PWA jadi tidak konsisten.

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
