/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import legacy from '@vitejs/plugin-legacy';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // `--mode server`: de Pi-versie. Die draait op de root van de Pi, zonder service worker (de Pi ís de opslag).
  const server = mode === 'server';
  // GitHub Pages serveert de app op /<repo-naam>/
  const base = server ? '/' : '/flipper-tournement/';
  return {
  base,
  // Ook oudere iPads (iOS 14/15, bijv. iPad Air 2) moeten de app kunnen draaien.
  build: { target: ['es2020', 'safari14'], cssTarget: ['safari14'], outDir: server ? 'dist-server/public' : 'dist' },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    preact(),
    // Alleen polyfills (geen aparte legacy-bundel) voor functies die oudere Safari mist.
    legacy({ modernPolyfills: true, renderLegacyChunks: false, modernTargets: ['safari >= 14', 'ios >= 14', 'chrome >= 90', 'firefox >= 90'] }),
    VitePWA({
      disable: server,
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Flipper Toernooi',
        short_name: 'Flipper',
        description: 'Offline flipperkast-toernooien organiseren',
        lang: 'nl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0b12',
        theme_color: '#0b0b12',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        // De kastencatalogus staat niet in de precache; die downloadt de app zelf als hij nodig is.
        globIgnores: ['catalog/**', 'rules/**'],
        runtimeCaching: [
          {
            // Kastafbeeldingen (OPDB): na één keer tonen ook offline beschikbaar.
            urlPattern: ({ request, sameOrigin }) => !sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'kast-afbeeldingen',
              expiration: { maxEntries: 400, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
};
});
