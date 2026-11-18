import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api/pharmacy': {
        target: process.env.VITE_PHARMACY_API_TARGET || 'http://p-backend:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/pharmacy/, ''),
      },
      '/api/hospital/peer2': {
        target: process.env.VITE_PEER2_API_TARGET || 'http://h-peer2-api:4003',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/hospital\/peer2/, ''),
      },
    },
  },
})
