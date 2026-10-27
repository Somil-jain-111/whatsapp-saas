import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:4002'
  return {
    plugins: [react()],
    server: {
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': { target, changeOrigin: true },
        '/internal': { target, changeOrigin: true },
      },
    },
  }
})
