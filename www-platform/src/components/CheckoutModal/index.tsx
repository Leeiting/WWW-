import { useState } from 'react'
import { useCartStore, formatPrice } from '@/store/cartStore'
import type { DeliveryMethod } from '@/types'
import styles from './CheckoutModal.module.css'

// 配送方式設定（fee 單位：Knut，1 金加隆 = 17 銀閃 = 493 納特）
const DELIVERY_OPTIONS: {
  value: DeliveryMethod
  emoji: string
  name: string
  desc: string
  time: string
  fee: number   // 配送費（Knut）
}[] = [
  { value: 'instant',    emoji: '💨', name: '消影術',    desc: '瞬間送達，不保證完整性',            time: '即時',    fee: 5 * 17 * 29 },  // 5 金加隆
  { value: 'broom',      emoji: '🧹', name: '飛天掃帚',  desc: '快速空運',                         time: '1-2 小時', fee: 3 * 17 * 29 },  // 3 金加隆
  { value: 'thestral',   emoji: '🦴', name: '騎士墜鬼馬', desc: '標準陸運（僅目睹死亡者可見配送員）', time: '1-3 天',  fee: 1 * 17 * 29 },  // 1 金加隆
  { value: 'knight_bus', emoji: '🚌', name: '騎士公車',  desc: '社交體驗方案，途中可能繞路數次',    time: '不定',    fee: 5 * 29 },       // 5 銀閃
]

type Step = 'ron_check' | 'ron_confirm' | 'delivery' | 'order_review' | 'success'

interface CheckoutModalProps {
  onClose: () => void
}

const CheckoutModal = ({ onClose }: CheckoutModalProps) => {
  const items = useCartStore(s => s.items)
  const subtotal = useCartStore(s => s.subtotal)
  const total = useCartStore(s => s.total)
  const isRon = useCartStore(s => s.isRon)
  const setIsRon = useCartStore(s => s.setIsRon)
  const clearCart = useCartStore(s => s.clearCart)

  const [step, setStep] = useState<Step>('ron_check')
  const [delivery, setDelivery] = useState<DeliveryMethod>('instant')

  // 確認是榮恩（進二次確認）
  const handleYesRon = () => {
    setIsRon(true)
    setStep('ron_confirm')
  }

  // 確認不是榮恩
  const handleNotRon = () => {
    setIsRon(false)
    setStep('delivery')
  }

  // 二次確認後真的承認是榮恩
  const handleConfirmRon = () => setStep('delivery')

  // 送出訂單
  const handlePlaceOrder = () => {
    setStep('success')
    setTimeout(() => {
      clearCart()
      onClose()
    }, 3000)
  }

  const deliveryLabel = DELIVERY_OPTIONS.find(d => d.value === delivery)
  // 含配送費的最終金額
  const grandTotal = total() + (deliveryLabel?.fee ?? 0)

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Step 1：榮恩身份確認 */}
        {step === 'ron_check' && (
          <div className={styles.ronStep}>
            <div className={styles.ronIcon}>🧡</div>
            <h2 className={styles.ronTitle}>身份驗證</h2>
            <p className={styles.ronQuestion}>
              在結帳之前，我們需要確認一件很重要的事。<br /><br />
              <strong>請問你是否為榮恩・衛斯理？</strong>
            </p>
            <div className={styles.ronBtnGroup}>
              <button className={styles.btnNo} onClick={handleNotRon}>
                不，我只是路過的巫師（或其他人）
              </button>
              <button className={styles.btnYes} onClick={handleYesRon}>
                是的，我是榮恩・衛斯理
              </button>
            </div>
          </div>
        )}

        {/* Step 1b：榮恩二次確認 */}
        {step === 'ron_confirm' && (
          <div className={styles.confirmStep}>
            <div className={styles.ronIcon}>⚠️</div>
            <h2 className={styles.ronTitle}>等等，再確認一次</h2>
            <div className={styles.confirmWarning}>
              你確定要承認自己是榮恩嗎？<br /><br />
              根據「衛氏家族服務條款第 9¾ 條」，<strong>家屬結帳金額將加收 100% 家屬服務費</strong>，
              即總金額 × 2。<br /><br />
              此操作無法撤銷，且將記錄於衛斯理家族帳簿。
            </div>
            <div className={styles.ronBtnGroup}>
              <button className={styles.btnYes} onClick={handleConfirmRon}>
                我確定，我就是榮恩・衛斯理
              </button>
              <button className={styles.secondaryBtn} onClick={handleNotRon}>
                等等，我搞錯了（我不是榮恩）
              </button>
            </div>
          </div>
        )}

        {/* Step 2：配送方式 */}
        {step === 'delivery' && (
          <div className={styles.deliveryStep}>
            <h2 className={styles.stepTitle}>選擇配送方式</h2>
            <div className={styles.deliveryOptions}>
              {DELIVERY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.deliveryOption} ${delivery === opt.value ? styles.selected : ''}`}
                  onClick={() => setDelivery(opt.value)}
                >
                  <span className={styles.deliveryEmoji}>{opt.emoji}</span>
                  <div className={styles.deliveryInfo}>
                    <p className={styles.deliveryName}>{opt.name}</p>
                    <p className={styles.deliveryDesc}>{opt.desc}</p>
                  </div>
                  <div className={styles.deliveryMeta}>
                    <span className={styles.deliveryTime}>{opt.time}</span>
                    <span className={styles.deliveryFee}>{formatPrice(opt.fee)}</span>
                  </div>
                </button>
              ))}
            </div>
            <button className={styles.primaryBtn} onClick={() => setStep('order_review')}>
              確認配送方式 →
            </button>
            <button className={styles.secondaryBtn} onClick={onClose}>取消</button>
          </div>
        )}

        {/* Step 3：訂單確認 */}
        {step === 'order_review' && (
          <div className={styles.confirmOrderStep}>
            <h2 className={styles.stepTitle}>確認訂單</h2>

            <div className={styles.receipt}>
              {/* 商品明細 */}
              {items.map(item => (
                <div key={item.productId} className={styles.receiptRow}>
                  <span>{item.productName} × {item.quantity}</span>
                  <span>{formatPrice(item.displayPrice * item.quantity)}</span>
                </div>
              ))}

              {/* 配送方式 */}
              <div className={styles.receiptRow}>
                <span>配送方式　{deliveryLabel?.emoji} {deliveryLabel?.name}</span>
                <span>{formatPrice(deliveryLabel?.fee ?? 0)}</span>
              </div>

              {/* 榮恩稅 */}
              {isRon && (
                <div className={`${styles.receiptRow} ${styles.receiptRowHighlight}`}>
                  <span>家屬服務費 100%</span>
                  <span>+ {formatPrice(subtotal())}</span>
                </div>
              )}

              {/* 總計（商品 + 榮恩稅 + 配送費） */}
              <div className={styles.receiptTotal}>
                <span>總計</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {/* 榮恩申報說明 */}
            {isRon && (
              <p className={styles.ronNote}>
                您已自願申報家屬身份，家屬服務費已計入總額。
              </p>
            )}

            <button className={styles.primaryBtn} onClick={handlePlaceOrder}>
              立即交出金加隆 💰
            </button>
            <button className={styles.secondaryBtn} onClick={() => setStep('delivery')}>
              ← 返回修改
            </button>
          </div>
        )}

        {/* Step 4：成功 */}
        {step === 'success' && (
          <div className={styles.successStep}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>訂單成立！</h2>
            <p className={styles.successMsg}>
              感謝你在衛氏巫師法寶店購物！<br />
              你的商品正在以{deliveryLabel?.emoji} {deliveryLabel?.name}送出。<br /><br />
              <em>若發現副作用，請勿聯絡我們。</em>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

export default CheckoutModal
