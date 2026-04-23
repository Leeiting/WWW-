import { useState, useEffect } from 'react'
import { useCartStore, formatPrice } from '@/store/cartStore'
import { useOrderStore } from '@/store/orderStore'
import { useProductStore } from '@/store/productStore'
import { useProfileStore } from '@/store/profileStore'
import type { DeliveryMethod, PaymentMethod } from '@/types'
import { useCouponStore, validateCoupon } from '@/store/couponStore'
import { useSiteDiscountStore } from '@/store/siteDiscountStore'
import styles from './CheckoutModal.module.css'

// ── 配送方式設定（fee 單位：Knut）──
const DELIVERY_OPTIONS: {
  value: DeliveryMethod
  emoji: string
  name: string
  desc: string
  time: string
  fee: number
}[] = [
  { value: 'instant',    emoji: '💨', name: '消影術',     desc: '瞬間送達，不保證完整性',              time: '即時',     fee: 5 * 17 * 29 },
  { value: 'broom',      emoji: '🧹', name: '飛天掃帚',   desc: '快速空運',                            time: '1-2 小時', fee: 3 * 17 * 29 },
  { value: 'thestral',   emoji: '🦴', name: '騎士墜鬼馬', desc: '標準陸運（僅目睹死亡者可見配送員）',  time: '1-3 天',   fee: 1 * 17 * 29 },
  { value: 'knight_bus', emoji: '🚌', name: '騎士公車',   desc: '社交體驗方案，途中可能繞路數次',      time: '不定',     fee: 5 * 29 },
]

// ── 支付方式設定（spec §8）──
const PAYMENT_OPTIONS: {
  value: PaymentMethod
  emoji: string
  name: string
  desc: string
}[] = [
  { value: 'vault_transfer',   emoji: '🏦', name: '巫師金庫轉帳', desc: '古靈閣帳號末五碼，72 小時內確認入帳' },
  { value: 'cash_on_delivery', emoji: '📦', name: '貨到交金加隆', desc: '貓頭鷹送達時收款，訂單直接進入待出貨' },
  { value: 'mock_card',        emoji: '💳', name: '魔法卡',       desc: '輸入 16 位數卡號，3 秒魔法傳輸完成' },
]

// 榮恩靜默識別（spec §6.2）
const detectIsRon = (email: string): boolean =>
  email.toLowerCase().includes('ron')

// Email 格式驗證（RFC 5322 簡化版）
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())

// 郵遞區號格式驗證（台灣 3 碼或 5 碼）
const isValidPostalCode = (code: string): boolean =>
  /^\d{3}(\d{2})?$/.test(code.trim())

// 金庫末五碼驗證（必須恰好 5 位數字）
const isValidVaultCode = (code: string): boolean =>
  /^\d{5}$/.test(code.trim())

// 電話號碼驗證（台灣手機：09 開頭，共 10 碼）
const isValidPhone = (phone: string): boolean =>
  /^09\d{8}$/.test(phone.replace(/[\s-]/g, ''))

// 結帳步驟：地址 → 配送 → 支付 → 優惠券 → 確認 → 成功
type Step = 'address' | 'delivery' | 'payment' | 'coupon' | 'order_review' | 'success'

interface CheckoutModalProps {
  onClose: () => void
}

const CheckoutModal = ({ onClose }: CheckoutModalProps) => {
  const items = useCartStore(s => s.items)
  const baseSubtotal = useCartStore(s => s.baseSubtotal)
  const setIsRon = useCartStore(s => s.setIsRon)
  const clearCart = useCartStore(s => s.clearCart)
  const addOrderViaApi = useOrderStore(s => s.addOrderViaApi)
  const syncProducts = useProductStore(s => s.syncFromApi)
  const deductStockForOrder = useProductStore(s => s.deductStockForOrder)
  const profile = useProfileStore()
  // 折價券清單（來自 couponStore，持久化於 localStorage）
  const coupons = useCouponStore(s => s.coupons)
  // 全站折扣（管理員設定，自動套用於商品小計）
  const siteDiscountEnabled = useSiteDiscountStore(s => s.enabled)
  const siteDiscountLabel   = useSiteDiscountStore(s => s.label)
  const siteDiscountRate    = useSiteDiscountStore(s => s.rate)

  // ── 步驟狀態 ──
  const [step, setStep] = useState<Step>('address')

  // ── 等冪鍵：modal 開啟時生成一次，重複提交時後端識別為同一筆訂單 ──
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  // ── 提交防連點 ──
  const [submitting, setSubmitting] = useState(false)

  // ── Step 1：信箱 + 電話 + 郵遞區號 + 地址 ──
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [address, setAddress] = useState('')

  // ── Step 2：配送方式 ──
  const [delivery, setDelivery] = useState<DeliveryMethod>('instant')

  // ── Step 3：支付方式 + 魔法卡號 + 金庫末五碼 ──
  const [payment, setPayment] = useState<PaymentMethod>('vault_transfer')
  const [cardNumber, setCardNumber] = useState('')
  const [vaultCode, setVaultCode] = useState('')
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)

  // ── Step 4：優惠券 ──
  const [couponCode, setCouponCode] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)

  // ── 開啟時從個人資料自動帶入 ──
  useEffect(() => {
    if (profile.address)    setAddress(profile.address)
    if (profile.postalCode) setPostalCode(profile.postalCode)
    if (profile.vaultLastFive) setVaultCode(profile.vaultLastFive)
    if (profile.phone)      setPhone(profile.phone)
  }, [])  // 僅帶入一次

  // ── 計算金額 ──
  const deliveryOpt = DELIVERY_OPTIONS.find(d => d.value === delivery)
  const deliveryFee = deliveryOpt?.fee ?? 0
  const subtotal = baseSubtotal()
  const previewIsRon = detectIsRon(email)
  const ronTax = previewIsRon ? subtotal : 0
  // 魔法部員工自動折 15%（email 含 magic_admin）
  const isMagicAdmin = email.toLowerCase().includes('magic_admin')
  const ministryDiscountKnut = isMagicAdmin ? Math.round(subtotal * 0.15) : 0
  // 全站折扣（管理員設定，套用於商品小計，rate=0.8 表示 8折 → 折抵 20%）
  const siteDiscountKnut = siteDiscountEnabled && siteDiscountRate < 1
    ? Math.round(subtotal * (1 - siteDiscountRate))
    : 0
  const grandTotal = subtotal + ronTax + deliveryFee - couponDiscount - ministryDiscountKnut - siteDiscountKnut

  // ── Step 1 驗證：信箱有效 + 電話有效 + 郵遞區號有效 + 地址非空 ──
  const step1Valid =
    isValidEmail(email) &&
    isValidPhone(phone) &&
    isValidPostalCode(postalCode) &&
    address.trim().length > 0

  // ── Step 3 支付繼續條件 ──
  const paymentNextEnabled =
    payment === 'cash_on_delivery' ||
    (payment === 'vault_transfer' && isValidVaultCode(vaultCode)) ||
    (payment === 'mock_card' && cardNumber.length >= 16)

  // ── 優惠券驗證（走 couponStore，支援魔法部限定與百分比折扣）──
  const handleApplyCoupon = () => {
    const result = validateCoupon(coupons, couponInput, subtotal, isMagicAdmin)
    if (result.ok) {
      setCouponDiscount(result.discountKnut)
      setCouponCode(result.coupon.code)
      setCouponError('')
    } else {
      setCouponError(result.error)
    }
  }

  // ── 魔法卡支付模擬（3 秒動畫，spec §8.3）──
  const handleCardPayment = () => {
    if (cardNumber.replace(/\s/g, '').length < 16) return
    setIsPaymentProcessing(true)
    setTimeout(() => {
      setIsPaymentProcessing(false)
      setStep('coupon')
    }, 3000)
  }

  // ── 提交訂單（靜默偵測榮恩 + 魔法部折扣，spec §6.2）──
  const handlePlaceOrder = async () => {
    if (submitting) return  // 防連點：同一筆訂單已在提交中
    setSubmitting(true)
    try {
      const isRon = detectIsRon(email)
      setIsRon(isRon)
      const finalSubtotal = subtotal
      const finalMinistryDiscount = isMagicAdmin ? Math.round(finalSubtotal * 0.15) : 0
      const finalSiteDiscount = siteDiscountEnabled && siteDiscountRate < 1
        ? Math.round(finalSubtotal * (1 - siteDiscountRate))
        : 0
      const finalTotal = finalSubtotal + (isRon ? finalSubtotal : 0) + deliveryFee - couponDiscount - finalMinistryDiscount - finalSiteDiscount

      // 中文註解：帶入冪等鍵，後端收到相同 key 時直接回傳既有訂單，不重複扣庫存
      await addOrderViaApi({
        email,
        status: payment === 'cash_on_delivery' ? 'processing' : 'unpaid',
        items: items.map(item => ({
          skuId: item.skuId,
          productId: item.productId,
          snapshotName: item.productName,
          snapshotSpec: item.skuSpec,
          snapshotImageUrl: item.imageUrl,  // 加入購物車時快照的圖片，後台換圖不影響訂單記錄
          quantity: item.quantity,
          unitPriceKnut: item.basePrice,
        })),
        shippingAddress: `${postalCode} ${address}`,
        shippingMethod: delivery,
        paymentMethod: payment,
        couponCode: couponCode || undefined,
        discountKnut: couponDiscount + finalMinistryDiscount + finalSiteDiscount,  // 合計折扣（優惠券 + 魔法部 + 全站折扣）
        subtotalKnut: finalSubtotal,
        shippingFeeKnut: deliveryFee,
        isRon,
        totalKnut: finalTotal,  // 含榮恩稅、配送費、魔法部折扣、優惠券折扣、全站折扣
        idempotencyKey,  // 冪等鍵
      })

      // 中文註解：本地立即扣減庫存，syncFromApi 後會以後端數據覆蓋（有後端時）
      deductStockForOrder(items.map(item => ({
        productId: item.productId,
        skuId: item.skuId,
        quantity: item.quantity,
      })))
      setStep('success')
      void syncProducts()  // 下單成功後立即同步商品庫存
      setTimeout(() => {
        clearCart()
        onClose()
      }, 4000)
    } finally {
      setSubmitting(false)
    }
  }

  // ── 魔法卡號格式化顯示（spec §8.4）──
  const formatCardDisplay = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }
  const maskedCard = () => {
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length <= 4) return formatCardDisplay(cardNumber)
    const visible = digits.slice(-4)
    const hidden = '*'.repeat(Math.min(digits.length - 4, 12))
    return (hidden + visible).replace(/(.{4})/g, '$1 ').trim()
  }

  // ── 欄位錯誤提示（只在使用者離開後顯示）──
  const [emailTouched, setEmailTouched] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [postalTouched, setPostalTouched] = useState(false)
  const [vaultTouched, setVaultTouched] = useState(false)

  const showEmailError = emailTouched && email.length > 0 && !isValidEmail(email)
  const showPhoneError = phoneTouched && phone.length > 0 && !isValidPhone(phone)
  const showPostalError = postalTouched && postalCode.length > 0 && !isValidPostalCode(postalCode)
  const showVaultError = vaultTouched && vaultCode.length > 0 && !isValidVaultCode(vaultCode)

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* ── 步驟進度條 ── */}
        {step !== 'success' && (
          <div className={styles.stepBar}>
            {(['address', 'delivery', 'payment', 'coupon', 'order_review'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`${styles.stepDot} ${step === s ? styles.stepDotActive : ''} ${
                  ['address', 'delivery', 'payment', 'coupon', 'order_review'].indexOf(step) > i ? styles.stepDotDone : ''
                }`}
              />
            ))}
          </div>
        )}

        {/* ━━ Step 1：收件資訊 ━━ */}
        {step === 'address' && (
          <div className={styles.formStep}>
            <h2 className={styles.stepTitle}>📬 收件資訊</h2>

            {/* 巫師信箱 */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>巫師信箱 *</label>
              <input
                className={`${styles.fieldInput} ${showEmailError ? styles.fieldInputError : ''}`}
                type="email"
                placeholder="例：harry@hogwarts.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                autoFocus
              />
              {showEmailError && (
                <p className={styles.fieldError}>⚠️ 請輸入有效的信箱格式（例：name@example.com）</p>
              )}
              {/* 魔法部員工識別徽章（偵測到 magic_admin 時顯示）*/}
              {isMagicAdmin && (
                <p className={styles.ministryBadge}>
                  ⚖️ 魔法部員工身份已識別，結帳時自動享有 15% 折扣
                </p>
              )}
            </div>

            {/* 聯絡電話 */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>聯絡電話 *</label>
              <input
                className={`${styles.fieldInput} ${showPhoneError ? styles.fieldInputError : ''} ${isValidPhone(phone) ? styles.fieldInputOk : ''}`}
                type="tel"
                inputMode="numeric"
                placeholder="例：0912345678"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^\d-\s]/g, '').slice(0, 12))}
                onBlur={() => setPhoneTouched(true)}
                maxLength={12}
              />
              {showPhoneError && (
                <p className={styles.fieldError}>⚠️ 請輸入有效的手機號碼（09 開頭，共 10 碼）</p>
              )}
            </div>

            {/* 郵遞區號 */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>郵遞區號 *</label>
              <div className={styles.postalRow}>
                <input
                  className={`${styles.fieldInput} ${styles.postalInput} ${showPostalError ? styles.fieldInputError : ''} ${isValidPostalCode(postalCode) ? styles.fieldInputOk : ''}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="例：100 或 10001"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  onBlur={() => setPostalTouched(true)}
                  maxLength={5}
                />
                {isValidPostalCode(postalCode) && (
                  <span className={styles.postalOk}>✓ 已確認</span>
                )}
              </div>
              {showPostalError && (
                <p className={styles.fieldError}>⚠️ 郵遞區號須為 3 碼或 5 碼數字</p>
              )}
              <p className={styles.fieldHint}>台灣郵遞區號：3 碼（舊制）或 5 碼（新制）</p>
            </div>

            {/* 收件地址 */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>收件地址 *</label>
              <textarea
                className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                placeholder="例：英國蘇格蘭高地，霍格華茲城堡，葛來分多塔 6F"
                value={address}
                onChange={e => setAddress(e.target.value)}
                rows={3}
              />
            </div>

            {/* 魔法波動免責聲明（透明告知，spec §6.2）*/}
            <div className={styles.disclaimerBox}>
              <p className={styles.disclaimerBoxTitle}>⚠️ 魔法波動免責聲明</p>
              <p className={styles.disclaimerBoxText}>
                本店商品定價受斜角巷魔法擾動影響，<strong>最終成交金額以訂單確認頁為準</strong>。
                系統可能依購買者身份自動套用定價調整（含會員等級加成、全站促銷折扣等），
                調整明細將於確認頁完整揭露。
              </p>
            </div>

            <button
              className={styles.primaryBtn}
              onClick={() => setStep('delivery')}
              disabled={!step1Valid}
            >
              下一步：選擇配送方式 →
            </button>
            <button className={styles.secondaryBtn} onClick={onClose}>取消</button>
          </div>
        )}

        {/* ━━ Step 2：配送方式 ━━ */}
        {step === 'delivery' && (
          <div className={styles.deliveryStep}>
            <h2 className={styles.stepTitle}>🦅 選擇配送方式</h2>
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
            <button className={styles.primaryBtn} onClick={() => setStep('payment')}>
              下一步：選擇支付方式 →
            </button>
            <button className={styles.secondaryBtn} onClick={() => setStep('address')}>
              ← 返回修改
            </button>
          </div>
        )}

        {/* ━━ Step 3：支付方式（spec §8）━━ */}
        {step === 'payment' && (
          <div className={styles.deliveryStep}>
            <h2 className={styles.stepTitle}>💰 選擇支付方式</h2>
            <div className={styles.deliveryOptions}>
              {PAYMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.deliveryOption} ${payment === opt.value ? styles.selected : ''}`}
                  onClick={() => { setPayment(opt.value); setCardNumber(''); setVaultTouched(false) }}
                >
                  <span className={styles.deliveryEmoji}>{opt.emoji}</span>
                  <div className={styles.deliveryInfo}>
                    <p className={styles.deliveryName}>{opt.name}</p>
                    <p className={styles.deliveryDesc}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* 魔法卡：輸入 16 位卡號（遮罩顯示，spec §8.4） */}
            {payment === 'mock_card' && (
              <div className={styles.fieldGroup} style={{ marginTop: '16px' }}>
                <label className={styles.fieldLabel}>魔法卡號（16 位數）</label>
                <input
                  className={styles.fieldInput}
                  type="text"
                  inputMode="numeric"
                  placeholder="**** **** **** ****"
                  value={isPaymentProcessing ? maskedCard() : formatCardDisplay(cardNumber)}
                  onChange={e => !isPaymentProcessing && setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                  maxLength={19}
                  readOnly={isPaymentProcessing}
                />
                {isPaymentProcessing && (
                  <p className={styles.fieldHint} style={{ color: 'var(--gold)' }}>
                    ✨ 魔法傳輸中... 請稍候
                  </p>
                )}
              </div>
            )}

            {/* 金庫轉帳：末五碼（必須恰好 5 位數字） */}
            {payment === 'vault_transfer' && (
              <div className={styles.fieldGroup} style={{ marginTop: '16px' }}>
                <label className={styles.fieldLabel}>古靈閣金庫帳號末五碼 *</label>
                <input
                  className={`${styles.fieldInput} ${showVaultError ? styles.fieldInputError : ''} ${isValidVaultCode(vaultCode) ? styles.fieldInputOk : ''}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="例：74823"
                  value={vaultCode}
                  onChange={e => setVaultCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  onBlur={() => setVaultTouched(true)}
                  maxLength={5}
                />
                {showVaultError && (
                  <p className={styles.fieldError}>⚠️ 末五碼須為恰好 5 位數字</p>
                )}
                <p className={styles.fieldHint}>訂單建立後 72 小時內由管理員確認入帳</p>
              </div>
            )}

            {/* 貨到付款：無需額外輸入 */}
            {payment === 'cash_on_delivery' && (
              <div className={styles.fieldGroup} style={{ marginTop: '16px' }}>
                <p className={styles.fieldHint}>
                  📦 選擇此方式後訂單立即進入「待出貨」狀態，貓頭鷹送達時收款。
                </p>
              </div>
            )}

            {/* 魔法卡：3 秒動畫後進下一步 */}
            {payment === 'mock_card' ? (
              <button
                className={styles.primaryBtn}
                onClick={handleCardPayment}
                disabled={cardNumber.length < 16 || isPaymentProcessing}
                style={{ marginTop: '16px' }}
              >
                {isPaymentProcessing ? '✨ 魔法傳輸中...' : '送出魔法傳輸 →'}
              </button>
            ) : (
              <button
                className={styles.primaryBtn}
                onClick={() => setStep('coupon')}
                disabled={!paymentNextEnabled}
                style={{ marginTop: '16px' }}
              >
                下一步：輸入優惠券 →
              </button>
            )}
            <button className={styles.secondaryBtn} onClick={() => setStep('delivery')}>
              ← 返回修改
            </button>
          </div>
        )}

        {/* ━━ Step 4：優惠券（spec §7.3）━━ */}
        {step === 'coupon' && (
          <div className={styles.formStep}>
            <h2 className={styles.stepTitle}>🎟 輸入優惠券</h2>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>優惠券代碼（選填）</label>

              {/* 可用優惠券下拉選單（僅顯示啟用中且符合身份的券）*/}
              {(() => {
                const visibleCoupons = coupons.filter(c => c.active && (!c.ministryOnly || isMagicAdmin))
                if (visibleCoupons.length === 0) return null
                return (
                  <select
                    className={styles.couponDropdown}
                    value=""
                    onChange={e => {
                      const code = e.target.value
                      if (!code) return
                      setCouponInput(code)
                      setCouponError('')
                      // 選取後自動套用
                      const result = validateCoupon(coupons, code, subtotal, isMagicAdmin)
                      if (result.ok) {
                        setCouponDiscount(result.discountKnut)
                        setCouponCode(result.coupon.code)
                        setCouponError('')
                      } else {
                        setCouponError(result.error)
                      }
                    }}
                  >
                    <option value="">── 選擇可用優惠券 ──</option>
                    {visibleCoupons.map(c => {
                      const label = c.discountPercent > 0
                        ? `折 ${c.discountPercent}%`
                        : `折抵 ${formatPrice(c.discountKnut)}`
                      const minLabel = c.minOrderKnut > 0 ? `・滿 ${formatPrice(c.minOrderKnut)}` : ''
                      const ministryLabel = c.ministryOnly ? '・魔法部專屬' : ''
                      return (
                        <option key={c.code} value={c.code}>
                          {c.code}　{label}{minLabel}{ministryLabel}
                        </option>
                      )
                    })}
                  </select>
                )
              })()}

              <div className={styles.couponRow}>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder="例：MischiefManaged"
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value); setCouponError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button className={styles.couponApplyBtn} onClick={handleApplyCoupon}>
                  套用
                </button>
              </div>
              {couponError && <p className={styles.couponError}>{couponError}</p>}
              {couponDiscount > 0 && (
                <p className={styles.couponSuccess}>
                  ✅ 已套用「{couponCode}」，折抵 {formatPrice(couponDiscount)}
                </p>
              )}
            </div>
            <button className={styles.primaryBtn} onClick={() => setStep('order_review')}>
              {couponDiscount > 0 ? '確認折扣，前往結帳 →' : '略過，直接結帳 →'}
            </button>
            <button className={styles.secondaryBtn} onClick={() => setStep('payment')}>
              ← 返回修改
            </button>
          </div>
        )}

        {/* ━━ Step 5：訂單確認（靜默榮恩偵測，spec §6.2）━━ */}
        {step === 'order_review' && (
          <div className={styles.confirmOrderStep}>
            <h2 className={styles.stepTitle}>📋 確認訂單</h2>

            <div className={styles.receipt}>
              {items.map(item => (
                <div key={item.skuId} className={styles.receiptRow}>
                  <span>
                    {item.productName}
                    {item.skuSpec && item.skuSpec !== '標準版' && (
                      <span className={styles.receiptSpec}>（{item.skuSpec}）</span>
                    )}
                    {' '}× {item.quantity}
                  </span>
                  <span>{formatPrice(item.basePrice * item.quantity)}</span>
                </div>
              ))}

              <div className={styles.receiptRow}>
                <span>{deliveryOpt?.emoji} {deliveryOpt?.name}</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>

              {couponDiscount > 0 && (
                <div className={`${styles.receiptRow} ${styles.receiptDiscount}`}>
                  <span>優惠券「{couponCode}」</span>
                  <span>- {formatPrice(couponDiscount)}</span>
                </div>
              )}

              {/* 全站折扣（管理員設定，自動套用）*/}
              {siteDiscountKnut > 0 && (
                <div className={`${styles.receiptRow} ${styles.receiptDiscount}`}>
                  <span>🏷️ {siteDiscountLabel || '全站折扣'} -{Math.round((1 - siteDiscountRate) * 100)}%</span>
                  <span>- {formatPrice(siteDiscountKnut)}</span>
                </div>
              )}

              {/* 魔法部員工自動折扣（email 含 magic_admin 時觸發）*/}
              {isMagicAdmin && (
                <div className={`${styles.receiptRow} ${styles.receiptMinistry}`}>
                  <span>⚖️ 魔法部員工特惠 -15%</span>
                  <span>- {formatPrice(ministryDiscountKnut)}</span>
                </div>
              )}

              {/* 榮恩稅（靜默偵測，spec §6.2） */}
              {previewIsRon && (
                <div className={`${styles.receiptRow} ${styles.receiptRowHighlight}`}>
                  <span>衛斯理家族特供方案 +100%</span>
                  <span>+ {formatPrice(subtotal)}</span>
                </div>
              )}

              <div className={styles.receiptTotal}>
                <span>總計</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {/* 中文註解：訂單確認頁免責聲明（符合透明告知要求，含身份識別說明）*/}
            <p className={styles.disclaimer}>
              ⚡ 此為最終金額確認頁。本店依購買者身份自動套用定價調整，
              明細已於上方完整揭露。確認下單即表示您已閱讀並同意
              <strong>「魔法波動免責聲明」</strong>。
            </p>

            <button
              className={styles.primaryBtn}
              onClick={() => void handlePlaceOrder()}
              disabled={submitting}
            >
              {submitting ? '⏳ 魔法傳送中...' : '確定交出金加隆 💰'}
            </button>
            <button className={styles.secondaryBtn} onClick={() => setStep('coupon')}>
              ← 返回修改
            </button>
          </div>
        )}

        {/* ━━ Step 6：成功（貓頭鷹確認信，含訂單明細）━━ */}
        {step === 'success' && (
          <div className={styles.successStep}>
            <div className={styles.successIcon}>🦉</div>
            <h2 className={styles.successTitle}>貓頭鷹已送出確認信！</h2>
            <p className={styles.successSubtitle}>
              感謝你在衛氏巫師法寶店購物，以下為你的訂單摘要：
            </p>

            {/* ── 訂單明細收據 ── */}
            <div className={styles.successReceipt}>
              <p className={styles.successReceiptTitle}>📋 訂單明細</p>

              {/* 商品列表 */}
              {items.map(item => (
                <div key={item.skuId} className={styles.successReceiptRow}>
                  <span>
                    {item.productName}
                    {item.skuSpec && item.skuSpec !== '標準版' && (
                      <span className={styles.successReceiptSpec}>（{item.skuSpec}）</span>
                    )}
                    {' '}× {item.quantity}
                  </span>
                  <span>{formatPrice(item.basePrice * item.quantity)}</span>
                </div>
              ))}

              {/* 配送費 */}
              <div className={styles.successReceiptRow}>
                <span>{deliveryOpt?.emoji} {deliveryOpt?.name}</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>

              {/* 優惠券折扣 */}
              {couponDiscount > 0 && (
                <div className={`${styles.successReceiptRow} ${styles.successReceiptDiscount}`}>
                  <span>🎟 優惠券「{couponCode}」</span>
                  <span>- {formatPrice(couponDiscount)}</span>
                </div>
              )}

              {/* 全站折扣 */}
              {siteDiscountKnut > 0 && (
                <div className={`${styles.successReceiptRow} ${styles.successReceiptDiscount}`}>
                  <span>🏷️ {siteDiscountLabel || '全站折扣'} -{Math.round((1 - siteDiscountRate) * 100)}%</span>
                  <span>- {formatPrice(siteDiscountKnut)}</span>
                </div>
              )}

              {/* 魔法部折扣 */}
              {isMagicAdmin && (
                <div className={`${styles.successReceiptRow} ${styles.successReceiptDiscount}`}>
                  <span>⚖️ 魔法部員工特惠 -15%</span>
                  <span>- {formatPrice(ministryDiscountKnut)}</span>
                </div>
              )}

              {/* 榮恩稅（靜默顯示）*/}
              {previewIsRon && (
                <div className={`${styles.successReceiptRow} ${styles.successReceiptRon}`}>
                  <span>衛斯理家族特供方案 +100%</span>
                  <span>+ {formatPrice(subtotal)}</span>
                </div>
              )}

              {/* 總計 */}
              <div className={styles.successReceiptTotal}>
                <span>應付總金額</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>

              {/* 配送 & 支付資訊 */}
              <div className={styles.successReceiptInfo}>
                <div className={styles.successReceiptInfoRow}>
                  <span>收件地址</span>
                  <span>{postalCode} {address}</span>
                </div>
                <div className={styles.successReceiptInfoRow}>
                  <span>配送方式</span>
                  <span>{deliveryOpt?.emoji} {deliveryOpt?.name}（預計 {deliveryOpt?.time}）</span>
                </div>
                <div className={styles.successReceiptInfoRow}>
                  <span>付款方式</span>
                  <span>
                    {payment === 'vault_transfer'   && '🏦 巫師金庫轉帳'}
                    {payment === 'cash_on_delivery' && '📦 貨到交金加隆'}
                    {payment === 'mock_card'        && '💳 魔法卡'}
                  </span>
                </div>
              </div>
            </div>

            {/* 付款提示 */}
            <p className={styles.successHint}>
              {payment === 'vault_transfer' && '📬 請在 72 小時內完成金庫轉帳，管理員確認後訂單開始出貨。'}
              {payment === 'cash_on_delivery' && '📦 貓頭鷹將於預定時間送達，送達時請準備金加隆。'}
              {payment === 'mock_card' && '💳 魔法卡支付成功，訂單已進入待出貨狀態。'}
            </p>
            <p className={styles.successDisclaimer}><em>若發現副作用，請勿聯絡我們。</em></p>
          </div>
        )}

      </div>
    </div>
  )
}

export default CheckoutModal
