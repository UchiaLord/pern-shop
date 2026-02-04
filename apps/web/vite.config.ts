import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Auth
      '/auth': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },

      // Shop
      '/products': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/cart': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/orders': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },

      // Admin
      '/admin': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },

      // Optional: falls du Test-only Routen in dev mal brauchst
      '/__test__': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },

      // Optional: health/echo
      '/health': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/echo': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
