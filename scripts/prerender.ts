import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'
import { publicPages } from '../src/features/website/metadata.ts'
import { jsonLdScript } from '../src/features/website/structuredData.ts'

const attribute = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
const canonicalUrl = (path: string) => `https://joinstowaway.app${path === '/' ? '' : path}`

/** The files whose text each public page shows; their last commit is the page's sitemap <lastmod>. */
const PAGE_SOURCES: Record<string, string[]> = {
  '/': ['src/features/website/LandingScreen.tsx'],
  '/how-it-works': ['src/features/website/HowItWorksScreen.tsx'],
  '/organizers': ['src/features/website/OrganizersScreen.tsx', 'src/features/website/OrganizerPreview.tsx', 'src/features/website/OrganizerBookingPreview.tsx'],
  '/pricing': ['src/features/website/PricingScreen.tsx', 'src/features/website/FeeCalculator.tsx'],
  '/help': ['src/features/website/HelpScreen.tsx'],
  '/group-expenses': ['src/features/website/GroupExpensesScreen.tsx'],
  '/tools/trip-cost-splitter': ['src/features/website/CostSplitterScreen.tsx', 'src/features/website/splitter.ts'],
  '/compare/best-group-trip-planner-apps': ['src/features/website/CompareScreens.tsx'],
  '/compare/splitwise-alternative-for-group-trips': ['src/features/website/CompareScreens.tsx'],
  '/spring-break-trip-planner': ['src/features/website/OccasionScreens.tsx'],
  '/bachelor-party-trip-planner': ['src/features/website/OccasionScreens.tsx'],
  '/privacy': ['src/features/legal'],
  '/terms': ['src/features/legal'],
}

/**
 * The date (YYYY-MM-DD) of the last commit touching a page's sources. Without full git history (a
 * shallow clone dates every file to its one commit) it returns null and the sitemap omits <lastmod>:
 * Google ignores lastmod on sites where it proves inaccurate, so no date beats a wrong one.
 */
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }).trim()

let fullHistory: boolean | undefined
function hasFullHistory(): boolean {
  if (fullHistory !== undefined) return fullHistory
  const complete = () => { try { return git('rev-parse', '--is-shallow-repository') === 'false' } catch { return false } }
  fullHistory = complete()
  if (!fullHistory) {
    // Cloudflare's build clones shallow. Fetching the commits (no file contents) takes a moment, once.
    try { git('fetch', '--quiet', '--unshallow', '--filter=blob:none') } catch { /* offline or no remote */ }
    fullHistory = complete()
  }
  if (!fullHistory) console.warn('sitemap.xml: no full git history, so <lastmod> is left out.')
  return fullHistory
}

function lastModified(path: string): string | null {
  const sources = PAGE_SOURCES[path]
  if (!sources) throw new Error(`Add ${path} to PAGE_SOURCES in scripts/prerender.ts (its sitemap date comes from those files).`)
  if (!hasFullHistory()) return null
  try {
    const date = git('log', '-1', '--format=%cs', '--', ...sources)
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  } catch { return null }
}

export function sitemapXml(paths: string[], dateOf: (path: string) => string | null = lastModified): string {
  const urls = paths.map((path) => {
    const date = dateOf(path)
    return `<url><loc>${canonicalUrl(path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`
}

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
    await writeFile(resolve(directory, 'sitemap.xml'), sitemapXml(Object.keys(publicPages)))
  } finally { await server.close() }
}
