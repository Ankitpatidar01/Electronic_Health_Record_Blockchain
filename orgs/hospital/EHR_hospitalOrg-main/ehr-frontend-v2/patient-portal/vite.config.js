import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// The portal calls the patient API on its own origin (/api/patient) and the dev
// server forwards it. The browser then never needs to reach port 4005 itself,
// so the portal also works when opened from another machine.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/patient': {
        target: process.env.VITE_PATIENT_API_TARGET || 'http://localhost:4005',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/patient/, ''),
      },
    },
  },
})
