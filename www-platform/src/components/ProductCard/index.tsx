import { useMemo } from 'react'
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
  const { id, name, category, price, stock, dangerLevel, mediaUrl, description } = product
  const addItem = useCartStore(s => s.addItem)
  // 目前購物車中此商品的數量（用於限制不超過庫存）
  const cartQty = useCartStore(s => s.items.find(i => i.productId === id)?.quantity ?? 0)
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)

  // 基礎價格（Knut）
  const basePrice = useMemo(
    () => toKnut(price.galleon, price.sickle, price.knut),
    [price]
  )

  // 惡搞模式下的即時跳動價格
  const displayPrice = usePrankPrice(basePrice)

  const isOutOfStock = stock === 0
  const isAtMax = !isOutOfStock && cartQty >= stock   // 已加滿庫存數量
  const isExtremeDanger = dangerLevel === 5

  const cardClass = [
    styles.card,
    isOutOfStock ? styles.outOfStock : '',
    isExtremeDanger ? styles.extremeDanger : '',
  ].join(' ')

  const handleAddToCart = () => {
    if (isOutOfStock || isAtMax) return
    addItem({
      productId: id,
      productName: name,
      basePrice,
      displayPrice,
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

      {/* 媒體區 */}
      <div className={styles.media}>
        {mediaUrl ? (
          mediaUrl.endsWith('.mp4') ? (
            <video src={mediaUrl} autoPlay loop muted playsInline />
          ) : (
            <img src={mediaUrl} alt={name} />
          )
        ) : (
          <span className={styles.mediaPlaceholder}>
            {MEDIA_PLACEHOLDER[dangerLevel] ?? '🧙'}
          </span>
        )}
      </div>

      {/* 卡片內容 */}
      <div className={styles.body}>
        {/* 類別標籤 */}
        <span className={styles.categoryBadge}>
          {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category] ?? category}
        </span>

        {/* 商品名稱 */}
        <h3 className={`${styles.name} ${isExtremeDanger ? styles.dangerTitle : ''}`}>
          {name}
        </h3>

        {/* 危險等級星星 */}
        <div className={styles.stars} title={`危險等級 ${dangerLevel}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < dangerLevel ? styles.starFilled : styles.starEmpty}>
              {i < dangerLevel ? '★' : '☆'}
            </span>
          ))}
        </div>

        {/* 商品描述 */}
        <p className={styles.description}>{description}</p>

        {/* 庫存數量 */}
        <p className={styles.stock}>
          {isOutOfStock ? '' : `庫存：${stock} 件`}
        </p>

        {/* 價格 */}
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
            已達庫存上限（{stock} 件）
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
