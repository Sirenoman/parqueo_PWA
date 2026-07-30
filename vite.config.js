import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Parqueo Tickets',
        short_name: 'Parqueo',
        description: 'Registro de entradas y salidas de un parqueo, con soporte offline',
        theme_color: '#7c1fd6',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Precachea el build; las llamadas a Supabase nunca pasan por aqui
        // porque son cross-origin y la app ya maneja su propio fallback
        // offline via Dexie en la capa de servicios.
        globPatterns: ['**/*.{js,css,html,svg}']
      }
    })
  ],
})
