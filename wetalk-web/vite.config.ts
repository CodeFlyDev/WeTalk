import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') }
  },
  define: {
    // sockjs-client 引用 Node.js global，浏览器用 globalThis 替代
    global: 'globalThis'
  },
  server: {
    port: 5173,
    proxy: {
      // 开发环境反代到本地网关（docker compose 已拉起 wetalk-gateway 时生效；网关再按域路由到 core/ai）
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: 'http://localhost:8080', ws: true }
    }
  }
})
