import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import styles from './Auth.module.css'

const AuthPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // 中文註解：URL 帶有 ?expired=1 表示 session 逾時被踢回登入頁
  const isExpired = searchParams.get('expired') === '1'
  const { user, loading, error, login, register } = useAuthStore()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [oauthError, setOauthError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      await login(email.trim(), password)
    } else {
      await register(email.trim(), password, displayName.trim() || undefined)
    }
    navigate('/')
  }

  const handleOAuthLogin = (provider: 'google' | 'facebook') => {
    setOauthError('')
    const popup = window.open(`/api/auth/${provider}`, '_blank', 'width=500,height=650')

    const timer = window.setTimeout(() => {
      // 中文註解：若 5 秒內沒有回應，提示用戶改用本地登入（規格書 §16.1）
      if (!popup || popup.closed) {
        setOauthError('魔法部目前阻斷了麻瓜驗證，請使用巫師信箱登入')
        setMode('login')
      }
    }, 5000)

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'oauth_success') {
        window.clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        // 中文註解：cookie 已由後端寫入，再呼叫 /me 更新前端狀態
        void useAuthStore.getState().me().then(() => navigate('/'))
      }
      if (e.data?.type === 'oauth_error') {
        window.clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        setOauthError('OAuth 登入失敗，請改用巫師信箱登入')
        setMode('login')
      }
    }
    window.addEventListener('message', onMessage)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>🦉 魔法帳號</h1>
          <p className={styles.subtitle}>
            {mode === 'login' ? '登入後即可下單與追蹤訂單' : '註冊一個巫師信箱帳號開始購物'}
          </p>
        </div>

        {/* 登入逾時提示（由 App.tsx 偵測 session 過期後導向，帶 ?expired=1） */}
        {isExpired && (
          <div className={styles.expiredBanner}>
            ⏰ 您的登入時間已過期，請重新登入繼續購物。
          </div>
        )}

        {user && (
          <div className={styles.meBox}>
            <p>已登入：<strong>{user.email}</strong></p>
            <p className={styles.dim}>等級：{user.user_level}</p>
            <Link className={styles.linkBtn} to="/my-orders">📋 查看我的訂單 →</Link>
            <Link className={styles.linkBtn} to="/">回到商店 →</Link>
          </div>
        )}

        {!user && (
          <>
            <div className={styles.oauthRow}>
              <button className={styles.oauthBtn} type="button" onClick={() => handleOAuthLogin('google')}>
                使用 Google 登入
              </button>
              <button className={`${styles.oauthBtn} ${styles.oauthFb}`} type="button" onClick={() => handleOAuthLogin('facebook')}>
                使用 Facebook 登入
              </button>
            </div>
            {oauthError && <p className={styles.error}>⚠️ {oauthError}</p>}

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${mode === 'login' ? styles.active : ''}`}
                onClick={() => setMode('login')}
                type="button"
              >
                登入
              </button>
              <button
                className={`${styles.tab} ${mode === 'register' ? styles.active : ''}`}
                onClick={() => setMode('register')}
                type="button"
              >
                註冊
              </button>
            </div>

            <form className={styles.form} onSubmit={submit}>
              {mode === 'register' && (
                <div className={styles.field}>
                  <label className={styles.label}>顯示名稱（選填）</label>
                  <input
                    className={styles.input}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="例：哈利"
                    autoComplete="nickname"
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>巫師信箱 *</label>
                <input
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="例：harry@hogwarts.edu"
                  type="email"
                  autoComplete="email"
                  required
                />
                <p className={styles.hint}>Email 含「ron」會自動觸發榮恩彩蛋（結帳金額 ×2）。</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>密碼 *</label>
                <input
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="至少 6 碼"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </div>

              {error && <p className={styles.error}>⚠️ {error}</p>}

              <button className={styles.primary} disabled={loading}>
                {loading ? '魔法驗證中...' : mode === 'login' ? '登入' : '註冊'}
              </button>

              <Link className={styles.backLink} to="/">← 回到商店</Link>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthPage

