import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import AdminApp from './AdminApp'

// 中文註解：後台獨立入口，只掛載後台路由，與前台 main.tsx 完全隔離
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AdminApp />
    </HelmetProvider>
  </StrictMode>,
)
