import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // @ 指向 src/
    },
  },
  server: {
    port: 5177,       // 中文註解：固定前端開發埠為 5177
    strictPort: true, // 中文註解：若 5177 被占用就直接報錯，不自動換埠
    proxy: {
      // 中文註解：前端呼叫 /api/* 時，開發環境自動轉發到後端 Express
      '/api': {
        target: 'http://localhost:5176',
        changeOrigin: true,
        // 中文註解：將後端 Set-Cookie 的 domain 重寫為空（使 cookie 歸屬於 localhost:5177）
        // 否則 OAuth callback 後 cookie 只存在 5176，主視窗 5177 拿不到
        cookieDomainRewrite: '',
      },
    },
  },
})
