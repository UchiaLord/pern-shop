import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Frontend: http://localhost:5173
      // Backend:  http://localhost:4000
      '/auth': 'http://localhost:4000',
      '/products': 'http://localhost:4000',
      '/cart': 'http://localhost:4000',
      '/orders': 'http://localhost:4000',
      '/__test__': 'http://localhost:4000'
    },
  },
});
