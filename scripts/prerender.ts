import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'
import { publicPages } from '../src/features/website/metadata.ts'
import { jsonLdScript } from '../src/features/website/structuredData.ts'

const attribute = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const canonicalUrl = (path: string) => `https://joinstowaway.app${path === '/' ? '' : path}`

/** Runs before Workbox hashes HTML so offline navigation receives the matching build. */
export async function prerender(outDir: string) {
  const directory = resolve(outDir)
  const template = await readFile(resolve(directory, 'index.html'), 'utf8')
  await writeFile(resolve(directory, 'app.html'), template)
  const server = await createServer({ mode: 'production', server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('/src/prerender.tsx') as { render(path: string): Promise<string> }
    for (const [path, metadata] of Object.entries(publicPages)) {
      const markup = await render(path)
      const canonical = canonicalUrl(path)
      const head = [
        `<link rel="canonical" href="${canonical}">`,
        `<meta property="og:url" content="${canonical}">`,
        `<meta name="twitter:title" content="${attribute(metadata.title)}">`,
        `<meta name="twitter:description" content="${attribute(metadata.description)}">`,
        jsonLdScript(path),
      ].join('')
      // Function replacements: page text never gets read as a `$&`-style pattern.
      const html = template
        .replace(/<title>[^<]*<\/title>/, () => `<title>${attribute(metadata.title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*/, (_, start: string) => start + attribute(metadata.description))
        .replace(/(<meta property="og:title" content=")[^"]*/, (_, start: string) => start + attribute(metadata.title))
        .replace(/(<meta property="og:description" content=")[^"]*/, (_, start: string) => start + attribute(metadata.description))
        .replace('</head>', () => `${head}</head>`)
        .replace('<div id="root"></div>', () => `<div id="root" data-prerender="${path}">${markup}</div>`)
      // Flat .html files support extensionless routes in Vite preview and Cloudflare assets.
      const file = resolve(directory, path === '/' ? 'index.html' : `${path.slice(1)}.html`)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, html)
    }
    await writeFile(resolve(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(publicPages).map((path) => `<url><loc>${canonicalUrl(path)}</loc></url>`).join('')}</urlset>`)
  } finally { await server.close() }
}
