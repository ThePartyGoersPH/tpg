import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // Production serves this app under /admin/ — bake the subpath into asset
  // URLs so plain `npm run build` output works when deployed there.
  // Local `vite dev` serves at / (no subpath), so plain localhost:5175 works.
  base: command === 'build' ? '/admin/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    open: false,
  },
}))
