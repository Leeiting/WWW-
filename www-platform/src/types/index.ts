// 商品魔法類別
export type ProductCategory =
  | 'prank'         // 惡作劇
  | 'defense'       // 防禦咒
  | 'love_potion'   // 愛情魔藥
  | 'fireworks'     // 奇妙煙火
  | 'magical_beast' // 魔法生物

// 商品價格（三種貨幣單位）
export interface ProductPrice {
  galleon: number  // 金加隆
  sickle: number   // 銀閃
  knut: number     // 納特
}

// 商品
export interface Product {
  id: string                        // UUID，格式：WWW-001-Puke
  name: string                      // 商品名稱
  category: ProductCategory         // 魔法類別
  price: ProductPrice               // 定價
  stock: number                     // 庫存量（0 = 石內卜來訪）
  dangerLevel: 1 | 2 | 3 | 4 | 5   // 危險等級
  mediaUrl: string                  // .gif 或 .mp4 動圖 URL
  isHidden: boolean                 // 隱身咒（true = 前台不顯示）
  description: string               // 商品描述
  createdAt: string                 // ISO 8601 時間戳記
}

// 購物車項目
export interface CartItem {
  productId: string
  productName: string
  quantity: number
  basePrice: number      // 原始價格（以 Knut 為最小單位）
  displayPrice: number   // 惡搞模式下的即時顯示價格
}

// 系統設定（惡搞開關）
export interface SystemConfig {
  prankModeEnabled: boolean      // 惡搞模式（動態定價）
  howlerModeEnabled: boolean     // 吼叫信模式
  peevesPatrolActive: boolean    // 飛七巡邏
  misManagedActive: boolean      // Mischief Managed 掩護模式
  priceRandomMin: number         // 惡搞定價係數下限（預設 0.5）
  priceRandomMax: number         // 惡搞定價係數上限（預設 5.0）
}

// 配送方式
export type DeliveryMethod =
  | 'instant'     // 消影術
  | 'broom'       // 飛天掃帚
  | 'thestral'    // 騎士墜鬼馬
  | 'knight_bus'  // 騎士公車
