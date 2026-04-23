import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

// 中文註解：後台 Vite 設定，跑在 port 5178，與前台（5177）完全分離
// 使用方式：npm run admin:dev

// 中文註解：開發伺服器根路徑導向 admin.html 的 Vite 插件
function adminRootRedirect(): Plugin {
  return {
    name: 'admin-root-redirect',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // 中文註解：讓 / 由 Vite 的 transformIndexHtml 處理 admin.html
        if (req.url === '/' || req.url === '') {
          req.url = '/admin.html'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), adminRootRedirect()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5178,
    strictPort: true,
    open: '/',  // 中文註解：啟動時自動開啟後台
    proxy: {
      // 中文註解：後台對 /api/* 的呼叫同樣轉發到 Express（port 5176）
      '/api': {
        target: 'http://localhost:5176',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
    },
  },
  // 中文註解：build 時輸出到 dist-admin，與前台 dist 分開
  build: {
    outDir: 'dist-admin',
    rollupOptions: {
      input: path.resolve(__dirname, 'admin.html'),
    },
  },
  define: {
    // 中文註解：後台編譯時注入前台網址（可被 .env 的 VITE_STOREFRONT_URL 覆蓋）
    'import.meta.env.VITE_STOREFRONT_URL': JSON.stringify(
      process.env.VITE_STOREFRONT_URL ?? 'http://localhost:5177'
    ),
  },
})
