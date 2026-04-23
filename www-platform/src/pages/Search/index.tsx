import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProductStore, toKnut } from '@/store/productStore'
import { useCartStore } from '@/store/cartStore'
import { usePrankStore } from '@/store/prankStore'
import ProductCard from '@/components/ProductCard'
import Cart from '@/components/Cart'
import CheckoutModal from '@/components/CheckoutModal'
import type { ProductCategory } from '@/types'
import styles from './Search.module.css'

// 類別選項
const CATEGORIES: { value: ProductCategory | 'all'; label: string }[] = [
  { value: 'all',           label: '全部' },
  { value: 'prank',         label: '🃏 惡作劇' },
  { value: 'defense',       label: '🛡️ 防禦咒' },
  { value: 'love_potion',   label: '💘 愛情魔藥' },
  { value: 'fireworks',     label: '✨ 奇妙煙火' },
  { value: 'magical_beast', label: '🐉 魔法生物' },
]

// 排序選項
type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'danger_asc' | 'danger_desc' | 'name'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance',   label: '最相關' },
  { value: 'price_asc',   label: '價格：低到高' },
  { value: 'price_desc',  label: '價格：高到低' },
  { value: 'danger_asc',  label: '危險等級：低到高' },
  { value: 'danger_desc', label: '危險等級：高到低' },
  { value: 'name',        label: '名稱排序' },
]

// 計算搜尋相關度分數（名稱命中 > 描述命中）
const getRelevanceScore = (name: string, description: string, query: string): number => {
  if (!query) return 1
  const q = query.toLowerCase()
  const n = name.toLowerCase()
  const d = description.toLowerCase()
  if (n === q) return 100
  if (n.startsWith(q)) return 80
  if (n.includes(q)) return 60
  if (d.includes(q)) return 20
  return 0
}

const HOWLER_BANNER_HEIGHT = 48

const SearchPage = () => {
  const products = useProductStore(s => s.products)
  const cartItems = useCartStore(s => s.items)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)

  // URL 搜尋參數（支援從外部帶入關鍵字）
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  // 篩選條件
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [minDanger, setMinDanger] = useState(1)
  const [maxDanger, setMaxDanger] = useState(5)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('relevance')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // 同步 query 到 URL
  useEffect(() => {
    if (query) setSearchParams({ q: query }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [query, setSearchParams])

  // 固定旋轉角（避免重渲染跳動）
  const rotations = useMemo(() =>
    Object.fromEntries(
      products.map(p => [
        p.id,
        ((p.id.charCodeAt(p.id.length - 1) % 20) - 10) / 10,
      ])
    ),
    [products]
  )

  // 篩選 + 排序
  const results = useMemo(() => {
    const trimmed = query.trim()

    let list = products.filter(p => {
      // 排除隱藏商品
      if (p.isHidden) return false
      // 類別篩選
      if (category !== 'all' && p.category !== category) return false
      // 危險等級篩選
      if (p.dangerLevel < minDanger || p.dangerLevel > maxDanger) return false
      // 庫存篩選
      if (inStockOnly && p.stock === 0) return false
      // 關鍵字篩選（無關鍵字時顯示全部）
      if (trimmed) {
        const score = getRelevanceScore(p.name, p.description, trimmed)
        if (score === 0) return false
      }
      return true
    })

    // 排序
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'relevance': {
          const trimmed2 = query.trim()
          return (
            getRelevanceScore(b.name, b.description, trimmed2) -
            getRelevanceScore(a.name, a.description, trimmed2)
          )
        }
        case 'price_asc':
          return toKnut(a.price.galleon, a.price.sickle, a.price.knut) -
                 toKnut(b.price.galleon, b.price.sickle, b.price.knut)
        case 'price_desc':
          return toKnut(b.price.galleon, b.price.sickle, b.price.knut) -
                 toKnut(a.price.galleon, a.price.sickle, a.price.knut)
        case 'danger_asc':  return a.dangerLevel - b.dangerLevel
        case 'danger_desc': return b.dangerLevel - a.dangerLevel
        case 'name':        return a.name.localeCompare(b.name, 'zh-TW')
        default:            return 0
      }
    })

    return list
  }, [products, query, category, minDanger, maxDanger, inStockOnly, sort])

  const totalCartItems = cartItems.reduce((sum, i) => sum + i.quantity, 0)

  // 重設所有篩選
  const resetFilters = () => {
    setCategory('all')
    setMinDanger(1)
    setMaxDanger(5)
    setInStockOnly(false)
    setSort('relevance')
  }

  const hasActiveFilters = category !== 'all' || minDanger > 1 || maxDanger < 5 || inStockOnly

  return (
    <div
      className={styles.page}
      style={howlerModeEnabled ? { paddingTop: HOWLER_BANNER_HEIGHT } : undefined}
    >
      {/* 頂部導覽 */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.backLink}>← 衛氏巫師法寶店</Link>
          <h1 className={styles.pageTitle}>🔍 商品搜尋</h1>
        </div>
      </header>

      {/* 搜尋欄 */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="輸入商品名稱或描述關鍵字，例：嘔吐、防禦、愛情…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* 篩選列 */}
      <div className={styles.filterWrap}>
        {/* 類別 */}
        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel}>類別</span>
          <div className={styles.chips}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                className={`${styles.chip} ${category === c.value ? styles.chipActive : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 危險等級 */}
        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel}>
            危險等級 {'★'.repeat(minDanger)}～{'★'.repeat(maxDanger)}
          </span>
          <div className={styles.dangerRow}>
            <span className={styles.sliderLabel}>1</span>
            <input
              className={styles.slider}
              type="range" min={1} max={5} step={1}
              value={minDanger}
              onChange={e => {
                const v = Number(e.target.value)
                setMinDanger(v)
                if (v > maxDanger) setMaxDanger(v)
              }}
            />
            <span className={styles.sliderLabel}>~</span>
            <input
              className={styles.slider}
              type="range" min={1} max={5} step={1}
              value={maxDanger}
              onChange={e => {
                const v = Number(e.target.value)
                setMaxDanger(v)
                if (v < minDanger) setMinDanger(v)
              }}
            />
            <span className={styles.sliderLabel}>5</span>
          </div>
        </div>

        {/* 庫存 + 排序 + 重設 */}
        <div className={styles.filterGroup}>
          <label className={styles.stockToggle}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={e => setInStockOnly(e.target.checked)}
            />
            僅顯示有庫存
          </label>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterGroupLabel}>排序</span>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button className={styles.resetBtn} onClick={resetFilters}>重設篩選</button>
        )}
      </div>

      {/* 結果區 */}
      <main className={styles.main}>
        <p className={styles.resultCount}>
          {query.trim()
            ? `「${query.trim()}」的搜尋結果（${results.length} 件）`
            : `所有商品（${results.length} 件）`
          }
        </p>

        {results.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🦉</div>
            <p className={styles.emptyText}>找不到符合條件的商品</p>
            <p className={styles.emptyHint}>
              {query.trim() ? '試試其他關鍵字，或清除篩選條件' : '請調整篩選條件'}
            </p>
            {(query.trim() || hasActiveFilters) && (
              <button className={styles.resetBtn2} onClick={() => { setQuery(''); resetFilters() }}>
                清除所有條件
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {results.map(product => (
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

      {cartOpen && (
        <Cart
          onClose={() => setCartOpen(false)}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal onClose={() => setCheckoutOpen(false)} />
      )}
    </div>
  )
}

export default SearchPage
