import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Dev serves every module as its own request, so a cold load walks an
    // import waterfall. Warming the entry graph transforms these at server
    // start instead of on first request. Dev-only; production ships 3 files.
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/**/*.tsx', './src/**/*.ts'],
    },
  },
  preview: {
    port: 4173,
  },
});
