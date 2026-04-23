// 中文註解：IP 守衛 Store（魔法部監控名單，spec §11.2）
// 管理 IP 黑名單的 CRUD，並在前台啟動時偵測訪客 IP 是否命中黑名單
import { create } from 'zustand'
import { apiGet, apiSend } from '@/api/client'
import { auditLog } from './auditLogStore'

export interface IpBlacklistEntry {
  id: number
  ip_cidr: string
  note: string | null
  created_at: string
}

export interface MischiefTriggerLog {
  id: number
  source_ip: string
  trigger_type: 'ip_blacklist' | 'user_agent' | 'rate_limit'  // 中文註解：第 1 / 2 / 3 關對應類型
  note: string | null
  created_at: string
}

export interface MischiefCheckResult {
  triggered: boolean
  reason: 'ip_blacklist' | 'user_agent' | 'rate_limit' | null  // 中文註解：三個非管理員偵測關卡
  matched_rule?: string
}

interface IpGuardStore {
  // 後台管理用：黑名單清單
  blacklist: IpBlacklistEntry[]
  isLoading: boolean
  error: string | null

  // 觸發日誌
  triggerLogs: MischiefTriggerLog[]

  // 管理員自身 IP（讓管理員確認不會誤封自己）
  myIp: string | null

  // 後台 CRUD
  fetchBlacklist: () => Promise<void>
  addIp: (ip_cidr: string, note?: string) => Promise<void>
  deleteIp: (id: number) => Promise<void>
  fetchTriggerLogs: () => Promise<void>
  fetchMyIp: () => Promise<void>

  // 前台用：啟動時偵測（若命中黑名單，回傳 triggered: true）
  checkMischief: () => Promise<MischiefCheckResult>
}

export const useIpGuardStore = create<IpGuardStore>((set, get) => ({
  blacklist: [],
  isLoading: false,
  error: null,
  triggerLogs: [],
  myIp: null,

  // 中文註解：取得黑名單清單（後台管理頁面用）
  fetchBlacklist: async () => {
    set({ isLoading: true, error: null })
    try {
      const list = await apiGet<IpBlacklistEntry[]>('/api/config/ip-blacklist')
      set({ blacklist: list, isLoading: false })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  // 中文註解：新增封鎖 IP / CIDR
  addIp: async (ip_cidr, note) => {
    set({ isLoading: true, error: null })
    try {
      const entry = await apiSend<IpBlacklistEntry>('/api/config/ip-blacklist', 'POST', { ip_cidr, note })
      set(s => ({ blacklist: [entry, ...s.blacklist], isLoading: false }))
      // 中文註解：記錄封鎖 IP 操作
      auditLog({ category: 'security', action: '新增封鎖 IP', target: ip_cidr, detail: note })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
      throw e
    }
  },

  // 中文註解：刪除封鎖 IP（依 id）
  deleteIp: async (id) => {
    set({ isLoading: true, error: null })
    // 中文註解：API 呼叫前先取出條目資訊，以便刪除後仍可記錄 IP
    const entry = get().blacklist.find(e => e.id === id)
    try {
      await apiSend('/api/config/ip-blacklist/' + id, 'DELETE')
      set(s => ({ blacklist: s.blacklist.filter(e => e.id !== id), isLoading: false }))
      // 中文註解：記錄解封 IP 操作
      auditLog({ category: 'security', action: '移除封鎖 IP', target: entry?.ip_cidr ?? String(id), detail: entry?.note ?? undefined })
    } catch (e) {
      set({ isLoading: false, error: (e as Error).message })
    }
  },

  // 中文註解：取得觸發日誌（最近 100 筆）
  fetchTriggerLogs: async () => {
    try {
      const logs = await apiGet<MischiefTriggerLog[]>('/api/config/mischief-triggers')
      set({ triggerLogs: logs })
    } catch { /* 靜默失敗，不影響其他功能 */ }
  },

  // 中文註解：查詢管理員自身目前的 IP（供後台確認不會誤封自己）
  fetchMyIp: async () => {
    try {
      const data = await apiGet<{ ip: string }>('/api/config/my-ip')
      set({ myIp: data.ip })
    } catch { /* 靜默失敗 */ }
  },

  // 中文註解：前台啟動時呼叫，後端比對訪客 IP；管理員 JWT 攜帶者永遠回傳 triggered: false
  checkMischief: async () => {
    try {
      const result = await apiGet<MischiefCheckResult>('/api/config/mischief-check')
      return result
    } catch {
      // 中文註解：後端不可用時不誤觸掩護模式
      return { triggered: false, reason: null }
    }
  },
}))
