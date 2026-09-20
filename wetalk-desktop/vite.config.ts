import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// 桌面端 Vite 配置：复用 wetalk-web 源码 + 注入桌面端能力
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      // 共享 web 端组件层（shadcn/ui、hooks、stores、services）
      '@web': path.resolve(rootDir, '../wetalk-web/src'),
    },
  },
  // 静态资源产物指向 tauri 期望的目录
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
  },
})
