import type { Response } from 'express'

export type ApiErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_QUANTITY'
  | 'COUPON_EXPIRED'
  | 'COUPON_MIN_SPEND'
  | 'COUPON_MAX_USES'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'PRODUCT_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'DUPLICATE_EMAIL'
  | 'ORDER_STATUS_CONFLICT'
  | 'PAYMENT_FAILED'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR'
  | 'STATIONERY_MODE'

export function ok<T>(res: Response, body: T, status: 200 | 201 = 200) {
  return res.status(status).json({ success: true, data: body })
}

export function fail(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  detail?: unknown,
) {
  return res.status(status).json({ success: false, code, message, detail })
}

