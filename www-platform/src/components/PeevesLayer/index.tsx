import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { usePrankStore } from '@/store/prankStore'
import styles from './PeevesLayer.module.css'

// 飛七在畫面內隨機產生下一個目標位置
const randomPos = () => ({
  x: Math.random() * (window.innerWidth - 100),
  y: Math.random() * (window.innerHeight - 100),
})

const PeevesLayer = () => {
  const peevesPatrolActive = usePrankStore(s => s.peevesPatrolActive)
  const dismissPeevesPatrol = usePrankStore(s => s.dismissPeevesPatrol)

  const controls = useAnimationControls()
  const [pos] = useState(randomPos)         // 初始固定位置
  const [wandActive, setWandActive] = useState(false)  // 魔杖已拔出
  const [zapping, setZapping] = useState(false)          // 閃電播放中
  const [gone, setGone] = useState(false)                // 飛七已消失
  const moveRef = useRef(true)

  // 飛七出現後開始不規則移動
  useEffect(() => {
    if (!peevesPatrolActive || gone) return

    moveRef.current = true

    const move = async () => {
      while (moveRef.current && peevesPatrolActive) {
        const next = randomPos()
        await controls.start({
          x: next.x,
          y: next.y,
          transition: {
            duration: 4 + Math.random() * 4,  // 每段移動 4~8 秒（原 1.5~3.5 秒）
            ease: 'easeInOut',
          },
        })
        await new Promise(r => setTimeout(r, 800 + Math.random() * 1500))  // 停留 0.8~2.3 秒（原 0.3~1.1 秒）
      }
    }

    move()
    return () => { moveRef.current = false }
  }, [peevesPatrolActive, gone, controls])

  const handleClick = () => {
    if (zapping || gone) return

    if (!wandActive) {
      // 第一次點擊：拔出魔杖
      setWandActive(true)
    } else {
      // 第二次點擊（魔杖已出）：發射閃電消滅飛七
      setWandActive(false)
      setZapping(true)
      moveRef.current = false   // 讓飛七停止移動

      setTimeout(() => {
        setGone(true)
        setZapping(false)
        dismissPeevesPatrol()
      }, 900)
    }
  }

  if (!peevesPatrolActive || gone) return null

  return (
    <motion.div
      className={`${styles.peeves} ${zapping ? styles.zapped : ''}`}
      style={{ left: pos.x, top: pos.y }}
      animate={zapping ? undefined : controls}   // 閃電時停止移動
      initial={{ x: 0, y: 0 }}
      onClick={handleClick}
      title={wandActive ? '⚡ 再次點擊發射閃電！' : '點擊小鬼'}
    >
      {/* 飛七本體 */}
      👻

      {/* 魔杖（拔出後顯示在飛七上方） */}
      {wandActive && (
        <span className={styles.wand}>🪄</span>
      )}

      {/* 閃電特效（覆蓋在飛七上） */}
      {zapping && (
        <span className={styles.lightning}>⚡</span>
      )}
    </motion.div>
  )
}

export default PeevesLayer
