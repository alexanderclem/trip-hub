import { useEffect } from 'react'
import { prepareOfflineApp } from '../offlineApp'
import { Outlet, useLocation, useNavigation } from 'react-router'
import { useOnline } from '@/lib/useOnline'
import { ConfirmProvider } from '@/ui/ConfirmProvider'
import { AnimatePresence, m } from 'motion/react'
import { useMotionPreference } from '@/ui/MotionProvider'
import { LoadingLogo } from '@/ui/LoadingLogo'
import { PageTransition } from '@/ui/PageTransition'
import { motionTiming } from '@/ui/motion'
import { InstallAppDialog } from '@/features/install/InstallAppDialog'

export function RootLayout() {
  const online = useOnline()
  const { pathname, hash } = useLocation()
  const navigation = useNavigation()
  const reducedMotion = useMotionPreference()

  useEffect(() => {
    if (!['/', '/privacy', '/terms'].includes(pathname)) prepareOfflineApp()
  }, [pathname])

  useEffect(() => {
    document.title = pathname === '/' ? 'Stowaway — Plan your trip together' : pathname === '/app' ? 'Your trips — Stowaway' : 'Stowaway — Group trip planner'
    if (pathname === '/app' && hash === '#join') {
      const frame = requestAnimationFrame(() => {
        document.getElementById('join')?.scrollIntoView({ block: 'start' })
        document.getElementById('trip-link')?.focus({ preventScroll: true })
      })
      return () => cancelAnimationFrame(frame)
    }
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return (
    <ConfirmProvider><div className="flex h-full flex-col">
      {!online && (
        <div className="pt-safe bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          Offline: changes will sync when you're back online
        </div>
      )}
      <PageTransition routeKey={pathname.startsWith('/t/') ? 'trip-workspace' : pathname} className="min-h-0 flex-1">
        <Outlet />
      </PageTransition>
      <InstallAppDialog />
      <AnimatePresence initial={false}>
        {navigation.state === 'loading' && <m.div key="navigation-loading" role="status" initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={motionTiming.fade} className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-stone-200 bg-surface px-4 py-2 text-sm text-brand-900 shadow-sm"><LoadingLogo compact />Opening your next view…</m.div>}
      </AnimatePresence>
    </div></ConfirmProvider>
  )
}
