import { useMemo } from 'react'
import { useCartStore, formatPrice } from '@/store/cartStore'
import { useProductStore } from '@/store/productStore'
import styles from './Cart.module.css'

const CATEGORY_EMOJI: Record<string, string> = {
  prank: '🃏', defense: '🛡️', love_potion: '💘',
  fireworks: '✨', magical_beast: '🐉',
}

interface CartProps {
  onClose: () => void
  onCheckout: () => void
}

const Cart = ({ onClose, onCheckout }: CartProps) => {
  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.subtotal)
  const total = useCartStore(s => s.total)
  const isRon = useCartStore(s => s.isRon)
  const updateQty = useCartStore(s => s.updateQty)
  const removeItem = useCartStore(s => s.removeItem)
  const clearCart = useCartStore(s => s.clearCart)

  // 建立商品 id → 庫存 的對照表，用於限制加購數量
  const products = useProductStore(s => s.products)
  const stockMap = useMemo(
    () => Object.fromEntries(products.map(p => [p.id, p.stock])),
    [products]
  )

  return (
    <>
      {/* 遮罩 */}
      <div className={styles.overlay} onClick={onClose} />

      {/* 側邊欄 */}
      <div className={styles.drawer}>
        {/* 標題 */}
        <div className={styles.header}>
          <h2 className={styles.title}>🛒 購物車</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 商品列表 */}
        {items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🦉</span>
            <p>購物車是空的</p>
            <p>快去挑幾樣惡作劇道具吧！</p>
          </div>
        ) : (
          <div className={styles.itemList}>
            {items.map(item => (
              <div key={item.productId} className={styles.item}>
                <span className={styles.itemEmoji}>
                  {CATEGORY_EMOJI['prank']}
                </span>
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.productName}</p>
                  <p className={styles.itemPrice}>
                    {formatPrice(item.displayPrice)} × {item.quantity}
                    　＝　{formatPrice(item.displayPrice * item.quantity)}
                  </p>
                </div>

                {/* 數量調整 */}
                <div className={styles.qtyControl}>
                  <button
                    className={styles.qtyBtn}
                    onClick={() => updateQty(item.productId, item.quantity - 1)}
                  >－</button>
                  <span className={styles.qty}>{item.quantity}</span>
                  <button
                    className={styles.qtyBtn}
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= (stockMap[item.productId] ?? Infinity)}
                    title={item.quantity >= (stockMap[item.productId] ?? Infinity) ? '已達庫存上限' : undefined}
                  >＋</button>
                </div>

                {/* 移除 */}
                <button
                  className={styles.removeBtn}
                  onClick={() => removeItem(item.productId)}
                  title="移除商品"
                >🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* 結算區 */}
        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.subtotalRow}>
              <span>商品小計</span>
              <span>{formatPrice(subtotal())}</span>
            </div>

            {/* 榮恩稅說明 */}
            {isRon && (
              <div className={styles.subtotalRow} style={{ color: 'var(--red)' }}>
                <span>家屬服務費 100%</span>
                <span>+ {formatPrice(subtotal())}</span>
              </div>
            )}

            <div className={styles.totalRow}>
              <span>總計</span>
              <span>{formatPrice(total())}</span>
            </div>

            <button className={styles.checkoutBtn} onClick={onCheckout}>
              前往結帳 →
            </button>
            <button className={styles.clearBtn} onClick={clearCart}>
              清空購物車
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default Cart
