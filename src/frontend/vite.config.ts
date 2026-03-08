import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../../dist/frontend'
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/health': 'http://localhost:8787'
    }
  }
})
