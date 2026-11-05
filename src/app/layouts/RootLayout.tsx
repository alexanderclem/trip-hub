import { useEffect, useRef } from 'react'
import { prepareOfflineApp } from '../offlineApp'
import { Outlet, useLocation, useNavigation } from 'react-router'
import { useOnline } from '@/lib/useOnline'
import { ConfirmProvider } from '@/ui/ConfirmProvider'
import { AnimatePresence, m } from 'motion/react'
import { useMotionPreference } from '@/ui/MotionProvider'
import { PageTransition } from '@/ui/PageTransition'
import { motionTiming } from '@/ui/motion'
import { InstallAppDialog } from '@/features/install/InstallAppDialog'
import { ToastProvider } from '@/ui/ToastProvider'
import { publicPages } from '@/features/website/metadata'

export function RootLayout() {
  const online = useOnline()
  const { pathname, hash } = useLocation()
  const navigation = useNavigation()
  const reducedMotion = useMotionPreference()
  const previousPath = useRef(pathname)
  const inTrip = pathname.startsWith('/t/') && !pathname.endsWith('/who')
  const publicPage = Boolean(publicPages[pathname]) || ['/privacy', '/terms'].includes(pathname)

  useEffect(() => {
    if (!publicPages[pathname] && !['/privacy', '/terms'].includes(pathname)) prepareOfflineApp()
  }, [pathname])

  useEffect(() => {
    const changedPage = previousPath.current !== pathname
    previousPath.current = pathname
    const metadata = publicPages[pathname]
    document.title = metadata?.title ?? (pathname === '/app' ? 'Your trips — Stowaway' : 'Stowaway — Group trip planner')
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata?.description ?? 'Your shared trip workspace.')
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', metadata?.description ?? 'Your shared trip workspace.')
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (metadata) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
      canonical.href = `https://joinstowaway.app${pathname === '/' ? '' : pathname}`
    } else canonical?.remove()
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', metadata ? `https://joinstowaway.app${pathname === '/' ? '' : pathname}` : location.origin)
    if (pathname === '/app' && hash === '#join') {
      const frame = requestAnimationFrame(() => {
        document.getElementById('join')?.scrollIntoView({ block: 'start' })
        document.getElementById('trip-link')?.focus({ preventScroll: true })
      })
      return () => cancelAnimationFrame(frame)
    }
    if (metadata && hash) {
      const frame = requestAnimationFrame(() => {
        let id = hash.slice(1)
        try { id = decodeURIComponent(id) } catch { /* Keep a malformed fragment harmless. */ }
        const target = document.getElementById(id)
        if (target) { target.scrollIntoView({ block: 'start' }); target.tabIndex = -1; target.focus({ preventScroll: true }) }
      })
      return () => cancelAnimationFrame(frame)
    }
    if (!hash) window.scrollTo(0, 0)
    if (metadata && changedPage && !hash) {
      const frame = requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('#main-content h1')
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [pathname, hash])
  return (
    <ToastProvider><ConfirmProvider><div className={`${publicPage ? '' : 'app-world '}flex h-full flex-col`}>
      {/* Inside a trip the screen header's sync button says this, in the same place every time. */}
      {!online && !inTrip && (
        <div className="pt-safe bg-warning px-4 py-1.5 text-center text-sm text-warning-ink">
          Offline: changes will sync when you're back online
        </div>
      )}
      <PageTransition routeKey={pathname.startsWith('/t/') ? 'trip-workspace' : pathname} className="min-h-0 flex-1">
        <Outlet />
      </PageTransition>
      <InstallAppDialog />
      <AnimatePresence initial={false}>
        {navigation.state === 'loading' && <m.div key="navigation-loading" role="status" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={motionTiming.fade} className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-action"><span className="sr-only">Opening your next view…</span></m.div>}
      </AnimatePresence>
    </div></ConfirmProvider></ToastProvider>
  )
}
