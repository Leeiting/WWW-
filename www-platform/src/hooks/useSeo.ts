// 中文註解：SEO / OG 標籤工具函式（配合 react-helmet-async 使用，spec §12.5）

// 危險等級轉換為星號文字（用於 description）
export const dangerStars = (level: number): string =>
  '★'.repeat(level) + '☆'.repeat(5 - level)

// 庫存格式（供 JSON-LD availability 欄位）
export const stockAvailability = (stock: number): string =>
  stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'

// 中文危險等級描述（用於商品 description）
export const dangerDesc = (level: number): string => {
  const map: Record<number, string> = {
    1: '適合巫師新手，完全無害',
    2: '輕度危險，建議在監護人陪同下使用',
    3: '中度危險，請先閱讀警告標示',
    4: '高度危險，請先立遺囑',
    5: '極度危險，伏地魔親核等級，後果自負',
  }
  return map[level] ?? '危險等級未知'
}

// 將 Knut 轉換為顯示用金加隆字串（如 3 G 2 S 1 K → "3.50 Galleon"）
export const knutToGalleonStr = (knut: number): string => {
  const galleon = knut / (17 * 29)
  return galleon.toFixed(2)
}
