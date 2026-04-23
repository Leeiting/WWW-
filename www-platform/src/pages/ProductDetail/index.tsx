import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useProductStore, toKnut } from '@/store/productStore'
import { useCartStore, formatPrice } from '@/store/cartStore'
import { usePrankStore } from '@/store/prankStore'
import { usePrankPrice } from '@/hooks/usePrankPrice'
import { dangerStars, dangerDesc, stockAvailability, knutToGalleonStr } from '@/hooks/useSeo'
import type { SKUItem } from '@/types'
import styles from './ProductDetail.module.css'

// 類別中文對照
const CATEGORY_LABELS: Record<string, string> = {
  prank: '惡作劇',
  defense: '防禦咒',
  love_potion: '愛情魔藥',
  fireworks: '奇妙煙火',
  magical_beast: '魔法生物',
}

const CATEGORY_EMOJI: Record<string, string> = {
  prank: '🃏',
  defense: '🛡️',
  love_potion: '💘',
  fireworks: '✨',
  magical_beast: '🐉',
}

// 危險等級描述
const DANGER_DESC: Record<number, string> = {
  1: '無害（適合巫師新手）',
  2: '輕度危險（建議在監護人陪同下使用）',
  3: '中度危險（請先閱讀警告標示）',
  4: '高度危險（非得用不可請先立遺囑）',
  5: '極度危險（伏地魔親核等級，後果自負）',
}

// 危險等級警示顏色
const DANGER_COLOR: Record<number, string> = {
  1: '#4caf50', 2: '#8bc34a', 3: '#ff9800', 4: '#ff5722', 5: '#b00020',
}

// 媒體佔位 emoji
const MEDIA_PLACEHOLDER: Record<number, string> = {
  1: '🧪', 2: '🎪', 3: '⚠️', 4: '💥', 5: '☠️',
}

// 單一 SKU 的媒體顯示元件
const SkuMedia = ({ url, alt, isOutOfStock }: { url?: string; alt: string; isOutOfStock: boolean }) => {
  if (!url) return null
  return url.endsWith('.mp4')
    ? <video src={url} autoPlay loop muted playsInline className={isOutOfStock ? styles.mediaGray : undefined} />
    : <img src={url} alt={alt} className={isOutOfStock ? styles.mediaGray : undefined} />
}

// 主媒體區（依目前選中 SKU 決定顯示哪張圖）
const ProductMedia = ({
  mediaUrl, skuImageUrl, name, dangerLevel, isOutOfStock,
}: {
  mediaUrl: string; skuImageUrl?: string; name: string; dangerLevel: number; isOutOfStock: boolean
}) => {
  // 中文註解：SKU 有專屬圖則優先顯示 SKU 圖，否則顯示商品主圖
  const displayUrl = skuImageUrl || mediaUrl

  return (
    <div className={`${styles.mainMedia} ${isOutOfStock ? styles.mainMediaOut : ''}`}>
      {displayUrl ? (
        displayUrl.endsWith('.mp4') ? (
          <video src={displayUrl} autoPlay loop muted playsInline className={isOutOfStock ? styles.mediaGray : undefined} />
        ) : (
          <img src={displayUrl} alt={name} className={isOutOfStock ? styles.mediaGray : undefined} />
        )
      ) : (
        <span className={styles.mediaPlaceholder}>{MEDIA_PLACEHOLDER[dangerLevel] ?? '🧙'}</span>
      )}
      {isOutOfStock && <div className={styles.outOfStockOverlay}>已被石內卜沒收</div>}
    </div>
  )
}

// SKU 縮圖選擇列
const SkuThumbs = ({
  skuItems, selectedIdx, onSelect,
}: {
  skuItems: SKUItem[]; selectedIdx: number; onSelect: (i: number) => void
}) => {
  // 中文註解：只有當至少一個 SKU 有圖片才顯示縮圖列
  const hasAnyImage = skuItems.some(s => s.imageUrl)
  if (!hasAnyImage || skuItems.length <= 1) return null

  return (
    <div className={styles.skuThumbs}>
      {skuItems.map((sku, idx) => (
        <button
          key={sku.id}
          className={`${styles.skuThumb} ${selectedIdx === idx ? styles.skuThumbActive : ''} ${sku.stock === 0 ? styles.skuThumbOut : ''}`}
          onClick={() => onSelect(idx)}
          title={`${sku.spec}${sku.stock === 0 ? '（缺貨）' : ` — 庫存 ${sku.stock}`}`}
        >
          {sku.imageUrl ? (
            sku.imageUrl.endsWith('.mp4')
              ? <video src={sku.imageUrl} autoPlay loop muted playsInline />
              : <img src={sku.imageUrl} alt={sku.spec} />
          ) : (
            <span className={styles.skuThumbPlaceholder}>📦</span>
          )}
          {sku.stock === 0 && <span className={styles.skuThumbCross}>✗</span>}
        </button>
      ))}
    </div>
  )
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const product = useProductStore(s => s.products.find(p => p.id === id))
  const addItem = useCartStore(s => s.addItem)
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)

  // 中文註解：SKU 選擇狀態，預設選第一個
  const [selectedSkuIdx, setSelectedSkuIdx] = useState(0)

  // 中文註解：加入購物車成功回饋旗標（短暫顯示 1.5 秒）
  const [added, setAdded] = useState(false)

  // 中文註解：所有 hooks 必須在條件 return 前呼叫（React Rules of Hooks）
  const selectedSku = product?.skuItems[selectedSkuIdx] ?? product?.skuItems[0]

  const basePrice = useMemo(
    () => selectedSku
      ? toKnut(selectedSku.price.galleon, selectedSku.price.sickle, selectedSku.price.knut)
      : toKnut(product?.price.galleon ?? 0, product?.price.sickle ?? 0, product?.price.knut ?? 0),
    [selectedSku, product?.price]
  )

  // 中文註解：惡搞模式跳動顯示價格（hook 必須在條件 return 前）
  const displayPrice = usePrankPrice(basePrice)

  // 中文註解：購物車中此 SKU 已加入數量
  const cartQty = useCartStore(s => s.items.find(i => i.skuId === selectedSku?.id)?.quantity ?? 0)

  // 中文註解：商品不存在時顯示找不到頁面
  if (!product) {
    return (
      <div className={styles.notFound}>
        <p>此法寶已被石內卜沒收，或尚未上架。</p>
        <Link to="/" className={styles.backLink}>← 返回法寶店</Link>
      </div>
    )
  }

  const { name, category, dangerLevel, mediaUrl, description, skuItems } = product
  const isOutOfStock = (selectedSku?.stock ?? 0) === 0
  const isAtMax = !isOutOfStock && cartQty >= (selectedSku?.stock ?? 0)
  const isExtremeDanger = dangerLevel === 5

  // 中文註解：OG 標籤使用原始 basePrice（絕不使用惡搞後的 displayPrice，spec §12.5）
  const ogTitle       = `${name} — 衛氏巫師法寶店`
  const ogDescription = `危險等級 ${dangerStars(dangerLevel)}，${dangerDesc(dangerLevel)}。${description ?? ''}`
  const ogImage       = selectedSku?.imageUrl ?? mediaUrl ?? ''
  const ogUrl         = `${window.location.origin}/product/${product.id}`
  const priceInGalleon = knutToGalleonStr(basePrice)
  const availability  = stockAvailability(selectedSku?.stock ?? 0)

  const handleAddToCart = () => {
    if (!selectedSku || isOutOfStock || isAtMax) return
    addItem({
      productId: product.id,
      skuId: selectedSku.id,
      skuSpec: selectedSku.spec,
      productName: name,
      imageUrl: selectedSku.imageUrl ?? mediaUrl ?? undefined,
      basePrice,
      displayPrice,
    })
    // 中文註解：短暫顯示「已加入購物車」回饋，1.5 秒後恢復原本按鈕文字
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  // 中文註解：JSON-LD Product Schema（Google 商品結構化資料，spec §12.5）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: ogDescription,
    image: ogImage,
    brand: { '@type': 'Brand', name: '衛氏巫師法寶店' },
    offers: {
      '@type': 'Offer',
      price: priceInGalleon,
      priceCurrency: 'Galleon',
      availability,
      url: ogUrl,
    },
  }

  return (
    <div className={styles.page}>
      {/* 中文註解：商品頁 SEO / OG 標籤，使用資料庫原始定價（spec §12.5）*/}
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription} />

        {/* Open Graph */}
        <meta property="og:type"         content="product" />
        <meta property="og:title"        content={ogTitle} />
        <meta property="og:description"  content={ogDescription} />
        {ogImage && <meta property="og:image"       content={ogImage} />}
        {ogImage && <meta property="og:image:width" content="400" />}
        {ogImage && <meta property="og:image:height" content="400" />}
        <meta property="og:url"          content={ogUrl} />
        <meta property="og:site_name"    content="衛氏巫師法寶店" />
        <meta property="og:locale"       content="zh_TW" />

        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}

        {/* JSON-LD Product Schema */}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* 頂部導覽列 */}
      <nav className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← 返回</button>
        <Link to="/" className={styles.homeLink}>🏪 法寶店首頁</Link>
      </nav>

      <div className={styles.layout}>
        {/* 左欄：媒體區 */}
        <div className={styles.leftCol}>
          {/* 主媒體（商品動圖或 SKU 專屬圖） */}
          <ProductMedia
            mediaUrl={mediaUrl}
            skuImageUrl={selectedSku?.imageUrl}
            name={name}
            dangerLevel={dangerLevel}
            isOutOfStock={isOutOfStock}
          />

          {/* SKU 縮圖選擇列（有多規格且含圖片時顯示） */}
          <SkuThumbs
            skuItems={skuItems}
            selectedIdx={selectedSkuIdx}
            onSelect={setSelectedSkuIdx}
          />

          {/* 黑魔標記警告文字（危險等級 5） */}
          {isExtremeDanger && (
            <div className={styles.darkWarning}>
              ☠ 此法寶被列為「極度危險品」，使用前請確認你的遺囑已更新
            </div>
          )}
        </div>

        {/* 右欄：商品資訊 */}
        <div className={styles.rightCol}>
          {/* 類別標籤 */}
          <span className={styles.categoryBadge}>
            {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category] ?? category}
          </span>

          {/* 商品名稱 */}
          <h1 className={`${styles.productName} ${isExtremeDanger ? styles.dangerTitle : ''}`}>
            {isExtremeDanger && <span className={styles.skullIcon}>☠</span>}
            {name}
          </h1>

          {/* 危險等級 */}
          <div className={styles.dangerRow}>
            <div className={styles.stars}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < dangerLevel ? styles.starFilled : styles.starEmpty}>
                  {i < dangerLevel ? '★' : '☆'}
                </span>
              ))}
            </div>
            <span className={styles.dangerLabel} style={{ color: DANGER_COLOR[dangerLevel] }}>
              危險等級 {dangerLevel} — {DANGER_DESC[dangerLevel]}
            </span>
          </div>

          {/* 分隔線 */}
          <hr className={styles.divider} />

          {/* 商品完整描述 */}
          <div className={styles.descSection}>
            <h2 className={styles.sectionTitle}>商品說明</h2>
            <p className={styles.description}>{description}</p>
          </div>

          {/* SKU 規格選擇 */}
          {skuItems.length > 1 && (
            <div className={styles.skuSection}>
              <h2 className={styles.sectionTitle}>選擇規格</h2>
              <div className={styles.skuBtnRow}>
                {skuItems.map((sku, idx) => (
                  <button
                    key={sku.id}
                    className={`${styles.skuBtn} ${selectedSkuIdx === idx ? styles.skuBtnActive : ''} ${sku.stock === 0 ? styles.skuBtnOut : ''}`}
                    onClick={() => setSelectedSkuIdx(idx)}
                    disabled={sku.stock === 0}
                  >
                    {/* 中文註解：SKU 有圖片時在按鈕旁顯示小縮圖 */}
                    {sku.imageUrl && (
                      <span className={styles.skuBtnThumb}>
                        <img src={sku.imageUrl} alt={sku.spec} />
                      </span>
                    )}
                    <span>{sku.spec}</span>
                    {sku.stock === 0 && <span className={styles.skuSoldMark}>已沒收</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 規格詳細資料表 */}
          <div className={styles.specSection}>
            <h2 className={styles.sectionTitle}>規格資料</h2>
            <table className={styles.specTable}>
              <tbody>
                <tr>
                  <td className={styles.specKey}>規格</td>
                  <td className={styles.specVal}>{selectedSku?.spec ?? '標準版'}</td>
                </tr>
                <tr>
                  <td className={styles.specKey}>庫存數量</td>
                  <td className={`${styles.specVal} ${isOutOfStock ? styles.specValDanger : ''}`}>
                    {isOutOfStock ? '已全數被沒收（缺貨）' : `${selectedSku?.stock ?? 0} 件`}
                  </td>
                </tr>
                {selectedSku?.weightG && (
                  <tr>
                    <td className={styles.specKey}>重量</td>
                    <td className={styles.specVal}>{selectedSku.weightG} 公克</td>
                  </tr>
                )}
                <tr>
                  <td className={styles.specKey}>危險等級</td>
                  <td className={styles.specVal}>{dangerLevel} / 5</td>
                </tr>
                <tr>
                  <td className={styles.specKey}>商品分類</td>
                  <td className={styles.specVal}>{CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 價格與購買區 */}
          <div className={styles.buySection}>
            <div className={styles.priceRow}>
              <span className={styles.priceIcon}>💰</span>
              <span className={`${styles.price} ${prankModeEnabled ? styles.prankPrice : ''}`}>
                {formatPrice(displayPrice)}
              </span>
              {prankModeEnabled && (
                <span className={styles.prankNote}>（惡搞模式：價格僅供參考）</span>
              )}
            </div>

            {/* 購物車數量提示 */}
            {cartQty > 0 && (
              <p className={styles.cartHint}>購物車中已有 {cartQty} 件</p>
            )}

            {/* 加入購物車按鈕 */}
            {isOutOfStock ? (
              <button className={styles.soldOutBtn} disabled>石內卜來訪：已被沒收</button>
            ) : isAtMax ? (
              <button className={styles.soldOutBtn} disabled>
                已達庫存上限（{selectedSku?.stock} 件）
              </button>
            ) : (
              <button
                className={`${styles.buyBtn} ${added ? styles.buyBtnAdded : ''}`}
                onClick={handleAddToCart}
                disabled={added}
              >
                {added ? '✅ 已加入購物車！' : '立即交出金加隆'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetail
