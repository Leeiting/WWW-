import { create } from 'zustand'
import type { Product, SKUItem } from '../types'
import { apiGet } from '@/api/client'
import { auditLog } from './auditLogStore'

// 將價格轉換為 Knut 總數（最小單位）
export const toKnut = (galleon: number, sickle: number, knut: number): number =>
  galleon * 17 * 29 + sickle * 29 + knut

// localStorage 的 key
const STORAGE_KEY = 'www-products'

// 舊格式商品遷移：若無 skuItems，自動以 price/stock 建立一個「標準版」SKU
const migrateProduct = (p: Product & { skuItems?: SKUItem[] }): Product => {
  if (!p.skuItems || p.skuItems.length === 0) {
    p.skuItems = [{
      id: `SKU-${p.id}-default`,
      productId: p.id,
      spec: '標準版',
      price: p.price,
      stock: p.stock,
    }]
  }
  return p
}

// 初始示範商品（含 SKU 規格，spec §5.1）
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
    skuItems: [
      {
        id: 'SKU-WWW-001-S',
        productId: 'WWW-001-Puke',
        spec: '單顆',
        price: { galleon: 0, sickle: 2, knut: 15 },
        stock: 10,
      },
      {
        id: 'SKU-WWW-001-L',
        productId: 'WWW-001-Puke',
        spec: '6 顆裝',
        price: { galleon: 0, sickle: 12, knut: 0 },
        stock: 5,
      },
    ],
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
    skuItems: [
      {
        id: 'SKU-WWW-002-S',
        productId: 'WWW-002-Decoy',
        spec: '標準版',
        price: { galleon: 1, sickle: 0, knut: 0 },
        stock: 5,
      },
      {
        id: 'SKU-WWW-002-XL',
        productId: 'WWW-002-Decoy',
        spec: '超級版（附後遺症）',
        price: { galleon: 2, sickle: 5, knut: 0 },
        stock: 2,
      },
    ],
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
    skuItems: [
      {
        id: 'SKU-WWW-003-S',
        productId: 'WWW-003-Firework',
        spec: '10 顆裝',
        price: { galleon: 5, sickle: 0, knut: 0 },
        stock: 3,
      },
      {
        id: 'SKU-WWW-003-L',
        productId: 'WWW-003-Firework',
        spec: '50 顆裝（石內卜特厭）',
        price: { galleon: 20, sickle: 0, knut: 0 },
        stock: 1,
      },
    ],
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
    skuItems: [
      {
        id: 'SKU-WWW-004-10ml',
        productId: 'WWW-004-Love',
        spec: '10ml 試用裝',
        price: { galleon: 2, sickle: 10, knut: 0 },
        stock: 0,
      },
      {
        id: 'SKU-WWW-004-50ml',
        productId: 'WWW-004-Love',
        spec: '50ml 正裝',
        price: { galleon: 10, sickle: 0, knut: 0 },
        stock: 0,
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'WWW-005-Shield',
    name: '魔法護盾護身符',
    category: 'defense',
    price: { galleon: 3, sickle: 5, knut: 0 },
    stock: 8,
    dangerLevel: 1,
    mediaUrl: '',
    isHidden: false,
    description: '可抵擋輕度魔咒的護身符，對「蠢蛋咒」效果尤佳。不保證對阿瓦達索命有效。',
    skuItems: [
      {
        id: 'SKU-WWW-005-S',
        productId: 'WWW-005-Shield',
        spec: '標準版',
        price: { galleon: 3, sickle: 5, knut: 0 },
        stock: 8,
      },
    ],
    createdAt: new Date().toISOString(),
  },
]

// 從 localStorage 讀取商品，沒有就用預設值；自動遷移舊格式
const loadProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProducts
    const parsed = JSON.parse(raw) as Product[]
    // 中文註解：localStorage 為空陣列時（如被 syncFromApi 清空），回退至預設示範商品
    if (parsed.length === 0) return defaultProducts
    return parsed.map(migrateProduct)
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
  isLoading: boolean   // 中文註解：初次從後端同步中（用於前台骨架卡）
  syncFromApi: () => Promise<void>
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  restockProduct: (id: string, qty: number) => void      // 從辦公室偷回，主 SKU 增加指定數量（最少 5）
  restockSKU: (productId: string, skuId: string, qty: number) => void  // 從辦公室偷回特定 SKU
  setSkuStock: (productId: string, skuId: string, stock: number) => void  // 直接設定 SKU 庫存
  deductStockForOrder: (items: Array<{ productId: string; skuId: string; quantity: number }>) => void  // 下單後扣減 SKU 庫存
  toggleHidden: (id: string) => void        // 隱身咒開關
  addSKU: (productId: string, sku: Omit<SKUItem, 'id' | 'productId'>) => void
  updateSKU: (productId: string, skuId: string, updates: Partial<SKUItem>) => void
  deleteSKU: (productId: string, skuId: string) => void
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: loadProducts(),
  isLoading: true,  // 中文註解：預設 true，等 syncFromApi 完成後改為 false

  // 從後端同步（若後端不可用則保留 localStorage 版本，spec §16.4）
  syncFromApi: async () => {
    set({ isLoading: true })
    try {
      const raw = await apiGet<Array<{
        p_id: string
        name: string
        category: string
        description: string | null
        danger_level: number
        media_url: string | null
        is_hidden: boolean
        created_at: string
        skus: Array<{
          s_id: string
          p_id: string
          spec: string
          price_knut: string | number
          stock: number
          weight_g: number | null
          image_url: string | null
        }>
      }>>('/api/products')

      const products: Product[] = raw.map(p => {
        const skuItems: SKUItem[] = p.skus.map(s => ({
          id: s.s_id,
          productId: s.p_id,
          spec: s.spec,
          price: { galleon: 0, sickle: 0, knut: Number(s.price_knut) }, // 中文註解：前端仍以 Knut 顯示/計算
          stock: s.stock,
          weightG: s.weight_g ?? undefined,
          imageUrl: s.image_url ?? undefined,
        }))
        const first = skuItems[0]
        return {
          id: p.p_id,
          name: p.name,
          category: p.category as never,
          price: first?.price ?? { galleon: 0, sickle: 0, knut: 0 },
          stock: first?.stock ?? 0,
          dangerLevel: (p.danger_level as 1|2|3|4|5) ?? 1,
          mediaUrl: p.media_url ?? '',
          isHidden: p.is_hidden,
          description: p.description ?? '',
          skuItems,
          createdAt: p.created_at,
        }
      })

      // 中文註解：後端回傳空陣列時（如 DB 剛初始化），保留 localStorage 既有商品，避免覆蓋
      if (products.length > 0) {
        saveProducts(products)
        set({ products, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      // 後端不可用：不覆蓋本地資料，但仍結束 loading 狀態
      set({ isLoading: false })
    }
  },

  // 新增商品（同步建立對應 skuItems）
  addProduct: (product) => {
    const id = `WWW-${String(Date.now()).slice(-3)}-${product.name.slice(0, 4)}`
    // 若未提供 skuItems，依主定價自動建立「標準版」SKU
    const skuItems: SKUItem[] = product.skuItems?.length
      ? product.skuItems.map((s, i) => ({
          ...s,
          id: `SKU-${id}-${i}`,
          productId: id,
        }))
      : [{
          id: `SKU-${id}-default`,
          productId: id,
          spec: '標準版',
          price: product.price,
          stock: product.stock,
        }]
    const newProduct: Product = {
      ...product,
      id,
      skuItems,
      createdAt: new Date().toISOString(),
    }
    const updated = [...get().products, newProduct]
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'product', action: '新增商品', target: product.name, detail: `ID: ${id}，規格數：${skuItems.length}` })
  },

  // 更新商品
  updateProduct: (id, updates) => {
    const name = get().products.find(p => p.id === id)?.name ?? id
    const updated = get().products.map(p => p.id === id ? { ...p, ...updates } : p)
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'product', action: '編輯商品', target: name })
  },

  // 刪除商品
  deleteProduct: (id) => {
    const name = get().products.find(p => p.id === id)?.name ?? id
    const updated = get().products.filter(p => p.id !== id)
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'product', action: '刪除商品', target: name })
  },

  // 從辦公室偷回：第一個 SKU 庫存 += qty（最少 5，同步更新主庫存）
  restockProduct: (id, qty) => {
    const safeQty = Math.max(5, qty)
    const p = get().products.find(p => p.id === id)
    const oldStock = p?.skuItems[0]?.stock ?? p?.stock ?? 0
    const updated = get().products.map(p => {
      if (p.id !== id) return p
      const skuItems = p.skuItems.map((s, i) => i === 0 ? { ...s, stock: s.stock + safeQty } : s)
      const newStock = (p.skuItems[0]?.stock ?? p.stock) + safeQty
      return { ...p, stock: newStock, skuItems }
    })
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'inventory', action: '從辦公室偷回', target: p?.name ?? id, detail: `庫存 ${oldStock} → ${oldStock + safeQty}` })
  },

  // 從辦公室偷回特定 SKU：庫存 += qty（最少 5）
  restockSKU: (productId, skuId, qty) => {
    const safeQty = Math.max(5, qty)
    const p = get().products.find(p => p.id === productId)
    const sku = p?.skuItems.find(s => s.id === skuId)
    const oldStock = sku?.stock ?? 0
    const updated = get().products.map(p => {
      if (p.id !== productId) return p
      const skuItems = p.skuItems.map(s => s.id === skuId ? { ...s, stock: s.stock + safeQty } : s)
      // 同步更新主庫存（取第一個 SKU 庫存）
      const stock = skuItems[0]?.stock ?? p.stock
      return { ...p, stock, skuItems }
    })
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'inventory', action: '補貨（SKU）', target: `${p?.name ?? productId} — ${sku?.spec ?? skuId}`, detail: `庫存 ${oldStock} → ${oldStock + safeQty}` })
  },

  // 直接設定特定 SKU 庫存（供庫存管理頁面使用）
  setSkuStock: (productId, skuId, stock) => {
    const clampedStock = Math.max(0, Math.floor(stock))
    const p = get().products.find(p => p.id === productId)
    const sku = p?.skuItems.find(s => s.id === skuId)
    const oldStock = sku?.stock ?? 0
    const updated = get().products.map(p => {
      if (p.id !== productId) return p
      const skuItems = p.skuItems.map(s => s.id === skuId ? { ...s, stock: clampedStock } : s)
      // 同步更新主庫存（取第一個 SKU 庫存）
      const mainStock = skuItems[0]?.stock ?? p.stock
      return { ...p, stock: mainStock, skuItems }
    })
    saveProducts(updated)
    set({ products: updated })
    if (oldStock !== clampedStock) {
      auditLog({ category: 'inventory', action: '調整庫存', target: `${p?.name ?? productId} — ${sku?.spec ?? skuId}`, detail: `${oldStock} → ${clampedStock}` })
    }
  },

  // 下單後扣減 SKU 庫存（本地即時扣減，後端 syncFromApi 後會以後端數據覆蓋）
  deductStockForOrder: (items) => {
    let products = get().products
    for (const { productId, skuId, quantity } of items) {
      products = products.map(p => {
        if (p.id !== productId) return p
        const skuItems = p.skuItems.map(s =>
          s.id === skuId ? { ...s, stock: Math.max(0, s.stock - quantity) } : s
        )
        const mainStock = skuItems[0]?.stock ?? p.stock
        return { ...p, stock: mainStock, skuItems }
      })
    }
    saveProducts(products)
    set({ products })
  },

  // 切換隱身咒
  toggleHidden: (id) => {
    const p = get().products.find(p => p.id === id)
    const newHidden = !p?.isHidden
    const updated = get().products.map(p => p.id === id ? { ...p, isHidden: !p.isHidden } : p)
    saveProducts(updated)
    set({ products: updated })
    auditLog({ category: 'product', action: newHidden ? '隱身咒（隱藏）' : '隱身咒（解除）', target: p?.name ?? id })
  },

  // 新增 SKU 規格
  addSKU: (productId, sku) => {
    const p = get().products.find(pr => pr.id === productId)
    const updated = get().products.map(pr => {
      if (pr.id !== productId) return pr
      const newSku: SKUItem = {
        ...sku,
        id: `SKU-${productId}-${Date.now()}`,
        productId,
      }
      return { ...pr, skuItems: [...pr.skuItems, newSku] }
    })
    saveProducts(updated)
    set({ products: updated })
    // 中文註解：記錄新增規格操作
    auditLog({ category: 'product', action: '新增 SKU 規格', target: p?.name ?? productId, detail: `規格：${sku.spec}` })
  },

  // 更新 SKU 規格
  updateSKU: (productId, skuId, updates) => {
    const p = get().products.find(pr => pr.id === productId)
    const sku = p?.skuItems.find(s => s.id === skuId)
    const updated = get().products.map(pr => {
      if (pr.id !== productId) return pr
      const skuItems = pr.skuItems.map(s => s.id === skuId ? { ...s, ...updates } : s)
      return { ...pr, skuItems }
    })
    saveProducts(updated)
    set({ products: updated })
    // 中文註解：記錄更新規格操作
    auditLog({ category: 'product', action: '更新 SKU 規格', target: p?.name ?? productId, detail: `規格：${sku?.spec ?? skuId}` })
  },

  // 刪除 SKU 規格（至少保留一個）
  deleteSKU: (productId, skuId) => {
    const p = get().products.find(pr => pr.id === productId)
    const sku = p?.skuItems.find(s => s.id === skuId)
    const updated = get().products.map(pr => {
      if (pr.id !== productId) return pr
      if (pr.skuItems.length <= 1) return pr  // 至少保留一個 SKU
      const skuItems = pr.skuItems.filter(s => s.id !== skuId)
      return { ...pr, skuItems }
    })
    saveProducts(updated)
    set({ products: updated })
    // 中文註解：記錄刪除規格操作
    auditLog({ category: 'product', action: '刪除 SKU 規格', target: p?.name ?? productId, detail: `規格：${sku?.spec ?? skuId}` })
  },
}))
