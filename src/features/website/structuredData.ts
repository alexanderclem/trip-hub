import { MAINTAINER, publicPages } from './metadata'

const SITE = 'https://joinstowaway.app'
const url = (path: string) => `${SITE}${path === '/' ? '' : path}`

const organization = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Stowaway',
  url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
  email: MAINTAINER.email,
  founder: { '@type': 'Person', name: MAINTAINER.name },
  sameAs: ['https://github.com/alexanderclem/trip-hub'],
}

const website = { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Stowaway', url: SITE, publisher: { '@id': `${SITE}/#organization` } }

/** A browser app that costs nothing to use. Only facts printed on the pages; no ratings. */
function application(path: string, name: string, description: string) {
  return {
    '@type': 'WebApplication',
    '@id': `${url(path)}#app`,
    name,
    url: url(path),
    description,
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Any (runs in a web browser)',
    browserRequirements: 'Requires JavaScript. Works offline after preparing a trip.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': `${SITE}/#organization` },
  }
}

/** JSON-LD for one public page: the site and its owner, the page with breadcrumbs, and the app where relevant. */
export function structuredData(path: string): object {
  const page = publicPages[path]
  if (!page) throw new Error(`No public page at ${path}`)
  const graph: object[] = [organization, website]
  const webPage: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${url(path)}#webpage`,
    url: url(path),
    name: page.title,
    description: page.description,
    isPartOf: { '@id': `${SITE}/#website` },
    inLanguage: 'en',
  }
  if (path === '/') {
    graph.push(application('/', 'Stowaway', page.description))
    webPage.about = { '@id': `${SITE}/#app` }
  } else {
    // Nested pages (/tools/…, /compare/…) have no hub page, so every crumb is Home → page.
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url(path)}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: page.crumb ?? page.title, item: url(path) },
      ],
    })
    webPage.breadcrumb = { '@id': `${url(path)}#breadcrumb` }
  }
  if (path === '/tools/trip-cost-splitter') graph.push(application(path, 'Trip cost splitter', page.description))
  graph.push(webPage)
  return { '@context': 'https://schema.org', '@graph': graph }
}

/** Safe inside a <script> element: no "</script>" or HTML comment can be formed. */
export function jsonLdScript(path: string): string {
  return `<script type="application/ld+json">${JSON.stringify(structuredData(path)).replaceAll('<', '\\u003c')}</script>`
}
