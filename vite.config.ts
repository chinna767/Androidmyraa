import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),

      ...(!isCapacitorBuild
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: [
                'favicon.ico',
                'pwa-512x512.svg',
                'pwa-maskable.svg'
              ],
              manifest: {
                id: '/',
                name: 'MYRAA AI Companion',
                short_name: 'MYRAA',
                description:
                  'Real-time AI voice companion with continuous conversation, emotional presence, and persistent memory.',
                theme_color: '#070b14',
                background_color: '#070b14',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                  {
                    src: '/pwa-512x512.svg',
                    sizes: '192x192 512x512',
                    type: 'image/svg+xml',
                    purpose: 'any'
                  },
                  {
                    src: '/pwa-maskable.svg',
                    sizes: '512x512',
                    type: 'image/svg+xml',
                    purpose: 'maskable'
                  }
                ]
              },
              workbox: {
                maximumFileSizeToCacheInBytes:
                  6 * 1024 * 1024,
                globPatterns:
                  ['**/*.{js,css,html,ico,png,svg,json}']
              }
            })
          ]
        : [])
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {}
    }
  };
});
