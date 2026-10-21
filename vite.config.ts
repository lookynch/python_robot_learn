import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { contentPlugin } from './build/vite-content-plugin';
import { PYODIDE_VERSION } from './src/python/config';

export default defineConfig({
  plugins: [
    preact(),
    contentPlugin('content'),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'RoboPy – Python bis World Models',
        short_name: 'RoboPy',
        description:
          'Interaktiv von Python-Grundlagen bis zu Robotern mit World Models und Reinforcement Learning.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f1419',
        theme_color: '#0f1419',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/cdn-cgi\//, /^\/api\//],
        runtimeCaching: [
          {
            // Robotermodell und MuJoCo-WASM: erst bei Nutzung laden, danach offline verfügbar.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              (url.pathname.startsWith('/robot/') || url.pathname.endsWith('.wasm')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'robot-assets',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 60 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://cdn.jsdelivr.net' &&
              url.pathname.startsWith(`/pyodide/v${PYODIDE_VERSION}/`),
            handler: 'CacheFirst',
            options: {
              cacheName: `pyodide-${PYODIDE_VERSION}`,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 40 },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide', '@mujoco/mujoco'] },
  build: { target: 'es2022', sourcemap: true },
});
