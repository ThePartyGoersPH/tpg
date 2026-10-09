import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Production serves this app under /pos/ — bake the subpath into asset
  // URLs so plain `npm run build` output works when deployed there.
  // Dev server (vite dev) ignores base and still runs at /.
  base: '/pos/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    open: false,
  },
})
