import { PrismaClient } from '@prisma/client'

// 開發模式避免熱重載造成過多連線（中文註解：Vite/tsx watch 會重啟模組）
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

