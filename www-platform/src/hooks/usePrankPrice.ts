import { useEffect, useState } from 'react'
import { usePrankStore } from '@/store/prankStore'

// 惡搞模式：每 2 秒以隨機係數（0.5x ~ 5x）更新顯示價格
export const usePrankPrice = (basePrice: number): number => {
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)
  const [displayPrice, setDisplayPrice] = useState(basePrice)

  useEffect(() => {
    if (!prankModeEnabled) {
      setDisplayPrice(basePrice)
      return
    }
    const update = () => {
      const multiplier = Math.random() * (5.0 - 0.5) + 0.5  // 0.5x ~ 5.0x
      setDisplayPrice(Math.round(basePrice * multiplier))
    }
    update()
    const interval = setInterval(update, 2000)
    return () => clearInterval(interval)
  }, [prankModeEnabled, basePrice])

  return displayPrice
}
