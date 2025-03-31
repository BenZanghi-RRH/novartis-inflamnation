import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import Map from 'react-map-gl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-map-gl'],
  },
  resolve: {
    alias: {
      'react-map-gl': 'react-map-gl/dist/esm/index.js'
    }
  },
  server: {
    allowedHosts: ['chronicconnections.loclx.io']
  }
})
