import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['logo.png', 'apple-touch-icon.png', 'drinks/*.png', 'cities/*.png', 'vehicles/*.png'],
      manifest: {
        name: 'Prohibitioner: Risk and Profit',
        short_name: 'Prohibitioner',
        description: 'A multiplayer prohibition-era strategy game.',
        theme_color: '#1a0f00',
        background_color: '#1a0f00',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png',          sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png',          sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globIgnores: ['**/landing-*.png', '**/screenshot.png'],
      },
    }),
  ],
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
