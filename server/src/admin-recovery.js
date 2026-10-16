// An owner-controlled revision applies configured credentials once, without
// overriding subsequent in-app password changes or removing Authenticator MFA.
export function recoverAdminSecurity(security, { revision, passwordHash, loginDefaults }) {
  if (!revision || security.credentialVersion === revision) {
    return { security, recovered: false }
  }
  return {
    recovered: true,
    security: {
      ...security,
      credentialVersion: revision,
      passwordHash,
      sessionVersion: (Number(security.sessionVersion) || 1) + 1,
      sessions: [],
      trustedDevices: [],
      login: structuredClone(loginDefaults),
    },
  }
}
