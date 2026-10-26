import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Production serves this app under /manager/ — bake the subpath into asset
  // URLs so plain `npm run build` output works when deployed there.
  // Local `vite dev` serves at / (no subpath), so plain localhost:5174 works.
  base: command === 'build' ? '/manager/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    open: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}));
