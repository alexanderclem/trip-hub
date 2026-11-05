import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteObject } from 'react-router'
import { installIntentPreload, preloadPaths } from './preload'

describe('preloadPaths', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('warms each matched route once, layouts included, without running anything else', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { addEventListener: vi.fn() })
    const layout = vi.fn(async () => ({}))
    const plan = vi.fn(async () => ({}))
    const money = vi.fn(async () => ({}))
    const routes: RouteObject[] = [{ path: '/t/:tripId', lazy: layout, children: [{ path: 'plan', lazy: plan }, { path: 'money', lazy: money }] }]
    installIntentPreload(routes)

    preloadPaths(['/t/a/plan', '/t/a/plan', '/t/a/money'])
    await vi.runAllTimersAsync()

    expect(plan).toHaveBeenCalledOnce()
    expect(money).toHaveBeenCalledOnce()
    expect(layout).toHaveBeenCalledTimes(2) // once per distinct path; the module cache dedupes the import
  })
})
