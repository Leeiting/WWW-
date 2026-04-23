// 中文註解：社群爬蟲 OG meta 注入中介層（spec §12.5）
// SPA 架構下，Facebook / LINE / Discord 等爬蟲無法執行 JS，
// 本中介層偵測到 bot User-Agent 後直接回傳含正確 OG 標籤的靜態 HTML，
// 讓社群分享預覽卡片能顯示正確的商品圖片與描述。

import type { Request, Response, NextFunction } from 'express'
import { prisma } from './prisma'

// 中文註解：已知的社群爬蟲 / 預覽機器人 User-Agent 字串（部分比對）
const SOCIAL_BOTS = [
  'facebookexternalhit',   // Facebook
  'twitterbot',            // Twitter / X
  'linkedinbot',           // LinkedIn
  'discordbot',            // Discord
  'telegrambot',           // Telegram
  'slackbot',              // Slack
  'line-poker',            // LINE
  'whatsapp',              // WhatsApp
  'googlebot',             // Google
  'bingbot',               // Bing
  'applebot',              // Apple
  'pinterest',             // Pinterest
  'vkshare',               // VK
]

// 中文註解：辨識是否為社群爬蟲
const isSocialBot = (ua: string): boolean => {
  const lower = ua.toLowerCase()
  return SOCIAL_BOTS.some(bot => lower.includes(bot))
}

// 中文註解：危險等級轉星號文字
const dangerStars = (level: number): string =>
  '★'.repeat(level) + '☆'.repeat(5 - level)

// 中文註解：Knut → Galleon 字串（供 JSON-LD price 欄位）
const knutToGalleon = (knut: number): string =>
  (knut / (17 * 29)).toFixed(2)

// 中文註解：逸出 HTML 特殊字元（防止 XSS 注入至 meta content）
const esc = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// ── 各頁面 OG HTML 產生器 ──────────────────────────────────────────────────

// 中文註解：首頁 OG HTML（spec §12.5 各頁面 OG 規則）
const buildHomeOgHtml = (origin: string): string => `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>衛氏巫師法寶店 — 斜角巷最危險的購物體驗</title>
  <meta name="description" content="喬治・弗雷・衛斯理精選惡作劇法寶，讓每次購物都充滿魔法驚喜。庫存有限，魔法部不歡迎！" />
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="衛氏巫師法寶店 — 斜角巷最危險的購物體驗" />
  <meta property="og:description" content="喬治・弗雷・衛斯理精選惡作劇法寶，讓每次購物都充滿魔法驚喜。庫存有限，魔法部不歡迎！" />
  <meta property="og:url"         content="${esc(origin)}/" />
  <meta property="og:site_name"   content="衛氏巫師法寶店" />
  <meta property="og:locale"      content="zh_TW" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="衛氏巫師法寶店 — 斜角巷最危險的購物體驗" />
  <meta name="twitter:description" content="喬治・弗雷・衛斯理精選惡作劇法寶，庫存有限！" />
  <meta http-equiv="refresh" content="0;url=${esc(origin)}/" />
</head>
<body><p>正在重導至衛氏巫師法寶店...</p></body>
</html>`

// 中文註解：文具店掩護頁 OG HTML（Mischief Managed 模式，spec §12.5）
const buildStationeryOgHtml = (origin: string): string => `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>怪洛克文具批發 — 您值得信賴的文具夥伴</title>
  <meta name="description" content="怪洛克文具批發股份有限公司，提供各式文具批發零售業務，品質保證，服務至上。" />
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="怪洛克文具批發 — 您值得信賴的文具夥伴" />
  <meta property="og:description" content="怪洛克文具批發股份有限公司，提供各式文具批發零售業務，品質保證，服務至上。" />
  <meta property="og:url"         content="${esc(origin)}/stationery" />
  <meta property="og:site_name"   content="怪洛克文具批發股份有限公司" />
  <meta property="og:locale"      content="zh_TW" />
  <meta name="twitter:card"        content="summary" />
  <meta name="twitter:title"       content="怪洛克文具批發 — 您值得信賴的文具夥伴" />
  <meta name="twitter:description" content="怪洛克文具批發股份有限公司，文具批發零售，品質保證。" />
  <meta http-equiv="refresh" content="0;url=${esc(origin)}/stationery" />
</head>
<body><p>正在重導至怪洛克文具批發...</p></body>
</html>`

// 中文註解：商品頁 OG HTML（含 JSON-LD Product Schema，spec §12.5）
const buildProductOgHtml = (
  origin: string,
  product: { p_id: string; name: string; description: string | null; danger_level: number; media_url: string | null },
  skus: { price_knut: string | number; stock: number }[],
): string => {
  const title   = `${esc(product.name)} — 衛氏巫師法寶店`
  const stars   = dangerStars(product.danger_level)
  const desc    = esc(`危險等級 ${stars}。${product.description ?? ''}`)
  const image   = product.media_url ? esc(product.media_url) : ''
  const url     = `${esc(origin)}/product/${esc(product.p_id)}`
  const firstSku = skus[0]
  const price   = firstSku ? knutToGalleon(Number(firstSku.price_knut)) : '0.00'
  const totalStock = skus.reduce((sum, s) => sum + s.stock, 0)
  const availability = totalStock > 0
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: `危險等級 ${stars}。${product.description ?? ''}`,
    ...(product.media_url ? { image: product.media_url } : {}),
    brand: { '@type': 'Brand', name: '衛氏巫師法寶店' },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'Galleon',
      availability,
      url: `${origin}/product/${product.p_id}`,
    },
  })

  return `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <meta property="og:type"         content="product" />
  <meta property="og:title"        content="${title}" />
  <meta property="og:description"  content="${desc}" />
  ${image ? `<meta property="og:image"        content="${image}" />
  <meta property="og:image:width"  content="400" />
  <meta property="og:image:height" content="400" />` : ''}
  <meta property="og:url"          content="${url}" />
  <meta property="og:site_name"    content="衛氏巫師法寶店" />
  <meta property="og:locale"       content="zh_TW" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
  <script type="application/ld+json">${jsonLd}</script>
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body><p>正在重導至 ${esc(product.name)}...</p></body>
</html>`
}

// ── 主 middleware ──────────────────────────────────────────────────────────

export const ogMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const ua = (req.headers['user-agent'] ?? '').trim()

  // 中文註解：非社群爬蟲 → 跳過，交由後續 middleware / SPA 處理
  if (!isSocialBot(ua)) return next()

  const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`
  const path   = req.path

  try {
    // ── 商品頁 /product/:id ──
    const productMatch = path.match(/^\/product\/([^/]+)$/)
    if (productMatch) {
      const pid = productMatch[1]
      const product = await prisma.product.findUnique({
        where: { p_id: pid },
        include: { skus: true },
      })
      if (product && !product.is_hidden) {
        return res.type('html').send(buildProductOgHtml(origin, product, product.skus))
      }
    }

    // ── 文具店 /stationery ──
    if (path === '/stationery') {
      return res.type('html').send(buildStationeryOgHtml(origin))
    }

    // ── 首頁 / ──
    if (path === '/' || path === '') {
      return res.type('html').send(buildHomeOgHtml(origin))
    }

    // 中文註解：其他路由（後台、搜尋等）爬蟲不需要 OG，直接放行
    return next()
  } catch {
    // 中文註解：資料庫查詢失敗時靜默跳過，不影響正常使用者
    return next()
  }
}
