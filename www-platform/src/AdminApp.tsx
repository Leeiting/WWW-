import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useProductStore } from '@/store/productStore'
import { useOrderStore } from '@/store/orderStore'
import { useAuthStore } from '@/store/authStore'
import { useSiteDiscountStore } from '@/store/siteDiscountStore'
import AdminLayout from '@/pages/Admin/AdminLayout'
import AdminDashboard from '@/pages/Admin/Dashboard'
import AdminProducts from '@/pages/Admin/Products'
import AdminOrders from '@/pages/Admin/Orders'
import AdminInventory from '@/pages/Admin/Inventory'
import AdminReports from '@/pages/Admin/Reports'
import AdminCoupons from '@/pages/Admin/Coupons'
import AdminRefunds from '@/pages/Admin/Refunds'
import PrankConsole from '@/pages/Admin/PrankConsole'
import AdminAuditLog from '@/pages/Admin/AuditLog'
import AdminIpGuard from '@/pages/Admin/IpGuard'
import HowlerAlert from '@/components/HowlerAlert'
import PeevesLayer from '@/components/PeevesLayer'

// 中文註解：前台網址（後台「← 前往前台」連結目標，與後台分開部署在不同 port）
export const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5177'

const SESSION_CHECK_INTERVAL = 5 * 60 * 1000

function AdminApp() {
  const syncProducts     = useProductStore(s => s.syncFromApi)
  const syncOrders       = useOrderStore(s => s.syncFromApi)
  const authMe           = useAuthStore(s => s.me)
  const syncSiteDiscount = useSiteDiscountStore(s => s.syncFromApi)
  const sessionExpired   = useAuthStore(s => s.sessionExpired)
  const clearSessionExpired = useAuthStore(s => s.clearSessionExpired)

  // 啟動時從後端同步資料
  useEffect(() => {
    void syncProducts()
    void syncOrders()
    void authMe()
    void syncSiteDiscount()
  }, [syncProducts, syncOrders, authMe, syncSiteDiscount])

  // 定期確認 session
  useEffect(() => {
    const id = window.setInterval(() => void authMe(), SESSION_CHECK_INTERVAL)
    return () => window.clearInterval(id)
  }, [authMe])

  // 中文註解：監聽 API 401 事件，觸發 session 確認
  useEffect(() => {
    const handle = () => void authMe()
    window.addEventListener('api:unauthorized', handle)
    return () => window.removeEventListener('api:unauthorized', handle)
  }, [authMe])

  // 中文註解：session 過期時導向前台登入頁（非後台，避免無限 loop）
  useEffect(() => {
    if (sessionExpired) {
      clearSessionExpired()
      window.location.href = `${STOREFRONT_URL}/auth?expired=1`
    }
  }, [sessionExpired, clearSessionExpired])

  return (
    <BrowserRouter>
      {/* 中文註解：惡搞特效在後台也要顯示（管理員自己開的自己也要承受）*/}
      <HowlerAlert />
      <PeevesLayer />
      <Routes>
        {/* 根路徑直接導向後台總覽 */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* 後台路由（與 App.tsx 結構一致，路徑不變）*/}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products"  element={<AdminProducts />} />
          <Route path="orders"    element={<AdminOrders />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="reports"   element={<AdminReports />} />
          <Route path="coupons"   element={<AdminCoupons />} />
          <Route path="refunds"   element={<AdminRefunds />} />
          <Route path="prank"     element={<PrankConsole />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="ip-guard"  element={<AdminIpGuard />} />
        </Route>

        {/* 其他未知路徑一律導回後台總覽 */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AdminApp
