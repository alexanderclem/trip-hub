import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useOnline } from '@/lib/useOnline'

export function RootLayout() {
  const online = useOnline()
  const { pathname, hash } = useLocation()

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
    <div className="flex h-full flex-col">
      {!online && (
        <div className="pt-safe bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          Offline: changes will sync when you're back online
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
