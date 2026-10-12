import { cp, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parse } from 'parse5'
import { origin, updated, keywords, pages } from '../seo/site.mjs'

const source = fileURLToPath(new URL('../seo/', import.meta.url))
const output = fileURLToPath(new URL('../public/', import.meta.url))
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

function metadata(page) {
  const url = origin + page.path
  const organization = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'Miller Pay',
    alternateName: 'Millerpay',
    url: `${origin}/miller-pay/`,
    logo: `${origin}/seo-assets/images/miller_pay_logo.jpg`,
  }
  const graph = [
    organization,
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      name: 'Miller Pay',
      alternateName: 'Millerpay',
      url: `${origin}/`,
      inLanguage: 'en-IN',
      publisher: { '@id': organization['@id'] },
    },
    {
      '@type': page.video ? 'ItemPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en-IN',
      dateModified: updated,
      isPartOf: { '@id': `${origin}/#website` },
      primaryImageOfPage: { '@type': 'ImageObject', contentUrl: origin + page.image },
      ...(page.video ? { mainEntity: { '@id': `${url}#video` } } : {}),
    },
  ]
  if (page.video) {
    const video = page.video
    graph.push({
      '@type': 'VideoObject',
      '@id': `${url}#video`,
      name: video.name,
      description: video.description,
      thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      uploadDate: video.uploadDate,
      duration: video.duration,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
      author: { '@type': 'Person', name: video.author, url: video.authorUrl },
    })
  }
  const meta = (type, key, value) => `    <meta ${type}="${key}" content="${escape(value)}" />`
  return [
    `    <title>${escape(page.title)}</title>`,
    meta('name', 'description', page.description),
    meta('name', 'keywords', keywords.join(', ')),
    meta(
      'name',
      'robots',
      'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    ),
    `    <link rel="canonical" href="${url}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Miller Pay'),
    meta('property', 'og:locale', 'en_IN'),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', url),
    meta('property', 'og:image', origin + page.image),
    meta('property', 'og:image:alt', page.title),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', origin + page.image),
    meta('name', 'twitter:image:alt', page.title),
    `    <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`,
  ].join('\n')
}

// Only public SEO documents and the built login head are processed. Application
// sources, bundles, the login body and all administrator files stay untouched.
export function applyMetadata(html, page) {
  const document = parse(html, { sourceCodeLocationInfo: true })
  const head = document.childNodes
    .find((node) => node.tagName === 'html')
    ?.childNodes.find((node) => node.tagName === 'head')
  const location = head?.sourceCodeLocation
  if (!location?.startTag || !location?.endTag) throw new Error(`Missing HTML head: ${page.file}`)
  const start = location.startTag.endOffset
  const end = location.endTag.startOffset
  const removals = []
  for (const node of head.childNodes) {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]))
    const label = (attrs.name ?? attrs.property ?? '').toLowerCase()
    const replace =
      node.tagName === 'title' ||
      (node.tagName === 'meta' &&
        (['description', 'keywords', 'robots'].includes(label) ||
          label.startsWith('og:') ||
          label.startsWith('twitter:'))) ||
      (node.tagName === 'link' && /(?:^|\s)(?:canonical|me)(?:\s|$)/i.test(attrs.rel ?? '')) ||
      (node.tagName === 'script' && attrs.type?.toLowerCase() === 'application/ld+json')
    if (!replace || !node.sourceCodeLocation) continue
    const from = node.sourceCodeLocation.startOffset
    let to = node.sourceCodeLocation.endOffset
    while (to < end && /\s/.test(html[to])) to++
    removals.push([from - start, to - start])
  }
  let content = html.slice(start, end)
  for (const [from, to] of removals.sort((a, b) => b[0] - a[0])) {
    content = content.slice(0, from) + content.slice(to)
  }
  return html.slice(0, start) + content.trimEnd() + `\n${metadata(page)}\n  ` + html.slice(end)
}

export async function prepareSeo(directory = output) {
  for (const entry of [
    'miller-pay',
    'blog',
    'about',
    'legal',
    'seo-assets',
    'miller-pay-logo.jpeg',
    'miller-pay-share-card.png',
  ]) {
    await cp(resolve(source, entry), resolve(directory, entry), { recursive: true })
  }
  const entries = []
  for (const page of pages) {
    const target = resolve(directory, page.file)
    const html = applyMetadata(await readFile(target, 'utf8'), page)
    await writeFile(target, html)
    const images = [
      ...new Set([...html.matchAll(/<img\b[^>]*\bsrc="(\/[^"#?]+)"/gi)].map((match) => match[1])),
    ]
    entries.push(
      `  <url>\n    <loc>${origin}${page.path}</loc>\n    <lastmod>${updated}</lastmod>${images.map((image) => `\n    <image:image><image:loc>${escape(origin + image)}</image:loc></image:image>`).join('')}\n  </url>`,
    )
  }
  await writeFile(
    resolve(directory, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`,
  )
  await writeFile(
    resolve(directory, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
  )
  console.log(`Prepared ${pages.length} public SEO pages, image entries and sitemap for ${origin}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await prepareSeo()
