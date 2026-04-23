import { create } from 'zustand'

// 日誌類別（對應不同操作模組）
export type LogCategory =
  | 'product'    // 商品管理
  | 'order'      // 訂單管理
  | 'inventory'  // 庫存補貨
  | 'coupon'     // 折價券管理
  | 'config'     // 系統設定 / Prank Console
  | 'refund'     // 退款審核
  | 'security'   // IP 守衛 / 黑名單管理

// 單筆日誌記錄
export interface AuditLog {
  id: string           // 唯一識別碼（timestamp + random）
  at: string           // ISO 8601 時間戳
  category: LogCategory
  action: string       // 動作描述（例：「新增商品」、「訂單出貨」）
  target: string       // 受影響對象（例：商品名稱、訂單 ID）
  detail?: string      // 補充細節（例：「庫存 5 → 10」、「地址已更新」）
}

// 最多保留筆數（超過後自動刪除最舊的）
const MAX_LOGS = 500
const STORAGE_KEY = 'www-audit-logs'

// 從 localStorage 讀取日誌
const loadLogs = (): AuditLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuditLog[]) : []
  } catch {
    return []
  }
}

// 寫入 localStorage
const saveLogs = (logs: AuditLog[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch {
    // ignore quota error
  }
}

interface AuditLogStore {
  logs: AuditLog[]
  // 新增一筆日誌（自動截斷超過 MAX_LOGS 的舊資料）
  addLog: (entry: Omit<AuditLog, 'id' | 'at'>) => void
  // 清除全部日誌
  clearAll: () => void
  // 清除指定日期之前的日誌
  clearBefore: (isoDate: string) => void
}

export const useAuditLogStore = create<AuditLogStore>((set, get) => ({
  logs: loadLogs(),

  addLog: (entry) => {
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      ...entry,
    }
    // 中文註解：最新的排最前，超過上限就截去尾端最舊的
    const logs = [newLog, ...get().logs].slice(0, MAX_LOGS)
    saveLogs(logs)
    set({ logs })
  },

  clearAll: () => {
    saveLogs([])
    set({ logs: [] })
  },

  clearBefore: (isoDate) => {
    const logs = get().logs.filter(l => l.at >= isoDate)
    saveLogs(logs)
    set({ logs })
  },
}))

// 中文註解：非 React 環境（store 內部）可用此 helper 直接記錄日誌，不需呼叫 hook
export const auditLog = (entry: Omit<AuditLog, 'id' | 'at'>) =>
  useAuditLogStore.getState().addLog(entry)
