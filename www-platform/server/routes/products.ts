import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { fail, ok } from '../lib/http'

export const productsRouter = Router()

// 取得商品（公開）：排除隱藏
productsRouter.get('/', async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim()
  const category = (req.query.category as string | undefined)?.trim()

  const products = await prisma.product.findMany({
    where: {
      is_hidden: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
      ...(category ? { category: category as never } : {}),
    },
    orderBy: { created_at: 'desc' },
    include: { skus: true },
  })

  return ok(res, products)
})

// 取得商品（管理員用）：包含隱藏
productsRouter.get('/all', async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { created_at: 'desc' },
    include: { skus: true },
  })
  return ok(res, products)
})

// 庫存異動紀錄：取得最近 200 筆，可用 ?sku_id=xxx 篩選單一 SKU
// 中文註解：此路由必須在 /:id 之前宣告，否則 Express 會把 "stock-logs" 當成商品 ID
productsRouter.get('/stock-logs', async (req, res) => {
  const skuId = (req.query.sku_id as string | undefined)?.trim()
  const logs = await prisma.stockLog.findMany({
    where: skuId ? { s_id: skuId } : {},
    orderBy: { created_at: 'desc' },
    take: 200,
    include: {
      sku: {
        include: { product: { select: { p_id: true, name: true } } },
      },
    },
  })
  return ok(res, logs)
})

productsRouter.post('/', async (req, res) => {
  const body = req.body as Partial<{
    name: string
    category: string
    description?: string
    danger_level: number
    media_url?: string
    is_hidden: boolean
  }>

  if (!body.name?.trim()) return fail(res, 400, 'INTERNAL_ERROR', '商品名稱不可為空')
  if (!body.category) return fail(res, 400, 'INTERNAL_ERROR', '商品類別不可為空')

  const created = await prisma.product.create({
    data: {
      name: body.name.trim(),
      category: body.category as never,
      description: body.description ?? null,
      danger_level: Number(body.danger_level ?? 1),
      media_url: body.media_url ?? null,
      is_hidden: Boolean(body.is_hidden ?? false),
    },
  })
  return ok(res, created, 201)
})

productsRouter.put('/:id', async (req, res) => {
  const id = req.params.id
  const body = req.body as Partial<{
    name: string
    category: string
    description?: string
    danger_level: number
    media_url?: string
    is_hidden: boolean
  }>

  const exists = await prisma.product.findUnique({ where: { p_id: id } })
  if (!exists) return fail(res, 404, 'PRODUCT_NOT_FOUND', '此法寶已消失在斜角巷某處')

  const updated = await prisma.product.update({
    where: { p_id: id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.category !== undefined ? { category: body.category as never } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.danger_level !== undefined ? { danger_level: Number(body.danger_level) } : {}),
      ...(body.media_url !== undefined ? { media_url: body.media_url } : {}),
      ...(body.is_hidden !== undefined ? { is_hidden: Boolean(body.is_hidden) } : {}),
    },
  })
  return ok(res, updated)
})

productsRouter.delete('/:id', async (req, res) => {
  const id = req.params.id
  const exists = await prisma.product.findUnique({ where: { p_id: id } })
  if (!exists) return fail(res, 404, 'PRODUCT_NOT_FOUND', '此法寶已消失在斜角巷某處')

  await prisma.product.delete({ where: { p_id: id } })
  return ok(res, { deleted: true })
})

// SKU：取得
productsRouter.get('/:id/skus', async (req, res) => {
  const id = req.params.id
  const skus = await prisma.sKUItem.findMany({ where: { p_id: id } })
  return ok(res, skus)
})

// SKU：新增
productsRouter.post('/:id/skus', async (req, res) => {
  const p_id = req.params.id
  const body = req.body as Partial<{
    spec: string
    price_knut: number
    stock: number
    weight_g?: number
    image_url?: string
  }>
  if (!body.spec?.trim()) return fail(res, 400, 'INTERNAL_ERROR', 'SKU 規格不可為空')

  const created = await prisma.sKUItem.create({
    data: {
      p_id,
      spec: body.spec.trim(),
      price_knut: body.price_knut ?? 0,
      stock: body.stock ?? 0,
      weight_g: body.weight_g ?? null,
      image_url: body.image_url ?? null,
    },
  })
  return ok(res, created, 201)
})

// SKU：更新（若庫存有變動則寫入異動紀錄）
productsRouter.put('/:id/skus/:skuId', async (req, res) => {
  const skuId = req.params.skuId
  const body = req.body as Partial<{
    spec: string
    price_knut: number
    stock: number
    weight_g?: number
    image_url?: string
  }>

  // 中文註解：若本次更新包含庫存欄位，先查出舊庫存以計算變動量
  let stockChange: { oldStock: number; newStock: number } | null = null
  if (body.stock !== undefined) {
    const current = await prisma.sKUItem.findUnique({ where: { s_id: skuId } })
    if (current) {
      stockChange = { oldStock: current.stock, newStock: Number(body.stock) }
    }
  }

  const updated = await prisma.sKUItem.update({
    where: { s_id: skuId },
    data: {
      ...(body.spec !== undefined ? { spec: body.spec.trim() } : {}),
      ...(body.price_knut !== undefined ? { price_knut: body.price_knut } : {}),
      ...(body.stock !== undefined ? { stock: body.stock } : {}),
      ...(body.weight_g !== undefined ? { weight_g: body.weight_g } : {}),
      ...(body.image_url !== undefined ? { image_url: body.image_url } : {}),
    },
  })

  // 中文註解：庫存確實有變動才寫紀錄（避免零差值污染日誌）
  if (stockChange && stockChange.oldStock !== stockChange.newStock) {
    await prisma.stockLog.create({
      data: {
        s_id: skuId,
        change_qty: stockChange.newStock - stockChange.oldStock,
        reason: 'sku_update',
        note: `後台編輯 SKU 更新庫存：${stockChange.oldStock} → ${stockChange.newStock}`,
      },
    })
  }

  return ok(res, updated)
})

// SKU：補貨彩蛋「從辦公室偷回」→ stock=5；或手動指定庫存值，並記錄異動
productsRouter.patch('/:id/skus/:skuId/stock', async (req, res) => {
  const skuId = req.params.skuId
  const body = req.body as Partial<{ stock: number; mode?: 'steal_back' }>

  // 中文註解：先取得現有庫存以計算變動量
  const current = await prisma.sKUItem.findUnique({ where: { s_id: skuId } })
  if (!current) return fail(res, 404, 'PRODUCT_NOT_FOUND', '找不到此 SKU')

  const newStock = body.mode === 'steal_back' ? 5 : Number(body.stock ?? 0)
  const changeQty = newStock - current.stock

  const updated = await prisma.sKUItem.update({
    where: { s_id: skuId },
    data: { stock: newStock },
  })

  // 中文註解：庫存有變動才寫紀錄
  if (changeQty !== 0) {
    await prisma.stockLog.create({
      data: {
        s_id: skuId,
        change_qty: changeQty,
        reason: body.mode === 'steal_back' ? 'steal_back' : 'manual_restock',
        note: body.mode === 'steal_back'
          ? `從辦公室偷回：${current.stock} → ${newStock}`
          : `手動調整庫存：${current.stock} → ${newStock}`,
      },
    })
  }

  return ok(res, updated)
})

productsRouter.delete('/:id/skus/:skuId', async (req, res) => {
  const skuId = req.params.skuId
  await prisma.sKUItem.delete({ where: { s_id: skuId } })
  return ok(res, { deleted: true })
})
