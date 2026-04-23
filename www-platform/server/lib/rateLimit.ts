// 中文註解：後台 API 高頻訪問計數器（spec §11.2 第 3 關 / §11.3）
// 此模組由 server/index.ts 中介層（計數）與 config.ts mischief-check（查詢）共用
// 使用 in-memory Map，伺服器重啟後歸零（不需持久化，僅作即時偵測）

const hitMap = new Map<string, { count: number; resetAt: number }>()

export const RATE_WINDOW_MS = 60_000  // 中文註解：偵測視窗 60 秒
export const RATE_LIMIT     = 30      // 中文註解：每 60 秒最多 30 次（超過視為異常）

// 中文註解：遞增指定 IP 的命中次數，並回傳最新計數
export function incrementHit(ip: string): number {
  const now   = Date.now()
  const entry = hitMap.get(ip) ?? { count: 0, resetAt: now + RATE_WINDOW_MS }

  // 超過視窗時間，重置計數
  if (now > entry.resetAt) {
    entry.count  = 0
    entry.resetAt = now + RATE_WINDOW_MS
  }

  entry.count++
  hitMap.set(ip, entry)
  return entry.count
}

// 中文註解：查詢某 IP 是否已超過閾值（不改變計數）
export function isRateLimitExceeded(ip: string): boolean {
  const entry = hitMap.get(ip)
  if (!entry) return false

  // 視窗已過期，計數自動失效
  if (Date.now() > entry.resetAt) return false

  return entry.count > RATE_LIMIT
}

// 中文註解：取得某 IP 目前的命中次數（供觸發日誌記錄使用）
export function getHitCount(ip: string): number {
  const entry = hitMap.get(ip)
  if (!entry || Date.now() > entry.resetAt) return 0
  return entry.count
}
