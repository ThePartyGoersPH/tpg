import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return 'dev';
  }
})();

export default defineConfig({
  base: '/',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: false,
    allowedHosts: true,
    // Local dev has no CORS issues: /api calls proxy to the backend, so the
    // app can use a relative base URL just like production nginx does.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Backend mounts routes at root (/auth/...); strip the prefix exactly
        // like the production nginx location block does.
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
