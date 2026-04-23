import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auditLog } from './auditLogStore'

// 折價券定義（spec §7.3 擴充版）
export interface Coupon {
  code: string             // 代碼（唯一鍵，大寫）
  label: string            // 顯示名稱
  descriptionZh: string    // 說明（前台與後台顯示）
  discountKnut: number     // 固定折扣金額（Knut）；discountPercent > 0 時忽略
  discountPercent: number  // 百分比折扣（0~100，針對商品小計）；0 = 使用固定金額
  ministryOnly: boolean    // 僅限魔法部員工（email 含 magic_admin）
  minOrderKnut: number     // 最低訂單金額（0 = 無限制）
  active: boolean          // 是否啟用
}

// 50 金加隆門檻（Knut）= 50 × 17 × 29
const MIN_ORDER_KNUT = 50 * 17 * 29   // 24,650 Knut

// ── 系統預設折價券（不可刪除）──
const DEFAULT_COUPONS: Coupon[] = [
  {
    code: 'MISCHIEFMANAGED',
    label: '惡作劇大功告成',
    descriptionZh: '神祕咒語，折抵 5 枚金加隆',
    discountKnut: 5 * 17 * 29,   // 2465 Knut = 5 Galleon
    discountPercent: 0,
    ministryOnly: false,
    minOrderKnut: MIN_ORDER_KNUT,
    active: true,
  },
  {
    code: 'MISCHIEF50',
    label: '半閃折扣',
    descriptionZh: '小試牛刀，折抵半枚銀閃',
    discountKnut: Math.round(0.5 * 29),  // 14 Knut
    discountPercent: 0,
    ministryOnly: false,
    minOrderKnut: MIN_ORDER_KNUT,
    active: true,
  },
  {
    code: 'MINISTRY24',
    label: '魔法部員工優惠 2024',
    descriptionZh: '魔法部專屬，商品小計折 20%（僅限部內員工）',
    discountKnut: 0,
    discountPercent: 20,
    ministryOnly: true,
    minOrderKnut: MIN_ORDER_KNUT,
    active: true,
  },
  {
    code: 'LOYAL777',
    label: '常客七七七俱樂部',
    descriptionZh: '老顧客專屬，折抵 3 枚金加隆（完成 3 筆訂單後解鎖）',
    discountKnut: 3 * 17 * 29,   // 1479 Knut = 3 Galleon
    discountPercent: 0,
    ministryOnly: false,
    minOrderKnut: MIN_ORDER_KNUT,
    active: true,
  },
  {
    code: 'NEWWITCH',
    label: '新巫師歡迎禮',
    descriptionZh: '新客首購優惠，折抵 1 枚金加隆',
    discountKnut: 1 * 17 * 29,   // 493 Knut = 1 Galleon
    discountPercent: 0,
    ministryOnly: false,
    minOrderKnut: MIN_ORDER_KNUT,
    active: true,
  },
]

// 預設券的代碼集合（保護不被刪除）
const DEFAULT_CODES = new Set(DEFAULT_COUPONS.map(c => c.code))

interface CouponStore {
  coupons: Coupon[]
  // 新增折價券（代碼不可重複）
  addCoupon: (coupon: Omit<Coupon, 'code'> & { code: string }) => { ok: boolean; error?: string }
  // 切換啟用 / 停用
  toggleActive: (code: string) => void
  // 刪除（僅限自訂券，預設券受保護）
  deleteCoupon: (code: string) => void
  // 中文註解：訂單完成時系統自動呼叫，發放 1 納特驚喜券，回傳券代碼
  issueSurpriseCoupon: (orderId: string) => string
}

export const useCouponStore = create<CouponStore>()(
  persist(
    (set, get) => ({
      coupons: DEFAULT_COUPONS,

      // 新增折價券
      addCoupon: (coupon) => {
        const code = coupon.code.trim().toUpperCase()
        if (!code) return { ok: false, error: '代碼不可為空' }
        if (get().coupons.some(c => c.code === code)) return { ok: false, error: '代碼已存在' }
        set(s => ({ coupons: [...s.coupons, { ...coupon, code }] }))
        auditLog({ category: 'coupon', action: '新增折價券', target: code, detail: coupon.label })
        return { ok: true }
      },

      // 切換啟用狀態
      toggleActive: (code) => {
        const current = get().coupons.find(c => c.code === code)
        const newActive = !current?.active
        set(s => ({
          coupons: s.coupons.map(c => c.code === code ? { ...c, active: !c.active } : c),
        }))
        auditLog({ category: 'coupon', action: newActive ? '啟用折價券' : '停用折價券', target: code })
      },

      // 刪除（預設券不可刪）
      deleteCoupon: (code) => {
        if (DEFAULT_CODES.has(code)) return
        const label = get().coupons.find(c => c.code === code)?.label
        set(s => ({ coupons: s.coupons.filter(c => c.code !== code) }))
        auditLog({ category: 'coupon', action: '刪除折價券', target: code, detail: label })
      },

      // 中文註解：訂單完成自動發放驚喜納特券（1 Knut，無最低消費限制）
      issueSurpriseCoupon: (orderId) => {
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
        const code = `LUCKY-${suffix}`
        const coupon: Coupon = {
          code,
          label: '驚喜納特券',
          descriptionZh: `感謝支持！訂單 ${orderId.slice(-8)} 完成自動發放，下次購物折抵 1 納特`,
          discountKnut: 1,
          discountPercent: 0,
          ministryOnly: false,
          minOrderKnut: 0,
          active: true,
        }
        set(s => ({ coupons: [...s.coupons, coupon] }))
        auditLog({ category: 'coupon', action: '系統發放驚喜納特券', target: code, detail: `訂單 ${orderId.slice(-8)} 完成觸發` })
        return code
      },
    }),
    {
      name: 'www-coupons',
      // version 2：預設券全面加入 50 金加隆消費門檻；版本升級時重設預設券（保留自訂券）
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as { coupons?: Coupon[] }
        if (version < 2) {
          // 以新的預設券取代舊預設券，同時保留使用者自行新增的自訂券
          const customCoupons = (state.coupons ?? []).filter(c => !DEFAULT_CODES.has(c.code))
          return { coupons: [...DEFAULT_COUPONS, ...customCoupons] }
        }
        return state as CouponStore
      },
    }
  )
)

// 將 Knut 轉為金加隆顯示（供錯誤訊息使用）
const knutToGalleonLabel = (knut: number): string => {
  const g = Math.floor(knut / (17 * 29))
  const rest = knut % (17 * 29)
  const s = Math.floor(rest / 29)
  if (g > 0 && s === 0) return `${g} 金加隆`
  if (g > 0) return `${g} 金加隆 ${s} 銀閃`
  return `${knut} Knut`
}

// 驗證折價券並計算折扣金額（供 CheckoutModal 呼叫）
export const validateCoupon = (
  coupons: Coupon[],
  inputCode: string,
  subtotalKnut: number,
  isMagicAdmin: boolean,
): { ok: true; coupon: Coupon; discountKnut: number } | { ok: false; error: string } => {
  const code = inputCode.trim().toUpperCase()
  const coupon = coupons.find(c => c.code === code)
  if (!coupon) return { ok: false, error: '此優惠券已過期或不存在' }
  if (!coupon.active) return { ok: false, error: '此優惠券已停用' }
  if (coupon.ministryOnly && !isMagicAdmin) {
    return { ok: false, error: '⚖️ 此優惠券僅限魔法部員工使用（請以 magic_admin 信箱下單）' }
  }
  if (coupon.minOrderKnut > 0 && subtotalKnut < coupon.minOrderKnut) {
    return { ok: false, error: `此優惠券需消費滿 ${knutToGalleonLabel(coupon.minOrderKnut)} 才可使用` }
  }
  const discountKnut = coupon.discountPercent > 0
    ? Math.round(subtotalKnut * coupon.discountPercent / 100)
    : coupon.discountKnut
  return { ok: true, coupon, discountKnut }
}
