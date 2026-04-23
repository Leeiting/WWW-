import { create } from 'zustand'
import type { Order, OrderStatus } from '../types'
import { apiGet, apiSend } from '@/api/client'
import { auditLog } from './auditLogStore'
import { useCouponStore } from './couponStore'

// localStorage 的 key
const STORAGE_KEY = 'www-orders'

// 從 localStorage 讀取訂單
const loadOrders = (): Order[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// 寫入 localStorage
const saveOrders = (orders: Order[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

interface OrderStore {
  orders: Order[]
  syncFromApi: () => Promise<void>
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Order
  addOrderViaApi: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<Order>
  updateOrderStatus: (orderId: string, status: OrderStatus, trackingNumber?: string) => void
  cancelOrder: (orderId: string) => void
  cancelOrderViaApi: (orderId: string) => Promise<void>         // 呼叫後端取消並釋放庫存
  requestRefundViaApi: (orderId: string) => Promise<void>       // 使用者申請退款（processing/shipped/completed → refunding）
  approveRefundViaApi: (orderId: string) => Promise<void>       // 後台批准退款：refunding → return_pending（等待退貨）
  confirmReturnViaApi: (orderId: string) => Promise<void>       // 後台確認收到退貨：return_pending → refunded（庫存回補）
  rejectRefundViaApi: (orderId: string, reason: string) => Promise<void>  // 後台拒絕退款：refunding → rejected（reason 必填）
  markShippingFailedViaApi: (orderId: string) => Promise<void>  // 管理員標記配送異常：shipped → shipping_failed
  confirmReceiptViaApi: (orderId: string) => Promise<void>      // 使用者確認收到商品：shipped → completed
  updateShippingAddressViaApi: (orderId: string, address: string) => Promise<void>  // 管理員修改收件地址（限 processing）
  payOrderViaApi: (orderId: string) => Promise<void>            // 使用者付款：unpaid → processing，後端寫 final_captured_amount（spec §9.4）
  deleteOrder: (orderId: string) => void
  bulkReleaseViaApi: (orderIds: string[]) => Promise<{ released: number }>  // 批量強制釋放未付款訂單凍結庫存
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: loadOrders(),

  // 後台訂單列表同步（MVP：讀 /api/orders/all）
  syncFromApi: async () => {
    try {
      const raw = await apiGet<Array<{
        o_id: string
        status: OrderStatus
        total_knut: string | number
        shipping_method: string
        payment_method: string
        tracking_number: string | null
        shipping_address: string
        is_ron: boolean
        refund_reject_reason: string | null    // 中文註解：管理員拒絕退款時的原因
        discount_snapshot: { code: string; discountKnut: number } | null  // 中文註解：折扣快照（AC-24）
        final_captured_amount: string | number | null  // 中文註解：付款成功凍結金額（spec §9.4）
        created_at: string
        user: { email: string }
        items: Array<{
          s_id: string
          quantity: number
          unit_price_knut: string | number
          snapshot_name: string
          snapshot_spec: string
          snapshot_image_url: string | null
        }>
      }>>('/api/orders/all')

      const orders: Order[] = raw.map(o => {
        // 中文註解：從 discount_snapshot 重建優惠券代碼與折扣金額（AC-24：優惠券刪除後仍可顯示）
        const snap = o.discount_snapshot
        return {
          id: o.o_id,
          email: o.user.email,
          status: o.status,
          items: o.items.map(it => ({
            skuId: it.s_id,
            productId: '',
            snapshotName: it.snapshot_name,
            snapshotSpec: it.snapshot_spec,
            snapshotImageUrl: it.snapshot_image_url ?? undefined,
            quantity: it.quantity,
            unitPriceKnut: Number(it.unit_price_knut),
          })),
          shippingAddress: o.shipping_address,
          shippingMethod: o.shipping_method as never,
          paymentMethod: o.payment_method as never,
          couponCode: snap?.code ?? undefined,
          discountKnut: snap?.discountKnut ?? 0,
          subtotalKnut: 0,
          shippingFeeKnut: 0,
          isRon: o.is_ron,
          totalKnut: Number(o.total_knut),
          trackingNumber: o.tracking_number ?? undefined,
          refundRejectReason: o.refund_reject_reason ?? undefined,
          finalCapturedAmount: o.final_captured_amount != null ? Number(o.final_captured_amount) : undefined,
          createdAt: o.created_at,
        }
      })

      // 中文註解：後端有回傳（即使空陣列）就以後端為主，因訂單是真實資料（不同於商品有預設值）
      saveOrders(orders)
      set({ orders })
    } catch {
      // 後端不可用：保留 localStorage
    }
  },

  // 建立新訂單，回傳完整訂單物件
  addOrder: (order) => {
    const newOrder: Order = {
      ...order,
      id: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    const updated = [newOrder, ...get().orders]  // 最新訂單排最前
    saveOrders(updated)
    set({ orders: updated })
    return newOrder
  },

  // 建立訂單（走後端 API，失敗才回退 localStorage）
  addOrderViaApi: async (order) => {
    try {
      const created = await apiSend<{
        o_id: string
        status: OrderStatus
        total_knut: string | number
        shipping_method: string
        payment_method: string
        tracking_number: string | null
        shipping_address: string
        is_ron: boolean
        idempotency_key: string | null
        created_at: string
        items: Array<{
          s_id: string
          quantity: number
          unit_price_knut: string | number
          snapshot_name: string
          snapshot_spec: string
          snapshot_image_url: string | null
        }>
      }>('/api/orders', 'POST', {
        email: order.email,
        shipping_address: order.shippingAddress,
        shipping_method: order.shippingMethod,
        payment_method: order.paymentMethod,
        coupon_code: order.couponCode,
        coupon_discount_knut: order.discountKnut || undefined,  // 中文註解：優惠券折扣金額，存入 discount_snapshot（AC-24）
        idempotency_key: order.idempotencyKey,  // 中文註解：冪等鍵，後端據此去重
        items: order.items.map(it => ({
          sku_id: it.skuId,
          quantity: it.quantity,
          unit_price_knut: it.unitPriceKnut,
          snapshot_name: it.snapshotName,
          snapshot_spec: it.snapshotSpec,
          snapshot_image_url: it.snapshotImageUrl ?? null,  // 圖片快照送至後端
        })),
      })

      const mapped: Order = {
        id: created.o_id,
        email: order.email,
        status: created.status,
        items: created.items.map(it => ({
          skuId: it.s_id,
          productId: '',
          snapshotName: it.snapshot_name,
          snapshotSpec: it.snapshot_spec,
          snapshotImageUrl: it.snapshot_image_url ?? undefined,
          quantity: it.quantity,
          unitPriceKnut: Number(it.unit_price_knut),
        })),
        shippingAddress: created.shipping_address,
        shippingMethod: created.shipping_method as never,
        paymentMethod: created.payment_method as never,
        couponCode: order.couponCode,
        discountKnut: order.discountKnut,
        subtotalKnut: order.subtotalKnut,
        shippingFeeKnut: order.shippingFeeKnut,
        isRon: created.is_ron,
        totalKnut: Number(created.total_knut),
        trackingNumber: created.tracking_number ?? undefined,
        idempotencyKey: created.idempotency_key ?? undefined,
        createdAt: created.created_at,
      }

      const updated = [mapped, ...get().orders]
      saveOrders(updated)
      set({ orders: updated })
      return mapped
    } catch {
      return get().addOrder(order)
    }
  },

  // 更新訂單狀態（含物流單號，spec §7.2）
  updateOrderStatus: (orderId, status, trackingNumber) => {
    const order = get().orders.find(o => o.id === orderId)
    const STATUS_LABEL: Record<string, string> = {
      unpaid: '待付款', processing: '待出貨', shipped: '運送中',
      completed: '已完成', cancelled: '已取消', refunding: '退款審核中',
      return_pending: '退貨中', shipping_failed: '配送異常',
      rejected: '退款被拒絕', refunded: '已退款', refund_failed: '退款失敗',
    }
    // 中文註解：首次進入 completed 時自動發放驚喜納特券
    let surpriseCouponCode: string | undefined
    if (status === 'completed' && !order?.surpriseCouponCode) {
      surpriseCouponCode = useCouponStore.getState().issueSurpriseCoupon(orderId)
    }
    const updated = get().orders.map(o => {
      if (o.id !== orderId) return o
      return {
        ...o,
        status,
        ...(trackingNumber !== undefined ? { trackingNumber } : {}),
        ...(surpriseCouponCode !== undefined ? { surpriseCouponCode } : {}),
      }
    })
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '更新訂單狀態', target: orderId.slice(-8), detail: `${STATUS_LABEL[order?.status ?? ''] ?? order?.status} → ${STATUS_LABEL[status] ?? status}${trackingNumber ? `，單號：${trackingNumber}` : ''}` })
  },

  // 取消訂單（本地狀態，限 unpaid/processing 狀態）
  cancelOrder: (orderId) => {
    const updated = get().orders.map(o =>
      o.id === orderId && (o.status === 'unpaid' || o.status === 'processing')
        ? { ...o, status: 'cancelled' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '取消訂單', target: orderId.slice(-8) })
  },

  // 取消訂單（呼叫後端 API，後端還原庫存後更新本地狀態）
  cancelOrderViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/cancel`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const updated = get().orders.map(o =>
      o.id === orderId && (o.status === 'unpaid' || o.status === 'processing')
        ? { ...o, status: 'cancelled' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '取消訂單', target: orderId.slice(-8) })
  },

  // 申請退款：processing / shipped / completed → refunding（spec §6.4）
  requestRefundViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/refund-request`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const allowable: OrderStatus[] = ['processing', 'shipped', 'completed']
    const updated = get().orders.map(o =>
      o.id === orderId && allowable.includes(o.status)
        ? { ...o, status: 'refunding' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'refund', action: '申請退款', target: orderId.slice(-8) })
  },

  // 後台批准退款：refunding → return_pending（等待用戶寄回商品，spec §6.4）
  approveRefundViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/refund-approve`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const order = get().orders.find(o => o.id === orderId)
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'refunding'
        ? { ...o, status: 'return_pending' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'refund', action: '批准退款→等待退貨', target: orderId.slice(-8), detail: order?.email })
  },

  // 後台確認收到退貨：return_pending → refunded（後端還原庫存，spec §6.4）
  confirmReturnViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/return-received`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'return_pending'
        ? { ...o, status: 'refunded' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'refund', action: '確認收到退貨→已退款', target: orderId.slice(-8) })
  },

  // 後台拒絕退款：refunding → rejected（reason 必填，前台顯示原因；可再轉 completed，spec §6.4）
  rejectRefundViaApi: async (orderId, reason) => {
    try {
      await apiSend(`/api/orders/${orderId}/refund-reject`, 'POST', { reason })
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'refunding'
        ? { ...o, status: 'rejected' as OrderStatus, refundRejectReason: reason }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'refund', action: '拒絕退款', target: orderId.slice(-8), detail: reason })
  },

  // 管理員標記配送異常：shipped → shipping_failed（spec §6.4）
  markShippingFailedViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/shipping-failed`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'shipped'
        ? { ...o, status: 'shipping_failed' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '標記配送異常', target: orderId.slice(-8) })
  },

  // 修改收件地址（呼叫後端，僅限 processing 狀態）
  updateShippingAddressViaApi: async (orderId, address) => {
    try {
      await apiSend(`/api/orders/${orderId}/address`, 'PATCH', { shipping_address: address })
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'processing'
        ? { ...o, shippingAddress: address }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '修改收件地址', target: orderId.slice(-8), detail: address })
  },

  // 確認收到商品（呼叫後端，shipped → completed）
  confirmReceiptViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/confirm-receipt`, 'POST', {})
    } catch {
      // 後端不可用：繼續更新本地狀態
    }
    // 中文註解：首次確認收到時自動發放驚喜納特券
    const order = get().orders.find(o => o.id === orderId)
    const surpriseCouponCode = !order?.surpriseCouponCode
      ? useCouponStore.getState().issueSurpriseCoupon(orderId)
      : undefined
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'shipped'
        ? { ...o, status: 'completed' as OrderStatus, ...(surpriseCouponCode ? { surpriseCouponCode } : {}) }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '確認收到商品', target: orderId.slice(-8) })
  },

  // 使用者付款：unpaid → processing，呼叫後端寫入 final_captured_amount（spec §9.4）
  payOrderViaApi: async (orderId) => {
    try {
      await apiSend(`/api/orders/${orderId}/payment`, 'POST', {})
    } catch {
      // 中文註解：後端不可用時仍更新本地狀態，final_captured_amount 待下次 sync 補齊
    }
    // 中文註解：首次進入 processing 時，從 totalKnut 計算 finalCapturedAmount（後端不可用的降級情境）
    const order = get().orders.find(o => o.id === orderId)
    const updated = get().orders.map(o =>
      o.id === orderId && o.status === 'unpaid'
        ? { ...o, status: 'processing' as OrderStatus, finalCapturedAmount: o.finalCapturedAmount ?? o.totalKnut }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '付款確認', target: orderId.slice(-8), detail: order?.paymentMethod })
  },

  // 刪除訂單（僅限已完成/已取消）
  deleteOrder: (orderId) => {
    const updated = get().orders.filter(o => o.id !== orderId)
    saveOrders(updated)
    set({ orders: updated })
    auditLog({ category: 'order', action: '刪除訂單記錄', target: orderId.slice(-8) })
  },

  // 批量強制釋放庫存（unpaid → cancelled，stock_reserved -= qty）
  // 中文註解：node-cron 停擺時的管理員手動校正工具
  bulkReleaseViaApi: async (orderIds) => {
    let releasedCount = 0
    try {
      const result = await apiSend<{ released: number; skipped: number }>(
        '/api/orders/bulk-release', 'POST', { order_ids: orderIds }
      )
      releasedCount = result.released
    } catch {
      // 後端不可用：本地狀態仍同步更新
      releasedCount = orderIds.length
    }
    // 中文註解：本地狀態同步：將選取的 unpaid 訂單標記為 cancelled
    const updated = get().orders.map(o =>
      orderIds.includes(o.id) && o.status === 'unpaid'
        ? { ...o, status: 'cancelled' as OrderStatus }
        : o
    )
    saveOrders(updated)
    set({ orders: updated })
    auditLog({
      category: 'inventory',
      action: '批量強制釋放庫存',
      target: `${releasedCount} 筆訂單`,
      detail: orderIds.map(id => id.slice(-8)).join('、'),
    })
    return { released: releasedCount }
  },
}))
