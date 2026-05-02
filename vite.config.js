import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  // In production, assets are served from the persistent volume via Express — not from dist/
  // Only keep publicDir for dev server (textures, audio previews)
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        gallery: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
    // Don't copy public/ into dist — Express serves assets from the volume
    copyPublicDir: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3456',
    },
  },
});
