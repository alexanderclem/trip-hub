import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { prerender } from './scripts/prerender.ts'

// Workers Builds runs the same build command for main and branch Previews.
// Match the browser's database to previews.vars instead of baking production into a Preview.
const previewBranch = process.env.WORKERS_CI_BRANCH
const staging = previewBranch && previewBranch !== 'main' ? loadEnv('staging', process.cwd(), 'VITE_') : undefined
if (staging && (!staging.VITE_SUPABASE_URL || !staging.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error('Cloudflare Preview builds require the public Supabase settings in .env.staging.')
}

export default defineConfig({
  define: staging ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(staging.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(staging.VITE_SUPABASE_PUBLISHABLE_KEY),
  } : undefined,
  worker: { format: 'es' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    { name: 'stowaway-public-prerender', apply: 'build', async writeBundle(options) { await prerender(options.dir ?? 'dist') } },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        // Preserve the identity previously inferred from start_url: '/'.
        id: '/',
        name: 'Stowaway',
        short_name: 'Stowaway',
        description: 'Your group trip, all in one place. Save places, vote on favorites, and keep your itinerary, tickets, and shared costs together.',
        theme_color: '#17343f',
        background_color: '#f1f4f5',
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
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,jpg,woff2,ttf}', 'map-assets/**/*.{pbf,json}'], // mjs: pdf.js worker
        // The OCR core is cached when first used, not precached. Destination photos (about 20 MB for
        // 100 places) are too heavy to install on every phone: only their tiny placeholders precache,
        // and each trip's own photo is cached the first time it is shown (runtimeCaching below).
        globIgnores: ['**/tesseract-core-lstm*', 'images/destinations/!(*-placeholder).jpg'],
        navigateFallback: '/app.html',
        // A visit to a file (sitemap.xml, robots.txt, llms.txt, a PDF) must reach the real file, not the
        // app shell's not-found screen. App and website routes never have an extension.
        navigateFallbackDenylist: [/^\/api\//, /^\/mcp$/, /^\/\.well-known\//, /^\/oauth\//, /^\/auth\//, /\.[a-z0-9]+(\?.*)?$/i],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['push-sw.js'], // push + notification taps (public/push-sw.js)
        runtimeCaching: [
          {
            // A trip's destination photo, once seen, stays on the phone for offline covers.
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/images/destinations/'),
            handler: 'CacheFirst',
            options: { cacheName: 'destination-photos', expiration: { maxEntries: 60 }, cacheableResponse: { statuses: [200] } },
          },
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
    // Each database suite boots Postgres in WASM; unbounded workers exhaust memory on small hosts.
    maxWorkers: 2,
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts', 'supabase/testing/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
