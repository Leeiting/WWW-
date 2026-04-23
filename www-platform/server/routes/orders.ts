import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { fail, ok } from '../lib/http'
import { randomUUID } from 'crypto'

export const ordersRouter = Router()

// 批量強制釋放庫存（unpaid → cancelled，stock_reserved -= qty）
// 中文註解：node-cron 若停擺時，管理員可手動批次校正凍結庫存
ordersRouter.post('/bulk-release', async (req, res) => {
  const body = req.body as { order_ids?: string[] }
  if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
    return fail(res, 400, 'INTERNAL_ERROR', '請提供要釋放的訂單 ID 列表')
  }

  // 中文註解：逐筆在 transaction 內處理，非 unpaid 的訂單跳過
  const released: string[] = []
  const skipped: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const orderId of body.order_ids!) {
      const order = await tx.order.findUnique({
        where: { o_id: orderId },
        include: { items: true },
      })
      // 中文註解：非 unpaid 狀態一律跳過，不影響已付款訂單
      if (!order || order.status !== 'unpaid') {
        skipped.push(orderId)
        continue
      }
      // 中文註解：釋放凍結庫存 stock_reserved -= qty（不動實際庫存 stock）
      for (const it of order.items) {
        const sku = await tx.sKUItem.findUnique({ where: { s_id: it.s_id } })
        if (!sku) continue
        await tx.sKUItem.update({
          where: { s_id: it.s_id },
          data: { stock_reserved: Math.max(0, sku.stock_reserved - it.quantity) },
        })
      }
      await tx.order.update({ where: { o_id: orderId }, data: { status: 'cancelled' } })
      released.push(orderId)
    }
  })

  return ok(res, { released: released.length, skipped: skipped.length, releasedIds: released })
})

// 取得全部訂單（後台用，MVP 不做權限）
ordersRouter.get('/all', async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { created_at: 'desc' },
    include: { items: true, user: true },
  })
  return ok(res, orders)
})

// 建立訂單（MVP：用 email 對應 user；榮恩判斷以 email 含 ron 為準）
ordersRouter.post('/', async (req, res) => {
  const body = req.body as Partial<{
    email: string
    shipping_address: string
    shipping_method: string
    payment_method: string
    coupon_code?: string
    coupon_discount_knut?: number  // 中文註解：優惠券實際折扣金額（Knut），存入 discount_snapshot 供 AC-24
    idempotency_key?: string       // 中文註解：冪等鍵，相同 key 重複送出時直接回傳既有訂單
    items: Array<{
      sku_id: string
      quantity: number
      unit_price_knut: number
      snapshot_name: string
      snapshot_spec: string
      snapshot_image_url?: string
    }>
  }>

  // 中文註解：等冪檢查 — 若此 key 已對應到一筆訂單，直接回傳，不重複建立（防止網路重試 / 連點）
  const idempotency_key = body.idempotency_key?.trim() || undefined
  if (idempotency_key) {
    const existing = await prisma.order.findUnique({
      where: { idempotency_key },
      include: { items: true, user: true },
    })
    if (existing) return ok(res, existing)
  }

  const email = body.email?.trim()
  if (!email || !email.includes('@')) {
    return fail(res, 400, 'INVALID_EMAIL', '貓頭鷹找不到這個魔法信箱格式')
  }
  if (!body.shipping_address?.trim()) {
    return fail(res, 400, 'INTERNAL_ERROR', '收件地址不可為空')
  }
  if (!body.items?.length) {
    return fail(res, 400, 'INTERNAL_ERROR', '訂單明細不可為空')
  }

  const isRon = email.toLowerCase().includes('ron')

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      auth_provider: 'local',
      user_level: isRon ? 'ron' : 'normal',
      display_name: email.split('@')[0],
    },
    update: {
      user_level: isRon ? 'ron' : undefined,
    },
  })

  // 中文註解：庫存檢查與扣減 — 訂單成立即刻扣除實際庫存（所有付款方式一律如此）
  // stock -= qty：實際庫存立刻減少，前台商品頁即時反映
  // stock_reserved += qty（非 COD）：凍結庫存，確認付款時再釋放
  const result = await prisma.$transaction(async (tx) => {
    let subtotal = 0
    const isCOD = body.payment_method === 'cash_on_delivery'

    for (const it of body.items!) {
      const qty = Number(it.quantity ?? 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        throw Object.assign(new Error('INVALID_QUANTITY'), { code: 'INVALID_QUANTITY' as const })
      }

      const sku = await tx.sKUItem.findUnique({ where: { s_id: it.sku_id } })
      if (!sku) {
        throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { code: 'PRODUCT_NOT_FOUND' as const })
      }

      // 中文註解：可用庫存 = 實際庫存（已在本次交易中直接扣減，不再用 reserved 判斷）
      if (sku.stock < qty) {
        throw Object.assign(new Error('OUT_OF_STOCK'), {
          code: 'OUT_OF_STOCK' as const,
          detail: { skuId: it.sku_id, requested: qty, available: sku.stock },
        })
      }

      // 中文註解：所有訂單成立時立刻扣實際庫存；非 COD 另外增加凍結量（待付款確認時釋放）
      await tx.sKUItem.update({
        where: { s_id: it.sku_id },
        data: {
          stock: sku.stock - qty,
          ...(!isCOD ? { stock_reserved: sku.stock_reserved + qty } : {}),
        },
      })

      subtotal += Number(it.unit_price_knut ?? 0) * qty
    }

    const shippingFee = 0 // 中文註解：運費在前端計算也可；此處 MVP 先不寫入獨立欄位
    const total = isRon ? (subtotal + shippingFee) * 2 : subtotal + shippingFee

    const order = await tx.order.create({
      data: {
        u_id: user.u_id,
        status: isCOD ? 'processing' : 'unpaid',
        total_knut: total,
        shipping_method: (body.shipping_method ?? 'instant') as never,
        payment_method: (body.payment_method ?? 'vault_transfer') as never,
        shipping_address: body.shipping_address!.trim(),
        is_ron: isRon,
        idempotency_key: idempotency_key ?? null,  // 中文註解：寫入冪等鍵供後續重試比對
        // 中文註解：折扣快照——即使優惠券事後被刪除，訂單明細仍可完整重建折扣資訊（AC-24）
        discount_snapshot: body.coupon_code
          ? { code: body.coupon_code, discountKnut: Number(body.coupon_discount_knut ?? 0) }
          : null,
        items: {
          create: body.items!.map((it) => ({
            s_id: it.sku_id,
            quantity: Number(it.quantity),
            unit_price_knut: it.unit_price_knut ?? 0,
            snapshot_name: it.snapshot_name ?? '',
            snapshot_spec: it.snapshot_spec ?? '',
            snapshot_image_url: it.snapshot_image_url ?? null,
          })),
        },
      },
      include: { items: true },
    })

    // 中文註解：寫入庫存異動紀錄（所有付款方式皆在訂單成立時記錄）
    for (const it of body.items!) {
      await tx.stockLog.create({
        data: {
          s_id: it.sku_id,
          change_qty: -Number(it.quantity),
          reason: 'order_placed',
          related_order_id: order.o_id,
          note: `訂單成立扣庫存：${it.snapshot_name || ''} × ${it.quantity}`,
        },
      })
    }

    // 中文註解：COD 訂單直接進 processing，記錄付款資訊
    if (isCOD) {
      await tx.order.update({
        where: { o_id: order.o_id },
        data: {
          payment_id: randomUUID(),
          final_captured_amount: order.total_knut,
        },
      })
    }

    return { order, isRon, subtotal }
  })

  return ok(res, result.order, 201)
})

// 模擬付款：unpaid → processing，扣庫存並寫 payment_id / final_captured_amount（中文註解：卡號不入庫）
ordersRouter.post('/:id/payment', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({
    where: { o_id: id },
    include: { items: true },
  })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'unpaid') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許執行此操作')
  }

  await prisma.$transaction(async (tx) => {
    // 中文註解：庫存已在訂單成立時扣除，此處只釋放凍結量（stock_reserved -= qty）
    for (const it of order.items) {
      const sku = await tx.sKUItem.findUnique({ where: { s_id: it.s_id } })
      if (!sku) continue
      await tx.sKUItem.update({
        where: { s_id: it.s_id },
        data: {
          stock_reserved: Math.max(0, sku.stock_reserved - it.quantity),
        },
      })
    }

    await tx.order.update({
      where: { o_id: id },
      data: {
        status: 'processing',
        payment_id: randomUUID(),
        final_captured_amount: order.total_knut,
      },
    })
  })

  return ok(res, { paid: true })
})

// 更新訂單狀態（後台用）
ordersRouter.patch('/:id/status', async (req, res) => {
  const id = req.params.id
  const body = req.body as Partial<{ status: string; tracking_number?: string }>
  const status = body.status as string | undefined
  if (!status) return fail(res, 400, 'INTERNAL_ERROR', '缺少 status')

  const exists = await prisma.order.findUnique({ where: { o_id: id } })
  if (!exists) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')

  const updated = await prisma.order.update({
    where: { o_id: id },
    data: {
      status: status as never,
      ...(body.tracking_number !== undefined ? { tracking_number: body.tracking_number } : {}),
    },
  })
  return ok(res, updated)
})

// 申請退款：processing / shipped / completed → refunding
ordersRouter.post('/:id/refund-request', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')

  const allowedStatuses = ['processing', 'shipped', 'completed']
  if (!allowedStatuses.includes(order.status)) {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單狀態不允許申請退款')
  }

  const updated = await prisma.order.update({
    where: { o_id: id },
    data: { status: 'refunding' },
  })
  return ok(res, updated)
})

// 批准退款：refunding → return_pending（等待用戶寄回商品，庫存待確認退貨後才回補）
ordersRouter.post('/:id/refund-approve', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'refunding') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許執行此操作')
  }

  // 中文註解：批准退款進入「退貨中」，商品尚未入庫，庫存在收到退貨後才回補
  await prisma.order.update({ where: { o_id: id }, data: { status: 'return_pending' } })
  return ok(res, { return_pending: true })
})

// 確認收到退貨：return_pending → refunded，此時才還原庫存並記錄異動
ordersRouter.post('/:id/return-received', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({
    where: { o_id: id },
    include: { items: true },
  })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'return_pending') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許執行此操作')
  }

  await prisma.$transaction(async (tx) => {
    // 中文註解：確認收到退貨，庫存回補，寫入異動紀錄
    for (const it of order.items) {
      const sku = await tx.sKUItem.findUnique({ where: { s_id: it.s_id } })
      if (!sku) continue
      await tx.sKUItem.update({
        where: { s_id: it.s_id },
        data: { stock: sku.stock + it.quantity },
      })
      await tx.stockLog.create({
        data: {
          s_id: it.s_id,
          change_qty: it.quantity,
          reason: 'refund_approved',
          related_order_id: id,
          note: `確認收到退貨，庫存回補 × ${it.quantity}`,
        },
      })
    }
    await tx.order.update({ where: { o_id: id }, data: { status: 'refunded' } })
  })

  return ok(res, { refunded: true })
})

// 拒絕退款：refunding → rejected（退款被拒絕，管理員可再手動轉為 completed）
// 中文註解：reason 為必填，儲存於 refund_reject_reason 欄位，前台顯示給顧客
ordersRouter.post('/:id/refund-reject', async (req, res) => {
  const id = req.params.id
  const body = req.body as Partial<{ reason: string }>
  const reason = body.reason?.trim()
  if (!reason) return fail(res, 400, 'INTERNAL_ERROR', '請填寫拒絕原因')

  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'refunding') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許執行此操作')
  }

  // 中文註解：拒絕退款不還原庫存，狀態改為 rejected；後台可再轉為 completed
  const updated = await prisma.order.update({
    where: { o_id: id },
    data: { status: 'rejected', refund_reject_reason: reason },
  })
  return ok(res, updated)
})

// 標記配送異常：shipped → shipping_failed（貓頭鷹找不到地址）
ordersRouter.post('/:id/shipping-failed', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'shipped') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '僅運送中的訂單可標記為配送異常')
  }

  const updated = await prisma.order.update({
    where: { o_id: id },
    data: { status: 'shipping_failed' },
  })
  return ok(res, updated)
})

// 修改收件地址（僅限 processing 狀態，中文註解：出貨前才允許更改）
ordersRouter.patch('/:id/address', async (req, res) => {
  const id = req.params.id
  const body = req.body as Partial<{ shipping_address: string }>
  const address = body.shipping_address?.trim()
  if (!address) return fail(res, 400, 'INTERNAL_ERROR', '收件地址不可為空')

  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'processing') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '僅備貨中的訂單可修改收件地址')
  }

  const updated = await prisma.order.update({
    where: { o_id: id },
    data: { shipping_address: address },
  })
  return ok(res, updated)
})

// 確認收到商品：shipped → completed（使用者主動確認簽收）
ordersRouter.post('/:id/confirm-receipt', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({ where: { o_id: id } })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'shipped') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許確認收貨')
  }
  const updated = await prisma.order.update({
    where: { o_id: id },
    data: { status: 'completed' },
  })
  return ok(res, updated)
})

// 取消訂單：
//   unpaid → cancelled：釋放凍結庫存（stock_reserved -= qty）
//   processing → cancelled：還原實際庫存（stock += qty）
ordersRouter.post('/:id/cancel', async (req, res) => {
  const id = req.params.id
  const order = await prisma.order.findUnique({
    where: { o_id: id },
    include: { items: true },
  })
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', '找不到此訂單記錄')
  if (order.status !== 'unpaid' && order.status !== 'processing') {
    return fail(res, 409, 'ORDER_STATUS_CONFLICT', '此訂單當前狀態不允許執行此操作')
  }

  await prisma.$transaction(async (tx) => {
    for (const it of order.items) {
      const sku = await tx.sKUItem.findUnique({ where: { s_id: it.s_id } })
      if (!sku) continue
      if (order.status === 'unpaid') {
        // 中文註解：未付款取消——訂單成立時已扣實際庫存，故此處需還原；同時釋放凍結量
        await tx.sKUItem.update({
          where: { s_id: it.s_id },
          data: {
            stock: sku.stock + it.quantity,
            stock_reserved: Math.max(0, sku.stock_reserved - it.quantity),
          },
        })
        await tx.stockLog.create({
          data: {
            s_id: it.s_id,
            change_qty: it.quantity,
            reason: 'order_cancelled',
            related_order_id: id,
            note: `未付款訂單取消還原庫存 × ${it.quantity}`,
          },
        })
      } else {
        // 中文註解：備貨中取消（COD 或已付款），stock_reserved 已在付款確認時清零，只需還原實際庫存
        await tx.sKUItem.update({
          where: { s_id: it.s_id },
          data: { stock: sku.stock + it.quantity },
        })
        await tx.stockLog.create({
          data: {
            s_id: it.s_id,
            change_qty: it.quantity,
            reason: 'order_cancelled',
            related_order_id: id,
            note: `訂單取消還原庫存 × ${it.quantity}`,
          },
        })
      }
    }
    await tx.order.update({ where: { o_id: id }, data: { status: 'cancelled' } })
  })

  return ok(res, { cancelled: true })
})

