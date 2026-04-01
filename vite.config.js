import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/nocodb-api': {
        target: 'https://nocodb.munizcotech.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nocodb-api/, ''),
      }
    }
  }
})
