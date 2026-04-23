import { NavLink, Outlet } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { usePrankStore } from '@/store/prankStore'
import { useOrderStore } from '@/store/orderStore'
import styles from './AdminLayout.module.css'

// 吼叫信橫幅高度（與 HowlerAlert banner padding 14px×2 + 字型約 20px = ~48px）
const HOWLER_BANNER_HEIGHT = 48

// 中文註解：前台網址（後台與前台分開跑在不同 port；透過 AdminApp 的 STOREFRONT_URL 或直接讀 env）
const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? 'http://localhost:5177'

const AdminLayout = () => {
  const misManagedActive = usePrankStore(s => s.misManagedActive)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const activateMischiefManaged = usePrankStore(s => s.activateMischiefManaged)
  const deactivateMischiefManaged = usePrankStore(s => s.deactivateMischiefManaged)
  // 計算待審核退款數量（側欄徽章用）
  const refundingCount = useOrderStore(s => s.orders.filter(o => o.status === 'refunding').length)

  return (
    <div
      className={styles.layout}
      style={howlerModeEnabled ? { paddingTop: HOWLER_BANNER_HEIGHT } : undefined}
    >
      {/* 中文註解：後台頁面阻止搜尋引擎收錄（spec §12.5 各頁面 OG 規則）*/}
      <Helmet>
        <title>後台管理 — 衛氏巫師法寶店</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* 左側導覽 */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <p className={styles.sidebarTitle}>🔮 WWW<br />後台控制中心</p>
          <p className={styles.sidebarSub}>Weasleys' Wizard Wheezes</p>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navSection}>管理</p>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>📊</span> 總覽
          </NavLink>
          <NavLink
            to="/admin/products"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>📦</span> 商品管理
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>📋</span> 訂單管理
          </NavLink>
          <NavLink
            to="/admin/inventory"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🗃️</span> 庫存管理
          </NavLink>
          <NavLink
            to="/admin/reports"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>📈</span> 銷售報表
          </NavLink>
          <NavLink
            to="/admin/coupons"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🎟</span> 折價券管理
          </NavLink>
          <NavLink
            to="/admin/refunds"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🔄</span> 退款審核
            {refundingCount > 0 && (
              <span className={styles.navBadge}>{refundingCount}</span>
            )}
          </NavLink>
          <NavLink
            to="/admin/prank"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🎭</span> Prank Console
          </NavLink>
          <NavLink
            to="/admin/audit-log"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>📋</span> 操作日誌
          </NavLink>
          <NavLink
            to="/admin/ip-guard"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🕵️</span> IP 守衛
          </NavLink>
        </nav>

        {/* Mischief Managed 緊急按鈕 */}
        <button
          className={`${styles.misManagedBtn} ${misManagedActive ? styles.misManagedActive : ''}`}
          onClick={misManagedActive ? deactivateMischiefManaged : activateMischiefManaged}
        >
          {misManagedActive ? '✅ 解除掩護模式' : '🔴 Mischief Managed'}
        </button>

        <div className={styles.sidebarFooter}>
          {misManagedActive
            ? '⚠️ 文具店模式進行中'
            : 'I solemnly swear that I am up to no good.'}
        </div>
      </aside>

      {/* 右側主內容 */}
      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1 className={styles.pageTitle}>後台管理系統</h1>
          <div className={styles.topbarActions}>
            <a href={STOREFRONT_URL} className={styles.storefrontLink}>
              ← 前往前台
            </a>
          </div>
        </div>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
