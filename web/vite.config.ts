import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'analyze' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }) as PluginOption,
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // NOTE: We intentionally do NOT define `rollupOptions.output.manualChunks`.
    // Hand-rolled vendor chunking (splitting react / mui / etc. into separate
    // chunks) is fragile because it easily creates circular imports between
    // chunks (e.g. `vendor-react` <-> `vendor`), which surface at runtime as
    // "Cannot access 'X' before initialization" / blank screen. Vite's default
    // chunking handles dependency cycles correctly and is good enough here.
    rollupOptions: {},
    chunkSizeWarningLimit: 500,
  },
}));
