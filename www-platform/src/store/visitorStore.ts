import { create } from 'zustand'

// 中文註解：訪客計數使用 localStorage 持久化；同一瀏覽器 session 只計一次（sessionStorage 旗標）
const STORAGE_KEY   = 'www-visitor-count'
const SESSION_KEY   = 'www-visited-this-session'

const loadCount = (): number => {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) || 0 } catch { return 0 }
}

interface VisitorStore {
  visitCount: number
  recordVisit: () => void   // 前台每次載入呼叫：同 session 只加一次
  resetCount: () => void    // 後台可重置（僅測試用）
}

export const useVisitorStore = create<VisitorStore>((set, get) => ({
  visitCount: loadCount(),

  recordVisit: () => {
    // 若本 session 已計過，不重複累加
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
    const next = get().visitCount + 1
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
    set({ visitCount: next })
  },

  resetCount: () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ visitCount: 0 })
  },
}))
