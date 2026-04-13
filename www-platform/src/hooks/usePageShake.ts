import { useEffect } from 'react'

// 每 10 秒觸發一次頁面震動（500ms 動畫）
export const usePageShake = () => {
  useEffect(() => {
    const trigger = () => {
      document.body.style.animation = 'none'
      // 強制重新觸發 reflow
      void document.body.offsetHeight
      document.body.style.animation = 'pageShake 0.5s ease'
    }

    // 10 秒後第一次，之後每 10 秒
    const timer = setInterval(trigger, 10000)
    return () => clearInterval(timer)
  }, [])
}
