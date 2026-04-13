import { NavLink, Link, Outlet } from 'react-router-dom'
import { usePrankStore } from '@/store/prankStore'
import styles from './AdminLayout.module.css'

// 吼叫信橫幅高度（與 HowlerAlert banner padding 14px×2 + 字型約 20px = ~48px）
const HOWLER_BANNER_HEIGHT = 48

const AdminLayout = () => {
  const misManagedActive = usePrankStore(s => s.misManagedActive)
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const activateMischiefManaged = usePrankStore(s => s.activateMischiefManaged)
  const deactivateMischiefManaged = usePrankStore(s => s.deactivateMischiefManaged)

  return (
    <div
      className={styles.layout}
      style={howlerModeEnabled ? { paddingTop: HOWLER_BANNER_HEIGHT } : undefined}
    >
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
            to="/admin/prank"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.navLinkIcon}>🎭</span> Prank Console
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
            <Link to="/" className={styles.storefrontLink}>
              ← 前往前台
            </Link>
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
