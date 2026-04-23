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

// SKU 規格項目（spec §5.1 SKU_Items）
export interface SKUItem {
  id: string           // UUID，格式：SKU-{productId}-{spec}
  productId: string    // 對應商品 SPU ID
  spec: string         // 規格說明，如「10ml」「50ml」「標準版」
  price: ProductPrice  // 各規格獨立定價
  stock: number        // 各規格獨立庫存
  weightG?: number     // 重量（公克，供運費計算）
  imageUrl?: string    // 規格專屬圖片（選填）
}

// 商品 SPU 主表（spec §5.2）
export interface Product {
  id: string                        // UUID，格式：WWW-001-Puke
  name: string                      // 商品名稱
  category: ProductCategory         // 魔法類別
  price: ProductPrice               // 主要定價（向下相容，同第一個 SKU）
  stock: number                     // 主要庫存（向下相容，同第一個 SKU）
  dangerLevel: 1 | 2 | 3 | 4 | 5   // 危險等級
  mediaUrl: string                  // .gif 或 .mp4 動圖 URL
  isHidden: boolean                 // 隱身咒（true = 前台不顯示）
  description: string               // 商品描述
  skuItems: SKUItem[]               // SKU 規格列表（spec §5.2）
  createdAt: string                 // ISO 8601 時間戳記
}

// 購物車項目（加入購物車時快照 SKU 資訊）
export interface CartItem {
  productId: string    // 商品 SPU ID
  skuId: string        // 對應 SKU ID（不同規格為不同購物車列）
  skuSpec: string      // 規格說明快照（加入時快照，後台改規格不影響購物車）
  productName: string  // 商品名稱快照
  imageUrl?: string    // 商品圖片 URL 快照（加入時快照，後台換圖不影響購物車 / 歷史訂單）
  quantity: number
  basePrice: number    // 原始價格（Knut，加入時快照，不受惡搞模式影響）
  displayPrice: number // 惡搞模式下的即時顯示價格（僅視覺用）
  locked?: boolean     // 鎖定品項（如魔法攻擊損害賠償），不得更改數量或刪除（spec §10.3）
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

// 配送方式（spec §6.2）
export type DeliveryMethod =
  | 'instant'     // 消影術（即時）
  | 'broom'       // 飛天掃帚（1-2 小時）
  | 'thestral'    // 騎士墜鬼馬（1-3 天）
  | 'knight_bus'  // 騎士公車（不定）

// 支付方式（spec §8）
export type PaymentMethod =
  | 'vault_transfer'   // 巫師金庫轉帳（模擬銀行轉帳）
  | 'cash_on_delivery' // 貨到交金加隆（模擬貨到付款）
  | 'mock_card'        // 魔法卡（模擬信用卡）

// 訂單狀態（spec §9.1）
export type OrderStatus =
  | 'unpaid'           // 待付款
  | 'processing'       // 待出貨
  | 'shipped'          // 運送中
  | 'completed'        // 已完成
  | 'cancelled'        // 已取消
  | 'refunding'        // 退款審核中
  | 'return_pending'   // 退貨中：等待用戶寄回商品（spec §6.4）
  | 'shipping_failed'  // 配送異常：貓頭鷹找不到地址（spec §6.4）
  | 'rejected'         // 退款被拒絕：管理員拒絕，可再轉為 completed（spec §6.4）
  | 'refunded'         // 已退款
  | 'refund_failed'    // 已棄用：請用 rejected；保留供舊資料相容

// 訂單明細項目（含資料快照，確保後台改名 / 換圖不影響歷史訂單）
export interface OrderItem {
  skuId: string
  productId: string
  snapshotName: string      // 商品名稱快照（加入購物車時）
  snapshotSpec: string      // 規格說明快照（加入購物車時）
  snapshotImageUrl?: string // 商品圖片快照（加入購物車時）
  quantity: number
  unitPriceKnut: number     // 加入購物車時的快照定價（Knut）
}

// 訂單（spec §5.1 Orders + §5.2 TypeScript 型別）
export interface Order {
  id: string               // UUID
  email: string            // 購物者信箱
  status: OrderStatus
  items: OrderItem[]
  shippingAddress: string  // 收件地址
  shippingMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  couponCode?: string      // 使用的優惠券代碼
  discountKnut: number     // 優惠券折扣金額（Knut）
  subtotalKnut: number     // 商品小計（basePrice 合計）
  shippingFeeKnut: number  // 配送費（Knut）
  isRon: boolean           // 是否為榮恩（後端靜默偵測）
  totalKnut: number        // 訂單總額（含榮恩稅 + 配送費 - 折扣）
  trackingNumber?: string     // 物流單號（出貨後填入）
  idempotencyKey?: string     // 冪等鍵（前端生成 UUID，防重複下單）
  surpriseCouponCode?: string  // 訂單完成後系統自動發放的驚喜納特券代碼
  refundRejectReason?: string  // 管理員拒絕退款時填寫的原因，前台顯示給顧客
  finalCapturedAmount?: number // 付款成功時凍結的實際扣款金額（Knut），退款以此為基準（spec §9.4）
  createdAt: string            // ISO 8601 時間戳記
}
