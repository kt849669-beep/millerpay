import { cp, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
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
  if (!/<head\b[^>]*>[\s\S]*?<\/head>/i.test(html))
    throw new Error(`Missing HTML head: ${page.file}`)
  return html.replace(/<head\b[^>]*>([\s\S]*?)<\/head>/i, (_, original) => {
    const head = original
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
      .replace(
        /<meta\b(?=[^>]*(?:name|property)=["'](?:description|keywords|robots|og:[^"']+|twitter:[^"']+)["'])[^>]*>\s*/gi,
        '',
      )
      .replace(/<link\b(?=[^>]*rel=["'](?:canonical|me)["'])[^>]*>\s*/gi, '')
      .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '')
    return `<head>${head.trimEnd()}\n${metadata(page)}\n  </head>`
  })
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
