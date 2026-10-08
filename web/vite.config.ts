import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base: the built app works at any path behind nginx
  base: './',
  plugins: [react(), tailwindcss()],
  // Recharts is most of the bundle (~180 KB gzipped); fine for this app
  build: { chunkSizeWarningLimit: 700 },
  server: {
    port: 5175,
    proxy: {
      // Dev: API comes from the Express server (npm start in the repo root)
      '/api': 'http://localhost:3000',
    },
  },
})
