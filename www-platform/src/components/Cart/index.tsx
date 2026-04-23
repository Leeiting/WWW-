import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore, formatPrice } from '@/store/cartStore'
import { useProductStore } from '@/store/productStore'
import { useAuthStore } from '@/store/authStore'
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
  const user = useAuthStore(s => s.user)

  // 建立 skuId → 庫存 & 類別 的對照表（從 productStore 讀取 SKU 庫存上限）
  const products = useProductStore(s => s.products)
  const skuStockMap = useMemo(
    () => {
      const map: Record<string, number> = {}
      for (const p of products) {
        for (const s of p.skuItems) {
          map[s.id] = s.stock
        }
      }
      return map
    },
    [products]
  )
  const categoryMap = useMemo(
    () => Object.fromEntries(products.map(p => [p.id, p.category])),
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
              <div
                key={item.skuId}
                className={`${styles.item} ${item.locked ? styles.itemLocked : ''}`}
              >
                {/* 鎖定品項顯示特殊圖示，一般品項顯示類別 emoji */}
                <span className={styles.itemEmoji}>
                  {item.locked ? '⚡' : (CATEGORY_EMOJI[categoryMap[item.productId] ?? 'prank'] ?? '🎁')}
                </span>
                <div className={styles.itemInfo}>
                  {/* 商品名稱 + 規格標籤 */}
                  <p className={styles.itemName}>
                    {item.productName}
                    {item.skuSpec && item.skuSpec !== '標準版' && (
                      <span className={styles.skuBadge}>{item.skuSpec}</span>
                    )}
                    {/* 中文註解：鎖定品項（spec §10.3）顯示鎖定標記，提示用戶不可刪改 */}
                    {item.locked && <span className={styles.lockedBadge}>🔒 不可取消</span>}
                  </p>
                  <p className={styles.itemPrice}>
                    {formatPrice(item.displayPrice)} × {item.quantity}
                    　＝　{formatPrice(item.displayPrice * item.quantity)}
                  </p>
                </div>

                {/* 數量調整：鎖定品項隱藏按鈕，只顯示數量 */}
                {item.locked ? (
                  <span className={styles.lockedQty}>{item.quantity}</span>
                ) : (
                  <div className={styles.qtyControl}>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQty(item.skuId, item.quantity - 1)}
                    >－</button>
                    <span className={styles.qty}>{item.quantity}</span>
                    <button
                      className={styles.qtyBtn}
                      onClick={() => updateQty(item.skuId, item.quantity + 1)}
                      disabled={item.quantity >= (skuStockMap[item.skuId] ?? Infinity)}
                      title={item.quantity >= (skuStockMap[item.skuId] ?? Infinity) ? '已達庫存上限' : undefined}
                    >＋</button>
                  </div>
                )}

                {/* 移除：鎖定品項不顯示刪除按鈕 */}
                {!item.locked && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeItem(item.skuId)}
                    title="移除商品"
                  >🗑</button>
                )}
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

            {/* 榮恩稅說明（若已辨識為榮恩才顯示） */}
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

            {user ? (
              <button className={styles.checkoutBtn} onClick={onCheckout}>
                前往結帳 →
              </button>
            ) : (
              <div className={styles.loginPrompt}>
                <p className={styles.loginPromptText}>⚠️ 請先登入才能下訂單</p>
                <Link to="/auth" className={styles.loginPromptBtn} onClick={onClose}>
                  🦉 前往登入 / 註冊
                </Link>
              </div>
            )}
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
