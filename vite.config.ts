import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  worker: { format: 'es' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        // Preserve the identity previously inferred from start_url: '/'.
        id: '/',
        name: 'Stowaway',
        short_name: 'Stowaway',
        description: 'The whole trip, tucked away. Shared plans, places, tickets, money and votes.',
        theme_color: '#183e4b',
        background_color: '#f8f5ee',
        display: 'standalone',
        start_url: '/app',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Includes the offline map's fonts and sprites, so labels render with no network.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}', 'map-assets/**/*.{pbf,json}'], // mjs: pdf.js worker
        globIgnores: ['**/tesseract-core-lstm*'], // the OCR core is cached when first used, not precached
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/mcp$/, /^\/\.well-known\//, /^\/oauth\//, /^\/auth\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['push-sw.js'], // push + notification taps (public/push-sw.js)
        runtimeCaching: [
          {
            // The OCR core and language data: cached the first time someone reads text, then work offline.
            urlPattern: ({ url }) => (url.origin === self.location.origin && url.pathname.includes('/assets/tesseract-core-lstm')) || /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\//.test(url.href),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-assets', cacheableResponse: { statuses: [200] } },
          },
          {
            // Map tiles you've looked at stay available with weak or no signal.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet|natural_earth)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 45 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map style, fonts and icon sprites.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(styles|fonts|sprites)\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map-assets', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
