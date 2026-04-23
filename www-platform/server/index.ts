import 'dotenv/config' // 中文註解：載入 .env 環境變數（必須在最頂端，否則 OAuth 金鑰讀不到）
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import path from 'path'
import { fileURLToPath } from 'url'
import { productsRouter } from './routes/products'
import { ordersRouter } from './routes/orders'
import { configRouter } from './routes/config'
import { authRouter } from './routes/auth'
import { setupOAuth } from './lib/oauth'
import { prisma } from './lib/prisma'
import { fail, ok } from './lib/http'
import { readAccessToken, verifyAccessToken } from './lib/auth'
import { incrementHit, RATE_LIMIT } from './lib/rateLimit'
import { ogMiddleware } from './lib/ogMiddleware'

const app = express()

// 中文註解：信任反向代理（Nginx / Cloudflare），確保 req.ip 回傳真實客戶端 IP
app.set('trust proxy', 1)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
setupOAuth()
app.use(passport.initialize())

// 中文註解：社群爬蟲 OG middleware（spec §12.5）
// 必須在所有路由之前，偵測到 bot UA 時直接回傳注入 OG 標籤的靜態 HTML
app.use(ogMiddleware)

// ── 後台高頻訪問偵測（spec §11.2 第 3 關 / §11.3）────────────────────────────
// 中文註解：每個 IP 在 60 秒內訪問後台相關 API 超過 30 次，寫入觸發日誌供 mischief-check 查詢
app.use('/api', (req, _res, next) => {
  // 中文註解：僅偵測後台相關路徑（/api/config、/api/products 管理操作）
  // mischief-check 與 my-ip 本身不計入（避免前台啟動偵測觸發自身超標）
  const path = req.path
  const isGuardPath = path === '/config/mischief-check' || path === '/config/my-ip'
  if (isGuardPath) return next()
  if (!path.startsWith('/config') && !path.startsWith('/products')) return next()

  // 中文註解：第 0 關 — 攜帶有效 admin JWT 者永遠不列入計數（spec §11.3）
  const token = readAccessToken(req)
  if (token) {
    try {
      const p = verifyAccessToken(token)
      if (p.user_level === 'admin') return next()
    } catch { /* 無效 token，繼續計數 */ }
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '0.0.0.0'
  const count = incrementHit(ip)  // 中文註解：遞增計數，共享給 mischief-check 查詢

  if (count === RATE_LIMIT + 1) {
    // 中文註解：第一次超標時寫入觸發日誌（每個視窗只記錄一次，不重複寫入）
    prisma.mischiefTriggerLog.create({
      data: {
        source_ip: ip,
        trigger_type: 'rate_limit',
        note: `60 秒內訪問後台 ${count} 次，超過閾值 ${RATE_LIMIT}`,
      },
    }).catch(() => { /* 靜默失敗 */ })
  }

  return next()
})

// 健康檢查（中文註解：後台可每 30 秒輪詢）
app.get('/api/health', async (_req, res) => {
  const startedAt = Date.now()
  try {
    const dbStarted = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatencyMs = Date.now() - dbStarted
    return ok(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'ok', latencyMs: dbLatencyMs },
      },
      latencyMs: Date.now() - startedAt,
    })
  } catch (e) {
    return res.status(503).json({
      status: 'degraded',
      services: { database: { status: 'error', error: (e as Error).message } },
    })
  }
})

app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/config', configRouter)
app.use('/api/auth', authRouter)

// 中文註解：生產環境（NODE_ENV=production）時 Express 同時 serve 前端靜態檔（dist/）
// 開發環境由 Vite dev server（port 5177）獨立處理，此段不生效
const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist')
  app.use(express.static(distPath))
  // SPA fallback：所有非 API 路由都回傳 index.html（交由前端 router 處理）
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  app.use((_req, res) => fail(res, 404, 'INTERNAL_ERROR', '找不到此 API'))
}

const port = Number(process.env.PORT ?? 5176)
app.listen(port, () => {
  // 中文註解：避免把指令輸出寫太多，只提示服務已啟動
  console.log(`[server] listening on http://localhost:${port}`)
})

