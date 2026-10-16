import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

test('admin login uses existing credentials and password changes do not require Authenticator', async () => {
  process.env.VERCEL = '1'
  process.env.USER_JWT_SECRET = 'u'.repeat(64)
  process.env.ADMIN_JWT_SECRET = 'a'.repeat(64)
  process.env.ADMIN_EMAIL = 'admin@example.test'
  process.env.ADMIN_PASSWORD = 'original-test-password'
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_KEY
  delete process.env.SUPABASE_KEY
  delete process.env.MFA_ENCRYPTION_KEY
  const { default: app } = await import('../server/src/index.js')
  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const cookiesFrom = (response) =>
    response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
  const send = (path, body, cookie, method = 'POST') =>
    fetch(`${origin}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  try {
    const denied = await send('/auth/login', {
      role: 'admin',
      email: process.env.ADMIN_EMAIL,
      password: 'wrong-test-password',
    })
    assert.equal(denied.status, 401)
    const login = await send('/auth/login', {
      role: 'admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    assert.equal(login.status, 200)
    const data = await login.json()
    assert.equal(data.user.role, 'admin')
    assert.equal(data.user.email, process.env.ADMIN_EMAIL)
    assert.equal(data.mfaRequired, undefined)
    const cookie = cookiesFrom(login)
    const session = await send('/auth/session/admin', undefined, cookie, 'GET')
    assert.equal(session.status, 200)
    const removed = await send('/auth/mfa/verify', { code: '000000' })
    assert.equal(removed.status, 404)
    const setup = await send('/admin/mfa/status', undefined, cookie, 'GET')
    assert.equal(setup.status, 404)
    const unauthenticated = await send(
      '/admin/password',
      { currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'next-test-password' },
      undefined,
      'PUT',
    )
    assert.equal(unauthenticated.status, 401)
    const incorrect = await send(
      '/admin/password',
      { currentPassword: 'incorrect', newPassword: 'next-test-password' },
      cookie,
      'PUT',
    )
    assert.equal(incorrect.status, 400)
    const changed = await send(
      '/admin/password',
      { currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'next-test-password' },
      cookie,
      'PUT',
    )
    assert.equal(changed.status, 200)
    const oldLogin = await send('/auth/login', {
      role: 'admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
    assert.equal(oldLogin.status, 401)
    const newLogin = await send('/auth/login', {
      role: 'admin',
      email: process.env.ADMIN_EMAIL,
      password: 'next-test-password',
    })
    assert.equal(newLogin.status, 200)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
