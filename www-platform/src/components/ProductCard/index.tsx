import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'
import { usePrankPrice } from '@/hooks/usePrankPrice'
import { toKnut } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import { usePrankStore } from '@/store/prankStore'
import styles from './ProductCard.module.css'

// 魔法類別中文對照
const CATEGORY_LABELS: Record<string, string> = {
  prank: '惡作劇',
  defense: '防禦咒',
  love_potion: '愛情魔藥',
  fireworks: '奇妙煙火',
  magical_beast: '魔法生物',
}

// 類別 emoji
const CATEGORY_EMOJI: Record<string, string> = {
  prank: '🃏',
  defense: '🛡️',
  love_potion: '💘',
  fireworks: '✨',
  magical_beast: '🐉',
}

// 危險等級佔位 emoji
const MEDIA_PLACEHOLDER: Record<number, string> = {
  1: '🧪', 2: '🎪', 3: '⚠️', 4: '💥', 5: '☠️',
}

interface ProductCardProps {
  product: Product
  /** 每張卡片固定的隨機旋轉角度（由父元件決定，避免重渲染跳動） */
  rotation: number
}

const ProductCard = ({ product, rotation }: ProductCardProps) => {
  const { id, name, category, dangerLevel, mediaUrl, description, skuItems } = product
  const addItem = useCartStore(s => s.addItem)
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)

  // SKU 選擇狀態（預設選第一個 SKU）
  const [selectedSkuIdx, setSelectedSkuIdx] = useState(0)
  const selectedSku = skuItems[selectedSkuIdx] ?? skuItems[0]

  // 目前購物車中此 SKU 的數量（用於限制不超過庫存）
  const cartQty = useCartStore(s => s.items.find(i => i.skuId === selectedSku?.id)?.quantity ?? 0)

  // 基礎價格（Knut）— 依選中 SKU 計算
  const basePrice = useMemo(
    () => selectedSku
      ? toKnut(selectedSku.price.galleon, selectedSku.price.sickle, selectedSku.price.knut)
      : toKnut(product.price.galleon, product.price.sickle, product.price.knut),
    [selectedSku, product.price]
  )

  // 惡搞模式下的即時跳動價格（僅視覺，不影響結帳，spec §10.2）
  const displayPrice = usePrankPrice(basePrice)

  // 中文註解：顯示實際庫存（不扣購物車數量），庫存只在訂單成立後才減少
  const availableStock = selectedSku?.stock ?? 0
  const isOutOfStock = availableStock === 0
  const isAtMax = !isOutOfStock && cartQty >= availableStock
  const isExtremeDanger = dangerLevel === 5
  const hasMultipleSkus = skuItems.length > 1

  const cardClass = [
    styles.card,
    isOutOfStock ? styles.outOfStock : '',
    isExtremeDanger ? styles.extremeDanger : '',
  ].join(' ')

  const handleAddToCart = () => {
    if (!selectedSku || isOutOfStock || isAtMax) return
    addItem({
      productId: id,
      skuId: selectedSku.id,
      skuSpec: selectedSku.spec,
      productName: name,
      // 圖片快照：優先用 SKU 專屬圖，否則取商品主圖（後台換圖不影響歷史訂單）
      imageUrl: selectedSku.imageUrl ?? mediaUrl ?? undefined,
      basePrice,     // 加入購物車時快照原始定價（spec §10.2）
      displayPrice,  // 供購物車側邊欄顯示跳動價格
    })
  }

  return (
    <div
      className={cardClass}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* 黑魔標記（危險等級=5） */}
      {isExtremeDanger && (
        <span className={styles.darkMark} title="極度危險">☠</span>
      )}

      {/* 媒體區：點擊跳轉商品詳情頁 */}
      <Link to={`/product/${id}`} className={styles.mediaLink}>
        <div className={styles.media}>
          {/* 中文註解：優先顯示目前選中 SKU 的專屬圖；無則顯示商品主圖 */}
          {(() => {
            const displayUrl = selectedSku?.imageUrl || mediaUrl
            if (displayUrl) {
              return displayUrl.endsWith('.mp4')
                ? <video src={displayUrl} autoPlay loop muted playsInline />
                : <img src={displayUrl} alt={name} />
            }
            return (
              <span className={styles.mediaPlaceholder}>
                {MEDIA_PLACEHOLDER[dangerLevel] ?? '🧙'}
              </span>
            )
          })()}
        </div>
      </Link>

      {/* 卡片內容 */}
      <div className={styles.body}>
        {/* 類別標籤 */}
        <span className={styles.categoryBadge}>
          {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category] ?? category}
        </span>

        {/* 商品名稱：點擊跳轉詳情頁 */}
        <Link to={`/product/${id}`} className={styles.nameLink}>
          <h3 className={`${styles.name} ${isExtremeDanger ? styles.dangerTitle : ''}`}>
            {name}
          </h3>
        </Link>

        {/* 危險等級星星 */}
        <div className={styles.stars} title={`危險等級 ${dangerLevel}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < dangerLevel ? styles.starFilled : styles.starEmpty}>
              {i < dangerLevel ? '★' : '☆'}
            </span>
          ))}
        </div>

        {/* 商品描述（卡片截兩行，詳情頁可看完整） */}
        <p className={styles.description}>{description}</p>

        {/* SKU 規格選擇（多規格時顯示，spec §6.1） */}
        {hasMultipleSkus && (
          <div className={styles.skuSelector}>
            {skuItems.map((sku, idx) => (
              <button
                key={sku.id}
                className={`${styles.skuBtn} ${selectedSkuIdx === idx ? styles.skuBtnActive : ''} ${sku.stock === 0 ? styles.skuBtnSoldOut : ''}`}
                onClick={() => setSelectedSkuIdx(idx)}
                disabled={sku.stock === 0}
                title={sku.stock === 0 ? '此規格已被石內卜沒收' : `庫存：${sku.stock}`}
              >
                {sku.spec}
                {sku.stock === 0 && <span className={styles.skuSoldOutMark}>✗</span>}
              </button>
            ))}
          </div>
        )}

        {/* 庫存數量（顯示剩餘可購數量，已扣除購物車中數量） */}
        <p className={styles.stock}>
          {!isOutOfStock && `庫存：${availableStock} 件`}
        </p>

        {/* 價格（依選中 SKU 顯示） */}
        <div className={styles.priceRow}>
          <span className={styles.priceIcon}>💰</span>
          <span className={`${styles.price} ${prankModeEnabled ? styles.prankPrice : ''}`}>
            {formatPrice(displayPrice)}
          </span>
        </div>
      </div>

      {/* 按鈕 */}
      <div className={styles.footer}>
        {isOutOfStock ? (
          <button className={styles.soldOutBtn} disabled>
            石內卜來訪：已被沒收
          </button>
        ) : isAtMax ? (
          <button className={styles.soldOutBtn} disabled>
            已達庫存上限（{selectedSku?.stock} 件）
          </button>
        ) : (
          <button className={styles.buyBtn} onClick={handleAddToCart}>
            立即交出金加隆
          </button>
        )}
      </div>
    </div>
  )
}

export default ProductCard
