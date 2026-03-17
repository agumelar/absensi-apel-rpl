import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('exceljs')) return 'vendor-excel';
          if (id.includes('html5-qrcode')) return 'vendor-qr';
          if (id.includes('recharts')) return 'vendor-chart';
          if (id.includes('@supabase')) return 'vendor-supabase';
          return 'vendor-core';
        },
      },
    },
  },
})
