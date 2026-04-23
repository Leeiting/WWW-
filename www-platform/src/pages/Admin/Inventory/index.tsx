import { useState, useMemo, useEffect, useCallback } from 'react'
import { useProductStore, toKnut } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import { apiGet, apiSend } from '@/api/client'
import styles from './Inventory.module.css'

// 庫存警戒線
const LOW_STOCK_THRESHOLD = 5

type SortKey = 'name' | 'stock' | 'category'

const CATEGORY_LABELS: Record<string, string> = {
  prank: '🃏 惡作劇',
  defense: '🛡️ 防禦咒',
  love_potion: '💘 愛情魔藥',
  fireworks: '✨ 奇妙煙火',
  magical_beast: '🐉 魔法生物',
}

// 異動原因中文標籤（對應後端 reason 字串）
const REASON_LABELS: Record<string, string> = {
  order_placed: '訂單建立（貨到付款）',
  payment_confirmed: '付款確認扣庫存',
  order_cancelled: '取消訂單還原',
  refund_approved: '退款批准還原',
  manual_restock: '手動補貨',
  steal_back: '從辦公室偷回',
  sku_update: '後台編輯庫存',
}

// 庫存異動紀錄的資料型別（對應後端 /api/products/stock-logs 回傳格式）
interface StockLogEntry {
  log_id: string
  s_id: string
  change_qty: number
  reason: string
  related_order_id: string | null
  note: string | null
  created_at: string
  sku: {
    spec: string
    product: { p_id: string; name: string }
  }
}

const AdminInventory = () => {
  const products = useProductStore(s => s.products)
  const restockProduct = useProductStore(s => s.restockProduct)
  const setSkuStock = useProductStore(s => s.setSkuStock)

  // 分頁切換：stock = 庫存概覽，log = 異動紀錄
  const [activeTab, setActiveTab] = useState<'stock' | 'log'>('stock')

  // 排序與篩選
  const [sortKey, setSortKey] = useState<SortKey>('stock')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterLow, setFilterLow] = useState(false)

  // 本地編輯暫存：Map<skuId, draftStock>
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // 已展開 SKU 的商品 id
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── 異動紀錄狀態 ──
  const [stockLogs, setStockLogs] = useState<StockLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  // 異動紀錄篩選關鍵字（商品名稱 / 原因 / 訂單 ID）
  const [logKeyword, setLogKeyword] = useState('')

  const setDraft = (skuId: string, val: string) =>
    setDrafts(prev => ({ ...prev, [skuId]: val }))

  // 同步庫存到後端 API（靜默失敗：若 ID 非 UUID 或後端未啟動，不影響本地 UI）
  const syncStockToApi = (productId: string, skuId: string, stock: number) => {
    void apiSend(`/api/products/${productId}/skus/${skuId}/stock`, 'PATCH', { stock }).catch(() => {})
  }

  const commitDraft = (productId: string, skuId: string) => {
    const val = drafts[skuId]
    if (val === undefined) return
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 0) {
      setSkuStock(productId, skuId, n)
      syncStockToApi(productId, skuId, n)
    }
    setDrafts(prev => { const next = { ...prev }; delete next[skuId]; return next })
  }

  // 全部缺貨商品一鍵補貨（本地 + 後端同步）
  const restockAll = () => {
    products.filter(p => p.stock === 0).forEach(p => {
      restockProduct(p.id)
      const firstSku = p.skuItems[0]
      if (firstSku) syncStockToApi(p.id, firstSku.id, firstSku.stock + 5)
    })
  }

  const outOfStockCount = products.filter(p => p.stock === 0).length
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length

  // 排序後清單
  const sorted = useMemo(() => {
    let list = filterLow ? products.filter(p => p.stock < LOW_STOCK_THRESHOLD) : [...products]
    list = list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'zh-TW')
      else if (sortKey === 'stock') cmp = a.stock - b.stock
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category)
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [products, sortKey, sortAsc, filterLow])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? '⇅' : sortAsc ? '↑' : '↓'

  // 從後端拉取庫存異動紀錄
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const data = await apiGet<StockLogEntry[]>('/api/products/stock-logs')
      setStockLogs(data)
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLogsLoading(false)
    }
  }, [])

  // 切換到異動紀錄分頁時自動載入
  useEffect(() => {
    if (activeTab === 'log') void fetchLogs()
  }, [activeTab, fetchLogs])

  // 依關鍵字篩選後的紀錄
  const filteredLogs = useMemo(() => {
    if (!logKeyword.trim()) return stockLogs
    const kw = logKeyword.trim().toLowerCase()
    return stockLogs.filter(log =>
      log.sku?.product?.name?.toLowerCase().includes(kw) ||
      log.sku?.spec?.toLowerCase().includes(kw) ||
      (REASON_LABELS[log.reason] ?? log.reason).toLowerCase().includes(kw) ||
      log.related_order_id?.toLowerCase().includes(kw) ||
      log.note?.toLowerCase().includes(kw)
    )
  }, [stockLogs, logKeyword])

  return (
    <div>
      {/* ── 分頁切換列 ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'stock' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 庫存概覽
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'log' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('log')}
        >
          📋 異動紀錄
        </button>
      </div>

      {/* ══════════ 庫存概覽分頁 ══════════ */}
      {activeTab === 'stock' && (
        <>
          {/* 工具列 */}
          <div className={styles.toolbar}>
            <p className={styles.toolbarTitle}>📦 庫存管理（{products.length} 件商品）</p>
            <div className={styles.toolbarRight}>
              <label className={styles.filterToggle}>
                <input
                  type="checkbox"
                  checked={filterLow}
                  onChange={e => setFilterLow(e.target.checked)}
                />
                僅顯示低庫存
              </label>
              {outOfStockCount > 0 && (
                <button className={styles.restockAllBtn} onClick={restockAll}>
                  ⬆ 全部補貨（{outOfStockCount} 件缺貨）
                </button>
              )}
            </div>
          </div>

          {/* 摘要卡片 */}
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <p className={styles.summaryNum}>{products.length}</p>
              <p className={styles.summaryLabel}>商品總數</p>
            </div>
            <div className={`${styles.summaryCard} ${outOfStockCount > 0 ? styles.summaryDanger : ''}`}>
              <p className={styles.summaryNum}>{outOfStockCount}</p>
              <p className={styles.summaryLabel}>缺貨</p>
            </div>
            <div className={`${styles.summaryCard} ${lowStockCount > 0 ? styles.summaryWarn : ''}`}>
              <p className={styles.summaryNum}>{lowStockCount}</p>
              <p className={styles.summaryLabel}>低庫存（&lt;{LOW_STOCK_THRESHOLD}）</p>
            </div>
            <div className={styles.summaryCard}>
              <p className={styles.summaryNum}>{products.reduce((s, p) => s + p.stock, 0)}</p>
              <p className={styles.summaryLabel}>總庫存量</p>
            </div>
          </div>

          {/* 庫存表格 */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thSort} onClick={() => toggleSort('name')}>
                    商品名稱 {sortIcon('name')}
                  </th>
                  <th className={styles.thSort} onClick={() => toggleSort('category')}>
                    類別 {sortIcon('category')}
                  </th>
                  <th>定價</th>
                  <th className={styles.thSort} onClick={() => toggleSort('stock')}>
                    庫存 {sortIcon('stock')}
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} className={styles.empty}>沒有符合條件的商品</td></tr>
                ) : sorted.map(p => {
                  const isExpanded = expandedId === p.id
                  const stockStatus =
                    p.stock === 0 ? 'out' :
                    p.stock < LOW_STOCK_THRESHOLD ? 'low' : 'ok'

                  return [
                    // ── 商品主列 ──
                    <tr
                      key={p.id}
                      className={`${styles.productRow} ${p.isHidden ? styles.hiddenRow : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <td>
                        <div className={styles.productName}>{p.name}</div>
                        {p.isHidden && <span className={styles.hiddenBadge}>隱藏中</span>}
                        <div className={styles.skuCount}>{p.skuItems.length} 種規格</div>
                      </td>
                      <td>
                        <span className={styles.category}>{CATEGORY_LABELS[p.category] ?? p.category}</span>
                      </td>
                      <td className={styles.price}>
                        {formatPrice(toKnut(p.price.galleon, p.price.sickle, p.price.knut))}
                      </td>
                      <td>
                        <div className={styles.stockCell}>
                          <span className={`${styles.stockNum} ${
                            stockStatus === 'out' ? styles.stockOut :
                            stockStatus === 'low' ? styles.stockLow : styles.stockOk
                          }`}>
                            {p.stock}
                          </span>
                          {stockStatus !== 'ok' && (
                            <span className={`${styles.stockTag} ${
                              stockStatus === 'out' ? styles.tagOut : styles.tagLow
                            }`}>
                              {stockStatus === 'out' ? '缺貨' : '低庫存'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className={styles.rowActions}>
                          {p.stock === 0 && (
                            <button
                              className={styles.restockBtn}
                              onClick={() => {
                                restockProduct(p.id)
                                const firstSku = p.skuItems[0]
                                if (firstSku) syncStockToApi(p.id, firstSku.id, firstSku.stock + 5)
                              }}
                            >
                              從辦公室偷回
                            </button>
                          )}
                          <button
                            className={styles.expandBtn}
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                          >
                            {isExpanded ? '▲ 收合' : '▼ SKU'}
                          </button>
                        </div>
                      </td>
                    </tr>,

                    // ── SKU 展開列 ──
                    isExpanded && (
                      <tr key={`${p.id}-sku`} className={styles.skuRow}>
                        <td colSpan={5} className={styles.skuCell}>
                          <div className={styles.skuTable}>
                            <div className={styles.skuHeader}>
                              <span>規格</span>
                              <span>定價</span>
                              <span>庫存量</span>
                              <span>調整</span>
                            </div>
                            {p.skuItems.map(sku => {
                              const draftVal = drafts[sku.id]
                              const displayVal = draftVal !== undefined ? draftVal : String(sku.stock)
                              const skuStatus = sku.stock === 0 ? 'out' : sku.stock < LOW_STOCK_THRESHOLD ? 'low' : 'ok'

                              return (
                                <div key={sku.id} className={styles.skuItem}>
                                  <span className={styles.skuSpec}>{sku.spec}</span>
                                  <span className={styles.skuPrice}>
                                    {formatPrice(toKnut(sku.price.galleon, sku.price.sickle, sku.price.knut))}
                                  </span>
                                  <span className={`${styles.skuStock} ${
                                    skuStatus === 'out' ? styles.stockOut :
                                    skuStatus === 'low' ? styles.stockLow : ''
                                  }`}>
                                    {sku.stock}
                                  </span>
                                  <div className={styles.skuAdjust}>
                                    <button
                                      className={styles.adjBtn}
                                      onClick={() => {
                                        const n = sku.stock - 1
                                        setSkuStock(p.id, sku.id, n)
                                        syncStockToApi(p.id, sku.id, n)
                                      }}
                                      disabled={sku.stock === 0}
                                    >−</button>
                                    <input
                                      className={styles.adjInput}
                                      type="number"
                                      min={0}
                                      value={displayVal}
                                      onChange={e => setDraft(sku.id, e.target.value)}
                                      onBlur={() => commitDraft(p.id, sku.id)}
                                      onKeyDown={e => e.key === 'Enter' && commitDraft(p.id, sku.id)}
                                    />
                                    <button
                                      className={styles.adjBtn}
                                      onClick={() => {
                                        const n = sku.stock + 1
                                        setSkuStock(p.id, sku.id, n)
                                        syncStockToApi(p.id, sku.id, n)
                                      }}
                                    >+</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════ 異動紀錄分頁 ══════════ */}
      {activeTab === 'log' && (
        <div>
          {/* 工具列 */}
          <div className={styles.logToolbar}>
            <p className={styles.toolbarTitle}>
              📋 庫存異動紀錄
              {stockLogs.length > 0 && (
                <span className={styles.logCount}>{filteredLogs.length} / {stockLogs.length} 筆</span>
              )}
            </p>
            <div className={styles.toolbarRight}>
              <input
                className={styles.logSearch}
                type="text"
                placeholder="搜尋商品、原因、訂單…"
                value={logKeyword}
                onChange={e => setLogKeyword(e.target.value)}
              />
              <button
                className={styles.refreshBtn}
                onClick={() => void fetchLogs()}
                disabled={logsLoading}
              >
                {logsLoading ? '載入中…' : '↻ 重新整理'}
              </button>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {logsError && (
            <div className={styles.logError}>
              ⚠️ {logsError}（後端伺服器可能未啟動）
            </div>
          )}

          {/* 載入中 */}
          {logsLoading && (
            <div className={styles.logEmpty}>載入異動紀錄中…</div>
          )}

          {/* 無資料 */}
          {!logsLoading && !logsError && stockLogs.length === 0 && (
            <div className={styles.logEmpty}>
              <p>尚無任何庫存異動紀錄</p>
              <p className={styles.logEmptyHint}>訂單成立、退款批准、手動補貨等操作後才會產生紀錄</p>
            </div>
          )}

          {/* 異動紀錄表格 */}
          {!logsLoading && filteredLogs.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>商品 / 規格</th>
                    <th>異動量</th>
                    <th>原因</th>
                    <th>關聯訂單</th>
                    <th>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.log_id} className={styles.logRow}>
                      {/* 時間 */}
                      <td className={styles.logTime}>
                        {new Date(log.created_at).toLocaleString('zh-TW', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>

                      {/* 商品名稱 + 規格 */}
                      <td>
                        <div className={styles.logProductName}>
                          {log.sku?.product?.name ?? '—'}
                        </div>
                        <div className={styles.logSpec}>
                          {log.sku?.spec ?? '—'}
                        </div>
                      </td>

                      {/* 異動量：正數綠色補貨，負數紅色扣減 */}
                      <td>
                        <span className={`${styles.logChange} ${
                          log.change_qty > 0 ? styles.logChangePos : styles.logChangeNeg
                        }`}>
                          {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                        </span>
                      </td>

                      {/* 原因標籤 */}
                      <td>
                        <span className={`${styles.logReason} ${styles[`reason_${log.reason}`] ?? ''}`}>
                          {REASON_LABELS[log.reason] ?? log.reason}
                        </span>
                      </td>

                      {/* 關聯訂單（前8碼，hover 顯示完整） */}
                      <td className={styles.logOrderId}>
                        {log.related_order_id ? (
                          <span title={log.related_order_id}>
                            {log.related_order_id.slice(0, 8)}…
                          </span>
                        ) : '—'}
                      </td>

                      {/* 備註 */}
                      <td className={styles.logNote}>
                        {log.note ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminInventory
