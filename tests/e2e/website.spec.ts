import { expect, test } from '@playwright/test'

// Presentation and navigation only: these tests never create a server-side trip.
test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ external: { google: false } }),
  }))
})

test('the website introduces Stowaway, then opens the app and create flow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Get the trip out of the group chat.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toHaveCount(0)
  const logos = page.getByRole('img', { name: 'Stowaway', exact: true })
  await expect(logos).toHaveCount(2)
  for (const logo of await logos.all()) {
    await expect(logo).toHaveAttribute('src', '/brand/stowaway-wordmark.svg')
    expect(await logo.evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app', exact: true }).click()
  await page.waitForURL('**/app')
  await page.getByRole('button', { name: 'Continue in browser' }).click()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await page.getByRole('link', { name: 'Create a trip', exact: true }).click()
  await page.waitForURL('**/new')
  await expect(page.getByLabel('Trip name')).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.waitForURL('**/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
})

test('joining from the website focuses the invite field and retains validation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Join your group' }).click()
  await page.waitForURL('**/app#join')
  await page.getByRole('button', { name: 'Continue in browser' }).click()
  const input = page.getByLabel('Trip link', { exact: true })
  await expect(input).toBeFocused()
  await input.fill('not a trip link')
  await page.getByRole('button', { name: 'Join trip', exact: true }).click()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText("doesn't look like a trip link")
})

test('the homepage reflows and its FAQ works at narrow and wide widths', async ({ page }) => {
  for (const width of [320, 375, 390, 414, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
    // Removing the clip during measurement catches overflow that a root clip could mask.
    const overflow = await page.evaluate(() => {
      const roots = [document.documentElement, document.body]
      const before = roots.map((root) => root.style.overflowX)
      roots.forEach((root) => { root.style.overflowX = 'visible' })
      const result = document.documentElement.scrollWidth > document.documentElement.clientWidth
      roots.forEach((root, index) => { root.style.overflowX = before[index] })
      return result
    })
    expect(overflow).toBe(false)
    const wrappedLabels = await page.locator('.website-header nav a, .website-button, .website-text-link, .website-footer > a:last-child').evaluateAll((links) => links.filter((link) => {
      if (!link.getClientRects().length) return false
      const range = document.createRange()
      range.selectNodeContents(link)
      return range.getBoundingClientRect().height > parseFloat(getComputedStyle(link).fontSize) * 1.5
    }).map((link) => link.textContent))
    expect(wrappedLabels).toEqual([])
    const question = page.locator('summary', { hasText: 'Can I use it without a connection?' })
    await question.click()
    await expect(page.getByText(/Yes, after preparing your trip while online/)).toBeVisible()
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/website-${width}.png`, fullPage: true })
  }
})

test('keyboard users can skip the header and open FAQ disclosures', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  const question = page.locator('summary', { hasText: 'Do I need to download an app?' })
  await question.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/You can create and plan a trip right in your browser/)).toBeVisible()
})

test('returning travelers get the website at root and their workspace in the app', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('trip-hub-device', JSON.stringify({
      // Use a post-reset trip: re-seeding an old one on every reload repeats alpha cleanup.
      state: { quizSeen: true, trips: { 'website-local-only': { tripId: 'website-local-only', memberId: null, joinedAt: '2026-10-09T00:08:00Z' } } },
      version: 1,
    }))
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Get the trip out of the group chat.' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your trips, all aboard.' })).toBeVisible()
})

test('the homepage keeps its content at 200 percent text scaling', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto('/')
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
  await expect(page.getByRole('link', { name: 'Create a trip', exact: true })).toBeVisible()
})

test('an existing iPhone Home Screen shortcut opens the app', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }) })
  await page.goto('/')
  await page.waitForURL('**/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
})

test('the app entry remains available offline after the service worker is ready', async ({ page, context }) => {
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return Boolean(navigator.serviceWorker.controller)
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await expect(page.getByText("Offline: changes will sync when you're back online")).toBeVisible()
})

test('the homepage preserves long headings and immediate feedback with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/')
  const heading = page.getByRole('heading', { level: 1 })
  await heading.evaluate((element) => { element.textContent = 'Averylongunbrokenheadingthatmuststayinsidethepage' })
  const box = await heading.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await expect(heading).toHaveCSS('overflow-wrap', 'anywhere')
  const create = page.getByRole('link', { name: 'Create a trip', exact: true })
  await create.focus()
  await expect(create).toHaveCSS('outline-style', 'solid')
  await expect(create).toHaveCSS('transition-duration', '0s')
})

test('the introduction and primary action fit a 1280 by 800 laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  for (const locator of [page.getByRole('heading', { level: 1 }), page.locator('.website-intro'), page.getByRole('link', { name: 'Create a trip', exact: true }), page.locator('.preview-map')]) {
    const box = await locator.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(800)
  }
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/website-laptop-fold.png` })
})

test('website text and the outlined app action meet contrast thresholds', async ({ page }) => {
  await page.goto('/')
  await page.locator('details').evaluateAll((details) => details.forEach((detail) => { detail.open = true }))
  const contrast = await page.evaluate(() => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
    const luminance = (value: string) => rgb(value).map((channel) => {
      const v = channel / 255
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
    }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0)
    const ratio = (a: string, b: string) => {
      const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y)
      return (high + .05) / (low + .05)
    }
    const background = (element: Element): string => {
      const color = getComputedStyle(element).backgroundColor
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
      return element.parentElement ? background(element.parentElement) : 'rgb(255, 255, 255)'
    }
    const failures = [...document.querySelectorAll('.website *')].filter((element) => {
      if (element.closest('[aria-hidden="true"], svg') || !element.getClientRects().length) return false
      if (![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return false
      return ratio(getComputedStyle(element).color, background(element)) < 4.5
    }).map((element) => element.textContent?.trim())
    const outline = document.querySelector('.website-button-outline')!
    return { failures, border: ratio(getComputedStyle(outline).borderColor, background(outline)) }
  })
  expect(contrast.failures).toEqual([])
  expect(contrast.border).toBeGreaterThanOrEqual(3)
})
