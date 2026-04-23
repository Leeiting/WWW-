import { prisma } from './lib/prisma'

const toKnut = (g: number, s: number, k: number) => g * 17 * 29 + s * 29 + k

async function main() {
  // 系統設定：確保永遠有一筆 id=1
  await prisma.systemConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })

  // 管理員帳號（中文註解：MVP 先用固定 admin@www.local，密碼後續可改由 /api/auth/register 建立）
  await prisma.user.upsert({
    where: { email: 'admin@www.local' },
    create: {
      email: 'admin@www.local',
      password_hash: null,
      auth_provider: 'local',
      display_name: '喬治＆弗雷（管理員）',
      user_level: 'admin',
    },
    update: { user_level: 'admin' },
  })

  const existing = await prisma.product.count()
  if (existing > 0) return

  await prisma.product.create({
    data: {
      name: '嘔吐棒棒糖',
      category: 'prank',
      description: '吃下去後立刻嘔吐，附贈解藥糖（老師懷疑你時立刻吃掉）。',
      danger_level: 2,
      media_url: '',
      is_hidden: false,
      skus: {
        create: [
          { spec: '單顆', price_knut: toKnut(0, 2, 15), stock: 10 },
          { spec: '6 顆裝', price_knut: toKnut(0, 12, 0), stock: 5 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: '誘餌炸彈',
      category: 'prank',
      description: '丟出後爆炸分心，趁機逃跑的神器。',
      danger_level: 4,
      media_url: '',
      is_hidden: false,
      skus: {
        create: [
          { spec: '標準版', price_knut: toKnut(1, 0, 0), stock: 5 },
          { spec: '超級版（附後遺症）', price_knut: toKnut(2, 5, 0), stock: 2 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: '魔法煙火大師套組',
      category: 'fireworks',
      description: '石內卜教授最恨的產品。會在城堡裡飛竄。',
      danger_level: 5,
      media_url: '',
      is_hidden: false,
      skus: {
        create: [
          { spec: '10 顆裝', price_knut: toKnut(5, 0, 0), stock: 3 },
          { spec: '50 顆裝（石內卜特厭）', price_knut: toKnut(20, 0, 0), stock: 1 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: '愛情魔藥（伯蒂版）',
      category: 'love_potion',
      description: '讓對象對你產生強烈迷戀（已被石內卜沒收）。',
      danger_level: 3,
      media_url: '',
      is_hidden: false,
      skus: {
        create: [
          { spec: '10ml 試用裝', price_knut: toKnut(2, 10, 0), stock: 0 },
          { spec: '50ml 正裝', price_knut: toKnut(10, 0, 0), stock: 0 },
        ],
      },
    },
  })

  await prisma.product.create({
    data: {
      name: '魔法護盾護身符',
      category: 'defense',
      description: '可抵擋輕度魔咒的護身符（不保證對阿瓦達索命有效）。',
      danger_level: 1,
      media_url: '',
      is_hidden: false,
      skus: {
        create: [{ spec: '標準版', price_knut: toKnut(3, 5, 0), stock: 8 }],
      },
    },
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

