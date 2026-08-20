import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/qa': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/payment': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/refund': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})