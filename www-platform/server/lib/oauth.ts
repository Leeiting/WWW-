import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { prisma } from './prisma'

// OAuth 設定（中文註解：MVP 不使用 session，callback 成功後直接發 JWT cookie）
export function setupOAuth() {
  const googleId = process.env.GOOGLE_CLIENT_ID
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET
  const googleCallback = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:5176/api/auth/google/callback'

  if (googleId && googleSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleId,
          clientSecret: googleSecret,
          callbackURL: googleCallback,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value
            if (!email) return done(null, false)

            const isRon = email.toLowerCase().includes('ron')
            const user = await prisma.user.upsert({
              where: { email },
              create: {
                email,
                auth_provider: 'google',
                avatar_url: profile.photos?.[0]?.value ?? null,
                display_name: profile.displayName ?? email.split('@')[0],
                user_level: isRon ? 'ron' : 'normal',
              },
              update: {
                auth_provider: 'google',
                avatar_url: profile.photos?.[0]?.value ?? undefined,
                display_name: profile.displayName ?? undefined,
                user_level: isRon ? 'ron' : undefined,
              },
            })
            return done(null, user)
          } catch (e) {
            return done(e as Error)
          }
        }
      )
    )
  }

  const fbId = process.env.FACEBOOK_APP_ID
  const fbSecret = process.env.FACEBOOK_APP_SECRET
  const fbCallback = process.env.FACEBOOK_CALLBACK_URL ?? 'http://localhost:5176/api/auth/facebook/callback'

  if (fbId && fbSecret) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: fbId,
          clientSecret: fbSecret,
          callbackURL: fbCallback,
          profileFields: ['id', 'displayName', 'photos', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = (profile.emails?.[0] as any)?.value as string | undefined
            // 中文註解：Facebook 可能拿不到 email（使用者未授權或無 email）
            if (!email) return done(null, false)

            const isRon = email.toLowerCase().includes('ron')
            const user = await prisma.user.upsert({
              where: { email },
              create: {
                email,
                auth_provider: 'facebook',
                avatar_url: profile.photos?.[0]?.value ?? null,
                display_name: profile.displayName ?? email.split('@')[0],
                user_level: isRon ? 'ron' : 'normal',
              },
              update: {
                auth_provider: 'facebook',
                avatar_url: profile.photos?.[0]?.value ?? undefined,
                display_name: profile.displayName ?? undefined,
                user_level: isRon ? 'ron' : undefined,
              },
            })
            return done(null, user)
          } catch (e) {
            return done(e as Error)
          }
        }
      )
    )
  }

  return passport
}

