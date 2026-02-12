// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // core
      '/auth': { target: API, changeOrigin: true },
      '/products': { target: API, changeOrigin: true },
      '/cart': { target: API, changeOrigin: true },
      '/orders': { target: API, changeOrigin: true },
      '/health': { target: API, changeOrigin: true },
      '/__test__': { target: API, changeOrigin: true },

      // admin + payments + webhooks
      '/admin': { target: API, changeOrigin: true },
      '/payments': { target: API, changeOrigin: true },
      '/webhooks': { target: API, changeOrigin: true },
    },
  },
});
