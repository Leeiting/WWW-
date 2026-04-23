import { Router } from 'express'
import bcrypt from 'bcryptjs'
import passport from 'passport'
import { prisma } from '../lib/prisma'
import { fail, ok } from '../lib/http'
import { signAccessToken, verifyAccessToken, readAccessToken } from '../lib/auth'

export const authRouter = Router()

const setAccessCookie = (res: any, token: string) => {
  // 中文註解：httpOnly cookie，避免前端 JS 直接讀取（降低 XSS 風險）；maxAge 與 JWT expiresIn 一致（2 小時）
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 中文註解：本機開發先關閉；上線改 true 並全站 https
    maxAge: 2 * 60 * 60 * 1000, // 2 小時（毫秒）
  })
}

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

const hasStrategy = (name: string) => {
  // 中文註解：passport 在沒有設定 client_id/secret 時不會註冊 strategy，避免直接 authenticate 造成 Unknown strategy
  return Boolean((passport as any)._strategy?.(name))
}

const oauthDoneHtml = (type: 'oauth_success' | 'oauth_error', detail?: unknown) => {
  // 中文註解：callback 以 HTML 回應，對 popup 的 opener 發 postMessage，然後自動關閉
  const payload = JSON.stringify({ type, detail })
  const origin = JSON.stringify(frontendOrigin)
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>OAuth</title></head>
  <body>
    <script>
      (function() {
        try {
          if (window.opener) {
            window.opener.postMessage(${payload}, ${origin});
          }
        } catch (e) {}
        window.close();
      })();
    </script>
  </body>
</html>`
}

// 中文註解：將 Prisma 使用者物件轉為前端所需的公開欄位（含頭像、時間戳記）
const toPublicUser = (user: { u_id: string; email: string; user_level: string; avatar_url: string | null; display_name: string | null; created_at: Date; updated_at: Date }) => ({
  u_id: user.u_id,
  email: user.email,
  user_level: user.user_level,
  avatar_url: user.avatar_url,
  display_name: user.display_name,
  created_at: user.created_at.toISOString(),
  updated_at: user.updated_at.toISOString(),
})

authRouter.post('/register', async (req, res) => {
  const body = req.body as Partial<{ email: string; password: string; display_name?: string }>
  const email = body.email?.trim()
  const password = body.password ?? ''

  if (!email || !email.includes('@')) {
    return fail(res, 400, 'INVALID_EMAIL', '貓頭鷹找不到這個魔法信箱格式')
  }
  if (password.length < 6) {
    return fail(res, 400, 'INTERNAL_ERROR', '密碼至少 6 碼')
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return fail(res, 409, 'DUPLICATE_EMAIL', '此魔法信箱已被其他巫師註冊')
  }

  const isRon = email.toLowerCase().includes('ron')
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: hash,
      auth_provider: 'local',
      user_level: isRon ? 'ron' : 'normal',
      display_name: body.display_name?.trim() || email.split('@')[0],
    },
  })

  const token = signAccessToken({ u_id: user.u_id, email: user.email, user_level: user.user_level })
  setAccessCookie(res, token)
  return ok(res, toPublicUser(user))
})

authRouter.post('/login', async (req, res) => {
  const body = req.body as Partial<{ email: string; password: string }>
  const email = body.email?.trim()
  const password = body.password ?? ''

  if (!email || !email.includes('@')) {
    return fail(res, 400, 'INVALID_EMAIL', '貓頭鷹找不到這個魔法信箱格式')
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password_hash) {
    return fail(res, 401, 'UNAUTHORIZED', '請先登入您的魔法帳號')
  }

  const okPw = await bcrypt.compare(password, user.password_hash)
  if (!okPw) {
    return fail(res, 401, 'WRONG_PASSWORD', '密碼錯誤，請再試一次')
  }

  const isRon = email.toLowerCase().includes('ron')
  if (isRon && user.user_level !== 'ron') {
    await prisma.user.update({ where: { u_id: user.u_id }, data: { user_level: 'ron' } })
  }

  const token = signAccessToken({ u_id: user.u_id, email: user.email, user_level: isRon ? 'ron' : user.user_level })
  setAccessCookie(res, token)
  return ok(res, toPublicUser({ ...user, user_level: isRon ? 'ron' : user.user_level }))
})

authRouter.post('/logout', async (_req, res) => {
  res.clearCookie('access_token')
  return ok(res, { loggedOut: true })
})

authRouter.get('/me', async (req, res) => {
  const token = readAccessToken(req)
  if (!token) return ok(res, null)
  try {
    const payload = verifyAccessToken(token)
    // 中文註解：從 DB 撈完整使用者資料（含頭像 URL 與時間戳記），而非只回傳 JWT payload
    const user = await prisma.user.findUnique({ where: { u_id: payload.u_id } })
    if (!user) return ok(res, null)
    return ok(res, toPublicUser(user))
  } catch {
    return ok(res, null)
  }
})

// ── Google OAuth ──
authRouter.get('/google', (req, res, next) => {
  if (!hasStrategy('google')) {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    return res.status(200).send(oauthDoneHtml('oauth_error', { provider: 'google', reason: 'not_configured' }))
  }
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})
authRouter.get(
  '/google/callback',
  (req, res, next) => {
    if (!hasStrategy('google')) return res.redirect('/api/auth/oauth-failed?provider=google&reason=not_configured')
    return passport.authenticate('google', { session: false, failureRedirect: '/api/auth/oauth-failed?provider=google' })(req, res, next)
  },
  async (req, res) => {
    const user = req.user as any
    const token = signAccessToken({ u_id: user.u_id, email: user.email, user_level: user.user_level })
    setAccessCookie(res, token)
    res.setHeader('content-type', 'text/html; charset=utf-8')
    return res.status(200).send(oauthDoneHtml('oauth_success'))
  }
)

// ── Facebook OAuth ──
authRouter.get('/facebook', (req, res, next) => {
  if (!hasStrategy('facebook')) {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    return res.status(200).send(oauthDoneHtml('oauth_error', { provider: 'facebook', reason: 'not_configured' }))
  }
  return passport.authenticate('facebook', { scope: ['email'], session: false })(req, res, next)
})
authRouter.get(
  '/facebook/callback',
  (req, res, next) => {
    if (!hasStrategy('facebook')) return res.redirect('/api/auth/oauth-failed?provider=facebook&reason=not_configured')
    return passport.authenticate('facebook', { session: false, failureRedirect: '/api/auth/oauth-failed?provider=facebook' })(req, res, next)
  },
  async (req, res) => {
    const user = req.user as any
    const token = signAccessToken({ u_id: user.u_id, email: user.email, user_level: user.user_level })
    setAccessCookie(res, token)
    res.setHeader('content-type', 'text/html; charset=utf-8')
    return res.status(200).send(oauthDoneHtml('oauth_success'))
  }
)

authRouter.get('/oauth-failed', async (req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  return res.status(200).send(oauthDoneHtml('oauth_error', { provider: req.query.provider, reason: req.query.reason }))
})

