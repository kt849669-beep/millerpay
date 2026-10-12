import { createServer } from 'node:http'
import { httpServerHandler } from 'cloudflare:node'
import { origin, pages } from '../seo/site.mjs'
import hosting from '../vercel.json'

// Reuse the existing API without changing either application or its business logic.
// VERCEL=1 selects the API's existing serverless startup mode.
let apiReady
function loadApi() {
  apiReady ||= import('../server/src/index.js').then(({ default: application }) =>
    httpServerHandler(createServer(application)),
  )
  return apiReady
}
const documents = new Map(pages.map((page) => [page.path, `/${page.file}`]))
const aliases = new Map([['/', '/login'], ['/login/', '/login'], ['/login.html', '/login']])
for (const page of pages) {
  if (page.path.endsWith('/')) aliases.set(page.path.slice(0, -1), page.path)
  if (`/${page.file}` !== page.path) aliases.set(`/${page.file}`, page.path)
}

function staticHeaders(response, pathname, isPreview) {
  const result = new Response(response.body, response)
  for (const header of hosting.headers[0].headers) result.headers.set(header.key, header.value)
  if (pathname.startsWith('/blog/miller-pay-deposit-guide/')) {
    const policy = hosting.headers.find((entry) => entry.source.startsWith('/blog/'))
    for (const header of policy.headers) result.headers.set(header.key, header.value)
  }
  if (pathname.startsWith('/assets/') || pathname.startsWith('/admin/assets/')) {
    result.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  } else if (pathname.startsWith('/seo-assets/images/')) {
    result.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  } else if (result.headers.get('Content-Type')?.includes('text/html')) {
    result.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }
  if (isPreview || pathname.startsWith('/admin')) result.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return result
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const canonicalHost = new URL(origin).hostname
    if (url.hostname === `www.${canonicalHost}` || (url.hostname === canonicalHost && url.protocol === 'http:')) {
      return Response.redirect(`${origin}${url.pathname}${url.search}`, 308)
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const suppliedOrigin = request.headers.get('Origin')
      if (suppliedOrigin && suppliedOrigin !== url.origin && suppliedOrigin !== origin) {
        return Response.json({ message: 'Request origin is not allowed.' }, { status: 403 })
      }
      const headers = new Headers(request.headers)
      // The existing API trusts one reverse proxy. Replace client-supplied values.
      headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '127.0.0.1')
      headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1))
      const api = await loadApi()
      const response = await api.fetch(new Request(request, { headers }), env, ctx)
      const result = new Response(response.body, response)
      result.headers.set('Cache-Control', 'no-store')
      result.headers.set('X-Robots-Tag', 'noindex, nofollow')
      return result
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
    }
    if (aliases.has(url.pathname)) {
      return Response.redirect(`${url.origin}${aliases.get(url.pathname)}${url.search}`, 301)
    }

    const path = url.pathname
    if (documents.has(path)) url.pathname = documents.get(path)
    else if (path === '/admin' || path === '/admin/' || (path.startsWith('/admin/') && !path.split('/').pop().includes('.'))) {
      url.pathname = '/admin/index.html'
    }
    const response = await env.ASSETS.fetch(new Request(url, request))
    return staticHeaders(response, path, url.hostname.endsWith('.workers.dev'))
  },
}
