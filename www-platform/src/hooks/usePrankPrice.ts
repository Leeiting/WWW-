import { useEffect, useState } from 'react'
import { usePrankStore } from '@/store/prankStore'

// 顯示上限：超過 3.0x 時截斷，避免過高價格嚇跑顧客（spec §10.2 AC-26）
const PRANK_MAX_DISPLAY = 3.0

// 惡搞模式：每 2 秒以隨機係數（0.5x ~ 5x）更新顯示價格，顯示截斷至 3.0x
export const usePrankPrice = (basePrice: number): number => {
  const prankModeEnabled = usePrankStore(s => s.prankModeEnabled)
  const [displayPrice, setDisplayPrice] = useState(basePrice)

  useEffect(() => {
    if (!prankModeEnabled) {
      setDisplayPrice(basePrice)
      return
    }
    const update = () => {
      // 隨機係數範圍 0.5x ~ 5.0x，顯示截斷至 PRANK_MAX_DISPLAY（3.0x）
      const multiplier = Math.random() * (5.0 - 0.5) + 0.5
      const capped = Math.min(multiplier, PRANK_MAX_DISPLAY)
      setDisplayPrice(Math.round(basePrice * capped))
    }
    update()
    const interval = setInterval(update, 2000)
    return () => clearInterval(interval)
  }, [prankModeEnabled, basePrice])

  return displayPrice
}
