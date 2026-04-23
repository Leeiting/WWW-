import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePrankStore } from '@/store/prankStore'
import Storefront from '@/pages/Storefront'
import SearchPage from '@/pages/Search'
import StationeryShop from '@/pages/StationeryShop'
import ProductDetail from '@/pages/ProductDetail'
import AuthPage from '@/pages/Auth'
import MyOrdersPage from '@/pages/MyOrders'
import ProfilePage from '@/pages/Profile'
// 全域惡搞特效元件（前台可見）
import HowlerAlert from '@/components/HowlerAlert'
import PeevesLayer from '@/components/PeevesLayer'
import { useProductStore } from '@/store/productStore'
import { useOrderStore } from '@/store/orderStore'
import { useAuthStore } from '@/store/authStore'
import { useSiteDiscountStore } from '@/store/siteDiscountStore'
import { useIpGuardStore } from '@/store/ipGuardStore'

// 中文註解：Session 定期檢查間隔（5 分鐘）
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000

function App() {
  const misManagedActive = usePrankStore(s => s.misManagedActive)
  const activateMischiefManaged = usePrankStore(s => s.activateMischiefManaged)
  const syncProducts = useProductStore(s => s.syncFromApi)
  const syncOrders = useOrderStore(s => s.syncFromApi)
  const authMe = useAuthStore(s => s.me)
  const user = useAuthStore(s => s.user)  // 中文註解：取得當前登入用戶（用於管理員 bypass 判斷）
  const syncSiteDiscount = useSiteDiscountStore(s => s.syncFromApi)  // 中文註解：啟動時同步全站折扣設定
  const sessionExpired = useAuthStore(s => s.sessionExpired)
  const clearSessionExpired = useAuthStore(s => s.clearSessionExpired)
  const checkMischief = useIpGuardStore(s => s.checkMischief)

  // 中文註解：管理員 bypass 旗標（spec §11.3 第 0 關）
  // admin 永遠不受 Mischief Managed 重導影響，確保管理員能進入後台解除掩護
  const isAdmin = user?.user_level === 'admin'

  // 跨分頁同步：監聽其他分頁（後台）對 localStorage 的改動，立即重新抓取狀態
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'www-prank-store') {
        usePrankStore.persist.rehydrate()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // 啟動時同步資料庫資料（中文註解：後端不可用時會自動保留 localStorage）
  useEffect(() => {
    void syncProducts()
    void syncOrders()
    void authMe()
    void syncSiteDiscount()
  }, [syncProducts, syncOrders, authMe, syncSiteDiscount])

  // 中文註解：前台啟動時偵測訪客 IP；若命中黑名單則自動觸發 Mischief Managed（spec §11.2）
  useEffect(() => {
    checkMischief().then(result => {
      if (result.triggered) {
        activateMischiefManaged()
      }
    }).catch(() => { /* 靜默失敗，不影響正常使用 */ })
  }, [checkMischief, activateMischiefManaged])

  // 中文註解：每 5 分鐘靜默 check session，token 過期後 me() 會設定 sessionExpired = true
  useEffect(() => {
    const id = window.setInterval(() => {
      void authMe()
    }, SESSION_CHECK_INTERVAL)
    return () => window.clearInterval(id)
  }, [authMe])

  // 中文註解：監聽 API 回 401（受保護路由）→ 同樣觸發 me() 確認 session 狀態
  useEffect(() => {
    const handle = () => void authMe()
    window.addEventListener('api:unauthorized', handle)
    return () => window.removeEventListener('api:unauthorized', handle)
  }, [authMe])

  // 中文註解：sessionExpired 旗標一旦設定，清除後導向登入頁（附帶 expired=1 參數顯示提示）
  useEffect(() => {
    if (sessionExpired) {
      clearSessionExpired()
      window.location.href = '/auth?expired=1'
    }
  }, [sessionExpired, clearSessionExpired])

  return (
    <BrowserRouter>
      {/* 吼叫信橫幅與飛七浮層：全域掛載，由 prankStore 控制顯示 */}
      <HowlerAlert />
      <PeevesLayer />
      <Routes>
        {/* 前台：Mischief Managed 啟動時導向文具店
            中文註解：管理員（第 0 關 bypass）永遠看到真正的前台，不受掩護模式影響（spec §11.3）*/}
        <Route
          path="/"
          element={misManagedActive && !isAdmin ? <Navigate to="/stationery" replace /> : <Storefront />}
        />

        {/* 中文註解：後台已移至獨立網址（port 5178），前台不再包含 /admin 路由 */}
        <Route path="/admin/*" element={<Navigate to="/" replace />} />

        {/* Mischief Managed 文具店掩護頁面 */}
        <Route path="/stationery" element={<StationeryShop />} />

        {/* 登入 / 註冊 */}
        <Route path="/auth" element={<AuthPage />} />

        {/* 前台訂單追蹤 */}
        <Route path="/my-orders" element={<MyOrdersPage />} />

        {/* 個人設定 */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* 商品詳情頁（中文註解：Mischief Managed 啟動且非管理員時導向文具店，spec §11.3）*/}
        <Route
          path="/product/:id"
          element={misManagedActive && !isAdmin ? <Navigate to="/stationery" replace /> : <ProductDetail />}
        />

        {/* 商品搜尋 */}
        <Route
          path="/search"
          element={misManagedActive && !isAdmin ? <Navigate to="/stationery" replace /> : <SearchPage />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
