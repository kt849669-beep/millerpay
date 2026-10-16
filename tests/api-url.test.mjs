import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('both apps use same-origin production APIs, the dev API, and explicit overrides', async () => {
  const scenarios = [
    {
      host: 'millerpay-official.website',
      dev: false,
      expected: 'https://millerpay-official.website/api',
    },
    {
      host: 'millerpay.kt849669.workers.dev',
      dev: false,
      expected: 'https://millerpay.kt849669.workers.dev/api',
    },
    { host: 'millerpay-app.online', dev: false, expected: 'https://millerpay-app.online/api' },
    { host: 'localhost', dev: true, expected: 'http://localhost:5000/api' },
    { host: '192.168.1.2', dev: true, expected: 'http://192.168.1.2:5000/api' },
    {
      host: 'localhost',
      dev: false,
      override: 'https://api.example.test/api',
      expected: 'https://api.example.test/api',
    },
  ]
  const previousWindow = globalThis.window
  try {
    for (const app of ['admin-app', 'user-app']) {
      const source = await readFile(
        new URL(`../apps/${app}/src/lib/api.js`, import.meta.url),
        'utf8',
      )
      for (const scenario of scenarios) {
        const protocol = scenario.dev ? 'http:' : 'https:'
        globalThis.window = {
          location: { hostname: scenario.host, protocol, origin: `${protocol}//${scenario.host}` },
        }
        const env = { DEV: scenario.dev, VITE_API_URL: scenario.override }
        const transformed = source.replaceAll('import.meta.env', JSON.stringify(env))
        const module = await import(
          `data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}#${app}-${scenario.host}-${scenario.dev}`
        )
        assert.equal(module.API_URL, scenario.expected, `${app}: ${scenario.host}`)
        assert.equal(module.MEDIA_ORIGIN, scenario.expected.replace(/\/api$/, ''))
      }
    }
  } finally {
    globalThis.window = previousWindow
  }
})
