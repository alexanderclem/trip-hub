// Run with node scripts/build-brand-assets.mjs. Uses the existing Playwright dependency.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const read = (name) => readFile(new URL(`../public/brand/${name}`, import.meta.url), 'utf8')
// Everything inside the root <svg>, minus the <title> (the outputs carry their own).
const inner = (file) => file.slice(file.indexOf('>') + 1, file.lastIndexOf('</svg>')).replace(/<title[^>]*>[^<]*<\/title>/, '')
const paths = inner(await read('stowaway-mark.svg'))
// The small cut (bigger eyes, thicker handle) is for the favicon only.
const small = inner(await read('stowaway-mark-small.svg'))
// The drawn wordmark, 96 units tall like the mark.
const type = inner(await read('stowaway-type.svg'))
const svg = (width, height, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${content}</svg>`
const tile = (content) => svg(512, 512, `<rect width="512" height="512" fill="#f8f5ee"/><g transform="translate(76 76) scale(3.75)">${content}</g>`)
const icon = tile(paths)
const favicon = tile(small)
const wordmark = svg(424, 96, `${paths}<g transform="translate(106 0)">${type}</g>`)
const social = svg(1200, 630, `<rect width="1200" height="630" fill="#f8f5ee"/><path d="M0 550C250 550 250 90 480 90S740 550 980 550s170-140 250-140" fill="none" stroke="#d6e4e5" stroke-width="3" stroke-dasharray="10 16"/><g transform="translate(82 70) scale(1.2)">${paths}</g><g transform="translate(212 70) scale(1.2)">${type}</g><text x="90" y="308" fill="#183e4b" font-family="Georgia,serif" font-size="68" letter-spacing="-2">Get the trip out</text><text x="90" y="397" fill="#183e4b" font-family="Georgia,serif" font-size="68" letter-spacing="-2">of the group chat.</text><text x="94" y="468" fill="#295361" font-family="Arial,sans-serif" font-size="27">Plan your trip together.</text><text x="94" y="565" fill="#295361" font-family="Arial,sans-serif" font-size="23" letter-spacing="2">joinstowaway.app</text><g transform="translate(866 232) rotate(12 100 100) scale(2.2)">${paths}</g>`)

await writeFile(new URL('../public/icon.svg', import.meta.url), favicon)
await writeFile(new URL('../public/brand/stowaway-wordmark.svg', import.meta.url), wordmark)
await writeFile(new URL('../public/brand/social-preview.svg', import.meta.url), social)
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, width, height, source] of [
    ['icon-192.png', 192, 192, icon],
    ['icon-512.png', 512, 512, icon],
    ['apple-touch-icon.png', 180, 180, icon],
    ['brand/social-preview.png', 1200, 630, social],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${source}`)
    await page.screenshot({ path: fileURLToPath(new URL(`../public/${name}`, import.meta.url)) })
    await page.close()
    console.log(`Generated ${name} (${width}×${height})`)
  }
} finally {
  await browser.close()
}
