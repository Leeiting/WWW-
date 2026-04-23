import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ok, fail } from '../lib/http'
import { readAccessToken, verifyAccessToken } from '../lib/auth'
import { isRateLimitExceeded, getHitCount, RATE_LIMIT } from '../lib/rateLimit'

// 中文註解：魔法部掃描器 User-Agent 關鍵字（spec §11.2 第 2 關）
const SUSPICIOUS_USER_AGENTS = ['MagicMinistry-Scanner']

export const configRouter = Router()

// ── SystemConfig ──────────────────────────────────────────────────────────────

configRouter.get('/', async (_req, res) => {
  const cfg = await prisma.systemConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
  return ok(res, cfg)
})

configRouter.put('/', async (req, res) => {
  const body = req.body as Partial<{
    prank_mode_enabled: boolean
    howler_mode_enabled: boolean
    peeves_patrol_active: boolean
    mis_managed_active: boolean
    price_random_min: number
    price_random_max: number
    // 中文註解：全站折扣欄位
    site_discount_enabled: boolean
    site_discount_label: string
    site_discount_rate: number
  }>

  const updated = await prisma.systemConfig.update({
    where: { id: 1 },
    data: {
      ...(body.prank_mode_enabled !== undefined ? { prank_mode_enabled: body.prank_mode_enabled } : {}),
      ...(body.howler_mode_enabled !== undefined ? { howler_mode_enabled: body.howler_mode_enabled } : {}),
      ...(body.peeves_patrol_active !== undefined ? { peeves_patrol_active: body.peeves_patrol_active } : {}),
      ...(body.mis_managed_active !== undefined ? { mis_managed_active: body.mis_managed_active } : {}),
      ...(body.price_random_min !== undefined ? { price_random_min: body.price_random_min } : {}),
      ...(body.price_random_max !== undefined ? { price_random_max: body.price_random_max } : {}),
      ...(body.site_discount_enabled !== undefined ? { site_discount_enabled: body.site_discount_enabled } : {}),
      ...(body.site_discount_label !== undefined ? { site_discount_label: body.site_discount_label } : {}),
      ...(body.site_discount_rate !== undefined ? { site_discount_rate: body.site_discount_rate } : {}),
    },
  })
  return ok(res, updated)
})

// ── IP 黑名單 CRUD（魔法部監控名單，spec §11.2）────────────────────────────────

// 中文註解：取得所有被封鎖的 IP / CIDR，依新增時間倒序
configRouter.get('/ip-blacklist', async (_req, res) => {
  const list = await prisma.ipBlacklist.findMany({ orderBy: { created_at: 'desc' } })
  return ok(res, list)
})

// 中文註解：新增封鎖 IP / CIDR；ip_cidr 不可重複
configRouter.post('/ip-blacklist', async (req, res) => {
  const { ip_cidr, note } = req.body as { ip_cidr?: string; note?: string }
  if (!ip_cidr?.trim()) return fail(res, 400, 'VALIDATION_ERROR', '請提供 ip_cidr')

  try {
    const entry = await prisma.ipBlacklist.create({
      data: { ip_cidr: ip_cidr.trim(), note: note?.trim() ?? null },
    })
    return ok(res, entry)
  } catch {
    return fail(res, 409, 'CONFLICT', '此 IP / CIDR 已在黑名單中')
  }
})

// 中文註解：刪除封鎖 IP（依 id）
configRouter.delete('/ip-blacklist/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return fail(res, 400, 'VALIDATION_ERROR', '無效的 id')

  try {
    await prisma.ipBlacklist.delete({ where: { id } })
    return ok(res, { deleted: true })
  } catch {
    return fail(res, 404, 'NOT_FOUND', '找不到此黑名單條目')
  }
})

// ── Mischief Managed 觸發日誌 ─────────────────────────────────────────────────

// 中文註解：取得觸發歷史（最近 100 筆）
configRouter.get('/mischief-triggers', async (_req, res) => {
  const logs = await prisma.mischiefTriggerLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 100,
  })
  return ok(res, logs)
})

// ── 管理員自身 IP 查詢（方便確認不會誤封自己）────────────────────────────────

// 中文註解：回傳呼叫者的 IP，方便後台管理員確認自己目前的 IP
configRouter.get('/my-ip', (req, res) => {
  return ok(res, { ip: getClientIp(req) })
})

// ── Mischief Guard 偵測端點（spec §11.2）─────────────────────────────────────

// 中文註解：前台啟動時呼叫此端點，依 spec §11.3 四關依序偵測；管理員永遠繞過
// 執行順序：① Admin Bypass → ② IP 黑名單 → ③ User-Agent → ④ 高頻訪問
configRouter.get('/mischief-check', async (req, res) => {
  const clientIp = getClientIp(req)
  const userAgent = req.headers['user-agent'] ?? ''

  // ── 第 0 關：Admin Bypass（最優先，spec §11.3）──────────────────────────────
  // 中文註解：攜帶有效 admin JWT 的請求永遠跳過所有偵測，確保管理員不會被鎖在門外
  const token = readAccessToken(req)
  if (token) {
    try {
      const payload = verifyAccessToken(token)
      if (payload.user_level === 'admin') {
        return ok(res, { triggered: false, reason: null })
      }
    } catch { /* token 無效或過期，繼續往下偵測 */ }
  }

  // ── 第 1 關：IP 黑名單（spec §11.2 / §11.3）─────────────────────────────────
  const blacklist = await prisma.ipBlacklist.findMany()
  const matched = blacklist.find(entry => ipMatches(clientIp, entry.ip_cidr))
  if (matched) {
    await prisma.mischiefTriggerLog.create({
      data: {
        source_ip: clientIp,
        trigger_type: 'ip_blacklist',
        note: `命中規則：${matched.ip_cidr}${matched.note ? `（${matched.note}）` : ''}`,
      },
    }).catch(() => { /* 記錄失敗不影響回應 */ })
    return ok(res, {
      triggered: true,
      reason: 'ip_blacklist',
      matched_rule: matched.ip_cidr,
    })
  }

  // ── 第 2 關：User-Agent 偵測（spec §11.2 / §11.3）────────────────────────────
  // 中文註解：魔法部掃描器等可疑 UA 自動觸發掩護
  const suspiciousUa = SUSPICIOUS_USER_AGENTS.find(ua => userAgent.includes(ua))
  if (suspiciousUa) {
    await prisma.mischiefTriggerLog.create({
      data: {
        source_ip: clientIp,
        trigger_type: 'user_agent',
        note: `可疑 User-Agent：${userAgent.slice(0, 120)}`,
      },
    }).catch(() => { /* 記錄失敗不影響回應 */ })
    return ok(res, {
      triggered: true,
      reason: 'user_agent',
      matched_rule: suspiciousUa,
    })
  }

  // ── 第 3 關：高頻訪問偵測（spec §11.2 / §11.3）───────────────────────────────
  // 中文註解：查詢共享計數器（由 server/index.ts 中介層累積），超標則觸發
  if (isRateLimitExceeded(clientIp)) {
    const count = getHitCount(clientIp)
    await prisma.mischiefTriggerLog.create({
      data: {
        source_ip: clientIp,
        trigger_type: 'rate_limit',
        note: `mischief-check 偵測：60 秒內命中 ${count} 次，超過閾值 ${RATE_LIMIT}`,
      },
    }).catch(() => { /* 記錄失敗不影響回應 */ })
    return ok(res, {
      triggered: true,
      reason: 'rate_limit',
    })
  }

  return ok(res, { triggered: false, reason: null })
})

// ── 工具函式 ──────────────────────────────────────────────────────────────────

// 中文註解：從 Request 取得真實客戶端 IP（支援 X-Forwarded-For 與 req.ip）
function getClientIp(req: import('express').Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.ip ?? req.socket.remoteAddress ?? '0.0.0.0'
}

// 中文註解：比對 IP 是否命中黑名單條目（支援精確比對與 IPv4 CIDR）
function ipMatches(ip: string, cidr: string): boolean {
  // 精確比對（無斜線）
  if (!cidr.includes('/')) return ip === cidr

  // IPv4 CIDR（如 10.0.0.0/8）
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits)) return false

  const ipNum = ipToNum(ip)
  const rangeNum = ipToNum(range)
  if (ipNum === null || rangeNum === null) return false

  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0
  return (ipNum & mask) === (rangeNum & mask)
}

// 中文註解：將 IPv4 字串轉為 32 位元數字，非 IPv4 回傳 null
function ipToNum(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const nums = parts.map(Number)
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
}
