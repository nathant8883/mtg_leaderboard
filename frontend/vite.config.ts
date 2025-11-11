import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_VERSION } from './src/version'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // Changed from 'autoUpdate' to require user consent
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Pod Pal - MTG Commander Tracker',
        short_name: 'Pod Pal',
        description: 'Track Magic: The Gathering Commander games, decks, and leaderboards with your playgroup',
        theme_color: '#667eea',
        background_color: '#141517',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/icons/icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cacheId: `pod-pal-v${APP_VERSION}`, // Version-based cache naming
        skipWaiting: false, // Changed: Wait for user action before activating new SW
        clientsClaim: false, // Changed: Don't immediately claim clients
        // Warmup cache with critical API endpoints on SW install
        // This ensures offline functionality works even on first install
        cleanupOutdatedCaches: true,
        // In dev mode, let API requests pass through to Vite's proxy
        // Runtime caching will work via warmup strategy + direct backend calls
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // CRITICAL: Auth endpoints must NEVER be cached (OAuth redirects)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/auth'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'auth-bypass', // Not actually used since NetworkOnly
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/players'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-players-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/decks'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-decks-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false, // Disabled: SW intercepts Vite proxy in dev mode
        type: 'module',
        /* To test PWA/caching features:
         * 1. npm run build
         * 2. npm run preview (serves production build on localhost:4173)
         * 3. Test offline functionality, cache warmup, install prompt, etc.
         */
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 5173, // Use same port as dev for consistency
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      }
    }
  }
})
