import { usePrankStore } from '@/store/prankStore'
import styles from './PrankConsole.module.css'

const PrankConsole = () => {
  const {
    prankModeEnabled, togglePrankMode,
    howlerModeEnabled, toggleHowlerMode,
    howlerConfirmed, confirmHowler,
    peevesPatrolActive, triggerPeevesPatrol, dismissPeevesPatrol,
  } = usePrankStore()

  return (
    <div>
      <p className={styles.pageTitle}>🎭 Prank Console — 惡搞控制中心</p>

      {/* ── 開關區 ── */}
      <p className={styles.sectionLabel}>即時開關</p>
      <div className={styles.grid}>

        {/* 惡搞模式 */}
        <div className={`${styles.card} ${prankModeEnabled ? styles.active : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>💸</span>
            <div className={styles.cardInfo}>
              <p className={styles.cardTitle}>惡搞模式</p>
              <p className={styles.cardDesc}>
                開啟後，前台所有商品價格每 2 秒以隨機係數即時跳動。
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={prankModeEnabled}
                onChange={togglePrankMode}
              />
              <span className={styles.toggleTrack} />
            </label>
          </div>

          {/* 狀態 */}
          <div className={styles.statusBadge}>
            <span className={`${styles.dot} ${prankModeEnabled ? styles.on : ''}`} />
            <span style={{ color: prankModeEnabled ? 'var(--gold)' : 'var(--text-dim)' }}>
              {prankModeEnabled ? 'ON — 價格跳動中' : 'OFF'}
            </span>
          </div>

          {/* 技術說明 */}
          {prankModeEnabled && (
            <div className={styles.prankDetail}>
              multiplier = Math.random() × 4.5 + 0.5<br />
              範圍：<strong style={{ color: 'var(--gold)' }}>0.5x ～ 5.0x</strong>　更新間隔：2 秒
            </div>
          )}
        </div>

        {/* 吼叫信模式 */}
        <div className={`${styles.card} ${styles.danger} ${howlerModeEnabled ? styles.active : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>📣</span>
            <div className={styles.cardInfo}>
              <p className={styles.cardTitle}>吼叫信模式</p>
              <p className={styles.cardDesc}>
                前台頂部出現紅色橫幅，並嘗試播放音效警告。每 10 秒閃爍一次。
              </p>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={howlerModeEnabled}
                onChange={toggleHowlerMode}
              />
              <span className={styles.toggleTrack} />
            </label>
          </div>

          <div className={styles.statusBadge}>
            <span className={`${styles.dot} ${howlerModeEnabled ? styles.on : ''}`} />
            <span style={{ color: howlerModeEnabled ? 'var(--red-bright)' : 'var(--text-dim)' }}>
              {howlerModeEnabled ? 'ON — 石內卜警報啟動中' : 'OFF'}
            </span>
          </div>

          {howlerModeEnabled && (
            <div className={styles.preview}>
              🔊 「再不買，石內卜教授要來了，快一點！」
            </div>
          )}

          {/* 後台確認後前台才顯示橫幅，並在用戶手勢內直接啟動音效 */}
          {howlerModeEnabled && !howlerConfirmed && (
            <button
              className={styles.triggerBtn}
              onClick={() => {
                // 在用戶手勢內啟動 AudioContext，確保瀏覽器允許播放
                try { new AudioContext().resume() } catch {}
                confirmHowler()
              }}
            >
              📣 確認警報，推送至前台
            </button>
          )}
          {howlerModeEnabled && howlerConfirmed && (
            <div className={styles.statusBadge} style={{ marginTop: 8 }}>
              <span className={`${styles.dot} ${styles.on}`} />
              <span style={{ color: 'var(--red-bright)', fontSize: 12 }}>已推送至前台</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 觸發器區 ── */}
      <p className={styles.sectionLabel}>一次性觸發器</p>
      <div className={styles.grid}>

        {/* 飛七巡邏 */}
        <div className={`${styles.card} ${peevesPatrolActive ? styles.active : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardIcon}>👻</span>
            <div className={styles.cardInfo}>
              <p className={styles.cardTitle}>飛七巡邏（Peeves Patrol）</p>
              <p className={styles.cardDesc}>
                在前台隨機生成飛七浮動圖層，於畫面內不規則移動。<br />
                顧客的購物車若有「誘餌炸彈」，點擊飛七可觸發爆炸動畫，飛七消失 300 秒。
              </p>
            </div>
          </div>

          <div className={styles.peevesStatus}>
            <span className={`${styles.dot} ${peevesPatrolActive ? styles.on : ''}`} />
            <span>{peevesPatrolActive ? '👻 飛七正在巡邏中...' : '飛七休息中'}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={styles.triggerBtn}
              onClick={triggerPeevesPatrol}
              disabled={peevesPatrolActive}
            >
              {peevesPatrolActive ? '巡邏中...' : '🚀 觸發飛七巡邏'}
            </button>
            {peevesPatrolActive && (
              <button
                className={styles.triggerBtn}
                onClick={dismissPeevesPatrol}
                style={{ flex: '0 0 auto', width: 'auto', padding: '12px 16px' }}
              >
                召回
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── 使用說明 ── */}
      <p className={styles.sectionLabel}>使用說明</p>
      <div className={styles.preview} style={{ maxWidth: '600px' }}>
        <strong style={{ color: 'var(--gold)' }}>惡搞模式</strong>：前台價格視覺跳動，結帳時仍使用原始定價。<br />
        <strong style={{ color: 'var(--gold)' }}>吼叫信模式</strong>：前台顯示紅色橫幅，由前台頁面自動閃爍。<br />
        <strong style={{ color: 'var(--gold)' }}>飛七巡邏</strong>：飛七只在前台出現，此後台頁面不顯示。<br />
        <strong style={{ color: 'var(--red)' }}>Mischief Managed</strong>：一鍵關閉所有特效並切換掩護模式，請見左側導覽按鈕。
      </div>
    </div>
  )
}

export default PrankConsole
