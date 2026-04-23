import jwt from 'jsonwebtoken'
import type { Request } from 'express'

export type JwtUserPayload = {
  u_id: string
  email: string
  user_level: 'normal' | 'ron' | 'vip' | 'admin'
}

const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret'

export function signAccessToken(payload: JwtUserPayload) {
  // 中文註解：Token 有效期 2 小時；過期後前端會偵測並導向重新登入
  return jwt.sign(payload, accessSecret, { expiresIn: '2h' })
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, accessSecret) as JwtUserPayload
}

export function readAccessToken(req: Request): string | null {
  const cookie = (req as any).cookies?.access_token as string | undefined
  if (cookie) return cookie
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length)
  return null
}

