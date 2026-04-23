import { useState, useMemo } from 'react'
import { useOrderStore } from '@/store/orderStore'
import { useProductStore } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import type { Order, OrderStatus } from '@/types'
import styles from './Orders.module.css'

// 所有有效的 OrderStatus（依狀態流程排列）
const ALL_STATUSES = [
  'all', 'unpaid', 'processing', 'shipped',
  'shipping_failed', 'completed',
  'refunding', 'return_pending', 'refunded',
  'rejected', 'refund_failed', 'cancelled',
] as const

// 訂單狀態中文對照
const STATUS_LABELS: Record<OrderStatus, string> = {
  unpaid:          '⏳ 待付款',
  processing:      '📦 待出貨',
  shipped:         '🚀 運送中',
  shipping_failed: '⚠️ 配送異常',
  completed:       '✅ 已完成',
  cancelled:       '❌ 已取消',
  refunding:       '🔄 退款審核中',
  return_pending:  '📮 退貨中',
  refunded:        '💸 已退款',
  rejected:        '🚫 退款被拒',
  refund_failed:   '🚫 退款失敗',  // 舊版相容
}

// 狀態顏色
const STATUS_COLORS: Record<OrderStatus, string> = {
  unpaid:          'var(--text-dim)',
  processing:      'var(--gold)',
  shipped:         '#5bc0de',
  shipping_failed: '#e67e22',
  completed:       '#5cb85c',
  cancelled:       'var(--red)',
  refunding:       '#f0ad4e',
  return_pending:  '#9b59b6',
  refunded:        'var(--text-dim)',
  rejected:        'var(--red)',
  refund_failed:   'var(--red)',
}

// 配送方式中文對照
const DELIVERY_LABELS: Record<string, string> = {
  instant:    '💨 消影術',
  broom:      '🧹 飛天掃帚',
  thestral:   '🦴 騎士墜鬼馬',
  knight_bus: '🚌 騎士公車',
}

// 支付方式中文對照
const PAYMENT_LABELS: Record<string, string> = {
  vault_transfer:   '🏦 金庫轉帳',
  cash_on_delivery: '📦 貨到付款',
  mock_card:        '💳 魔法卡',
}

// 可執行的狀態轉換（spec §6.4 / §7.2）
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  unpaid:          ['processing', 'cancelled'],
  processing:      ['shipped', 'cancelled'],
  shipped:         ['completed'],           // shipping_failed 有專屬按鈕
  shipping_failed: ['shipped', 'processing', 'cancelled'],  // 重新出貨 or 取消
  rejected:        ['completed'],           // 拒絕退款後可標記為已完成
}

const AdminOrders = () => {
  const orders = useOrderStore(s => s.orders)
  const updateOrderStatus = useOrderStore(s => s.updateOrderStatus)
  const cancelOrderViaApi = useOrderStore(s => s.cancelOrderViaApi)
  const approveRefundViaApi = useOrderStore(s => s.approveRefundViaApi)
  const confirmReturnViaApi = useOrderStore(s => s.confirmReturnViaApi)
  const rejectRefundViaApi = useOrderStore(s => s.rejectRefundViaApi)
  const markShippingFailedViaApi = useOrderStore(s => s.markShippingFailedViaApi)
  const bulkReleaseViaApi = useOrderStore(s => s.bulkReleaseViaApi)
  const syncProducts = useProductStore(s => s.syncFromApi)

  const updateShippingAddressViaApi = useOrderStore(s => s.updateShippingAddressViaApi)

  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [trackingInput, setTrackingInput] = useState<Record<string, string>>({})
  // 退款操作的 loading 狀態
  const [refundProcessingId, setRefundProcessingId] = useState<string | null>(null)
  // 中文註解：拒絕退款時的原因輸入狀態（rejectReasonId 為正在輸入原因的訂單 id）
  const [rejectReasonId, setRejectReasonId] = useState<string | null>(null)
  const [rejectReasonInput, setRejectReasonInput] = useState('')
  // 修改地址：記錄正在編輯的訂單 id 與輸入內容
  const [editAddressId, setEditAddressId] = useState<string | null>(null)
  const [editAddressValue, setEditAddressValue] = useState('')
  const [addressSaving, setAddressSaving] = useState(false)

  // 中文註解：批量強制釋放庫存的選取狀態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 中文註解：二次確認旗標（點擊釋放後顯示警告，再次確認才執行）
  const [confirmRelease, setConfirmRelease] = useState(false)
  // 中文註解：批量操作進行中旗標
  const [releasing, setReleasing] = useState(false)

  // 依狀態篩選
  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus)

  // 中文註解：目前篩選的所有 unpaid 訂單（供全選使用）
  const unpaidOrders = useMemo(
    () => orders.filter(o => o.status === 'unpaid'),
    [orders]
  )

  // 中文註解：計算已選訂單的總商品件數（用於確認彈窗說明）
  const selectedTotalItems = useMemo(() => {
    return unpaidOrders
      .filter(o => selectedIds.has(o.id))
      .reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  }, [unpaidOrders, selectedIds])

  // 中文註解：已選中的 unpaid 訂單數量
  const selectedCount = useMemo(
    () => unpaidOrders.filter(o => selectedIds.has(o.id)).length,
    [unpaidOrders, selectedIds]
  )

  // 切換單筆選取
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfirmRelease(false)
  }

  // 全選 / 取消全選（限當前頁面的 unpaid 訂單）
  const allUnpaidSelected = unpaidOrders.length > 0 && unpaidOrders.every(o => selectedIds.has(o.id))
  const toggleSelectAll = () => {
    if (allUnpaidSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unpaidOrders.map(o => o.id)))
    }
    setConfirmRelease(false)
  }

  // 清除選取狀態（切換篩選時重置）
  const handleFilterChange = (s: OrderStatus | 'all') => {
    setFilterStatus(s)
    setSelectedIds(new Set())
    setConfirmRelease(false)
  }

  // 中文註解：批量強制釋放庫存主流程
  const handleBulkRelease = async () => {
    const ids = Array.from(selectedIds).filter(id =>
      orders.find(o => o.id === id)?.status === 'unpaid'
    )
    if (ids.length === 0) return
    setReleasing(true)
    await bulkReleaseViaApi(ids)
    void syncProducts()
    setSelectedIds(new Set())
    setConfirmRelease(false)
    setReleasing(false)
  }

  const handleShip = (order: Order) => {
    const tracking = trackingInput[order.id]?.trim()
    if (!tracking) {
      window.alert('請先填入貓頭鷹物流單號')
      return
    }
    updateOrderStatus(order.id, 'shipped', tracking)
  }

  const handleStatusChange = (order: Order, status: OrderStatus) => {
    if (status === 'shipped') {
      handleShip(order)
    } else if (status === 'cancelled') {
      if (window.confirm(`確定取消訂單 ${order.id}？此操作無法復原。`)) {
        void cancelOrderViaApi(order.id).then(() => void syncProducts())
      }
    } else {
      updateOrderStatus(order.id, status)
    }
  }

  // 批准退款：後端還原庫存，並同步前台商品數量
  const handleApproveRefund = async (orderId: string) => {
    if (!window.confirm('確定批准此退款申請？商品將自動回補庫存。')) return
    setRefundProcessingId(orderId)
    await approveRefundViaApi(orderId)
    void syncProducts()
    setRefundProcessingId(null)
  }

  // 拒絕退款：開啟原因輸入框（inline，不用 confirm）
  const handleRejectRefund = async (orderId: string) => {
    const reason = rejectReasonInput.trim()
    if (!reason) return
    setRefundProcessingId(orderId)
    await rejectRefundViaApi(orderId, reason)
    setRefundProcessingId(null)
    setRejectReasonId(null)
    setRejectReasonInput('')
  }

  // 中文註解：是否顯示 checkbox（僅篩選「待付款」時顯示批量操作）
  const showBulk = filterStatus === 'unpaid'

  return (
    <>
      {/* 工具列 */}
      <div className={styles.toolbar}>
        <p className={styles.toolbarTitle}>
          📋 訂單管理（{filteredOrders.length} 筆）
        </p>
        {/* 狀態篩選 */}
        <div className={styles.filterGroup}>
          {ALL_STATUSES.map(s => {
            // 計算各需要徽章的狀態筆數
            const badgeCount = s !== 'all'
              ? orders.filter(o => o.status === s).length
              : 0
            const showBadge = badgeCount > 0 && ['refunding', 'shipping_failed', 'return_pending'].includes(s)
            const isAlert = ['refunding', 'shipping_failed', 'return_pending'].includes(s)
            return (
              <button
                key={s}
                className={[
                  styles.filterBtn,
                  filterStatus === s ? styles.filterActive : '',
                  s === 'refunding' ? styles.filterRefunding : '',
                  s === 'return_pending' ? styles.filterReturnPending : '',
                  s === 'shipping_failed' ? styles.filterShippingFailed : '',
                  s === 'rejected' || s === 'refund_failed' ? styles.filterRefundFailed : '',
                ].join(' ')}
                onClick={() => handleFilterChange(s as OrderStatus | 'all')}
              >
                {s === 'all' ? '全部' : STATUS_LABELS[s as OrderStatus]}
                {/* 需要注意的狀態：顯示數量徽章 */}
                {showBadge && (
                  <span className={`${styles.filterBadge} ${isAlert ? styles.filterBadgeAlert : ''}`}>
                    {badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 中文註解：批量操作列（僅篩選待付款且有未付款訂單時顯示）*/}
      {showBulk && unpaidOrders.length > 0 && (
        <div className={styles.bulkBar}>
          {/* 全選 checkbox */}
          <label className={styles.selectAllLabel}>
            <input
              type="checkbox"
              className={styles.bulkCheckbox}
              checked={allUnpaidSelected}
              onChange={toggleSelectAll}
            />
            全選（{unpaidOrders.length} 筆待付款）
          </label>

          {/* 中文註解：已選取後才顯示操作區 */}
          {selectedCount > 0 && (
            confirmRelease ? (
              // 中文註解：二次確認狀態
              <div className={styles.releaseConfirm}>
                <span className={styles.releaseWarning}>
                  ⚠️ 即將取消 {selectedCount} 筆訂單，釋放共 {selectedTotalItems} 件庫存，此操作不可逆
                </span>
                <button
                  className={styles.releaseConfirmBtn}
                  disabled={releasing}
                  onClick={() => void handleBulkRelease()}
                >
                  {releasing ? '釋放中…' : '✅ 確認釋放'}
                </button>
                <button
                  className={styles.releaseCancelBtn}
                  disabled={releasing}
                  onClick={() => setConfirmRelease(false)}
                >
                  取消
                </button>
              </div>
            ) : (
              // 中文註解：初次顯示選取資訊 + 觸發確認
              <div className={styles.releaseInfo}>
                <span className={styles.releaseCount}>已選 {selectedCount} 筆（共 {selectedTotalItems} 件）</span>
                <button
                  className={styles.releaseBtn}
                  onClick={() => setConfirmRelease(true)}
                >
                  🔴 強制釋放庫存
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* 訂單列表 */}
      <div className={styles.tableWrap}>
        {filteredOrders.length === 0 ? (
          <div className={styles.empty}>
            <p>🦉 尚無訂單</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className={`${styles.orderCard} ${showBulk && selectedIds.has(order.id) ? styles.orderCardSelected : ''}`}>
              {/* 訂單標題列 */}
              <div
                className={styles.orderHeader}
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                {/* 中文註解：待付款篩選模式下顯示 checkbox，防止點擊事件冒泡展開卡片 */}
                {showBulk && (
                  <input
                    type="checkbox"
                    className={styles.orderCheckbox}
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    onClick={e => e.stopPropagation()}
                  />
                )}
                <div className={styles.orderMeta}>
                  <span className={styles.orderId}>{order.id}</span>
                  <span className={styles.orderEmail}>{order.email}</span>
                  {order.isRon && (
                    <span className={styles.ronBadge}>榮恩 ×2</span>
                  )}
                </div>
                <div className={styles.orderSummary}>
                  <span className={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: STATUS_COLORS[order.status], fontWeight: 700, fontSize: '12px' }}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span className={styles.orderTotal}>{formatPrice(order.totalKnut)}</span>
                  <span className={styles.expandIcon}>{expandedId === order.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* 訂單詳情（展開） */}
              {expandedId === order.id && (
                <div className={styles.orderDetail}>
                  {/* 商品明細 */}
                  <div className={styles.detailSection}>
                    <p className={styles.detailSectionTitle}>商品明細</p>
                    {order.items.map((item, i) => (
                      <div key={i} className={styles.detailRow}>
                        <span>
                          {item.snapshotName}
                          {item.snapshotSpec && item.snapshotSpec !== '標準版' && (
                            <span className={styles.specTag}>（{item.snapshotSpec}）</span>
                          )}
                          {' '}× {item.quantity}
                        </span>
                        <span>{formatPrice(item.unitPriceKnut * item.quantity)}</span>
                      </div>
                    ))}
                    <div className={styles.detailRow}>
                      <span>{DELIVERY_LABELS[order.shippingMethod] ?? order.shippingMethod}</span>
                      <span>{formatPrice(order.shippingFeeKnut)}</span>
                    </div>
                    {order.couponCode && (
                      <div className={`${styles.detailRow} ${styles.detailDiscount}`}>
                        <span>優惠券「{order.couponCode}」</span>
                        <span>- {formatPrice(order.discountKnut)}</span>
                      </div>
                    )}
                    {order.isRon && (
                      <div className={`${styles.detailRow} ${styles.detailRon}`}>
                        <span>衛斯理家族特供方案 +100%</span>
                        <span>+ {formatPrice(order.subtotalKnut)}</span>
                      </div>
                    )}
                    <div className={`${styles.detailRow} ${styles.detailTotal}`}>
                      <span>總計</span>
                      <span>{formatPrice(order.totalKnut)}</span>
                    </div>
                  </div>

                  {/* 配送與支付資訊 */}
                  <div className={styles.detailSection}>
                    <p className={styles.detailSectionTitle}>配送資訊</p>

                    {/* 收件地址（processing 狀態可編輯） */}
                    {editAddressId === order.id ? (
                      <div className={styles.editAddressRow}>
                        <input
                          className={styles.editAddressInput}
                          value={editAddressValue}
                          onChange={e => setEditAddressValue(e.target.value)}
                          placeholder="輸入新收件地址..."
                          autoFocus
                        />
                        <div className={styles.editAddressBtns}>
                          <button
                            className={styles.editAddressSaveBtn}
                            disabled={addressSaving || !editAddressValue.trim()}
                            onClick={async () => {
                              setAddressSaving(true)
                              await updateShippingAddressViaApi(order.id, editAddressValue.trim())
                              setAddressSaving(false)
                              setEditAddressId(null)
                            }}
                          >
                            {addressSaving ? '儲存中…' : '✅ 儲存'}
                          </button>
                          <button
                            className={styles.editAddressCancelBtn}
                            onClick={() => setEditAddressId(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.detailInfo}>
                        <strong>地址：</strong>{order.shippingAddress}
                        {/* 僅備貨中可編輯地址 */}
                        {order.status === 'processing' && (
                          <button
                            className={styles.editAddressBtn}
                            onClick={() => {
                              setEditAddressId(order.id)
                              setEditAddressValue(order.shippingAddress)
                            }}
                          >
                            ✏️ 修改
                          </button>
                        )}
                      </p>
                    )}

                    <p className={styles.detailInfo}>
                      <strong>配送：</strong>{DELIVERY_LABELS[order.shippingMethod]}
                    </p>
                    <p className={styles.detailInfo}>
                      <strong>支付：</strong>{PAYMENT_LABELS[order.paymentMethod]}
                    </p>
                    {order.trackingNumber && (
                      <p className={styles.detailInfo}>
                        <strong>物流單號：</strong>
                        <code className={styles.trackingCode}>{order.trackingNumber}</code>
                      </p>
                    )}
                  </div>

                  {/* 操作區（依狀態機顯示可用操作） */}
                  <div className={styles.detailActions}>
                    {/* 出貨操作：需填物流單號 */}
                    {(order.status === 'processing' || order.status === 'shipping_failed') && (
                      <div className={styles.shipRow}>
                        <input
                          className={styles.trackingInput}
                          placeholder="輸入貓頭鷹物流單號..."
                          value={trackingInput[order.id] ?? ''}
                          onChange={e => setTrackingInput(prev => ({ ...prev, [order.id]: e.target.value }))}
                        />
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleStatusChange(order, 'shipped')}
                        >
                          🚀 {order.status === 'shipping_failed' ? '重新出貨' : '標記已出貨'}
                        </button>
                      </div>
                    )}

                    {/* 配送異常：顯示提示 + 標記按鈕（shipped 狀態下可觸發） */}
                    {order.status === 'shipped' && (
                      <button
                        className={`${styles.actionBtn} ${styles.warningBtn}`}
                        onClick={() => {
                          if (window.confirm('確定標記此訂單為配送異常？')) {
                            void markShippingFailedViaApi(order.id)
                          }
                        }}
                      >
                        ⚠️ 標記配送異常
                      </button>
                    )}

                    {/* 退貨中：確認收到退貨 → refunded（庫存回補）*/}
                    {order.status === 'return_pending' && (
                      <div className={styles.returnPendingActions}>
                        <div className={styles.refundNotice}>
                          📮 已通知顧客寄回商品，等待入庫確認後點擊下方按鈕完成退款。
                        </div>
                        <button
                          className={styles.approveRefundBtn}
                          disabled={refundProcessingId === order.id}
                          onClick={async () => {
                            if (!window.confirm('確定已收到退貨？商品庫存將自動回補。')) return
                            setRefundProcessingId(order.id)
                            await confirmReturnViaApi(order.id)
                            void syncProducts()
                            setRefundProcessingId(null)
                          }}
                        >
                          {refundProcessingId === order.id ? '處理中…' : '✅ 確認收到退貨・完成退款'}
                        </button>
                      </div>
                    )}

                    {/* 其他狀態轉換按鈕 */}
                    {(NEXT_STATUS[order.status] ?? [])
                      .filter(s => s !== 'shipped')  // 出貨已在上方處理
                      .map(nextStatus => (
                        <button
                          key={nextStatus}
                          className={`${styles.actionBtn} ${nextStatus === 'cancelled' ? styles.cancelBtn : ''}`}
                          onClick={() => handleStatusChange(order, nextStatus)}
                        >
                          {nextStatus === 'processing' && '🔄 返回備貨中'}
                          {nextStatus === 'completed' && '✅ 確認已完成'}
                          {nextStatus === 'cancelled' && '❌ 取消訂單'}
                        </button>
                      ))
                    }

                    {/* 退款審核操作：批准 / 拒絕（僅 refunding 狀態） */}
                    {order.status === 'refunding' && (
                      <div className={styles.refundActions}>
                        <div className={styles.refundNotice}>
                          🔄 顧客申請退款，請審核後決定是否批准。批准後商品庫存將自動回補。
                        </div>
                        {/* 中文註解：拒絕原因輸入框（點「拒絕退款」後展開，需填原因才能送出） */}
                        {rejectReasonId === order.id ? (
                          <div className={styles.rejectReasonArea}>
                            <label className={styles.rejectReasonLabel}>拒絕原因（必填，顧客可在訂單頁查看）</label>
                            <textarea
                              className={styles.rejectReasonInput}
                              rows={3}
                              placeholder="例：商品已拆封使用，不符合退款條件。"
                              value={rejectReasonInput}
                              onChange={e => setRejectReasonInput(e.target.value)}
                              autoFocus
                            />
                            <div className={styles.rejectReasonBtns}>
                              <button
                                className={styles.rejectRefundBtn}
                                disabled={!rejectReasonInput.trim() || refundProcessingId === order.id}
                                onClick={() => void handleRejectRefund(order.id)}
                              >
                                {refundProcessingId === order.id ? '處理中…' : '❌ 確認拒絕'}
                              </button>
                              <button
                                className={styles.rejectReasonCancelBtn}
                                disabled={refundProcessingId === order.id}
                                onClick={() => { setRejectReasonId(null); setRejectReasonInput('') }}
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.refundBtns}>
                            <button
                              className={styles.approveRefundBtn}
                              disabled={refundProcessingId === order.id}
                              onClick={() => void handleApproveRefund(order.id)}
                            >
                              {refundProcessingId === order.id ? '處理中…' : '✅ 批准退款'}
                            </button>
                            <button
                              className={styles.rejectRefundBtn}
                              disabled={refundProcessingId === order.id}
                              onClick={() => { setRejectReasonId(order.id); setRejectReasonInput('') }}
                            >
                              ❌ 拒絕退款
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default AdminOrders
