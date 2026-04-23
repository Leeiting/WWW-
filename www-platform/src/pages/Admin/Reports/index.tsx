import { useEffect, useMemo, useState } from 'react'
import { useOrderStore } from '@/store/orderStore'
import { useProductStore } from '@/store/productStore'
import { useCouponStore } from '@/store/couponStore'
import { formatPrice } from '@/store/cartStore'
import { useVisitorStore } from '@/store/visitorStore'
import type { Order, OrderStatus } from '@/types'
import styles from './Reports.module.css'

// 報表分頁類型
type ReportTab = 'operations' | 'finance' | 'logistics'
// 折線圖維度
type RevPeriod = 'today' | 'week' | 'month'
// 日期範圍選項
type DateRange = 'all' | '30d' | '7d'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: '全部',
  '30d': '近 30 天',
  '7d': '近 7 天',
}

const TAB_LABELS: Record<ReportTab, string> = {
  operations: '📊 營運人員',
  finance:    '💰 金流',
  logistics:  '🚚 物流',
}

// 訂單狀態標籤（含所有 11 種狀態）
const STATUS_LABELS: Record<OrderStatus, string> = {
  unpaid:          '待付款',
  processing:      '備貨中',
  shipped:         '運送中',
  completed:       '已完成',
  cancelled:       '已取消',
  refunding:       '退款審核中',
  return_pending:  '退貨中',
  shipping_failed: '配送異常',
  rejected:        '退款被拒',
  refunded:        '已退款',
  refund_failed:   '退款失敗',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  unpaid:          '#a89070',
  processing:      '#c9972e',
  shipped:         '#5bc0de',
  completed:       '#5cb85c',
  cancelled:       '#8b0000',
  refunding:       '#f0ad4e',
  return_pending:  '#9b59b6',
  shipping_failed: '#e67e22',
  rejected:        '#c0392b',
  refunded:        '#a89070',
  refund_failed:   '#7f8c8d',
}

const DELIVERY_LABELS: Record<string, string> = {
  instant:    '💨 消影術',
  broom:      '🧹 飛天掃帚',
  thestral:   '🦴 騎士墜鬼馬',
  knight_bus: '🚌 騎士公車',
}

const PAYMENT_LABELS: Record<string, string> = {
  vault_transfer:   '🏦 金庫轉帳',
  cash_on_delivery: '📦 貨到付款',
  mock_card:        '💳 魔法卡',
}

// 依日期範圍過濾訂單
const filterByRange = (orders: Order[], range: DateRange): Order[] => {
  if (range === 'all') return orders
  const now = Date.now()
  const days = range === '7d' ? 7 : 30
  const cutoff = now - days * 24 * 60 * 60 * 1000
  return orders.filter(o => new Date(o.createdAt).getTime() >= cutoff)
}

// 簡易 CSS 長條圖
const Bar = ({ value, max, color = 'var(--gold)' }: { value: number; max: number; color?: string }) => (
  <div className={styles.barTrack}>
    <div className={styles.barFill} style={{ width: max > 0 ? `${Math.round((value / max) * 100)}%` : '0%', background: color }} />
  </div>
)

// 1 金加隆 = 17 銀閃 × 29 納特
const KNUT_PER_GALLEON = 17 * 29  // 493

// 納特 → 金加隆（浮點，供圖表計算用）
const knutToGalleon = (knut: number): number => knut / KNUT_PER_GALLEON

// Y 軸標籤：統一顯示金加隆，大數字縮寫
const formatGalleonAxis = (galleon: number): string => {
  if (galleon >= 1_000_000) return `${(galleon / 1_000_000).toFixed(1)}M`
  if (galleon >= 1_000)     return `${(galleon / 1_000).toFixed(1)}K`
  if (galleon >= 1)         return `${Math.round(galleon)}`
  return '< 1'
}

// Tooltip 標籤：精確顯示金加隆（小數點後兩位）
const formatGalleonTooltip = (knut: number): string => {
  const g = knutToGalleon(knut)
  return `${g >= 1 ? g.toFixed(1) : '< 0.1'} 金加隆`
}

// SVG 折線圖元件（Y 軸與 tooltip 統一用金加隆）
interface LineChartProps { points: { label: string; value: number }[]; color?: string }

const LineChart = ({ points, color = '#c9972e' }: LineChartProps) => {
  const W = 620, H = 180
  const pad = { top: 18, right: 16, bottom: 38, left: 72 }
  const cw = W - pad.left - pad.right
  const ch = H - pad.top - pad.bottom
  const n = points.length

  // 以金加隆為單位計算最大值與座標
  const galleonPoints = points.map(p => ({ ...p, galleon: knutToGalleon(p.value) }))
  const maxGalleon = Math.max(...galleonPoints.map(p => p.galleon), 1)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ ratio: r, galleon: maxGalleon * r }))

  const coords = galleonPoints.map((p, i) => ({
    x: pad.left + (n <= 1 ? cw / 2 : (i / (n - 1)) * cw),
    y: pad.top + ch - (p.galleon / maxGalleon) * ch,
    val: p.value, galleon: p.galleon, label: p.label,
  }))
  const pathD = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`
    const prev = coords[i - 1]
    const cx1 = prev.x + (pt.x - prev.x) / 2
    return `${acc} C ${cx1} ${prev.y} ${cx1} ${pt.y} ${pt.x} ${pt.y}`
  }, '')
  const areaD = pathD + ` L ${coords[n - 1].x} ${pad.top + ch} L ${coords[0].x} ${pad.top + ch} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.lineChartSvg} aria-label="營收折線圖（金加隆）">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Y 軸單位標籤 */}
      <text x={pad.left - 6} y={pad.top - 4} textAnchor="end" fontSize="8" fill="rgba(244,231,211,0.3)">金加隆</text>

      {/* Y 軸格線 + 標籤（統一金加隆） */}
      {yTicks.map(({ ratio, galleon }) => {
        const y = pad.top + ch - ratio * ch
        return (
          <g key={ratio}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(201,151,46,0.10)" strokeWidth="1" strokeDasharray={ratio === 0 ? 'none' : '4 4'} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(244,231,211,0.45)">{formatGalleonAxis(galleon)}</text>
          </g>
        )
      })}

      {n > 1 && <path d={areaD} fill="url(#areaGrad)" />}
      {n > 1 && <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {/* 資料點 + X 軸標籤（tooltip 也用金加隆） */}
      {coords.map((pt, i) => (
        <g key={i}>
          <text x={pt.x} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(244,231,211,0.45)">{pt.label}</text>
          {pt.val > 0 && (
            <circle cx={pt.x} cy={pt.y} r="4" fill={color} stroke="#2C1810" strokeWidth="1.5">
              <title>{pt.label}：{formatGalleonTooltip(pt.val)}</title>
            </circle>
          )}
        </g>
      ))}
    </svg>
  )
}

// 中文註解：所有非取消/非退款的訂單狀態皆計入營收（含待付款）
const REVENUE_STATUSES: OrderStatus[] = [
  'unpaid', 'processing', 'shipped', 'completed',
]
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

// 信箱部分遮蔽（保護隱私）
const maskEmail = (email: string): string => {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const masked = user.length > 2 ? user.slice(0, 2) + '***' : user[0] + '***'
  return `${masked}@${domain}`
}

const AdminReports = () => {
  const allOrders  = useOrderStore(s => s.orders)
  // 中文註解：取得同步函式，進入報表頁時主動從後端拉取最新訂單
  const syncOrders = useOrderStore(s => s.syncFromApi)
  const products   = useProductStore(s => s.products)
  const coupons    = useCouponStore(s => s.coupons)
  const visitCount = useVisitorStore(s => s.visitCount)
  const resetVisitorCount = useVisitorStore(s => s.resetCount)

  const [tab, setTab]               = useState<ReportTab>('operations')
  const [range, setRange]           = useState<DateRange>('30d')
  const [revPeriod, setRevPeriod]   = useState<RevPeriod>('today')
  const [confirmReset, setConfirmReset] = useState(false)
  // 中文註解：手動刷新中旗標（防止重複點擊）
  const [refreshing, setRefreshing] = useState(false)

  // 中文註解：報表頁掛載時立即同步訂單，確保跨分頁下單後資料即時反映
  useEffect(() => { void syncOrders() }, [syncOrders])

  // 中文註解：手動刷新按鈕處理器（顯示旋轉動畫後完成）
  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    void syncOrders().finally(() => setRefreshing(false))
  }

  const orders = useMemo(() => filterByRange(allOrders, range), [allOrders, range])

  // ── 核心指標（受日期篩選影響）──
  const completedOrders = orders.filter(o => REVENUE_STATUSES.includes(o.status))
  const revenue     = completedOrders.reduce((s, o) => s + o.totalKnut, 0)
  const avgOrder    = completedOrders.length > 0 ? Math.round(revenue / completedOrders.length) : 0
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length
  const cancelRate  = orders.length > 0 ? Math.round((cancelledCount / orders.length) * 100) : 0
  const ronOrderCount  = orders.filter(o => o.isRon).length

  // ── 訂單狀態分佈 ──
  const statusDist = useMemo(() => {
    const map: Partial<Record<OrderStatus, number>> = {}
    orders.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => (b[1] as number) - (a[1] as number)) as [OrderStatus, number][]
  }, [orders])
  const maxStatusCount = statusDist[0]?.[1] ?? 0

  // ── 熱門商品 Top 10 ──
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    orders.forEach(o => o.items.forEach(item => {
      if (!map[item.productId]) {
        const prod = products.find(p => p.id === item.productId)
        map[item.productId] = { name: prod?.name ?? item.snapshotName, qty: 0, revenue: 0 }
      }
      map[item.productId].qty     += item.quantity
      map[item.productId].revenue += item.unitPriceKnut * item.quantity
    }))
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10)
  }, [orders, products])
  const maxQty = topProducts[0]?.qty ?? 0

  // ── Top 5 全站（不受日期篩選）──
  const top5 = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    allOrders.forEach(o => o.items.forEach(item => {
      if (!map[item.snapshotName]) map[item.snapshotName] = { name: item.snapshotName, qty: 0, revenue: 0 }
      map[item.snapshotName].qty     += item.quantity
      map[item.snapshotName].revenue += item.unitPriceKnut * item.quantity
    }))
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [allOrders])
  const top5MaxQty = top5[0]?.qty ?? 1

  // ── 轉化率漏斗 ──
  const funnelOrdered  = new Set(allOrders.map(o => o.email)).size
  const funnelComplete = new Set(allOrders.filter(o => REVENUE_STATUSES.includes(o.status)).map(o => o.email)).size
  const rateOrdered  = visitCount > 0 ? ((funnelOrdered  / visitCount) * 100).toFixed(1) : '—'
  const rateComplete = visitCount > 0 ? ((funnelComplete / visitCount) * 100).toFixed(1) : '—'

  // ── 配送方式分佈 ──
  const deliveryDist = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.shippingMethod] = (map[o.shippingMethod] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [orders])
  const maxDelivery   = deliveryDist[0]?.[1] ?? 0
  const totalDelivery = deliveryDist.reduce((s, [, v]) => s + v, 0)

  // ── 付款方式分佈 ──
  const paymentDist = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.paymentMethod] = (map[o.paymentMethod] ?? 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [orders])
  const maxPayment = paymentDist[0]?.[1] ?? 0

  // ── 折線圖：今日 ──
  const todayPoints = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const curHour  = now.getHours()
    return Array.from({ length: 24 }, (_, h) => ({
      label: h === 0 ? '0時' : h % 6 === 0 ? `${h}時` : h === curHour ? `${h}時` : String(h),
      value: h > curHour ? 0 : allOrders.filter(o =>
        REVENUE_STATUSES.includes(o.status) &&
        o.createdAt.slice(0, 10) === todayStr &&
        new Date(o.createdAt).getHours() === h
      ).reduce((s, o) => s + o.totalKnut, 0),
    }))
  }, [allOrders])

  // ── 折線圖：本週 ──
  const weekPoints = useMemo(() => {
    const now = new Date()
    const dow  = now.getDay() === 0 ? 6 : now.getDay() - 1
    const labels = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - dow + i)
      const dateStr = d.toISOString().slice(0, 10)
      return {
        label: labels[i],
        value: i > dow ? 0 : allOrders.filter(o => REVENUE_STATUSES.includes(o.status) && o.createdAt.slice(0, 10) === dateStr).reduce((s, o) => s + o.totalKnut, 0),
      }
    })
  }, [allOrders])

  // ── 折線圖：本月 ──
  const monthPoints = useMemo(() => {
    const now       = new Date()
    const todayDate = now.getDate()
    const yearMonth = now.toISOString().slice(0, 7)
    return Array.from({ length: todayDate }, (_, i) => {
      const day     = i + 1
      const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`
      return {
        label: day === 1 || day % 5 === 0 || day === todayDate ? `${day}日` : '',
        value: allOrders.filter(o => REVENUE_STATUSES.includes(o.status) && o.createdAt.slice(0, 10) === dateStr).reduce((s, o) => s + o.totalKnut, 0),
      }
    })
  }, [allOrders])

  const todayRevenue = todayPoints.reduce((s, p) => s + p.value, 0)
  const weekRevenue  = weekPoints.reduce((s, p) => s + p.value, 0)
  const monthRevenue = monthPoints.reduce((s, p) => s + p.value, 0)
  const revPoints = revPeriod === 'today' ? todayPoints : revPeriod === 'week' ? weekPoints : monthPoints

  // ── 近 14 天每日訂單 ──
  const dailyOrders = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })
      const dayOrders = allOrders.filter(o => o.createdAt.slice(0, 10) === key)
      return { date: label, count: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + o.totalKnut, 0) }
    })
  }, [allOrders])
  const maxDailyCount = Math.max(...dailyOrders.map(d => d.count), 1)

  // ── 7.4.1 營運：庫存預警（stock < 5）──
  const lowStockSkus = useMemo(() => {
    const result: { productName: string; spec: string; stock: number }[] = []
    products.forEach(p => p.skuItems.forEach(sku => {
      if (sku.stock < 5) result.push({ productName: p.name, spec: sku.spec, stock: sku.stock })
    }))
    return result.sort((a, b) => a.stock - b.stock)
  }, [products])

  // ── 7.4.2 金流：退款明細 ──
  const refundedOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'refunded')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  , [allOrders])
  const refundTotal = refundedOrders.reduce((s, o) => s + o.totalKnut, 0)

  // ── 7.4.2 金流：榮恩稅 ──
  const ronOrders          = useMemo(() => allOrders.filter(o => o.isRon), [allOrders])
  const ronOrdersTotal     = ronOrders.reduce((s, o) => s + o.totalKnut, 0)
  const ronServiceFeeTotal = ronOrders.reduce((s, o) => s + Math.round(o.totalKnut / 2), 0)

  // ── 7.4.2 金流：優惠券折抵 ──
  const couponStats = useMemo(() => {
    const map: Record<string, { code: string; label: string; uses: number; totalDiscount: number }> = {}
    allOrders.forEach(o => {
      if (o.couponCode && o.discountKnut > 0) {
        if (!map[o.couponCode]) {
          const c = coupons.find(c => c.code === o.couponCode)
          map[o.couponCode] = { code: o.couponCode, label: c?.label ?? o.couponCode, uses: 0, totalDiscount: 0 }
        }
        map[o.couponCode].uses++
        map[o.couponCode].totalDiscount += o.discountKnut
      }
    })
    return Object.values(map).sort((a, b) => b.uses - a.uses)
  }, [allOrders, coupons])
  const couponTotalDiscount = couponStats.reduce((s, c) => s + c.totalDiscount, 0)

  // ── 7.4.3 物流：配送異常 ──
  const shippingFailedOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'shipping_failed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  , [allOrders])

  // ── 7.4.3 物流：庫存周轉 ──
  const turnoverAnalysis = useMemo(() => {
    const map: Record<string, { name: string; sold: number; currentStock: number }> = {}
    allOrders.forEach(o => o.items.forEach(item => {
      const key = item.productId
      if (!map[key]) {
        const prod = products.find(p => p.id === key)
        map[key] = { name: prod?.name ?? item.snapshotName, sold: 0, currentStock: prod?.stock ?? 0 }
      }
      map[key].sold += item.quantity
    }))
    const all = Object.values(map)
    return {
      hot:  [...all].sort((a, b) => b.sold - a.sold).slice(0, 5),
      cold: [...all].sort((a, b) => a.sold - b.sold).slice(0, 5),
    }
  }, [allOrders, products])
  const hotMaxSold = turnoverAnalysis.hot[0]?.sold ?? 1

  // ── 7.4.3 物流：退貨入庫統計 ──
  const returnStats = useMemo(() => ({
    refunding:     allOrders.filter(o => o.status === 'refunding').length,
    returnPending: allOrders.filter(o => o.status === 'return_pending').length,
    refunded:      allOrders.filter(o => o.status === 'refunded').length,
    rejected:      allOrders.filter(o => o.status === 'rejected').length,
  }), [allOrders])

  return (
    <div>
      {/* 中文註解：標題列 + 日期篩選 + 手動刷新按鈕 */}
      <div className={styles.toolbar}>
        <p className={styles.toolbarTitle}>📊 數據報表</p>
        <div className={styles.rangeGroup}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(r => (
            <button key={r} className={`${styles.rangeBtn} ${range === r ? styles.rangeBtnActive : ''}`} onClick={() => setRange(r)}>
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {/* 中文註解：手動刷新按鈕，同步後端最新訂單資料 */}
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          title="同步最新訂單"
        >
          🔄 {refreshing ? '同步中…' : '刷新'}
        </button>
      </div>

      {/* 分頁導覽 */}
      <div className={styles.tabNav}>
        {(Object.keys(TAB_LABELS) as ReportTab[]).map(t => (
          <button key={t} className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ══ TAB 1：營運人員 ══ */}
      {tab === 'operations' && (
        <>
          {/* 營收折線圖 */}
          <div className={styles.revenueChartSection}>
            <div className={styles.revHeader}>
              <p className={styles.revTitle}>📈 營收統計</p>
              <div className={styles.revTabs}>
                {([['today', '今日'], ['week', '本週'], ['month', '本月']] as [RevPeriod, string][]).map(([p, label]) => (
                  <button key={p} className={`${styles.revTab} ${revPeriod === p ? styles.revTabActive : ''}`} onClick={() => setRevPeriod(p)}>{label}</button>
                ))}
              </div>
            </div>
            <div className={styles.revKpiRow}>
              {([['today', '今日營收', todayRevenue], ['week', '本週累計', weekRevenue], ['month', '本月累計', monthRevenue]] as [RevPeriod, string, number][]).map(([p, label, val]) => (
                <div key={p} className={`${styles.revKpiCard} ${revPeriod === p ? styles.revKpiCardActive : ''}`} onClick={() => setRevPeriod(p)} style={{ cursor: 'pointer' }}>
                  <p className={styles.revKpiNum}>{formatPrice(val)}</p>
                  <p className={styles.revKpiLabel}>{label}</p>
                </div>
              ))}
            </div>
            <div className={styles.revChartWrap}>
              <LineChart points={revPoints} />
              {revPoints.every(p => p.value === 0) && <div className={styles.revChartEmpty}>此區間尚無有效營收訂單</div>}
            </div>
          </div>

          {/* 核心 KPI */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}><p className={styles.kpiNum}>{orders.length}</p><p className={styles.kpiLabel}>總訂單數</p></div>
            <div className={styles.kpiCard}><p className={styles.kpiNum}>{formatPrice(revenue)}</p><p className={styles.kpiLabel}>總營收（含待付款）</p></div>
            <div className={styles.kpiCard}><p className={styles.kpiNum}>{formatPrice(avgOrder)}</p><p className={styles.kpiLabel}>平均訂單金額</p></div>
            <div className={`${styles.kpiCard} ${cancelRate > 20 ? styles.kpiDanger : ''}`}><p className={styles.kpiNum}>{cancelRate}%</p><p className={styles.kpiLabel}>取消率</p></div>
            <div className={styles.kpiCard}><p className={styles.kpiNum}>{completedOrders.length}</p><p className={styles.kpiLabel}>有效訂單數（含待付款）</p></div>
            {ronOrderCount > 0 && (
              <div className={styles.kpiCard} style={{ borderColor: '#c84b4b' }}>
                <p className={styles.kpiNum} style={{ color: '#e07070' }}>{ronOrderCount}</p>
                <p className={styles.kpiLabel}>榮恩訂單（含家屬服務費）</p>
              </div>
            )}
          </div>

          {/* Top 5 + 轉化率漏斗 */}
          <div className={styles.twoColNarrow}>
            <div className={styles.section}>
              <p className={styles.sectionTitle}>🧨 最常整到人的法寶 Top 5</p>
              <p className={styles.sectionHint}>依全站銷售總量排行（不受日期篩選影響）</p>
              {top5.length === 0 ? <p className={styles.empty}>尚無銷售記錄</p> : top5.map((p, i) => (
                <div key={p.name} className={styles.top5Row}>
                  <span className={styles.top5Medal}>{MEDALS[i]}</span>
                  <div className={styles.top5Info}>
                    <span className={styles.top5Name}>{p.name}</span>
                    <div className={styles.top5BarTrack}><div className={styles.top5BarFill} style={{ width: `${Math.round((p.qty / top5MaxQty) * 100)}%` }} /></div>
                  </div>
                  <div className={styles.top5Right}>
                    <span className={styles.top5Qty}>{p.qty} 件</span>
                    <span className={styles.top5Rev}>{formatPrice(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <p className={styles.sectionTitle}>🔮 轉化率分析</p>
              <p className={styles.sectionHint}>進站人數 vs. 實際下單人數（全局累計）</p>
              <div className={styles.funnel}>
                <div className={styles.funnelStage} style={{ '--fw': '100%' } as React.CSSProperties}>
                  <div className={styles.funnelBar} style={{ background: 'rgba(91,192,222,0.25)', borderColor: 'rgba(91,192,222,0.5)' }}>
                    <span className={styles.funnelIcon}>🌐</span><span className={styles.funnelLabel}>前台訪客</span><span className={styles.funnelNum}>{visitCount.toLocaleString()}</span>
                  </div>
                  <div className={styles.funnelArrow}>▼</div>
                </div>
                <div className={styles.funnelStage} style={{ '--fw': visitCount > 0 ? `${Math.max((funnelOrdered / visitCount) * 100, 8)}%` : '8%' } as React.CSSProperties}>
                  <div className={styles.funnelBar} style={{ background: 'rgba(201,151,46,0.2)', borderColor: 'rgba(201,151,46,0.45)' }}>
                    <span className={styles.funnelIcon}>🛒</span><span className={styles.funnelLabel}>曾下單</span><span className={styles.funnelNum}>{funnelOrdered.toLocaleString()}</span><span className={styles.funnelRate}>{rateOrdered}%</span>
                  </div>
                  <div className={styles.funnelArrow}>▼</div>
                </div>
                <div className={styles.funnelStage} style={{ '--fw': visitCount > 0 ? `${Math.max((funnelComplete / visitCount) * 100, 5)}%` : '5%' } as React.CSSProperties}>
                  <div className={styles.funnelBar} style={{ background: 'rgba(92,184,92,0.2)', borderColor: 'rgba(92,184,92,0.45)' }}>
                    <span className={styles.funnelIcon}>✅</span><span className={styles.funnelLabel}>有效訂單</span><span className={styles.funnelNum}>{funnelComplete.toLocaleString()}</span><span className={styles.funnelRate} style={{ color: '#7dcf7d' }}>{rateComplete}%</span>
                  </div>
                </div>
              </div>
              <div className={styles.resetRow}>
                {confirmReset ? (
                  <><span className={styles.resetWarning}>確定重置？訪客計數將歸零。</span>
                    <button className={styles.resetConfirmBtn} onClick={() => { resetVisitorCount(); setConfirmReset(false) }}>確定</button>
                    <button className={styles.resetCancelBtn} onClick={() => setConfirmReset(false)}>取消</button></>
                ) : (
                  <button className={styles.resetBtn} onClick={() => setConfirmReset(true)}>重置訪客計數</button>
                )}
              </div>
            </div>
          </div>

          {/* 雙欄：狀態分佈 + 熱門商品 */}
          <div className={styles.twoCol}>
            <div className={styles.col}>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>訂單狀態分佈</p>
                {statusDist.length === 0 ? <p className={styles.empty}>此區間無訂單</p> : statusDist.map(([status, count]) => (
                  <div key={status} className={styles.distRow}>
                    <span className={styles.distLabel} style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>
                    <Bar value={count} max={maxStatusCount} color={STATUS_COLORS[status]} />
                    <span className={styles.distCount}>{count}</span>
                  </div>
                ))}
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>付款方式</p>
                {paymentDist.length === 0 ? <p className={styles.empty}>此區間無訂單</p> : paymentDist.map(([method, count]) => (
                  <div key={method} className={styles.distRow}>
                    <span className={styles.distLabel}>{PAYMENT_LABELS[method] ?? method}</span>
                    <Bar value={count} max={maxPayment} />
                    <span className={styles.distCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.col}>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>熱門商品 Top 10（依銷售件數）</p>
                {topProducts.length === 0 ? <p className={styles.empty}>此區間無銷售紀錄</p> : topProducts.map((p, i) => (
                  <div key={p.name} className={styles.topRow}>
                    <span className={styles.topRank}>#{i + 1}</span>
                    <div className={styles.topInfo}><span className={styles.topName}>{p.name}</span><Bar value={p.qty} max={maxQty} color="var(--gold)" /></div>
                    <div className={styles.topNums}><span className={styles.topQty}>{p.qty} 件</span><span className={styles.topRevenue}>{formatPrice(p.revenue)}</span></div>
                  </div>
                ))}
              </div>
              <div className={styles.section}>
                <p className={styles.sectionTitle}>近 14 天每日訂單</p>
                <div className={styles.dailyChart}>
                  {dailyOrders.map(d => (
                    <div key={d.date} className={styles.dailyBar}>
                      <div className={styles.dailyBarFill} style={{ height: `${Math.round((d.count / maxDailyCount) * 60)}px` }} title={`${d.date}：${d.count} 筆`} />
                      <span className={styles.dailyDate}>{d.date}</span>
                      {d.count > 0 && <span className={styles.dailyCount}>{d.count}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 庫存預警列表 */}
          <div className={styles.section} style={{ marginTop: 20 }}>
            <p className={styles.sectionTitle}>⚠️ 庫存預警列表（stock &lt; 5）</p>
            {lowStockSkus.length === 0 ? (
              <p className={styles.empty}>✅ 所有 SKU 庫存正常</p>
            ) : (
              <table className={styles.reportTable}>
                <thead><tr><th>商品名稱</th><th>規格</th><th>庫存量</th></tr></thead>
                <tbody>
                  {lowStockSkus.map((sku, i) => (
                    <tr key={i} className={sku.stock === 0 ? styles.rowDanger : styles.rowWarn}>
                      <td>{sku.productName}</td>
                      <td>{sku.spec}</td>
                      <td className={styles.stockNum}>{sku.stock === 0 ? '🚫 已售罄' : sku.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══ TAB 2：金流 ══ */}
      {tab === 'finance' && (
        <div className={styles.col} style={{ gap: 24 }}>

          {/* 退款明細報表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>💸 退款明細報表</p>
              <div className={styles.sectionKpi}>
                <span>共 {refundedOrders.length} 筆</span>
                <span className={styles.kpiSep}>｜</span>
                <span>退款總額：{formatPrice(refundTotal)}</span>
              </div>
            </div>
            {refundedOrders.length === 0 ? <p className={styles.empty}>尚無退款紀錄</p> : (
              <div className={styles.tableWrap}>
                <table className={styles.reportTable}>
                  <thead><tr><th>訂單號（後8碼）</th><th>信箱</th><th>下單日期</th><th>金額</th><th>商品（首件）</th><th>退款原因</th></tr></thead>
                  <tbody>
                    {refundedOrders.map(o => (
                      <tr key={o.id}>
                        <td className={styles.orderId}>{o.id.slice(-8).toUpperCase()}</td>
                        <td>{maskEmail(o.email)}</td>
                        <td>{new Date(o.createdAt).toLocaleDateString('zh-TW')}</td>
                        <td className={styles.amountCol}>{formatPrice(o.totalKnut)}</td>
                        <td className={styles.productNameCol}>{o.items[0]?.snapshotName ?? '—'}</td>
                        <td className={styles.reasonCol}>{o.refundRejectReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 榮恩稅專案收入 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>🦊 榮恩稅專案收入</p>
            <p className={styles.sectionHint}>全站累計，不受日期篩選影響。服務費 = 訂單總額 ÷ 2（榮恩訂單原為雙倍收費）</p>
            <div className={styles.ronGrid}>
              <div className={styles.ronCard}>
                <p className={styles.ronNum}>{ronOrders.length}</p>
                <p className={styles.ronLabel}>榮恩訂單筆數</p>
              </div>
              <div className={styles.ronCard}>
                <p className={styles.ronNum}>{formatPrice(ronOrdersTotal)}</p>
                <p className={styles.ronLabel}>榮恩訂單總付款額</p>
              </div>
              <div className={`${styles.ronCard} ${styles.ronCardHighlight}`}>
                <p className={styles.ronNum}>{formatPrice(ronServiceFeeTotal)}</p>
                <p className={styles.ronLabel}>家族貢獻度（服務費）</p>
              </div>
            </div>
            {ronOrders.length > 0 && (
              <div className={styles.tableWrap} style={{ marginTop: 16 }}>
                <table className={styles.reportTable}>
                  <thead><tr><th>訂單號</th><th>信箱</th><th>下單日期</th><th>實付金額</th><th>服務費</th></tr></thead>
                  <tbody>
                    {ronOrders.slice(0, 10).map(o => (
                      <tr key={o.id} className={styles.rowRon}>
                        <td className={styles.orderId}>{o.id.slice(-8).toUpperCase()}</td>
                        <td>{maskEmail(o.email)}</td>
                        <td>{new Date(o.createdAt).toLocaleDateString('zh-TW')}</td>
                        <td className={styles.amountCol}>{formatPrice(o.totalKnut)}</td>
                        <td className={styles.serviceFeeCol}>{formatPrice(Math.round(o.totalKnut / 2))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ronOrders.length > 10 && <p className={styles.tableMore}>僅顯示最近 10 筆，共 {ronOrders.length} 筆</p>}
              </div>
            )}
            {ronOrders.length === 0 && <p className={styles.empty}>榮恩尚未光臨本店</p>}
          </div>

          {/* 優惠券折抵統計 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>🎟 優惠券折抵統計</p>
              <div className={styles.sectionKpi}>
                <span>折扣成本合計：{formatPrice(couponTotalDiscount)}</span>
              </div>
            </div>
            {couponStats.length === 0 ? <p className={styles.empty}>尚無優惠券使用紀錄</p> : (
              <table className={styles.reportTable}>
                <thead><tr><th>代碼</th><th>名稱</th><th>使用次數</th><th>折扣成本</th></tr></thead>
                <tbody>
                  {couponStats.map(c => (
                    <tr key={c.code}>
                      <td className={styles.couponCode}>{c.code}</td>
                      <td>{c.label}</td>
                      <td className={styles.usesCol}>{c.uses} 次</td>
                      <td className={styles.amountCol}>{formatPrice(c.totalDiscount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB 3：物流 ══ */}
      {tab === 'logistics' && (
        <div className={styles.col} style={{ gap: 24 }}>

          {/* 物流方式佔比 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>🚀 物流方式佔比</p>
            <p className={styles.sectionHint}>依日期篩選範圍統計</p>
            {deliveryDist.length === 0 ? <p className={styles.empty}>此區間無訂單</p> : deliveryDist.map(([method, count]) => {
              const pct = totalDelivery > 0 ? Math.round((count / totalDelivery) * 100) : 0
              return (
                <div key={method} className={styles.distRowWide}>
                  <span className={styles.distLabel}>{DELIVERY_LABELS[method] ?? method}</span>
                  <Bar value={count} max={maxDelivery} color="var(--gold)" />
                  <span className={styles.distCount}>{count} 筆</span>
                  <span className={styles.distPct}>{pct}%</span>
                </div>
              )
            })}
          </div>

          {/* 配送異常追蹤表 */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>⚠️ 配送異常追蹤表</p>
              <div className={styles.sectionKpi} style={{ color: shippingFailedOrders.length > 0 ? '#e67e22' : undefined }}>
                {shippingFailedOrders.length > 0 ? `${shippingFailedOrders.length} 筆異常待處理` : '✅ 無異常'}
              </div>
            </div>
            {shippingFailedOrders.length === 0 ? <p className={styles.empty}>目前無配送異常訂單</p> : (
              <div className={styles.tableWrap}>
                <table className={styles.reportTable}>
                  <thead><tr><th>訂單號</th><th>信箱</th><th>配送方式</th><th>收件地址</th><th>下單日期</th></tr></thead>
                  <tbody>
                    {shippingFailedOrders.map(o => (
                      <tr key={o.id} className={styles.rowWarn}>
                        <td className={styles.orderId}>{o.id.slice(-8).toUpperCase()}</td>
                        <td>{maskEmail(o.email)}</td>
                        <td>{DELIVERY_LABELS[o.shippingMethod] ?? o.shippingMethod}</td>
                        <td className={styles.addressCol} title={o.shippingAddress}>{o.shippingAddress.slice(0, 20)}{o.shippingAddress.length > 20 ? '…' : ''}</td>
                        <td>{new Date(o.createdAt).toLocaleDateString('zh-TW')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 庫存周轉分析 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>🔄 庫存周轉分析</p>
            <p className={styles.sectionHint}>依全站銷售總量（不受日期篩選影響）</p>
            <div className={styles.twoColNarrow}>
              <div>
                <p className={styles.turnoverSubtitle}>🔥 熱賣法寶 Top 5</p>
                {turnoverAnalysis.hot.length === 0 ? <p className={styles.empty}>尚無銷售紀錄</p> : turnoverAnalysis.hot.map((p, i) => (
                  <div key={p.name} className={styles.turnoverRow}>
                    <span className={styles.turnoverRank}>{MEDALS[i]}</span>
                    <div className={styles.turnoverInfo}>
                      <span className={styles.turnoverName}>{p.name}</span>
                      <Bar value={p.sold} max={hotMaxSold} color="#e67e22" />
                    </div>
                    <span className={styles.turnoverSold}>{p.sold} 件</span>
                  </div>
                ))}
              </div>
              <div>
                <p className={styles.turnoverSubtitle}>🧊 滯銷品 Bottom 5</p>
                {turnoverAnalysis.cold.length === 0 ? <p className={styles.empty}>尚無銷售紀錄</p> : turnoverAnalysis.cold.map((p, i) => (
                  <div key={p.name} className={styles.turnoverRow}>
                    <span className={styles.turnoverRank} style={{ opacity: 0.5 }}>#{i + 1}</span>
                    <div className={styles.turnoverInfo}>
                      <span className={styles.turnoverName}>{p.name}</span>
                      <Bar value={p.sold} max={hotMaxSold} color="#7f8c8d" />
                    </div>
                    <span className={styles.turnoverSold} style={{ color: 'var(--text-dim)' }}>{p.sold} 件</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 退貨入庫統計 */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>📮 退貨入庫統計</p>
            <p className={styles.sectionHint}>全站退款流程各階段件數（全站累計，不受日期篩選影響）</p>
            <div className={styles.returnGrid}>
              <div className={styles.returnCard}>
                <p className={styles.returnNum}>{returnStats.refunding}</p>
                <p className={styles.returnLabel}>退款審核中</p>
              </div>
              <div className={`${styles.returnCard} ${styles.returnCardPurple}`}>
                <p className={styles.returnNum}>{returnStats.returnPending}</p>
                <p className={styles.returnLabel}>退貨中（待入庫）</p>
              </div>
              <div className={`${styles.returnCard} ${styles.returnCardGreen}`}>
                <p className={styles.returnNum}>{returnStats.refunded}</p>
                <p className={styles.returnLabel}>已退款完成</p>
              </div>
              <div className={`${styles.returnCard} ${styles.returnCardRed}`}>
                <p className={styles.returnNum}>{returnStats.rejected}</p>
                <p className={styles.returnLabel}>退款被拒</p>
              </div>
            </div>
            <p className={styles.returnNote}>＊毀損率需人工標記，目前 schema 無對應欄位，待後續版本補充。</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminReports
