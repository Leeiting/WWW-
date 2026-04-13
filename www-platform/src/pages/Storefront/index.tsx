import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProductStore } from '@/store/productStore'
import { useCartStore } from '@/store/cartStore'
import { usePrankStore } from '@/store/prankStore'
import ProductCard from '@/components/ProductCard'
import Cart from '@/components/Cart'
import CheckoutModal from '@/components/CheckoutModal'
import type { ProductCategory } from '@/types'
import styles from './Storefront.module.css'

// 魔法類別篩選選項
const CATEGORIES: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部商品' },
  { value: 'prank', label: '🃏 惡作劇' },
  { value: 'defense', label: '🛡️ 防禦咒' },
  { value: 'love_potion', label: '💘 愛情魔藥' },
  { value: 'fireworks', label: '✨ 奇妙煙火' },
  { value: 'magical_beast', label: '🐉 魔法生物' },
]

const HOWLER_BANNER_HEIGHT = 48

const Storefront = () => {
  const products = useProductStore(s => s.products)
  const cartItems = useCartStore(s => s.items)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // 排除隱身咒商品、依類別篩選
  const visibleProducts = useMemo(() =>
    products.filter(p =>
      !p.isHidden &&
      (activeCategory === 'all' || p.category === activeCategory)
    ),
    [products, activeCategory]
  )

  // 每張卡片固定旋轉角（用 id 決定，避免重渲染跳動）
  const rotations = useMemo(() =>
    Object.fromEntries(
      products.map(p => [
        p.id,
        ((p.id.charCodeAt(p.id.length - 1) % 20) - 10) / 10,
      ])
    ),
    [products]
  )

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div
      className={styles.page}
      style={howlerModeEnabled ? { paddingTop: HOWLER_BANNER_HEIGHT } : undefined}
    >
      {/* 管理員快速連結（吼叫信橫幅啟動時往下移，避免被遮住） */}
      <Link
        to="/admin"
        className={styles.adminLink}
        style={howlerModeEnabled ? { top: HOWLER_BANNER_HEIGHT + 16 } : undefined}
      >🔮 後台</Link>

      {/* 頂部 Banner */}
      <header className={styles.banner}>
        <p className={styles.shopNumber}>斜角巷 93 號</p>
        <h1 className={styles.shopTitle}>衛氏巫師法寶店</h1>
        <p className={styles.shopSubtitle}>Weasleys' Wizard Wheezes</p>
        <span className={styles.shopTagline}>Mischief Managed — Or Is It?</span>
      </header>

      {/* 類別篩選列 */}
      <nav className={styles.filterBar}>
        <span className={styles.filterLabel}>魔法類別</span>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            className={`${styles.filterBtn} ${activeCategory === cat.value ? styles.active : ''}`}
            onClick={() => setActiveCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      {/* 商品格狀區 */}
      <main className={styles.content}>
        <p className={styles.sectionTitle}>
          {activeCategory === 'all'
            ? `本店商品（${visibleProducts.length} 件）`
            : `${CATEGORIES.find(c => c.value === activeCategory)?.label}（${visibleProducts.length} 件）`
          }
        </p>

        {visibleProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🦉</div>
            <p>此類別暫無商品，或已被石內卜全數沒收。</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                rotation={rotations[product.id] ?? 0}
              />
            ))}
          </div>
        )}
      </main>

      {/* 購物車浮動按鈕 */}
      {totalCartItems > 0 && (
        <button className={styles.cartFab} onClick={() => setCartOpen(true)}>
          🛒 購物車
          <span className={styles.cartCount}>{totalCartItems}</span>
        </button>
      )}

      {/* 購物車側邊欄 */}
      {cartOpen && (
        <Cart
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        />
      )}

      {/* 結帳彈窗 */}
      {checkoutOpen && (
        <CheckoutModal onClose={() => setCheckoutOpen(false)} />
      )}
    </div>
  )
}

export default Storefront
