import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrderStore } from '@/store/orderStore'
import { useProductStore } from '@/store/productStore'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/store/cartStore'
import type { OrderStatus } from '@/types'
import styles from './MyOrders.module.css'

// 訂單狀態中文對照
const STATUS_LABELS: Record<OrderStatus, string> = {
  unpaid:          '⏳ 待付款',
  processing:      '📦 備貨中',
  shipped:         '🚀 運送中',
  shipping_failed: '⚠️ 配送異常',
  completed:       '✅ 已送達',
  cancelled:       '❌ 已取消',
  refunding:       '🔄 退款審核中',
  return_pending:  '📮 退貨中',
  refunded:        '💸 已退款',
  rejected:        '🚫 退款被拒絕',
  refund_failed:   '🚫 退款失敗',  // 舊版相容
}

// 狀態顏色
const STATUS_COLORS: Record<OrderStatus, string> = {
  unpaid:          '#a89070',
  processing:      '#c9972e',
  shipped:         '#5bc0de',
  shipping_failed: '#e67e22',
  completed:       '#5cb85c',
  cancelled:       '#8b0000',
  refunding:       '#f0ad4e',
  return_pending:  '#9b59b6',
  refunded:        '#a89070',
  rejected:        '#8b0000',
  refund_failed:   '#8b0000',
}

// 配送方式中文對照
const DELIVERY_LABELS: Record<string, string> = {
  instant:    '💨 消影術',
  broom:      '🧹 飛天掃帚',
  thestral:   '🦴 騎士墜鬼馬',
  knight_bus: '🚌 騎士公車',
}

// 配送進度步驟
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'unpaid',     label: '待付款' },
  { status: 'processing', label: '備貨中' },
  { status: 'shipped',    label: '運送中' },
  { status: 'completed',  label: '已送達' },
]

const getStepIndex = (status: OrderStatus) => {
  if (status === 'cancelled' || status === 'refunding' || status === 'refunded') return -1
  return STEPS.findIndex(s => s.status === status)
}

// 付款方式中文對照
const PAYMENT_LABELS: Record<string, string> = {
  vault_transfer:   '🏦 巫師金庫轉帳',
  cash_on_delivery: '📦 貨到交金加隆',
  mock_card:        '💳 魔法卡',
}

// 模擬古靈閣帳號（依訂單 id hash 決定，固定不跳動）
const mockVaultAccount = (orderId: string) => {
  const n = orderId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return `GRG-${String(n % 9000 + 1000).padStart(4, '0')}-${String((n * 13) % 90000 + 10000)}`
}

const MyOrdersPage = () => {
  const orders = useOrderStore(s => s.orders)
  const cancelOrderViaApi = useOrderStore(s => s.cancelOrderViaApi)
  const requestRefundViaApi = useOrderStore(s => s.requestRefundViaApi)
  const confirmReceiptViaApi = useOrderStore(s => s.confirmReceiptViaApi)  // 確認收到商品
  const updateOrderStatus = useOrderStore(s => s.updateOrderStatus)
  const payOrderViaApi = useOrderStore(s => s.payOrderViaApi)              // 付款確認（呼叫後端寫 final_captured_amount）
  const syncProducts = useProductStore(s => s.syncFromApi)
  const user = useAuthStore(s => s.user)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)  // 驚喜券複製狀態
  // 二次確認：記錄正在等待確認取消的訂單 id
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  // 二次確認：記錄正在等待確認申請退款的訂單 id
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null)
  // 二次確認：確認收到商品
  const [confirmReceiptId, setConfirmReceiptId] = useState<string | null>(null)
  // 確認收到商品動畫
  const [receiptConfirming, setReceiptConfirming] = useState<string | null>(null)
  // 模擬付款：記錄正在進行付款的訂單 id 與動畫狀態
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payingProcessing, setPayingProcessing] = useState(false)

  // 魔法卡：3 秒模擬傳輸後呼叫後端付款（寫 final_captured_amount，spec §9.4）
  const handleCardPay = (orderId: string) => {
    setPayingProcessing(true)
    setTimeout(() => {
      void payOrderViaApi(orderId)
      setPayingId(null)
      setPayingProcessing(false)
    }, 3000)
  }

  // 金庫轉帳：使用者確認已匯款 → 呼叫後端付款（寫 final_captured_amount，spec §9.4）
  const handleVaultConfirm = (orderId: string) => {
    void payOrderViaApi(orderId)
    setPayingId(null)
  }

  // 貨到付款（unpaid edge case）：確認設定 → 進入備貨
  const handleCodConfirm = (orderId: string) => {
    updateOrderStatus(orderId, 'processing')
    setPayingId(null)
  }

  // 貨到付款收款確認：模擬配送員到達 → 2 秒動畫 → 完成
  const [codDelivering, setCodDelivering] = useState<string | null>(null)
  const handleCodDelivered = (orderId: string) => {
    setCodDelivering(orderId)
    setTimeout(() => {
      updateOrderStatus(orderId, 'completed')
      setCodDelivering(null)
    }, 2000)
  }

  // 依登入 email 篩選（訪客：顯示全部本機訂單）
  const myOrders = user
    ? orders.filter(o => o.email.toLowerCase() === user.email.toLowerCase())
    : orders

  // 常客計算：此帳號已完成的訂單數
  const completedCount = user
    ? orders.filter(o => o.email.toLowerCase() === user.email.toLowerCase() && o.status === 'completed').length
    : 0
  const isLoyal = completedCount >= 3
  const isMinistryUser = user?.email.toLowerCase().includes('magic_admin') ?? false

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 頁首 */}
        <div className={styles.header}>
          <Link to="/" className={styles.backLink}>← 回到商店</Link>
          <h1 className={styles.title}>🦉 我的訂單</h1>
          {user && (
            <p className={styles.sub}>
              {user.email}
              {/* 魔法部員工標記 */}
              {isMinistryUser && <span className={styles.ministryTag}>⚖️ 魔法部員工</span>}
            </p>
          )}
        </div>

        {/* ── 常客俱樂部 / 魔法部優惠橫幅 ── */}
        {user && (
          <div className={styles.perksBar}>
            {isMinistryUser && (
              <div className={styles.perkCard} style={{ borderColor: 'rgba(100,130,220,0.5)', background: 'rgba(100,130,220,0.08)' }}>
                <p className={styles.perkTitle}>⚖️ 魔法部員工專屬優惠</p>
                <p className={styles.perkDesc}>結帳時系統將自動識別您的身份，享有商品小計 <strong>15% 折扣</strong>。<br />另可輸入代碼 <code className={styles.perkCode}>MINISTRY24</code> 再享額外 20% 折扣。</p>
              </div>
            )}
            {isLoyal ? (
              <div className={styles.perkCard} style={{ borderColor: 'rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.07)' }}>
                <p className={styles.perkTitle}>🎖️ 常客俱樂部 — 解鎖成功！</p>
                <p className={styles.perkDesc}>
                  你已完成 <strong>{completedCount}</strong> 筆訂單，獲得常客折扣碼：
                </p>
                <div className={styles.loyalCodeRow}>
                  <code className={styles.loyalCode}>LOYAL777</code>
                  <span className={styles.loyalHint}>折抵 3 枚金加隆（結帳時輸入）</span>
                </div>
              </div>
            ) : completedCount > 0 ? (
              <div className={styles.perkCard}>
                <p className={styles.perkTitle}>⭐ 常客俱樂部進度</p>
                <p className={styles.perkDesc}>
                  再完成 <strong>{3 - completedCount}</strong> 筆訂單，即可解鎖常客折扣碼 LOYAL777（折抵 3 金加隆）
                </p>
                <div className={styles.loyalProgress}>
                  <div className={styles.loyalProgressBar} style={{ width: `${(completedCount / 3) * 100}%` }} />
                </div>
                <p className={styles.loyalProgressLabel}>{completedCount} / 3 筆完成</p>
              </div>
            ) : null}
          </div>
        )}

        {myOrders.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyIcon}>📭</p>
            <p>尚無訂單記錄</p>
            <Link to="/" className={styles.shopBtn}>前往選購</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {myOrders.map(order => {
              const stepIdx = getStepIndex(order.status)
              const isExpanded = expandedId === order.id
              // 中文註解：進入退款 / 取消 / 異常流程的訂單不顯示配送進度條
              const isCancelled = ['cancelled', 'refunding', 'return_pending', 'refunded', 'rejected', 'refund_failed', 'shipping_failed'].includes(order.status)

              return (
                <div key={order.id} className={styles.card}>
                  {/* 訂單標題列 */}
                  <div
                    className={styles.cardHeader}
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className={styles.cardMeta}>
                      <span className={styles.orderId}>{order.id}</span>
                      <span className={styles.orderDate}>
                        {new Date(order.createdAt).toLocaleString('zh-TW', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className={styles.cardRight}>
                      <span
                        className={styles.statusBadge}
                        style={{ color: STATUS_COLORS[order.status] }}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                      <span className={styles.total}>{formatPrice(order.totalKnut)}</span>
                      <span className={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* 展開詳情 */}
                  {isExpanded && (
                    <div className={styles.cardBody}>
                      {/* 配送進度條（取消/退款時不顯示） */}
                      {!isCancelled && (
                        <div className={styles.progressWrap}>
                          <div className={styles.progressTrack}>
                            {STEPS.map((step, i) => (
                              <div key={step.status} className={styles.progressStep}>
                                <div
                                  className={`${styles.progressDot} ${i <= stepIdx ? styles.progressDotDone : ''} ${i === stepIdx ? styles.progressDotActive : ''}`}
                                />
                                <span className={`${styles.progressLabel} ${i <= stepIdx ? styles.progressLabelDone : ''}`}>
                                  {step.label}
                                </span>
                                {i < STEPS.length - 1 && (
                                  <div className={`${styles.progressLine} ${i < stepIdx ? styles.progressLineDone : ''}`} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 物流單號 */}
                      {order.trackingNumber && (
                        <div className={styles.trackingBox}>
                          <span className={styles.trackingLabel}>貓頭鷹物流單號</span>
                          <code className={styles.trackingCode}>{order.trackingNumber}</code>
                        </div>
                      )}

                      {/* 商品明細 */}
                      <div className={styles.section}>
                        <p className={styles.sectionTitle}>商品明細</p>
                        {order.items.map((item, i) => (
                          <div key={i} className={styles.itemRow}>
                            {/* 商品圖片快照（下單當下快照，後台換圖不影響） */}
                            {item.snapshotImageUrl && (
                              <img
                                src={item.snapshotImageUrl}
                                alt={item.snapshotName}
                                className={styles.itemThumb}
                              />
                            )}
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
                        <div className={styles.itemRow}>
                          <span>{DELIVERY_LABELS[order.shippingMethod] ?? order.shippingMethod}</span>
                          <span>{formatPrice(order.shippingFeeKnut)}</span>
                        </div>
                        {order.couponCode && (
                          <div className={`${styles.itemRow} ${styles.discount}`}>
                            <span>優惠券「{order.couponCode}」</span>
                            <span>- {formatPrice(order.discountKnut)}</span>
                          </div>
                        )}
                        {order.isRon && (
                          <div className={`${styles.itemRow} ${styles.ronRow}`}>
                            <span>衛斯理家族特供方案 +100%</span>
                            <span>+ {formatPrice(order.subtotalKnut)}</span>
                          </div>
                        )}
                        <div className={`${styles.itemRow} ${styles.totalRow}`}>
                          <span>總計</span>
                          <span>{formatPrice(order.totalKnut)}</span>
                        </div>
                      </div>

                      {/* 配送資訊 */}
                      <div className={styles.section}>
                        <p className={styles.sectionTitle}>配送資訊</p>
                        <p className={styles.infoRow}><strong>地址：</strong>{order.shippingAddress}</p>
                        <p className={styles.infoRow}><strong>配送方式：</strong>{DELIVERY_LABELS[order.shippingMethod]}</p>
                      </div>

                      {/* 配送異常通知（shipping_failed） */}
                      {order.status === 'shipping_failed' && (
                        <div className={styles.shippingFailedNotice}>
                          <p className={styles.shippingFailedTitle}>⚠️ 配送異常</p>
                          <p className={styles.shippingFailedDesc}>
                            貓頭鷹無法送達您的收件地址，店家正在處理中。請確認地址是否正確，如需協助請聯繫客服。
                          </p>
                          <p className={styles.shippingFailedAddress}>
                            <strong>目前地址：</strong>{order.shippingAddress}
                          </p>
                        </div>
                      )}

                      {/* 退貨中通知（return_pending） */}
                      {order.status === 'return_pending' && (
                        <div className={styles.returnPendingNotice}>
                          <p className={styles.returnPendingTitle}>📮 退款已批准，請寄回商品</p>
                          <p className={styles.returnPendingDesc}>
                            您的退款申請已獲批准。請將商品寄回以下地址，確認入庫後將完成退款：
                          </p>
                          <div className={styles.returnAddress}>
                            <span className={styles.returnAddressLabel}>退貨地址</span>
                            <span className={styles.returnAddressValue}>對角巷 93 號，衛氏巫師法寶店</span>
                          </div>
                          <p className={styles.returnPendingHint}>退款金額將於確認收貨後 3-5 個工作天退回原帳戶。</p>
                        </div>
                      )}

                      {/* 退款被拒絕通知（rejected / 舊版 refund_failed） */}
                      {(order.status === 'rejected' || order.status === 'refund_failed') && (
                        <div className={styles.refundRejectedNotice}>
                          <p className={styles.refundRejectedTitle}>🚫 退款申請已被拒絕</p>
                          {order.refundRejectReason && (
                            <p className={styles.refundRejectedReason}>{order.refundRejectReason}</p>
                          )}
                          <p className={styles.refundRejectedHint}>如有疑問請透過客服信箱聯繫。</p>
                        </div>
                      )}

                      {/* 驚喜納特券（訂單完成自動發放） */}
                      {order.status === 'completed' && order.surpriseCouponCode && (
                        <div className={styles.surpriseCouponBox}>
                          <p className={styles.surpriseCouponTitle}>🎁 感謝您的支持！</p>
                          <p className={styles.surpriseCouponDesc}>特別贈送下次購物折抵 <strong>1 納特</strong> 驚喜優惠券：</p>
                          <div className={styles.surpriseCouponRow}>
                            <code className={styles.surpriseCouponCode}>{order.surpriseCouponCode}</code>
                            <button
                              className={styles.surpriseCopyBtn}
                              onClick={() => {
                                void navigator.clipboard.writeText(order.surpriseCouponCode!)
                                setCopiedCode(order.surpriseCouponCode!)
                                setTimeout(() => setCopiedCode(null), 2000)
                              }}
                            >
                              {copiedCode === order.surpriseCouponCode ? '✓ 已複製' : '複製'}
                            </button>
                          </div>
                          <p className={styles.surpriseCouponHint}>結帳時於優惠碼欄輸入即可折抵，無最低消費限制。</p>
                        </div>
                      )}

                      {/* 貨到付款收款確認（備貨中 + 貨到付款） */}
                      {order.status === 'processing' && order.paymentMethod === 'cash_on_delivery' && (
                        <div className={styles.payArea}>
                          {codDelivering === order.id ? (
                            <div className={styles.cardProcessing}>
                              <span className={styles.cardSpinner}>📦</span>
                              <span>配送員正在前往，確認收款中…</span>
                            </div>
                          ) : (
                            <div className={styles.payPanel}>
                              <p className={styles.payPanelTitle}>📦 貨到交金加隆</p>
                              <div className={styles.vaultInfo}>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>應付金額</span>
                                  <span className={styles.vaultAmount}>{formatPrice(order.totalKnut)}</span>
                                </div>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>收件地址</span>
                                  <span className={styles.vaultNote}>{order.shippingAddress}</span>
                                </div>
                              </div>
                              <p className={styles.payHint}>配送員送達時請準備好金加隆，點擊下方按鈕模擬收款完成。</p>
                              <button
                                className={styles.payConfirmBtn}
                                onClick={() => handleCodDelivered(order.id)}
                              >
                                🏠 模擬配送員到達・確認收款
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 模擬付款（僅限待付款訂單） */}
                      {order.status === 'unpaid' && (
                        <div className={styles.payArea}>
                          {payingId !== order.id ? (
                            <button
                              className={styles.payBtn}
                              onClick={() => { setPayingId(order.id); setPayingProcessing(false) }}
                            >
                              💰 立即付款（{PAYMENT_LABELS[order.paymentMethod]}）
                            </button>
                          ) : order.paymentMethod === 'vault_transfer' ? (
                            // ── 金庫轉帳面板 ──
                            <div className={styles.payPanel}>
                              <p className={styles.payPanelTitle}>🏦 古靈閣轉帳資訊</p>
                              <div className={styles.vaultInfo}>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>收款帳號</span>
                                  <code className={styles.vaultCode}>{mockVaultAccount(order.id)}</code>
                                </div>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>應付金額</span>
                                  <span className={styles.vaultAmount}>{formatPrice(order.totalKnut)}</span>
                                </div>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>備註欄</span>
                                  <span className={styles.vaultNote}>{order.id}</span>
                                </div>
                              </div>
                              <p className={styles.payHint}>請於 72 小時內完成匯款，並填入上方備註欄。匯款完成後點擊確認，系統將自動進入備貨流程。</p>
                              <div className={styles.payBtns}>
                                <button
                                  className={styles.payConfirmBtn}
                                  onClick={() => handleVaultConfirm(order.id)}
                                >
                                  ✅ 我已完成匯款
                                </button>
                                <button
                                  className={styles.payBackBtn}
                                  onClick={() => setPayingId(null)}
                                >
                                  稍後再付
                                </button>
                              </div>
                            </div>
                          ) : order.paymentMethod === 'cash_on_delivery' ? (
                            // ── 貨到付款面板（unpaid edge case）──
                            <div className={styles.payPanel}>
                              <p className={styles.payPanelTitle}>📦 貨到交金加隆</p>
                              <div className={styles.vaultInfo}>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>付款方式</span>
                                  <span>配送員到達時付款</span>
                                </div>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>應付金額</span>
                                  <span className={styles.vaultAmount}>{formatPrice(order.totalKnut)}</span>
                                </div>
                                <div className={styles.vaultRow}>
                                  <span className={styles.vaultLabel}>收件地址</span>
                                  <span className={styles.vaultNote}>{order.shippingAddress}</span>
                                </div>
                              </div>
                              <p className={styles.payHint}>無需預先付款，配送員送達時以金加隆支付即可。點擊下方按鈕確認訂單並進入備貨。</p>
                              <div className={styles.payBtns}>
                                <button
                                  className={styles.payConfirmBtn}
                                  onClick={() => handleCodConfirm(order.id)}
                                >
                                  ✅ 確認訂單・等待配送
                                </button>
                                <button
                                  className={styles.payBackBtn}
                                  onClick={() => setPayingId(null)}
                                >
                                  稍後確認
                                </button>
                              </div>
                            </div>
                          ) : (
                            // ── 魔法卡面板 ──
                            <div className={styles.payPanel}>
                              <p className={styles.payPanelTitle}>💳 魔法卡付款確認</p>
                              <p className={styles.payHint}>應付金額：<strong>{formatPrice(order.totalKnut)}</strong></p>
                              {payingProcessing ? (
                                <div className={styles.cardProcessing}>
                                  <span className={styles.cardSpinner}>✨</span>
                                  <span>魔法傳輸中，請稍候…</span>
                                </div>
                              ) : (
                                <div className={styles.payBtns}>
                                  <button
                                    className={styles.payConfirmBtn}
                                    onClick={() => handleCardPay(order.id)}
                                  >
                                    ⚡ 魔法傳輸付款（3 秒完成）
                                  </button>
                                  <button
                                    className={styles.payBackBtn}
                                    onClick={() => setPayingId(null)}
                                  >
                                    稍後再付
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 取消訂單（僅限待付款 / 備貨中） */}
                      {(order.status === 'unpaid' || order.status === 'processing') && (
                        <div className={styles.cancelArea}>
                          {confirmCancelId === order.id ? (
                            <>
                              <p className={styles.cancelWarning}>⚠️ 確定要取消這筆訂單嗎？此操作無法復原。</p>
                              <div className={styles.cancelBtns}>
                                <button
                                  className={styles.cancelConfirmBtn}
                                  onClick={async () => {
                                    await cancelOrderViaApi(order.id)
                                    setConfirmCancelId(null)
                                    void syncProducts()  // 取消後同步庫存，讓前台商品顯示正確數量
                                  }}
                                >
                                  確認取消訂單
                                </button>
                                <button
                                  className={styles.cancelBackBtn}
                                  onClick={() => setConfirmCancelId(null)}
                                >
                                  我再想想
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              className={styles.cancelBtn}
                              onClick={() => setConfirmCancelId(order.id)}
                            >
                              取消訂單
                            </button>
                          )}
                        </div>
                      )}

                      {/* 確認收到商品（僅限運送中） */}
                      {order.status === 'shipped' && (
                        <div className={styles.receiptArea}>
                          {receiptConfirming === order.id ? (
                            <div className={styles.receiptConfirming}>
                              <span>📬 正在確認簽收，請稍候…</span>
                            </div>
                          ) : confirmReceiptId === order.id ? (
                            <>
                              <p className={styles.receiptWarning}>📦 確定已收到商品？確認後將標記為「已送達」。</p>
                              <div className={styles.cancelBtns}>
                                <button
                                  className={styles.receiptConfirmBtn}
                                  onClick={async () => {
                                    setReceiptConfirming(order.id)
                                    setConfirmReceiptId(null)
                                    await confirmReceiptViaApi(order.id)
                                    setReceiptConfirming(null)
                                  }}
                                >
                                  ✅ 確認已收到商品
                                </button>
                                <button
                                  className={styles.cancelBackBtn}
                                  onClick={() => setConfirmReceiptId(null)}
                                >
                                  稍後確認
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              className={styles.receiptBtn}
                              onClick={() => setConfirmReceiptId(order.id)}
                            >
                              📬 確認收到商品
                            </button>
                          )}
                        </div>
                      )}

                      {/* 申請退款（付款後的訂單：processing / shipped / completed，貨到付款不退款，spec §6.4） */}
                      {(['processing', 'shipped', 'completed'] as OrderStatus[]).includes(order.status) && order.paymentMethod !== 'cash_on_delivery' && (
                        <div className={styles.cancelArea}>
                          {confirmRefundId === order.id ? (
                            <>
                              <p className={styles.cancelWarning}>
                                🔄 確定申請退款？提交後需等待巫師法寶店審核（通常 1-3 個工作天）。
                              </p>
                              <div className={styles.cancelBtns}>
                                <button
                                  className={styles.refundConfirmBtn}
                                  onClick={async () => {
                                    await requestRefundViaApi(order.id)
                                    setConfirmRefundId(null)
                                  }}
                                >
                                  確認申請退款
                                </button>
                                <button
                                  className={styles.cancelBackBtn}
                                  onClick={() => setConfirmRefundId(null)}
                                >
                                  我再想想
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              className={styles.refundBtn}
                              onClick={() => setConfirmRefundId(order.id)}
                            >
                              🔄 申請退款
                            </button>
                          )}
                        </div>
                      )}

                      {/* 退款流程進度條（refunding / return_pending / refunded，spec §6.4） */}
                      {(['refunding', 'return_pending', 'refunded'] as OrderStatus[]).includes(order.status) && (
                        <div className={order.status === 'refunded' ? styles.refundedNotice : styles.refundingNotice}>
                          {/* 四步驟退款進度：已申請 → 審核通過 → 退貨中 → 退款完成 */}
                          <div className={styles.refundTrack}>
                            {/* 步驟 1：已申請 */}
                            <div className={styles.refundStep}>
                              <div className={`${styles.refundDot} ${styles.refundDotDone}`} />
                              <span className={`${styles.refundLabel} ${styles.refundLabelDone}`}>已申請</span>
                            </div>
                            <div className={styles.refundLine} />
                            {/* 步驟 2：審核通過 */}
                            <div className={styles.refundStep}>
                              <div className={`${styles.refundDot} ${
                                ['return_pending', 'refunded'].includes(order.status) ? styles.refundDotDone : styles.refundDotActive
                              }`} />
                              <span className={`${styles.refundLabel} ${
                                ['return_pending', 'refunded'].includes(order.status) ? styles.refundLabelDone : styles.refundLabelActive
                              }`}>
                                {order.status === 'refunding' ? '審核中' : '審核通過'}
                              </span>
                            </div>
                            <div className={`${styles.refundLine} ${['return_pending', 'refunded'].includes(order.status) ? styles.refundLineDone : ''}`} />
                            {/* 步驟 3：退貨中 */}
                            <div className={styles.refundStep}>
                              <div className={`${styles.refundDot} ${
                                order.status === 'return_pending' ? styles.refundDotActive : order.status === 'refunded' ? styles.refundDotDone : ''
                              }`} />
                              <span className={`${styles.refundLabel} ${
                                order.status === 'return_pending' ? styles.refundLabelActive : order.status === 'refunded' ? styles.refundLabelDone : ''
                              }`}>退貨中</span>
                            </div>
                            <div className={`${styles.refundLine} ${order.status === 'refunded' ? styles.refundLineDone : ''}`} />
                            {/* 步驟 4：退款完成 */}
                            <div className={styles.refundStep}>
                              <div className={`${styles.refundDot} ${order.status === 'refunded' ? styles.refundDotDone : ''}`} />
                              <span className={`${styles.refundLabel} ${order.status === 'refunded' ? styles.refundLabelDone : ''}`}>退款完成</span>
                            </div>
                          </div>

                          {order.status === 'refunding' && (
                            <>
                              <p className={styles.refundingTitle}>🔄 退款審核中</p>
                              <p className={styles.refundingDesc}>
                                您的退款申請已提交，店家審核中。通過後將通知您寄回商品。
                              </p>
                            </>
                          )}
                          {order.status === 'return_pending' && (
                            <>
                              <p className={styles.refundingTitle}>📮 退款已批准，等待退貨入庫</p>
                              <p className={styles.refundingDesc}>
                                退貨地址：對角巷 93 號，衛氏巫師法寶店。確認入庫後 3-5 個工作天退款。
                              </p>
                            </>
                          )}
                          {order.status === 'refunded' && (
                            <>
                              <p className={styles.refundedTitle}>💸 退款已完成</p>
                              <p className={styles.refundingDesc}>
                                退款已處理完成，金額將於 3-5 個工作天內回到您的帳戶。
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyOrdersPage
