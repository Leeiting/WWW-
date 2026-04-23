import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfileStore } from '@/store/profileStore'
import { useAuthStore } from '@/store/authStore'
import { auditLog } from '@/store/auditLogStore'
import styles from './Profile.module.css'

// 欄位驗證
const isValidPhone = (v: string) => v === '' || /^09\d{8}$/.test(v.replace(/[\s-]/g, ''))
const isValidPostalCode = (v: string) => /^\d{3}(\d{2})?$/.test(v.trim())
const isValidVaultCode = (v: string) => v === '' || /^\d{5}$/.test(v.trim())

// 中文註解：帳號等級顯示設定（對應 AuthUser.user_level）
const LEVEL_INFO: Record<string, { label: string; color: string; desc: string }> = {
  normal:  { label: '一般巫師',       color: 'rgba(244,231,211,0.65)', desc: '標準定價，無額外調整。' },
  ron:     { label: '衛斯理家族成員', color: '#f0ad4e',                desc: '系統已識別您的身份並套用「衛斯理家族特供方案」（+100%）。如認為識別有誤，可申請人工審核。' },
  vip:     { label: 'VIP 貴賓',       color: '#7eb9f5',                desc: '享有 VIP 專屬優惠，詳情請洽客服。' },
  admin:   { label: '管理員',         color: 'var(--gold)',            desc: '後台管理帳號，擁有完整操作權限。' },
}

const ProfilePage = () => {
  const profile = useProfileStore()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  // 本地表單狀態（從 store 初始化）
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [phone, setPhone] = useState(profile.phone)
  const [postalCode, setPostalCode] = useState(profile.postalCode)
  const [address, setAddress] = useState(profile.address)
  const [vaultLastFive, setVaultLastFive] = useState(profile.vaultLastFive)

  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 中文註解：人工審核申請狀態（ron 用戶專用）
  const [reviewRequested, setReviewRequested] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (phone && !isValidPhone(phone)) e.phone = '手機號碼須為 09 開頭共 10 碼（例：0912345678）'
    if (postalCode && !isValidPostalCode(postalCode)) e.postalCode = '郵遞區號須為 3 碼或 5 碼數字'
    if (!isValidVaultCode(vaultLastFive)) e.vaultLastFive = '金庫末五碼須為恰好 5 位數字'
    return e
  }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    profile.update({ displayName, phone, postalCode, address, vaultLastFive })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 中文註解：人工審核申請送出（寫入 audit log，管理員可在後台看到）
  const handleSubmitReview = () => {
    auditLog({
      category: 'config',
      action: '用戶申請人工審核',
      target: user?.email ?? '未知信箱',
      detail: `user_id: ${user?.u_id ?? '-'}，user_level: ${user?.user_level ?? '-'}`,
    })
    setReviewSubmitted(true)
    setReviewRequested(false)
  }

  const levelInfo = LEVEL_INFO[user?.user_level ?? 'normal'] ?? LEVEL_INFO.normal

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 頁首 */}
        <div className={styles.header}>
          <Link to="/" className={styles.backLink}>← 回到商店</Link>
          {/* 頭像列：有第三方頭像時顯示，否則顯示預設字母圖示 */}
          <div className={styles.avatarRow}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="頭像" className={styles.avatar} referrerPolicy="no-referrer" />
              : <div className={styles.avatarFallback}>{(user?.display_name ?? user?.email ?? '?')[0].toUpperCase()}</div>
            }
            <div>
              <h1 className={styles.title}>⚙️ 個人設定</h1>
              {user && <p className={styles.sub}>{user.email}</p>}
            </div>
          </div>
        </div>

        {/* 個人資料 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>👤 個人資料</h2>

          <div className={styles.field}>
            <label className={styles.label}>顯示名稱</label>
            <input
              className={styles.input}
              placeholder="例：哈利"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>聯絡電話</label>
            <input
              className={`${styles.input} ${errors.phone ? styles.inputError : ''} ${phone && isValidPhone(phone) ? styles.inputOk : ''}`}
              placeholder="例：0912345678"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^\d-\s]/g, '').slice(0, 12))}
              maxLength={12}
            />
            {errors.phone && <p className={styles.error}>{errors.phone}</p>}
            <p className={styles.hint}>09 開頭，共 10 碼</p>
          </div>

          {user && (
            <div className={styles.field}>
              <label className={styles.label}>帳號信箱</label>
              <input className={`${styles.input} ${styles.inputReadonly}`} value={user.email} readOnly />
              <p className={styles.hint}>信箱透過帳號管理，無法在此更改</p>
            </div>
          )}

          {/* 帳號時間資訊 */}
          {user && (
            <div className={styles.accountMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>帳號建立時間</span>
                <span className={styles.metaValue}>{new Date(user.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>最後更新時間</span>
                <span className={styles.metaValue}>{new Date(user.updated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
              </div>
            </div>
          )}
        </section>

        {/* 中文註解：帳號識別等級（用戶查詢權，spec §6.2 透明告知）*/}
        {user && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>🔍 帳號識別等級</h2>
            <p className={styles.sectionHint}>系統依此等級決定結帳時的定價策略</p>

            <div className={styles.levelRow}>
              <span className={styles.levelBadge} style={{ color: levelInfo.color, borderColor: levelInfo.color + '55' }}>
                {levelInfo.label}
              </span>
              <code className={styles.levelCode}>{user.user_level}</code>
            </div>
            <p className={styles.levelDesc}>{levelInfo.desc}</p>

            {/* ron 等級：顯示申請人工審核入口 */}
            {user.user_level === 'ron' && (
              <div className={styles.ronAlert}>
                <p className={styles.ronAlertTitle}>⚠️ 關於衛斯理家族特供方案</p>
                <p className={styles.ronAlertText}>
                  本系統依信箱特徵自動識別帳號等級。若您認為識別有誤，
                  可申請人工審核，審核通過後將調整您的帳號等級。
                </p>
                {reviewSubmitted ? (
                  <p className={styles.reviewSuccess}>
                    ✅ 申請已送出，管理員將於 3 個工作天內完成審核並以信箱通知您。
                  </p>
                ) : reviewRequested ? (
                  <div className={styles.reviewConfirm}>
                    <p className={styles.reviewConfirmText}>
                      確定送出人工審核申請？（信箱：{user.email}）
                    </p>
                    <div className={styles.reviewBtns}>
                      <button className={styles.reviewSubmitBtn} onClick={handleSubmitReview}>確定送出</button>
                      <button className={styles.reviewCancelBtn} onClick={() => setReviewRequested(false)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.reviewRequestBtn} onClick={() => setReviewRequested(true)}>
                    📋 申請人工審核
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* 預設收件地址 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>📬 預設收件地址</h2>
          <p className={styles.sectionHint}>結帳時自動帶入，可在結帳頁修改</p>

          <div className={styles.field}>
            <label className={styles.label}>郵遞區號</label>
            <div className={styles.postalRow}>
              <input
                className={`${styles.input} ${styles.postalInput} ${errors.postalCode ? styles.inputError : ''} ${postalCode && isValidPostalCode(postalCode) ? styles.inputOk : ''}`}
                placeholder="例：100 或 10001"
                value={postalCode}
                onChange={e => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                inputMode="numeric"
                maxLength={5}
              />
              {postalCode && isValidPostalCode(postalCode) && (
                <span className={styles.okBadge}>✓ 有效</span>
              )}
            </div>
            {errors.postalCode && <p className={styles.error}>{errors.postalCode}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>收件地址</label>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="例：英國蘇格蘭高地，霍格華茲城堡，葛來分多塔 6F"
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
            />
          </div>
        </section>

        {/* 付款資料 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🏦 付款資料</h2>
          <p className={styles.sectionHint}>選擇金庫轉帳時自動帶入，可在結帳頁修改</p>

          <div className={styles.field}>
            <label className={styles.label}>古靈閣金庫帳號末五碼</label>
            <input
              className={`${styles.input} ${errors.vaultLastFive ? styles.inputError : ''} ${vaultLastFive && isValidVaultCode(vaultLastFive) && vaultLastFive.length === 5 ? styles.inputOk : ''}`}
              placeholder="例：74823"
              value={vaultLastFive}
              onChange={e => setVaultLastFive(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
            />
            {errors.vaultLastFive && <p className={styles.error}>{errors.vaultLastFive}</p>}
            <p className={styles.hint}>僅儲存末五碼，用於金庫轉帳付款識別</p>
          </div>
        </section>

        {/* 操作按鈕 */}
        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave}>
            {saved ? '✅ 已儲存' : '儲存設定'}
          </button>
          {user && (
            <button
              className={styles.logoutBtn}
              onClick={async () => { await logout(); window.location.href = '/' }}
            >
              登出帳號
            </button>
          )}
        </div>

        {/* 訂單快速連結 */}
        <div className={styles.links}>
          <Link to="/my-orders" className={styles.linkBtn}>📋 查看我的訂單</Link>
          {!user && (
            <Link to="/auth" className={styles.linkBtn}>🦉 登入 / 註冊</Link>
          )}
        </div>

        {/* 中文註解：資料留存聲明（符合電商交易記錄法規，7 年保留期）*/}
        <div className={styles.retentionNotice}>
          <p className={styles.retentionTitle}>📄 資料留存聲明</p>
          <p className={styles.retentionText}>
            依電商交易記錄相關法規，本店訂單資料（含帳號識別等級、交易明細）
            將自交易完成日起保留 <strong>7 年</strong>。
            如有資料查詢或更正需求，請透過客服信箱聯繫。
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
