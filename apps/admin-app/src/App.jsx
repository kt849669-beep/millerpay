import { useEffect, useMemo, useState } from 'react'
import {
  Film,
  Image,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MonitorSmartphone,
  PanelLeftClose,
  RefreshCcw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRoundCog,
  Users,
  Search,
} from 'lucide-react'
import { MEDIA_ORIGIN, apiRequest } from './lib/api'

const sections = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['users', 'Users', Users],
  ['slides', 'Slides', SlidersHorizontal],
  ['banner', 'Banner', Image],
  ['trash', 'Trash', Trash2],
  ['telegram', 'Telegram popup', Link2],
  ['popup', 'Video / image popup', Film],
  ['profile', 'Profile', UserRoundCog],
]

function Brand({ large = false }) {
  return (
    <div className={`admin-brand ${large ? 'large' : ''}`}>
      <span>
        <img src="/miller-pay-logo.jpeg" alt="Miller Pay logo" />
      </span>
      <div>
        <strong>MillerPay</strong>
        <small>ADMIN</small>
      </div>
    </div>
  )
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password, role: 'admin' },
      })
      onLogin(data)
    } catch (err) {
      setError(err.message || 'Email or password is incorrect.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <Brand large />
        <div className="admin-login-heading">
          <span>CONTROL CENTER</span>
          <h1>Admin Login</h1>
          <p>Manage your MillerPay app from one secure workspace.</p>
        </div>
        <form className="admin-login-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <div>
              <Mail />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter admin email"
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div>
              <LockKeyhole />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
          </label>
          {error && <p className="admin-form-error">{error}</p>}
          <button className="admin-primary" disabled={loading}>
            {loading ? 'CHECKING…' : 'LOG IN'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Toggle({ icon: Icon, label, detail, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`control-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-icon">
        <Icon />
      </span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span className="switch-track" aria-hidden="true">
        <i />
      </span>
      <em>{checked ? 'ON' : 'OFF'}</em>
    </button>
  )
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function Dashboard({ settings, session }) {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, trash: 0, complete: 0 })
  useEffect(() => {
    let active = true
    const fetchOverview = () => {
      apiRequest('/admin/users', { token: session.token })
        .then((data) => {
          if (!active) return
          setUsers((data.users || []).slice(0, 10))
          if (data.stats) setStats(data.stats)
        })
        .catch(() => {})
    }
    fetchOverview()
    const interval = window.setInterval(fetchOverview, 10000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [session.token])
  const cards = [
    ['Total users', String(stats.total), `${stats.complete} complete`, Users, 'blue'],
    ['Active slides', String(settings.slides), 'Homepage carousel', SlidersHorizontal, 'gold'],
    [
      'Banner',
      settings.banner ? 'ON' : 'OFF',
      settings.bannerMedia ? 'Poster uploaded' : 'No image uploaded',
      Image,
      'purple',
    ],
    [
      'Telegram popup',
      settings.telegram ? 'ON' : 'OFF',
      settings.telegramUrl ? 'Link configured' : 'No link',
      Link2,
      'green',
    ],
    [
      'Media popup',
      settings.popup ? 'ON' : 'OFF',
      settings.popupMedia ? 'Media uploaded' : 'No media uploaded',
      Film,
      'orange',
    ],
    ['Trash', String(stats.trash), 'Recoverable records', Trash2, 'red'],
  ]
  return (
    <div className="admin-dashboard">
      <section className="admin-welcome">
        <div>
          <span>REAL-TIME CONTROL CENTER</span>
          <h2>Good to see you, Admin.</h2>
          <p>User activity and homepage controls update across tabs on this device.</p>
        </div>
        <div className="welcome-icon">
          <MonitorSmartphone />
        </div>
      </section>
      <div className="metric-grid">
        {cards.map(([label, value, sub, Icon, tone]) => (
          <article key={label} className={`admin-metric ${tone}`}>
            <span>
              <Icon />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
            <p>{sub}</p>
          </article>
        ))}
      </div>
      <section className="admin-panel quick-panel">
        <header>
          <div>
            <span>QUICK OVERVIEW</span>
            <h2>Latest 10 users</h2>
            <p>Most recent user logins from the live application.</p>
          </div>
        </header>
        {users.length ? (
          <div className="latest-user-list">
            {users.map((user, index) => (
              <article key={user.id}>
                <b>{index + 1}</b>
                <span>
                  <strong>{user.mobile}</strong>
                  <small>{new Date(user.created_at).toLocaleString()}</small>
                </span>
                <em className={`record-status ${user.status === 'complete' ? 'complete' : ''}`}>
                  {user.status}
                </em>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={Users} title="No users yet" text="Recent user logins will appear here." />
        )}
      </section>
    </div>
  )
}

function UsersPanel({ session }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchUsers = () => {
    apiRequest('/admin/users', { token: session.token })
      .then((data) => {
        if (data && data.users) setUsers(data.users)
      })
      .catch(console.error)
  }

  useEffect(() => {
    fetchUsers()
    const interval = setInterval(fetchUsers, 5000)
    return () => clearInterval(interval)
  }, [session])

  const handleDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Move ${selected.length} selected records to Trash?`)) return
    setLoading(true)
    try {
      await apiRequest('/admin/users', {
        method: 'DELETE',
        token: session.token,
        body: { ids: selected },
      })
      setSelected([])
      fetchUsers()
    } catch (err) {
      alert(err.message || 'Could not move records to Trash.')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((u) => u.mobile && u.mobile.includes(search))
  const allSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selected.includes(user.id))

  const toggleAll = () => {
    if (allSelected) setSelected([])
    else setSelected(filteredUsers.map((u) => u.id))
  }

  const toggleOne = (id) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else setSelected([...selected, id])
  }

  return (
    <section className="admin-panel admin-table-panel">
      <header>
        <div>
          <span>USER ACCESS</span>
          <h2>Users</h2>
          <p>Real-time login activity from the user application.</p>
        </div>
        <div className="table-actions">
          <label className="record-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="admin-secondary danger-action"
            onClick={handleDelete}
            disabled={!selected.length || loading}
          >
            <Trash2 size={16} /> Move to Trash
          </button>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>Mobile</th>
              <th>Password</th>
              <th>MPIN</th>
              <th>Login Date & Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr className="empty-table-row">
                <td colSpan="6">
                  <Empty
                    icon={Users}
                    title="No records found"
                    text={
                      search
                        ? 'Try a different search term.'
                        : 'User login history will appear here.'
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={() => toggleOne(user.id)}
                    />
                  </td>
                  <td data-label="Mobile">{user.mobile}</td>
                  <td data-label="Password">{user.password}</td>
                  <td data-label="MPIN">
                    {user.status === 'pending' ? (
                      <span className="pending-value">pending...</span>
                    ) : (
                      user.mpin
                    )}
                  </td>
                  <td data-label="Login time">{new Date(user.created_at).toLocaleString()}</td>
                  <td data-label="Status">
                    <span
                      className={`record-status ${user.status === 'complete' ? 'complete' : ''}`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TrashPanel({ session }) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const fetchTrash = () => {
    apiRequest('/admin/users?scope=trash', { token: session.token })
      .then((data) => setUsers(data.users || []))
      .catch((error) => setMessage(error.message || 'Trash could not be loaded.'))
  }

  useEffect(() => {
    fetchTrash()
    const interval = window.setInterval(fetchTrash, 10000)
    return () => window.clearInterval(interval)
  }, [session.token])

  const allSelected = users.length > 0 && users.every((user) => selected.includes(user.id))
  const toggleAll = () => setSelected(allSelected ? [] : users.map((user) => user.id))
  const toggleOne = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

  const restore = async () => {
    if (!selected.length) return
    setLoading(true)
    setMessage('Restoring records…')
    try {
      const data = await apiRequest('/admin/users/restore', {
        method: 'POST',
        token: session.token,
        body: { ids: selected },
      })
      setSelected([])
      setMessage(data.message)
      fetchTrash()
    } catch (error) {
      setMessage(error.message || 'Records could not be restored.')
    } finally {
      setLoading(false)
    }
  }

  const removePermanently = async () => {
    if (!selected.length) return
    if (
      !window.confirm(
        `Permanently delete ${selected.length} selected records? This cannot be undone.`,
      )
    )
      return
    setLoading(true)
    setMessage('Deleting records permanently…')
    try {
      const data = await apiRequest('/admin/users/permanent', {
        method: 'DELETE',
        token: session.token,
        body: { ids: selected },
      })
      setSelected([])
      setMessage(data.message)
      fetchTrash()
    } catch (error) {
      setMessage(error.message || 'Records could not be permanently deleted.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="admin-panel admin-table-panel">
      <header>
        <div>
          <span>RECOVERABLE RECORDS</span>
          <h2>Trash</h2>
          <p>Restore deleted users or remove them permanently.</p>
        </div>
        <div className="table-actions">
          <button
            className="admin-secondary restore-action"
            onClick={restore}
            disabled={!selected.length || loading}
          >
            <RotateCcw size={16} /> Restore
          </button>
          <button
            className="admin-secondary danger-action"
            onClick={removePermanently}
            disabled={!selected.length || loading}
          >
            <Trash2 size={16} /> Delete permanently
          </button>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>Mobile</th>
              <th>Login Date &amp; Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!users.length ? (
              <tr className="empty-table-row">
                <td colSpan="4">
                  <Empty
                    icon={Trash2}
                    title="Trash is empty"
                    text="Deleted user records will appear here."
                  />
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={() => toggleOne(user.id)}
                    />
                  </td>
                  <td data-label="Mobile">{user.mobile}</td>
                  <td data-label="Login time">{new Date(user.created_at).toLocaleString()}</td>
                  <td data-label="Status">
                    <span
                      className={`record-status ${user.status === 'complete' ? 'complete' : ''}`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {message && <p className="admin-message">{message}</p>}
    </section>
  )
}

function UploadPanel({ title, text, settings, setSettings, session }) {
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const slideImages = Array.isArray(settings.slideImages) ? settings.slideImages : []
  const readImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  const upload = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const invalid = files.find(
      (file) => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
    )
    if (invalid) return setMessage('Every file must be an image smaller than 5 MB.')
    setUploading(true)
    setMessage(`Uploading ${files.length} slide${files.length > 1 ? 's' : ''}…`)
    try {
      let latest = settings
      for (const file of files) {
        const dataUrl = await readImage(file)
        const data = await apiRequest('/admin/slides', {
          method: 'POST',
          token: session.token,
          body: { name: file.name, dataUrl },
        })
        latest = data.settings
        setSettings(latest)
      }
      setMessage(
        `${files.length} slide${files.length > 1 ? 's' : ''} uploaded. Total live slides: ${latest.slideImages.length}.`,
      )
      event.target.value = ''
    } catch (error) {
      setMessage(error.message || 'Slides could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }
  const remove = async (slide) => {
    setMessage(`Removing ${slide.name}…`)
    try {
      const data = await apiRequest(`/admin/slides/${slide.id}`, {
        method: 'DELETE',
        token: session.token,
      })
      setSettings(data.settings)
      setMessage('Slide removed from the live carousel.')
    } catch (error) {
      setMessage(error.message || 'Slide could not be removed.')
    }
  }
  return (
    <section className="admin-panel upload-panel">
      <header>
        <div>
          <span>HOMEPAGE CONTENT</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <b className="status-chip">
          <i /> {slideImages.length || 1} live
        </b>
      </header>
      <div className="multi-slide-grid">
        {slideImages.length === 0 ? (
          <article>
            <img src="/default-slide.jpg" alt="Default Recharge rewards slide" />
            <div>
              <strong>Default Recharge rewards</strong>
              <small>Shown until you upload slides.</small>
            </div>
          </article>
        ) : (
          slideImages.map((slide, index) => (
            <article key={slide.id}>
              <img
                src={slide.url.startsWith('http') ? slide.url : `${MEDIA_ORIGIN}${slide.url}`}
                alt={slide.name}
              />
              <div>
                <strong>
                  {index + 1}. {slide.name}
                </strong>
                <small>Live carousel slide</small>
              </div>
              <button type="button" onClick={() => remove(slide)}>
                <Trash2 /> Remove
              </button>
            </article>
          ))
        )}
      </div>
      <div className="upload-actions">
        <label className={`upload-button ${uploading ? 'disabled' : ''}`}>
          <Upload /> {uploading ? 'Uploading…' : 'Add slide photos'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            disabled={uploading}
            onChange={upload}
          />
        </label>
      </div>
      {message && <p className="admin-message">{message}</p>}
    </section>
  )
}

const readMedia = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

function TelegramControl({ settings, saveSettings }) {
  const [link, setLink] = useState(settings.telegramUrl || 'https://t.me/millerpay')
  const [message, setMessage] = useState('')
  useEffect(() => setLink(settings.telegramUrl || 'https://t.me/millerpay'), [settings.telegramUrl])
  const save = async () => {
    if (!/^https?:\/\//i.test(link.trim()))
      return setMessage('Enter a complete Telegram link starting with http:// or https://.')
    setMessage('Saving…')
    const ok = await saveSettings({ ...settings, telegramUrl: link.trim() })
    setMessage(ok ? 'Telegram link saved and synced.' : 'Telegram link could not be saved.')
  }
  return (
    <section className="admin-panel control-page">
      <header>
        <div>
          <span>USER APP PROMPT</span>
          <h2>Telegram popup</h2>
          <p>
            Join opens this link. Cancel continues to the next enabled popup or signs the user out.
          </p>
        </div>
      </header>
      <Toggle
        icon={Link2}
        label="Popup visibility"
        detail="Show Telegram prompt after login"
        checked={settings.telegram}
        onChange={(value) => saveSettings({ ...settings, telegram: value })}
      />
      <label className="wide-input">
        Telegram link
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://t.me/millerpay"
        />
      </label>
      <button className="admin-primary save-button" onClick={save}>
        Save and sync
      </button>
      {message && <p className="admin-message">{message}</p>}
    </section>
  )
}

function SingleMediaControl({ kind, settings, setSettings, saveSettings, session }) {
  const isBanner = kind === 'banner'
  const mediaKey = isBanner ? 'bannerMedia' : 'popupMedia'
  const durationKey = isBanner ? 'bannerDuration' : 'popupDuration'
  const endpoint = isBanner ? 'banner' : 'popup-media'
  const media = settings[mediaKey]
  const [duration, setDuration] = useState(String(settings[durationKey] || 5))
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => setDuration(String(settings[durationKey] || 5)), [settings[durationKey]])
  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowed = isBanner
      ? file.type.startsWith('image/')
      : file.type.startsWith('image/') || file.type.startsWith('video/')
    const limit = isBanner ? 8 : 25
    if (!allowed || file.size > limit * 1024 * 1024)
      return setMessage(
        `${isBanner ? 'Banner must be an image' : 'Choose an image or video'} smaller than ${limit} MB.`,
      )
    setUploading(true)
    setMessage('Uploading…')
    try {
      const dataUrl = await readMedia(file)
      const data = await apiRequest(`/admin/${endpoint}`, {
        method: 'POST',
        token: session.token,
        body: { name: file.name, dataUrl },
      })
      setSettings(data.settings)
      setMessage(`${isBanner ? 'Banner poster' : 'Popup media'} uploaded and synced.`)
      event.target.value = ''
    } catch (error) {
      setMessage(error.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }
  const remove = async () => {
    setMessage('Removing…')
    try {
      const data = await apiRequest(`/admin/${endpoint}`, {
        method: 'DELETE',
        token: session.token,
      })
      setSettings(data.settings)
      setMessage('Media removed.')
    } catch (error) {
      setMessage(error.message || 'Media could not be removed.')
    }
  }
  const saveDuration = async () => {
    const seconds = Math.max(1, Math.min(60, Number(duration) || 5))
    setDuration(String(seconds))
    setMessage('Saving…')
    const ok = await saveSettings({ ...settings, [durationKey]: seconds })
    setMessage(ok ? `Display time saved: ${seconds} seconds.` : 'Display time could not be saved.')
  }
  return (
    <section className="admin-panel control-page media-control">
      <header>
        <div>
          <span>USER APP PROMPT</span>
          <h2>{isBanner ? 'Banner poster' : 'Video / image popup'}</h2>
          <p>
            {isBanner
              ? 'A separate poster shown after the Telegram prompt.'
              : 'A separate image or video shown after the banner.'}
          </p>
        </div>
      </header>
      <Toggle
        icon={isBanner ? Image : Film}
        label="Popup visibility"
        detail={`Show this ${isBanner ? 'banner' : 'media'} in the login sequence`}
        checked={settings[kind]}
        onChange={(value) => saveSettings({ ...settings, [kind]: value })}
      />
      {media && (
        <div className="media-preview">
          {media.type === 'video' ? (
            <video
              src={media.url.startsWith('http') ? media.url : `${MEDIA_ORIGIN}${media.url}`}
              controls
            />
          ) : (
            <img
              src={media.url.startsWith('http') ? media.url : `${MEDIA_ORIGIN}${media.url}`}
              alt={media.name}
            />
          )}
          <div>
            <strong>{media.name}</strong>
            <small>{media.type === 'video' ? 'Video popup' : 'Image poster'}</small>
            <button type="button" onClick={remove}>
              <Trash2 /> Remove
            </button>
          </div>
        </div>
      )}
      <div className="media-settings">
        <label className={`upload-button ${uploading ? 'disabled' : ''}`}>
          <Upload />
          {uploading
            ? 'Uploading…'
            : media
              ? 'Replace media'
              : isBanner
                ? 'Upload banner poster'
                : 'Upload image or video'}
          <input
            type="file"
            accept={isBanner ? 'image/*' : 'image/*,video/mp4,video/webm,video/quicktime'}
            hidden
            disabled={uploading}
            onChange={upload}
          />
        </label>
        <label className="duration-input">
          Display time
          <input
            type="number"
            min="1"
            max="60"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <span>seconds</span>
        </label>
      </div>
      <button className="admin-primary save-button" onClick={saveDuration}>
        Save time
      </button>
      {message && <p className="admin-message">{message}</p>}
    </section>
  )
}
function Profile({ session }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    if (newPassword.length < 8) return setMessage('New password must be at least 8 characters.')
    if (newPassword !== confirmPassword)
      return setMessage('New password and confirmation do not match.')
    setSaving(true)
    try {
      await apiRequest('/admin/password', {
        method: 'PUT',
        token: session.token,
        body: { currentPassword, newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated successfully.')
    } catch (error) {
      setMessage(error.message || 'Password could not be updated.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="profile-grid">
      <section className="admin-panel profile-card">
        <Brand large />
        <h2>MillerPay Administrator</h2>
        <p>{session.user?.email || 'Administrator'}</p>
        <div>
          <MonitorSmartphone />
          <span>
            <strong>Application control</strong>
            <small>Connected to the Miller Pay API.</small>
          </span>
        </div>
      </section>
      <section className="admin-panel">
        <header>
          <div>
            <span>SECURITY</span>
            <h2>Change password</h2>
          </div>
        </header>
        <form className="password-form" onSubmit={submit}>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
          />
          <input
            type="password"
            minLength="8"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            required
          />
          <input
            type="password"
            minLength="8"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />
          {message && <p className="admin-message">{message}</p>}
          <button className="admin-primary" disabled={saving}>
            {saving ? 'UPDATING…' : 'Update password'}
          </button>
        </form>
      </section>
      <section className="admin-panel session-panel">
        <header>
          <div>
            <span>LOGIN HISTORY</span>
            <h2>Admin sessions</h2>
          </div>
          <RefreshCcw />
        </header>
        <Empty
          icon={MonitorSmartphone}
          title="No recent sessions"
          text="Admin session history will appear here."
        />
      </section>
    </div>
  )
}

function ControlCenter({ session, onLogout }) {
  const [active, setActive] = useState('users')
  const [menu, setMenu] = useState(false)
  const [settings, setSettings] = useState({
    slides: 1,
    banner: false,
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
  const [syncState, setSyncState] = useState('Live sync')
  useEffect(() => {
    apiRequest('/public/settings')
      .then((data) => data.settings && setSettings(data.settings))
      .catch(() => setSyncState('Sync unavailable'))
  }, [])
  const saveSettings = async (next) => {
    const previous = settings
    setSettings(next)
    setSyncState('Syncing…')
    try {
      const data = await apiRequest('/admin/settings', {
        method: 'PUT',
        token: session.token,
        body: next,
      })
      setSettings(data.settings)
      setSyncState('Live sync')
      return true
    } catch {
      setSettings(previous)
      setSyncState('Sync failed')
      return false
    }
  }
  const label = sections.find(([id]) => id === active)?.[1] || 'Dashboard'
  return (
    <main className="admin-shell">
      <aside className={menu ? 'open' : ''}>
        <div className="sidebar-brand">
          <Brand />
          <button onClick={() => setMenu(false)}>
            <PanelLeftClose />
          </button>
        </div>
        <nav>
          {sections.map(([id, text, Icon]) => (
            <button
              key={id}
              className={active === id ? 'active' : ''}
              onClick={() => {
                setActive(id)
                setMenu(false)
              }}
            >
              <Icon />
              <span>{text}</span>
            </button>
          ))}
        </nav>
        <button className="admin-logout" onClick={onLogout}>
          <LogOut /> Log out
        </button>
      </aside>
      {menu && (
        <button className="sidebar-scrim" onClick={() => setMenu(false)} aria-label="Close menu" />
      )}
      <section className="admin-main">
        <header className="admin-topbar">
          <button className="menu-button" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="topbar-title">
            <img src="/miller-pay-logo.jpeg" alt="Miller Pay logo" />
            <span>
              <small>MILLERPAY ADMIN</small>
              <h1>{label}</h1>
            </span>
          </div>
          <b>
            <i /> {syncState}
          </b>
        </header>
        <div className="admin-view">
          {active === 'dashboard' && <Dashboard settings={settings} session={session} />}{' '}
          {active === 'users' && <UsersPanel session={session} />}
          {active === 'slides' && (
            <UploadPanel
              title="Slides"
              text="Upload any number of images for the live user-home carousel."
              settings={settings}
              setSettings={setSettings}
              session={session}
            />
          )}{' '}
          {active === 'banner' && (
            <SingleMediaControl
              kind="banner"
              settings={settings}
              setSettings={setSettings}
              saveSettings={saveSettings}
              session={session}
            />
          )}{' '}
          {active === 'trash' && <TrashPanel session={session} />}
          {active === 'telegram' && (
            <TelegramControl settings={settings} saveSettings={saveSettings} />
          )}{' '}
          {active === 'popup' && (
            <SingleMediaControl
              kind="popup"
              settings={settings}
              setSettings={setSettings}
              saveSettings={saveSettings}
              session={session}
            />
          )}{' '}
          {active === 'profile' && <Profile session={session} />}
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('miller-admin'))
    } catch {
      return null
    }
  }, [])
  const [session, setSession] = useState(stored)
  const login = (data) => {
    localStorage.setItem('miller-admin', JSON.stringify(data))
    setSession(data)
  }
  const logout = () => {
    localStorage.removeItem('miller-admin')
    setSession(null)
  }
  return session ? <ControlCenter session={session} onLogout={logout} /> : <Login onLogin={login} />
}
