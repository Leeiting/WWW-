import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useProductStore } from '@/store/productStore'
import { useCartStore } from '@/store/cartStore'
import { usePrankStore } from '@/store/prankStore'
import { useAuthStore } from '@/store/authStore'
import { useCouponStore } from '@/store/couponStore'
import ProductCard from '@/components/ProductCard'
import Cart from '@/components/Cart'
import CheckoutModal from '@/components/CheckoutModal'
import CouponBanner from '@/components/CouponBanner'
import { useVisitorStore } from '@/store/visitorStore'
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

// 每次顯示的商品批量大小
const PAGE_SIZE = 8

const HOWLER_BANNER_HEIGHT = 48

// 中文註解：CouponBanner 高度常數（供 Storefront 計算頁面頂部 padding 補償）
const COUPON_BANNER_HEIGHT = 38

const Storefront = () => {
  const products = useProductStore(s => s.products)
  const isLoading = useProductStore(s => s.isLoading)   // 中文註解：後端同步中旗標
  const cartItems = useCartStore(s => s.items)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const user = useAuthStore(s => s.user)
  // 中文註解：判斷是否有可見優惠券，決定是否要為 fixed CouponBanner 保留頂部空間
  const isMagicAdmin = user?.email?.toLowerCase().includes('magic_admin') ?? false
  // 中文註解：不可在 selector 內呼叫 filter，否則每次都回傳新陣列，觸發無限重渲染
  const allCoupons = useCouponStore(s => s.coupons)
  const activeCoupons = useMemo(
    () => allCoupons.filter(c => c.active && (!c.ministryOnly || isMagicAdmin)),
    [allCoupons, isMagicAdmin]
  )
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'all'>('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  // 已顯示的商品數量（分批加載）
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  // 加載更多動畫旗標
  const [loadingMore, setLoadingMore] = useState(false)
  // 底部哨兵 ref（Intersection Observer 自動觸發）
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 排除隱身咒商品、依類別篩選
  const visibleProducts = useMemo(() =>
    products.filter(p =>
      !p.isHidden &&
      (activeCategory === 'all' || p.category === activeCategory)
    ),
    [products, activeCategory]
  )

  // 切換類別時重置顯示數量
  useEffect(() => { setDisplayCount(PAGE_SIZE) }, [activeCategory])

  // 當前批次顯示的商品（前 displayCount 筆）
  const displayedProducts = useMemo(
    () => visibleProducts.slice(0, displayCount),
    [visibleProducts, displayCount]
  )
  const allShown = displayedProducts.length >= visibleProducts.length

  // 加載更多（模擬非同步延遲 600ms）
  const loadMore = useCallback(() => {
    if (loadingMore || allShown) return
    setLoadingMore(true)
    setTimeout(() => {
      setDisplayCount(c => c + PAGE_SIZE)
      setLoadingMore(false)
    }, 600)
  }, [loadingMore, allShown])

  // 底部哨兵：進入視窗自動觸發加載更多
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

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

  const recordVisit = useVisitorStore(s => s.recordVisit)
  // 中文註解：前台載入時記錄一次訪客（同 session 只算一次）
  useEffect(() => { recordVisit() }, [recordVisit])

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  // 中文註解：計算頁面頂部 padding：HowlerAlert（fixed）+ CouponBanner（fixed，有券時才顯示）
  const topPadding =
    (howlerModeEnabled ? HOWLER_BANNER_HEIGHT : 0) +
    (activeCoupons.length > 0 ? COUPON_BANNER_HEIGHT : 0)

  return (
    <div
      className={styles.page}
      style={topPadding > 0 ? { paddingTop: topPadding } : undefined}
    >
      {/* 中文註解：首頁 SEO / OG 標籤（spec §12.5）*/}
      <Helmet>
        <title>衛氏巫師法寶店 — 斜角巷最危險的購物體驗</title>
        <meta name="description" content="喬治・弗雷・衛斯理精選惡作劇法寶，讓每次購物都充滿魔法驚喜。庫存有限，魔法部不歡迎！" />
        <meta property="og:type"        content="website" />
        <meta property="og:title"       content="衛氏巫師法寶店 — 斜角巷最危險的購物體驗" />
        <meta property="og:description" content="喬治・弗雷・衛斯理精選惡作劇法寶，讓每次購物都充滿魔法驚喜。庫存有限，魔法部不歡迎！" />
        <meta property="og:url"         content={window.location.origin + '/'} />
        <meta property="og:site_name"   content="衛氏巫師法寶店" />
        <meta property="og:locale"      content="zh_TW" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="衛氏巫師法寶店 — 斜角巷最危險的購物體驗" />
        <meta name="twitter:description" content="喬治・弗雷・衛斯理精選惡作劇法寶，庫存有限！" />
      </Helmet>

      {/* 中文註解：優惠券置頂橫幅（fixed，滾動時釘在頂部，關閉後消失）*/}
      <CouponBanner />

      {/* 頂部 Banner（含右上角快速導覽連結，滾動後會消失）*/}
      <header className={styles.banner}>
        {/* 中文註解：右上角快速導覽（後台 / 訂單 / 個人設定），隨頁面捲動消失，不擋住內容）*/}
        <nav className={styles.headerNav}>
          <Link to={user ? '/my-orders' : '/auth'} className={styles.headerNavLink}>
            {user ? '📋 我的訂單' : '🦉 登入 / 註冊'}
          </Link>
          <Link to="/profile" className={styles.headerNavLink}>⚙️ 個人設定</Link>
        </nav>

        <p className={styles.shopNumber}>斜角巷 93 號</p>
        <h1 className={styles.shopTitle}>衛氏巫師法寶店</h1>
        <p className={styles.shopSubtitle}>Weasleys' Wizard Wheezes</p>
        <span className={styles.shopTagline}>Mischief Managed — Or Is It?</span>
      </header>

      {/* 類別篩選列 */}
      <nav className={styles.filterBar}>
        <Link to="/search" className={styles.searchEntry}>🔍 搜尋商品</Link>
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

        {/* 初次加載：顯示 8 個骨架卡片 */}
        {isLoading ? (
          <div className={styles.grid}>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonImg} />
                <div className={styles.skeletonLine} style={{ width: '70%' }} />
                <div className={styles.skeletonLine} style={{ width: '45%' }} />
                <div className={styles.skeletonLine} style={{ width: '55%' }} />
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🦉</div>
            <p>此類別暫無商品，或已被石內卜全數沒收。</p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {displayedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  rotation={rotations[product.id] ?? 0}
                />
              ))}
            </div>

            {/* 底部哨兵（Intersection Observer 目標） */}
            {!allShown && <div ref={sentinelRef} className={styles.sentinel} />}

            {/* 加載更多旋轉指示器 */}
            {loadingMore && (
              <div className={styles.loadingMore}>
                <span className={styles.loadingSpinner}>🧙</span>
                <span>召喚更多法寶中...</span>
              </div>
            )}

            {/* 全部加載完畢提示 */}
            {allShown && visibleProducts.length > PAGE_SIZE && (
              <div className={styles.allLoaded}>✨ 斜角巷的法寶已全數展示</div>
            )}
          </>
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
