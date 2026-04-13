import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePrankStore } from '@/store/prankStore'
import Storefront from '@/pages/Storefront'
import AdminLayout from '@/pages/Admin/AdminLayout'
import AdminDashboard from '@/pages/Admin/Dashboard'
import AdminProducts from '@/pages/Admin/Products'
import PrankConsole from '@/pages/Admin/PrankConsole'
import StationeryShop from '@/pages/StationeryShop'
// 全域惡搞特效元件（前台可見）
import HowlerAlert from '@/components/HowlerAlert'
import PeevesLayer from '@/components/PeevesLayer'

function App() {
  const misManagedActive = usePrankStore(s => s.misManagedActive)

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

  return (
    <BrowserRouter>
      {/* 吼叫信橫幅與飛七浮層：全域掛載，由 prankStore 控制顯示 */}
      <HowlerAlert />
      <PeevesLayer />
      <Routes>
        {/* 前台：Mischief Managed 啟動時導向文具店 */}
        <Route
          path="/"
          element={misManagedActive ? <Navigate to="/stationery" replace /> : <Storefront />}
        />

        {/* 後台（使用 AdminLayout 包裝，含左側導覽） */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="prank" element={<PrankConsole />} />
        </Route>

        {/* Mischief Managed 文具店掩護頁面 */}
        <Route path="/stationery" element={<StationeryShop />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
