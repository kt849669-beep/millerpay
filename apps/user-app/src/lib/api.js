export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : `${window.location.origin}/api`)

export const MEDIA_ORIGIN = API_URL.replace(/\/api$/, '')

export async function apiRequest(path, { body, headers, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Unable to complete the request.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}
