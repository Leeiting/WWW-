import { useState } from 'react'
import { useOrderStore } from '@/store/orderStore'
import { useProductStore } from '@/store/productStore'
import { formatPrice } from '@/store/cartStore'
import styles from './Refunds.module.css'

// 退款佇列頁：列出所有 refunding 狀態訂單，供後台審核批准或拒絕
const AdminRefunds = () => {
  const orders = useOrderStore(s => s.orders)
  const approveRefundViaApi = useOrderStore(s => s.approveRefundViaApi)
  const rejectRefundViaApi = useOrderStore(s => s.rejectRefundViaApi)
  const syncProducts = useProductStore(s => s.syncFromApi)

  // 正在處理中的訂單 id（防止重複點擊）
  const [processingId, setProcessingId] = useState<string | null>(null)
  // 展開詳情的訂單 id
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // 正在輸入拒絕原因的訂單 id
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  // 拒絕原因文字
  const [rejectReason, setRejectReason] = useState('')

  // 篩選退款審核中訂單
  const refundingOrders = orders.filter(o => o.status === 'refunding')

  // 批准退款：後端還原庫存後同步前台商品數量
  const handleApprove = async (orderId: string) => {
    if (!window.confirm('確定批准此退款申請？商品將自動回補庫存。')) return
    setProcessingId(orderId)
    await approveRefundViaApi(orderId)
    void syncProducts()
    setProcessingId(null)
  }

  // 開啟拒絕面板
  const handleRejectOpen = (orderId: string) => {
    setRejectingId(orderId)
    setRejectReason('')
  }

  // 確認拒絕退款（reason 必填）
  const handleRejectConfirm = async (orderId: string) => {
    const reason = rejectReason.trim()
    if (!reason) return
    setProcessingId(orderId)
    await rejectRefundViaApi(orderId, reason)
    setRejectingId(null)
    setRejectReason('')
    setProcessingId(null)
  }

  return (
    <>
      {/* 標題列 */}
      <div className={styles.header}>
        <p className={styles.title}>
          🔄 退款審核佇列
          {refundingOrders.length > 0 && (
            <span className={styles.badge}>{refundingOrders.length}</span>
          )}
        </p>
        <p className={styles.subtitle}>審核顧客退款申請，批准後商品庫存自動回補</p>
      </div>

      {/* 空狀態 */}
      {refundingOrders.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyIcon}>✅</p>
          <p className={styles.emptyText}>目前沒有待審核的退款申請</p>
        </div>
      ) : (
        <div className={styles.queue}>
          {refundingOrders.map(order => {
            const isExpanded = expandedId === order.id
            const isProcessing = processingId === order.id

            return (
              <div key={order.id} className={styles.card}>
                {/* 訂單摘要列（可點擊展開） */}
                <div
                  className={styles.cardHeader}
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className={styles.cardLeft}>
                    <span className={styles.orderId}>{order.id}</span>
                    <span className={styles.email}>{order.email}</span>
                    {order.isRon && <span className={styles.ronBadge}>榮恩 ×2</span>}
                  </div>
                  <div className={styles.cardRight}>
                    <span className={styles.date}>
                      {new Date(order.createdAt).toLocaleString('zh-TW', {
                        month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span className={styles.total}>{formatPrice(order.totalKnut)}</span>
                    <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* 展開：商品明細 + 審核操作 */}
                {isExpanded && (
                  <div className={styles.cardBody}>
                    {/* 退款申請提示 */}
                    <div className={styles.refundNotice}>
                      🔄 顧客申請退款，請審核後決定是否批准。批准後商品庫存將自動回補。
                    </div>

                    {/* 商品明細 */}
                    <div className={styles.section}>
                      <p className={styles.sectionTitle}>退款商品</p>
                      {order.items.map((item, i) => (
                        <div key={i} className={styles.itemRow}>
                          <span className={styles.itemName}>
                            {item.snapshotName}
                            {item.snapshotSpec && item.snapshotSpec !== '標準版' && (
                              <span className={styles.spec}>（{item.snapshotSpec}）</span>
                            )}
                            {' '}× {item.quantity}
                          </span>
                          <span>{formatPrice(item.unitPriceKnut * item.quantity)}</span>
                        </div>
                      ))}
                      <div className={`${styles.itemRow} ${styles.totalRow}`}>
                        <span>退款總額</span>
                        <span>{formatPrice(order.totalKnut)}</span>
                      </div>
                    </div>

                    {/* 配送資訊 */}
                    <div className={styles.section}>
                      <p className={styles.sectionTitle}>配送資訊</p>
                      <p className={styles.infoRow}><strong>地址：</strong>{order.shippingAddress}</p>
                      {order.trackingNumber && (
                        <p className={styles.infoRow}><strong>物流單號：</strong>
                          <code className={styles.trackingCode}>{order.trackingNumber}</code>
                        </p>
                      )}
                    </div>

                    {/* 批准 / 拒絕按鈕 */}
                    {rejectingId === order.id ? (
                      // 中文註解：拒絕原因輸入面板（必填，填完才能送出）
                      <div className={styles.rejectPanel}>
                        <p className={styles.rejectPanelTitle}>❌ 填寫拒絕原因（必填）</p>
                        <textarea
                          className={styles.rejectTextarea}
                          placeholder="請說明拒絕理由，此內容將顯示給顧客…"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className={styles.rejectPanelBtns}>
                          <button
                            className={styles.rejectConfirmBtn}
                            disabled={isProcessing || !rejectReason.trim()}
                            onClick={() => void handleRejectConfirm(order.id)}
                          >
                            {isProcessing ? '處理中…' : '確認拒絕'}
                          </button>
                          <button
                            className={styles.rejectCancelBtn}
                            disabled={isProcessing}
                            onClick={() => setRejectingId(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.actionRow}>
                        <button
                          className={styles.approveBtn}
                          disabled={isProcessing}
                          onClick={() => void handleApprove(order.id)}
                        >
                          {isProcessing ? '處理中…' : '✅ 批准退款'}
                        </button>
                        <button
                          className={styles.rejectBtn}
                          disabled={isProcessing}
                          onClick={() => handleRejectOpen(order.id)}
                        >
                          ❌ 拒絕退款
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export default AdminRefunds
