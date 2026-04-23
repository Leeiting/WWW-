import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auditLog } from './auditLogStore'

// 惡搞狀態介面
interface PrankStore {
  prankModeEnabled: boolean      // 惡搞模式（動態定價跳動）
  howlerModeEnabled: boolean     // 吼叫信模式已啟用（後台 toggle）
  howlerConfirmed: boolean       // 後台已點擊「確認警報」→ 前台才顯示橫幅
  peevesPatrolActive: boolean    // 飛七巡邏（浮動圖層）
  misManagedActive: boolean      // Mischief Managed（切換文具店）

  togglePrankMode: () => void
  toggleHowlerMode: () => void
  confirmHowler: () => void      // 後台確認警報，前台開始顯示
  triggerPeevesPatrol: () => void
  dismissPeevesPatrol: () => void
  activateMischiefManaged: () => void    // 一鍵掩護：關閉所有特效 + 切換文具店
  deactivateMischiefManaged: () => void  // 解除掩護：恢復原狀
}

export const usePrankStore = create<PrankStore>()(
  // persist 將狀態同步到 localStorage，讓後台與前台（不同分頁）共享
  persist(
    (set, get) => ({
      prankModeEnabled: false,
      howlerModeEnabled: false,
      howlerConfirmed: false,
      peevesPatrolActive: false,
      misManagedActive: false,

      togglePrankMode: () => {
        const next = !get().prankModeEnabled
        set({ prankModeEnabled: next })
        auditLog({ category: 'config', action: next ? '開啟惡搞模式' : '關閉惡搞模式', target: 'Prank Console' })
      },

      // 關閉時同步重置確認狀態，下次開啟需重新確認
      toggleHowlerMode: () => {
        const next = !get().howlerModeEnabled
        set(s => ({
          howlerModeEnabled: !s.howlerModeEnabled,
          howlerConfirmed: s.howlerModeEnabled ? false : s.howlerConfirmed,
        }))
        auditLog({ category: 'config', action: next ? '開啟吼叫信' : '關閉吼叫信', target: 'Prank Console' })
      },

      // 後台點擊確認後，前台才顯示橫幅
      confirmHowler: () => set({ howlerConfirmed: true }),

      triggerPeevesPatrol: () => {
        set({ peevesPatrolActive: true })
        auditLog({ category: 'config', action: '啟動飛七巡邏', target: 'Prank Console' })
      },

      dismissPeevesPatrol: () =>
        set({ peevesPatrolActive: false }),

      // 一鍵啟動 Mischief Managed：關閉所有惡搞，前台偽裝文具店
      activateMischiefManaged: () => {
        const { prankModeEnabled, howlerModeEnabled } = get()
        // 儲存目前惡搞狀態（解除時恢復）
        localStorage.setItem(
          'www-prank-snapshot',
          JSON.stringify({ prankModeEnabled, howlerModeEnabled })
        )
        set({
          misManagedActive: true,
          prankModeEnabled: false,
          howlerModeEnabled: false,
          howlerConfirmed: false,
          peevesPatrolActive: false,
        })
        auditLog({ category: 'config', action: '啟動 Mischief Managed', target: '掩護模式', detail: '前台切換為文具店' })
      },

      // 解除掩護：恢復之前的惡搞狀態
      deactivateMischiefManaged: () => {
        try {
          const snapshot = localStorage.getItem('www-prank-snapshot')
          const prev = snapshot ? JSON.parse(snapshot) : {}
          set({ misManagedActive: false, ...prev })
        } catch {
          set({ misManagedActive: false })
        }
        auditLog({ category: 'config', action: '解除 Mischief Managed', target: '掩護模式', detail: '前台恢復法寶店' })
      },
    }),
    {
      name: 'www-prank-store', // localStorage 鍵名
      // 只持久化開關狀態，不持久化 action 函式
      partialize: (s) => ({
        prankModeEnabled: s.prankModeEnabled,
        howlerModeEnabled: s.howlerModeEnabled,
        howlerConfirmed: s.howlerConfirmed,
        peevesPatrolActive: s.peevesPatrolActive,
        misManagedActive: s.misManagedActive,
      }),
    }
  )
)
