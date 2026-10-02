// Run with node scripts/build-brand-assets.mjs. Uses the existing Playwright dependency.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const mark = await readFile(new URL('../public/brand/stowaway-mark.svg', import.meta.url), 'utf8')
const paths = mark.slice(mark.indexOf('>') + 1, mark.lastIndexOf('</svg>'))
const svg = (width, height, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${content}</svg>`
const icon = svg(512, 512, `<rect width="512" height="512" fill="#f8f5ee"/><g transform="translate(76 76) scale(3.75)">${paths}</g>`)
const wordmark = svg(460, 96, `${paths}<text x="110" y="68" fill="#183e4b" font-family="Georgia,serif" font-size="64" font-weight="700" letter-spacing="-4">stowaway<tspan fill="#ef9477">.</tspan></text>`)
const social = svg(1200, 630, `<rect width="1200" height="630" fill="#f8f5ee"/><path d="M0 550C250 550 250 90 480 90S740 550 980 550s170-140 250-140" fill="none" stroke="#d6e4e5" stroke-width="3" stroke-dasharray="10 16"/><g transform="translate(82 70) scale(1.2)">${paths}</g><text x="215" y="151" fill="#183e4b" font-family="Georgia,serif" font-size="72" font-weight="700" letter-spacing="-4">stowaway<tspan fill="#ef9477">.</tspan></text><text x="90" y="308" fill="#183e4b" font-family="Georgia,serif" font-size="76" letter-spacing="-2">The whole trip,</text><text x="90" y="397" fill="#183e4b" font-family="Georgia,serif" font-size="76" letter-spacing="-2">tucked away.</text><text x="94" y="468" fill="#295361" font-family="Arial,sans-serif" font-size="27">Plans, places, tickets. Your people, all together.</text><text x="94" y="565" fill="#295361" font-family="Arial,sans-serif" font-size="23" letter-spacing="2">joinstowaway.app</text><g transform="translate(866 232) rotate(12 100 100) scale(2.2)">${paths}</g>`)

await writeFile(new URL('../public/icon.svg', import.meta.url), icon)
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
