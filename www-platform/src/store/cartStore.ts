import { create } from 'zustand'
import type { CartItem } from '../types'

interface CartStore {
  items: CartItem[]
  isRon: boolean                    // 榮恩識別結果（結帳時靜默偵測後寫入）

  // 加入購物車：以 skuId 為唯一鍵，同商品不同規格各自計算
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (skuId: string) => void
  updateQty: (skuId: string, quantity: number) => void
  setIsRon: (value: boolean) => void
  clearCart: () => void

  // 顯示小計（用 displayPrice，惡搞模式下為跳動價格，供購物車側邊欄顯示）
  subtotal: () => number
  // 顯示總計（含榮恩稅，供購物車側邊欄顯示）
  total: () => number

  // 實際小計（用 basePrice，結帳時永遠採用原始定價，spec §10.2）
  baseSubtotal: () => number
  // 結帳總計（basePrice 計算 + 榮恩稅，供結帳彈窗使用）
  checkoutTotal: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isRon: false,

  // 加入購物車（以 skuId 為唯一鍵，同 skuId 則增加數量）
  addItem: (item) => {
    const existing = get().items.find(i => i.skuId === item.skuId)
    if (existing) {
      set({
        items: get().items.map(i =>
          i.skuId === item.skuId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    } else {
      set({ items: [...get().items, { ...item, quantity: 1 }] })
    }
  },

  // 移除商品（以 skuId 為鍵；locked 品項不可移除）
  removeItem: (skuId) => {
    const target = get().items.find(i => i.skuId === skuId)
    if (target?.locked) return  // 中文註解：鎖定品項（如魔法攻擊損害賠償）不允許刪除
    set({ items: get().items.filter(i => i.skuId !== skuId) })
  },

  // 更新數量（以 skuId 為鍵；locked 品項不可更改數量）
  updateQty: (skuId, quantity) => {
    const target = get().items.find(i => i.skuId === skuId)
    if (target?.locked) return  // 中文註解：鎖定品項（如魔法攻擊損害賠償）數量不允許變更
    if (quantity <= 0) {
      get().removeItem(skuId)
      return
    }
    set({
      items: get().items.map(i =>
        i.skuId === skuId ? { ...i, quantity } : i
      ),
    })
  },

  // 設定榮恩身份（結帳時靜默偵測後呼叫）
  setIsRon: (value) => set({ isRon: value }),

  // 清空購物車
  clearCart: () => set({ items: [], isRon: false }),

  // 顯示小計（用 displayPrice，惡搞模式下為跳動價格，供購物車側邊欄顯示）
  subtotal: () =>
    get().items.reduce((sum, item) => sum + item.displayPrice * item.quantity, 0),

  // 顯示總計（含榮恩稅，供購物車側邊欄顯示）
  total: () => {
    const sub = get().subtotal()
    return get().isRon ? sub * 2 : sub
  },

  // 實際小計（用 basePrice，結帳時永遠採用原始定價，spec §10.2）
  baseSubtotal: () =>
    get().items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0),

  // 結帳總計（basePrice 計算 + 榮恩稅，供結帳彈窗使用）
  checkoutTotal: () => {
    const sub = get().baseSubtotal()
    return get().isRon ? sub * 2 : sub
  },
}))

// 將 Knut 轉回顯示格式（如：1 金加隆 5 銀閃）
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
