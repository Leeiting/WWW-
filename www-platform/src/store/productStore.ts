import { create } from 'zustand'
import type { Product } from '../types'

// 將價格轉換為 Knut 總數（最小單位）
export const toKnut = (galleon: number, sickle: number, knut: number): number =>
  galleon * 17 * 29 + sickle * 29 + knut

// localStorage 的 key
const STORAGE_KEY = 'www-products'

// 初始示範商品
const defaultProducts: Product[] = [
  {
    id: 'WWW-001-Puke',
    name: '嘔吐棒棒糖',
    category: 'prank',
    price: { galleon: 0, sickle: 2, knut: 15 },
    stock: 10,
    dangerLevel: 2,
    mediaUrl: '',
    isHidden: false,
    description: '吃下去後立刻嘔吐，配方源自弗雷的午餐意外。附贈解藥糖，老師懷疑你時立刻吃掉。',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'WWW-002-Decoy',
    name: '誘餌炸彈',
    category: 'prank',
    price: { galleon: 1, sickle: 0, knut: 0 },
    stock: 5,
    dangerLevel: 4,
    mediaUrl: '',
    isHidden: false,
    description: '丟出後爆炸分心，趁機逃跑的神器。爆炸後會留下一團黑煙和令人困惑的臭味。',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'WWW-003-Firework',
    name: '魔法煙火大師套組',
    category: 'fireworks',
    price: { galleon: 5, sickle: 0, knut: 0 },
    stock: 3,
    dangerLevel: 5,
    mediaUrl: '',
    isHidden: false,
    description: '石內卜教授最恨的產品。會自動追蹤龍身，在整棟城堡裡飛竄。',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'WWW-004-Love',
    name: '愛情魔藥（伯蒂版）',
    category: 'love_potion',
    price: { galleon: 2, sickle: 10, knut: 0 },
    stock: 0,
    dangerLevel: 3,
    mediaUrl: '',
    isHidden: false,
    description: '讓對象對你產生強烈迷戀，持續時間依使用者帥氣程度而定。已被石內卜沒收。',
    createdAt: new Date().toISOString(),
  },
]

// 從 localStorage 讀取商品，沒有就用預設值
const loadProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : defaultProducts
  } catch {
    return defaultProducts
  }
}

// 寫入 localStorage
const saveProducts = (products: Product[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

interface ProductStore {
  products: Product[]
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  restockProduct: (id: string) => void  // 從辦公室偷回，庫存恢復為 5
  toggleHidden: (id: string) => void    // 隱身咒開關
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: loadProducts(),

  // 新增商品
  addProduct: (product) => {
    const newProduct: Product = {
      ...product,
      id: `WWW-${String(Date.now()).slice(-3)}-${product.name.slice(0, 4)}`,
      createdAt: new Date().toISOString(),
    }
    const updated = [...get().products, newProduct]
    saveProducts(updated)
    set({ products: updated })
  },

  // 更新商品
  updateProduct: (id, updates) => {
    const updated = get().products.map(p => p.id === id ? { ...p, ...updates } : p)
    saveProducts(updated)
    set({ products: updated })
  },

  // 刪除商品
  deleteProduct: (id) => {
    const updated = get().products.filter(p => p.id !== id)
    saveProducts(updated)
    set({ products: updated })
  },

  // 從辦公室偷回（庫存恢復為 5）
  restockProduct: (id) => {
    const updated = get().products.map(p => p.id === id ? { ...p, stock: 5 } : p)
    saveProducts(updated)
    set({ products: updated })
  },

  // 切換隱身咒
  toggleHidden: (id) => {
    const updated = get().products.map(p => p.id === id ? { ...p, isHidden: !p.isHidden } : p)
    saveProducts(updated)
    set({ products: updated })
  },
}))
