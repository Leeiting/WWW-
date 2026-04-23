// 中文註解：後台 IP 守衛管理頁面（魔法部監控名單，spec §11.2）
import { useEffect, useState, useMemo } from 'react'
import { useIpGuardStore } from '@/store/ipGuardStore'
import type { MischiefTriggerLog } from '@/store/ipGuardStore'
import styles from './IpGuard.module.css'

// 中文註解：觸發類型設定（對應 spec §11.3 三關，標籤 + 顏色 class）
const TRIGGER_CONFIG: Record<string, { label: string; cls: string }> = {
  ip_blacklist: { label: '🚫 IP 黑名單命中',      cls: 'badgeRed'    },
  user_agent:   { label: '🕵️ 可疑 User-Agent',   cls: 'badgePurple' },
  rate_limit:   { label: '⚡ 高頻訪問超標',        cls: 'badgeOrange' },
}

const IpGuardPage = () => {
  const {
    blacklist, isLoading, error, triggerLogs, myIp,
    fetchBlacklist, addIp, deleteIp, fetchTriggerLogs, fetchMyIp,
  } = useIpGuardStore()

  // 新增表單
  const [newIp, setNewIp]     = useState('')
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding]   = useState(false)
  const [addErr, setAddErr]   = useState('')
  const [addOk, setAddOk]     = useState(false)

  // 刪除確認（儲存正在確認的 id）
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // 分頁
  const [tab, setTab] = useState<'blacklist' | 'logs'>('blacklist')

  // 搜尋篩選
  const [search, setSearch] = useState('')

  // 觸發日誌篩選
  const [logFilter, setLogFilter] = useState<'all' | 'ip_blacklist' | 'user_agent' | 'rate_limit'>('all')

  useEffect(() => {
    void fetchBlacklist()
    void fetchTriggerLogs()
    void fetchMyIp()
  }, [fetchBlacklist, fetchTriggerLogs, fetchMyIp])

  // 中文註解：篩選後的黑名單
  const filteredBlacklist = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return blacklist
    return blacklist.filter(e =>
      e.ip_cidr.toLowerCase().includes(q) ||
      (e.note ?? '').toLowerCase().includes(q)
    )
  }, [blacklist, search])

  // 中文註解：篩選後的觸發日誌
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return triggerLogs
    return triggerLogs.filter(l => l.trigger_type === logFilter)
  }, [triggerLogs, logFilter])

  // 中文註解：統計數據
  const todayTriggers = useMemo(() => {
    const today = new Date().toDateString()
    return triggerLogs.filter(l => new Date(l.created_at).toDateString() === today).length
  }, [triggerLogs])

  const rateLimitHits = useMemo(
    () => triggerLogs.filter(l => l.trigger_type === 'rate_limit').length,
    [triggerLogs]
  )

  // 中文註解：送出新增封鎖表單
  const handleAdd = async () => {
    const ip = newIp.trim()
    if (!ip) { setAddErr('請輸入 IP 或 CIDR'); return }
    setAdding(true)
    setAddErr('')
    setAddOk(false)
    try {
      await addIp(ip, newNote.trim() || undefined)
      setNewIp('')
      setNewNote('')
      setAddOk(true)
      setTimeout(() => setAddOk(false), 2500)
    } catch (e) {
      setAddErr((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  // 中文註解：刪除確認流程（內嵌，不用 window.confirm）
  const handleDeleteClick = (id: number) => {
    if (confirmDeleteId === id) {
      void deleteIp(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      // 3 秒後自動取消確認
      setTimeout(() => setConfirmDeleteId(c => (c === id ? null : c)), 3000)
    }
  }

  // 中文註解：從觸發日誌一鍵填入封鎖表單
  const handleQuickBlock = (log: MischiefTriggerLog) => {
    setTab('blacklist')
    setNewIp(log.source_ip)
    setNewNote(`自觸發日誌快速封鎖（${TRIGGER_CONFIG[log.trigger_type]?.label ?? log.trigger_type}）`)
  }

  // 中文註解：判斷某個觸發日誌的 IP 是否已在黑名單中
  const isAlreadyBlocked = (ip: string) => blacklist.some(e => e.ip_cidr === ip)

  return (
    <div className={styles.page}>
      {/* 標題 */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>🕵️ 魔法部監控名單</h2>
          <p className={styles.pageDesc}>
            將特定 IP 或 CIDR 加入黑名單後，該 IP 訪客在前台啟動時會自動觸發 Mischief Managed 掩護模式。
            攜帶有效管理員 JWT 的請求永遠繞過偵測。
          </p>
        </div>

        {/* 我的 IP 提示 */}
        {myIp && (
          <div className={styles.myIpCard}>
            <span className={styles.myIpLabel}>你目前的 IP</span>
            <span className={styles.myIpValue}>{myIp}</span>
            <span className={styles.myIpHint}>管理員不受封鎖影響</span>
          </div>
        )}
      </div>

      {/* ── 統計卡片 ── */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🚫</span>
          <span className={styles.statValue}>{blacklist.length}</span>
          <span className={styles.statLabel}>已封鎖 IP</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>⚡</span>
          <span className={styles.statValue}>{triggerLogs.length}</span>
          <span className={styles.statLabel}>總觸發次數</span>
        </div>
        <div className={`${styles.statCard} ${todayTriggers > 0 ? styles.statCardAlert : ''}`}>
          <span className={styles.statIcon}>📅</span>
          <span className={styles.statValue}>{todayTriggers}</span>
          <span className={styles.statLabel}>今日觸發</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statIcon}>🔥</span>
          <span className={styles.statValue}>{rateLimitHits}</span>
          <span className={styles.statLabel}>高頻命中</span>
        </div>
      </div>

      {/* ── 分頁標籤 ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'blacklist' ? styles.tabActive : ''}`}
          onClick={() => setTab('blacklist')}
        >
          🚫 封鎖清單
          <span className={styles.tabCount}>{blacklist.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'logs' ? styles.tabActive : ''}`}
          onClick={() => setTab('logs')}
        >
          📋 觸發記錄
          {todayTriggers > 0 && (
            <span className={`${styles.tabCount} ${styles.tabCountAlert}`}>{todayTriggers} 今日</span>
          )}
        </button>
      </div>

      {/* ══ 封鎖清單 tab ══ */}
      {tab === 'blacklist' && (
        <>
          {/* 新增封鎖表單 */}
          <div className={styles.addCard}>
            <p className={styles.addTitle}>＋ 新增封鎖條目</p>
            <div className={styles.addRow}>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>🌐</span>
                <input
                  className={styles.input}
                  placeholder="IP 或 CIDR（如 192.168.1.100、10.0.0.0/8）"
                  value={newIp}
                  onChange={e => { setNewIp(e.target.value); setAddErr(''); setAddOk(false) }}
                  onKeyDown={e => e.key === 'Enter' && void handleAdd()}
                />
              </div>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>📝</span>
                <input
                  className={`${styles.input} ${styles.inputNote}`}
                  placeholder="備註（如：魔法部總部 IP）"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void handleAdd()}
                />
              </div>
              <button
                className={styles.addBtn}
                onClick={() => void handleAdd()}
                disabled={adding}
              >
                {adding ? '新增中…' : '封鎖'}
              </button>
            </div>

            {addErr && <p className={styles.addError}>⚠️ {addErr}</p>}
            {addOk  && <p className={styles.addOk}>✅ 已成功新增封鎖條目</p>}

            {/* 快捷格式提示 */}
            <div className={styles.formatHints}>
              <span className={styles.formatHintLabel}>格式範例：</span>
              {['192.168.1.1', '10.0.0.0/8', '172.16.0.0/12', '::1'].map(ex => (
                <button
                  key={ex}
                  className={styles.formatChip}
                  onClick={() => setNewIp(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* 搜尋列 */}
          <div className={styles.searchBar}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              placeholder="搜尋 IP 或備註…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
            )}
            <span className={styles.searchCount}>
              {filteredBlacklist.length} / {blacklist.length} 筆
            </span>
          </div>

          {/* 清單 */}
          {isLoading && <p className={styles.loading}>⏳ 載入中…</p>}
          {error    && <p className={styles.error}>⚠️ {error}</p>}

          {!isLoading && filteredBlacklist.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>{search ? '🔍' : '🗺️'}</span>
              <p>{search ? `找不到「${search}」相關條目` : '黑名單為空——目前無任何封鎖條目'}</p>
            </div>
          )}

          {filteredBlacklist.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>IP / CIDR</th>
                  <th>備註</th>
                  <th>新增時間</th>
                  <th style={{ width: 120, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlacklist.map(entry => (
                  <tr key={entry.id} className={confirmDeleteId === entry.id ? styles.rowConfirm : ''}>
                    <td>
                      <span className={styles.ipChip}>{entry.ip_cidr}</span>
                      {myIp && entry.ip_cidr === myIp && (
                        <span className={styles.selfIpWarn}>⚠️ 這是你的 IP！</span>
                      )}
                    </td>
                    <td className={styles.noteCell}>
                      {entry.note ?? <span className={styles.noNote}>—</span>}
                    </td>
                    <td className={styles.timeCell}>
                      {new Date(entry.created_at).toLocaleString('zh-TW')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {confirmDeleteId === entry.id ? (
                        <span className={styles.confirmRow}>
                          <span className={styles.confirmText}>確定移除？</span>
                          <button
                            className={styles.confirmYes}
                            onClick={() => handleDeleteClick(entry.id)}
                          >確定</button>
                          <button
                            className={styles.confirmNo}
                            onClick={() => setConfirmDeleteId(null)}
                          >取消</button>
                        </span>
                      ) : (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteClick(entry.id)}
                        >
                          🗑 移除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ══ 觸發記錄 tab ══ */}
      {tab === 'logs' && (
        <>
          {/* 工具列 */}
          <div className={styles.logToolbar}>
            <div className={styles.logFilters}>
              {(['all', 'ip_blacklist', 'user_agent', 'rate_limit'] as const).map(f => (
                <button
                  key={f}
                  className={`${styles.filterBtn} ${logFilter === f ? styles.filterActive : ''}`}
                  onClick={() => setLogFilter(f)}
                >
                  {f === 'all' ? '全部' : TRIGGER_CONFIG[f]?.label ?? f}
                  <span className={styles.filterCount}>
                    {f === 'all' ? triggerLogs.length : triggerLogs.filter(l => l.trigger_type === f).length}
                  </span>
                </button>
              ))}
            </div>
            <button
              className={styles.refreshBtn}
              onClick={() => void fetchTriggerLogs()}
            >
              🔄 重新整理
            </button>
          </div>

          {filteredLogs.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p>目前無{logFilter !== 'all' ? '此類型的' : ''}觸發記錄</p>
            </div>
          )}

          {filteredLogs.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>觸發類型</th>
                  <th>來源 IP</th>
                  <th>說明</th>
                  <th>觸發時間</th>
                  <th style={{ width: 100, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const cfg = TRIGGER_CONFIG[log.trigger_type]
                  const blocked = isAlreadyBlocked(log.source_ip)
                  return (
                    <tr key={log.id}>
                      <td>
                        <span className={`${styles.triggerBadge} ${styles[cfg?.cls ?? '']}`}>
                          {cfg?.label ?? log.trigger_type}
                        </span>
                      </td>
                      <td>
                        <span className={styles.ipChip}>{log.source_ip}</span>
                        {blocked && <span className={styles.alreadyBlocked}>已封鎖</span>}
                      </td>
                      <td className={styles.noteCell}>{log.note ?? '—'}</td>
                      <td className={styles.timeCell}>
                        {new Date(log.created_at).toLocaleString('zh-TW')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!blocked && (
                          <button
                            className={styles.quickBlockBtn}
                            onClick={() => handleQuickBlock(log)}
                            title="快速加入黑名單"
                          >
                            🚫 封鎖
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default IpGuardPage
