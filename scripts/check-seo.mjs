import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pages, origin, keywords, updated } from '../seo/site.mjs'
import { applyMetadata } from './prepare-seo.mjs'

const output = fileURLToPath(new URL('../public/', import.meta.url))
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
const attributes = (tag) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]))
const documents = new Map()
const titles = new Set()
const descriptions = new Set()
let imageCount = 0

for (const page of pages) {
  const html = await readFile(resolve(output, page.file), 'utf8')
  documents.set(page.path, html)
  assert(
    !/millerpay-app\.online|millerpay\.online|https?:\/\/[^\s"<>]*\.vercel\.app/i.test(html),
    `Obsolete public domain: ${page.path}`,
  )
  assert.equal([...html.matchAll(/<title>/g)].length, 1, `Title count: ${page.path}`)
  assert(!titles.has(page.title), `Duplicate title: ${page.path}`)
  assert(!descriptions.has(page.description), `Duplicate description: ${page.path}`)
  titles.add(page.title)
  descriptions.add(page.description)
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]))
  for (const name of ['description', 'keywords', 'robots'])
    assert.equal(tags.filter((tag) => tag.name === name).length, 1, `${name} count: ${page.path}`)
  assert.equal(tags.find((tag) => tag.name === 'description').content, page.description)
  assert.equal(tags.find((tag) => tag.name === 'keywords').content, keywords.join(', '))
  assert(!tags.find((tag) => tag.name === 'robots').content.includes('noindex'))
  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map((match) =>
    attributes(match[0]),
  )
  assert.deepEqual(
    canonicals.map((tag) => tag.href),
    [origin + page.path],
  )
  assert.equal(tags.find((tag) => tag.property === 'og:url').content, origin + page.path)
  assert.equal(tags.find((tag) => tag.property === 'og:image').content, origin + page.image)
  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]))
  assert.equal(schemas.length, 1)
  assert(schemas[0]['@graph'].some((node) => node.url === origin + page.path))
  assert(!html.includes('rel="me"'), `Unverified identity: ${page.path}`)
  assert(!JSON.stringify(schemas).includes('"sameAs"'), `Unverified schema identity: ${page.path}`)
  if (page.path !== '/login') {
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `Heading count: ${page.path}`)
    assert(
      html.includes('aria-label="Miller Pay help"'),
      `Missing internal navigation: ${page.path}`,
    )
    assert(
      config.rewrites.some(
        (rule) => rule.source === page.path && rule.destination === '/' + page.file,
      ),
      `Missing route: ${page.path}`,
    )
    for (const match of html.matchAll(/<(?:img|script|link)\b[^>]*>/gi)) {
      const tag = attributes(match[0])
      const path = tag.src || (tag.rel === 'stylesheet' || tag.rel === 'icon' ? tag.href : null)
      if (path?.startsWith('/')) await access(resolve(output, path.slice(1)))
      if (/^<img\b/i.test(match[0])) {
        assert(tag.alt && tag.width && tag.height, `Image text/dimensions missing: ${page.path}`)
        imageCount++
      }
    }
  }
  if (page.video) {
    assert(html.includes(`https://www.youtube-nocookie.com/embed/${page.video.id}`))
    assert(
      schemas[0]['@graph'].some(
        (node) => node['@type'] === 'VideoObject' && node.uploadDate === page.video.uploadDate,
      ),
    )
    assert(
      config.headers.some(
        (rule) =>
          rule.source.startsWith(page.path) &&
          rule.headers.some(
            (header) =>
              header.key === 'Content-Security-Policy' &&
              header.value.includes('frame-src https://www.youtube-nocookie.com'),
          ),
      ),
    )
  }
}

for (const [path, html] of documents) {
  if (path === '/login') continue
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
    const href = match[1]
    if (!href.startsWith('/') && !href.startsWith('#')) continue
    const target = new URL(href, origin + path)
    if (target.pathname === '/') continue
    assert(documents.has(target.pathname), `Broken public link on ${path}: ${href}`)
    if (target.hash && target.pathname !== '/login')
      assert(
        documents.get(target.pathname).includes(`id="${decodeURIComponent(target.hash.slice(1))}"`),
        `Missing anchor on ${path}: ${href}`,
      )
  }
}

const sitemap = await readFile(resolve(output, 'sitemap.xml'), 'utf8')
assert(sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'))
assert.deepEqual(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
  pages.map((page) => origin + page.path),
)
assert.equal(
  [...sitemap.matchAll(new RegExp(`<lastmod>${updated}</lastmod>`, 'g'))].length,
  pages.length,
)
for (const match of sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) {
  assert.equal(new URL(match[1]).origin, origin)
  await access(resolve(output, new URL(match[1]).pathname.slice(1)))
}
for (const entry of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const path = new URL(entry[1].match(/<loc>([^<]+)<\/loc>/)[1]).pathname
  for (const image of entry[1].matchAll(/<image:loc>([^<]+)<\/image:loc>/g))
    assert(
      documents.get(path).includes(`src="${new URL(image[1]).pathname}"`),
      `Sitemap image absent from HTML: ${path}`,
    )
}
const robots = await readFile(resolve(output, 'robots.txt'), 'utf8')
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
assert(robots.includes('Disallow: /admin') && robots.includes('Disallow: /api/'))
assert(!sitemap.includes('/admin') && !sitemap.includes('/api/'))
for (const rule of config.redirects.filter((rule) => rule.missing)) {
  assert.equal(rule.destination.startsWith(origin + '/'), true)
  assert.deepEqual(rule.missing, [{ type: 'host', value: new URL(origin).hostname }])
  assert(!rule.source.includes('/admin') && !rule.source.includes('/api'))
}

// Regression: metadata replacement preserves the application mount, resources
// and arbitrary body bytes, and can run repeatedly without duplicate tags.
const fixture =
  '<!doctype html><html><head><meta charset="UTF-8"><title>Old</title><meta name="description" content="Old"><script type="module" src="/assets/example.js"></script><link rel="stylesheet" href="/assets/example.css"></head><body><div id="root"></div><script>window.example = "unchanged"</script></body></html>'
const changed = applyMetadata(fixture, pages[0])
assert.equal(changed.slice(changed.indexOf('<body>')), fixture.slice(fixture.indexOf('<body>')))
assert(changed.includes('<script type="module" src="/assets/example.js"></script>'))
assert(changed.includes('<link rel="stylesheet" href="/assets/example.css">'))
assert.equal(applyMetadata(changed, pages[0]), changed)
assert(documents.get('/miller-pay/').includes('<details'))
assert(documents.get('/miller-pay/').includes('Where is Millerpay forgot password help?'))
console.log(
  `SEO checks passed: ${pages.length} pages, ${imageCount} HTML images, metadata, links, routes, sitemap, video policy and login preservation.`,
)
