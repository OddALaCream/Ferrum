import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // La SPA llama a /api y Vite lo reenvía a la API NestJS (evita CORS en desarrollo)
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  test: { environment: 'jsdom', globals: true },
});
