import { randomBytes } from 'node:crypto'

export const port = Number(process.env.PORT || 5000)
export const jwtSecret =
  process.env.JWT_SECRET || 'miller-pay-local-secret-change-before-production'

export const allowedOrigins = [
  process.env.USER_APP_URL,
  process.env.ADMIN_APP_URL,
  process.env.PUBLIC_APP_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://millerpay-app.online',
  'https://www.millerpay-app.online',
  'https://admin.millerpay-app.online',
  'https://millerpay.vercel.app',
].filter(Boolean)

export const localNetworkOrigin =
  /^http:\/\/(?:(?:10(?:\.\d{1,3}){3})|(?:192\.168(?:\.\d{1,3}){2})|(?:172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}))(?::5173|:5174)$/

export const adminIdentity = {
  email: process.env.ADMIN_EMAIL || 'admin@local.invalid',
  password: process.env.ADMIN_PASSWORD || randomBytes(32).toString('hex'),
}
