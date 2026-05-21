import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Subpath deploy (e.g. Tailscale serve --set-path=/strataforge)
  base: '/strataforge/',
  server: {
    proxy: {
      '/strataforge/api': {
        target: 'http://127.0.0.1:8787',
        rewrite: (path) => path.replace(/^\/strataforge/, ''),
      },
    },
  },
})
