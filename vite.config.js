import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        gallery: resolve(__dirname, 'public/assets/index.html'),
        admin: resolve(__dirname, 'public/assets/admin.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3456',
    },
  },
});
