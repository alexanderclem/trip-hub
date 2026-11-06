import { expect, test, type Page } from '@playwright/test'

// Disposable browser storage only; never create or update a live trip.
test.use({ serviceWorkers: 'block', storageState: { cookies: [], origins: [] } })
test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', (route) => route.abort())
})

const theme = (page: Page) => page.locator('html')

test('appearance follows live system changes, respects an override and survives navigation and reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/app')
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-dark')
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-light')
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await page.reload()
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-dark')
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
  await page.getByRole('link', { name: 'Create a trip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'New trip', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Your name')).toBeVisible()
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-dark')
  await page.goto('/pricing')
  await page.getByRole('radio', { name: 'System', exact: true }).check()
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-dark')
})

test('appearance changes propagate across tabs, including clearing the saved choice', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/app')
  const other = await context.newPage()
  await other.emulateMedia({ colorScheme: 'light' })
  await other.goto('/pricing')
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await expect(theme(other)).toHaveAttribute('data-theme', 'stowaway-dark')
  await expect(other.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
  await other.evaluate(() => localStorage.removeItem('stowaway-appearance'))
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-light')
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
})

test('appearance remains usable when saving preferences is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) {
      if (key === 'stowaway-appearance') throw new DOMException('Storage unavailable', 'SecurityError')
      return get.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'stowaway-appearance') throw new DOMException('Storage unavailable', 'SecurityError')
      set.call(this, key, value)
    }
  })
  await page.goto('/app')
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-dark')
  await page.getByRole('radio', { name: 'Light', exact: true }).check()
  await expect(theme(page)).toHaveAttribute('data-theme', 'stowaway-light')
})

test('appearance radios work by keyboard with a visible focus target', async ({ page }) => {
  await page.goto('/app')
  const system = page.getByRole('radio', { name: 'System', exact: true })
  await system.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
  expect(await page.getByRole('radio', { name: 'Dark', exact: true }).evaluate((input) => {
    const label = input.closest('label')!
    const style = getComputedStyle(label)
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
  })).toBe(true)
})

test('Stowie suggestions support arrow keys and Home/End without sending a reply', async ({ page }) => {
  await page.goto('/inspire')
  const suggestions = page.getByRole('group', { name: 'Suggested replies' }).getByRole('button')
  await expect(suggestions.first()).toBeVisible()
  const count = await suggestions.count()
  expect(count).toBeGreaterThan(1)
  await suggestions.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(suggestions.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(suggestions.last()).toBeFocused()
  await page.keyboard.press('Home')
  await expect(suggestions.first()).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(suggestions.last()).toBeFocused()
  await expect(suggestions).toHaveCount(count)
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`public pages and forms reflow with readable controls in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const path of ['/', '/app', '/new', '/pricing', '/organizers', '/signin', '/privacy', '/terms', '/not-found']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${path} at ${width}px`).toBe(true)
      }
      await expect(theme(page)).toHaveAttribute('data-theme', `stowaway-${colorScheme}`)
      const contrasts = await page.evaluate(() => {
        const style = getComputedStyle(document.body)
        const luminance = (hex: string) => {
          const raw = hex.trim().replace('#', '')
          const normalized = raw.length === 3 ? [...raw].map((digit) => digit.repeat(2)).join('') : raw
          const rgb = normalized.match(/.{2}/g)!.map((part) => {
            const channel = parseInt(part, 16) / 255
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
          })
          return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
        }
        const contrast = (a: string, b: string) => {
          const x = luminance(style.getPropertyValue(`--stowaway-${a}`))
          const y = luminance(style.getPropertyValue(`--stowaway-${b}`))
          return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
        }
        return {
          body: contrast('ink', 'canvas'), muted: contrast('muted', 'surface'),
          action: contrast('action', 'on-action'), selected: contrast('ink', 'on-action'),
          success: contrast('success-ink', 'success-bg'), warning: contrast('warning-ink', 'warning-bg'),
          danger: contrast('danger-ink', 'danger-bg'), control: contrast('control-border', 'surface'),
        }
      })
      for (const [name, ratio] of Object.entries(contrasts)) expect(ratio, `${path}: ${name}`).toBeGreaterThanOrEqual(name === 'control' ? 3 : 4.5)
      for (const input of await page.locator('input:not([type="radio"]):not([type="checkbox"]):visible, select:visible, textarea:visible').all()) {
        expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16)
      }
      if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/public-${path.replace(/\W/g, '') || 'landing'}-${colorScheme}.png`, fullPage: true })
    }
    expect(errors).toEqual([])
  })
}
