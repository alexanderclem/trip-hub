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
  await expect(page.getByRole('heading', { name: 'Plan a trip with friends.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toHaveCount(0)
  // The header and footer each carry the lockup: the mark master and the drawn wordmark.
  const homes = page.getByRole('link', { name: 'Stowaway home', exact: true })
  await expect(homes).toHaveCount(2)
  for (const home of await homes.all()) {
    const mark = home.locator('img[src="/brand/stowaway-mark.svg"]')
    await expect.poll(() => mark.evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app', exact: true }).click()
  await page.waitForURL('**/app')
  await expect(page.getByRole('dialog', { name: 'Take Stowaway with you' })).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await page.getByRole('link', { name: 'Create a trip', exact: true }).first().click()
  await page.waitForURL('**/new')
  await expect(page.getByLabel('Trip name')).toBeVisible()
  await page.getByRole('link', { name: 'Back', exact: true }).click()
  await page.waitForURL('**/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
})

test('the hero demo plays the vote deciding the plan, and shows that result as its still', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  const hero = page.getByRole('img', { name: /the group votes on where to spend the afternoon/ })
  await expect(hero).toBeVisible()
  // It plays once as it comes into view: the tie, the tap, the win, then the plan's 15:00 slot fills.
  await expect(hero.getByText('Group pick', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(hero.getByText('Le Marais wins', { exact: true })).toBeVisible()
  // The feature grid: five tiles, copy as page text beside each picture.
  await expect(page.getByRole('heading', { level: 3 }).filter({ hasText: /^(The day-by-day plan|Works with no signal|Split costs as you go|Tickets ride along|One link, no app)\./ })).toHaveCount(5)
  // Reduced motion shows the finished story as one still.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(hero.getByText('Group pick', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('joining from the website focuses the invite field and retains validation', async ({ page }) => {
  await page.goto('/')
  await page.locator('.tag-hero').getByRole('link', { name: 'Join trip', exact: true }).click()
  await page.waitForURL('**/app#join')
  await expect(page.getByRole('dialog', { name: 'Take Stowaway with you' })).not.toBeVisible()
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
    const wrappedLabels = await page.locator('.tag-nav a, .tag-tear-label, .tag-link, .website-button, .website-text-link').evaluateAll((links) => links.filter((link) => {
      if (!link.getClientRects().length) return false
      const range = document.createRange()
      range.selectNodeContents(link)
      return range.getBoundingClientRect().height > parseFloat(getComputedStyle(link).fontSize) * 1.5
    }).map((link) => link.textContent))
    expect(wrappedLabels).toEqual([])
    const question = page.locator('summary', { hasText: 'How does offline work?' })
    await question.click()
    await expect(page.getByText(/Before you go, open the trip's settings while online/)).toBeVisible()
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/website-${width}.png`, fullPage: true })
  }
})

test('keyboard users can skip the header and open FAQ disclosures', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  const question = page.locator('summary', { hasText: 'Do my friends need to download anything?' })
  await question.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Stowaway runs in the browser/)).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Plan a trip with friends.' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your trips.' })).toBeVisible()
})

test('the homepage keeps its content at 200 percent text scaling', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 })
  await page.goto('/')
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
  await expect(page.getByRole('link', { name: 'Create a trip', exact: true }).first()).toBeVisible()
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
  const create = page.getByRole('link', { name: 'Create a trip', exact: true }).first()
  await create.focus()
  await expect(create).toHaveCSS('outline-style', 'solid')
  await expect(create).toHaveCSS('transition-duration', '0s')
})

test('the introduction and primary action fit a 1280 by 800 laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  for (const locator of [page.getByRole('heading', { level: 1 }), page.getByRole('link', { name: 'Create a trip', exact: true }).first(), page.getByRole('link', { name: 'Join trip', exact: true }).first()]) {
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
    // Computed colors come as rgb()/rgba(), or as color(srgb r g b / a) with 0–1 channels when the CSS
    // uses color-mix(). Translucent text is blended over its background before measuring.
    const parse = (value: string) => {
      const n = (value.match(/[\d.]+/g) ?? []).map(Number)
      const srgb = value.startsWith('color(')
      return { c: n.slice(0, 3).map((x) => (srgb ? x * 255 : x)), a: srgb || value.startsWith('rgba') ? (n[3] ?? 1) : 1 }
    }
    const luminance = (channels: number[]) => channels.map((channel) => {
      const v = channel / 255
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4
    }).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index]!, 0)
    const ratio = (fg: string, bg: string) => {
      const f = parse(fg), b = parse(bg)
      const blended = f.c.map((x, i) => x * f.a + b.c[i]! * (1 - f.a))
      const [low, high] = [luminance(blended), luminance(b.c)].sort((x, y) => x - y)
      return (high! + .05) / (low! + .05)
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
    const outline = document.querySelector('.tag-nav-link.is-app')!
    return { failures, border: ratio(getComputedStyle(outline).borderColor, background(outline)) }
  })
  expect(contrast.failures).toEqual([])
  expect(contrast.border).toBeGreaterThanOrEqual(3)
})

test('entry follows create or join intent in both reading and visual order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const joining of [false, true]) {
    await page.goto(joining ? '/app#join' : '/app')
    const routes = page.locator('.app-entry-routes')
    await expect(routes.getByRole('heading', { name: 'Start a trip' })).toBeVisible()
    const order = await routes.evaluate((element) => Array.from(element.children).map(child => child.id || child.className))
    expect(order).toEqual(joining ? ['join', 'app-start-trip'] : ['app-start-trip', 'join'])
    const first = await routes.locator(':scope > :first-child').boundingBox()
    const second = await routes.locator(':scope > :last-child').boundingBox()
    expect(first!.y).toBeLessThan(second!.y)
    if (joining) await expect(page.getByLabel('Trip link', { exact: true })).toBeFocused()
    else {
      await page.getByRole('link', { name: 'Create a trip', exact: true }).click()
      await expect(page.getByLabel('Trip name', { exact: true })).toBeVisible()
    }
  }
})
