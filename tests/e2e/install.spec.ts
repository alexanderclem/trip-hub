import { devices, expect, test, type Page } from '@playwright/test'

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Take Stowaway with you' })

test.beforeEach(async ({ page, baseURL }) => {
  // These checks use only this browser's data, with no server-side trips or sign-ins.
  await page.route(url => url.protocol === 'https:' && url.origin !== new URL(baseURL!).origin, (route) => route.abort())
})

test('mobile app entry shows iPhone instructions and remembers dismissal for the session', async ({ page }) => {
  await page.goto('/')
  await expect(dialog(page)).not.toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app' }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toContainText('Safari')
  await expect(dialog(page)).toContainText('Add to Home Screen')
  await expect(dialog(page).getByRole('button', { name: 'Install Stowaway' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue in browser' }).click()
  await expect(dialog(page)).not.toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await expect(dialog(page)).not.toBeVisible()
  await page.getByRole('link', { name: 'Stowaway home' }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app' }).click()
  await expect(dialog(page)).not.toBeVisible()
})

test('direct mobile entry traps focus, supports Escape, and restores the join field', async ({ page }) => {
  await page.goto('/app#join')
  await expect(dialog(page)).toBeVisible()
  const close = dialog(page).getByRole('button', { name: 'Close dialog' })
  await close.focus()
  await page.keyboard.press('Shift+Tab')
  // Native dialogs allow a stop in browser chrome while background controls stay inert.
  await expect(page.getByLabel('Trip link', { exact: true })).not.toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog(page).getByRole('button', { name: 'Continue in browser' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Trip link', { exact: true })).not.toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).not.toBeVisible()
  await expect(page.getByLabel('Trip link', { exact: true })).toBeFocused()
})

test('Home Screen launches skip installation guidance', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  await page.goto('/')
  await page.waitForURL('**/app')
  await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
  await expect(dialog(page)).not.toBeVisible()
})

test('mobile guidance reflows at 320px and enlarged text with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/app')
  await expect(dialog(page)).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/install-iphone-320.png` })
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await dialog(page).getByRole('button', { name: 'Continue in browser' }).scrollIntoViewIfNeeded()
  await dialog(page).getByRole('button', { name: 'Continue in browser' }).click()
  await expect(dialog(page)).not.toBeVisible()
})

test('dismissal still works when session storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked') } })
  })
  await page.goto('/app')
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByRole('button', { name: 'Close dialog' }).click()
  await expect(dialog(page)).not.toBeVisible()
  await page.getByRole('link', { name: 'Stowaway home' }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app' }).click()
  await expect(dialog(page)).not.toBeVisible()
})

test('trip settings keep destination and offline tools without the import section', async ({ page }) => {
  // This screen opens the app database before the local fixture writes its records.
  await page.goto('/inspire/manual')
  await expect(page.getByRole('heading', { name: 'A trip that feels like you.' })).toBeVisible()
  await page.evaluate(async () => {
    const tripId = '00000000-0000-4000-8000-000000000901'
    const memberId = '00000000-0000-4000-8000-000000000902'
    const request = indexedDB.open('trip-hub')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(['trips', 'members'], 'readwrite')
    transaction.objectStore('trips').put({ id: tripId, name: 'E2E TEST local settings', timezone: 'America/Guatemala', start_date: null, end_date: null, base_currency: 'USD', local_currency: 'GTQ', route_factor_low: 1.4, route_factor_high: 2, bbox: null, offline_pack: null, share_token: 'local-only', settings: {}, deleted_at: null })
    transaction.objectStore('members').put({ id: memberId, trip_id: tripId, display_name: 'Alex', color: null, avatar_emoji: null, deleted_at: null })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    localStorage.setItem('trip-hub-device', JSON.stringify({ state: { trips: { [tripId]: { tripId, memberId, joinedAt: '2026-10-08T12:00:00Z' } }, quizSeen: true }, version: 1 }))
  })
  await page.goto('/t/00000000-0000-4000-8000-000000000901/more/settings')
  await expect(page.getByRole('heading', { name: 'Trip settings', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Destinations', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ready for offline', exact: true })).toBeVisible()
  await expect(page.getByText('Import places', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Load Guatemala|Import a places file/ })).toHaveCount(0)
})

test.describe('desktop', () => {
  test.use({ userAgent: devices['Desktop Chrome'].userAgent, isMobile: false, hasTouch: false })
  test('no popup on desktop, including a narrow browser window', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app' }).click()
    await expect(page.getByRole('heading', { name: 'Have an invite?' })).toBeVisible()
    await expect(dialog(page)).not.toBeVisible()
    await page.reload()
    await expect(dialog(page)).not.toBeVisible()
  })
})

async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed' | 'error') {
  return page.evaluate((outcome) => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installCalls = String(Number(document.documentElement.dataset.installCalls ?? 0) + 1)
        if (outcome === 'error') throw new Error('Install unavailable')
      },
      userChoice: Promise.resolve({ outcome }),
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, outcome)
}

test.describe('Android', () => {
  test.use({ userAgent: devices['Pixel 7'].userAgent, viewport: devices['Pixel 7'].viewport })

  test('captures the native event on the website, then installs from the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await offerInstall(page, 'accepted')).toBe(true)
    await expect(dialog(page)).not.toBeVisible()
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Open app' }).click()
    await expect(dialog(page)).toBeVisible()
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/install-android.png` })
    await dialog(page).getByRole('button', { name: 'Install Stowaway' }).click()
    await expect(dialog(page)).not.toBeVisible()
    expect(await page.locator('html').getAttribute('data-install-calls')).toBe('1')
  })

  test('a declined native install can continue in the browser without reusing the event', async ({ page }) => {
    await page.goto('/app')
    await expect(dialog(page)).toBeVisible()
    expect(await offerInstall(page, 'dismissed')).toBe(true)
    await dialog(page).getByRole('button', { name: 'Install Stowaway' }).click()
    await expect(dialog(page)).toContainText('Open your browser’s menu')
    await expect(dialog(page).getByRole('button', { name: 'Install Stowaway' })).toHaveCount(0)
    expect(await page.locator('html').getAttribute('data-install-calls')).toBe('1')
    await dialog(page).getByRole('button', { name: 'Continue in browser' }).click()
    await expect(dialog(page)).not.toBeVisible()
  })

  test('native installation failure gives manual instructions and recovery', async ({ page }) => {
    await page.goto('/app')
    await expect(dialog(page)).toBeVisible()
    await offerInstall(page, 'error')
    await dialog(page).getByRole('button', { name: 'Install Stowaway' }).click()
    await expect(dialog(page).getByRole('alert')).toContainText('Installation couldn’t open')
    await expect(dialog(page)).toContainText('Open your browser’s menu')
    await dialog(page).getByRole('button', { name: 'Continue in browser' }).click()
    await expect(dialog(page)).not.toBeVisible()
  })

  test('installation through the browser closes the popup', async ({ page }) => {
    await page.goto('/app')
    await expect(dialog(page)).toBeVisible()
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await expect(dialog(page)).not.toBeVisible()
    await offerInstall(page, 'accepted')
    await expect(dialog(page)).not.toBeVisible()
  })
})
