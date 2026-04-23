import { useMemo, useState } from 'react'
import { useAuditLogStore } from '@/store/auditLogStore'
import type { LogCategory } from '@/store/auditLogStore'
import styles from './AuditLog.module.css'

// 中文註解：類別顯示設定（中文標籤 + 顏色 + icon）
const CATEGORIES: { value: LogCategory | 'all'; label: string; icon: string; color: string }[] = [
  { value: 'all',       label: '全部',     icon: '📋', color: 'var(--gold)' },
  { value: 'product',   label: '商品',     icon: '📦', color: '#7eb9f5' },
  { value: 'order',     label: '訂單',     icon: '🛍️', color: '#82e0a0' },
  { value: 'inventory', label: '庫存',     icon: '🗃️', color: '#f5c07e' },
  { value: 'coupon',    label: '折價券',   icon: '🎟',  color: '#c07ef5' },
  { value: 'config',    label: '系統設定', icon: '⚙️', color: '#f57e7e' },
  { value: 'refund',    label: '退款',     icon: '🔄', color: '#f5e07e' },
  { value: 'security',  label: 'IP 守衛',  icon: '🛡️', color: '#7ef5e8' },
]

// 中文註解：類別對應顏色（log 列使用）
const CAT_COLOR: Record<LogCategory, string> = {
  product:   '#7eb9f5',
  order:     '#82e0a0',
  inventory: '#f5c07e',
  coupon:    '#c07ef5',
  config:    '#f57e7e',
  refund:    '#f5e07e',
  security:  '#7ef5e8',
}

// 中文註解：類別 icon
const CAT_ICON: Record<LogCategory, string> = {
  product:   '📦',
  order:     '🛍️',
  inventory: '🗃️',
  coupon:    '🎟',
  config:    '⚙️',
  refund:    '🔄',
  security:  '🛡️',
}

// 格式化時間（中文）
const fmtTime = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 每頁顯示筆數
const PAGE_SIZE = 50

const AuditLog = () => {
  const logs = useAuditLogStore(s => s.logs)
  const clearAll = useAuditLogStore(s => s.clearAll)
  const clearBefore = useAuditLogStore(s => s.clearBefore)

  // 篩選與搜尋狀態
  const [activeCategory, setActiveCategory] = useState<LogCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // 清除確認
  const [confirmClear, setConfirmClear] = useState(false)
  // 清除 N 天前
  const [clearDays, setClearDays] = useState(7)

  // 過濾後的日誌（依類別 + 搜尋）
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter(l => {
      if (activeCategory !== 'all' && l.category !== activeCategory) return false
      if (q && !l.action.toLowerCase().includes(q) && !l.target.toLowerCase().includes(q) && !(l.detail?.toLowerCase().includes(q))) return false
      return true
    })
  }, [logs, activeCategory, search])

  // 分頁
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageLogs = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  // 切換類別時重置頁碼
  const handleCategory = (cat: LogCategory | 'all') => {
    setActiveCategory(cat)
    setPage(1)
  }

  // 搜尋時重置頁碼
  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  // 清除 N 天前的日誌
  const handleClearBefore = () => {
    const cutoff = new Date(Date.now() - clearDays * 86400_000).toISOString()
    clearBefore(cutoff)
  }

  return (
    <>
      {/* 標題列 */}
      <div className={styles.toolbar}>
        <p className={styles.toolbarTitle}>📋 操作日誌（共 {logs.length} 筆）</p>
        <div className={styles.toolbarRight}>
          {/* 搜尋框 */}
          <input
            className={styles.searchInput}
            placeholder="搜尋動作 / 對象 / 細節..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 類別篩選 Tabs */}
      <div className={styles.catRow}>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`${styles.catBtn} ${activeCategory === c.value ? styles.catBtnActive : ''}`}
            style={activeCategory === c.value ? { borderColor: c.color, color: c.color } : undefined}
            onClick={() => handleCategory(c.value as LogCategory | 'all')}
          >
            {c.icon} {c.label}
            {c.value !== 'all' && (
              <span className={styles.catCount}>
                {logs.filter(l => l.category === c.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 日誌列表 */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>🦉 此區間尚無操作記錄</p>
        </div>
      ) : (
        <>
          <div className={styles.logList}>
            {pageLogs.map(log => (
              <div key={log.id} className={styles.logRow}>
                {/* 類別色條 */}
                <div className={styles.logBar} style={{ background: CAT_COLOR[log.category] }} />

                {/* 時間 */}
                <div className={styles.logTime}>{fmtTime(log.at)}</div>

                {/* 類別 badge */}
                <span className={styles.logCat} style={{ color: CAT_COLOR[log.category], borderColor: CAT_COLOR[log.category] + '55' }}>
                  {CAT_ICON[log.category]}
                </span>

                {/* 動作 */}
                <span className={styles.logAction}>{log.action}</span>

                {/* 對象 */}
                <span className={styles.logTarget}>{log.target}</span>

                {/* 細節（選填） */}
                {log.detail && <span className={styles.logDetail}>{log.detail}</span>}
              </div>
            ))}
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(1)}>《</button>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
              <span className={styles.pageInfo}>第 {page} / {totalPages} 頁（共 {filtered.length} 筆）</span>
              <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>》</button>
            </div>
          )}
        </>
      )}

      {/* 清除工具列 */}
      <div className={styles.clearRow}>
        {/* 清除 N 天前 */}
        <div className={styles.clearOldGroup}>
          <span className={styles.clearOldLabel}>清除</span>
          <select
            className={styles.clearSelect}
            value={clearDays}
            onChange={e => setClearDays(Number(e.target.value))}
          >
            <option value={1}>1 天</option>
            <option value={3}>3 天</option>
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
          </select>
          <span className={styles.clearOldLabel}>前的記錄</span>
          <button className={styles.clearOldBtn} onClick={handleClearBefore}>清除</button>
        </div>

        {/* 清除全部（二次確認） */}
        {confirmClear ? (
          <>
            <span className={styles.clearWarning}>確定要清除全部 {logs.length} 筆日誌嗎？</span>
            <button className={styles.clearConfirmBtn} onClick={() => { clearAll(); setConfirmClear(false) }}>確定清除</button>
            <button className={styles.clearCancelBtn} onClick={() => setConfirmClear(false)}>取消</button>
          </>
        ) : (
          <button className={styles.clearAllBtn} onClick={() => setConfirmClear(true)}>🗑 清除全部日誌</button>
        )}
      </div>
    </>
  )
}

export default AuditLog
