import { create } from 'zustand'
import { apiGet, apiSend } from '@/api/client'

// 中文註解：API 錯誤訊息格式為 "CODE: 使用者訊息"，只取冒號後的友善說明顯示給使用者
const toUserMsg = (e: unknown): string => {
  const raw = (e as Error).message ?? ''
  const idx = raw.indexOf(': ')
  return idx !== -1 ? raw.slice(idx + 2) : raw
}

export type AuthUser = {
  u_id: string
  email: string
  user_level: 'normal' | 'ron' | 'vip' | 'admin'
  // 第三方登入頭像、顯示名稱、帳號時間戳記
  avatar_url: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

interface AuthStore {
  user: AuthUser | null
  loading: boolean
  error: string
  // 中文註解：登入逾時旗標（token/cookie 過期後偵測到使用者消失時設為 true）
  sessionExpired: boolean

  me: () => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearSessionExpired: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  error: '',
  sessionExpired: false,

  me: async () => {
    const wasLoggedIn = get().user !== null
    set({ loading: true, error: '' })
    try {
      const user = await apiGet<AuthUser | null>('/api/auth/me')
      if (wasLoggedIn && user === null) {
        // 中文註解：原本有登入，但 token/cookie 已過期 → 標記為逾時，由 App.tsx 引導重新登入
        set({ user: null, loading: false, sessionExpired: true })
      } else {
        set({ user, loading: false })
      }
    } catch {
      set({ user: null, loading: false })
    }
  },

  clearSessionExpired: () => set({ sessionExpired: false }),

  register: async (email, password, displayName) => {
    set({ loading: true, error: '' })
    try {
      const user = await apiSend<AuthUser>('/api/auth/register', 'POST', {
        email,
        password,
        display_name: displayName,
      })
      set({ user, loading: false })
    } catch (e) {
      set({ error: toUserMsg(e), loading: false })
      throw e
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: '' })
    try {
      const user = await apiSend<AuthUser>('/api/auth/login', 'POST', { email, password })
      set({ user, loading: false })
    } catch (e) {
      set({ error: toUserMsg(e), loading: false })
      throw e
    }
  },

  logout: async () => {
    set({ loading: true, error: '' })
    try {
      await apiSend('/api/auth/logout', 'POST')
    } finally {
      set({ user: null, loading: false })
    }
  },
}))

