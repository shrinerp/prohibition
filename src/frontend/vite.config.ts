import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: __dirname,  // src/frontend — where index.html lives
  build: {
    outDir: resolve(__dirname, '../../dist/frontend'),
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api':    'http://localhost:8787',
      '/auth':   'http://localhost:8787',
      '/health': 'http://localhost:8787'
    }
  }
})
