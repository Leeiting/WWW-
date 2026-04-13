import { create } from 'zustand'
import type { CartItem } from '../types'

interface CartStore {
  items: CartItem[]
  isRon: boolean                                   // 是否為榮恩・衛斯理
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, quantity: number) => void
  setIsRon: (value: boolean) => void
  clearCart: () => void
  subtotal: () => number    // 原始小計（Knut）
  total: () => number       // 含榮恩稅後的總計（Knut）
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isRon: false,

  // 加入購物車（已有則增加數量）
  addItem: (item) => {
    const existing = get().items.find(i => i.productId === item.productId)
    if (existing) {
      set({
        items: get().items.map(i =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    } else {
      set({ items: [...get().items, { ...item, quantity: 1 }] })
    }
  },

  // 移除商品
  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.productId !== productId) })
  },

  // 更新數量
  updateQty: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set({
      items: get().items.map(i =>
        i.productId === productId ? { ...i, quantity } : i
      ),
    })
  },

  // 設定榮恩身份
  setIsRon: (value) => set({ isRon: value }),

  // 清空購物車
  clearCart: () => set({ items: [], isRon: false }),

  // 原始小計（所有商品 displayPrice × 數量，Knut 單位）
  subtotal: () =>
    get().items.reduce((sum, item) => sum + item.displayPrice * item.quantity, 0),

  // 最終總計（榮恩稅 × 2）
  total: () => {
    const sub = get().subtotal()
    return get().isRon ? sub * 2 : sub
  },
}))

// 將 Knut 轉回顯示格式
export const formatPrice = (knut: number): string => {
  const galleon = Math.floor(knut / (17 * 29))
  const remaining = knut % (17 * 29)
  const sickle = Math.floor(remaining / 29)
  const knutLeft = remaining % 29
  const parts: string[] = []
  if (galleon > 0) parts.push(`${galleon} 金加隆`)
  if (sickle > 0) parts.push(`${sickle} 銀閃`)
  if (knutLeft > 0 || parts.length === 0) parts.push(`${knutLeft} 納特`)
  return parts.join(' ')
}
