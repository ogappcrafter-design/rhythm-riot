import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Capacitor loads the built web assets from a relative path inside the APK,
// so base must be relative ('./') rather than root-absolute.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
