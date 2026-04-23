import { create } from 'zustand'
import { apiGet, apiSend } from '@/api/client'
import { auditLog } from './auditLogStore'

// 全站折扣狀態介面
interface SiteDiscountStore {
  enabled: boolean        // 是否啟用全站折扣
  label: string           // 活動標籤（例：「開學季全館 8 折」）
  rate: number            // 折扣倍率（0.8 = 8折，1.0 = 無折扣）
  syncFromApi: () => Promise<void>
  update: (enabled: boolean, label: string, rate: number) => Promise<void>
}

// 本地快取 key（後端不可用時讀取）
const STORAGE_KEY = 'www-site-discount'

const loadLocal = (): Pick<SiteDiscountStore, 'enabled' | 'label' | 'rate'> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { enabled: false, label: '', rate: 1.0 }
  } catch {
    return { enabled: false, label: '', rate: 1.0 }
  }
}

const saveLocal = (enabled: boolean, label: string, rate: number) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, label, rate }))
}

export const useSiteDiscountStore = create<SiteDiscountStore>((set) => ({
  ...loadLocal(),

  // 從後端同步全站折扣設定
  syncFromApi: async () => {
    try {
      const cfg = await apiGet<{
        site_discount_enabled: boolean
        site_discount_label: string
        site_discount_rate: number
      }>('/api/config')
      const enabled = cfg.site_discount_enabled
      const label   = cfg.site_discount_label
      const rate    = cfg.site_discount_rate
      saveLocal(enabled, label, rate)
      set({ enabled, label, rate })
    } catch {
      // 後端不可用：保留 localStorage 快取
    }
  },

  // 更新全站折扣並同步至後端
  update: async (enabled, label, rate) => {
    saveLocal(enabled, label, rate)
    set({ enabled, label, rate })
    try {
      await apiSend('/api/config', 'PUT', {
        site_discount_enabled: enabled,
        site_discount_label: label,
        site_discount_rate: rate,
      })
    } catch {
      // 後端不可用：僅更新本地狀態
    }
    auditLog({
      category: 'config',
      action: enabled ? '開啟全站折扣' : '關閉全站折扣',
      target: label || '（未命名促銷）',
      detail: enabled ? `折扣率 ${Math.round(rate * 10)} 折` : undefined,
    })
  },
}))
