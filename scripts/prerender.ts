import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { publicPages } from '../src/features/website/metadata.ts'

const attribute = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

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
      const canonical = `https://joinstowaway.app${path === '/' ? '' : path}`
      const html = template
        .replace(/<title>[^<]*<\/title>/, `<title>${attribute(metadata.title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*/, `$1${attribute(metadata.description)}`)
        .replace(/(<meta property="og:title" content=")[^"]*/, `$1${attribute(metadata.title)}`)
        .replace(/(<meta property="og:description" content=")[^"]*/, `$1${attribute(metadata.description)}`)
        .replace('</head>', `<link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"></head>`)
        .replace('<div id="root"></div>', `<div id="root" data-prerender="${path}">${markup}</div>`)
      // Flat .html files support extensionless routes in Vite preview and Cloudflare assets.
      await writeFile(resolve(directory, path === '/' ? 'index.html' : `${path.slice(1)}.html`), html)
    }
    await writeFile(resolve(directory, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(publicPages).map((path) => `<url><loc>https://joinstowaway.app${path === '/' ? '' : path}</loc></url>`).join('')}</urlset>`)
  } finally { await server.close() }
}
