import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 使用者個人設定（儲存於 localStorage）
export interface ProfileData {
  displayName: string    // 顯示名稱
  phone: string          // 聯絡電話
  postalCode: string     // 預設郵遞區號
  address: string        // 預設收件地址
  vaultLastFive: string  // 古靈閣金庫帳號末五碼
}

interface ProfileStore extends ProfileData {
  update: (data: Partial<ProfileData>) => void
  reset: () => void
}

const DEFAULT: ProfileData = {
  displayName: '',
  phone: '',
  postalCode: '',
  address: '',
  vaultLastFive: '',
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      ...DEFAULT,
      // 更新個人資料（部分更新）
      update: (data) => set(prev => ({ ...prev, ...data })),
      // 重置為預設值
      reset: () => set(DEFAULT),
    }),
    { name: 'www-profile-store' }
  )
)
