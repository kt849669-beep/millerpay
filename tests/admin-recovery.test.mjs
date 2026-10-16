import assert from 'node:assert/strict'
import test from 'node:test'
import { recoverAdminSecurity } from '../server/src/admin-recovery.js'

const saved = {
  passwordHash: 'stored-hash',
  sessionVersion: 4,
  mfa: { enabled: true, secret: 'encrypted-secret', pendingSecret: null },
  sessions: [{ id: 'old-session' }],
  trustedDevices: [{ hash: 'old-device' }],
  login: { lockUntil: '2099-01-01', failuresSinceSuccess: 3 },
  auditLogs: [{ action: 'admin.password.changed' }],
}
const options = {
  revision: 'owner-reset-1',
  passwordHash: 'configured-hash',
  loginDefaults: { lockUntil: null, failuresSinceSuccess: 0 },
}

test('explicit owner recovery replaces the persisted password and revokes old sessions', () => {
  const { security, recovered } = recoverAdminSecurity(saved, options)
  assert.equal(recovered, true)
  assert.equal(security.passwordHash, options.passwordHash)
  assert.equal(security.credentialVersion, options.revision)
  assert.equal(security.sessionVersion, 5)
  assert.deepEqual(security.sessions, [])
  assert.deepEqual(security.trustedDevices, [])
  assert.deepEqual(security.login, options.loginDefaults)
  assert.deepEqual(security.mfa, saved.mfa)
  assert.deepEqual(security.auditLogs, saved.auditLogs)
  assert.equal(saved.passwordHash, 'stored-hash')
})

test('later in-app password changes survive repeated reads with the same revision', () => {
  const first = recoverAdminSecurity(saved, options).security
  const changed = { ...first, passwordHash: 'later-password-hash' }
  const result = recoverAdminSecurity(changed, options)
  assert.equal(result.recovered, false)
  assert.equal(result.security, changed)
})

test('no configured revision leaves stored credentials and MFA untouched', () => {
  const result = recoverAdminSecurity(saved, { ...options, revision: undefined })
  assert.equal(result.recovered, false)
  assert.equal(result.security, saved)
})

test('a new owner revision applies another reset', () => {
  const first = recoverAdminSecurity(saved, options).security
  const result = recoverAdminSecurity(first, { ...options, revision: 'owner-reset-2' })
  assert.equal(result.recovered, true)
  assert.equal(result.security.sessionVersion, 6)
  assert.equal(result.security.credentialVersion, 'owner-reset-2')
})
