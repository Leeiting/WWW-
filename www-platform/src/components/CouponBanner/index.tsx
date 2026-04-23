import { useState } from 'react'
import { useCouponStore } from '@/store/couponStore'
import { useAuthStore } from '@/store/authStore'
import { usePrankStore } from '@/store/prankStore'
import { formatPrice } from '@/store/cartStore'
import styles from './CouponBanner.module.css'

// 中文註解：吼叫信橫幅高度（與 HowlerAlert 保持一致，避免重疊）
const HOWLER_BANNER_HEIGHT = 48

const CouponBanner = () => {
  const coupons = useCouponStore(s => s.coupons)
  const user = useAuthStore(s => s.user)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const isMagicAdmin = user?.email.toLowerCase().includes('magic_admin') ?? false

  // 只顯示啟用中、且符合身份的優惠券
  const visible = coupons.filter(c => c.active && (!c.ministryOnly || isMagicAdmin))
  if (visible.length === 0) return null

  // 格式化折扣文字
  const discountLabel = (knut: number, percent: number) =>
    percent > 0 ? `折 ${percent}%` : `折抵 ${formatPrice(knut)}`

  // 中文註解：吼叫信啟動時往下移，避免與 HowlerAlert 重疊
  const topOffset = howlerModeEnabled ? HOWLER_BANNER_HEIGHT : 0

  return (
    <div className={styles.banner} style={{ top: topOffset }}>
      <span className={styles.tag}>🎟 優惠券</span>

      {/* 捲動區（多張券時橫向滾動）*/}
      <div className={styles.track}>
        {visible.map(c => (
          <div key={c.code} className={`${styles.chip} ${c.ministryOnly ? styles.chipMinistry : ''}`}>
            <code className={styles.code}>{c.code}</code>
            <span className={styles.discount}>{discountLabel(c.discountKnut, c.discountPercent)}</span>
            {c.minOrderKnut > 0 && (
              <span className={styles.min}>滿 {formatPrice(c.minOrderKnut)}</span>
            )}
          </div>
        ))}
      </div>

      <button className={styles.close} onClick={() => setDismissed(true)} aria-label="關閉優惠券橫幅">✕</button>
    </div>
  )
}

export default CouponBanner
