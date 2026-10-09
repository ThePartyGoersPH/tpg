import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Production serves this app under /manager/ — bake the subpath into
  // asset URLs so plain `npm run build` output works when deployed there.
  // Dev server (vite dev) ignores base and still runs at /.
  base: '/manager/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    open: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
