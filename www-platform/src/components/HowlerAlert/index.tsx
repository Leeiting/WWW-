import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePrankStore } from '@/store/prankStore'
import styles from './HowlerAlert.module.css'

const HOWLER_TEXT = '再不買，石內卜教授要來了，快一點！'

// 用 Web Audio API 產生雙音交替急促警報聲（不需要 mp3 檔）
function createAlarm(ctx: AudioContext): () => void {
  let stopped = false
  let i = 0

  // 雙音頻率：高音 880Hz / 低音 660Hz，交替 200ms
  const TONES = [880, 660]
  const BEAT_MS = 200

  const playNext = () => {
    if (stopped) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'square'          // 方波：尖銳、有壓迫感
    osc.frequency.value = TONES[i % 2]

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01)   // 快速淡入
    gain.gain.linearRampToValueAtTime(0, now + BEAT_MS / 1000 - 0.01) // 淡出

    osc.start(now)
    osc.stop(now + BEAT_MS / 1000)
    i++
    osc.onended = playNext
  }

  playNext()
  return () => { stopped = true }
}

const HowlerAlert = () => {
  const howlerModeEnabled = usePrankStore(s => s.howlerModeEnabled)
  const howlerConfirmed = usePrankStore(s => s.howlerConfirmed)
  const toggleHowlerMode = usePrankStore(s => s.toggleHowlerMode)
  const [needsClick, setNeedsClick] = useState(false)
  // 判斷是否在後台（僅後台可操控警報按鈕）
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  const ctxRef = useRef<AudioContext | null>(null)
  const stopAlarmRef = useRef<(() => void) | null>(null)

  // 停止警報並清理
  const stopAlarm = () => {
    stopAlarmRef.current?.()
    stopAlarmRef.current = null
    ctxRef.current?.close()
    ctxRef.current = null
  }

  // 啟動警報（需在用戶手勢內呼叫，或直接呼叫）
  const startAlarm = () => {
    stopAlarm()
    const ctx = new AudioContext()
    ctxRef.current = ctx
    stopAlarmRef.current = createAlarm(ctx)
    setNeedsClick(false)
  }

  useEffect(() => {
    if (!howlerModeEnabled || !howlerConfirmed) {
      stopAlarm()
      return
    }
    // 嘗試直接啟動（autoplay 被擋時 AudioContext 會是 suspended）
    const ctx = new AudioContext()
    ctxRef.current = ctx
    if (ctx.state === 'running') {
      stopAlarmRef.current = createAlarm(ctx)
    } else {
      // 瀏覽器需要用戶手勢才能播放，顯示提示
      setNeedsClick(true)
    }
    return stopAlarm
  }, [howlerModeEnabled, howlerConfirmed])

  // 前台需等後台確認警報後才顯示橫幅
  if (!howlerModeEnabled || !howlerConfirmed) return null

  return (
    <div className={styles.banner}>
      <span className={styles.text}>{HOWLER_TEXT}</span>

      {/* 僅後台顯示「點擊啟動警報」按鈕，前台不可操控 */}
      {needsClick && isAdmin && (
        <span className={styles.clickHint} onClick={startAlarm}>
          🔊 點擊啟動警報
        </span>
      )}

      {/* 僅後台顯示關閉按鈕，前台不可關閉 */}
      {isAdmin && (
        <button className={styles.closeBtn} onClick={toggleHowlerMode}>
          關閉
        </button>
      )}
    </div>
  )
}

export default HowlerAlert
