import { useState } from 'react'
import { useCouponStore } from '@/store/couponStore'
import type { Coupon } from '@/store/couponStore'
import { formatPrice } from '@/store/cartStore'
import styles from './Coupons.module.css'

// 預設券代碼（不可刪除）
const PROTECTED = new Set(['MISCHIEFMANAGED', 'MISCHIEF50', 'MINISTRY24', 'LOYAL777', 'NEWWITCH'])

// 空白新券表單預設值
const EMPTY_FORM: Omit<Coupon, 'active'> = {
  code: '',
  label: '',
  descriptionZh: '',
  discountKnut: 493,       // 預設 1 金加隆
  discountPercent: 0,
  ministryOnly: false,
  minOrderKnut: 0,
}

const AdminCoupons = () => {
  const coupons = useCouponStore(s => s.coupons)
  const addCoupon = useCouponStore(s => s.addCoupon)
  const toggleActive = useCouponStore(s => s.toggleActive)
  const deleteCoupon = useCouponStore(s => s.deleteCoupon)

  // 新增表單狀態
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [discountType, setDiscountType] = useState<'knut' | 'percent'>('knut')
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  // 更新表單欄位
  const setField = <K extends keyof typeof EMPTY_FORM>(key: K, val: (typeof EMPTY_FORM)[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
    setFormError('')
    setFormSuccess('')
  }

  // 提交新折價券
  const handleAdd = () => {
    const coupon: Coupon = {
      ...form,
      code: form.code.trim().toUpperCase(),
      active: true,
      discountKnut: discountType === 'knut' ? form.discountKnut : 0,
      discountPercent: discountType === 'percent' ? form.discountPercent : 0,
    }
    const result = addCoupon(coupon)
    if (result.ok) {
      setFormSuccess(`✅ 折價券「${coupon.code}」已新增`)
      setForm(EMPTY_FORM)
      setDiscountType('knut')
      setShowForm(false)
    } else {
      setFormError(result.error ?? '新增失敗')
    }
  }

  // 格式化折扣顯示
  const formatDiscount = (c: Coupon) =>
    c.discountPercent > 0
      ? `商品小計折 ${c.discountPercent}%`
      : `折抵 ${formatPrice(c.discountKnut)}`

  return (
    <div className={styles.page}>
      {/* 標題列 */}
      <div className={styles.topbar}>
        <div>
          <h2 className={styles.title}>🎟 折價券管理</h2>
          <p className={styles.sub}>共 {coupons.length} 張券，啟用 {coupons.filter(c => c.active).length} 張</p>
        </div>
        <button className={styles.addBtn} onClick={() => { setShowForm(!showForm); setFormError(''); setFormSuccess('') }}>
          {showForm ? '✕ 收起' : '＋ 新增折價券'}
        </button>
      </div>

      {/* 成功提示 */}
      {formSuccess && <p className={styles.success}>{formSuccess}</p>}

      {/* ── 新增表單 ── */}
      {showForm && (
        <div className={styles.form}>
          <h3 className={styles.formTitle}>新增折價券</h3>
          <div className={styles.formGrid}>
            {/* 代碼 */}
            <div className={styles.field}>
              <label className={styles.label}>代碼 *（自動轉大寫）</label>
              <input
                className={styles.input}
                placeholder="例：SUMMER24"
                value={form.code}
                onChange={e => setField('code', e.target.value)}
              />
            </div>
            {/* 名稱 */}
            <div className={styles.field}>
              <label className={styles.label}>顯示名稱 *</label>
              <input
                className={styles.input}
                placeholder="例：暑期夏日優惠"
                value={form.label}
                onChange={e => setField('label', e.target.value)}
              />
            </div>
            {/* 說明（跨整行）*/}
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>說明</label>
              <input
                className={styles.input}
                placeholder="例：限時夏日回饋，折抵 2 枚金加隆"
                value={form.descriptionZh}
                onChange={e => setField('descriptionZh', e.target.value)}
              />
            </div>
            {/* 折扣類型 */}
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>折扣類型</label>
              <div className={styles.typeRow}>
                <button
                  className={`${styles.typeBtn} ${discountType === 'knut' ? styles.typeBtnActive : ''}`}
                  onClick={() => setDiscountType('knut')}
                >固定金額（Knut）</button>
                <button
                  className={`${styles.typeBtn} ${discountType === 'percent' ? styles.typeBtnActive : ''}`}
                  onClick={() => setDiscountType('percent')}
                >百分比（%）</button>
              </div>
            </div>
            {/* 折扣數值 */}
            {discountType === 'knut' ? (
              <div className={styles.field}>
                <label className={styles.label}>折扣金額（Knut）</label>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={form.discountKnut}
                  onChange={e => setField('discountKnut', Number(e.target.value))}
                />
                <span className={styles.inputHint}>1 金加隆 = 493 Knut</span>
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.label}>折扣百分比（%）</label>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={100}
                  value={form.discountPercent}
                  onChange={e => setField('discountPercent', Number(e.target.value))}
                />
                <span className={styles.inputHint}>針對商品小計計算</span>
              </div>
            )}
            {/* 最低訂單金額 */}
            <div className={styles.field}>
              <label className={styles.label}>最低訂單金額（Knut，0 = 無限制）</label>
              <input
                className={styles.input}
                type="number"
                min={0}
                value={form.minOrderKnut}
                onChange={e => setField('minOrderKnut', Number(e.target.value))}
              />
            </div>
            {/* 魔法部限定 */}
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={form.ministryOnly}
                  onChange={e => setField('ministryOnly', e.target.checked)}
                />
                <span>⚖️ 僅限魔法部員工（email 含 magic_admin）</span>
              </label>
            </div>
          </div>
          {formError && <p className={styles.formError}>{formError}</p>}
          <div className={styles.formActions}>
            <button
              className={styles.submitBtn}
              onClick={handleAdd}
              disabled={!form.code.trim() || !form.label.trim()}
            >
              建立折價券
            </button>
            <button className={styles.cancelBtn} onClick={() => { setShowForm(false); setFormError('') }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── 折價券列表 ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>代碼</th>
              <th>名稱 / 說明</th>
              <th>折扣</th>
              <th>限制</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.code} className={!c.active ? styles.rowInactive : ''}>
                {/* 代碼 */}
                <td>
                  <code className={styles.codeCell}>{c.code}</code>
                  {PROTECTED.has(c.code) && <span className={styles.protectedTag}>系統預設</span>}
                  {c.ministryOnly && <span className={styles.ministryTag}>⚖️ 魔法部限定</span>}
                </td>
                {/* 名稱 */}
                <td>
                  <p className={styles.couponLabel}>{c.label}</p>
                  <p className={styles.couponDesc}>{c.descriptionZh}</p>
                </td>
                {/* 折扣 */}
                <td className={styles.discountCell}>{formatDiscount(c)}</td>
                {/* 限制 */}
                <td className={styles.limitCell}>
                  {c.minOrderKnut > 0 ? `滿 ${formatPrice(c.minOrderKnut)}` : '無最低限制'}
                </td>
                {/* 狀態 */}
                <td>
                  <span className={`${styles.statusBadge} ${c.active ? styles.statusOn : styles.statusOff}`}>
                    {c.active ? '啟用' : '停用'}
                  </span>
                </td>
                {/* 操作 */}
                <td>
                  <div className={styles.actions}>
                    <button className={styles.toggleBtn} onClick={() => toggleActive(c.code)}>
                      {c.active ? '停用' : '啟用'}
                    </button>
                    {!PROTECTED.has(c.code) && (
                      <button className={styles.deleteBtn} onClick={() => deleteCoupon(c.code)}>
                        刪除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminCoupons
