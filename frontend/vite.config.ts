import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Where the dev server forwards API traffic. The app itself asks for `/api/...`
 * with no host, exactly as it does in production, and this proxy is what makes
 * that work across two ports locally. It is the dev-time counterpart of the
 * `/api/(.*)` rewrite in `vercel.json`.
 */
const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000';

const proxy = {
  '/api': { target: API_TARGET, changeOrigin: true },
  '/health': { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy,
    // Dev serves every module as its own request, so a cold load walks an
    // import waterfall. Warming the entry graph transforms these at server
    // start instead of on first request. Dev-only; production ships 3 files.
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/**/*.tsx', './src/**/*.ts'],
    },
  },
  preview: {
    // `npm run preview` serves the production bundle, which is same-origin too,
    // so it needs the same forwarding.
    port: 4173,
    proxy,
  },
});
